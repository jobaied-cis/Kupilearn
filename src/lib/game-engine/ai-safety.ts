/**
 * AI response safety & privacy filtering (Step 04, server-side).
 *
 * Every model response passes through here before it can reach a
 * student. Failures reject the response; the Game Director then uses
 * its deterministic fallback. Student free text is treated as data,
 * never as instructions (prompt-injection resistance).
 */

export const AI_MAX_RESPONSE_CHARS = 600;

const UNSAFE_PATTERNS: RegExp[] = [
  /\b(page|পৃষ্ঠা)\s*(no\.?|number|নম্বর)?\s*\d+\s*(of|in)\s+(the\s+)?(nctb|textbook|book)/i,
  /nctb\s+(chapter|textbook)[^.]*\b(page|p\.|pp\.)\s*\d+/i,
  /\b(stupid|dumb|idiot|loser|shame on you|বোকা|মূর্খ)\b/i,
  /\b(give me your|share your|তোমার)\b[^.]{0,40}\b(address|phone|school name|password|ঠিকানা|ফোন|পাসওয়ার্ড)\b/i,
];

export interface AiValidationContext {
  action: string;
  /** For hint/explanation actions, the answer must not leak. Null when leakage does not apply. */
  answerKey?: unknown;
  /** 1..3 for progressive hints; level < 3 must not contain the answer. */
  hintLevel?: number;
}

function answerTokens(answerKey: unknown): string[] {
  if (answerKey === null || answerKey === undefined) return [];
  if (Array.isArray(answerKey)) return answerKey.map(String).filter((t) => t.length > 0);
  return [String(answerKey)];
}

export interface AiTextVerdict {
  ok: boolean;
  reason?: string;
  text?: string;
}

export function validateAiText(raw: unknown, ctx: AiValidationContext): AiTextVerdict {
  if (typeof raw !== "string") return { ok: false, reason: "Response was not text" };
  const text = raw.trim();
  if (text.length === 0) return { ok: false, reason: "Response was empty" };
  if (text.length > AI_MAX_RESPONSE_CHARS) return { ok: false, reason: "Response was too long" };
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(text)) return { ok: false, reason: "Response contained an unsupported or unsafe claim" };
  }
  const isHint = ctx.action === "GENERATE_HINT";
  if ((isHint && (ctx.hintLevel ?? 3) < 3) || ctx.action === "ASK_GUIDING_QUESTION" || ctx.action === "START_CLASSMATE_DISCUSSION") {
    for (const token of answerTokens(ctx.answerKey)) {
      // Standalone occurrence of the answer value counts as leakage.
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|[^0-9A-Za-z])${escaped}([^0-9A-Za-z]|$)`).test(text)) {
        return { ok: false, reason: "Response would reveal the answer too early" };
      }
    }
  }
  return { ok: true, text };
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |the )?(previous|above|prior) instructions/i,
  /system prompt/i,
  /you are now/i,
  /reveal (the )?(answer|answers|prompt)/i,
  /forget (your|the) instructions/i,
];

/**
 * Minimum-information student text: capped, contact details removed,
 * and instruction-like content dropped entirely (treated as no text).
 */
export function sanitizeStudentText(input: unknown): string {
  if (typeof input !== "string") return "";
  let text = input.slice(0, 200);
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[removed]");
  text = text.replace(/\+?\d[\d\s-]{7,}\d/g, "[removed]");
  if (INJECTION_PATTERNS.some((p) => p.test(text))) return "";
  return text.trim();
}

export function containsInjectionAttempt(input: unknown): boolean {
  return typeof input === "string" && INJECTION_PATTERNS.some((p) => p.test(input));
}
