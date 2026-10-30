import type {
  RevisionAttempt,
  RevisionEvent,
  RevisionSchedule,
  RevisionSession,
  StudentConceptMastery,
} from "./types";

/**
 * Persistence boundary (Section 4). Kupi has no student database today:
 * the curriculum graph is Neo4j (optional, in-memory default via
 * CURRICULUM_GRAPH_DRIVER) and Postgres/pgvector holds only RAG chunks
 * through Python scripts. Following that exact convention, the Revision
 * Engine depends only on this interface; the default implementation is
 * in-memory and `schema.cypher` carries the Neo4j constraints/indexes for
 * the production implementation (Part 02+). Every read is scoped by
 * studentId - there is no cross-student query in this interface.
 */
export interface RevisionRepository {
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
 * Process-wide singleton (survives Next dev HMR via globalThis).
 * REVISION_STORE=memory is the only driver in Part 01; unknown values fail fast.
 */
const globalStore = globalThis as typeof globalThis & { __kupiRevisionRepository?: RevisionRepository };
export function getRevisionRepository(): RevisionRepository {
  if (!globalStore.__kupiRevisionRepository) {
    const driver = (process.env.REVISION_STORE ?? "memory").toLowerCase();
    if (driver !== "memory") throw new Error(`Unknown REVISION_STORE: ${driver} (Part 01 supports "memory"; see schema.cypher)`);
    globalStore.__kupiRevisionRepository = new InMemoryRevisionRepository();
  }
  return globalStore.__kupiRevisionRepository;
}

/** Test hook: replace the process-wide repository with a fresh one. */
export function setRevisionRepositoryForTests(repo: RevisionRepository | null): void {
  globalStore.__kupiRevisionRepository = repo ?? undefined;
}