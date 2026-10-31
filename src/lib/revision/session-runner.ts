import { REVISION_CONFIG } from "./config";

/**
 * Pure helpers for the daily revision session runner (Part 06).
 * No I/O here: the component fetches questions and submits answers;
 * these functions only decide queue order, remaining work, and progress,
 * so the flow is unit-testable without rendering.
 */

export interface SessionConceptRef {
  conceptId: string;
  /** NCTB topic that supplies this concept's lesson questions. */
  topicId: string;
  classLevel: number;
}

/** Concepts for a session, in plan order, deduplicated, budget-capped by concept count. */
export function selectSessionConcepts(
  items: { conceptId: string; topicId: string; classLevel: number }[],
  maxConcepts: number = Math.ceil(REVISION_CONFIG.session.maxQuestionsPerSession / REVISION_CONFIG.session.questionsPerConcept),
): SessionConceptRef[] {
  const seen = new Set<string>();
  const out: SessionConceptRef[] = [];
  for (const item of items) {
    if (seen.has(item.conceptId)) continue;
    seen.add(item.conceptId);
    out.push({ conceptId: item.conceptId, topicId: item.topicId, classLevel: item.classLevel });
    if (out.length >= maxConcepts) break;
  }
  return out;
}

/** Planned concepts not yet recorded as reviewed in the session (resume). */
export function remainingConcepts(planned: SessionConceptRef[], conceptsReviewed: string[]): SessionConceptRef[] {
  const done = new Set(conceptsReviewed);
  return planned.filter((c) => !done.has(c.conceptId));
}

/** Deterministic per-question identity inside a session (idempotency key part). */
export function revisionQuestionId(conceptId: string, questionIndex: number): string {
  return `${conceptId}:revision:${questionIndex}`;
}

export interface SessionProgress {
  conceptsDone: number;
  conceptsTotal: number;
  questionsAnswered: number;
  questionsTotal: number;
  correctAnswers: number;
  /** 0..1, 0 when nothing has been asked yet. */
  fraction: number;
}

export function sessionProgress(input: {
  conceptsTotal: number;
  conceptsDone: number;
  questionsAnswered: number;
  questionsTotal: number;
  correctAnswers: number;
}): SessionProgress {
  return {
    ...input,
    fraction: input.questionsTotal > 0 ? Math.min(1, input.questionsAnswered / input.questionsTotal) : 0,
  };
}

/** The localStorage key holding ONLY the active session id (a pointer). */
export const ACTIVE_SESSION_KEY = "kupi-revision-session";

export function saveActiveSessionId(sessionId: string): void {
  try {
    window.localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  } catch { /* pointer is a convenience; the repository is authoritative */ }
}

export function loadActiveSessionId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearActiveSessionId(): void {
  try {
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch { /* ignore */ }
}
