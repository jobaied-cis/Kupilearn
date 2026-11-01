import { createGameEngine } from "./index";
import { assertValidMission, PUZZLE_QUEST_MISSIONS, type Mission } from "./missions";
import { toClientChallenge } from "./challenges";
import type { GameSessionController } from "./session";
import { GameEngineError, type GameChallenge } from "./types";

/**
 * Server-side Puzzle Quest service (Step 02).
 *
 * SERVER ONLY — this module holds answer keys (inside the engine's
 * challenge bank) and must only be imported by route handlers. Clients
 * receive client-safe challenges, progressive hints one level at a
 * time, and validation results. Scores are computed here from plugin
 * validation; nothing the client sends about correctness is trusted.
 *
 * Sessions live in process memory (no persistence in this step, so no
 * persistent learner analytics are created). A server restart ends
 * in-progress sessions — documented limitation.
 */

interface ServerSession {
  controller: GameSessionController;
  missionId: string;
}

const engine = createGameEngine();
for (const bundle of PUZZLE_QUEST_MISSIONS) {
  assertValidMission(bundle, new Set(engine.mechanics.list().map((m) => m.id)));
  for (const challenge of bundle.challenges) engine.challenges.register(challenge);
}

const sessions = new Map<string, ServerSession>();

export interface ClientMission extends Omit<Mission, "challengeIds"> {
  challenges: GameChallenge[];
}

export function listClientMissions(): ClientMission[] {
  return PUZZLE_QUEST_MISSIONS.map(({ mission, challenges }) => ({
    ...mission,
    challenges: challenges.map(toClientChallenge),
  }));
}

export function startMissionSession(missionId: string): { sessionId: string; mission: ClientMission } {
  const bundle = PUZZLE_QUEST_MISSIONS.find((b) => b.mission.id === missionId);
  if (!bundle) throw new GameEngineError("MISSION_NOT_FOUND", `Unknown mission: ${missionId}`);
  // Runtime session over exactly this mission's ordered challenges.
  const ordered = engine.runtime.createSessionForChallenges(bundle.mission.gameId, bundle.mission.challengeIds);
  ordered.start();
  sessions.set(ordered.getSession().id, { controller: ordered, missionId });
  return {
    sessionId: ordered.getSession().id,
    mission: { ...bundle.mission, challenges: bundle.challenges.map(toClientChallenge) },
  };
}

function getController(sessionId: string): GameSessionController {
  const entry = sessions.get(sessionId);
  if (!entry) throw new GameEngineError("SESSION_NOT_FOUND", `Unknown session: ${sessionId}`);
  return entry.controller;
}

export function submitMissionAnswer(sessionId: string, challengeId: string, answer: unknown) {
  const controller = getController(sessionId);
  const outcome = controller.attemptAnswer(challengeId, answer, 2);
  const state = controller.getSession().state;
  return {
    ...outcome,
    progress: {
      answered: state.answeredChallengeIds.length,
      total: state.challengeIds.length,
      currentChallengeId: state.challengeIds[state.currentChallengeIndex] ?? null,
      status: state.status,
    },
    result: state.status === "completed" ? controller.result() : null,
  };
}

export function requestMissionHint(sessionId: string, challengeId: string) {
  return getController(sessionId).requestProgressiveHint(challengeId);
}

export function pauseMissionSession(sessionId: string) {
  const controller = getController(sessionId);
  if (controller.getSession().state.status === "playing") controller.pause();
  return controller.getSession().state.status;
}

export function resumeMissionSession(sessionId: string) {
  const controller = getController(sessionId);
  if (controller.getSession().state.status === "paused") controller.resume();
  return controller.getSession().state.status;
}
