import { randomUUID } from "node:crypto";
import { REVISION_CONFIG } from "./config";
import { getConcept, type ConceptDefinition } from "./concepts";
import { applyAttemptToMastery, emptyMastery, isWeak, placeholderMasteryScore } from "./mastery";
import { createSchedule, isDue, nextReview } from "./scheduling";
import { computeRevisionMetrics, type RevisionMetrics } from "./analytics";
import { getRevisionRepository, type RevisionRepository } from "./repository";
import {
  RevisionError,
  type RecordAttemptInput,
  type RecordEventInput,
  type RevisionAttempt,
  type RevisionEventType,
  type RevisionSchedule,
  type RevisionSession,
  type SessionType,
  type StudentConceptMastery,
} from "./types";

export interface EnrichedMastery extends StudentConceptMastery {
  concept: ConceptDefinition | null;
}
export interface EnrichedSchedule extends RevisionSchedule {
  concept: ConceptDefinition | null;
  due: boolean;
}
export interface RevisionOverview {
  studentId: string;
  metrics: RevisionMetrics;
  mastery: EnrichedMastery[];
  weakConcepts: EnrichedMastery[];
  upcoming: EnrichedSchedule[];
  dueToday: EnrichedSchedule[];
  recentSessions: RevisionSession[];
  recentAttempts: RevisionAttempt[];
}

const enrichMastery = (m: StudentConceptMastery): EnrichedMastery => ({ ...m, concept: getConcept(m.conceptId) });

/**
 * Revision Core (Section 3A): session manager + state + event processor
 * entry point. All student data flows through here; routes never touch
 * the repository directly. `now` is injectable so services stay testable.
 */
export class RevisionService {
  constructor(
    private repo: RevisionRepository = getRevisionRepository(),
    private now: () => Date = () => new Date(),
  ) {}

  private async appendEvent(studentId: string, eventType: RevisionEventType, conceptId: string | null, metadata: Record<string, unknown> = {}) {
    await this.repo.addEvent({
      id: `evt_${randomUUID()}`,
      studentId,
      eventType,
      conceptId,
      metadata,
      timestamp: this.now().toISOString(),
    });
  }

  async recordEvent(studentId: string, input: RecordEventInput) {
    if (input.conceptId && !getConcept(input.conceptId)) {
      throw new RevisionError("CONCEPT_NOT_FOUND", 404, `Unknown conceptId: ${input.conceptId}`);
    }
    const event = {
      id: `evt_${randomUUID()}`,
      studentId,
      eventType: input.eventType,
      conceptId: input.conceptId ?? null,
      metadata: input.metadata ?? {},
      timestamp: this.now().toISOString(),
    };
    await this.repo.addEvent(event);
    return event;
  }

  /**
   * The attempt pipeline. Server computes mastery/schedule from the stored
   * record - the input deliberately carries no masteryScore (Section 8).
   */
  async recordAttempt(studentId: string, input: RecordAttemptInput) {
    const concept = getConcept(input.conceptId);
    if (!concept) throw new RevisionError("CONCEPT_NOT_FOUND", 404, `Unknown conceptId: ${input.conceptId}`);
    const now = this.now();
    const attempt: RevisionAttempt = {
      id: `att_${randomUUID()}`,
      studentId,
      conceptId: input.conceptId,
      questionId: input.questionId ?? null,
      studentAnswer: input.studentAnswer ?? null,
      isCorrect: input.isCorrect,
      difficulty: input.difficulty ?? null,
      responseTimeMs: input.responseTimeMs ?? null,
      sessionId: input.sessionId ?? null,
      source: input.source,
      attemptedAt: now.toISOString(),
    };
    const previous = (await this.repo.getMastery(studentId, input.conceptId)) ?? emptyMastery(studentId, concept, now);
    const consecutiveCorrectAfter = input.isCorrect ? previous.consecutiveCorrect + 1 : 0;
    // Priority/interval must reflect the state AFTER this attempt, so the
    // score is projected before the schedule is created.
    const scoreAfter = placeholderMasteryScore(previous.correctAttempts + (input.isCorrect ? 1 : 0), previous.totalAttempts + 1);
    const review = nextReview(now, {
      isCorrect: input.isCorrect,
      consecutiveCorrectAfterAttempt: consecutiveCorrectAfter,
      masteryScore: scoreAfter,
      totalAttempts: previous.totalAttempts + 1,
      consecutiveIncorrect: input.isCorrect ? 0 : previous.consecutiveIncorrect + 1,
    });
    const mastery = applyAttemptToMastery(previous, { isCorrect: input.isCorrect, nextReviewAt: review.scheduledAt }, now);
    const schedule = createSchedule(studentId, input.conceptId, review, now, (await this.repo.getSchedule(studentId, input.conceptId)) ?? undefined);

    // Attempt + mastery + schedule + event are written atomically by the
    // repository (one Neo4j write transaction when persisted). If the
    // store fails, this throws and no partial outcome is reported.
    await this.repo.saveAttemptOutcome({
      attempt,
      mastery,
      schedule,
      event: {
        id: `evt_${randomUUID()}`,
        studentId,
        eventType: "revision_attempt",
        conceptId: input.conceptId,
        metadata: { attemptId: attempt.id, isCorrect: input.isCorrect, source: input.source, questionId: attempt.questionId },
        timestamp: now.toISOString(),
      },
    });

    if (input.sessionId) await this.noteAttemptInSession(studentId, input.sessionId, input.conceptId, input.isCorrect);
    return { attempt, mastery: enrichMastery(mastery), schedule };
  }

  private async noteAttemptInSession(studentId: string, sessionId: string, conceptId: string, isCorrect: boolean) {
    const session = await this.repo.getSession(studentId, sessionId);
    if (!session || session.completedAt) return;
    await this.repo.updateSession({
      ...session,
      conceptsReviewed: session.conceptsReviewed.includes(conceptId) ? session.conceptsReviewed : [...session.conceptsReviewed, conceptId],
      totalQuestions: session.totalQuestions + 1,
      correctAnswers: session.correctAnswers + (isCorrect ? 1 : 0),
    });
  }

  async startSession(studentId: string, sessionType: SessionType) {
    const session: RevisionSession = {
      studentId,
      sessionId: `ses_${randomUUID()}`,
      sessionType,
      conceptsReviewed: [],
      totalQuestions: 0,
      correctAnswers: 0,
      startedAt: this.now().toISOString(),
      completedAt: null,
    };
    await this.repo.addSession(session);
    await this.appendEvent(studentId, "revision_session_started", null, { sessionId: session.sessionId, sessionType });
    return session;
  }

  async completeSession(studentId: string, sessionId: string) {
    const session = await this.repo.getSession(studentId, sessionId);
    if (!session) throw new RevisionError("SESSION_NOT_FOUND", 404, `Unknown sessionId: ${sessionId}`);
    if (session.completedAt) return session;
    const done = { ...session, completedAt: this.now().toISOString() };
    await this.repo.updateSession(done);
    await this.appendEvent(studentId, "revision_session_completed", null, { sessionId, totalQuestions: done.totalQuestions, correctAnswers: done.correctAnswers });
    return done;
  }

  async getSession(studentId: string, sessionId: string) {
    const session = await this.repo.getSession(studentId, sessionId);
    if (!session) throw new RevisionError("SESSION_NOT_FOUND", 404, `Unknown sessionId: ${sessionId}`);
    return session;
  }

  async listMastery(studentId: string, filter: { subjectId?: string; classLevel?: number; chapterId?: string } = {}): Promise<EnrichedMastery[]> {
    return (await this.repo.listMastery(studentId, filter)).map(enrichMastery);
  }

  async getWeakConcepts(studentId: string): Promise<EnrichedMastery[]> {
    const all = await this.repo.listMastery(studentId);
    return all.filter((m) => m.masteryStatus === "weak" || isWeak(m)).map(enrichMastery)
      .sort((a, b) => a.masteryScore - b.masteryScore);
  }

  async getUpcoming(studentId: string, windowDays: number = REVISION_CONFIG.upcomingWindowDays): Promise<EnrichedSchedule[]> {
    const now = this.now();
    const horizon = new Date(now.getTime() + windowDays * 86_400_000).toISOString();
    const schedules = await this.repo.listSchedules(studentId);
    return schedules
      .filter((s) => s.status !== "completed" && s.status !== "cancelled" && s.scheduledAt <= horizon)
      .slice(0, REVISION_CONFIG.maxUpcoming)
      .map((s) => ({ ...s, concept: getConcept(s.conceptId), due: isDue(s, now) }));
  }

  async getOverview(studentId: string): Promise<RevisionOverview> {
    const [mastery, attempts, sessions, upcoming] = await Promise.all([
      this.repo.listMastery(studentId),
      this.repo.listAttempts(studentId, { limit: REVISION_CONFIG.maxHistory }),
      this.repo.listSessions(studentId, REVISION_CONFIG.maxHistory),
      this.getUpcoming(studentId),
    ]);
    const dueToday = upcoming.filter((s) => s.due);
    return {
      studentId,
      metrics: computeRevisionMetrics({
        mastery,
        attempts,
        dueNow: dueToday.length,
        sessionsCompleted: sessions.filter((s) => s.completedAt).length,
      }),
      mastery: mastery.map(enrichMastery),
      weakConcepts: await this.getWeakConcepts(studentId),
      upcoming,
      dueToday,
      recentSessions: sessions,
      recentAttempts: attempts.slice(0, 10),
    };
  }
}

export function createRevisionService(): RevisionService {
  return new RevisionService(getRevisionRepository());
}