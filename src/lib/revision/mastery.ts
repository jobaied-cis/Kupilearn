import { REVISION_CONFIG } from "./config";
import type { MasteryStatus, StudentConceptMastery } from "./types";
import type { ConceptDefinition } from "./concepts";

/**
 * Concept mastery algorithm (Part 03).
 *
 * Deterministic and explainable from observable answers only: correctness,
 * lesson difficulty, recency, and streaks. It never infers fixed ability,
 * and response time is deliberately not scored (speed is not
 * understanding) - the same guardrail as lib/learner/adapt.ts.
 *
 * Score (0..1), from the most recent `recentAttemptWindow` attempts:
 *   weight(attempt) = difficultyWeight x 0.5 ^ (ageDays / halfLifeDays)
 *   score = (sum of weights of correct attempts + priorScore x priorWeight)
 *           / (sum of all weights + priorWeight)
 * The evidence prior means one lucky answer cannot read as mastery, and
 * old evidence fading means a student can always recover by re-learning.
 */

export interface MasteryAttemptEvidence {
  isCorrect: boolean;
  /** 1..3, or null when the source carried no difficulty. */
  difficulty: number | null;
  attemptedAt: string;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function attemptWeight(attempt: MasteryAttemptEvidence, now: Date): number {
  const difficultyWeight =
    attempt.difficulty !== null ? (REVISION_CONFIG.mastery.difficultyWeights[attempt.difficulty] ?? 1) : 1;
  const ageDays = Math.max(0, (now.getTime() - new Date(attempt.attemptedAt).getTime()) / 86_400_000);
  const recency = Math.pow(0.5, ageDays / REVISION_CONFIG.mastery.recencyHalfLifeDays);
  return difficultyWeight * recency;
}

/** Pure mastery score over an attempt history (any order; newest window wins). */
export function computeMasteryScore(attempts: MasteryAttemptEvidence[], now: Date): number {
  const recent = [...attempts]
    .sort((a, b) => (a.attemptedAt < b.attemptedAt ? 1 : -1))
    .slice(0, REVISION_CONFIG.mastery.recentAttemptWindow);
  if (recent.length === 0) return 0;
  let weightedTotal = 0;
  let weightedCorrect = 0;
  for (const attempt of recent) {
    const w = attemptWeight(attempt, now);
    weightedTotal += w;
    if (attempt.isCorrect) weightedCorrect += w;
  }
  const { priorScore, priorWeight } = REVISION_CONFIG.mastery;
  return round3((weightedCorrect + priorScore * priorWeight) / (weightedTotal + priorWeight));
}

export function deriveMasteryStatus(input: {
  totalAttempts: number;
  masteryScore: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
}): MasteryStatus {
  if (input.totalAttempts <= 0) return "not_started";
  if (isWeak(input)) return "weak";
  if (
    input.masteryScore >= REVISION_CONFIG.masteredThreshold &&
    input.totalAttempts >= REVISION_CONFIG.mastery.masteredMinAttempts &&
    input.consecutiveCorrect >= REVISION_CONFIG.mastery.masteredMinConsecutiveCorrect
  ) {
    return "mastered";
  }
  if (input.masteryScore >= REVISION_CONFIG.weakMasteryThreshold) return "practicing";
  return "learning";
}

export function isWeak(input: {
  totalAttempts: number;
  masteryScore: number;
  consecutiveIncorrect: number;
}): boolean {
  return (
    input.consecutiveIncorrect >= REVISION_CONFIG.weakConsecutiveIncorrect ||
    (input.totalAttempts >= REVISION_CONFIG.minAttemptsForWeak &&
      input.masteryScore < REVISION_CONFIG.weakMasteryThreshold)
  );
}

/** Student/teacher-readable reasons a concept is flagged weak. Empty when not weak. */
export function weaknessReasons(input: {
  totalAttempts: number;
  masteryScore: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
}): string[] {
  if (!isWeak(input)) return [];
  const reasons: string[] = [];
  if (input.consecutiveIncorrect >= REVISION_CONFIG.weakConsecutiveIncorrect) {
    reasons.push(`Last ${input.consecutiveIncorrect} answers in a row were incorrect.`);
  }
  if (input.totalAttempts >= REVISION_CONFIG.minAttemptsForWeak && input.masteryScore < REVISION_CONFIG.weakMasteryThreshold) {
    reasons.push(
      `Mastery is ${Math.round(input.masteryScore * 100)}% after ${input.totalAttempts} attempts (below the ${Math.round(REVISION_CONFIG.weakMasteryThreshold * 100)}% weak threshold).`,
    );
  }
  return reasons;
}

export function emptyMastery(studentId: string, concept: ConceptDefinition, now: Date): StudentConceptMastery {
  const ts = now.toISOString();
  return {
    studentId,
    subjectId: concept.subjectId,
    classLevel: concept.classLevel,
    chapterId: concept.chapterId,
    conceptId: concept.id,
    masteryScore: 0,
    totalAttempts: 0,
    correctAttempts: 0,
    incorrectAttempts: 0,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    masteryStatus: "not_started",
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * Pure: returns the next mastery record after one attempt. The caller
 * supplies the score from computeMasteryScore over the full history, so
 * this function stays a simple counter/streak transition. Never mutates.
 */
export function applyAttemptToMastery(
  record: StudentConceptMastery,
  attempt: { isCorrect: boolean; nextReviewAt: string; masteryScore: number },
  now: Date,
): StudentConceptMastery {
  const next: StudentConceptMastery = {
    ...record,
    totalAttempts: record.totalAttempts + 1,
    correctAttempts: record.correctAttempts + (attempt.isCorrect ? 1 : 0),
    incorrectAttempts: record.incorrectAttempts + (attempt.isCorrect ? 0 : 1),
    consecutiveCorrect: attempt.isCorrect ? record.consecutiveCorrect + 1 : 0,
    consecutiveIncorrect: attempt.isCorrect ? 0 : record.consecutiveIncorrect + 1,
    masteryScore: attempt.masteryScore,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: attempt.nextReviewAt,
    updatedAt: now.toISOString(),
  };
  next.masteryStatus = deriveMasteryStatus(next);
  return next;
}
