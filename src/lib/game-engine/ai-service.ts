import { GameDirector, type DirectorAction, type DirectorResponse } from "./director";
import { createMetaGameAiAdapter, SessionThrottle, type MetaGameAiAdapter } from "./meta-adapter";
import { getDirectorContext } from "./server";
import { GameEngineError } from "./types";
import { gameErrorStatus } from "./http";

/**
 * Session-scoped AI service (Step 04) — SERVER ONLY.
 *
 * One Game Director per game session, with its own throttle and a
 * capped conversation history (max 10 turns, kept only in server
 * process memory for the life of the session). No conversation is
 * persisted, and no AI output can touch game state or scores: this
 * service only returns display text.
 */

export interface AiTurn {
  action: DirectorAction;
  personaId: string;
  text: string;
  source: "meta" | "offline";
  at: string;
}

interface AiSession {
  director: GameDirector;
  history: AiTurn[];
}

const MAX_HISTORY_TURNS = 10;
const sessions = new Map<string, AiSession>();

export interface AiServiceDeps {
  ai?: MetaGameAiAdapter;
}

export function createAiService(deps: AiServiceDeps = {}) {
  const ai = deps.ai ?? createMetaGameAiAdapter();

  function sessionFor(sessionId: string): AiSession {
    let entry = sessions.get(sessionId);
    if (!entry) {
      entry = { director: new GameDirector({ ai, throttle: new SessionThrottle() }), history: [] };
      sessions.set(sessionId, entry);
      // Bounded cleanup (Step 06): drop oldest AI session state first.
      while (sessions.size > 200) {
        const oldest = sessions.keys().next().value as string | undefined;
        if (oldest === undefined || oldest === sessionId) break;
        sessions.delete(oldest);
      }
    }
    return entry;
  }

  return {
    aiAvailable: ai.available,

    async act(input: {
      sessionId: string;
      challengeId: string;
      action: DirectorAction;
      personaId?: string;
      hintLevel?: number;
      studentText?: string;
      lang?: "en" | "bn";
    }): Promise<DirectorResponse & { history: AiTurn[] }> {
      const ctx = getDirectorContext(input.sessionId, input.challengeId);
      const entry = sessionFor(input.sessionId);
      const response = await entry.director.act(
        {
          challenge: ctx.challenge,
          context: ctx.context,
          performance: ctx.performance,
          difficulty: ctx.difficulty,
          hintsUsedForChallenge: ctx.hintsUsedForChallenge,
          result: ctx.result,
        },
        {
          action: input.action,
          personaId: input.personaId,
          hintLevel: input.hintLevel,
          studentText: input.studentText,
          lang: input.lang,
        },
      );
      entry.history.push({
        action: response.action,
        personaId: response.personaId,
        text: response.text,
        source: response.source,
        at: new Date().toISOString(),
      });
      if (entry.history.length > MAX_HISTORY_TURNS) {
        entry.history.splice(0, entry.history.length - MAX_HISTORY_TURNS);
      }
      return { ...response, history: [...entry.history] };
    },

    history(sessionId: string): AiTurn[] {
      return [...(sessions.get(sessionId)?.history ?? [])];
    },
  };
}

export type AiService = ReturnType<typeof createAiService>;

let shared: AiService | null = null;
export function getAiService(): AiService {
  if (!shared) shared = createAiService();
  return shared;
}

export function aiErrorStatus(error: unknown): number {
  if (error instanceof GameEngineError) return gameErrorStatus(error);
  return 500;
}
