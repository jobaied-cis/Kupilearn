import type { MechanicRegistry } from "../mechanics";
import { createDragBuildMechanic } from "./drag-build";
import { createEquationPuzzleMechanic } from "./equation-puzzle";
import { createFractionPuzzleMechanic } from "./fraction-puzzle";
import { createLogicPuzzleMechanic } from "./logic-puzzle";
import { createNumberSequenceMechanic } from "./number-sequence";
import { createShapePuzzleMechanic } from "./shape-puzzle";

export * from "./helpers";
export * from "./number-sequence";
export * from "./equation-puzzle";
export * from "./fraction-puzzle";
export * from "./shape-puzzle";
export * from "./logic-puzzle";
export * from "./drag-build";

/** All six Step 02 Puzzle Quest mechanics, registered through the Step 01 plugin system. */
export function registerPuzzleQuestMechanics(registry: MechanicRegistry): void {
  registry.register(createNumberSequenceMechanic());
  registry.register(createEquationPuzzleMechanic());
  registry.register(createFractionPuzzleMechanic());
  registry.register(createShapePuzzleMechanic());
  registry.register(createLogicPuzzleMechanic());
  registry.register(createDragBuildMechanic());
}
