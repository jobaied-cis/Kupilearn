import type { MechanicPlugin } from "../mechanics";
import type { ServerChallenge } from "../types";
import { right, wrong } from "./helpers";

export interface DragBuildPayload {
  difficulty: 1 | 2 | 3;
  /** Tiles the student may arrange (numbers, symbols, fractions, shapes). */
  tiles: string[];
  /** Instruction, e.g. "Build the equation that makes 7". */
  instruction: string;
  /** Optionally accept any arrangement that is mathematically equivalent. */
  expression?: { tiles: string[] };
}

/**
 * Drag & Build mechanic (Step 02): arrange tiles into the target
 * structure. Validation compares the submitted tile order with the
 * server-held target order. The answer is a plain string array, so
 * the exact same validation serves drag-and-drop, tap-to-place, and
 * the keyboard alternative (arrow-key reordering in the UI).
 */
export function createDragBuildMechanic(): MechanicPlugin {
  return {
    mechanic: { id: "drag-build", kind: "drag-build", name: "Drag & Build" },
    validate(challenge: ServerChallenge, answer: unknown) {
      const payload = challenge.payload as unknown as Partial<DragBuildPayload>;
      const target = challenge.answerKey;
      if (!Array.isArray(payload.tiles) || !Array.isArray(target) || target.some((t) => typeof t !== "string")) {
        return wrong("This challenge is not set up correctly. Please tell your teacher.");
      }
      if (!Array.isArray(answer) || answer.some((t) => typeof t !== "string")) {
        return wrong("Arrange the tiles to build the answer first.");
      }
      if (answer.length === 0) return wrong("Place at least one tile to build your answer.");
      if (answer.length !== target.length) return wrong("Your build is not complete yet. Use all the needed tiles.");
      const exact = answer.every((tile, i) => tile === target[i]);
      return exact
        ? right(challenge.points)
        : wrong("Not quite. Check what each part of your build means, then rearrange.");
    },
  };
}
