import type { MechanicPlugin } from "../mechanics";
import type { ServerChallenge } from "../types";
import { isRecord, right, wrong } from "./helpers";

export interface LogicPayload {
  difficulty: 1 | 2 | 3;
  options: string[];
  /* The correct option lives ONLY in the server challenge's answerKey,
     never in this payload — payloads are sent to clients. */
}

/**
 * Logic Puzzle mechanic (Step 02): age-appropriate reasoning with
 * exactly one defensible answer. The correct option must be one of
 * the listed options — anything else is a broken challenge and is
 * rejected instead of scored.
 */
export function createLogicPuzzleMechanic(): MechanicPlugin {
  return {
    mechanic: { id: "logic-puzzle", kind: "logic-puzzle", name: "Logic Puzzle" },
    validate(challenge: ServerChallenge, answer: unknown) {
      const payload = challenge.payload as unknown as Partial<LogicPayload>;
      const correctOption = challenge.answerKey;
      if (!Array.isArray(payload.options) || typeof correctOption !== "string" || !payload.options.includes(correctOption)) {
        return wrong("This challenge is not set up correctly. Please tell your teacher.");
      }
      if (typeof answer !== "string" || answer.trim() === "") return wrong("Choose one answer.");
      if (isRecord(answer)) return wrong("Choose one answer.");
      return answer === correctOption
        ? right(challenge.points)
        : wrong("Not quite. Read the clues again slowly and rule out what cannot be true.");
    },
  };
}
