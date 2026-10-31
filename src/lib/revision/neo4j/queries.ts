import type {
  RevisionAttempt,
  RevisionEvent,
  RevisionSchedule,
  RevisionSession,
  StudentConceptMastery,
} from "../types";

/**
 * All Revision Neo4j Cypher, in one place.
 *
 * Safety rules (enforced by tests):
 * - Every user-controlled value travels as a $parameter. No template
 *   interpolation of ids, answers, or metadata anywhere in this file.
 * - Writes are MERGE-based on the schema's node keys, so repeating an
 *   operation never creates duplicate nodes.
 * - Every read filters on student_id first and carries an explicit LIMIT
 *   where the repository interface is bounded.
 *
 * Property names are snake_case, matching schema.cypher. Domain objects
 * keep Part 01's camelCase shape; the mappers below are the only bridge.
 */

/* ------------------------------ mastery ------------------------------ */

export const UPSERT_MASTERY = `
MERGE (m:StudentConceptMastery {student_id: $studentId, concept_id: $conceptId})
ON CREATE SET m.created_at = $createdAt
SET m.subject_id = $subjectId, m.class_level = $classLevel, m.chapter_id = $chapterId,
    m.mastery_score = $masteryScore, m.total_attempts = $totalAttempts,
    m.correct_attempts = $correctAttempts, m.incorrect_attempts = $incorrectAttempts,
    m.consecutive_correct = $consecutiveCorrect, m.consecutive_incorrect = $consecutiveIncorrect,
    m.last_reviewed_at = $lastReviewedAt, m.next_review_at = $nextReviewAt,
    m.mastery_status = $masteryStatus, m.updated_at = $updatedAt
RETURN m`;

export const GET_MASTERY = `
MATCH (m:StudentConceptMastery {student_id: $studentId, concept_id: $conceptId})
RETURN m`;

export const LIST_MASTERY = `
MATCH (m:StudentConceptMastery {student_id: $studentId})
WHERE ($subjectId IS NULL OR m.subject_id = $subjectId)
  AND ($classLevel IS NULL OR m.class_level = $classLevel)
  AND ($chapterId IS NULL OR m.chapter_id = $chapterId)
RETURN m
ORDER BY m.concept_id`;

export function masteryParams(m: StudentConceptMastery): Record<string, unknown> {
  return {
    studentId: m.studentId,
    subjectId: m.subjectId,
    classLevel: m.classLevel,
    chapterId: m.chapterId,
    conceptId: m.conceptId,
    masteryScore: m.masteryScore,
    totalAttempts: m.totalAttempts,
    correctAttempts: m.correctAttempts,
    incorrectAttempts: m.incorrectAttempts,
    consecutiveCorrect: m.consecutiveCorrect,
    consecutiveIncorrect: m.consecutiveIncorrect,
    lastReviewedAt: m.lastReviewedAt,
    nextReviewAt: m.nextReviewAt,
    masteryStatus: m.masteryStatus,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export function toMastery(props: Record<string, unknown>): StudentConceptMastery {
  return {
    studentId: String(props.student_id),
    subjectId: String(props.subject_id),
    classLevel: Number(props.class_level),
    chapterId: String(props.chapter_id),
    conceptId: String(props.concept_id),
    masteryScore: Number(props.mastery_score),
    totalAttempts: Number(props.total_attempts),
    correctAttempts: Number(props.correct_attempts),
    incorrectAttempts: Number(props.incorrect_attempts),
    consecutiveCorrect: Number(props.consecutive_correct),
    consecutiveIncorrect: Number(props.consecutive_incorrect),
    lastReviewedAt: (props.last_reviewed_at as string | null) ?? null,
    nextReviewAt: (props.next_review_at as string | null) ?? null,
    masteryStatus: props.mastery_status as StudentConceptMastery["masteryStatus"],
    createdAt: String(props.created_at),
    updatedAt: String(props.updated_at),
  };
}

/* ------------------------------ schedules ----------------------------- */

export const UPSERT_SCHEDULE = `
MERGE (s:RevisionSchedule {student_id: $studentId, concept_id: $conceptId})
ON CREATE SET s.created_at = $createdAt
SET s.id = $id, s.scheduled_at = $scheduledAt, s.review_interval_days = $reviewIntervalDays,
    s.priority = $priority, s.status = $status, s.updated_at = $updatedAt
RETURN s`;

export const GET_SCHEDULE = `
MATCH (s:RevisionSchedule {student_id: $studentId, concept_id: $conceptId})
RETURN s`;

export const LIST_SCHEDULES = `
MATCH (s:RevisionSchedule {student_id: $studentId})
RETURN s
ORDER BY s.scheduled_at ASC`;

export function scheduleParams(s: RevisionSchedule): Record<string, unknown> {
  return {
    id: s.id,
    studentId: s.studentId,
    conceptId: s.conceptId,
    scheduledAt: s.scheduledAt,
    reviewIntervalDays: s.reviewIntervalDays,
    priority: s.priority,
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function toSchedule(props: Record<string, unknown>): RevisionSchedule {
  return {
    id: String(props.id),
    studentId: String(props.student_id),
    conceptId: String(props.concept_id),
    scheduledAt: String(props.scheduled_at),
    reviewIntervalDays: Number(props.review_interval_days),
    priority: props.priority as RevisionSchedule["priority"],
    status: props.status as RevisionSchedule["status"],
    createdAt: String(props.created_at),
    updatedAt: String(props.updated_at),
  };
}

/* ------------------------------ attempts ------------------------------ */

export const ADD_ATTEMPT = `
MERGE (a:RevisionAttempt {id: $id})
SET a.student_id = $studentId, a.concept_id = $conceptId, a.question_id = $questionId,
    a.student_answer = $studentAnswer, a.is_correct = $isCorrect, a.difficulty = $difficulty,
    a.response_time_ms = $responseTimeMs, a.session_id = $sessionId, a.source = $source,
    a.attempted_at = $attemptedAt
RETURN a`;

/**
 * Create-once variant used ONLY inside the atomic bundle. The unique
 * constraint on RevisionAttempt.id (schema.cypher) makes a duplicate id
 * fail the whole transaction - mastery, schedule and event roll back
 * with it. Direct addAttempt calls keep the idempotent ADD_ATTEMPT MERGE.
 */
export const ADD_ATTEMPT_ONCE = `
CREATE (a:RevisionAttempt {id: $id})
SET a.student_id = $studentId, a.concept_id = $conceptId, a.question_id = $questionId,
    a.student_answer = $studentAnswer, a.is_correct = $isCorrect, a.difficulty = $difficulty,
    a.response_time_ms = $responseTimeMs, a.session_id = $sessionId, a.source = $source,
    a.attempted_at = $attemptedAt
RETURN a`;

export const LIST_ATTEMPTS = `
MATCH (a:RevisionAttempt {student_id: $studentId})
WHERE ($conceptId IS NULL OR a.concept_id = $conceptId)
RETURN a
ORDER BY a.attempted_at DESC
LIMIT $limit`;

export function attemptParams(a: RevisionAttempt): Record<string, unknown> {
  return {
    id: a.id,
    studentId: a.studentId,
    conceptId: a.conceptId,
    questionId: a.questionId,
    studentAnswer: a.studentAnswer,
    isCorrect: a.isCorrect,
    difficulty: a.difficulty,
    responseTimeMs: a.responseTimeMs,
    sessionId: a.sessionId,
    source: a.source,
    attemptedAt: a.attemptedAt,
  };
}

export function toAttempt(props: Record<string, unknown>): RevisionAttempt {
  return {
    id: String(props.id),
    studentId: String(props.student_id),
    conceptId: String(props.concept_id),
    questionId: (props.question_id as string | null) ?? null,
    studentAnswer: (props.student_answer as string | null) ?? null,
    isCorrect: Boolean(props.is_correct),
    difficulty: props.difficulty === null || props.difficulty === undefined ? null : Number(props.difficulty),
    responseTimeMs: props.response_time_ms === null || props.response_time_ms === undefined ? null : Number(props.response_time_ms),
    sessionId: (props.session_id as string | null) ?? null,
    source: props.source as RevisionAttempt["source"],
    attemptedAt: String(props.attempted_at),
  };
}

/* ------------------------------ sessions ------------------------------ */

export const UPSERT_SESSION = `
MERGE (s:RevisionSession {student_id: $studentId, session_id: $sessionId})
SET s.session_type = $sessionType, s.concepts_reviewed = $conceptsReviewed,
    s.total_questions = $totalQuestions, s.correct_answers = $correctAnswers,
    s.started_at = $startedAt, s.completed_at = $completedAt
RETURN s`;

export const GET_SESSION = `
MATCH (s:RevisionSession {student_id: $studentId, session_id: $sessionId})
RETURN s`;

export const LIST_SESSIONS = `
MATCH (s:RevisionSession {student_id: $studentId})
RETURN s
ORDER BY s.started_at DESC
LIMIT $limit`;

export function sessionParams(s: RevisionSession): Record<string, unknown> {
  return {
    studentId: s.studentId,
    sessionId: s.sessionId,
    sessionType: s.sessionType,
    conceptsReviewed: s.conceptsReviewed,
    totalQuestions: s.totalQuestions,
    correctAnswers: s.correctAnswers,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
  };
}

export function toSession(props: Record<string, unknown>): RevisionSession {
  return {
    studentId: String(props.student_id),
    sessionId: String(props.session_id),
    sessionType: props.session_type as RevisionSession["sessionType"],
    conceptsReviewed: Array.isArray(props.concepts_reviewed) ? props.concepts_reviewed.map(String) : [],
    totalQuestions: Number(props.total_questions),
    correctAnswers: Number(props.correct_answers),
    startedAt: String(props.started_at),
    completedAt: (props.completed_at as string | null) ?? null,
  };
}

/* ------------------------------- events ------------------------------- */

export const ADD_EVENT = `
MERGE (e:RevisionEvent {id: $id})
SET e.student_id = $studentId, e.event_type = $eventType, e.concept_id = $conceptId,
    e.metadata_json = $metadataJson, e.timestamp = $timestamp
RETURN e`;

export const LIST_EVENTS = `
MATCH (e:RevisionEvent {student_id: $studentId})
RETURN e
ORDER BY e.timestamp DESC
LIMIT $limit`;

/**
 * Privacy filter for PERSISTED event metadata. Event metadata is
 * client-supplied; keys that could carry personal information about a
 * school-age learner are never written to the persistent store. The
 * in-memory (session-only) store keeps Part 01 behaviour; persistence is
 * deliberately stricter. Matching is by key name, case-insensitive.
 */
const PERSONAL_METADATA_KEY = /(name|e-?mail|phone|address|school|dob|birth|parent|guardian|gender|religion|photo|location|latitude|longitude)/i;

export function sanitizeEventMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([k]) => !PERSONAL_METADATA_KEY.test(k)));
}

export function eventParams(e: RevisionEvent): Record<string, unknown> {
  return {
    id: e.id,
    studentId: e.studentId,
    eventType: e.eventType,
    conceptId: e.conceptId,
    metadataJson: JSON.stringify(sanitizeEventMetadata(e.metadata ?? {})),
    timestamp: e.timestamp,
  };
}

export function toEvent(props: Record<string, unknown>): RevisionEvent {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(String(props.metadata_json ?? "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    id: String(props.id),
    studentId: String(props.student_id),
    eventType: props.event_type as RevisionEvent["eventType"],
    conceptId: (props.concept_id as string | null) ?? null,
    metadata,
    timestamp: String(props.timestamp),
  };
}

/** Node-property maps are returned by the driver under the alias used. */
export function nodeProps(row: Record<string, unknown>, alias: string): Record<string, unknown> {
  const node = row[alias] as { properties?: Record<string, unknown> } | undefined;
  if (!node) return {};
  return node.properties ?? (node as unknown as Record<string, unknown>);
}
