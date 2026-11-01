import type { MechanicPlugin } from "../mechanics";
import type { ServerChallenge } from "../types";
import { parseNumberAnswer, right, wrong } from "./helpers";

export interface NumberSequencePayload {
  difficulty: 1 | 2 | 3;
  /** The visible sequence; exactly one entry is null (the missing number). */
  sequence: (number | null)[];
  missingIndex: number;
}

/**
 * Number Sequence mechanic (Step 02): find the missing number in an
 * arithmetic progression (difficulty 2 adds decreasing sequences,
 * difficulty 3 larger steps). Validation recomputes the progression
 * from the payload itself, so it is deterministic and needs no trust
 * in the answer's origin.
 */
export function solveSequence(sequence: (number | null)[], missingIndex: number): number | null {
  const known: [number, number][] = [];
  sequence.forEach((value, index) => {
    if (value !== null) known.push([index, value]);
  });
  if (known.length < 2) return null;
  const [i1, v1] = known[0]!;
  const [i2, v2] = known[known.length - 1]!;
  const step = (v2 - v1) / (i2 - i1);
  if (!Number.isInteger(step)) return null;
  // Every visible entry must agree with one arithmetic progression.
  for (const [index, value] of known) {
    if (v1 + step * (index - i1) !== value) return null;
  }
  return v1 + step * (missingIndex - i1);
}

export function createNumberSequenceMechanic(): MechanicPlugin {
  return {
    mechanic: { id: "number-sequence", kind: "number-sequence", name: "Number Sequence" },
    validate(challenge: ServerChallenge, answer: unknown) {
      const payload = challenge.payload as unknown as Partial<NumberSequencePayload>;
      if (!Array.isArray(payload.sequence) || typeof payload.missingIndex !== "number") {
        return wrong("This challenge is not set up correctly. Please tell your teacher.");
      }
      const expected = solveSequence(payload.sequence, payload.missingIndex);
      if (expected === null) return wrong("This challenge is not set up correctly. Please tell your teacher.");
      const given = parseNumberAnswer(answer);
      if (given === null) return wrong("Type a number for the missing place.");
      return given === expected
        ? right(challenge.points)
        : wrong("Not quite. Look at how much the numbers grow or shrink each step.");
    },
  };
}

/** Deterministic challenge builder for a difficulty level (seeded by start/step). */
export function buildSequence(start: number, step: number, length: number, missingIndex: number): (number | null)[] {
  return Array.from({ length }, (_, i) => (i === missingIndex ? null : start + step * i));
}
