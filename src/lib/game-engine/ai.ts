/**
 * Meta-only AI integration contract (Step 01: contract only).
 *
 * Kupi's generative AI is Meta-only. This contract is the single door
 * future steps may use for AI hints/explanations inside games, and it
 * deliberately names no model, endpoint, or provider SDK. The actual
 * Meta implementation arrives in Step 04 through the existing
 * `createLLMClient()` path in lib/curriculum — games must not call any
 * other provider (no OpenAI, Gemini, Groq, Claude, or others).
 */
export const GAME_AI_PROVIDER = "meta" as const;

export interface GameAiAdapter {
  readonly provider: typeof GAME_AI_PROVIDER;
  /** A hint for a curriculum-bound challenge. No learner personal data is passed. */
  hintFor(input: { topicTitle: string; prompt: string; grade: number }): Promise<string>;
  /** A short explanation after a validated answer. Server-side only. */
  explain(input: { topicTitle: string; prompt: string; correct: boolean }): Promise<string>;
}
