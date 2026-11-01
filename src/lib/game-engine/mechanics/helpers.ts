import type { ValidationResult } from "../types";

/** Shared deterministic answer parsing for mechanic plugins (Step 02). */

export const wrong = (explanation: string): ValidationResult => ({ correct: false, points: 0, explanation });
export const right = (points: number): ValidationResult => ({ correct: true, points });

/** Accepts 5, "5", " 5 ", "5.0"; rejects "", "abc", null, objects, NaN. */
export function parseNumberAnswer(answer: unknown): number | null {
  if (typeof answer === "number") return Number.isFinite(answer) ? answer : null;
  if (typeof answer === "string" && answer.trim() !== "") {
    const n = Number(answer.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export interface FractionValue {
  numerator: number;
  denominator: number;
}

/** Accepts {numerator, denominator}, {n, d}, or "3/4". Denominator 0 is malformed. */
export function parseFractionAnswer(answer: unknown): FractionValue | null {
  if (typeof answer === "string") {
    const match = /^\s*(-?\d+)\s*\/\s*(-?\d+)\s*$/.exec(answer);
    if (!match) return null;
    const numerator = Number(match[1]);
    const denominator = Number(match[2]);
    return denominator !== 0 ? { numerator, denominator } : null;
  }
  if (typeof answer === "object" && answer !== null) {
    const rec = answer as Record<string, unknown>;
    const numerator = rec.numerator ?? rec.n;
    const denominator = rec.denominator ?? rec.d;
    if (typeof numerator === "number" && typeof denominator === "number" && denominator !== 0) {
      return { numerator, denominator };
    }
  }
  return null;
}

/** Exact fraction equality by cross-multiplication (no float error). */
export function fractionsEqual(a: FractionValue, b: FractionValue): boolean {
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

/** -1 when a < b, 0 when equal, 1 when a > b. Denominators normalized positive. */
export function compareFractions(a: FractionValue, b: FractionValue): number {
  const norm = (f: FractionValue): FractionValue =>
    f.denominator < 0 ? { numerator: -f.numerator, denominator: -f.denominator } : f;
  const x = norm(a);
  const y = norm(b);
  const left = x.numerator * y.denominator;
  const rightSide = y.numerator * x.denominator;
  return left < rightSide ? -1 : left > rightSide ? 1 : 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
