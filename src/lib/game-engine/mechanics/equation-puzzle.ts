import type { MechanicPlugin } from "../mechanics";
import type { ServerChallenge } from "../types";
import { parseNumberAnswer, right, wrong } from "./helpers";

export interface EquationPayload {
  difficulty: 1 | 2 | 3;
  /** Display form, e.g. "x + 4 = 11". Clear mathematical notation. */
  equation: string;
  unknown: string;
  /** a·x + b = c form used for deterministic solving. */
  a: number;
  b: number;
  c: number;
}

/** Solve a·x + b = c exactly; null when there is no single integer solution. */
export function solveEquation(a: number, b: number, c: number): number | null {
  if (a === 0) return null;
  const x = (c - b) / a;
  return Number.isInteger(x) ? x : null;
}

export function createEquationPuzzleMechanic(): MechanicPlugin {
  return {
    mechanic: { id: "equation-puzzle", kind: "equation-puzzle", name: "Equation Puzzle" },
    validate(challenge: ServerChallenge, answer: unknown) {
      const payload = challenge.payload as unknown as Partial<EquationPayload>;
      if (typeof payload.a !== "number" || typeof payload.b !== "number" || typeof payload.c !== "number") {
        return wrong("This challenge is not set up correctly. Please tell your teacher.");
      }
      const expected = solveEquation(payload.a, payload.b, payload.c);
      if (expected === null) return wrong("This challenge is not set up correctly. Please tell your teacher.");
      const given = parseNumberAnswer(answer);
      if (given === null) return wrong("Type a number for the missing value.");
      return given === expected
        ? right(challenge.points)
        : wrong("Not quite. Undo the operations one step at a time, and check by putting your answer back in.");
    },
  };
}
