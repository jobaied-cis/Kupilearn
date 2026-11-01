import type { ChallengeBank } from "./challenges";
import type { MechanicRegistry } from "./mechanics";
import type { GameRegistry } from "./registry";
import { GameSessionController } from "./session";
import { GameEngineError, type GameDefinition } from "./types";

export interface GameRuntimeDeps {
  games: GameRegistry;
  mechanics: MechanicRegistry;
  challenges: ChallengeBank;
  now?: () => Date;
  idFactory?: () => string;
}

/**
 * Game Runtime (Step 01): initializes a game from the registry, loads
 * its approved challenges, verifies every referenced mechanic plugin
 * exists, and hands back a session controller. Unpublished games can
 * be initialized for development/testing but never offered to students
 * (see `GameRegistry.listPublished`).
 */
export class GameRuntime {
  private sessionSequence = 0;

  constructor(private deps: GameRuntimeDeps) {}

  private nextSessionId(gameId: string): string {
    this.sessionSequence += 1;
    return this.deps.idFactory ? this.deps.idFactory() : `game-session-${gameId}-${this.sessionSequence}`;
  }

  initialize(gameId: string): GameDefinition {
    const game = this.deps.games.get(gameId);
    for (const mechanicId of game.mechanicIds) {
      if (!this.deps.mechanics.has(mechanicId)) {
        throw new GameEngineError("MECHANIC_NOT_FOUND", `Game ${gameId} references unregistered mechanic: ${mechanicId}`);
      }
    }
    return game;
  }

  /** Session over an explicit ordered challenge list (e.g. a mission). */
  createSessionForChallenges(gameId: string, challengeIds: string[], learnerRef: string | null = null): GameSessionController {
    const game = this.initialize(gameId);
    for (const id of challengeIds) this.deps.challenges.getServer(id);
    return new GameSessionController(game.id, challengeIds, {
      challenges: this.deps.challenges,
      mechanics: this.deps.mechanics,
      now: this.deps.now,
      idFactory: () => this.nextSessionId(game.id),
    }, learnerRef);
  }

  createSession(gameId: string, learnerRef: string | null = null, mechanicId?: string): GameSessionController {
    const game = this.initialize(gameId);
    const approved = this.deps.challenges.loadApproved(game.id, mechanicId);
    return new GameSessionController(game.id, approved.map((c) => c.id), {
      challenges: this.deps.challenges,
      mechanics: this.deps.mechanics,
      now: this.deps.now,
      idFactory: () => this.nextSessionId(game.id),
    }, learnerRef);
  }
}
