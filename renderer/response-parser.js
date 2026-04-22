/* ════════════════════════════════════════════════════════
   MeetingMind — response-parser.js
   Dual-mode parser for Gemini's spoken AI responses.

   The Live API responds with audio. The model's words arrive
   as text via outputAudioTranscription. This module extracts
   structured data (summary, action items, decisions) from
   that transcription text.

   Parsing strategy:
   1. Try JSON first (fallback, unlikely with spoken responses)
   2. Parse structured natural language (SUMMARY: / ACTION ITEMS: / DECISIONS:)
   ════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} AnalysisResult
 * @property {string} summary
 * @property {string[]} actionItems
 * @property {string[]} decisions
 */

/**
 * Parse the model's accumulated response text into structured fields.
 *
 * @param {string} raw - The full accumulated text from outputTranscription
 * @returns {AnalysisResult|null} Parsed result, or null if text is empty
 */
export function parse(raw) {
  if (!raw || !raw.trim()) return null;

  return tryJsonParse(raw);
}

/**
 * Try to extract and parse a JSON object from the text.
 *
 * @param {string} raw
 * @returns {AnalysisResult|null}
 */
function tryJsonParse(raw) {
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    const data = JSON.parse(raw.slice(start, end + 1));
    return {
      summary:     data.summary      || '',
      actionItems: data.action_items || [],
      decisions:   data.decisions    || [],
    };
  } catch {
    return null;
  }
}
