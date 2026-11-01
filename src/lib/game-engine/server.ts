import { createGameEngine } from "./index";
import { assertValidMission, PUZZLE_QUEST_MISSIONS, type Mission } from "./missions";
import { toClientChallenge } from "./challenges";
import type { GameSessionController } from "./session";
import { GameEngineError, type GameChallenge } from "./types";
import { AdaptiveDifficulty } from "./adaptive";
import { InMemoryProgressStore, type LearnerProgress } from "./progress";
import { computeXp, RewardLedger, type ChallengeOutcome } from "./rewards";
import { resolveChallengeContext, type ChallengeContext } from "./lesson-context";
import { createClass6MathMisconceptionRegistry, MisconceptionTracker } from "./misconceptions";
import { SessionPerformance } from "./performance";
import { recommend } from "./recommendations";

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

/**
 * Reward/progress stores (Step 05): server-side, session-only
 * in-memory. Persistent learner records stay behind the project's
 * legal-review gate — nothing here writes to any database.
 */
export const rewardLedger = new RewardLedger();
export const progressStore = new InMemoryProgressStore();

export function getGameProgress(learnerRef: string): LearnerProgress {
  return progressStore.getProgress(learnerRef || "anonymous-device");
}

interface ServerSession {
  controller: GameSessionController;
  missionId: string;
  learnerRef: string;
  /** Step 03 learning engines — session-only, discarded with the session. */
  performance: SessionPerformance;
  adaptive: AdaptiveDifficulty;
  misconceptions: MisconceptionTracker;
  hintsByChallenge: Map<string, number>;
}

const engine = createGameEngine();
for (const bundle of PUZZLE_QUEST_MISSIONS) {
  assertValidMission(bundle, new Set(engine.mechanics.list().map((m) => m.id)));
  for (const challenge of bundle.challenges) engine.challenges.register(challenge);
}

const sessions = new Map<string, ServerSession>();

export interface ClientMission extends Omit<Mission, "challengeIds"> {
  challenges: GameChallenge[];
  /** Step 03 lesson/curriculum context per challenge (no answer data). */
  contexts: Record<string, ChallengeContext>;
}

function toClientMission(bundle: (typeof PUZZLE_QUEST_MISSIONS)[number]): ClientMission {
  const contexts: Record<string, ChallengeContext> = {};
  for (const challenge of bundle.challenges) {
    contexts[challenge.id] = resolveChallengeContext({
      challenge: toClientChallenge(challenge),
      missionTitle: bundle.mission.title,
      hintLevels: challenge.hints?.length ?? 0,
    });
  }
  return { ...bundle.mission, challenges: bundle.challenges.map(toClientChallenge), contexts };
}

export function listClientMissions(): ClientMission[] {
  return PUZZLE_QUEST_MISSIONS.map(toClientMission);
}

export function startMissionSession(missionId: string, learnerRef = "anonymous-device"): { sessionId: string; mission: ClientMission } {
  const bundle = PUZZLE_QUEST_MISSIONS.find((b) => b.mission.id === missionId);
  if (!bundle) throw new GameEngineError("MISSION_NOT_FOUND", `Unknown mission: ${missionId}`);
  // Runtime session over exactly this mission's ordered challenges.
  const ordered = engine.runtime.createSessionForChallenges(bundle.mission.gameId, bundle.mission.challengeIds, learnerRef);
  ordered.start();
  sessions.set(ordered.getSession().id, {
    controller: ordered,
    missionId,
    learnerRef: learnerRef || "anonymous-device",
    performance: new SessionPerformance(),
    adaptive: new AdaptiveDifficulty(bundle.challenges[0]?.difficulty ?? 1),
    misconceptions: new MisconceptionTracker(createClass6MathMisconceptionRegistry()),
    hintsByChallenge: new Map(),
  });
  return {
    sessionId: ordered.getSession().id,
    mission: toClientMission(bundle),
  };
}

function getController(sessionId: string): GameSessionController {
  const entry = sessions.get(sessionId);
  if (!entry) throw new GameEngineError("SESSION_NOT_FOUND", `Unknown session: ${sessionId}`);
  return entry.controller;
}

export function submitMissionAnswer(sessionId: string, challengeId: string, answer: unknown) {
  const entry = sessions.get(sessionId);
  if (!entry) throw new GameEngineError("SESSION_NOT_FOUND", `Unknown session: ${sessionId}`);
  const controller = entry.controller;
  const challenge = engine.challenges.getServer(challengeId);
  const outcome = controller.attemptAnswer(challengeId, answer, 2);
  const state = controller.getSession().state;

  // Step 03 learning engines: session-only evidence, adaptation,
  // misconception patterns, and an explainable recommendation.
  const misconception = outcome.correct ? null : entry.misconceptions.observe(challenge, answer);
  if (outcome.recorded) {
    entry.performance.record({
      challengeId,
      mechanicId: challenge.mechanicId,
      correct: outcome.correct,
      attemptsUsed: outcome.attemptsUsed,
      hintsUsed: entry.hintsByChallenge.get(challengeId) ?? 0,
      difficulty: challenge.difficulty ?? 1,
      learningObjective: challenge.learningObjective,
      at: new Date().toISOString(),
    });
  }
  const snapshot = entry.performance.snapshot();
  const adaptation = outcome.recorded ? entry.adaptive.evaluate(snapshot) : null;
  const context = resolveChallengeContext({ challenge, missionTitle: entry.missionId, hintLevels: challenge.hints?.length ?? 0 });
  const recommendation = outcome.recorded
    ? recommend({
        lastRecordedCorrect: outcome.correct,
        snapshot,
        adaptation: adaptation ?? { difficulty: entry.adaptive.difficulty, changed: false, reason: "" },
        misconception,
        topicId: challenge.topicId,
        prerequisites: context.prerequisites,
        currentDifficulty: challenge.difficulty ?? 1,
        sessionCompleted: state.status === "completed",
      })
    : null;

  // Step 05 rewards & progress: computed once on completion from
  // trusted server evidence. The ledger makes repeat reads/submits
  // idempotent — XP and badges can never be awarded twice, and no
  // client-supplied XP/completion is ever read.
  let rewards: { xp: ReturnType<typeof computeXp>; badges: string[]; totalXp: number; persistence: "session-only" } | null = null;
  if (state.status === "completed") {
    const bundle = PUZZLE_QUEST_MISSIONS.find((b) => b.mission.id === entry.missionId);
    const evidenceByChallenge = new Map(snapshot.evidence.map((e) => [e.challengeId, e]));
    const outcomes: ChallengeOutcome[] = (bundle?.challenges ?? []).map((c) => {
      const e = evidenceByChallenge.get(c.id);
      return {
        challengeId: c.id,
        mechanicId: c.mechanicId,
        stage: c.stage,
        correct: e?.correct ?? false,
        hintsUsed: e?.hintsUsed ?? 0,
        learningObjective: c.learningObjective,
      };
    });
    const xp = computeXp(outcomes, true);
    const result = controller.result();
    const { award, duplicate } = rewardLedger.award({ sessionId: state.sessionId, missionId: entry.missionId, xp, badges: [], result });
    if (!duplicate) {
      const before = progressStore.getProgress(entry.learnerRef).badgesEarned;
      const progress = progressStore.recordSession(entry.learnerRef, {
        sessionId: state.sessionId,
        missionId: entry.missionId,
        completed: true,
        outcomes,
        xpTotal: xp.total,
        badges: [],
        completedAt: state.completedAt,
      });
      award.badges = progress.badgesEarned.filter((b) => !before.includes(b));
    }
    const progressNow = progressStore.getProgress(entry.learnerRef);
    rewards = { xp: award.xp, badges: award.badges, totalXp: progressNow.totalXp, persistence: "session-only" };
  }

  return {
    ...outcome,
    progress: {
      answered: state.answeredChallengeIds.length,
      total: state.challengeIds.length,
      currentChallengeId: state.challengeIds[state.currentChallengeIndex] ?? null,
      status: state.status,
    },
    result: state.status === "completed" ? controller.result() : null,
    adaptation,
    misconception,
    recommendation,
    rewards,
  };
}

/**
 * Minimal trusted context for the AI Game Director (Step 04): the
 * active challenge (server shape), its curriculum/lesson context,
 * and session-only performance evidence. No identity or personal
 * data exists in a session to begin with, so none can leak here.
 */
export function getDirectorContext(sessionId: string, challengeId: string) {
  const entry = sessions.get(sessionId);
  if (!entry) throw new GameEngineError("SESSION_NOT_FOUND", `Unknown session: ${sessionId}`);
  const challenge = engine.challenges.getServer(challengeId);
  const bundle = PUZZLE_QUEST_MISSIONS.find((b) => b.mission.id === entry.missionId);
  return {
    mission: bundle?.mission ?? null,
    challenge,
    clientChallenge: toClientChallenge(challenge),
    context: resolveChallengeContext({ challenge, missionTitle: bundle?.mission.title ?? "", hintLevels: challenge.hints?.length ?? 0 }),
    performance: entry.performance.snapshot(),
    difficulty: entry.adaptive.difficulty,
    hintsUsedForChallenge: entry.hintsByChallenge.get(challengeId) ?? 0,
    state: entry.controller.getSession().state,
    result: entry.controller.result(),
  };
}

export function requestMissionHint(sessionId: string, challengeId: string) {
  const entry = sessions.get(sessionId);
  if (!entry) throw new GameEngineError("SESSION_NOT_FOUND", `Unknown session: ${sessionId}`);
  const result = entry.controller.requestProgressiveHint(challengeId);
  entry.hintsByChallenge.set(challengeId, (entry.hintsByChallenge.get(challengeId) ?? 0) + 1);
  return result;
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
