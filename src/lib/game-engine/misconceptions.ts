import type { ServerChallenge } from "./types";

/**
 * Misconception Detection Engine (Step 03): rule-based, session-only.
 *
 * A rule looks at one recorded incorrect answer and names the error
 * PATTERN it matches (never a label for the student). The engine only
 * surfaces a signal after the same pattern occurs at least twice —
 * a single wrong answer can never trigger it (false-positive guard).
 * Signals carry a supportive explanation to show the student.
 * Future subjects register more rules in the same registry.
 */
export interface MisconceptionSignal {
  ruleId: string;
  mechanicId: string;
  occurrences: number;
  /** Supportive, pattern-focused text. Never a fixed-ability claim. */
  supportiveExplanation: string;
}

export interface MisconceptionRule {
  id: string;
  mechanicId: string;
  /** Pattern key counted across the session, or null when this answer does not match. */
  detect(challenge: ServerChallenge, answer: unknown): string | null;
  supportiveExplanation: string;
}

export class MisconceptionRegistry {
  private rules = new Map<string, MisconceptionRule>();

  register(rule: MisconceptionRule): void {
    if (this.rules.has(rule.id)) throw new Error(`Misconception rule already registered: ${rule.id}`);
    this.rules.set(rule.id, rule);
  }

  forMechanic(mechanicId: string): MisconceptionRule[] {
    return [...this.rules.values()].filter((r) => r.mechanicId === mechanicId);
  }

  list(): MisconceptionRule[] {
    return [...this.rules.values()];
  }
}

const asNumber = (value: unknown): number | null =>
  typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;

export function createClass6MathMisconceptionRegistry(): MisconceptionRegistry {
  const registry = new MisconceptionRegistry();

  registry.register({
    id: "sequence-counts-by-one",
    mechanicId: "number-sequence",
    supportiveExplanation:
      "It looks like counting up by 1 each time. This sequence grows by a bigger step — find the step by subtracting two neighbours, then add that step.",
    detect(challenge, answer) {
      const payload = challenge.payload as { sequence?: (number | null)[]; missingIndex?: number };
      const given = asNumber(answer);
      if (given === null || !Array.isArray(payload.sequence) || typeof payload.missingIndex !== "number") return null;
      const before = payload.sequence[payload.missingIndex - 1];
      return typeof before === "number" && given === before + 1 ? "counts-by-one" : null;
    },
  });

  registry.register({
    id: "equation-adds-instead-of-undoing",
    mechanicId: "equation-puzzle",
    supportiveExplanation:
      "It looks like adding the numbers together. In an equation we undo: if x + 4 = 11, subtract 4 from both sides to free x.",
    detect(challenge, answer) {
      const payload = challenge.payload as { a?: number; b?: number; c?: number };
      const given = asNumber(answer);
      if (given === null || typeof payload.b !== "number" || typeof payload.c !== "number") return null;
      return given === payload.c + payload.b || given === payload.c ? "adds-instead-of-undoing" : null;
    },
  });

  registry.register({
    id: "fraction-bigger-numerator",
    mechanicId: "fraction-puzzle",
    supportiveExplanation:
      "It looks like picking the fraction with the bigger top number. Bigger pieces count too — compare fairly by cross-multiplying or using the same denominator.",
    detect(challenge, answer) {
      const payload = challenge.payload as { mode?: string; left?: { numerator: number; denominator: number }; right?: { numerator: number; denominator: number } };
      if (payload.mode !== "compare" || !payload.left || !payload.right) return null;
      if (answer !== "left" && answer !== "right") return null;
      const chosen = answer === "left" ? payload.left : payload.right;
      const other = answer === "left" ? payload.right : payload.left;
      // Chose the larger numerator even though that fraction is smaller.
      return chosen.numerator > other.numerator && chosen.numerator * other.denominator < other.numerator * chosen.denominator
        ? "bigger-numerator"
        : null;
    },
  });

  registry.register({
    id: "shape-all-angle-sums-180",
    mechanicId: "shape-puzzle",
    supportiveExplanation:
      "It looks like using 180° for every shape. Only triangles add to 180° — each extra side adds another 180°.",
    detect(challenge, answer) {
      const payload = challenge.payload as { ask?: string; shape?: string };
      const given = asNumber(answer);
      if (given === null || payload.ask !== "angleSum") return null;
      return payload.shape !== "triangle" && given === 180 ? "all-180" : null;
    },
  });

  registry.register({
    id: "arithmetic-slip",
    mechanicId: "drag-build",
    supportiveExplanation:
      "The build has the right shape but the numbers do not balance yet. Work out each side and check both sides give the same value.",
    detect(challenge, answer) {
      // Any recorded incorrect drag-build answer counts as a balance slip pattern.
      void challenge;
      return Array.isArray(answer) && answer.length > 0 ? "balance-slip" : null;
    },
  });

  return registry;
}

/** Tracks pattern counts per session and surfaces signals at >= 2 occurrences. */
export class MisconceptionTracker {
  private counts = new Map<string, { rule: MisconceptionRule; count: number }>();

  constructor(private registry: MisconceptionRegistry) {}

  /** Call only for recorded incorrect answers. Returns a signal once a pattern repeats. */
  observe(challenge: ServerChallenge, answer: unknown): MisconceptionSignal | null {
    let signal: MisconceptionSignal | null = null;
    for (const rule of this.registry.forMechanic(challenge.mechanicId)) {
      const key = rule.detect(challenge, answer);
      if (!key) continue;
      const composite = `${rule.id}:${key}`;
      const entry = this.counts.get(composite) ?? { rule, count: 0 };
      entry.count += 1;
      this.counts.set(composite, entry);
      if (entry.count >= 2) {
        signal = {
          ruleId: rule.id,
          mechanicId: rule.mechanicId,
          occurrences: entry.count,
          supportiveExplanation: rule.supportiveExplanation,
        };
      }
    }
    return signal;
  }
}
