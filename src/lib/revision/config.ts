/**
 * Revision Engine configuration (Part 01 foundation).
 * Deterministic only - no AI model is consulted for any value here.
 * Part 03 replaced placeholder scoring with the real mastery algorithm;
 * these knobs centralised so scheduling/scoring stay testable.
 */
export const REVISION_CONFIG = {
  /** Spaced-repetition ladder in days; index grows with consecutive correct answers. */
  reviewIntervalsDays: [1, 3, 7, 14, 30],
  /** masteryScore below this (with enough attempts) marks a concept weak. */
  weakMasteryThreshold: 0.5,
  /** masteryScore at/above this marks a concept mastered. */
  masteredThreshold: 0.8,
  /** Minimum attempts before a low score is called "weak" (avoids 0/1 noise). */
  minAttemptsForWeak: 2,
  /** Consecutive incorrect answers that also flag a concept weak. */
  weakConsecutiveIncorrect: 2,
  /** Default window for GET upcoming revisions. */
  upcomingWindowDays: 7,
  /** Hard caps so a single response can never dump unbounded history. */
  maxUpcoming: 50,
  maxHistory: 50,
  /** Mastery algorithm (Part 03): deterministic, observable answers only. */
  mastery: {
    recentAttemptWindow: 20,
    recencyHalfLifeDays: 14,
    priorScore: 0.5,
    priorWeight: 2,
    difficultyWeights: { 1: 0.8, 2: 1, 3: 1.25 } as Record<number, number>,
    masteredMinAttempts: 4,
    masteredMinConsecutiveCorrect: 3,
  },
} as const;

export type RevisionConfig = typeof REVISION_CONFIG;