import { GameEngineError, type GameAction, type GameState, type SessionStatus } from "./types";

/**
 * Game State Manager (Step 01): a pure, deterministic transition
 * function. Given the same state and action it always returns the same
 * next state, and it never mutates its input. Invalid transitions are
 * rejected so a client can never skip or rewind gameplay by crafting
 * actions.
 */

const ALLOWED: Record<SessionStatus, GameAction["type"][]> = {
  idle: ["START", "INTERRUPT"],
  ready: ["START", "INTERRUPT"],
  playing: ["PAUSE", "SUBMIT_ANSWER", "REQUEST_HINT", "ADVANCE", "COMPLETE", "INTERRUPT"],
  paused: ["RESUME", "INTERRUPT"],
  completed: [],
  interrupted: [],
};

export function canApply(state: GameState, action: GameAction): boolean {
  return ALLOWED[state.status].includes(action.type);
}

export function createInitialState(sessionId: string, gameId: string, challengeIds: string[], now: Date): GameState {
  return {
    sessionId,
    gameId,
    status: "ready",
    currentChallengeIndex: 0,
    challengeIds: [...challengeIds],
    answeredChallengeIds: [],
    correctChallengeIds: [],
    hintsUsed: 0,
    startedAt: null,
    updatedAt: now.toISOString(),
    completedAt: null,
  };
}

/**
 * Apply one action. Answer *correctness* is decided by the session
 * controller through a mechanic plugin (server-side); this function
 * only records the outcome the controller hands it via ADVANCE after a
 * validated answer — see `recordAnswer` below for the scored path.
 */
export function transition(state: GameState, action: GameAction, now: Date): GameState {
  if (!canApply(state, action)) {
    throw new GameEngineError("INVALID_TRANSITION", `Action ${action.type} is not allowed while session is ${state.status}`);
  }
  const next: GameState = { ...state, updatedAt: now.toISOString() };
  switch (action.type) {
    case "START":
      next.status = "playing";
      next.startedAt = state.startedAt ?? now.toISOString();
      break;
    case "PAUSE":
      next.status = "paused";
      break;
    case "RESUME":
      next.status = "playing";
      break;
    case "ADVANCE":
      next.currentChallengeIndex = Math.min(state.currentChallengeIndex + 1, Math.max(0, state.challengeIds.length - 1));
      break;
    case "COMPLETE":
      next.status = "completed";
      next.completedAt = now.toISOString();
      break;
    case "INTERRUPT":
      next.status = "interrupted";
      break;
    case "SUBMIT_ANSWER":
    case "REQUEST_HINT":
      // Validated/recorded by the session controller, which then calls
      // recordAnswer / recordHint. The bare transition is a no-op so a
      // crafted action alone can never change the score trail.
      break;
  }
  return next;
}

/** Record a validated answer outcome. Deterministic and non-mutating. */
export function recordAnswer(state: GameState, challengeId: string, correct: boolean, now: Date): GameState {
  if (state.status !== "playing") {
    throw new GameEngineError("INVALID_TRANSITION", `Cannot record an answer while session is ${state.status}`);
  }
  if (!state.challengeIds.includes(challengeId)) {
    throw new GameEngineError("CHALLENGE_NOT_IN_SESSION", `Challenge ${challengeId} is not part of this session`);
  }
  if (state.answeredChallengeIds.includes(challengeId)) {
    throw new GameEngineError("DUPLICATE_ANSWER", `Challenge ${challengeId} was already answered in this session`);
  }
  return {
    ...state,
    answeredChallengeIds: [...state.answeredChallengeIds, challengeId],
    correctChallengeIds: correct ? [...state.correctChallengeIds, challengeId] : state.correctChallengeIds,
    updatedAt: now.toISOString(),
  };
}

export function recordHint(state: GameState, now: Date): GameState {
  if (state.status !== "playing") {
    throw new GameEngineError("INVALID_TRANSITION", `Cannot request a hint while session is ${state.status}`);
  }
  return { ...state, hintsUsed: state.hintsUsed + 1, updatedAt: now.toISOString() };
}
