import type { RevisionRepository, AttemptOutcome } from "../repository";
import type { RevisionNeo4jExecutor } from "./connection";
import { revisionDbUnavailable } from "./connection";
import {
  ADD_ATTEMPT,
  ADD_ATTEMPT_ONCE,
  ADD_EVENT,
  GET_MASTERY,
  GET_SCHEDULE,
  GET_SESSION,
  LIST_ATTEMPTS,
  LIST_EVENTS,
  LIST_MASTERY,
  LIST_SCHEDULES,
  LIST_SESSIONS,
  UPSERT_MASTERY,
  UPSERT_SCHEDULE,
  UPSERT_SESSION,
  attemptParams,
  eventParams,
  masteryParams,
  nodeProps,
  scheduleParams,
  sessionParams,
  toAttempt,
  toEvent,
  toMastery,
  toSchedule,
  toSession,
} from "./queries";
import {
  DuplicateAttemptError,
  type RevisionAttempt,
  type RevisionEvent,
  type RevisionSchedule,
  type RevisionSession,
  type StudentConceptMastery,
} from "../types";

/**
 * Neo4j implementation of the Part 01 RevisionRepository interface.
 *
 * - Parameterized Cypher only (see queries.ts); MERGE on node keys makes
 *   every write idempotent - repeating an operation updates in place.
 * - saveAttemptOutcome writes attempt + mastery + schedule + event in ONE
 *   write transaction: they commit together or roll back together, and a
 *   failure surfaces as REVISION_DB_UNAVAILABLE (503). Success is never
 *   reported for a failed write.
 * - The bundle's attempt write is CREATE-once (ADD_ATTEMPT_ONCE): the
 *   unique constraint on RevisionAttempt.id makes a duplicate attempt id
 *   fail the whole transaction, which the service turns into an
 *   idempotent no-op (DuplicateAttemptError). Direct addAttempt calls
 *   keep the idempotent MERGE.
 * - Only the Part 01 entity fields are stored. No student names, school
 *   names, addresses or other personal profile data exist in these
 *   records; persisted event metadata is additionally filtered
 *   (sanitizeEventMetadata).
 * - Persistence of these learner records is gated at the repository
 *   factory (REVISION_PERSIST_LEARNER_DATA) pending legal review; this
 *   class itself is only constructed when that gate is open.
 */
export class Neo4jRevisionRepository implements RevisionRepository {
  constructor(private executor: RevisionNeo4jExecutor) {}

  private async run(cypher: string, params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    try {
      return await this.executor.run(cypher, params);
    } catch (error) {
      throw revisionDbUnavailable(error);
    }
  }

  async getMastery(studentId: string, conceptId: string): Promise<StudentConceptMastery | null> {
    const rows = await this.run(GET_MASTERY, { studentId, conceptId });
    return rows[0] ? toMastery(nodeProps(rows[0], "m")) : null;
  }

  async upsertMastery(record: StudentConceptMastery): Promise<void> {
    await this.run(UPSERT_MASTERY, masteryParams(record));
  }

  async listMastery(
    studentId: string,
    filter: { subjectId?: string; classLevel?: number; chapterId?: string } = {},
  ): Promise<StudentConceptMastery[]> {
    const rows = await this.run(LIST_MASTERY, {
      studentId,
      subjectId: filter.subjectId ?? null,
      classLevel: filter.classLevel ?? null,
      chapterId: filter.chapterId ?? null,
    });
    return rows.map((r) => toMastery(nodeProps(r, "m")));
  }

  async getSchedule(studentId: string, conceptId: string): Promise<RevisionSchedule | null> {
    const rows = await this.run(GET_SCHEDULE, { studentId, conceptId });
    return rows[0] ? toSchedule(nodeProps(rows[0], "s")) : null;
  }

  async upsertSchedule(schedule: RevisionSchedule): Promise<void> {
    await this.run(UPSERT_SCHEDULE, scheduleParams(schedule));
  }

  async listSchedules(studentId: string): Promise<RevisionSchedule[]> {
    const rows = await this.run(LIST_SCHEDULES, { studentId });
    return rows.map((r) => toSchedule(nodeProps(r, "s")));
  }

  async addAttempt(attempt: RevisionAttempt): Promise<void> {
    await this.run(ADD_ATTEMPT, attemptParams(attempt));
  }

  async listAttempts(studentId: string, filter: { conceptId?: string; limit?: number } = {}): Promise<RevisionAttempt[]> {
    const rows = await this.run(LIST_ATTEMPTS, {
      studentId,
      conceptId: filter.conceptId ?? null,
      limit: Math.max(1, Math.min(filter.limit ?? 50, 500)),
    });
    return rows.map((r) => toAttempt(nodeProps(r, "a")));
  }

  async addSession(session: RevisionSession): Promise<void> {
    await this.run(UPSERT_SESSION, sessionParams(session));
  }

  async getSession(studentId: string, sessionId: string): Promise<RevisionSession | null> {
    const rows = await this.run(GET_SESSION, { studentId, sessionId });
    return rows[0] ? toSession(nodeProps(rows[0], "s")) : null;
  }

  async updateSession(session: RevisionSession): Promise<void> {
    await this.run(UPSERT_SESSION, sessionParams(session));
  }

  async listSessions(studentId: string, limit = 50): Promise<RevisionSession[]> {
    const rows = await this.run(LIST_SESSIONS, { studentId, limit: Math.max(1, Math.min(limit, 500)) });
    return rows.map((r) => toSession(nodeProps(r, "s")));
  }

  async addEvent(event: RevisionEvent): Promise<void> {
    await this.run(ADD_EVENT, eventParams(event));
  }

  async listEvents(studentId: string, limit = 50): Promise<RevisionEvent[]> {
    const rows = await this.run(LIST_EVENTS, { studentId, limit: Math.max(1, Math.min(limit, 500)) });
    return rows.map((r) => toEvent(nodeProps(r, "e")));
  }

  /** Atomic bundle: attempt + mastery + schedule + event, one transaction. */
  async saveAttemptOutcome(outcome: AttemptOutcome): Promise<void> {
    try {
      await this.executor.writeTransaction(async (run) => {
        await run(ADD_ATTEMPT_ONCE, attemptParams(outcome.attempt));
        await run(UPSERT_MASTERY, masteryParams(outcome.mastery));
        await run(UPSERT_SCHEDULE, scheduleParams(outcome.schedule));
        await run(ADD_EVENT, eventParams(outcome.event));
      });
    } catch (error) {
      if (isConstraintViolation(error)) throw new DuplicateAttemptError(outcome.attempt.id);
      throw revisionDbUnavailable(error);
    }
  }
}

/** Neo4j unique-constraint failures carry this error code prefix. */
export function isConstraintViolation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code.includes("ConstraintValidationFailed");
}
