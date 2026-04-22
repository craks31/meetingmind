/* ════════════════════════════════════════════════════════
   MeetingMind — ui.js
   DOM manipulation and rendering helpers.
   All DOM reads/writes are centralized here.
   ════════════════════════════════════════════════════════ */

// ── DOM refs (cached once, reused forever) ────────────────────────────────
const els = {
  settingsOverlay: document.getElementById('settings-overlay'),
  apiKeyInput:     document.getElementById('api-key-input'),
  apiKeyError:     document.getElementById('api-key-error'),
  saveKeyBtn:      document.getElementById('save-key-btn'),

  gearOverlay:     document.getElementById('gear-overlay'),
  gearApiInput:    document.getElementById('gear-api-input'),
  gearKeyError:    document.getElementById('gear-key-error'),
  gearSaveBtn:     document.getElementById('gear-save-btn'),
  closeGearBtn:    document.getElementById('close-gear-btn'),
  keyStatusLabel:  document.getElementById('key-status-label'),

  hud:             document.getElementById('hud'),
  statusDot:       document.getElementById('status-dot'),
  connectionLabel: document.getElementById('connection-label'),

  finalText:       document.getElementById('final-text'),
  interimText:     document.getElementById('interim-text'),
  transcriptBox:   document.getElementById('transcript-box'),

  actionList:      document.getElementById('action-list'),
  decisionList:    document.getElementById('decision-list'),
  summaryText:     document.getElementById('summary-text'),
  aiSpinner:       document.getElementById('ai-spinner'),

  startBtn:        document.getElementById('start-btn'),
  updateBtn:       document.getElementById('update-btn'),
  clearBtn:        document.getElementById('clear-btn'),
  copyBtn:         document.getElementById('copy-btn'),

  opacitySlider:   document.getElementById('opacity-slider'),
  opacityVal:      document.getElementById('opacity-val'),

  gearBtn:         document.getElementById('gear-btn'),
  minimizeBtn:     document.getElementById('minimize-btn'),
  closeBtn:        document.getElementById('close-btn'),
};

/** Expose element refs for direct event wiring in the orchestrator */
export { els };

// ── Connection status ─────────────────────────────────────────────────────
const STATUS_LABELS = {
  disconnected: '⚫ Disconnected',
  connecting:   '🟡 Connecting…',
  connected:    '🟢 Live',
  reconnecting: '🟠 Reconnecting…',
};

/**
 * Update the connection status indicator in the header.
 * @param {string} status - One of: disconnected, connecting, connected, reconnecting
 */
export function setConnectionStatus(status) {
  if (els.connectionLabel) {
    els.connectionLabel.textContent = STATUS_LABELS[status] || '';
  }
}

// ── Error display ─────────────────────────────────────────────────────────

/**
 * Show an error message in the summary box (red text).
 * Clears after 10 seconds. Pass empty string to clear immediately.
 * @param {string} message
 */
export function showError(message) {
  if (!message) {
    els.summaryText.style.color = '';
    return;
  }
  els.summaryText.classList.remove('placeholder');
  els.summaryText.textContent = `⚠ ${message}`;
  els.summaryText.style.color = '#ff4d6d';
  setTimeout(() => { els.summaryText.style.color = ''; }, 10000);
}

// ── Recording state ───────────────────────────────────────────────────────

/** Update the UI to reflect recording state */
export function setRecordingState(recording) {
  els.startBtn.textContent = recording ? '■ Stop' : '▶ Start';
  els.startBtn.classList.toggle('recording', recording);
  els.updateBtn.disabled = false;
  els.statusDot.className = recording ? 'status-dot recording' : 'status-dot idle';
  if (!recording) els.interimText.textContent = '';
}

/** Show the "thinking" state while AI analysis is in progress */
export function setThinkingState(thinking) {
  if (thinking) {
    els.aiSpinner.classList.remove('hidden');
    els.statusDot.className = 'status-dot thinking';
    els.summaryText.classList.remove('placeholder');
    els.summaryText.textContent = '';
  } else {
    els.aiSpinner.classList.add('hidden');
  }
}

// ── Transcript rendering ──────────────────────────────────────────────────

/**
 * Append transcript text and auto-scroll.
 * @param {string} fullText - The complete accumulated transcript
 */
export function updateTranscript(fullText) {
  els.finalText.textContent = fullText;
  els.interimText.textContent = '';
  els.transcriptBox.scrollTop = els.transcriptBox.scrollHeight;
}

// ── Summary + lists rendering ─────────────────────────────────────────────

/**
 * Stream a token visually into the summary box.
 * @param {string} token
 */
export function streamToken(token) {
  const span = document.createElement('span');
  span.textContent = token;
  span.classList.add('token-new');
  if (/[a-zA-Z0-9,\. '!?\-]/.test(token)) {
    els.summaryText.appendChild(span);
  }
}

/**
 * Render a summary string with word-by-word animation.
 * @param {string} text
 */
export function renderSummary(text) {
  els.summaryText.innerHTML = '';
  els.summaryText.classList.remove('placeholder');
  if (!text) {
    els.summaryText.textContent = 'No summary yet.';
    els.summaryText.classList.add('placeholder');
    return;
  }
  for (const word of text.split(' ')) {
    const span = document.createElement('span');
    span.textContent = word + ' ';
    span.classList.add('token-new');
    els.summaryText.appendChild(span);
  }
}

/**
 * Render a list of items into a <ul> element.
 * @param {'action'|'decision'} type
 * @param {string[]} items
 * @param {string} emptyMsg
 */
export function renderList(type, items, emptyMsg) {
  const el = type === 'action' ? els.actionList : els.decisionList;
  el.innerHTML = '';

  if (!items || items.length === 0) {
    const li = document.createElement('li');
    li.textContent = emptyMsg;
    li.classList.add('placeholder-item');
    el.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  }
}

/**
 * Render a full analysis result into the HUD panels.
 * @param {{ summary: string, actionItems: string[], decisions: string[] }} result
 */
export function renderAnalysis(result) {
  renderSummary(result.summary);
  renderList('action',   result.actionItems, 'No action items detected.');
  renderList('decision', result.decisions,   'No decisions detected.');
}

/** Reset all panels to their empty/placeholder state */
export function clearAll() {
  els.finalText.textContent = '';
  els.interimText.textContent = '';
  els.summaryText.textContent = 'Streaming summary will appear here…';
  els.summaryText.classList.add('placeholder');
  renderList('action',   [], 'AI action items will appear here…');
  renderList('decision', [], 'Decisions will appear here…');
}

// ── Overlays ──────────────────────────────────────────────────────────────

export function showSettings()  { els.settingsOverlay.classList.remove('hidden'); }
export function hideSettings()  { els.settingsOverlay.classList.add('hidden'); }
export function showGear()      { els.gearOverlay.classList.remove('hidden'); }
export function hideGear()      { els.gearOverlay.classList.add('hidden'); }
export function showHud()       { els.hud.classList.remove('hidden'); }

// ── Opacity ───────────────────────────────────────────────────────────────

export function initOpacitySlider() {
  els.opacitySlider.addEventListener('input', () => {
    const pct = parseInt(els.opacitySlider.value, 10);
    els.opacityVal.textContent = pct + '%';
    document.documentElement.style.setProperty('--hud-bg-alpha', (pct / 100).toFixed(2));
  });
}
