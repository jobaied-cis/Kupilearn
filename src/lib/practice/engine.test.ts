import { describe, expect, it } from "vitest";
import {
  buildAdaptivePracticeSet,
  buildMixedPracticeSet,
  buildPracticeSet,
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
    const easy = buildPracticeSet(6, "math-factors", 1, 5, 0);
    const hard = buildPracticeSet(6, "math-factors", 3, 5, 0);
    const maxNum = (qs: typeof easy.questions) =>
      Math.max(...qs.flatMap((q) => q.question.match(/\d+/g)?.map(Number) ?? []));
    expect(maxNum(hard.questions)).toBeGreaterThan(maxNum(easy.questions));
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
