import { DuplicateAttemptError, RevisionError, type RevisionAttempt, type RevisionEvent, type RevisionSchedule, type RevisionSession, type StudentConceptMastery } from "./types";
import { Neo4jRevisionRepository } from "./neo4j/neo4j-repository";
import { createRevisionNeo4jExecutor } from "./neo4j/connection";

/**
 * Persistence boundary. The Revision Engine depends only on this
 * interface. Part 01 shipped the in-memory implementation; Part 02 adds
 * Neo4jRevisionRepository (neo4j/neo4j-repository.ts) behind the privacy
 * gate below. Every read is scoped by studentId - there is no
 * cross-student query in this interface.
 */
/** The four writes produced by one scored attempt. Written atomically. */
export interface AttemptOutcome {
  attempt: RevisionAttempt;
  mastery: StudentConceptMastery;
  schedule: RevisionSchedule;
  event: RevisionEvent;
}

export interface RevisionRepository {
  /** Attempt + mastery + schedule + event commit together or not at all. */
  saveAttemptOutcome(outcome: AttemptOutcome): Promise<void>;
  getMastery(studentId: string, conceptId: string): Promise<StudentConceptMastery | null>;
  upsertMastery(record: StudentConceptMastery): Promise<void>;
  listMastery(studentId: string, filter?: { subjectId?: string; classLevel?: number; chapterId?: string }): Promise<StudentConceptMastery[]>;
  getSchedule(studentId: string, conceptId: string): Promise<RevisionSchedule | null>;
  upsertSchedule(schedule: RevisionSchedule): Promise<void>;
  listSchedules(studentId: string): Promise<RevisionSchedule[]>;
  addAttempt(attempt: RevisionAttempt): Promise<void>;
  listAttempts(studentId: string, filter?: { conceptId?: string; limit?: number }): Promise<RevisionAttempt[]>;
  addSession(session: RevisionSession): Promise<void>;
  getSession(studentId: string, sessionId: string): Promise<RevisionSession | null>;
  updateSession(session: RevisionSession): Promise<void>;
  listSessions(studentId: string, limit?: number): Promise<RevisionSession[]>;
  addEvent(event: RevisionEvent): Promise<void>;
  listEvents(studentId: string, limit?: number): Promise<RevisionEvent[]>;
}

const key = (studentId: string, conceptId: string) => studentId + "|" + conceptId;
const byTimeDesc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

/** In-memory implementation - local dev, tests, zero-infra demos. */
export class InMemoryRevisionRepository implements RevisionRepository {
  private mastery = new Map<string, StudentConceptMastery>();
  private schedules = new Map<string, RevisionSchedule>();
  private attempts: RevisionAttempt[] = [];
  private sessions = new Map<string, RevisionSession>();
  private events: RevisionEvent[] = [];

  async saveAttemptOutcome(outcome: AttemptOutcome): Promise<void> {
    if (this.attempts.some((a) => a.id === outcome.attempt.id)) throw new DuplicateAttemptError(outcome.attempt.id);
    await this.addAttempt(outcome.attempt);
    await this.upsertMastery(outcome.mastery);
    await this.upsertSchedule(outcome.schedule);
    await this.addEvent(outcome.event);
  }
  async getMastery(studentId: string, conceptId: string) {
    return this.mastery.get(key(studentId, conceptId)) ?? null;
  }
  async upsertMastery(record: StudentConceptMastery) {
    this.mastery.set(key(record.studentId, record.conceptId), { ...record });
  }
  async listMastery(studentId: string, filter: { subjectId?: string; classLevel?: number; chapterId?: string } = {}) {
    return [...this.mastery.values()].filter(
      (m) =>
        m.studentId === studentId &&
        (filter.subjectId === undefined || m.subjectId === filter.subjectId) &&
        (filter.classLevel === undefined || m.classLevel === filter.classLevel) &&
        (filter.chapterId === undefined || m.chapterId === filter.chapterId),
    );
  }
  async getSchedule(studentId: string, conceptId: string) {
    return this.schedules.get(key(studentId, conceptId)) ?? null;
  }
  async upsertSchedule(schedule: RevisionSchedule) {
    this.schedules.set(key(schedule.studentId, schedule.conceptId), { ...schedule });
  }
  async listSchedules(studentId: string) {
    return [...this.schedules.values()]
      .filter((s) => s.studentId === studentId)
      .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
  }
  async addAttempt(attempt: RevisionAttempt) {
    this.attempts.push({ ...attempt });
  }
  async listAttempts(studentId: string, filter: { conceptId?: string; limit?: number } = {}) {
    return this.attempts
      .filter((a) => a.studentId === studentId && (filter.conceptId === undefined || a.conceptId === filter.conceptId))
      .sort((a, b) => byTimeDesc(a.attemptedAt, b.attemptedAt))
      .slice(0, filter.limit ?? 50);
  }
  async addSession(session: RevisionSession) {
    this.sessions.set(key(session.studentId, session.sessionId), { ...session });
  }
  async getSession(studentId: string, sessionId: string) {
    return this.sessions.get(key(studentId, sessionId)) ?? null;
  }
  async updateSession(session: RevisionSession) {
    this.sessions.set(key(session.studentId, session.sessionId), { ...session });
  }
  async listSessions(studentId: string, limit = 50) {
    return [...this.sessions.values()]
      .filter((s) => s.studentId === studentId)
      .sort((a, b) => byTimeDesc(a.startedAt, b.startedAt))
      .slice(0, limit);
  }
  async addEvent(event: RevisionEvent) {
    this.events.push({ ...event });
  }
  async listEvents(studentId: string, limit = 50) {
    return this.events
      .filter((e) => e.studentId === studentId)
      .sort((a, b) => byTimeDesc(a.timestamp, b.timestamp))
      .slice(0, limit);
  }
}

/**
 * Privacy gate for persistent learner records (Part 02, Section 5).
 * Mastery, attempt history and revision events are learner records about
 * school-age students. Persisting them requires legal review, which is
 * not recorded anywhere in this codebase, so persistence stays OFF unless
 * an operator explicitly sets REVISION_PERSIST_LEARNER_DATA=true after
 * that review. Session-only (in-memory) adaptation is unaffected.
 */
export const LEARNER_PERSISTENCE_GATE_ENV = "REVISION_PERSIST_LEARNER_DATA";
export function isLearnerPersistenceAuthorized(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[LEARNER_PERSISTENCE_GATE_ENV]?.trim().toLowerCase() === "true";
}

/**
 * Process-wide singleton (survives Next dev HMR via globalThis).
 *
 * REVISION_STORE selects the store:
 * - "memory" (default): session-only in-memory store. Nothing persists.
 * - "neo4j": persistent Neo4j store. Requires the privacy gate above AND
 *   NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD (NEO4J_DATABASE optional).
 *   If either condition is unmet this throws a safe 503 RevisionError -
 *   it NEVER silently falls back to memory, so a caller can never be told
 *   a write persisted when it only lived in RAM.
 * Unknown values also fail with 503 rather than guessing a store.
 */
const globalStore = globalThis as typeof globalThis & { __kupiRevisionRepository?: RevisionRepository };
export function getRevisionRepository(env: NodeJS.ProcessEnv = process.env): RevisionRepository {
  if (!globalStore.__kupiRevisionRepository) {
    const driver = (env.REVISION_STORE ?? "memory").toLowerCase();
    if (driver === "memory") {
      globalStore.__kupiRevisionRepository = new InMemoryRevisionRepository();
    } else if (driver === "neo4j") {
      if (!isLearnerPersistenceAuthorized(env)) {
        throw new RevisionError(
          "REVISION_PERSISTENCE_NOT_AUTHORIZED",
          503,
          `Persistent revision storage is disabled pending legal review (set ${LEARNER_PERSISTENCE_GATE_ENV}=true only after that review)`,
        );
      }
      globalStore.__kupiRevisionRepository = new Neo4jRevisionRepository(createRevisionNeo4jExecutor(env));
    } else {
      throw new RevisionError("REVISION_STORE_UNKNOWN", 503, `Unknown REVISION_STORE: ${driver}`);
    }
  }
  return globalStore.__kupiRevisionRepository;
}

/** Test hook: replace the process-wide repository with a fresh one. */
export function setRevisionRepositoryForTests(repo: RevisionRepository | null): void {
  globalStore.__kupiRevisionRepository = repo ?? undefined;
}