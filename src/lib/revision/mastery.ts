import { REVISION_CONFIG } from "./config";
import type { MasteryStatus, StudentConceptMastery } from "./types";
import type { ConceptDefinition } from "./concepts";

/**
 * Mastery foundation (Section 3B). PLACEHOLDER SCORING ONLY:
 * masteryScore is plain accuracy (correct / total). Part 02 replaces this
 * with the real mastery algorithm behind this same function signature;
 * callers and stored rows do not change.
 */
export function placeholderMasteryScore(correctAttempts: number, totalAttempts: number): number {
  if (totalAttempts <= 0) return 0;
  return Math.round((correctAttempts / totalAttempts) * 1000) / 1000;
}

export function deriveMasteryStatus(input: {
  totalAttempts: number;
  masteryScore: number;
  consecutiveIncorrect: number;
}): MasteryStatus {
  if (input.totalAttempts <= 0) return "not_started";
  if (isWeak(input)) return "weak";
  if (input.masteryScore >= REVISION_CONFIG.masteredThreshold) return "mastered";
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

/** Pure: returns the next mastery record after one attempt. Never mutates. */
export function applyAttemptToMastery(
  record: StudentConceptMastery,
  attempt: { isCorrect: boolean; nextReviewAt: string },
  now: Date,
): StudentConceptMastery {
  const correctAttempts = record.correctAttempts + (attempt.isCorrect ? 1 : 0);
  const totalAttempts = record.totalAttempts + 1;
  const next: StudentConceptMastery = {
    ...record,
    totalAttempts,
    correctAttempts,
    incorrectAttempts: record.incorrectAttempts + (attempt.isCorrect ? 0 : 1),
    consecutiveCorrect: attempt.isCorrect ? record.consecutiveCorrect + 1 : 0,
    consecutiveIncorrect: attempt.isCorrect ? 0 : record.consecutiveIncorrect + 1,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: attempt.nextReviewAt,
    updatedAt: now.toISOString(),
  };
  next.masteryScore = placeholderMasteryScore(correctAttempts, totalAttempts);
  next.masteryStatus = deriveMasteryStatus(next);
  return next;
}