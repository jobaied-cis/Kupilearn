import { describe, expect, it } from "vitest";
import { adaptLearner, defaultLearner, recordAnswer } from "./adapt";

describe("learner adaptation (behavior-only)", () => {
  it("starts in the middle with high explainability", () => {
    const a = adaptLearner(defaultLearner("Rafi"));
    expect(a.difficulty).toBe(2);
    expect(a.reasons.length).toBeGreaterThan(0);
  });

  it("eases off after repeated mistakes and raises challenge after success", () => {
    let p = defaultLearner("Rafi");
    for (let i = 0; i < 4; i += 1) p = recordAnswer(p, false, "c6-math-equations");
    expect(adaptLearner(p).difficulty).toBe(1);
    expect(p.mistakeTopics).toContain("c6-math-equations");

    let q = defaultLearner("Rafi");
    for (let i = 0; i < 4; i += 1) q = recordAnswer(q, true);
    expect(adaptLearner(q).difficulty).toBe(3);
  });

  it("never exposes a fixed-intelligence label", () => {
    const a = adaptLearner(defaultLearner("Rafi"));
    expect(JSON.stringify(a).toLowerCase()).not.toMatch(/smart|intelligen|talent|gifted|weak student/);
  });
});
