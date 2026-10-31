import { describe, expect, it } from "vitest";
import { buildQuizQueue, compareQuizConcepts, orderQuestionIndexes, type QuizConceptInput } from "../quiz";

const concept = (over: Partial<QuizConceptInput> & { conceptId: string }): QuizConceptInput => ({
  topicId: over.conceptId,
  classLevel: 8,
  masteryStatus: "practicing",
  masteryScore: 0.6,
  overdueDays: 0,
  questionCount: 2,
  recentlyCorrectIndexes: [],
  ...over,
});

describe("compareQuizConcepts (weak-first targeting)", () => {
  it("orders weak before learning before practicing before mastered, then lowest score", () => {
    const items = [
      concept({ conceptId: "mastered", masteryStatus: "mastered", masteryScore: 0.95 }),
      concept({ conceptId: "practicing", masteryStatus: "practicing", masteryScore: 0.7 }),
      concept({ conceptId: "weak-high", masteryStatus: "weak", masteryScore: 0.4 }),
      concept({ conceptId: "weak-low", masteryStatus: "weak", masteryScore: 0.2 }),
    ];
    expect([...items].sort(compareQuizConcepts).map((c) => c.conceptId)).toEqual(["weak-low", "weak-high", "practicing", "mastered"]);
  });
});

describe("buildQuizQueue", () => {
  it("interleaves concepts round-robin instead of blocking them", () => {
    const queue = buildQuizQueue([
      concept({ conceptId: "a", masteryStatus: "weak", masteryScore: 0.2 }),
      concept({ conceptId: "b", masteryStatus: "weak", masteryScore: 0.3 }),
    ]);
    expect(queue.map((q) => `${q.conceptId}:${q.questionIndex}`)).toEqual(["a:0", "b:0", "a:1", "b:1"]);
  });

  it("respects per-concept and total session caps", () => {
    const many = Array.from({ length: 8 }, (_, i) => concept({ conceptId: `c${i}`, questionCount: 5, masteryStatus: "weak", masteryScore: i / 10 }));
    const queue = buildQuizQueue(many);
    expect(queue.length).toBe(10); // session cap
    expect(Math.max(...many.map((c) => queue.filter((q) => q.conceptId === c.conceptId).length))).toBeLessThanOrEqual(2);
  });

  it("de-prioritizes recently correct questions while alternatives exist", () => {
    const c = concept({ conceptId: "a", questionCount: 3, recentlyCorrectIndexes: [0] });
    expect(orderQuestionIndexes(c)).toEqual([1, 2]);
    const queue = buildQuizQueue([c]);
    expect(queue.map((q) => q.questionIndex)).toEqual([1, 2]);
  });

  it("falls back to proven questions when no fresh alternative exists", () => {
    const c = concept({ conceptId: "a", questionCount: 2, recentlyCorrectIndexes: [0, 1] });
    expect(orderQuestionIndexes(c)).toEqual([0, 1]);
    expect(buildQuizQueue([c])).toHaveLength(2);
  });

  it("handles empty and question-less concepts honestly", () => {
    expect(buildQuizQueue([])).toEqual([]);
    expect(buildQuizQueue([concept({ conceptId: "a", questionCount: 0 })])).toEqual([]);
  });

  it("is deterministic", () => {
    const items = [concept({ conceptId: "b", masteryStatus: "weak", masteryScore: 0.3 }), concept({ conceptId: "a", masteryStatus: "weak", masteryScore: 0.2 })];
    expect(buildQuizQueue(items)).toEqual(buildQuizQueue(items));
    expect(buildQuizQueue(items)[0]?.conceptId).toBe("a");
  });
});
