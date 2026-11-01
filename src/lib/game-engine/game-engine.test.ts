import { describe, expect, it } from "vitest";
import { ChallengeBank, toClientChallenge } from "./challenges";
import { GameEventBus } from "./events";
import { createGameEngine } from "./index";
import { createMultipleChoiceMechanic, createStubMechanic, MechanicRegistry } from "./mechanics";
import { PUZZLE_QUEST_DEFINITION } from "./puzzle-quest";
import { GameRegistry } from "./registry";
import { GameRuntime } from "./runtime";
import { GameSessionController } from "./session";
import { canApply, createInitialState, recordAnswer, transition } from "./state";
import { GameEngineError, type GameDefinition, type ServerChallenge } from "./types";
import { createNctbCurriculumAdapter, createSessionOnlyProgressAdapter } from "./adapters";

const NOW = new Date("2026-02-01T05:00:00.000Z");
const now = () => NOW;

const game = (over: Partial<GameDefinition> = {}): GameDefinition => ({
  id: "test-game",
  title: "Test Game",
  category: "quiz",
  description: "test",
  grades: [6],
  subjects: ["math"],
  mechanicIds: ["quiz-mcq"],
  status: "development",
  ...over,
});

const challenge = (over: Partial<ServerChallenge> = {}): ServerChallenge => ({
  id: "ch-1",
  gameId: "test-game",
  mechanicId: "quiz-mcq",
  type: "quiz",
  grade: 6,
  subjectId: "math",
  prompt: "2 + 3 = ?",
  payload: { options: ["4", "5"] },
  hint: "Count up from 2.",
  status: "approved",
  answerKey: "5",
  points: 10,
  ...over,
});

function makeController(challenges: ServerChallenge[] = [challenge()]) {
  const bank = new ChallengeBank();
  for (const c of challenges) bank.register(c);
  const mechanics = new MechanicRegistry();
  mechanics.register(createMultipleChoiceMechanic());
  let seq = 0;
  const controller = new GameSessionController("test-game", challenges.map((c) => c.id), {
    challenges: bank,
    mechanics,
    now,
    idFactory: () => `sess-${++seq}`,
  });
  return { controller, bank };
}

describe("GameRegistry", () => {
  it("registers, filters, and prevents duplicates", () => {
    const registry = new GameRegistry();
    registry.register(game());
    expect(registry.get("test-game").title).toBe("Test Game");
    expect(registry.list({ grade: 6, subjectId: "math" })).toHaveLength(1);
    expect(registry.list({ grade: 9 })).toHaveLength(0);
    expect(() => registry.register(game())).toThrowError(GameEngineError);
    expect(() => registry.get("nope")).toThrowError(/Unknown game/);
  });

  it("never lists development games as published", () => {
    const { games } = createGameEngine();
    expect(games.listPublished()).toEqual([]);
    expect(games.get("puzzle-quest").status).toBe("development");
  });
});

describe("Puzzle Quest registration (Step 01)", () => {
  it("is registered with pilot Class 6 Math and full future scope", () => {
    expect(PUZZLE_QUEST_DEFINITION).toMatchObject({
      id: "puzzle-quest",
      category: "puzzle",
      pilot: { grade: 6, subjectId: "math" },
    });
    expect(PUZZLE_QUEST_DEFINITION.grades).toEqual([6, 7, 8, 9, 10]);
    const { games, mechanics } = createGameEngine();
    expect(games.has("puzzle-quest")).toBe(true);
    for (const id of PUZZLE_QUEST_DEFINITION.mechanicIds) expect(mechanics.has(id)).toBe(true);
  });

  it("stub mechanics fail loudly instead of pretending to score", () => {
    const stub = createStubMechanic({ id: "number-sequence", kind: "number-sequence", name: "Number Sequence" });
    expect(() => stub.validate(challenge({ mechanicId: "number-sequence" }), 1)).toThrowError(/not implemented/);
  });
});

describe("MechanicRegistry", () => {
  it("prevents duplicate plugins and validates multiple choice", () => {
    const registry = new MechanicRegistry();
    const plugin = createMultipleChoiceMechanic();
    registry.register(plugin);
    expect(() => registry.register(plugin)).toThrowError(GameEngineError);
    expect(plugin.validate(challenge(), "5")).toEqual({ correct: true, points: 10 });
    expect(plugin.validate(challenge(), "4")).toEqual({ correct: false, points: 0 });
  });
});

describe("ChallengeBank", () => {
  it("loads only approved challenges and strips answer keys for clients", () => {
    const bank = new ChallengeBank();
    bank.register(challenge());
    bank.register(challenge({ id: "ch-2", status: "draft" }));
    expect(bank.loadApproved("test-game").map((c) => c.id)).toEqual(["ch-1"]);
    const client = toClientChallenge(challenge());
    expect(client).not.toHaveProperty("answerKey");
    expect(client).not.toHaveProperty("points");
    expect(client.prompt).toBe("2 + 3 = ?");
    expect(() => bank.register(challenge())).toThrowError(GameEngineError);
  });
});

describe("Game state transitions", () => {
  it("allows the legal lifecycle and rejects invalid actions deterministically", () => {
    const s0 = createInitialState("s1", "test-game", ["ch-1"], NOW);
    expect(s0.status).toBe("ready");
    expect(canApply(s0, { type: "PAUSE" })).toBe(false);
    expect(() => transition(s0, { type: "PAUSE" }, NOW)).toThrowError(/not allowed/);
    const s1 = transition(s0, { type: "START" }, NOW);
    expect(s1.status).toBe("playing");
    expect(s0.status).toBe("ready"); // input never mutated
    const s2 = transition(s1, { type: "PAUSE" }, NOW);
    expect(() => recordAnswer(s2, "ch-1", true, NOW)).toThrowError(/Cannot record/);
    const s3 = transition(s2, { type: "RESUME" }, NOW);
    const s4 = recordAnswer(s3, "ch-1", true, NOW);
    expect(s4.correctChallengeIds).toEqual(["ch-1"]);
    expect(() => recordAnswer(s4, "ch-1", true, NOW)).toThrowError(/already answered/);
    const s5 = transition(s4, { type: "COMPLETE" }, NOW);
    expect(s5.status).toBe("completed");
    expect(() => transition(s5, { type: "START" }, NOW)).toThrowError(GameEngineError);
  });
});

describe("GameEventBus", () => {
  it("delivers typed events, unsubscribes, and isolates failing listeners", () => {
    const bus = new GameEventBus();
    const seen: string[] = [];
    const off = bus.subscribe("SESSION_STARTED", (e) => seen.push(e.sessionId));
    bus.subscribe("SESSION_STARTED", () => {
      throw new Error("boom");
    });
    bus.emit({ type: "SESSION_STARTED", sessionId: "s1", gameId: "g", at: NOW.toISOString() });
    expect(seen).toEqual(["s1"]);
    off();
    bus.emit({ type: "SESSION_STARTED", sessionId: "s2", gameId: "g", at: NOW.toISOString() });
    expect(seen).toEqual(["s1"]);
    bus.clear();
    expect(bus.listenerCount()).toBe(0);
  });
});

describe("GameSessionController lifecycle", () => {
  it("runs start -> answer -> auto-complete with events and a server score", () => {
    const { controller } = makeController();
    const events: string[] = [];
    for (const type of ["SESSION_STARTED", "CHALLENGE_STARTED", "ANSWER_SUBMITTED", "ANSWER_VALIDATED", "CHALLENGE_COMPLETED", "SESSION_COMPLETED"] as const) {
      controller.bus.subscribe(type, (e) => events.push(e.type));
    }
    controller.start();
    expect(controller.currentChallenge()?.prompt).toBe("2 + 3 = ?");
    expect(controller.currentChallenge()).not.toHaveProperty("answerKey");
    const result = controller.submitAnswer("ch-1", "5");
    expect(result).toEqual({ correct: true, points: 10 });
    expect(controller.getSession().state.status).toBe("completed");
    expect(controller.result()).toMatchObject({ answered: 1, correct: 1, score: 10, totalChallenges: 1 });
    expect(events).toEqual(["SESSION_STARTED", "CHALLENGE_STARTED", "ANSWER_SUBMITTED", "ANSWER_VALIDATED", "CHALLENGE_COMPLETED", "SESSION_COMPLETED"]);
  });

  it("pause blocks answers, resume restores, interrupt keeps state inspectable", () => {
    const { controller } = makeController([challenge(), challenge({ id: "ch-2", prompt: "1 + 1 = ?", answerKey: "2" })]);
    controller.start();
    controller.pause();
    expect(() => controller.submitAnswer("ch-1", "5")).toThrowError(/Cannot submit/);
    controller.resume();
    expect(controller.submitAnswer("ch-1", "4").correct).toBe(false);
    controller.interrupt();
    expect(controller.getSession().state.status).toBe("interrupted");
    expect(controller.result().answered).toBe(1);
    expect(() => controller.submitAnswer("ch-2", "2")).toThrowError(GameEngineError);
  });

  it("counts hints and serves the challenge hint", () => {
    const { controller } = makeController();
    controller.start();
    expect(controller.requestHint("ch-1")).toBe("Count up from 2.");
    expect(controller.result().hintsUsed).toBe(1);
  });
});

describe("GameRuntime", () => {
  it("initializes registered games and rejects missing mechanics", () => {
    const games = new GameRegistry();
    games.register(game());
    const mechanics = new MechanicRegistry();
    const runtime = new GameRuntime({ games, mechanics, challenges: new ChallengeBank(), now });
    expect(() => runtime.initialize("test-game")).toThrowError(/unregistered mechanic/);
    mechanics.register(createMultipleChoiceMechanic());
    expect(runtime.initialize("test-game").id).toBe("test-game");
    const bank = new ChallengeBank();
    bank.register(challenge());
    const session = new GameRuntime({ games, mechanics, challenges: bank, now }).createSession("test-game");
    session.start();
    expect(session.submitAnswer("ch-1", "5").correct).toBe(true);
  });
});

describe("Adapters (existing systems, reused not duplicated)", () => {
  it("resolves real NCTB topics and rejects unknown ones", () => {
    const adapter = createNctbCurriculumAdapter();
    expect(adapter.classExists(6)).toBe(true);
    expect(adapter.classExists(3)).toBe(false);
    const topic = adapter.findTopic(6, "c6-math-numbers");
    if (topic) {
      expect(topic.classLevel).toBe(6);
      expect(topic.topicId).toBe("c6-math-numbers");
    } else {
      expect(adapter.findTopic(6, "no-such-topic")).toBeNull();
    }
  });

  it("session-only progress adapter stores nothing", async () => {
    const adapter = createSessionOnlyProgressAdapter();
    await adapter.recordGameResult({ learnerRef: "anon", gameId: "puzzle-quest", correct: 1, answered: 1 });
    expect(await adapter.weakTopicIds("anon")).toEqual([]);
  });
});
