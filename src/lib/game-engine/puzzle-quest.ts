import type { GameDefinition } from "./types";

/**
 * Puzzle Quest registration (Step 01).
 *
 * Registered in `development` so it can never be offered to students
 * until a later step publishes it. Pilot scope is Class 6 Mathematics
 * (initial content pilot); the definition already declares the full
 * future scope — all NCTB subjects, Classes 6–10 — so no registry
 * change is needed when content expands. Playable mechanics are
 * Step 02; this file only registers metadata and mechanic references.
 */
export const PUZZLE_QUEST_MECHANIC_IDS = [
  "number-sequence",
  "equation-puzzle",
  "fraction-puzzle",
  "shape-puzzle",
  "logic-puzzle",
  "drag-build",
] as const;

export const PUZZLE_QUEST_DEFINITION: GameDefinition = {
  id: "puzzle-quest",
  title: "Puzzle Quest",
  category: "puzzle",
  description: "Short curriculum puzzles that turn NCTB topics into quests.",
  grades: [6, 7, 8, 9, 10],
  subjects: ["math"],
  mechanicIds: [...PUZZLE_QUEST_MECHANIC_IDS],
  status: "development",
  pilot: { grade: 6, subjectId: "math" },
};
