/* ════════════════════════════════════════════════════════
   MeetingMind — app.js (Orchestrator)

   This file contains ZERO business logic. It only:
   1. Boots the application
   2. Wires module callbacks together
   3. Handles user interactions (button clicks)

   For implementation details see:
   - config.js         → constants, system prompt, tool declarations
   - gemini-ws.js      → WebSocket lifecycle + Gemini protocol + tool calls
   - audio-capture.js  → microphone → PCM chunks
   - response-parser.js → structured text / JSON parser (fallback)
   - ui.js             → all DOM manipulation
   ════════════════════════════════════════════════════════ */

import { AUTO_UPDATE_INTERVAL_MS, AUTO_UPDATE_MIN_WORDS } from './config.js';
import * as gemini from './gemini-ws.js';
import * as audio  from './audio-capture.js';
import * as parser from './response-parser.js';
import * as ui     from './ui.js';

// ── Application state ─────────────────────────────────────────────────────
let apiKey          = '';
let isRecording     = false;
let isStreaming     = false;
let fullTranscript  = '';
let modelTurnBuffer = '';
let autoUpdateTimer = null;

// Persisted analysis (for copy-to-clipboard)
let lastSummary     = '';
let lastActionItems = [];
let lastDecisions   = [];

// ── Boot ──────────────────────────────────────────────────────────────────
(async function init() {
  apiKey = await window.electronAPI.getApiKey();

  if (!apiKey) {
    ui.showSettings();
  } else {
    ui.showHud();
  }

  ui.initOpacitySlider();
  wireEventListeners();
})();

// ── Event wiring ──────────────────────────────────────────────────────────

function wireEventListeners() {
  const { els } = ui;

  // ── API key (first launch) ──
  els.saveKeyBtn.addEventListener('click', async () => {
    const val = els.apiKeyInput.value.trim();
    if (!val || val.length < 10) {
      els.apiKeyError.textContent = 'Please enter a valid Google Gemini API key.';
      els.apiKeyError.classList.remove('hidden');
      return;
    }
    els.apiKeyError.classList.add('hidden');
    const result = await window.electronAPI.saveApiKey(val);
    if (result.ok === false) {
      els.apiKeyError.textContent = result.error;
      els.apiKeyError.classList.remove('hidden');
      return;
    }
    apiKey = val;
    ui.hideSettings();
    ui.showHud();
  });

  els.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.saveKeyBtn.click();
  });

  // ── API key (gear overlay) ──
  els.gearBtn.addEventListener('click', () => {
    els.gearApiInput.value = '';
    els.gearKeyError.classList.add('hidden');
    els.keyStatusLabel.textContent = '';
    ui.showGear();
  });

  els.closeGearBtn.addEventListener('click', () => ui.hideGear());

  els.gearSaveBtn.addEventListener('click', async () => {
    const val = els.gearApiInput.value.trim();
    if (!val || val.length < 10) {
      els.gearKeyError.textContent = 'Please enter a valid Google Gemini API key.';
      els.gearKeyError.classList.remove('hidden');
      return;
    }
    els.gearKeyError.classList.add('hidden');
    const result = await window.electronAPI.saveApiKey(val);
    if (result.ok === false) {
      els.gearKeyError.textContent = result.error;
      els.gearKeyError.classList.remove('hidden');
      return;
    }
    apiKey = val;
    gemini.setApiKey(val);
    els.keyStatusLabel.textContent = '✓ Key saved successfully';
    setTimeout(() => ui.hideGear(), 1200);
  });

  // ── Window controls ──
  els.minimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());

  // ── Recording ──
  els.startBtn.addEventListener('click', toggleRecording);
  els.updateBtn.addEventListener('click', () => { if (!isStreaming) triggerAiUpdate(); });
  els.clearBtn.addEventListener('click', clearEverything);
  els.copyBtn.addEventListener('click', copyMinutes);
}

// ── Recording lifecycle ───────────────────────────────────────────────────

function toggleRecording() {
  if (isRecording) stopRecording();
  else             startRecording();
}

function startRecording() {
  if (isRecording || !apiKey) {
    if (!apiKey) ui.showGear();
    return;
  }

  isRecording = true;
  ui.setRecordingState(true);

  // Initialize Gemini WebSocket with event callbacks
  gemini.init(apiKey, {
    onSetupComplete: () => {
      audio.start((base64Pcm) => gemini.sendAudio(base64Pcm));
    },
    onInputTranscription: (text) => {
      fullTranscript += text + ' ';
      ui.updateTranscript(fullTranscript);
    },
    onOutputTranscription: (text) => {
      // In tool-only mode, model should rarely speak.
      // If it does, buffer it as a fallback.
      modelTurnBuffer += text;
      ui.streamToken(text);
    },
    onModelText: (text) => {
      // Fallback: model generated text instead of using tool
      modelTurnBuffer += text;
      ui.streamToken(text);
    },

    // ── PRIMARY OUTPUT PATH: Tool Calls ──────────────────────
    onToolCall: (result) => {
      console.log('[App] ⚡ Tool call received — rendering HUD');
      lastSummary     = result.summary;
      lastActionItems = result.actionItems;
      lastDecisions   = result.decisions;
      ui.renderAnalysis(result);

      // Clear streaming state
      isStreaming = false;
      modelTurnBuffer = '';
      ui.setThinkingState(false);
      ui.els.statusDot.className = isRecording ? 'status-dot recording' : 'status-dot idle';
    },

    onTurnComplete: () => {
      // Fallback: if model generated text/audio instead of tool call,
      // try to parse it with the regex parser
      if (modelTurnBuffer.trim()) {
        const result = parser.parse(modelTurnBuffer);
        if (result) {
          lastSummary     = result.summary;
          lastActionItems = result.actionItems;
          lastDecisions   = result.decisions;
          ui.renderAnalysis(result);
        }
        modelTurnBuffer = '';
      }
      isStreaming = false;
      ui.setThinkingState(false);
      ui.els.statusDot.className = isRecording ? 'status-dot recording' : 'status-dot idle';
    },
    onInterrupted: () => {
      modelTurnBuffer = '';
    },
    onError: (msg) => {
      ui.showError(msg);
    },
    onStatusChange: (status) => {
      ui.setConnectionStatus(status);
    },
  });

  gemini.connect();

  // Auto-trigger analysis periodically
  autoUpdateTimer = setInterval(() => {
    const wordCount = fullTranscript.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > AUTO_UPDATE_MIN_WORDS && !isStreaming) {
      triggerAiUpdate();
    }
  }, AUTO_UPDATE_INTERVAL_MS);
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;

  audio.stop();
  gemini.disconnect();
  clearInterval(autoUpdateTimer);

  ui.setRecordingState(false);
}

// ── AI analysis ───────────────────────────────────────────────────────────

function triggerAiUpdate() {
  if (isStreaming || !gemini.ready()) return;
  const text = fullTranscript.trim();
  if (!text) return;

  isStreaming = true;
  modelTurnBuffer = '';
  ui.setThinkingState(true);

  gemini.requestAnalysis(text);
}

// ── Utility actions ───────────────────────────────────────────────────────

function clearEverything() {
  fullTranscript  = '';
  modelTurnBuffer = '';
  lastSummary     = '';
  lastActionItems = [];
  lastDecisions   = [];
  ui.clearAll();
}

function copyMinutes() {
  const now = new Date().toLocaleString();
  const minutes = [
    `=== MeetingMind Minutes — ${now} ===`,
    '',
    '📝 TRANSCRIPT',
    fullTranscript || '(no transcript)',
    '',
    '📋 SUMMARY',
    lastSummary || '(no summary)',
    '',
    '✅ ACTION ITEMS',
    lastActionItems.length ? lastActionItems.map(i => `• ${i}`).join('\n') : '(none)',
    '',
    '🏛️ DECISIONS',
    lastDecisions.length ? lastDecisions.map(d => `• ${d}`).join('\n') : '(none)',
  ].join('\n');

  navigator.clipboard.writeText(minutes)
    .then(() => {
      ui.els.copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { ui.els.copyBtn.textContent = '⎘ Copy'; }, 2000);
    })
    .catch(() => {
      ui.els.copyBtn.textContent = '⚠ Failed';
      setTimeout(() => { ui.els.copyBtn.textContent = '⎘ Copy'; }, 2000);
    });
}
