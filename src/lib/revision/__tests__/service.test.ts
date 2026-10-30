import { describe, expect, it } from "vitest";
import { InMemoryRevisionRepository } from "../repository";
import { RevisionService } from "../service";
import { processLearningEvent } from "../events";
import { RevisionError } from "../types";

const CONCEPT = "c8-math-algebraic";
const T0 = new Date("2026-01-01T09:00:00.000Z");
const day = (n: number) => new Date(T0.getTime() + n * 86_400_000);

function makeService() {
  let current = T0;
  const repo = new InMemoryRevisionRepository();
  const service = new RevisionService(repo, () => current);
  return { repo, service, setNow: (d: Date) => { current = d; } };
}

describe("RevisionService attempt pipeline", () => {
  it("records a correct checkpoint attempt accurately", async () => {
    const { service } = makeService();
    const { attempt, mastery, schedule } = await service.recordAttempt("stu-1", {
      conceptId: CONCEPT, questionId: "q1", studentAnswer: "Read carefully", isCorrect: true, source: "understanding_check",
    });
    expect(attempt).toMatchObject({ studentId: "stu-1", conceptId: CONCEPT, isCorrect: true, studentAnswer: "Read carefully", source: "understanding_check" });
    expect(mastery).toMatchObject({ totalAttempts: 1, correctAttempts: 1, incorrectAttempts: 0, consecutiveCorrect: 1, masteryScore: 0.667, masteryStatus: "practicing" });
    expect(mastery.lastReviewedAt).toBe(T0.toISOString());
    expect(schedule.scheduledAt).toBe(day(1).toISOString());
    expect(schedule.priority).toBe("medium");
  });

  it("records an incorrect checkpoint attempt accurately and flags repetition as weak", async () => {
    const { service } = makeService();
    const first = await service.recordAttempt("stu-1", { conceptId: CONCEPT, studentAnswer: "Guess", isCorrect: false, source: "understanding_check" });
    expect(first.mastery).toMatchObject({ totalAttempts: 1, correctAttempts: 0, incorrectAttempts: 1, consecutiveIncorrect: 1, masteryScore: 0.333 });
    expect(first.schedule.priority).toBe("high");
    const second = await service.recordAttempt("stu-1", { conceptId: CONCEPT, studentAnswer: "Copy a friend", isCorrect: false, source: "understanding_check" });
    expect(second.mastery.masteryStatus).toBe("weak");
    const weak = await service.getWeakConcepts("stu-1");
    expect(weak.map((w) => w.conceptId)).toEqual([CONCEPT]);
    expect(weak[0]?.reasons.join(" ")).toContain("incorrect");
  });

  it("recovers: a correct answer after incorrect ones updates counters and score server-side", async () => {
    const { service } = makeService();
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: false, source: "practice" });
    const after = await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: true, source: "practice" });
    expect(after.mastery).toMatchObject({ totalAttempts: 2, correctAttempts: 1, incorrectAttempts: 1, consecutiveCorrect: 1, consecutiveIncorrect: 0, masteryScore: 0.5, masteryStatus: "practicing" });
  });

  it("rejects unknown concepts and creates no mastery, attempt or schedule", async () => {
    const { service, repo } = makeService();
    await expect(service.recordAttempt("stu-1", { conceptId: "c6m-ch4", isCorrect: true, source: "understanding_check" }))
      .rejects.toMatchObject({ code: "CONCEPT_NOT_FOUND", status: 404 });
    await expect(service.recordAttempt("stu-1", { conceptId: "does-not-exist", isCorrect: false, source: "practice" }))
      .rejects.toBeInstanceOf(RevisionError);
    expect(await repo.listMastery("stu-1")).toEqual([]);
    expect(await repo.listAttempts("stu-1")).toEqual([]);
    expect(await repo.listSchedules("stu-1")).toEqual([]);
    const overview = await service.getOverview("stu-1");
    expect(overview.metrics).toMatchObject({ conceptsStarted: 0, totalAttempts: 0, accuracy: null });
  });

  it("keeps students isolated", async () => {
    const { service } = makeService();
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: true, source: "practice" });
    const other = await service.getOverview("stu-2");
    expect(other.mastery).toEqual([]);
    expect(other.metrics.totalAttempts).toBe(0);
  });

  it("schedules become due and appear in upcoming only inside the window", async () => {
    const { service, setNow } = makeService();
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: true, source: "practice" });
    expect((await service.getUpcoming("stu-1", 0))).toHaveLength(0);
    setNow(day(1));
    const upcoming = await service.getUpcoming("stu-1", 0);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]).toMatchObject({ conceptId: CONCEPT, due: true });
    expect((await service.getOverview("stu-1")).dueToday).toHaveLength(1);
  });

  it("sessions tally attempts and complete idempotently", async () => {
    const { service } = makeService();
    const session = await service.startSession("stu-1", "daily");
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: true, sessionId: session.sessionId, source: "revision" });
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: false, sessionId: session.sessionId, source: "revision" });
    const done = await service.completeSession("stu-1", session.sessionId);
    expect(done).toMatchObject({ totalQuestions: 2, correctAnswers: 1, conceptsReviewed: [CONCEPT] });
    expect(done.completedAt).not.toBeNull();
    const again = await service.completeSession("stu-1", session.sessionId);
    expect(again.completedAt).toBe(done.completedAt);
    await expect(service.getSession("stu-2", session.sessionId)).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });
});

describe("adaptive scheduling through the service (Part 04)", () => {
  it("extends the interval once a concept is mastered, and resets it after a failure", async () => {
    const { service } = makeService();
    let last;
    for (let i = 0; i < 4; i += 1) {
      last = await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: true, source: "practice" });
    }
    expect(last?.mastery.masteryStatus).toBe("mastered");
    expect(last?.schedule.reviewIntervalDays).toBe(21); // ladder 14 x 1.5 mastered extension
    expect(last?.schedule.priority).toBe("low");

    const failed = await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: false, source: "practice" });
    expect(failed.schedule.reviewIntervalDays).toBe(1);
    expect(failed.schedule.priority).toBe("high");
    expect(failed.schedule.scheduledAt).toBe(day(1).toISOString());
  });

  it("keeps a weak concept on a short interval and surfaces it first in upcoming", async () => {
    const { service, setNow } = makeService();
    await service.recordAttempt("stu-weak", { conceptId: CONCEPT, isCorrect: false, source: "practice" });
    const weakAttempt = await service.recordAttempt("stu-weak", { conceptId: CONCEPT, isCorrect: false, source: "practice" });
    expect(weakAttempt.mastery.masteryStatus).toBe("weak");
    expect(weakAttempt.schedule.reviewIntervalDays).toBe(1);

    await service.recordAttempt("stu-strong", { conceptId: CONCEPT, isCorrect: true, source: "practice" });
    setNow(day(2));
    const mine = await service.getUpcoming("stu-weak", 7);
    expect(mine[0]).toMatchObject({ conceptId: CONCEPT, due: true, priority: "high" });
  });
});

describe("daily plan through the service (Part 05)", () => {
  it("derives a capped plan from real attempts and never mutates stored records", async () => {
    const { service, repo } = makeService();
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: false, source: "practice" });
    const schedulesBefore = JSON.stringify(await repo.listSchedules("stu-1"));
    const masteryBefore = JSON.stringify(await repo.listMastery("stu-1"));

    const plan1 = await service.getDailyPlan("stu-1");
    const plan2 = await service.getDailyPlan("stu-1");
    expect(plan1).toEqual(plan2);
    const allocated = plan1.days.flatMap((d) => d.items);
    expect(allocated).toHaveLength(1);
    expect(allocated[0]).toMatchObject({ conceptId: CONCEPT });
    expect(allocated[0]?.concept).toMatchObject({ id: CONCEPT });
    expect(plan1.days[0]?.items).toHaveLength(0); // due tomorrow, never allocated early

    // Reading the plan created, updated, and deleted nothing.
    expect(JSON.stringify(await repo.listSchedules("stu-1"))).toBe(schedulesBefore);
    expect(JSON.stringify(await repo.listMastery("stu-1"))).toBe(masteryBefore);
    expect(await repo.listAttempts("stu-1")).toHaveLength(1);
    expect(await repo.listEvents("stu-1")).toHaveLength(1); // only the attempt event
  });

  it("keeps students isolated in the daily plan", async () => {
    const { service } = makeService();
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: true, source: "practice" });
    const other = await service.getDailyPlan("stu-2");
    expect(other.totalDue).toBe(0);
    expect(other.days.every((d) => d.items.length === 0)).toBe(true);
  });
});

describe("concurrency-safe idempotency (Part 06)", () => {
  const sessionAttempt = { conceptId: CONCEPT, questionId: "c8-math-algebraic:revision:0", studentAnswer: "Read carefully", isCorrect: true, source: "revision" as const };

  it("scores a sequential duplicate exactly once", async () => {
    const { service, repo } = makeService();
    const session = await service.startSession("stu-1", "daily");
    const first = await service.recordAttempt("stu-1", { ...sessionAttempt, sessionId: session.sessionId });
    const second = await service.recordAttempt("stu-1", { ...sessionAttempt, sessionId: session.sessionId });
    expect(first.duplicate).toBeUndefined();
    expect(second.duplicate).toBe(true);
    expect(second.attempt.id).toBe(first.attempt.id);
    expect(await repo.listAttempts("stu-1")).toHaveLength(1);
    const stored = await service.getSession("stu-1", session.sessionId);
    expect(stored).toMatchObject({ totalQuestions: 1, correctAnswers: 1 });
    const mastery = await repo.listMastery("stu-1");
    expect(mastery[0]?.totalAttempts).toBe(1);
  });

  it("scores two SIMULTANEOUS identical submissions exactly once", async () => {
    const { service, repo } = makeService();
    const session = await service.startSession("stu-1", "daily");
    const results = await Promise.all([
      service.recordAttempt("stu-1", { ...sessionAttempt, sessionId: session.sessionId }),
      service.recordAttempt("stu-1", { ...sessionAttempt, sessionId: session.sessionId }),
    ]);
    expect(results.filter((r) => r.duplicate)).toHaveLength(1);
    expect(results[0]?.attempt.id).toBe(results[1]?.attempt.id);
    expect(await repo.listAttempts("stu-1")).toHaveLength(1);
    expect(await repo.listEvents("stu-1")).toHaveLength(2); // session-start + one attempt event
    const stored = await service.getSession("stu-1", session.sessionId);
    expect(stored.totalQuestions).toBe(1);
    expect((await repo.listMastery("stu-1"))[0]?.totalAttempts).toBe(1);
  });

  it("does not dedupe different questions, different sessions, or session-less attempts", async () => {
    const { service, repo } = makeService();
    const s1 = await service.startSession("stu-1", "daily");
    const s2 = await service.startSession("stu-1", "daily");
    await service.recordAttempt("stu-1", { ...sessionAttempt, sessionId: s1.sessionId });
    await service.recordAttempt("stu-1", { ...sessionAttempt, sessionId: s1.sessionId, questionId: "c8-math-algebraic:revision:1" });
    await service.recordAttempt("stu-1", { ...sessionAttempt, sessionId: s2.sessionId });
    await service.recordAttempt("stu-1", { ...sessionAttempt }); // classroom-style, no session
    await service.recordAttempt("stu-1", { ...sessionAttempt }); // still scored: no idempotency identity
    expect(await repo.listAttempts("stu-1")).toHaveLength(5);
  });
});

describe("targeted quiz queue (Part 07)", () => {
  it("returns weak concepts with recently-correct question indexes", async () => {
    const { service } = makeService();
    const session = await service.startSession("stu-1", "weak_concepts");
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, questionId: "c8-math-algebraic:revision:0", isCorrect: true, sessionId: session.sessionId, source: "revision" });
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: false, source: "practice" });
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: false, source: "practice" });
    const quiz = await service.getTargetedQuiz("stu-1");
    expect(quiz.source).toBe("weak");
    expect(quiz.concepts[0]).toMatchObject({ conceptId: CONCEPT, masteryStatus: "weak", recentlyCorrectIndexes: [0] });
  });

  it("falls back to due concepts, then honestly to none", async () => {
    const { service } = makeService();
    expect(await service.getTargetedQuiz("stu-1")).toEqual({ source: "none", concepts: [] });
    await service.recordAttempt("stu-1", { conceptId: CONCEPT, isCorrect: true, source: "practice" });
    const quiz = await service.getTargetedQuiz("stu-1");
    expect(quiz.source).toBe("due");
    expect(quiz.concepts.map((c) => c.conceptId)).toEqual([CONCEPT]);
  });
});

describe("processLearningEvent (Section 6 integration)", () => {
  it("routes scored events to attempts and unscored events to history only", async () => {
    const { service, repo } = makeService();
    await processLearningEvent(service, "stu-1", { source: "lesson_completion", conceptId: CONCEPT });
    expect(await repo.listMastery("stu-1")).toEqual([]);
    expect((await repo.listEvents("stu-1")).map((e) => e.eventType)).toContain("lesson_completed");

    await processLearningEvent(service, "stu-1", { source: "homework", conceptId: CONCEPT, isCorrect: true, questionId: "hw-1" });
    const mastery = await repo.listMastery("stu-1");
    expect(mastery).toHaveLength(1);
    expect(mastery[0]).toMatchObject({ totalAttempts: 1, correctAttempts: 1 });

    await expect(processLearningEvent(service, "stu-1", { source: "practice" })).rejects.toMatchObject({ code: "INVALID_LEARNING_EVENT" });
  });
});
