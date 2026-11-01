import { describe, expect, it } from "vitest";
import { createGameEngine } from "./index";
import { createDragBuildMechanic } from "./mechanics/drag-build";
import { createEquationPuzzleMechanic, solveEquation } from "./mechanics/equation-puzzle";
import { createFractionPuzzleMechanic } from "./mechanics/fraction-puzzle";
import { parseFractionAnswer } from "./mechanics/helpers";
import { createLogicPuzzleMechanic } from "./mechanics/logic-puzzle";
import { buildSequence, createNumberSequenceMechanic, solveSequence } from "./mechanics/number-sequence";
import { createShapePuzzleMechanic } from "./mechanics/shape-puzzle";
import { assertValidMission, FIRST_STEPS_MISSION, validateMission } from "./missions";
import { listClientMissions, startMissionSession, submitMissionAnswer, requestMissionHint } from "./server";
import type { ServerChallenge } from "./types";

const challenge = (over: Partial<ServerChallenge>): ServerChallenge => ({
  id: "t-1",
  gameId: "puzzle-quest",
  mechanicId: "number-sequence",
  type: "number-sequence",
  grade: 6,
  subjectId: "math",
  prompt: "test",
  payload: {},
  status: "approved",
  answerKey: null,
  points: 10,
  ...over,
});

describe("Number Sequence mechanic", () => {
  const plugin = createNumberSequenceMechanic();
  const seq = challenge({ payload: { difficulty: 1, sequence: [2, 5, 8, null, 14], missingIndex: 3 }, answerKey: 11 });

  it("validates arithmetic progressions deterministically at several difficulties", () => {
    expect(plugin.validate(seq, 11).correct).toBe(true);
    expect(plugin.validate(seq, "11").correct).toBe(true);
    expect(plugin.validate(seq, 10).correct).toBe(false);
    const down = challenge({ payload: { difficulty: 2, sequence: [20, null, 10, 5], missingIndex: 1 }, answerKey: 15 });
    expect(plugin.validate(down, 15).correct).toBe(true);
    expect(solveSequence(buildSequence(3, 7, 5, 2), 2)).toBe(17);
  });

  it("handles empty and malformed answers safely", () => {
    expect(plugin.validate(seq, "").correct).toBe(false);
    expect(plugin.validate(seq, null).correct).toBe(false);
    expect(plugin.validate(seq, "abc").correct).toBe(false);
    expect(plugin.validate(seq, {}).correct).toBe(false);
  });
});

describe("Equation Puzzle mechanic", () => {
  const plugin = createEquationPuzzleMechanic();
  const eq = challenge({ mechanicId: "equation-puzzle", payload: { difficulty: 1, equation: "x + 4 = 11", unknown: "x", a: 1, b: 4, c: 11 }, answerKey: 7 });

  it("solves and validates missing-value equations", () => {
    expect(solveEquation(1, 4, 11)).toBe(7);
    expect(solveEquation(2, 3, 13)).toBe(5);
    expect(plugin.validate(eq, 7).correct).toBe(true);
    expect(plugin.validate(eq, "7").correct).toBe(true);
    expect(plugin.validate(eq, 8).correct).toBe(false);
  });

  it("rejects malformed answers without throwing", () => {
    expect(plugin.validate(eq, "").correct).toBe(false);
    expect(plugin.validate(eq, []).correct).toBe(false);
    expect(plugin.validate(eq, Number.NaN).correct).toBe(false);
  });
});

describe("Fraction Puzzle mechanic", () => {
  const plugin = createFractionPuzzleMechanic();

  it("compares fractions exactly", () => {
    const cmp = challenge({ mechanicId: "fraction-puzzle", payload: { difficulty: 1, mode: "compare", left: { numerator: 2, denominator: 3 }, right: { numerator: 3, denominator: 5 } }, answerKey: "left" });
    expect(plugin.validate(cmp, "left").correct).toBe(true);
    expect(plugin.validate(cmp, "right").correct).toBe(false);
    const equal = challenge({ mechanicId: "fraction-puzzle", payload: { difficulty: 1, mode: "compare", left: { numerator: 1, denominator: 2 }, right: { numerator: 2, denominator: 4 } }, answerKey: "equal" });
    expect(plugin.validate(equal, "equal").correct).toBe(true);
  });

  it("validates equivalent fractions in any representation", () => {
    const eqv = challenge({ mechanicId: "fraction-puzzle", payload: { difficulty: 2, mode: "equivalent", fraction: { numerator: 1, denominator: 2 } }, answerKey: "2/4" });
    expect(plugin.validate(eqv, "2/4").correct).toBe(true);
    expect(plugin.validate(eqv, { numerator: 3, denominator: 6 }).correct).toBe(true);
    expect(plugin.validate(eqv, "1/2").correct).toBe(false); // same representation is not a new equivalent
    expect(plugin.validate(eqv, "2/5").correct).toBe(false);
    expect(parseFractionAnswer("3/0")).toBeNull();
    expect(plugin.validate(eqv, "abc").correct).toBe(false);
  });
});

describe("Shape Puzzle mechanic", () => {
  const plugin = createShapePuzzleMechanic();
  it("validates sides, vertices, angle sums, and names", () => {
    const sides = challenge({ mechanicId: "shape-puzzle", payload: { difficulty: 1, shape: "triangle", ask: "sides" }, answerKey: 3 });
    expect(plugin.validate(sides, 3).correct).toBe(true);
    expect(plugin.validate(sides, 4).correct).toBe(false);
    const angles = challenge({ mechanicId: "shape-puzzle", payload: { difficulty: 2, shape: "pentagon", ask: "angleSum" }, answerKey: 540 });
    expect(plugin.validate(angles, 540).correct).toBe(true);
    const name = challenge({ mechanicId: "shape-puzzle", payload: { difficulty: 1, shape: "hexagon", ask: "name", options: ["pentagon", "hexagon"] }, answerKey: "hexagon" });
    expect(plugin.validate(name, "hexagon").correct).toBe(true);
    expect(plugin.validate(sides, "").correct).toBe(false);
  });
});

describe("Logic Puzzle mechanic", () => {
  const plugin = createLogicPuzzleMechanic();
  const logic = challenge({ mechanicId: "logic-puzzle", payload: { difficulty: 2, options: ["Rahim", "Mina", "Karim"] }, answerKey: "Karim" });
  it("validates the single unambiguous option and keeps the answer out of the payload", () => {
    expect(plugin.validate(logic, "Karim").correct).toBe(true);
    expect(plugin.validate(logic, "Mina").correct).toBe(false);
    expect(plugin.validate(logic, "").correct).toBe(false);
    expect(JSON.stringify(logic.payload)).not.toContain("correctOption");
  });
});

describe("Drag & Build mechanic", () => {
  const plugin = createDragBuildMechanic();
  const build = challenge({ mechanicId: "drag-build", payload: { difficulty: 2, tiles: ["4", "=", "3", "+", "7"], instruction: "build" }, answerKey: ["3", "+", "4", "=", "7"] });
  it("validates the completed arrangement (the keyboard alternative submits the same array)", () => {
    expect(plugin.validate(build, ["3", "+", "4", "=", "7"]).correct).toBe(true);
    expect(plugin.validate(build, ["4", "+", "3", "=", "7"]).correct).toBe(false); // wrong reading order for this target
    expect(plugin.validate(build, []).correct).toBe(false);
    expect(plugin.validate(build, ["3", "+"]).correct).toBe(false);
    expect(plugin.validate(build, "3+4=7").correct).toBe(false);
    expect(plugin.validate(build, null).correct).toBe(false);
  });
});

describe("Mission configuration (Step 02)", () => {
  it("the demonstration mission is valid and honestly labelled draft-sample", () => {
    const engine = createGameEngine();
    expect(validateMission(FIRST_STEPS_MISSION, new Set(engine.mechanics.list().map((m) => m.id)))).toEqual([]);
    expect(FIRST_STEPS_MISSION.mission.contentStatus).toBe("draft-sample");
    expect(FIRST_STEPS_MISSION.mission.challengeIds).toHaveLength(6);
    expect(() => assertValidMission({ mission: { ...FIRST_STEPS_MISSION.mission, challengeIds: ["nope"] }, challenges: [] }, new Set())).toThrowError(/unknown challenge/);
  });

  it("client payloads never expose answer keys, points, hints, or explanations", () => {
    const missions = listClientMissions();
    const serialized = JSON.stringify(missions);
    expect(serialized).not.toContain("answerKey");
    expect(serialized).not.toContain("\"points\"");
    expect(serialized).not.toContain("Cross-multiplying");
    for (const mission of missions) {
      for (const c of mission.challenges) {
        expect(c).not.toHaveProperty("answerKey");
        expect(c).not.toHaveProperty("hints");
      }
    }
  });
});

describe("Server session flow (Step 02)", () => {
  it("supports retry, progressive hints, and server-scored completion", () => {
    const { sessionId, mission } = startMissionSession("pq-c6-math-first-steps");
    expect(mission.challenges[0]?.id).toBe("pq1-seq");

    const h1 = requestMissionHint(sessionId, "pq1-seq");
    const h2 = requestMissionHint(sessionId, "pq1-seq");
    expect(h1.level).toBe(1);
    expect(h2.level).toBe(2);
    expect(h1.hint).not.toBe(h2.hint);

    const wrongFirst = submitMissionAnswer(sessionId, "pq1-seq", 10);
    expect(wrongFirst).toMatchObject({ correct: false, recorded: false, attemptsLeft: 1 });
    const rightSecond = submitMissionAnswer(sessionId, "pq1-seq", 11);
    expect(rightSecond).toMatchObject({ correct: true, recorded: true });
    expect(rightSecond.explanation).toContain("missing number is 11");
    // Already recorded: a further submission is rejected, never double-scored.
    expect(() => submitMissionAnswer(sessionId, "pq1-seq", 11)).toThrowError(/already answered/);

    submitMissionAnswer(sessionId, "pq1-eq", 7);
    submitMissionAnswer(sessionId, "pq1-frac", "left");
    submitMissionAnswer(sessionId, "pq1-shape", 3);
    submitMissionAnswer(sessionId, "pq1-logic", "Karim");
    const final = submitMissionAnswer(sessionId, "pq1-build", ["3", "+", "4", "=", "7"]);
    expect(final.progress.status).toBe("completed");
    expect(final.result).toMatchObject({ answered: 6, correct: 6, score: 65 });
  });
});
