import type { MechanicPlugin } from "../mechanics";
import type { ServerChallenge } from "../types";
import { parseNumberAnswer, right, wrong } from "./helpers";

export interface ShapeFacts {
  sides: number;
  vertices: number;
  angleSum: number;
}

/** Unambiguous, text-defined shape facts (no unsupported diagrams). */
export const SHAPE_FACTS: Record<string, ShapeFacts> = {
  triangle: { sides: 3, vertices: 3, angleSum: 180 },
  quadrilateral: { sides: 4, vertices: 4, angleSum: 360 },
  square: { sides: 4, vertices: 4, angleSum: 360 },
  rectangle: { sides: 4, vertices: 4, angleSum: 360 },
  pentagon: { sides: 5, vertices: 5, angleSum: 540 },
  hexagon: { sides: 6, vertices: 6, angleSum: 720 },
};

export interface ShapePayload {
  difficulty: 1 | 2 | 3;
  shape: string;
  /** What is asked: "sides", "vertices", "angleSum", or "name". */
  ask: "sides" | "vertices" | "angleSum" | "name";
  options?: string[];
}

export function createShapePuzzleMechanic(): MechanicPlugin {
  return {
    mechanic: { id: "shape-puzzle", kind: "shape-puzzle", name: "Shape Puzzle" },
    validate(challenge: ServerChallenge, answer: unknown) {
      const payload = challenge.payload as unknown as Partial<ShapePayload>;
      const facts = payload.shape ? SHAPE_FACTS[payload.shape] : undefined;
      if (!facts || !payload.ask) return wrong("This challenge is not set up correctly. Please tell your teacher.");
      if (payload.ask === "name") {
        if (typeof answer !== "string" || answer.trim() === "") return wrong("Choose a shape name.");
        return answer.trim().toLowerCase() === payload.shape
          ? right(challenge.points)
          : wrong("Not quite. Count the sides to name the shape.");
      }
      const given = parseNumberAnswer(answer);
      if (given === null) return wrong("Type a number.");
      const expected = facts[payload.ask];
      return given === expected
        ? right(challenge.points)
        : wrong(payload.ask === "angleSum"
            ? "Not quite. For any polygon, the inside angles add up to (sides − 2) × 180°."
            : "Not quite. Count carefully around the shape, one by one.");
    },
  };
}
