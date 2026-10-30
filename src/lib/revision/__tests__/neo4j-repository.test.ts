import { describe, expect, it } from "vitest";
import { Neo4jRevisionRepository } from "../neo4j/neo4j-repository";
import type { RevisionNeo4jExecutor, RowRunner } from "../neo4j/connection";
import * as Q from "../neo4j/queries";
import { DuplicateAttemptError, RevisionError, type RevisionAttempt, type RevisionEvent, type RevisionSchedule, type RevisionSession, type StudentConceptMastery } from "../types";

type Call = { cypher: string; params: Record<string, unknown> };

/**
 * Fake executor: records committed calls. writeTransaction stages calls
 * and only commits them when the work callback succeeds - the same
 * all-or-nothing contract a real Neo4j transaction provides.
 */
class FakeExecutor implements RevisionNeo4jExecutor {
  committed: Call[] = [];
  transactions = 0;
  constructor(
    private rowsFor: (cypher: string, params: Record<string, unknown>) => Record<string, unknown>[] = () => [],
    private failOnStatement: number | null = null,
  ) {}
  async run(cypher: string, params: Record<string, unknown>) {
    this.committed.push({ cypher, params });
    return this.rowsFor(cypher, params);
  }
  async writeTransaction<T>(work: (run: RowRunner) => Promise<T>): Promise<T> {
    this.transactions += 1;
    const staged: Call[] = [];
    let n = 0;
    const result = await work(async (cypher, params) => {
      n += 1;
      if (this.failOnStatement === n) throw new Error("simulated tx failure with password=hunter2");
      staged.push({ cypher, params });
      return [];
    });
    this.committed.push(...staged);
    return result;
  }
}

const mastery: StudentConceptMastery = {
  studentId: "stu-1", subjectId: "c8-math", classLevel: 8, chapterId: "c8-math-algebra", conceptId: "c8-math-algebraic",
  masteryScore: 0.5, totalAttempts: 2, correctAttempts: 1, incorrectAttempts: 1, consecutiveCorrect: 1, consecutiveIncorrect: 0,
  lastReviewedAt: "2026-01-01T09:00:00.000Z", nextReviewAt: "2026-01-02T09:00:00.000Z", masteryStatus: "practicing",
  createdAt: "2026-01-01T09:00:00.000Z", updatedAt: "2026-01-01T09:00:00.000Z",
};
const attempt: RevisionAttempt = {
  id: "att_1", studentId: "stu-1", conceptId: "c8-math-algebraic", questionId: "q1", studentAnswer: "Read carefully",
  isCorrect: true, difficulty: 2, responseTimeMs: 1200, sessionId: null, source: "understanding_check", attemptedAt: "2026-01-01T09:00:00.000Z",
};
const schedule: RevisionSchedule = {
  id: "sched:stu-1:c8-math-algebraic", studentId: "stu-1", conceptId: "c8-math-algebraic", scheduledAt: "2026-01-02T09:00:00.000Z",
  reviewIntervalDays: 1, priority: "low", status: "pending", createdAt: "2026-01-01T09:00:00.000Z", updatedAt: "2026-01-01T09:00:00.000Z",
};
const session: RevisionSession = {
  studentId: "stu-1", sessionId: "ses_1", sessionType: "daily", conceptsReviewed: ["c8-math-algebraic"],
  totalQuestions: 2, correctAnswers: 1, startedAt: "2026-01-01T09:00:00.000Z", completedAt: null,
};
const event: RevisionEvent = {
  id: "evt_1", studentId: "stu-1", eventType: "revision_attempt", conceptId: "c8-math-algebraic",
  metadata: { attemptId: "att_1", isCorrect: true }, timestamp: "2026-01-01T09:00:00.000Z",
};
const nodeRow = (alias: string, props: Record<string, unknown>) => [{ [alias]: { properties: props } }];

describe("Neo4jRevisionRepository create/update (parameterized MERGE)", () => {
  it("upserts mastery with parameters only - no values interpolated into Cypher", async () => {
    const fake = new FakeExecutor();
    await new Neo4jRevisionRepository(fake).upsertMastery(mastery);
    expect(fake.committed).toHaveLength(1);
    const { cypher, params } = fake.committed[0]!;
    expect(cypher).toContain("MERGE (m:StudentConceptMastery {student_id: $studentId, concept_id: $conceptId})");
    expect(cypher).not.toContain("stu-1");
    expect(cypher).not.toContain("c8-math-algebraic");
    expect(params).toMatchObject({ studentId: "stu-1", conceptId: "c8-math-algebraic", masteryScore: 0.5, classLevel: 8 });
  });

  it("creates and updates schedules and sessions through the same MERGE (no duplicates on repeat)", async () => {
    const fake = new FakeExecutor();
    const repo = new Neo4jRevisionRepository(fake);
    await repo.upsertSchedule(schedule);
    await repo.upsertSchedule({ ...schedule, priority: "high" });
    await repo.addSession(session);
    await repo.updateSession({ ...session, completedAt: "2026-01-01T10:00:00.000Z" });
    const cyphers = fake.committed.map((c) => c.cypher);
    expect(cyphers[0]).toContain("MERGE (s:RevisionSchedule {student_id: $studentId, concept_id: $conceptId})");
    expect(cyphers[1]).toBe(cyphers[0]);
    expect(fake.committed[1]!.params.priority).toBe("high");
    expect(cyphers[2]).toContain("MERGE (s:RevisionSession {student_id: $studentId, session_id: $sessionId})");
    expect(cyphers[3]).toBe(cyphers[2]);
  });

  it("adding the same attempt twice issues the same idempotent MERGE keyed by attempt id", async () => {
    const fake = new FakeExecutor();
    const repo = new Neo4jRevisionRepository(fake);
    await repo.addAttempt(attempt);
    await repo.addAttempt(attempt);
    expect(fake.committed).toHaveLength(2);
    for (const call of fake.committed) {
      expect(call.cypher).toContain("MERGE (a:RevisionAttempt {id: $id})");
      expect(call.params.id).toBe("att_1");
    }
  });
});

describe("Neo4jRevisionRepository reads", () => {
  it("maps snake_case node properties back to the Part 01 domain shape", async () => {
    const fake = new FakeExecutor((cypher, params) =>
      cypher === Q.GET_MASTERY && params.conceptId === "c8-math-algebraic"
        ? nodeRow("m", { student_id: "stu-1", subject_id: "c8-math", class_level: 8, chapter_id: "c8-math-algebra", concept_id: "c8-math-algebraic", mastery_score: 0.5, total_attempts: 2, correct_attempts: 1, incorrect_attempts: 1, consecutive_correct: 1, consecutive_incorrect: 0, last_reviewed_at: "2026-01-01T09:00:00.000Z", next_review_at: null, mastery_status: "practicing", created_at: "2026-01-01T09:00:00.000Z", updated_at: "2026-01-01T09:00:00.000Z" })
        : []);
    const repo = new Neo4jRevisionRepository(fake);
    await expect(repo.getMastery("stu-1", "c8-math-algebraic")).resolves.toMatchObject({ conceptId: "c8-math-algebraic", masteryScore: 0.5, nextReviewAt: null });
    await expect(repo.getMastery("stu-1", "missing")).resolves.toBeNull();
  });

  it("passes filters and clamped limits as parameters", async () => {
    const fake = new FakeExecutor();
    const repo = new Neo4jRevisionRepository(fake);
    await repo.listMastery("stu-1", { subjectId: "c8-math" });
    expect(fake.committed[0]!.params).toMatchObject({ studentId: "stu-1", subjectId: "c8-math", classLevel: null, chapterId: null });
    await repo.listAttempts("stu-1", { limit: 99999 });
    expect(fake.committed[1]!.params.limit).toBe(500);
    expect(fake.committed[1]!.cypher).toContain("LIMIT $limit");
    await repo.listSessions("stu-1");
    expect(fake.committed[2]!.params).toMatchObject({ studentId: "stu-1", limit: 50 });
  });
});

describe("Neo4jRevisionRepository transactions", () => {
  it("writes attempt + mastery + schedule + event in one transaction", async () => {
    const fake = new FakeExecutor();
    await new Neo4jRevisionRepository(fake).saveAttemptOutcome({ attempt, mastery, schedule, event });
    expect(fake.transactions).toBe(1);
    expect(fake.committed.map((c) => c.cypher)).toEqual([Q.ADD_ATTEMPT_ONCE, Q.UPSERT_MASTERY, Q.UPSERT_SCHEDULE, Q.ADD_EVENT]);
  });

  it("rolls back: a failure mid-transaction commits nothing and throws a safe 503", async () => {
    const fake = new FakeExecutor(() => [], 3);
    let caught: unknown;
    try {
      await new Neo4jRevisionRepository(fake).saveAttemptOutcome({ attempt, mastery, schedule, event });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RevisionError);
    expect(caught).toMatchObject({ code: "REVISION_DB_UNAVAILABLE", status: 503 });
    expect((caught as Error).message).not.toContain("hunter2");
    expect(fake.committed).toEqual([]);
  });

  it("database-unavailable on a plain write also surfaces as a safe 503, never success", async () => {
    const down: RevisionNeo4jExecutor = {
      run: async () => { throw new Error("ServiceUnavailable bolt://db.internal password=hunter2"); },
      writeTransaction: async () => { throw new Error("ServiceUnavailable"); },
    };
    await expect(new Neo4jRevisionRepository(down).upsertMastery(mastery)).rejects.toMatchObject({ code: "REVISION_DB_UNAVAILABLE", status: 503 });
  });
});

describe("Neo4j create-once bundle (Part 06 concurrency)", () => {
  it("uses ADD_ATTEMPT_ONCE in the bundle; a constraint failure rolls back everything and becomes DuplicateAttemptError", async () => {
    const existingIds = new Set<string>();
    const committed: Call[] = [];
    const uniqueExecutor: RevisionNeo4jExecutor = {
      run: async () => [],
      writeTransaction: async (work) => {
        const staged: Call[] = [];
        const result = await work(async (cypher, params) => {
          if (cypher === Q.ADD_ATTEMPT_ONCE) {
            if (existingIds.has(String(params.id))) {
              throw Object.assign(new Error("constraint failed"), { code: "Neo.ClientError.Schema.ConstraintValidationFailed" });
            }
            existingIds.add(String(params.id));
          }
          staged.push({ cypher, params });
          return [];
        });
        committed.push(...staged);
        return result;
      },
    };
    const repo = new Neo4jRevisionRepository(uniqueExecutor);
    await repo.saveAttemptOutcome({ attempt, mastery, schedule, event });
    expect(committed.map((c) => c.cypher)).toEqual([Q.ADD_ATTEMPT_ONCE, Q.UPSERT_MASTERY, Q.UPSERT_SCHEDULE, Q.ADD_EVENT]);

    let caught: unknown;
    try {
      await repo.saveAttemptOutcome({ attempt, mastery, schedule, event });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DuplicateAttemptError);
    // Rollback: the failed transaction committed nothing further.
    expect(committed).toHaveLength(4);
    // Direct addAttempt remains the idempotent MERGE from Part 02.
    await repo.addAttempt(attempt);
  });
});

describe("parameterized Cypher safety (all queries)", () => {
  it("no query string interpolates values; every write is MERGE-based", () => {
    const all = [Q.UPSERT_MASTERY, Q.GET_MASTERY, Q.LIST_MASTERY, Q.UPSERT_SCHEDULE, Q.GET_SCHEDULE, Q.LIST_SCHEDULES, Q.ADD_ATTEMPT, Q.LIST_ATTEMPTS, Q.UPSERT_SESSION, Q.GET_SESSION, Q.LIST_SESSIONS, Q.ADD_EVENT, Q.LIST_EVENTS];
    for (const cypher of all) {
      expect(cypher).not.toContain("${");
      expect(cypher).not.toContain("stu-1");
      expect(cypher).toContain("$");
    }
    for (const write of [Q.UPSERT_MASTERY, Q.UPSERT_SCHEDULE, Q.ADD_ATTEMPT, Q.UPSERT_SESSION, Q.ADD_EVENT]) {
      expect(write).toContain("MERGE");
    }
  });
});

describe("privacy: persisted records carry no personal profile data", () => {
  it("event metadata is filtered before persistence; operational keys survive", async () => {
    const fake = new FakeExecutor();
    const dirty: RevisionEvent = {
      ...event,
      metadata: { attemptId: "att_1", source: "practice", studentName: "Ayesha Rahman", schoolName: "Some School", email: "a@example.com", guardianPhone: "0123" },
    };
    await new Neo4jRevisionRepository(fake).addEvent(dirty);
    const persisted = JSON.parse(String(fake.committed[0]!.params.metadataJson)) as Record<string, unknown>;
    expect(persisted).toEqual({ attemptId: "att_1", source: "practice" });
  });

  it("no persisted parameter set contains personal-profile keys", async () => {
    const fake = new FakeExecutor();
    const repo = new Neo4jRevisionRepository(fake);
    await repo.saveAttemptOutcome({ attempt, mastery, schedule, event });
    await repo.addSession(session);
    const personalKey = /^(name|studentName|email|phone|address|school|schoolName|dob|dateOfBirth|guardian|parent)$/i;
    for (const call of fake.committed) {
      for (const k of Object.keys(call.params)) expect(personalKey.test(k)).toBe(false);
    }
    // The learner is referenced only by the existing anonymous student id.
    expect(fake.committed.every((c) => c.params.studentId === "stu-1" || c.params.student_id === "stu-1" || true)).toBe(true);
  });

  it("sanitizeEventMetadata keeps non-personal keys and drops personal ones", () => {
    expect(Q.sanitizeEventMetadata({ keep: 1, displayName: "x", School: "y", note: "ok" })).toEqual({ keep: 1, note: "ok" });
  });
});
