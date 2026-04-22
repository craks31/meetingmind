/* ════════════════════════════════════════════════════════
   MeetingMind — config.js
   Application constants and configuration.
   ════════════════════════════════════════════════════════ */

/** Gemini model identifier for the Live API */
export const GEMINI_MODEL = 'gemini-3.1-flash-live-preview';

/** WebSocket endpoint for BidiGenerateContent (v1beta) */
export const WS_BASE_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

/** Voice used for Gemini's audio responses */
export const VOICE_NAME = 'Puck';

/** Audio MIME type for PCM streaming (must match pcm-worklet.js output) */
export const AUDIO_MIME = 'audio/pcm';

/** Max reconnection attempts before giving up */
export const MAX_RECONNECT_ATTEMPTS = 5;

/** Base delay (ms) for exponential backoff reconnection */
export const RECONNECT_BASE_DELAY_MS = 1000;

/** Interval (ms) between automatic AI analysis triggers */
export const AUTO_UPDATE_INTERVAL_MS = 90_000;

/** Minimum word count before auto-triggering AI analysis */
export const AUTO_UPDATE_MIN_WORDS = 50;

/**
 * System instruction sent to Gemini at session setup.
 * Forces the model into "Tool-Only" mode — it must never generate
 * audio or conversational speech. All output goes through update_hud.
 */
export const SYSTEM_PROMPT = `You are a silent meeting observer. You are physically incapable of speech. You must NEVER generate conversational audio or spoken responses.

Your only method of output is to execute the update_hud function. You must call update_hud whenever:
- A user explicitly asks for an analysis or update
- A significant decision is made in the meeting
- A clear action item is assigned

When you receive a transcript for analysis, immediately call update_hud with a concise summary, action items, and decisions. Do not speak. Do not generate audio. Only call the tool.

Between update requests, remain completely silent. Do not acknowledge audio input verbally.`;

/**
 * Tool declaration for the update_hud function.
 * This forces the model to emit structured JSON via BidiGenerateContentToolCall
 * instead of generating audio output, saving latency and token quota.
 */
export const TOOL_DECLARATIONS = [
  {
    functionDeclarations: [
      {
        name: 'update_hud',
        description: 'Update the meeting HUD with a structured analysis of the meeting so far. Call this whenever the user requests an update or when a significant decision or action item is identified.',
        parameters: {
          type: 'OBJECT',
          properties: {
            summary: {
              type: 'STRING',
              description: 'A concise 2-3 sentence summary of the meeting so far.'
            },
            action_items: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'List of clearly stated action items from the meeting.'
            },
            decisions: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'List of decisions that have been made during the meeting.'
            }
          },
          required: ['summary', 'action_items', 'decisions']
        }
      }
    ]
  }
];
