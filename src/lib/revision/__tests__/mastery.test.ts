import { describe, expect, it } from "vitest";
import { applyAttemptToMastery, computeMasteryScore, deriveMasteryStatus, emptyMastery, isWeak, weaknessReasons, type MasteryAttemptEvidence } from "../mastery";
import { getConcept } from "../concepts";

const NOW = new Date("2026-01-15T09:00:00.000Z");
const ev = (isCorrect: boolean, daysAgo = 0, difficulty: number | null = null): MasteryAttemptEvidence => ({
  isCorrect,
  difficulty,
  attemptedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
});
const corrects = (n: number, daysAgo = 0, difficulty: number | null = null) => Array.from({ length: n }, () => ev(true, daysAgo, difficulty));
const wrongs = (n: number, daysAgo = 0) => Array.from({ length: n }, () => ev(false, daysAgo));

describe("computeMasteryScore (Part 03)", () => {
  it("is 0 with no evidence", () => {
    expect(computeMasteryScore([], NOW)).toBe(0);
  });

  it("one correct answer is encouraging but not mastery (evidence prior)", () => {
    const score = computeMasteryScore([ev(true)], NOW);
    expect(score).toBeCloseTo(2 / 3, 3);
    expect(deriveMasteryStatus({ totalAttempts: 1, masteryScore: score, consecutiveCorrect: 1, consecutiveIncorrect: 0 })).toBe("practicing");
  });

  it("one wrong answer scores below the weak threshold line but is not yet labelled weak", () => {
    const score = computeMasteryScore([ev(false)], NOW);
    expect(score).toBeCloseTo(1 / 3, 3);
    expect(isWeak({ totalAttempts: 1, masteryScore: score, consecutiveIncorrect: 1 })).toBe(false);
  });

  it("reaches mastered only with enough consistent evidence", () => {
    const four = computeMasteryScore(corrects(4), NOW);
    expect(four).toBeGreaterThanOrEqual(0.8);
    expect(deriveMasteryStatus({ totalAttempts: 4, masteryScore: four, consecutiveCorrect: 4, consecutiveIncorrect: 0 })).toBe("mastered");
    const three = computeMasteryScore(corrects(3), NOW);
    expect(deriveMasteryStatus({ totalAttempts: 3, masteryScore: three, consecutiveCorrect: 3, consecutiveIncorrect: 0 })).not.toBe("mastered");
  });

  it("weights harder questions slightly more than easy ones", () => {
    const hard = computeMasteryScore([ev(true, 0, 3), ev(false)], NOW);
    const easy = computeMasteryScore([ev(true, 0, 1), ev(false)], NOW);
    expect(hard).toBeGreaterThan(easy);
  });

  it("recent evidence outweighs old evidence (recency decay enables recovery)", () => {
    const recovered = computeMasteryScore([...wrongs(3, 60), ...corrects(3, 0)], NOW);
    const stale = computeMasteryScore([...corrects(3, 60), ...wrongs(3, 0)], NOW);
    expect(recovered).toBeGreaterThan(stale);
    expect(recovered).toBeGreaterThan(0.5);
  });

  it("ignores attempts beyond the recent window", () => {
    const oldWrongs = wrongs(30, 90);
    const recentCorrects = corrects(5, 0);
    const score = computeMasteryScore([...oldWrongs, ...recentCorrects], NOW);
    // Window keeps newest 20: 5 correct + 15 of the old wrongs (decayed).
    expect(score).toBe(computeMasteryScore([...wrongs(15, 90), ...recentCorrects], NOW));
    expect(score).toBeGreaterThan(computeMasteryScore(oldWrongs, NOW));
  });

  it("is deterministic and order-independent", () => {
    const a = [ev(true), ev(false), ev(true, 3, 3), ev(false, 1)];
    const b = [...a].reverse();
    expect(computeMasteryScore(a, NOW)).toBe(computeMasteryScore(b, NOW));
    expect(computeMasteryScore(a, NOW)).toBe(computeMasteryScore(a, NOW));
  });
});

describe("weak detection and reasons", () => {
  it("flags repeated incorrect answers and explains why", () => {
    const input = { totalAttempts: 2, masteryScore: 0.25, consecutiveCorrect: 0, consecutiveIncorrect: 2 };
    expect(isWeak(input)).toBe(true);
    expect(deriveMasteryStatus(input)).toBe("weak");
    const reasons = weaknessReasons(input);
    expect(reasons.length).toBeGreaterThanOrEqual(1);
    expect(reasons.join(" ")).toContain("incorrect");
  });

  it("does not flag a healthy concept", () => {
    const input = { totalAttempts: 5, masteryScore: 0.85, consecutiveCorrect: 4, consecutiveIncorrect: 0 };
    expect(isWeak(input)).toBe(false);
    expect(weaknessReasons(input)).toEqual([]);
  });
});

describe("applyAttemptToMastery with an externally computed score", () => {
  it("transitions counters, streaks, score and status without mutating the input", () => {
    const concept = getConcept("c8-math-algebraic");
    expect(concept).not.toBeNull();
    const before = emptyMastery("stu-1", concept!, NOW);
    const after = applyAttemptToMastery(before, { isCorrect: false, nextReviewAt: NOW.toISOString(), masteryScore: 0.333 }, NOW);
    expect(before.totalAttempts).toBe(0);
    expect(after).toMatchObject({ totalAttempts: 1, correctAttempts: 0, incorrectAttempts: 1, consecutiveIncorrect: 1, masteryScore: 0.333, masteryStatus: "learning" });
  });
});
