import { ChallengeBank, toClientChallenge } from "./challenges";
import { GameEventBus } from "./events";
import type { MechanicRegistry } from "./mechanics";
import { createInitialState, recordAnswer, recordHint, transition } from "./state";
import { GameEngineError, type GameChallenge, type GameResult, type GameSession, type ValidationResult } from "./types";

export interface AttemptOutcome extends ValidationResult {
  /** True when this attempt was recorded (correct, or attempts exhausted). */
  recorded: boolean;
  attemptsUsed: number;
  attemptsLeft: number;
  /** Concept explanation, present only once the attempt is recorded. */
  explanation?: string;
}

export interface SessionDeps {
  challenges: ChallengeBank;
  mechanics: MechanicRegistry;
  bus?: GameEventBus;
  /** Injectable for deterministic tests. */
  now?: () => Date;
  idFactory?: () => string;
}

/**
 * Game Session Controller (Step 01): owns one session's lifecycle —
 * create, start, pause/resume, answer (validated server-side through
 * the mechanic plugin), hint, complete, interrupt. Handles interrupted
 * sessions by keeping their state inspectable instead of dropping it.
 */
export class GameSessionController {
  private session: GameSession;
  private score = 0;
  private attemptCounts = new Map<string, number>();
  private hintLevels = new Map<string, number>();
  readonly bus: GameEventBus;
  private now: () => Date;

  constructor(
    gameId: string,
    challengeIds: string[],
    private deps: SessionDeps,
    learnerRef: string | null = null,
    sessionId?: string,
  ) {
    this.bus = deps.bus ?? new GameEventBus();
    this.now = deps.now ?? (() => new Date());
    const id = sessionId ?? deps.idFactory?.() ?? `game-session-${Date.now()}`;
    const created = this.now();
    this.session = {
      id,
      gameId,
      learnerRef,
      state: createInitialState(id, gameId, challengeIds, created),
      createdAt: created.toISOString(),
    };
  }

  getSession(): GameSession {
    return this.session;
  }

  /** Client-safe view of the current challenge (no answer key). */
  currentChallenge(): GameChallenge | null {
    const id = this.session.state.challengeIds[this.session.state.currentChallengeIndex];
    if (!id) return null;
    return toClientChallenge(this.deps.challenges.getServer(id));
  }

  start(): GameSession {
    this.apply({ type: "START" });
    this.bus.emit({ type: "SESSION_STARTED", sessionId: this.session.id, gameId: this.session.gameId, at: this.now().toISOString() });
    const current = this.currentChallenge();
    if (current) {
      this.bus.emit({ type: "CHALLENGE_STARTED", sessionId: this.session.id, challengeId: current.id, at: this.now().toISOString() });
    }
    return this.session;
  }

  pause(): GameSession {
    this.apply({ type: "PAUSE" });
    this.bus.emit({ type: "SESSION_PAUSED", sessionId: this.session.id, at: this.now().toISOString() });
    return this.session;
  }

  resume(): GameSession {
    this.apply({ type: "RESUME" });
    return this.session;
  }

  submitAnswer(challengeId: string, answer: unknown): ValidationResult {
    const { recorded: _r, attemptsUsed: _u, attemptsLeft: _l, explanation: _e, ...validation } = this.attemptAnswer(challengeId, answer, 1);
    void _r;
    void _u;
    void _l;
    void _e;
    return validation;
  }

  /**
   * Answer with supportive retry (Step 02): an incorrect answer is
   * validated and reported but only recorded once it is correct or
   * `maxAttempts` is reached — so a student can try again without the
   * challenge being scored as finished on the first mistake. Events
   * keep the Step 01 sequence: SUBMITTED -> VALIDATED on every try,
   * CHALLENGE_COMPLETED only when recorded.
   */
  attemptAnswer(challengeId: string, answer: unknown, maxAttempts = 2): AttemptOutcome {
    if (this.session.state.status !== "playing") {
      throw new GameEngineError("INVALID_TRANSITION", `Cannot submit an answer while session is ${this.session.state.status}`);
    }
    if (this.session.state.answeredChallengeIds.includes(challengeId)) {
      throw new GameEngineError("DUPLICATE_ANSWER", `Challenge ${challengeId} was already answered in this session`);
    }
    this.bus.emit({ type: "ANSWER_SUBMITTED", sessionId: this.session.id, challengeId, at: this.now().toISOString() });
    const challenge = this.deps.challenges.getServer(challengeId);
    const plugin = this.deps.mechanics.get(challenge.mechanicId);
    const result = plugin.validate(challenge, answer);
    this.bus.emit({ type: "ANSWER_VALIDATED", sessionId: this.session.id, challengeId, correct: result.correct, at: this.now().toISOString() });
    const attemptsUsed = (this.attemptCounts.get(challengeId) ?? 0) + 1;
    this.attemptCounts.set(challengeId, attemptsUsed);
    const recorded = result.correct || attemptsUsed >= Math.max(1, maxAttempts);
    if (!recorded) {
      return { ...result, recorded, attemptsUsed, attemptsLeft: Math.max(1, maxAttempts) - attemptsUsed };
    }
    this.session = { ...this.session, state: recordAnswer(this.session.state, challengeId, result.correct, this.now()) };
    if (result.correct) this.score += result.points;
    this.bus.emit({ type: "CHALLENGE_COMPLETED", sessionId: this.session.id, challengeId, correct: result.correct, at: this.now().toISOString() });
    if (this.session.state.answeredChallengeIds.length >= this.session.state.challengeIds.length) {
      this.complete();
    } else {
      this.apply({ type: "ADVANCE" });
      const next = this.currentChallenge();
      if (next) {
        this.bus.emit({ type: "CHALLENGE_STARTED", sessionId: this.session.id, challengeId: next.id, at: this.now().toISOString() });
      }
    }
    return { ...result, recorded, attemptsUsed, attemptsLeft: 0, explanation: challenge.explanation };
  }

  requestHint(challengeId: string): string | null {
    return this.requestProgressiveHint(challengeId).hint;
  }

  /**
   * Progressive hints (Step 02): level 1 clue, level 2 strategy,
   * level 3 guided explanation — served one level deeper per request,
   * never revealing the answer directly. Falls back to the single
   * Step 01 `hint` when no progressive list exists.
   */
  requestProgressiveHint(challengeId: string): { hint: string | null; level: number; total: number } {
    this.session = { ...this.session, state: recordHint(this.session.state, this.now()) };
    this.bus.emit({ type: "HINT_REQUESTED", sessionId: this.session.id, challengeId, at: this.now().toISOString() });
    const challenge = this.deps.challenges.getServer(challengeId);
    const hints = challenge.hints && challenge.hints.length > 0 ? challenge.hints : challenge.hint ? [challenge.hint] : [];
    if (hints.length === 0) return { hint: null, level: 0, total: 0 };
    const nextLevel = Math.min((this.hintLevels.get(challengeId) ?? 0) + 1, hints.length);
    this.hintLevels.set(challengeId, nextLevel);
    return { hint: hints[nextLevel - 1] ?? null, level: nextLevel, total: hints.length };
  }

  complete(): GameSession {
    if (this.session.state.status === "completed") return this.session;
    this.apply({ type: "COMPLETE" });
    this.bus.emit({ type: "SESSION_COMPLETED", sessionId: this.session.id, at: this.now().toISOString() });
    return this.session;
  }

  interrupt(): GameSession {
    this.apply({ type: "INTERRUPT" });
    return this.session;
  }

  result(): GameResult {
    const s = this.session.state;
    return {
      sessionId: s.sessionId,
      gameId: s.gameId,
      totalChallenges: s.challengeIds.length,
      answered: s.answeredChallengeIds.length,
      correct: s.correctChallengeIds.length,
      hintsUsed: s.hintsUsed,
      score: this.score,
      completedAt: s.completedAt,
    };
  }

  /** Detach every event listener (session disposal, no leaks). */
  dispose(): void {
    this.bus.clear();
  }

  private apply(action: Parameters<typeof transition>[1]): void {
    this.session = { ...this.session, state: transition(this.session.state, action, this.now()) };
  }
}
