import { describe, expect, it, vi } from "vitest";
import { createCheckpointReporter } from "../client";
import type { RecordAttemptInput } from "../types";

const base = { conceptId: "c8-math-algebraic", stepIdx: 0, question: "Best first step?", isCorrect: true, studentAnswer: "Read carefully" };

describe("createCheckpointReporter (ClassroomFlow checkpoint reporting)", () => {
  it("submits a correct attempt once, with the checkpoint question id", () => {
    const submit = vi.fn<(input: RecordAttemptInput) => void>();
    const report = createCheckpointReporter(submit);
    expect(report(base)).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      conceptId: "c8-math-algebraic",
      questionId: "c8-math-algebraic:checkpoint:0",
      studentAnswer: "Read carefully",
      isCorrect: true,
      source: "understanding_check",
    });
  });

  it("prevents an identical duplicate submission", () => {
    const submit = vi.fn<(input: RecordAttemptInput) => void>();
    const report = createCheckpointReporter(submit);
    expect(report(base)).toBe(true);
    expect(report(base)).toBe(false);
    expect(report(base)).toBe(false);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("still records a genuinely new attempt: different answer, outcome or step", () => {
    const submit = vi.fn<(input: RecordAttemptInput) => void>();
    const report = createCheckpointReporter(submit);
    expect(report({ ...base, isCorrect: false, studentAnswer: "Guess" })).toBe(true);
    expect(report({ ...base, isCorrect: false, studentAnswer: "Copy a friend" })).toBe(true);
    expect(report(base)).toBe(true);
    expect(report({ ...base, stepIdx: 1 })).toBe(true);
    expect(submit).toHaveBeenCalledTimes(4);
    expect(submit.mock.calls.map((c) => c[0].isCorrect)).toEqual([false, false, true, true]);
  });
});
