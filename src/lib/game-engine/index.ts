import { ChallengeBank } from "./challenges";
import { createMultipleChoiceMechanic, createStubMechanic, MechanicRegistry } from "./mechanics";
import { PUZZLE_QUEST_DEFINITION, PUZZLE_QUEST_MECHANIC_IDS } from "./puzzle-quest";
import { GameRegistry } from "./registry";
import { GameRuntime } from "./runtime";
import type { GameMechanic, MechanicKind } from "./types";

export * from "./types";
export * from "./registry";
export * from "./mechanics";
export * from "./challenges";
export * from "./events";
export * from "./state";
export * from "./session";
export * from "./runtime";
export * from "./adapters";
export * from "./ai";
export * from "./puzzle-quest";

const PUZZLE_MECHANIC_NAMES: Record<(typeof PUZZLE_QUEST_MECHANIC_IDS)[number], string> = {
  "number-sequence": "Number Sequence",
  "equation-puzzle": "Equation Puzzle",
  "fraction-puzzle": "Fraction Puzzle",
  "shape-puzzle": "Shape Puzzle",
  "logic-puzzle": "Logic Puzzle",
};

/**
 * Assemble the Step 01 engine: Puzzle Quest registered in
 * `development`, its five future mechanics present as loud stubs
 * (Step 02 replaces them), and the reference multiple-choice plugin.
 * No game is published by this assembly.
 */
export function createGameEngine(deps: { now?: () => Date; idFactory?: () => string } = {}) {
  const games = new GameRegistry();
  games.register(PUZZLE_QUEST_DEFINITION);

  const mechanics = new MechanicRegistry();
  for (const id of PUZZLE_QUEST_MECHANIC_IDS) {
    const mechanic: GameMechanic = { id, kind: id as MechanicKind, name: PUZZLE_MECHANIC_NAMES[id] };
    mechanics.register(createStubMechanic(mechanic));
  }
  mechanics.register(createMultipleChoiceMechanic());

  const challenges = new ChallengeBank();
  const runtime = new GameRuntime({ games, mechanics, challenges, now: deps.now, idFactory: deps.idFactory });
  return { games, mechanics, challenges, runtime };
}
