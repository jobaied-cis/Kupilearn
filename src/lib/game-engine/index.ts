import { ChallengeBank } from "./challenges";
import { createMultipleChoiceMechanic, MechanicRegistry } from "./mechanics";
import { PUZZLE_QUEST_DEFINITION } from "./puzzle-quest";
import { GameRegistry } from "./registry";
import { GameRuntime } from "./runtime";
import { registerPuzzleQuestMechanics } from "./mechanics/index";

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
export * from "./mechanics/index";
export * from "./missions";
export * from "./curriculum-context";
export * from "./lesson-context";
export * from "./performance";
export * from "./adaptive";
export * from "./misconceptions";
export * from "./recommendations";
export * from "./personas";
export * from "./ai-safety";
export * from "./meta-adapter";
export * from "./director";
export * from "./rewards";
export * from "./progress";
export * from "./http";

/**
 * Assemble the engine: Puzzle Quest registered in `development`, its
 * six Step 02 mechanics registered as real plugins, and the reference
 * multiple-choice plugin. No game is published by this assembly.
 */
export function createGameEngine(deps: { now?: () => Date; idFactory?: () => string } = {}) {
  const games = new GameRegistry();
  games.register(PUZZLE_QUEST_DEFINITION);

  const mechanics = new MechanicRegistry();
  registerPuzzleQuestMechanics(mechanics);
  mechanics.register(createMultipleChoiceMechanic());

  const challenges = new ChallengeBank();
  const runtime = new GameRuntime({ games, mechanics, challenges, now: deps.now, idFactory: deps.idFactory });
  return { games, mechanics, challenges, runtime };
}
