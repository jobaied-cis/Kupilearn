import { describe, expect, it } from "vitest";
import { remainingConcepts, revisionQuestionId, selectSessionConcepts, sessionProgress } from "../session-runner";

const item = (conceptId: string, topicId = conceptId, classLevel = 8) => ({ conceptId, topicId, classLevel });

describe("selectSessionConcepts", () => {
  it("keeps plan order, deduplicates, and caps the concept count by the session budget", () => {
    const items = [item("a"), item("b"), item("a"), item("c"), item("d"), item("e"), item("f")];
    const selected = selectSessionConcepts(items);
    expect(selected.map((c) => c.conceptId)).toEqual(["a", "b", "c", "d", "e"]); // 10 questions / 2 per concept
  });

  it("uses the parent topic for sub-concepts", () => {
    const selected = selectSessionConcepts([item("c8-math-algebraic-variables", "c8-math-algebraic")]);
    expect(selected[0]).toMatchObject({ conceptId: "c8-math-algebraic-variables", topicId: "c8-math-algebraic" });
  });
});

describe("remainingConcepts (resume)", () => {
  it("skips concepts already recorded as reviewed, preserving order", () => {
    const planned = selectSessionConcepts([item("a"), item("b"), item("c")]);
    expect(remainingConcepts(planned, ["a", "c"]).map((c) => c.conceptId)).toEqual(["b"]);
    expect(remainingConcepts(planned, [])).toEqual(planned);
    expect(remainingConcepts(planned, ["a", "b", "c"])).toEqual([]);
  });
});

describe("revisionQuestionId + sessionProgress", () => {
  it("builds stable per-question identities for idempotency", () => {
    expect(revisionQuestionId("c8-math-algebraic", 0)).toBe("c8-math-algebraic:revision:0");
    expect(revisionQuestionId("c8-math-algebraic", 0)).toBe(revisionQuestionId("c8-math-algebraic", 0));
    expect(revisionQuestionId("c8-math-algebraic", 1)).not.toBe(revisionQuestionId("c8-math-algebraic", 0));
  });

  it("derives progress fractions safely", () => {
    expect(sessionProgress({ conceptsTotal: 2, conceptsDone: 1, questionsAnswered: 3, questionsTotal: 4, correctAnswers: 2 }).fraction).toBe(0.75);
    expect(sessionProgress({ conceptsTotal: 0, conceptsDone: 0, questionsAnswered: 0, questionsTotal: 0, correctAnswers: 0 }).fraction).toBe(0);
  });
});
