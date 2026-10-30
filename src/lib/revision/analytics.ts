import type { RevisionAttempt, StudentConceptMastery } from "./types";

/** Analytics foundation (Section 3E): pure aggregates over stored rows. */
export interface RevisionMetrics {
  conceptsStarted: number;
  conceptsMastered: number;
  weakConcepts: number;
  totalAttempts: number;
  correctAttempts: number;
  /** Null (not 0) when nothing has been attempted yet. */
  accuracy: number | null;
  dueNow: number;
  sessionsCompleted: number;
}

export function computeRevisionMetrics(input: {
  mastery: StudentConceptMastery[];
  attempts: RevisionAttempt[];
  dueNow: number;
  sessionsCompleted: number;
}): RevisionMetrics {
  const totalAttempts = input.attempts.length;
  const correctAttempts = input.attempts.filter((a) => a.isCorrect).length;
  return {
    conceptsStarted: input.mastery.filter((m) => m.totalAttempts > 0).length,
    conceptsMastered: input.mastery.filter((m) => m.masteryStatus === "mastered").length,
    weakConcepts: input.mastery.filter((m) => m.masteryStatus === "weak").length,
    totalAttempts,
    correctAttempts,
    accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 1000) / 1000 : null,
    dueNow: input.dueNow,
    sessionsCompleted: input.sessionsCompleted,
  };
}