import { describe, expect, it } from "vitest";
import { buildExamQueue, examPrepSource, rankExamConcepts } from "../exam";
import type { QuizConceptInput } from "../quiz";

const concept = (over: Partial<QuizConceptInput> & { conceptId: string }): QuizConceptInput => ({
  topicId: over.conceptId,
  classLevel: 8,
  masteryStatus: "practicing",
  masteryScore: 0.6,
  overdueDays: 0,
  questionCount: 3,
  recentlyCorrectIndexes: [],
  ...over,
});

describe("rankExamConcepts (Part 09 exam preparation)", () => {
  it("orders weak, then practicing/learning, then mastered last", () => {
    const ranked = rankExamConcepts([
      concept({ conceptId: "mastered", masteryStatus: "mastered", masteryScore: 0.95 }),
      concept({ conceptId: "practicing", masteryStatus: "practicing", masteryScore: 0.7 }),
      concept({ conceptId: "weak", masteryStatus: "weak", masteryScore: 0.3 }),
    ]);
    expect(ranked.map((c) => c.conceptId)).toEqual(["weak", "practicing", "mastered"]);
  });

  it("prefers the most overdue concept within the same status", () => {
    const ranked = rankExamConcepts([
      concept({ conceptId: "recent", masteryStatus: "practicing", masteryScore: 0.6, overdueDays: 1 }),
      concept({ conceptId: "stale", masteryStatus: "practicing", masteryScore: 0.6, overdueDays: 9 }),
    ]);
    expect(ranked.map((c) => c.conceptId)).toEqual(["stale", "recent"]);
  });
});

describe("examPrepSource", () => {
  it("labels weak, due, practicing, and honest none", () => {
    expect(examPrepSource([])).toBe("none");
    expect(examPrepSource([concept({ conceptId: "a", masteryStatus: "weak" })])).toBe("weak");
    expect(examPrepSource([concept({ conceptId: "a", masteryStatus: "practicing", overdueDays: 2 })])).toBe("due");
    expect(examPrepSource([concept({ conceptId: "a", masteryStatus: "mastered", masteryScore: 0.9 })])).toBe("practicing");
  });
});

describe("buildExamQueue", () => {
  it("interleaves concepts and respects the exam-prep caps (3 per concept, 15 total)", () => {
    const queue = buildExamQueue([
      concept({ conceptId: "a", masteryStatus: "weak", masteryScore: 0.2, questionCount: 5 }),
      concept({ conceptId: "b", masteryStatus: "weak", masteryScore: 0.3, questionCount: 5 }),
    ]);
    expect(queue.map((q) => `${q.conceptId}:${q.questionIndex}`)).toEqual(["a:0", "b:0", "a:1", "b:1", "a:2", "b:2"]);

    const many = Array.from({ length: 8 }, (_, i) => concept({ conceptId: `c${i}`, questionCount: 5, masteryStatus: "weak", masteryScore: i / 10 }));
    const capped = buildExamQueue(many);
    expect(capped.length).toBe(15);
    expect(Math.max(...many.map((c) => capped.filter((q) => q.conceptId === c.conceptId).length))).toBeLessThanOrEqual(3);
  });

  it("de-prioritizes recently correct questions while alternatives exist", () => {
    const queue = buildExamQueue([concept({ conceptId: "a", questionCount: 4, recentlyCorrectIndexes: [0] })]);
    expect(queue.map((q) => q.questionIndex)).toEqual([1, 2, 3]);
  });

  it("handles empty input and is deterministic", () => {
    expect(buildExamQueue([])).toEqual([]);
    const items = [concept({ conceptId: "b", masteryStatus: "weak", masteryScore: 0.3 }), concept({ conceptId: "a", masteryStatus: "weak", masteryScore: 0.2 })];
    expect(buildExamQueue(items)).toEqual(buildExamQueue(items));
    expect(buildExamQueue(items)[0]?.conceptId).toBe("a");
  });
});
