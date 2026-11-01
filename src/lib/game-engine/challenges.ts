import { GameEngineError, type GameChallenge, type ServerChallenge } from "./types";

/**
 * Challenge Engine (Step 01): loads approved challenges and separates
 * content from rendering. Only `approved` challenges may enter a
 * session, and clients only ever receive the answer-key-free shape.
 */
export class ChallengeBank {
  private challenges = new Map<string, ServerChallenge>();

  register(challenge: ServerChallenge): ServerChallenge {
    if (this.challenges.has(challenge.id)) {
      throw new GameEngineError("DUPLICATE_CHALLENGE", `Challenge already registered: ${challenge.id}`);
    }
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  /** Server-side lookup (includes the answer key). */
  getServer(challengeId: string): ServerChallenge {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) throw new GameEngineError("CHALLENGE_NOT_FOUND", `Unknown challenge: ${challengeId}`);
    return challenge;
  }

  /** Approved challenges for a game, optionally narrowed to one mechanic. */
  loadApproved(gameId: string, mechanicId?: string): ServerChallenge[] {
    return [...this.challenges.values()].filter(
      (c) => c.gameId === gameId && c.status === "approved" && (mechanicId === undefined || c.mechanicId === mechanicId),
    );
  }
}

/** Strip trusted fields before anything reaches client code. */
export function toClientChallenge(challenge: ServerChallenge): GameChallenge {
  const { answerKey: _answerKey, points: _points, ...clientSafe } = challenge;
  void _answerKey;
  void _points;
  return clientSafe;
}
