import { describe, expect, it } from "vitest";
import {
  buildAdaptivePracticeSet,
  buildBookmarkSet,
  buildMixedPracticeSet,
  buildPracticeSet,
  buildRetrySet,
  buildReviewPracticeSet,
  gradePracticeSet,
  isCorrectAnswer,
  makePracticeResult,
  parseNumericAnswer,
  summarizePractice,
} from "./engine";
import { defaultLearner, recordAnswer } from "../learner/adapt";
import { getClass } from "../nctb/catalog";

describe("practice engine", () => {
  it("builds deterministic sets — same arguments, same questions", () => {
    const a = buildPracticeSet(6, "math-equations", 2, 5, 0);
    const b = buildPracticeSet(6, "math-equations", 2, 5, 0);
    expect(a).toEqual(b);
    const c = buildPracticeSet(6, "math-equations", 2, 5, 1);
    expect(c.questions.map((q) => q.question)).not.toEqual(a.questions.map((q) => q.question));
  });

  it("every question has distinct options and a valid answer for its format", () => {
    for (const topicId of ["math-factors", "math-fractions", "math-algebraic", "math-equations", "math-angles", "math-area", "sci-plants", "en-tense"]) {
      for (const d of [1, 2, 3] as const) {
        const set = buildPracticeSet(6, topicId, d, 5, 3);
        expect(set.questions).toHaveLength(5);
        for (const q of set.questions) {
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.answer.length).toBeGreaterThan(0);
          expect(q.hint.length).toBeGreaterThan(0);
          expect(q.explanation.length).toBeGreaterThan(0);
          if (q.format === "numeric") {
            expect(q.options).toHaveLength(0);
            expect(parseNumericAnswer(q.answer)).not.toBeNull();
          } else {
            expect(q.options.length).toBeGreaterThanOrEqual(2);
            expect(q.options[q.answerIndex]).toBe(q.answer);
          }
        }
      }
    }
  });

  it("builds sets for every catalog topic without throwing", () => {
    const topics = getClass(6)!.subjects.flatMap((s) => s.chapters.flatMap((c) => c.topics));
    expect(topics.length).toBeGreaterThan(5);
    for (const topic of topics) {
      const set = buildPracticeSet(6, topic.id, 2);
      expect(set.topicTitle).toBe(topic.title);
      expect(
        set.questions.every((q) => q.format === "numeric" || q.options[q.answerIndex] === q.answer),
      ).toBe(true);
    }
  });

  it("difficulty widens the generated number ranges", () => {
    const lcmOperands = (difficulty: 1 | 3): number[] => {
      const out: number[] = [];
      for (let v = 0; v < 8; v += 1) {
        for (const q of buildPracticeSet(6, "math-factors", difficulty, 5, v).questions) {
          const m = /LCM of (\d+) and (\d+)/.exec(q.question);
          if (m) out.push(Number(m[1]), Number(m[2]));
        }
      }
      return out;
    };
    const easy = lcmOperands(1);
    const hard = lcmOperands(3);
    expect(easy.length).toBeGreaterThan(0);
    expect(Math.max(...easy)).toBeLessThanOrEqual(12);
    expect(Math.max(...hard)).toBeGreaterThan(24);
  });

  it("grades picks against answer indices", () => {
    const set = buildPracticeSet(6, "math-equations", 2, 5, 0);
    const rightPick = (q: (typeof set.questions)[number]) =>
      q.format === "numeric" ? q.answer : q.answerIndex;
    const wrongPick = (q: (typeof set.questions)[number]) =>
      q.format === "numeric" ? "999999" : (q.answerIndex + 1) % q.options.length;
    const allRight = gradePracticeSet(set, set.questions.map(rightPick));
    expect(allRight.score).toBe(5);
    expect(allRight.correct.every(Boolean)).toBe(true);
    const allWrong = gradePracticeSet(set, set.questions.map(wrongPick));
    expect(allWrong.score).toBe(0);
    const partial = gradePracticeSet(set, [rightPick(set.questions[0]!), null, null, null, null]);
    expect(partial.score).toBe(1);
  });

  it("adapts difficulty and variant from learner behavior", () => {
    const fresh = defaultLearner("Rafi", "school");
    const starter = buildAdaptivePracticeSet(fresh, "math-equations", []);
    expect(starter.difficulty).toBe(2);

    let struggling = defaultLearner("Rafi", "school");
    for (let i = 0; i < 4; i += 1) struggling = recordAnswer(struggling, false);
    const easier = buildAdaptivePracticeSet(struggling, "math-equations", []);
    expect(easier.difficulty).toBe(1);

    const past = [makePracticeResult(starter, 3, new Date("2026-01-01T00:00:00Z"))];
    const nextRound = buildAdaptivePracticeSet(fresh, "math-equations", past);
    expect(nextRound.id).toContain("v1");
  });

  it("grades typed answers, fractions, and true/false picks", () => {
    expect(parseNumericAnswer("9")).toBe(9);
    expect(parseNumericAnswer(" 9.0 ")).toBe(9);
    expect(parseNumericAnswer("3/4")).toBe(0.75);
    expect(parseNumericAnswer("1/0")).toBeNull();
    expect(parseNumericAnswer("nine")).toBeNull();
    expect(parseNumericAnswer("")).toBeNull();

    const set = buildPracticeSet(6, "math-equations", 2, 5, 0);
    const typed = set.questions.find((q) => q.format === "numeric");
    expect(typed).toBeDefined();
    expect(isCorrectAnswer(typed!, typed!.answer)).toBe(true);
    expect(isCorrectAnswer(typed!, "999999")).toBe(false);
    expect(isCorrectAnswer(typed!, typed!.answerIndex)).toBe(false); // index picks don't grade typed

    const graded = gradePracticeSet(
      set,
      set.questions.map((q) => (q.format === "numeric" ? q.answer : q.answerIndex)),
    );
    expect(graded.score).toBe(set.questions.length);
  });

  it("includes spot-the-mistake questions in equation sets", () => {
    const kinds = new Set<string>();
    for (let v = 0; v < 4; v += 1) {
      for (const q of buildPracticeSet(6, "math-equations", 2, 5, v).questions) kinds.add(q.kind);
    }
    expect(kinds.has("spot-mistake")).toBe(true);
    expect(kinds.has("true-false")).toBe(true);
  });

  it("builds a daily mix across topics, stable within a day", () => {
    const learner = defaultLearner("Rafi");
    const day = new Date("2026-08-04T08:00:00");
    const a = buildMixedPracticeSet(learner, day);
    const b = buildMixedPracticeSet(learner, day);
    expect(a).toEqual(b);
    expect(a.topicId).toBe("mixed");
    expect(a.questions).toHaveLength(5);
    expect(new Set(a.questions.map((q) => q.topicId)).size).toBe(5);
  });

  it("builds review sets from mistake topics and weakest accuracy", () => {
    const fresh = defaultLearner("Rafi");
    expect(buildReviewPracticeSet(fresh, [])).toBeNull();

    let learner = defaultLearner("Rafi");
    learner = recordAnswer(learner, false, "c6-math-equations");
    learner = recordAnswer(learner, false, "c6-sci-plants");
    const review = buildReviewPracticeSet(learner, []);
    expect(review).not.toBeNull();
    expect(review!.topicId).toBe("review");
    expect(review!.questions.every((q) => ["c6-math-equations", "c6-sci-plants"].includes(q.topicId))).toBe(true);

    const byAccuracy = buildReviewPracticeSet(defaultLearner("Rafi"), [
      { id: "r1", setId: "s1", classLevel: 6, topicId: "c6-math-area", difficulty: 2, total: 5, correct: 1, finishedAt: "2026-01-01T00:00:00Z" },
      { id: "r2", setId: "s2", classLevel: 6, topicId: "c6-math-factors", difficulty: 2, total: 5, correct: 5, finishedAt: "2026-01-02T00:00:00Z" },
    ]);
    expect(byAccuracy!.questions[0]!.topicId).toBe("c6-math-area");
  });

  it("rotates in the new templates (percent, mean, word problems, simplification)", () => {
    const kinds = new Set<string>();
    for (let v = 0; v < 6; v += 1) {
      for (const topicId of ["math-factors", "math-fractions", "math-algebraic", "math-equations", "math-angles", "math-area"]) {
        for (const q of buildPracticeSet(6, topicId, 2, 5, v).questions) kinds.add(q.kind);
      }
    }
    for (const kind of ["percent", "mean", "word-problem", "simplify", "fraction-subtract"]) {
      expect(kinds.has(kind)).toBe(true);
    }
  });

  it("computes correct answers for the new templates", () => {
    for (let v = 0; v < 4; v += 1) {
      const percent = buildPracticeSet(6, "math-area", 2, 5, v).questions.filter((q) => q.kind === "percent");
      for (const q of percent) {
        const m = /What is (\d+)% of (\d+)\?/.exec(q.question)!;
        expect(Number(q.answer)).toBe((Number(m[1]) * Number(m[2])) / 100);
      }
      const means = buildPracticeSet(6, "math-angles", 2, 5, v).questions.filter((q) => q.kind === "mean");
      for (const q of means) {
        const nums = q.question.match(/\d+/g)!.map(Number);
        expect((nums[0]! + nums[1]! + nums[2]!) / 3).toBe(Number(q.answer));
      }
    }
  });

  it("builds retry sets with exactly the missed questions", () => {
    const set = buildPracticeSet(6, "math-equations", 2, 5, 0);
    const picks = set.questions.map((q, i) =>
      i < 3 ? (q.format === "numeric" ? q.answer : q.answerIndex) : q.format === "numeric" ? "999999" : (q.answerIndex + 1) % q.options.length,
    );
    const retry = buildRetrySet(set, picks);
    expect(retry).not.toBeNull();
    expect(retry!.topicId).toBe("retry");
    expect(retry!.questions).toHaveLength(2);
    expect(retry!.questions.map((q) => q.question)).toEqual(
      set.questions.slice(3).map((q) => q.question),
    );
    const perfect = buildRetrySet(
      set,
      set.questions.map((q) => (q.format === "numeric" ? q.answer : q.answerIndex)),
    );
    expect(perfect).toBeNull();
  });

  it("builds bookmark sets from saved questions (capped at 10)", () => {
    const learner = defaultLearner("Rafi");
    expect(buildBookmarkSet(learner, [])).toBeNull();
    const source = buildPracticeSet(6, "math-factors", 2, 5, 0);
    const set = buildBookmarkSet(learner, source.questions);
    expect(set!.topicId).toBe("bookmarks");
    expect(set!.questions.map((q) => q.question)).toEqual(source.questions.map((q) => q.question));
    const many = Array.from({ length: 14 }, () => source.questions).flat();
    expect(buildBookmarkSet(learner, many)!.questions).toHaveLength(10);
  });

  it("summarizes results for the progress view", () => {
    const set = buildPracticeSet(6, "math-factors", 2, 5, 0);
    const summary = summarizePractice([
      makePracticeResult(set, 4, new Date("2026-01-01T00:00:00Z")),
      makePracticeResult(set, 2, new Date("2026-01-02T00:00:00Z")),
    ]);
    expect(summary).toEqual({ sessions: 2, questionsAnswered: 10, correct: 6, accuracy: 60 });
    expect(summarizePractice([]).accuracy).toBe(0);
  });
});
