import { describe, expect, it } from "vitest";
import { AdaptiveDifficulty } from "./adaptive";
import { resolveCurriculumContext } from "./curriculum-context";
import { createDragBuildMechanic, isTrueEquationBuild } from "./mechanics/drag-build";
import { resolveChallengeContext } from "./lesson-context";
import { createClass6MathMisconceptionRegistry, MisconceptionTracker } from "./misconceptions";
import { SessionPerformance, type PerformanceSnapshot } from "./performance";
import { recommend } from "./recommendations";
import { listClientMissions, startMissionSession, submitMissionAnswer } from "./server";
import type { ServerChallenge } from "./types";

const challenge = (over: Partial<ServerChallenge>): ServerChallenge => ({
  id: "t-1",
  gameId: "puzzle-quest",
  mechanicId: "number-sequence",
  type: "number-sequence",
  grade: 6,
  subjectId: "math",
  prompt: "test",
  payload: {},
  status: "approved",
  answerKey: null,
  points: 10,
  ...over,
});

const snapshot = (over: Partial<PerformanceSnapshot> = {}): PerformanceSnapshot => ({
  answered: 0,
  correct: 0,
  incorrect: 0,
  totalAttempts: 0,
  totalHints: 0,
  currentCorrectStreak: 0,
  currentIncorrectStreak: 0,
  perMechanic: {},
  repeatedErrorPatterns: {},
  completedObjectives: [],
  evidence: [],
  ...over,
});
const ev = (correct: boolean, attemptsUsed = 1, hintsUsed = 0) => ({
  challengeId: "c",
  mechanicId: "quiz",
  correct,
  attemptsUsed,
  hintsUsed,
  difficulty: 1 as const,
  at: "2026-02-01T00:00:00.000Z",
});

describe("NCTB curriculum context (Step 03)", () => {
  it("maps Class 6 Math topics to verified textbook chapters with source traceability", () => {
    const ctx = resolveCurriculumContext({ classLevel: 6, topicId: "c6-math-fractions" });
    expect(ctx).toMatchObject({
      source: "nctb-textbook",
      approvalStatus: "verified",
      chapterId: "c6m-ch1",
      chapterTitle: "Natural Numbers and Fractions",
      topicTitle: "Fractions: Compare & Calculate",
    });
    expect(ctx?.sourceRef).toContain("Revised Edition Oct 2025");
    expect(ctx?.sourceRef).toContain("Chapter 1");
    const eq = resolveCurriculumContext({ classLevel: 6, topicId: "c6-math-equations" });
    expect(eq?.chapterId).toBe("c6m-ch5");
  });

  it("stays draft-sample where only the catalog structure exists, and null for unknown topics", () => {
    const ctx = resolveCurriculumContext({ classLevel: 8, topicId: "c8-math-fractions" });
    expect(ctx?.approvalStatus).toBe("draft-sample");
    expect(ctx?.source).toBe("nctb-catalog");
    expect(resolveCurriculumContext({ classLevel: 6, topicId: "no-such-topic" })).toBeNull();
  });
});

describe("Lesson context resolution", () => {
  it("resolves real lesson context and falls back safely when unavailable", () => {
    const known = resolveChallengeContext({
      challenge: challenge({ topicId: "c6-math-fractions", learningObjective: "Compare fractions" }),
      missionTitle: "Mission",
    });
    expect(known.contextSource).toBe("lesson-engine");
    expect(known.conceptExplanation.length).toBeGreaterThan(10);
    expect(known.prerequisites.length).toBeGreaterThan(0);

    const unknown = resolveChallengeContext({
      challenge: challenge({ topicId: "c6-math-fractions", grade: 99, learningObjective: "Compare fractions" }),
      missionTitle: "Mission",
    });
    expect(unknown.contextSource).toBe("static-fallback");
    expect(unknown.conceptExplanation).toContain("compare fractions");
  });
});

describe("Session performance model", () => {
  it("tracks per-mechanic evidence, streaks, objectives — and holds no identity", () => {
    const perf = new SessionPerformance();
    perf.record({ challengeId: "a", mechanicId: "number-sequence", correct: true, attemptsUsed: 1, hintsUsed: 0, difficulty: 1, learningObjective: "Find the rule", at: "t" });
    perf.record({ challengeId: "b", mechanicId: "number-sequence", correct: false, attemptsUsed: 2, hintsUsed: 1, difficulty: 1, at: "t" }, "k");
    perf.record({ challengeId: "c", mechanicId: "equation-puzzle", correct: false, attemptsUsed: 2, hintsUsed: 0, difficulty: 1, at: "t" }, "k");
    const snap = perf.snapshot();
    expect(snap).toMatchObject({ answered: 3, correct: 1, incorrect: 2, totalAttempts: 5, totalHints: 1, currentIncorrectStreak: 2 });
    expect(snap.perMechanic["number-sequence"]).toMatchObject({ answered: 2, correct: 1 });
    expect(snap.completedObjectives).toEqual(["Find the rule"]);
    expect(JSON.stringify(snap)).not.toContain("student");
    expect(Object.keys(snap)).not.toContain("learnerId");
  });
});

describe("Adaptive difficulty", () => {
  it("increases only after 3 clean wins, decreases after repeated errors, and respects bounds", () => {
    const up = new AdaptiveDifficulty(1);
    expect(up.evaluate(snapshot({ answered: 3, evidence: [ev(true), ev(true), ev(true)], currentCorrectStreak: 3 }))).toMatchObject({ difficulty: 2, changed: true });

    const notYet = new AdaptiveDifficulty(1);
    expect(notYet.evaluate(snapshot({ answered: 1, evidence: [ev(true)], currentCorrectStreak: 1 })).changed).toBe(false);
    expect(notYet.evaluate(snapshot({ answered: 3, evidence: [ev(true, 2, 1), ev(true), ev(true)], currentCorrectStreak: 3 })).difficulty).toBe(1); // win needed hints/retries

    const down = new AdaptiveDifficulty(3);
    expect(down.evaluate(snapshot({ answered: 3, evidence: [ev(true), ev(false), ev(false)], currentIncorrectStreak: 2 }))).toMatchObject({ difficulty: 2, changed: true });
    const floor = new AdaptiveDifficulty(1);
    expect(floor.evaluate(snapshot({ answered: 3, evidence: [ev(false), ev(false), ev(false)], currentIncorrectStreak: 3 })).difficulty).toBe(1);
    const ceiling = new AdaptiveDifficulty(3);
    expect(ceiling.evaluate(snapshot({ answered: 4, evidence: [ev(true), ev(true), ev(true), ev(true)], currentCorrectStreak: 4 })).difficulty).toBe(3);
  });

  it("eases down when hints and retries carry the work", () => {
    const engine = new AdaptiveDifficulty(2);
    const decision = engine.evaluate(snapshot({ answered: 3, evidence: [ev(true, 2, 2), ev(true, 2, 3), ev(false, 2, 2)] }));
    expect(decision.difficulty).toBe(1);
    expect(decision.reason).toContain("Hints");
  });
});

describe("Misconception detection (false-positive guard)", () => {
  const tracker = () => new MisconceptionTracker(createClass6MathMisconceptionRegistry());
  const seqChallenge = challenge({
    mechanicId: "number-sequence",
    payload: { difficulty: 1, sequence: [2, 5, 8, null, 14], missingIndex: 3 },
    answerKey: 11,
  });

  it("never signals on a single wrong answer, signals on a repeated pattern", () => {
    const t = tracker();
    expect(t.observe(seqChallenge, 9)).toBeNull(); // 8 + 1: counts-by-one, first time
    const signal = t.observe(seqChallenge, 9);
    expect(signal?.ruleId).toBe("sequence-counts-by-one");
    expect(signal?.supportiveExplanation).toContain("bigger step");
  });

  it("does not signal for unrelated wrong answers", () => {
    const t = tracker();
    expect(t.observe(seqChallenge, 100)).toBeNull();
    expect(t.observe(seqChallenge, 4)).toBeNull();
  });

  it("detects equation undoing and fraction numerator patterns", () => {
    const t = tracker();
    const eq = challenge({ mechanicId: "equation-puzzle", payload: { a: 1, b: 4, c: 11 }, answerKey: 7 });
    expect(t.observe(eq, 15)).toBeNull();
    expect(t.observe(eq, 15)?.ruleId).toBe("equation-adds-instead-of-undoing");
    const frac = challenge({
      mechanicId: "fraction-puzzle",
      payload: { mode: "compare", left: { numerator: 3, denominator: 5 }, right: { numerator: 2, denominator: 3 } },
      answerKey: "right",
    });
    expect(t.observe(frac, "left")).toBeNull();
    expect(t.observe(frac, "left")?.ruleId).toBe("fraction-bigger-numerator");
  });
});

describe("Recommendations", () => {
  const base = {
    snapshot: snapshot(),
    adaptation: { difficulty: 1 as const, changed: false, reason: "" },
    misconception: null,
    prerequisites: ["Inverse operations"],
    currentDifficulty: 1 as const,
    sessionCompleted: false,
  };

  it("prioritizes misconception review, then prerequisite, then continue", () => {
    expect(recommend({ ...base, lastRecordedCorrect: false, misconception: { ruleId: "r", mechanicId: "m", occurrences: 2, supportiveExplanation: "Try the step." } }).kind).toBe("review-concept");
    expect(recommend({ ...base, lastRecordedCorrect: false })).toMatchObject({ kind: "prerequisite" });
    expect(recommend({ ...base, lastRecordedCorrect: true, snapshot: snapshot({ currentCorrectStreak: 3 }) }).kind).toBe("continue");
    expect(recommend({ ...base, lastRecordedCorrect: null, sessionCompleted: true }).kind).toBe("continue");
  });
});

describe("Drag & Build commutative fix (Step 03)", () => {
  const plugin = createDragBuildMechanic();
  const build = challenge({
    mechanicId: "drag-build",
    payload: { difficulty: 2, tiles: ["4", "=", "3", "+", "7"], instruction: "build", buildKind: "equation" },
    answerKey: ["3", "+", "4", "=", "7"],
  });

  it("accepts 3 + 4 = 7 and 4 + 3 = 7 and 7 = 3 + 4", () => {
    expect(plugin.validate(build, ["3", "+", "4", "=", "7"]).correct).toBe(true);
    expect(plugin.validate(build, ["4", "+", "3", "=", "7"]).correct).toBe(true);
    expect(plugin.validate(build, ["7", "=", "3", "+", "4"]).correct).toBe(true);
    expect(isTrueEquationBuild(["4", "+", "3", "=", "7"])).toBe(true);
  });

  it("rejects invalid mathematical arrangements and foreign tiles", () => {
    expect(plugin.validate(build, ["3", "+", "7", "=", "4"]).correct).toBe(false);
    expect(plugin.validate(build, ["3", "-", "4", "=", "7"]).correct).toBe(false); // '-' tile not given
    expect(plugin.validate(build, ["9", "+", "9", "=", "18"]).correct).toBe(false); // tiles not given
  });

  it("ordered challenges still require the exact arrangement", () => {
    const ordered = challenge({
      mechanicId: "drag-build",
      payload: { difficulty: 1, tiles: ["1", "2", "3"], instruction: "Build 1, 2, 3 in order", orderMatters: true, buildKind: "ordered" },
      answerKey: ["1", "2", "3"],
    });
    expect(plugin.validate(ordered, ["1", "2", "3"]).correct).toBe(true);
    expect(plugin.validate(ordered, ["3", "2", "1"]).correct).toBe(false);
    // Even a mathematically true equation is wrong when order is the objective.
    const orderedEq = challenge({
      mechanicId: "drag-build",
      payload: { difficulty: 2, tiles: ["4", "=", "3", "+", "7"], instruction: "Build exactly: 3 + 4 = 7", orderMatters: true, buildKind: "equation" },
      answerKey: ["3", "+", "4", "=", "7"],
    });
    expect(plugin.validate(orderedEq, ["4", "+", "3", "=", "7"]).correct).toBe(false);
  });
});

describe("Server integration (Step 03)", () => {
  it("missions carry traceable curriculum context, still with no answer data", () => {
    const missions = listClientMissions();
    const first = missions[0]!;
    expect(first.contexts["pq1-frac"]?.curriculum).toMatchObject({ chapterId: "c6m-ch1", approvalStatus: "verified" });
    expect(first.contexts["pq1-frac"]?.contextSource).toBe("lesson-engine");
    expect(JSON.stringify(missions)).not.toContain("answerKey");
  });

  it("answers return adaptation and recommendation, and commutative builds pass end-to-end", () => {
    const { sessionId } = startMissionSession("pq-c6-math-first-steps");
    const first = submitMissionAnswer(sessionId, "pq1-seq", 11);
    expect(first.recommendation?.kind).toBe("continue");
    submitMissionAnswer(sessionId, "pq1-eq", 7);
    submitMissionAnswer(sessionId, "pq1-frac", "left");
    submitMissionAnswer(sessionId, "pq1-shape", 3);
    submitMissionAnswer(sessionId, "pq1-logic", "Karim");
    const final = submitMissionAnswer(sessionId, "pq1-build", ["4", "+", "3", "=", "7"]);
    expect(final.correct).toBe(true);
    expect(final.result).toMatchObject({ correct: 6, score: 65 });
    expect(final.adaptation).not.toBeNull();
  });
});
