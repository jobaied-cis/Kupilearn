import { describe, expect, it } from "vitest";
import { conceptIdForTopicId, getConcept, listConcepts, validateConceptRegistry } from "../concepts";

describe("conceptIdForTopicId", () => {
  it("resolves a stable NCTB topic id to its topic-level concept", () => {
    expect(conceptIdForTopicId("c8-math-algebraic")).toBe("c8-math-algebraic");
    expect(getConcept("c8-math-algebraic")?.chapterId).toBe("c8-math-algebra");
  });

  it("returns null for sub-concepts (questions carry no sub-concept tag)", () => {
    expect(getConcept("c8-math-algebraic-variables")).not.toBeNull();
    expect(conceptIdForTopicId("c8-math-algebraic-variables")).toBeNull();
  });

  it("returns null for textbook chapter ids and missing ids (no reliable mapping)", () => {
    expect(conceptIdForTopicId("c6m-ch4")).toBeNull();
    expect(conceptIdForTopicId("c6m-ch4-1")).toBeNull();
    expect(conceptIdForTopicId(undefined)).toBeNull();
    expect(conceptIdForTopicId(null)).toBeNull();
    expect(conceptIdForTopicId("")).toBeNull();
    expect(conceptIdForTopicId("does-not-exist")).toBeNull();
  });

  it("registry has unique stable ids across Classes 6-10", () => {
    expect(() => validateConceptRegistry()).not.toThrow();
    const levels = new Set(listConcepts().map((c) => c.classLevel));
    expect([...levels].sort((a, b) => a - b)).toEqual([6, 7, 8, 9, 10]);
    const ids = listConcepts().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
