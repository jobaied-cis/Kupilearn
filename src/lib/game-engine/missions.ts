import { GameEngineError, type ServerChallenge } from "./types";

/**
 * Puzzle Quest mission model (Step 02), built on Step 01 contracts.
 *
 * A mission is an ordered challenge sequence with a warm-up, main
 * challenges, and a final independent challenge. Content status is
 * explicit: the demonstration mission below is `draft-sample` — it is
 * NOT NCTB-approved content, and the UI must label it that way.
 */
export interface Mission {
  id: string;
  gameId: string;
  title: string;
  titleBn?: string;
  description: string;
  grade: number;
  subjectId: string;
  /** NCTB catalog chapter reference (catalog chapter id, not a textbook page). */
  chapterId: string;
  /** NCTB catalog topic ids this mission practises. */
  topicIds: string[];
  learningObjectives: string[];
  estimatedMinutes: number;
  /** Completion requires every challenge recorded; score is server-computed. */
  completionCriteria: { requireAllChallenges: true; minCorrect?: number };
  hintsPerChallenge: 3;
  contentStatus: "draft-sample" | "reviewed" | "approved";
  challengeIds: string[];
}

export interface MissionBundle {
  mission: Mission;
  challenges: ServerChallenge[];
}

/** Returns a list of configuration problems; empty means valid. */
export function validateMission(bundle: MissionBundle, knownMechanicIds: Set<string>): string[] {
  const errors: string[] = [];
  const { mission, challenges } = bundle;
  if (!mission.id.trim()) errors.push("Mission id is required");
  if (mission.grade < 6 || mission.grade > 10) errors.push("Mission grade must be an NCTB class 6-10");
  if (mission.challengeIds.length === 0) errors.push("Mission needs at least one challenge");
  if (new Set(mission.challengeIds).size !== mission.challengeIds.length) errors.push("Mission challenge ids must be unique");
  const byId = new Map(challenges.map((c) => [c.id, c]));
  for (const id of mission.challengeIds) {
    const challenge = byId.get(id);
    if (!challenge) {
      errors.push(`Mission references unknown challenge: ${id}`);
      continue;
    }
    if (challenge.gameId !== mission.gameId) errors.push(`Challenge ${id} belongs to another game`);
    if (!knownMechanicIds.has(challenge.mechanicId)) errors.push(`Challenge ${id} uses unregistered mechanic: ${challenge.mechanicId}`);
    if (!challenge.hints || challenge.hints.length !== mission.hintsPerChallenge) {
      errors.push(`Challenge ${id} must have exactly ${mission.hintsPerChallenge} progressive hints`);
    }
    if (!challenge.explanation) errors.push(`Challenge ${id} needs an explanation`);
    if (challenge.answerKey === undefined) errors.push(`Challenge ${id} needs a server answer key`);
  }
  const stages = mission.challengeIds.map((id) => byId.get(id)?.stage);
  if (stages[0] !== "warmup") errors.push("First challenge must be the warm-up");
  if (stages[stages.length - 1] !== "final") errors.push("Last challenge must be the final independent challenge");
  return errors;
}

export function assertValidMission(bundle: MissionBundle, knownMechanicIds: Set<string>): MissionBundle {
  const errors = validateMission(bundle, knownMechanicIds);
  if (errors.length > 0) throw new GameEngineError("INVALID_MISSION", errors.join("; "));
  return bundle;
}

const ch = (partial: ServerChallenge): ServerChallenge => partial;

/**
 * Demonstration mission — Class 6 Mathematics.
 *
 * Anchored to concepts in the repo's NCTB catalog topics
 * (`c6-math-fractions`, `c6-math-equations`, `c6-math-angles`) and the
 * verified Class 6 book chapter "Natural Numbers and Fractions".
 * The questions themselves are original sample questions written for
 * this demo: `contentStatus: "draft-sample"`, never NCTB-approved.
 */
export const FIRST_STEPS_MISSION: MissionBundle = {
  mission: {
    id: "pq-c6-math-first-steps",
    gameId: "puzzle-quest",
    title: "First Steps: Numbers, Equations & Fractions",
    description: "A short first quest through Class 6 number patterns, simple equations, fractions, shapes and building an equation yourself.",
    grade: 6,
    subjectId: "math",
    chapterId: "c6-math-number",
    topicIds: ["c6-math-factors", "c6-math-equations", "c6-math-fractions", "c6-math-angles", "c6-math-algebraic"],
    learningObjectives: [
      "Continue a number pattern by finding its rule",
      "Solve a one-step equation and check the answer",
      "Compare two fractions fairly",
      "Use basic shape facts and simple reasoning",
      "Build a correct equation from parts",
    ],
    estimatedMinutes: 8,
    completionCriteria: { requireAllChallenges: true },
    hintsPerChallenge: 3,
    contentStatus: "draft-sample",
    challengeIds: ["pq1-seq", "pq1-eq", "pq1-frac", "pq1-shape", "pq1-logic", "pq1-build"],
  },
  challenges: [
    ch({
      id: "pq1-seq", gameId: "puzzle-quest", mechanicId: "number-sequence", type: "number-sequence",
      topicId: "c6-math-factors", grade: 6, subjectId: "math",
      prompt: "Find the missing number: 2, 5, 8, ?, 14",
      payload: { difficulty: 1, sequence: [2, 5, 8, null, 14], missingIndex: 3 },
      difficulty: 1, learningObjective: "Continue a number pattern by finding its rule", stage: "warmup",
      status: "approved", answerKey: 11, points: 10,
      hints: [
        "Look at how the numbers change from one to the next.",
        "Each step adds the same amount. 2 → 5 → 8 grows by 3 every time.",
        "If each step adds 3, then after 8 comes 8 + 3. Count on three from 8.",
      ],
      explanation: "The rule is +3 each step: 2, 5, 8, 11, 14. The missing number is 11.",
    }),
    ch({
      id: "pq1-eq", gameId: "puzzle-quest", mechanicId: "equation-puzzle", type: "equation-puzzle",
      topicId: "c6-math-equations", grade: 6, subjectId: "math",
      prompt: "Solve: x + 4 = 11. What is x?",
      payload: { difficulty: 1, equation: "x + 4 = 11", unknown: "x", a: 1, b: 4, c: 11 },
      difficulty: 1, learningObjective: "Solve a one-step equation and check the answer", stage: "main",
      status: "approved", answerKey: 7, points: 10,
      hints: [
        "x is hiding under +4. How can you undo +4?",
        "Do the opposite on both sides: subtract 4 from 11.",
        "11 − 4 gives x. Then check: put your answer in x + 4 and see if it makes 11.",
      ],
      explanation: "Subtract 4 from both sides: x = 11 − 4 = 7. Check: 7 + 4 = 11. Correct.",
    }),
    ch({
      id: "pq1-frac", gameId: "puzzle-quest", mechanicId: "fraction-puzzle", type: "fraction-puzzle",
      topicId: "c6-math-fractions", grade: 6, subjectId: "math",
      prompt: "Which is bigger: 2/3 or 3/5?",
      payload: { difficulty: 1, mode: "compare", left: { numerator: 2, denominator: 3 }, right: { numerator: 3, denominator: 5 } },
      difficulty: 1, learningObjective: "Compare two fractions fairly", stage: "main",
      status: "approved", answerKey: "left", points: 10,
      hints: [
        "The pieces are different sizes, so counting pieces is not fair yet.",
        "Cross-multiply: compare 2 × 5 with 3 × 3.",
        "2 × 5 = 10 and 3 × 3 = 9. The bigger product belongs to the bigger fraction.",
      ],
      explanation: "Cross-multiplying: 2/3 gives 2 × 5 = 10, and 3/5 gives 3 × 3 = 9. So 2/3 is bigger.",
    }),
    ch({
      id: "pq1-shape", gameId: "puzzle-quest", mechanicId: "shape-puzzle", type: "shape-puzzle",
      topicId: "c6-math-angles", grade: 6, subjectId: "math",
      prompt: "How many sides does a triangle have?",
      payload: { difficulty: 1, shape: "triangle", ask: "sides" },
      difficulty: 1, learningObjective: "Use basic shape facts", stage: "main",
      status: "approved", answerKey: 3, points: 10,
      hints: [
        "Picture a triangle and trace around it with your finger.",
        "Count each straight edge one at a time.",
        "The name itself helps: \"tri\" means three.",
      ],
      explanation: "A triangle has 3 sides (and 3 corners). \"Tri\" means three.",
    }),
    ch({
      id: "pq1-logic", gameId: "puzzle-quest", mechanicId: "logic-puzzle", type: "logic-puzzle",
      topicId: "c6-math-factors", grade: 6, subjectId: "math",
      prompt: "Rahim is taller than Mina. Mina is taller than Karim. Who is the shortest?",
      payload: { difficulty: 2, options: ["Rahim", "Mina", "Karim"] },
      difficulty: 2, learningObjective: "Reason step by step from clues", stage: "main",
      status: "approved", answerKey: "Karim", points: 10,
      hints: [
        "Put the three friends in a line from tallest to shortest.",
        "Rahim > Mina, and Mina > Karim. So the order starts Rahim, Mina…",
        "If Karim is below Mina, and Mina is below Rahim, Karim must be last — the shortest.",
      ],
      explanation: "Order from tallest: Rahim, then Mina, then Karim. So Karim is the shortest.",
    }),
    ch({
      id: "pq1-build", gameId: "puzzle-quest", mechanicId: "drag-build", type: "drag-build",
      topicId: "c6-math-algebraic", grade: 6, subjectId: "math",
      prompt: "Build the equation that says: three plus four makes seven.",
      payload: { difficulty: 2, tiles: ["4", "=", "3", "+", "7"], instruction: "Arrange the tiles to build the equation that says three plus four", buildKind: "equation" },
      difficulty: 2, learningObjective: "Build a correct equation from parts", stage: "final",
      status: "approved", answerKey: ["3", "+", "4", "=", "7"], points: 15,
      hints: [
        "An equation starts with the first number.",
        "Read it like a sentence: \"three plus four makes seven\" — number, plus, number, equals, answer.",
        "Place 3 first, then the + sign, then 4, then =, and the result goes last.",
      ],
      explanation: "The equation is 3 + 4 = 7: first number, plus, second number, equals, result.",
    }),
  ],
};

export const PUZZLE_QUEST_MISSIONS: MissionBundle[] = [FIRST_STEPS_MISSION];
