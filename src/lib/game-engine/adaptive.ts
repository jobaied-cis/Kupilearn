import type { PerformanceSnapshot } from "./performance";

/**
 * Adaptive Difficulty Engine (Step 03): deterministic, session-only.
 *
 * Rules (all explainable, no AI, no single-answer overreaction):
 * - Needs at least 3 recorded challenges before any change.
 * - Up: 3 correct in a row, each on the first attempt with no hints.
 * - Down: 2 recorded incorrect in a row, or hints are carrying the
 *   work (last challenge needed 2+ hints and multiple attempts) twice.
 * - Otherwise stay, with the reason recorded either way.
 * Difficulty is bounded 1..3. In Step 03 the level drives the
 * recommendation engine and the UI's practice-level label; mission
 * order and completion criteria are unchanged.
 */
export interface AdaptationDecision {
  difficulty: 1 | 2 | 3;
  changed: boolean;
  reason: string;
}

const clamp = (n: number): 1 | 2 | 3 => (n < 1 ? 1 : n > 3 ? 3 : (n as 1 | 2 | 3));

export class AdaptiveDifficulty {
  private level: 1 | 2 | 3;

  constructor(start: 1 | 2 | 3 = 1) {
    this.level = start;
  }

  get difficulty(): 1 | 2 | 3 {
    return this.level;
  }

  evaluate(snapshot: PerformanceSnapshot): AdaptationDecision {
    const before = this.level;
    if (snapshot.answered < 3) {
      return { difficulty: before, changed: false, reason: "Not enough session evidence yet (needs 3 recorded challenges)." };
    }
    const recent = snapshot.evidence.slice(-3);
    if (snapshot.currentIncorrectStreak >= 2) {
      this.level = clamp(before - 1);
      return {
        difficulty: this.level,
        changed: this.level !== before,
        reason: "Two recorded mistakes in a row — easing down so the next step feels manageable.",
      };
    }
    const hintCarried = recent.filter((e) => e.hintsUsed >= 2 && e.attemptsUsed >= 2).length;
    if (hintCarried >= 2) {
      this.level = clamp(before - 1);
      return {
        difficulty: this.level,
        changed: this.level !== before,
        reason: "Hints and retries did most of the work recently — easing down to rebuild confidence.",
      };
    }
    const cleanWins = recent.every((e) => e.correct && e.attemptsUsed === 1 && e.hintsUsed === 0);
    if (snapshot.currentCorrectStreak >= 3 && cleanWins) {
      this.level = clamp(before + 1);
      return {
        difficulty: this.level,
        changed: this.level !== before,
        reason: "Three clean first-try correct answers in a row — ready for a bigger challenge.",
      };
    }
    return { difficulty: before, changed: false, reason: "Steady progress — staying at the current level for now." };
  }
}
