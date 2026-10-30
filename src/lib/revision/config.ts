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
  /** Adaptive scheduling (Part 04), applied on the Part 01 ladder. */
  scheduling: {
    minIntervalDays: 1,
    maxIntervalDays: 45,
    /** Weak concepts come back within this many days, whatever the streak. */
    weakMaxIntervalDays: 2,
    /** Mastered concepts wait at least this long before the next review. */
    masteredMinIntervalDays: 14,
    /** Mastered intervals also grow by this factor off the ladder base. */
    masteredExtensionMultiplier: 1.5,
  },
  /** Daily workload planning (Part 05). Read-only derivation; see planning.ts. */
  planning: {
    /** Max concepts allocated to one school day. */
    dailyConceptLimit: 8,
    /** Days returned by the daily plan, starting today. */
    planningWindowDays: 3,
    /** Asia/Dhaka is UTC+6 year-round (no DST): fixed offset day math. */
    dayBoundaryOffsetMinutes: 360,
  },
  /** Daily revision session runner (Part 06). Keep sessions short. */
  session: {
    questionsPerConcept: 2,
    maxQuestionsPerSession: 10,
  },
  /** AI revision content (Part 08): on-demand only, cached, capped. */
  content: {
    flashcardMin: 3,
    flashcardMax: 5,
    maxBodyParagraphs: 4,
    maxParagraphChars: 400,
    maxCardFrontChars: 120,
    maxCardBackChars: 200,
  },
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