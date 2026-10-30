import { z } from "zod";

/**
 * Revision Engine domain types (Part 01 foundation).
 * Logical entities from the spec, adapted to Kupi conventions:
 * Zod-validated, ISO-string timestamps (same as learner/profile stores),
 * string ids. There is no student database or auth system in Kupi yet -
 * `studentId` is the stable anonymous id issued by `lib/revision/client.ts`
 * and enforced server-side by `lib/revision/server.ts` (see README).
 */

export const MasteryStatusSchema = z.enum([
  "not_started",
  "weak",
  "learning",
  "practicing",
  "mastered",
]);
export type MasteryStatus = z.infer<typeof MasteryStatusSchema>;

export const ScheduleStatusSchema = z.enum(["pending", "due", "completed", "cancelled"]);
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;

export const SchedulePrioritySchema = z.enum(["high", "medium", "low"]);
export type SchedulePriority = z.infer<typeof SchedulePrioritySchema>;

export const SessionTypeSchema = z.enum(["daily", "weak_concepts", "exam_prep", "free"]);
export type SessionType = z.infer<typeof SessionTypeSchema>;

/** Sources that may feed learning events into the revision pipeline (Section 6). */
export const LearningEventSourceSchema = z.enum([
  "lesson_completion",
  "understanding_check",
  "practice",
  "homework",
  "exam_prep",
]);
export type LearningEventSource = z.infer<typeof LearningEventSourceSchema>;

export const RevisionEventTypeSchema = z.enum([
  "lesson_completed",
  "understanding_check_answered",
  "practice_answered",
  "homework_assessed",
  "exam_prep_assessed",
  "revision_attempt",
  "revision_session_started",
  "revision_session_completed",
  "concept_viewed",
]);
export type RevisionEventType = z.infer<typeof RevisionEventTypeSchema>;

/* 1. studentConceptMastery */
export interface StudentConceptMastery {
  studentId: string;
  subjectId: string;
  classLevel: number;
  chapterId: string;
  conceptId: string;
  /** 0..1. Server-computed only; never accepted from the client. */
  masteryScore: number;
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  masteryStatus: MasteryStatus;
  createdAt: string;
  updatedAt: string;
}

/* 2. revisionSchedules (plus an internal stable `id`: studentId+conceptId) */
export interface RevisionSchedule {
  id: string;
  studentId: string;
  conceptId: string;
  scheduledAt: string;
  reviewIntervalDays: number;
  priority: SchedulePriority;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

/* 3. revisionAttempts (plus server-issued `id`) */
export interface RevisionAttempt {
  id: string;
  studentId: string;
  conceptId: string;
  questionId: string | null;
  studentAnswer: string | null;
  isCorrect: boolean;
  /** 1..3, aligned with lesson difficulty. Null when the source has none. */
  difficulty: number | null;
  responseTimeMs: number | null;
  sessionId: string | null;
  source: LearningEventSource | "revision";
  attemptedAt: string;
}

/* 4. revisionSessions */
export interface RevisionSession {
  studentId: string;
  sessionId: string;
  sessionType: SessionType;
  conceptsReviewed: string[];
  totalQuestions: number;
  correctAnswers: number;
  startedAt: string;
  completedAt: string | null;
}

/* 5. revisionEvents */
export interface RevisionEvent {
  id: string;
  studentId: string;
  eventType: RevisionEventType;
  conceptId: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/* Revision content metadata (Section 3D). Content itself is generated in a
 * later part via the Meta-only client; here only the metadata contract. */
export interface RevisionContentMeta {
  conceptId: string;
  explanation: { title: string; source: "meta" | "offline" | "curated"; language: "en" | "bn" } | null;
  flashcards: { id: string; front: string; back: string }[];
  quizQuestionIds: string[];
}

/* ---- API inputs. Note: no masteryScore / status fields anywhere. ---- */
export const RecordAttemptInputSchema = z.object({
  conceptId: z.string().min(1).max(200),
  questionId: z.string().min(1).max(200).optional(),
  studentAnswer: z.string().max(2000).optional(),
  isCorrect: z.boolean(),
  difficulty: z.number().int().min(1).max(3).optional(),
  responseTimeMs: z.number().int().min(0).max(3_600_000).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  source: z.enum(["lesson_completion", "understanding_check", "practice", "homework", "exam_prep", "revision"]).default("revision"),
});
export type RecordAttemptInput = z.infer<typeof RecordAttemptInputSchema>;

export const RecordEventInputSchema = z.object({
  eventType: RevisionEventTypeSchema,
  conceptId: z.string().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type RecordEventInput = z.infer<typeof RecordEventInputSchema>;

export const StartSessionInputSchema = z.object({
  sessionType: SessionTypeSchema.default("daily"),
});
export type StartSessionInput = z.infer<typeof StartSessionInputSchema>;

export const CompleteSessionInputSchema = z.object({
  action: z.literal("complete"),
  sessionId: z.string().min(1).max(200),
});
export type CompleteSessionInput = z.infer<typeof CompleteSessionInputSchema>;

/** Unified learning-event envelope accepted by the event pipeline. */
export const LearningEventSchema = z.object({
  source: LearningEventSourceSchema,
  conceptId: z.string().min(1).max(200),
  questionId: z.string().min(1).max(200).optional(),
  studentAnswer: z.string().max(2000).optional(),
  isCorrect: z.boolean().optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  responseTimeMs: z.number().int().min(0).max(3_600_000).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  occurredAt: z.string().optional(),
});
export type LearningEvent = z.infer<typeof LearningEventSchema>;

/** Thrown by repositories when an idempotent attempt write already exists. */
export class DuplicateAttemptError extends Error {
  constructor(readonly attemptId: string) {
    super(`Duplicate attempt: ${attemptId}`);
    this.name = "DuplicateAttemptError";
  }
}

export class RevisionError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RevisionError";
  }
}