import type { MechanicPlugin } from "../mechanics";
import type { ServerChallenge } from "../types";
import { compareFractions, fractionsEqual, parseFractionAnswer, right, wrong, type FractionValue } from "./helpers";

export type FractionMode = "compare" | "equivalent" | "simple";

export interface FractionPayload {
  difficulty: 1 | 2 | 3;
  mode: FractionMode;
  left?: FractionValue;
  right?: FractionValue;
  fraction?: FractionValue;
  options?: FractionValue[];
}

/**
 * Fraction Puzzle mechanic (Step 02): compare fractions, find an
 * equivalent fraction, or answer a simple fraction fact. All logic is
 * exact cross-multiplication — no floating point, no ambiguity.
 */
export function createFractionPuzzleMechanic(): MechanicPlugin {
  return {
    mechanic: { id: "fraction-puzzle", kind: "fraction-puzzle", name: "Fraction Puzzle" },
    validate(challenge: ServerChallenge, answer: unknown) {
      const payload = challenge.payload as unknown as Partial<FractionPayload>;
      if (payload.mode === "compare") {
        if (!payload.left || !payload.right) return wrong("This challenge is not set up correctly. Please tell your teacher.");
        if (answer !== "left" && answer !== "right" && answer !== "equal") {
          return wrong("Choose which fraction is bigger, or if they are equal.");
        }
        const cmp = compareFractions(payload.left, payload.right);
        const expected = cmp > 0 ? "left" : cmp < 0 ? "right" : "equal";
        return answer === expected
          ? right(challenge.points)
          : wrong("Not quite. Make the denominators the same, or cross-multiply to compare fairly.");
      }
      if (payload.mode === "equivalent" || payload.mode === "simple") {
        if (!payload.fraction) return wrong("This challenge is not set up correctly. Please tell your teacher.");
        const given = parseFractionAnswer(answer);
        if (given === null) return wrong("Answer with a fraction like 2/4.");
        return fractionsEqual(given, payload.fraction) && (payload.mode !== "equivalent" || given.numerator !== payload.fraction.numerator || given.denominator !== payload.fraction.denominator)
          ? right(challenge.points)
          : wrong(payload.mode === "equivalent"
              ? "Not quite. Multiply or divide the top and bottom by the same number."
              : "Not quite. Check the fraction again carefully.");
      }
      return wrong("This challenge is not set up correctly. Please tell your teacher.");
    },
  };
}
