import { evaluateBadges, type ChallengeOutcome, type ProgressAggregate } from "./rewards";

/**
 * Progress Engine (Step 05): aggregates trusted, server-computed
 * session results into a learner's game progress.
 *
 * PERSISTENCE POLICY: persistent learner records remain behind the
 * project's legal-review gate (see Revision Engine Part 02), so the
 * only store shipped here is session-only in-memory. Every response
 * carries `persistence: "session-only"` and the UI labels it as
 * such — in-memory progress is never presented as a permanent
 * achievement. `GameProgressStore` is the clean adapter boundary a
 * future approved persistent store can implement without touching
 * callers.
 */
export interface SessionProgressRecord {
  sessionId: string;
  missionId: string;
  completed: boolean;
  outcomes: ChallengeOutcome[];
  xpTotal: number;
  badges: string[];
  completedAt: string | null;
}

export interface LearnerProgress extends ProgressAggregate {
  learnerRef: string;
  /** Always "session-only" until legal approval enables persistence. */
  persistence: "session-only";
  sessionsPlayed: number;
  updatedAt: string | null;
}

export interface GameProgressStore {
  recordSession(learnerRef: string, record: SessionProgressRecord): LearnerProgress;
  getProgress(learnerRef: string): LearnerProgress;
}

const emptyProgress = (learnerRef: string): LearnerProgress => ({
  learnerRef,
  persistence: "session-only",
  missionsCompleted: [],
  totalXp: 0,
  challengesAnswered: 0,
  challengesCorrect: 0,
  objectivesCovered: [],
  mechanicsExplored: [],
  badgesEarned: [],
  sessionsPlayed: 0,
  updatedAt: null,
});

export class InMemoryProgressStore implements GameProgressStore {
  private byLearner = new Map<string, { progress: LearnerProgress; sessions: Map<string, SessionProgressRecord> }>();

  recordSession(learnerRef: string, record: SessionProgressRecord): LearnerProgress {
    const entry = this.byLearner.get(learnerRef) ?? { progress: emptyProgress(learnerRef), sessions: new Map() };
    if (entry.sessions.has(record.sessionId)) {
      // Duplicate completion claim: return the stored truth unchanged.
      return entry.progress;
    }
    entry.sessions.set(record.sessionId, record);
    const p = entry.progress;
    const aggregate: ProgressAggregate = {
      missionsCompleted: record.completed && !p.missionsCompleted.includes(record.missionId)
        ? [...p.missionsCompleted, record.missionId]
        : p.missionsCompleted,
      totalXp: p.totalXp + record.xpTotal,
      challengesAnswered: p.challengesAnswered + record.outcomes.length,
      challengesCorrect: p.challengesCorrect + record.outcomes.filter((o) => o.correct).length,
      objectivesCovered: [...new Set([...p.objectivesCovered, ...record.outcomes.filter((o) => o.correct && o.learningObjective).map((o) => o.learningObjective!)])],
      mechanicsExplored: [...new Set([...p.mechanicsExplored, ...record.outcomes.filter((o) => o.correct).map((o) => o.mechanicId)])],
      badgesEarned: [...p.badgesEarned],
    };
    const freshBadges = evaluateBadges({
      aggregate,
      sessionOutcomes: record.outcomes,
      missionId: record.missionId,
      missionCompleted: record.completed,
    });
    aggregate.badgesEarned = [...new Set([...aggregate.badgesEarned, ...record.badges, ...freshBadges])];
    entry.progress = {
      ...aggregate,
      learnerRef,
      persistence: "session-only",
      sessionsPlayed: entry.sessions.size,
      updatedAt: new Date().toISOString(),
    };
    this.byLearner.set(learnerRef, entry);
    return entry.progress;
  }

  getProgress(learnerRef: string): LearnerProgress {
    return this.byLearner.get(learnerRef)?.progress ?? emptyProgress(learnerRef);
  }
}

/**
 * Connected LearningProgressAdapter (Step 07): wraps a real
 * GameProgressStore. The Step 01 contract's counts-only
 * `recordGameResult` cannot create trusted challenge outcomes, so it
 * deliberately records nothing on its own; trusted recording goes
 * through `recordSession`, which the game server calls with
 * server-validated outcomes.
 */
export function createGameProgressAdapter(store: GameProgressStore) {
  return {
    async recordGameResult(_input: { learnerRef: string; gameId: string; correct: number; answered: number }): Promise<void> {
      void _input;
      /* Counts alone are not trusted evidence; see recordSession. */
    },
    async weakTopicIds(_learnerRef: string): Promise<string[]> {
      void _learnerRef;
      return [];
    },
    recordSession(learnerRef: string, record: SessionProgressRecord): LearnerProgress {
      return store.recordSession(learnerRef, record);
    },
    getProgress(learnerRef: string): LearnerProgress {
      return store.getProgress(learnerRef);
    },
  };
}
export type GameProgressAdapter = ReturnType<typeof createGameProgressAdapter>;

/** Deterministic next-activity recommendation from progress (no AI). */
export function recommendNextMission(progress: LearnerProgress, missionIds: string[]): { missionId: string | null; reason: string } {
  const next = missionIds.find((id) => !progress.missionsCompleted.includes(id));
  if (next) return { missionId: next, reason: "The next mission you have not completed yet." };
  if (missionIds.length > 0) return { missionId: missionIds[0]!, reason: "You completed every available mission — replay one to practise more." };
  return { missionId: null, reason: "No missions are available yet." };
}
