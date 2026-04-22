/* ════════════════════════════════════════════════════════
   MeetingMind — PCM AudioWorklet Processor
   Captures microphone audio and converts to 16-bit PCM
   at 16 kHz for the Gemini Multimodal Live API.
   ════════════════════════════════════════════════════════ */

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Buffer to accumulate samples before posting
    this._buffer = [];
    // Post a chunk every ~250ms (4096 samples at 16kHz)
    this._chunkSize = 4096;
  }

  /**
   * Downsample from the AudioContext's sample rate to 16 kHz
   * and convert Float32 → Int16 PCM.
   */
  process(inputs /*, outputs, parameters */) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono channel
    const inputRate   = sampleRate;      // global in worklet scope
    const outputRate  = 16000;
    const ratio       = inputRate / outputRate;

    // Simple linear decimation
    for (let i = 0; i < channelData.length; i += ratio) {
      const idx = Math.floor(i);
      if (idx < channelData.length) {
        // Clamp Float32 [-1, 1] → Int16 [-32768, 32767]
        const s = Math.max(-1, Math.min(1, channelData[idx]));
        this._buffer.push(s < 0 ? s * 0x8000 : s * 0x7FFF);
      }
    }

    // When we have enough samples, post the chunk
    if (this._buffer.length >= this._chunkSize) {
      const chunk = new Int16Array(this._buffer.splice(0, this._chunkSize));
      this.port.postMessage({ pcm: chunk.buffer }, [chunk.buffer]);
    }

    return true; // keep processor alive
  }
}

registerProcessor('pcm-processor', PcmProcessor);
