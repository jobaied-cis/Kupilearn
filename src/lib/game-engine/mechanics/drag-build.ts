import type { MechanicPlugin } from "../mechanics";
import type { ServerChallenge } from "../types";
import { right, wrong } from "./helpers";

export interface DragBuildPayload {
  difficulty: 1 | 2 | 3;
  /** Tiles the student may arrange (numbers, symbols, fractions, shapes). */
  tiles: string[];
  /** Instruction, e.g. "Build the equation that makes 7". */
  instruction: string;
  /**
   * True when tile ORDER is itself part of the learning objective
   * (e.g. "build the sequence in order"). Ordered challenges always
   * require the exact arrangement.
   */
  orderMatters?: boolean;
  /**
   * "equation" builds are validated mathematically: any arrangement
   * that forms a true equation (3 + 4 = 7, 4 + 3 = 7, 7 = 3 + 4) is
   * correct, while false statements (3 + 7 = 4) are not. Ignored when
   * orderMatters is true.
   */
  buildKind?: "equation" | "ordered" | "free";
}

/** Pure tile-arrangement helpers shared by drag, tap, and keyboard controls. */
export function insertTile(placed: string[], tile: string, index?: number): string[] {
  const next = [...placed];
  next.splice(index === undefined ? next.length : Math.max(0, Math.min(index, next.length)), 0, tile);
  return next;
}

export function moveTile(placed: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= placed.length || to >= placed.length) return [...placed];
  const next = [...placed];
  const [tile] = next.splice(from, 1);
  next.splice(to, 0, tile!);
  return next;
}

export function removeTileAt(placed: string[], index: number): string[] {
  return placed.filter((_, i) => i !== index);
}

const OPERATORS = new Set(["+", "-", "×", "x", "*", "÷", "/"]);

function numberTile(tile: string): number | null {
  if (tile.trim() === "") return null;
  const n = Number(tile);
  return Number.isFinite(n) ? n : null;
}

function applyOp(a: number, op: string, b: number): number | null {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×":
    case "x":
    case "*": return a * b;
    case "÷":
    case "/": return b === 0 ? null : a / b;
    default: return null;
  }
}

/** Evaluate one side of an equation build: a single number, or number op number. */
function evalSide(tokens: string[]): number | null {
  if (tokens.length === 1) return numberTile(tokens[0]!);
  if (tokens.length === 3) {
    const a = numberTile(tokens[0]!);
    const b = numberTile(tokens[2]!);
    if (a === null || b === null || !OPERATORS.has(tokens[1]!)) return null;
    return applyOp(a, tokens[1]!, b);
  }
  return null;
}

/** True when the tiles form a mathematically true equation statement. */
export function isTrueEquationBuild(answer: string[]): boolean {
  const eq = answer.indexOf("=");
  if (eq <= 0 || eq !== answer.lastIndexOf("=") || eq === answer.length - 1) return false;
  const left = evalSide(answer.slice(0, eq));
  const right = evalSide(answer.slice(eq + 1));
  if (left === null || right === null) return false;
  return Math.abs(left - right) < 1e-9;
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
      const multiset = (tiles: string[]) => [...tiles].sort().join("|");
      if (multiset(answer) !== multiset(target as string[])) {
        return wrong("Use only the tiles you were given.");
      }
      const exact = answer.every((tile, i) => tile === target[i]);
      if (exact) return right(challenge.points);
      // Mathematically equivalent equation builds are also correct —
      // unless this challenge's order is itself the learning objective.
      const ordered = payload.orderMatters === true || payload.buildKind === "ordered";
      if (!ordered && payload.buildKind === "equation" && isTrueEquationBuild(answer)) {
        return right(challenge.points);
      }
      return wrong(ordered
        ? "Not quite. The order matters here — check the order again."
        : "Not quite. Check what each part of your build means, then rearrange.");
    },
  };
}
