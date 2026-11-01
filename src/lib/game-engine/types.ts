/**
 * Kupi Game Engine — shared contracts (Step 01 foundation).
 *
 * Client-safe by default: nothing in this file may carry an answer key
 * or trusted scoring configuration. Server-only challenge data lives
 * in `ServerChallenge` and must never be serialized to a client.
 * Learner data is session-only; no type here stores a learner profile.
 */

export type GameCategory =
  | "puzzle"
  | "memory"
  | "build"
  | "battle"
  | "race"
  | "adventure"
  | "simulation"
  | "quiz";

export type PublicationStatus = "development" | "review" | "published" | "retired";

export type MechanicKind =
  | "number-sequence"
  | "equation-puzzle"
  | "fraction-puzzle"
  | "shape-puzzle"
  | "logic-puzzle"
  | "drag-build"
  | "matching"
  | "quiz"
  | "simulation";

export interface GameMechanic {
  id: string;
  kind: MechanicKind;
  /** Human-readable name (English first; Bangla label may be added by UI). */
  name: string;
}

export interface GameDefinition {
  id: string;
  title: string;
  titleBn?: string;
  category: GameCategory;
  description: string;
  /** NCTB class levels this game can serve (6-10). */
  grades: number[];
  /** Subject ids as used by the NCTB catalog (e.g. "math"). */
  subjects: string[];
  mechanicIds: string[];
  status: PublicationStatus;
  /** Pilot scope note, e.g. initial subject/grade while future scope is wider. */
  pilot?: { grade: number; subjectId: string };
}

export type ChallengeType = MechanicKind;

export interface GameChallenge {
  id: string;
  gameId: string;
  mechanicId: string;
  type: ChallengeType;
  /** NCTB topic id when the challenge is curriculum-bound. */
  topicId?: string;
  grade: number;
  subjectId: string;
  prompt: string;
  promptBn?: string;
  /** Opaque, mechanic-defined rendering payload. Contains NO answer key. */
  payload: Record<string, unknown>;
  hint?: string;
  status: "draft" | "approved";
}

/** SERVER-ONLY: the trusted answer key. Never send to client code. */
export interface ServerChallenge extends GameChallenge {
  answerKey: unknown;
  /** Trusted scoring weight, applied server-side only. */
  points: number;
}

export type SessionStatus = "idle" | "ready" | "playing" | "paused" | "completed" | "interrupted";

export interface GameState {
  sessionId: string;
  gameId: string;
  status: SessionStatus;
  currentChallengeIndex: number;
  challengeIds: string[];
  answeredChallengeIds: string[];
  correctChallengeIds: string[];
  hintsUsed: number;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
}

export interface GameSession {
  id: string;
  gameId: string;
  /** Anonymous session-scoped learner reference. No personal data. */
  learnerRef: string | null;
  state: GameState;
  createdAt: string;
}

export interface ValidationResult {
  correct: boolean;
  /** Server-computed points for this answer (0 when incorrect). */
  points: number;
  explanation?: string;
}

export interface GameResult {
  sessionId: string;
  gameId: string;
  totalChallenges: number;
  answered: number;
  correct: number;
  hintsUsed: number;
  /** Server-computed only; clients must never supply or trust this. */
  score: number;
  completedAt: string | null;
}

export type GameAction =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SUBMIT_ANSWER"; challengeId: string; answer: unknown }
  | { type: "REQUEST_HINT"; challengeId: string }
  | { type: "ADVANCE" }
  | { type: "COMPLETE" }
  | { type: "INTERRUPT" };

export type GameEvent =
  | { type: "SESSION_STARTED"; sessionId: string; gameId: string; at: string }
  | { type: "CHALLENGE_STARTED"; sessionId: string; challengeId: string; at: string }
  | { type: "ANSWER_SUBMITTED"; sessionId: string; challengeId: string; at: string }
  | { type: "ANSWER_VALIDATED"; sessionId: string; challengeId: string; correct: boolean; at: string }
  | { type: "HINT_REQUESTED"; sessionId: string; challengeId: string; at: string }
  | { type: "CHALLENGE_COMPLETED"; sessionId: string; challengeId: string; correct: boolean; at: string }
  | { type: "SESSION_PAUSED"; sessionId: string; at: string }
  | { type: "SESSION_COMPLETED"; sessionId: string; at: string };

export type GameEventType = GameEvent["type"];

export class GameEngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GameEngineError";
  }
}
