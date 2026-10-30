import { describe, expect, it } from "vitest";
import { computeRevisionTrends } from "../analytics";
import type { RevisionAttempt, RevisionSession, StudentConceptMastery } from "../types";

const NOW = new Date("2026-01-31T12:00:00.000Z"); // 18:00 in Dhaka, 2026-01-31

let seq = 0;
const attempt = (over: Partial<RevisionAttempt> & { attemptedAt: string }): RevisionAttempt => ({
  id: `att-${seq++}`,
  studentId: "stu-1",
  conceptId: "c8-math-algebraic",
  questionId: null,
  studentAnswer: null,
  isCorrect: true,
  difficulty: null,
  responseTimeMs: null,
  sessionId: null,
  source: "practice",
  ...over,
});

const session = (over: Partial<RevisionSession>): RevisionSession => ({
  studentId: "stu-1",
  sessionId: `ses-${seq++}`,
  sessionType: "daily",
  conceptsReviewed: [],
  totalQuestions: 2,
  correctAnswers: 1,
  startedAt: "2026-01-30T05:00:00.000Z",
  completedAt: "2026-01-30T06:00:00.000Z",
  ...over,
});

const mastery = (over: Partial<StudentConceptMastery>): StudentConceptMastery => ({
  studentId: "stu-1",
  subjectId: "math",
  classLevel: 8,
  chapterId: "algebra",
  conceptId: "c8-math-algebraic",
  masteryScore: 0.3,
  totalAttempts: 2,
  correctAttempts: 0,
  incorrectAttempts: 2,
  consecutiveCorrect: 0,
  consecutiveIncorrect: 2,
  lastReviewedAt: null,
  nextReviewAt: null,
  masteryStatus: "weak",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const subjects = new Map<string, string | null>([["c8-math-algebraic", "math"]]);
const base = { sessions: [] as RevisionSession[], mastery: [] as StudentConceptMastery[], subjectByConcept: subjects, now: NOW, windowDays: 7 };

describe("computeRevisionTrends (Part 10)", () => {
  it("returns an honest empty window for no data", () => {
    const t = computeRevisionTrends({ ...base, attempts: [] });
    expect(t.startDate).toBe("2026-01-25");
    expect(t.endDate).toBe("2026-01-31");
    expect(t.daily).toHaveLength(7);
    expect(t.totals).toEqual({ attempts: 0, correct: 0, accuracy: null, activeDays: 0 });
    expect(t.accuracyDeltaPoints).toBeNull();
    expect(t.consistency).toEqual({ activeDays: 0, windowDays: 7, longestRunDays: 0 });
    expect(t.subjects).toEqual([]);
    expect(t.truncated).toBe(false);
  });

  it("buckets attempts by Dhaka day, with accuracy null on empty days", () => {
    const t = computeRevisionTrends({
      ...base,
      attempts: [
        // 2026-01-30T17:59:59Z = 23:59 Dhaka Jan 30; +1s = Jan 31 in Dhaka.
        attempt({ attemptedAt: "2026-01-30T17:59:59.000Z", isCorrect: true }),
        attempt({ attemptedAt: "2026-01-30T18:00:00.000Z", isCorrect: false }),
      ],
    });
    const jan30 = t.daily.find((d) => d.date === "2026-01-30");
    const jan31 = t.daily.find((d) => d.date === "2026-01-31");
    expect(jan30).toMatchObject({ attempts: 1, correct: 1, accuracy: 1 });
    expect(jan31).toMatchObject({ attempts: 1, correct: 0, accuracy: 0 });
    expect(t.daily.find((d) => d.date === "2026-01-29")?.accuracy).toBeNull();
    expect(t.totals.activeDays).toBe(2);
  });

  it("withholds the accuracy delta until both halves have at least 5 attempts", () => {
    const few = computeRevisionTrends({ ...base, attempts: [attempt({ attemptedAt: "2026-01-26T05:00:00.000Z" })] });
    expect(few.accuracyDeltaPoints).toBeNull();

    const many: RevisionAttempt[] = [];
    for (let i = 0; i < 5; i++) many.push(attempt({ attemptedAt: "2026-01-26T05:00:00.000Z", isCorrect: false }));
    for (let i = 0; i < 5; i++) many.push(attempt({ attemptedAt: "2026-01-30T05:00:00.000Z", isCorrect: true }));
    const t = computeRevisionTrends({ ...base, attempts: many });
    expect(t.accuracyDeltaPoints).toBe(100);
  });

  it("counts active-day consistency and the longest run inside the window", () => {
    const t = computeRevisionTrends({
      ...base,
      attempts: [
        attempt({ attemptedAt: "2026-01-28T05:00:00.000Z" }),
        attempt({ attemptedAt: "2026-01-29T05:00:00.000Z" }),
        attempt({ attemptedAt: "2026-01-30T05:00:00.000Z" }),
        attempt({ attemptedAt: "2026-01-25T05:00:00.000Z" }),
      ],
      sessions: [session({})],
    });
    expect(t.consistency.activeDays).toBe(4);
    expect(t.consistency.longestRunDays).toBe(3);
    expect(t.daily.find((d) => d.date === "2026-01-30")?.sessionsCompleted).toBe(1);
    expect(t.sessionsByType).toEqual([{ sessionType: "daily", started: 1, completed: 1 }]);
  });

  it("derives window-start mastery by replay and lists improving concepts", () => {
    const before = [
      attempt({ attemptedAt: "2026-01-20T05:00:00.000Z", isCorrect: false }),
      attempt({ attemptedAt: "2026-01-20T06:00:00.000Z", isCorrect: false }),
    ];
    const t = computeRevisionTrends({
      ...base,
      attempts: [...before, attempt({ attemptedAt: "2026-01-30T05:00:00.000Z", isCorrect: true })],
      mastery: [mastery({ masteryStatus: "practicing", masteryScore: 0.6, consecutiveIncorrect: 0 })],
    });
    expect(t.mastery.weakAtWindowStart).toBe(1);
    expect(t.mastery.weakNow).toBe(0);
    expect(t.mastery.improvingConceptIds).toEqual(["c8-math-algebraic"]);
    expect(t.mastery.stillWeakConceptIds).toEqual([]);
  });

  it("groups subjects and never guesses unmapped concepts into a subject", () => {
    const t = computeRevisionTrends({
      ...base,
      attempts: [
        attempt({ attemptedAt: "2026-01-30T05:00:00.000Z", isCorrect: true }),
        attempt({ attemptedAt: "2026-01-30T06:00:00.000Z", isCorrect: false, conceptId: "c6m-ch4" }),
      ],
    });
    expect(t.subjects).toEqual([{ subjectId: "math", attempts: 1, correct: 1, accuracy: 1 }]);
    expect(t.unmappedAttempts).toBe(1);
  });

  it("passes the truncation flag through", () => {
    expect(computeRevisionTrends({ ...base, attempts: [], truncated: true }).truncated).toBe(true);
  });
});
