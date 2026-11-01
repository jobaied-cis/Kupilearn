import { GameEngineError, type GameMechanic, type ServerChallenge, type ValidationResult } from "./types";

/**
 * Mechanic plugin architecture (Step 01 only — no playable mechanics).
 *
 * A plugin owns one mechanic kind: how its challenges are validated.
 * Validation receives the SERVER challenge (with answer key) and runs
 * server-side; the client never sees `answerKey`. Step 02 implements
 * the actual Puzzle Quest mechanics on top of this contract.
 */
export interface MechanicPlugin {
  mechanic: GameMechanic;
  validate(challenge: ServerChallenge, answer: unknown): ValidationResult;
}

export class MechanicRegistry {
  private plugins = new Map<string, MechanicPlugin>();

  register(plugin: MechanicPlugin): MechanicPlugin {
    const { id } = plugin.mechanic;
    if (!id.trim()) throw new GameEngineError("INVALID_MECHANIC", "Mechanic id is required");
    if (this.plugins.has(id)) {
      throw new GameEngineError("DUPLICATE_MECHANIC", `Mechanic already registered: ${id}`);
    }
    this.plugins.set(id, plugin);
    return plugin;
  }

  get(mechanicId: string): MechanicPlugin {
    const plugin = this.plugins.get(mechanicId);
    if (!plugin) throw new GameEngineError("MECHANIC_NOT_FOUND", `Unknown mechanic: ${mechanicId}`);
    return plugin;
  }

  has(mechanicId: string): boolean {
    return this.plugins.has(mechanicId);
  }

  list(): GameMechanic[] {
    return [...this.plugins.values()].map((p) => p.mechanic);
  }
}

/**
 * Placeholder plugin for a mechanic whose gameplay arrives in a later
 * step. It registers the mechanic so games can reference it, but any
 * validation attempt fails loudly instead of pretending to score.
 */
export function createStubMechanic(mechanic: GameMechanic): MechanicPlugin {
  return {
    mechanic,
    validate() {
      throw new GameEngineError("MECHANIC_NOT_IMPLEMENTED", `Mechanic ${mechanic.id} is not implemented yet`);
    },
  };
}

/**
 * Generic multiple-choice validator. This is the reference plugin that
 * proves the architecture end-to-end; Puzzle Quest's own mechanics
 * (number sequence, equation, fraction, shape, logic) arrive in Step 02.
 */
export function createMultipleChoiceMechanic(): MechanicPlugin {
  return {
    mechanic: { id: "quiz-mcq", kind: "quiz", name: "Multiple Choice" },
    validate(challenge, answer) {
      const correct = answer === challenge.answerKey;
      return { correct, points: correct ? challenge.points : 0 };
    },
  };
}
