import { describe, expect, it } from "vitest";
import { InMemoryProgressStore, recommendNextMission } from "./progress";
import { computeXp, evaluateBadges, RewardLedger, XP_RULES, type ChallengeOutcome } from "./rewards";
import { getGameProgress, startMissionSession, submitMissionAnswer } from "./server";
import type { GameResult } from "./types";

const outcome = (over: Partial<ChallengeOutcome> = {}): ChallengeOutcome => ({
  challengeId: "c1",
  mechanicId: "number-sequence",
  stage: "main",
  correct: true,
  hintsUsed: 0,
  learningObjective: "Find the rule",
  ...over,
});

const result = (over: Partial<GameResult> = {}): GameResult => ({
  sessionId: "s1",
  gameId: "puzzle-quest",
  totalChallenges: 6,
  answered: 6,
  correct: 6,
  hintsUsed: 0,
  score: 65,
  completedAt: "2026-02-01T00:00:00.000Z",
  ...over,
});

describe("XP calculation (Step 05)", () => {
  it("awards transparent XP for correct challenges, completion, and an independent final", () => {
    const outcomes = [
      outcome(),
      outcome({ challengeId: "c2", mechanicId: "equation-puzzle" }),
      outcome({ challengeId: "c3", correct: false }),
      outcome({ challengeId: "c4", stage: "final", mechanicId: "drag-build" }),
    ];
    const xp = computeXp(outcomes, true);
    expect(xp).toEqual({
      challengeXp: 3 * XP_RULES.perCorrectChallenge,
      completionXp: XP_RULES.missionComplete,
      independentXp: XP_RULES.independentFinalNoHints,
      total: 3 * XP_RULES.perCorrectChallenge + XP_RULES.missionComplete + XP_RULES.independentFinalNoHints,
    });
    expect(computeXp(outcomes, false).completionXp).toBe(0);
    const hintedFinal = computeXp([outcome({ stage: "final", hintsUsed: 1 })], true);
    expect(hintedFinal.independentXp).toBe(0); // hints on the final remove the independent bonus, nothing else
    const wrongFinal = computeXp([outcome({ stage: "final", correct: false })], true);
    expect(wrongFinal.independentXp).toBe(0);
    // Incorrect answers never subtract XP.
    expect(computeXp([outcome({ correct: false })], false).total).toBe(0);
  });
});

describe("RewardLedger duplicate prevention", () => {
  it("awards once per session even if completion is claimed repeatedly", () => {
    const ledger = new RewardLedger();
    const xp = computeXp([outcome()], true);
    const first = ledger.award({ sessionId: "s1", missionId: "m1", xp, badges: [], result: result() });
    expect(first.duplicate).toBe(false);
    const again = ledger.award({ sessionId: "s1", missionId: "m1", xp: computeXp([outcome(), outcome(), outcome()], true), badges: [], result: result() });
    expect(again.duplicate).toBe(true);
    expect(again.award.xp.total).toBe(first.award.xp.total);
  });
});

describe("Badge eligibility", () => {
  const aggregate = {
    missionsCompleted: ["m1"],
    totalXp: 0,
    challengesAnswered: 6,
    challengesCorrect: 6,
    objectivesCovered: [],
    mechanicsExplored: ["number-sequence", "equation-puzzle", "fraction-puzzle", "drag-build"],
    badgesEarned: [],
  };

  it("awards first-mission, puzzle-solver, independent-thinker, concept-explorer deterministically", () => {
    const fresh = evaluateBadges({
      aggregate,
      sessionOutcomes: [outcome(), outcome({ challengeId: "f", stage: "final" })],
      missionId: "m1",
      missionCompleted: true,
    });
    expect(fresh).toEqual(expect.arrayContaining(["first-mission", "puzzle-solver", "independent-thinker", "concept-explorer"]));
    const hinted = evaluateBadges({
      aggregate: { ...aggregate, badgesEarned: fresh },
      sessionOutcomes: [outcome({ challengeId: "f", stage: "final", hintsUsed: 2 })],
      missionId: "m1",
      missionCompleted: true,
    });
    expect(hinted).toEqual([]); // nothing new; independent-thinker already earned, not re-awarded
  });
});

describe("Progress Engine (session-only)", () => {
  it("aggregates missions, objectives, mechanics and XP; duplicate sessions change nothing", () => {
    const store = new InMemoryProgressStore();
    const record = {
      sessionId: "s1",
      missionId: "m1",
      completed: true,
      outcomes: [outcome(), outcome({ challengeId: "c2", mechanicId: "equation-puzzle", correct: false, learningObjective: "Balance" })],
      xpTotal: 35,
      badges: [],
      completedAt: "2026-02-01T00:00:00.000Z",
    };
    const p1 = store.recordSession("learner-a", record);
    expect(p1).toMatchObject({ missionsCompleted: ["m1"], totalXp: 35, challengesAnswered: 2, challengesCorrect: 1, persistence: "session-only" });
    expect(p1.objectivesCovered).toEqual(["Find the rule"]);
    expect(p1.mechanicsExplored).toEqual(["number-sequence"]);
    const p2 = store.recordSession("learner-a", record);
    expect(p2.totalXp).toBe(35);
    expect(p2.sessionsPlayed).toBe(1);
    // Another learner sees nothing — no fabricated or shared progress.
    expect(store.getProgress("learner-b").totalXp).toBe(0);
    expect(store.getProgress("learner-b").missionsCompleted).toEqual([]);
  });

  it("recommends the next incomplete mission, then a replay", () => {
    const store = new InMemoryProgressStore();
    const empty = store.getProgress("x");
    expect(recommendNextMission(empty, ["m1", "m2"]).missionId).toBe("m1");
    store.recordSession("x", { sessionId: "s", missionId: "m1", completed: true, outcomes: [outcome()], xpTotal: 10, badges: [], completedAt: null });
    const after = store.getProgress("x");
    expect(recommendNextMission(after, ["m1", "m2"]).missionId).toBe("m2");
    store.recordSession("x", { sessionId: "s2", missionId: "m2", completed: true, outcomes: [outcome()], xpTotal: 10, badges: [], completedAt: null });
    expect(recommendNextMission(store.getProgress("x"), ["m1", "m2"]).reason).toContain("replay");
  });
});

describe("Server results with rewards (Step 05 integration)", () => {
  it("awards server XP and badges at completion and never double-awards", () => {
    const ref = `learner-test-${Date.now()}`;
    const { sessionId } = startMissionSession("pq-c6-math-first-steps", ref);
    submitMissionAnswer(sessionId, "pq1-seq", 11);
    submitMissionAnswer(sessionId, "pq1-eq", 7);
    submitMissionAnswer(sessionId, "pq1-frac", "left");
    submitMissionAnswer(sessionId, "pq1-shape", 3);
    submitMissionAnswer(sessionId, "pq1-logic", "Karim");
    const final = submitMissionAnswer(sessionId, "pq1-build", ["3", "+", "4", "=", "7"]);
    // 6 correct x10 + 25 completion + 15 independent final (no hints) = 100
    expect(final.rewards?.xp.total).toBe(100);
    expect(final.rewards?.badges).toEqual(expect.arrayContaining(["first-mission", "puzzle-solver", "independent-thinker", "concept-explorer"]));
    expect(final.rewards?.persistence).toBe("session-only");
    const progress = getGameProgress(ref);
    expect(progress.totalXp).toBe(100);
    expect(progress.missionsCompleted).toEqual(["pq-c6-math-first-steps"]);
    // A different learner has no progress — nothing fabricated or shared.
    expect(getGameProgress("someone-else").totalXp).toBe(0);
    expect(final.result).toMatchObject({ correct: 6, score: 65 });
    expect(JSON.stringify(final)).not.toContain("answerKey");
  });
});
