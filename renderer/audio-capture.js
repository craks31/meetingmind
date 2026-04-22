/* ════════════════════════════════════════════════════════
   MeetingMind — audio-capture.js
   Microphone capture via AudioWorklet → PCM streaming.

   Latency notes:
   - AudioWorklet runs on the audio rendering thread (not main thread).
   - Chunks are posted every ~250ms (4096 samples at 16kHz).
   - The onChunk callback fires on the main thread with base64 PCM,
     ready to be sent directly to the WebSocket with zero copying.
   ════════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────────────────────
/** @type {AudioContext|null} */
let audioContext = null;

/** @type {MediaStream|null} */
let micStream = null;

/** @type {AudioWorkletNode|null} */
let workletNode = null;

/** @type {((base64: string) => void)|null} */
let onChunkCallback = null;

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Start capturing audio from the microphone.
 * Chunks of base64-encoded Int16 PCM are delivered via onChunk.
 *
 * @param {(base64Pcm: string) => void} onChunk - Called with each audio chunk
 * @throws {Error} If microphone access is denied
 */
export async function start(onChunk) {
  onChunkCallback = onChunk;

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000, // hint — browser may not honor this
    }
  });

  audioContext = new AudioContext({ sampleRate: 16000 });
  await audioContext.audioWorklet.addModule('pcm-worklet.js');

  const source = audioContext.createMediaStreamSource(micStream);
  workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

  workletNode.port.onmessage = (event) => {
    if (onChunkCallback) {
      onChunkCallback(arrayBufferToBase64(event.data.pcm));
    }
  };

  source.connect(workletNode);
  workletNode.connect(audioContext.destination); // required for worklet to run

  console.log('[AudioCapture] ✓ Microphone active');
}

/**
 * Stop capturing and release all audio resources.
 */
export function stop() {
  onChunkCallback = null;

  if (workletNode) {
    workletNode.disconnect();
    workletNode = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }

  console.log('[AudioCapture] Stopped');
}

// ── Utilities ─────────────────────────────────────────────────────────────

/**
 * Convert an ArrayBuffer to a base64 string.
 * This is on the hot path — called ~4 times/second.
 *
 * @param {ArrayBuffer} buffer
 * @returns {string} Base64-encoded string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
