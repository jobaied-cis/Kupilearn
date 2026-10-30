import type { RevisionService } from "./service";
import {
  LearningEventSchema,
  RevisionError,
  type LearningEvent,
  type LearningEventSource,
  type RevisionEventType,
} from "./types";

/**
 * Integration interfaces (Section 6). Existing engines emit a LearningEvent;
 * this module is the only translation point into revision attempts/events.
 * Lesson functionality is untouched - producers call `processLearningEvent`
 * (server) or POST /api/revision/attempts (client, fire-and-forget).
 */
export const SOURCE_TO_EVENT_TYPE: Record<LearningEventSource, RevisionEventType> = {
  lesson_completion: "lesson_completed",
  understanding_check: "understanding_check_answered",
  practice: "practice_answered",
  homework: "homework_assessed",
  exam_prep: "exam_prep_assessed",
};

/**
 * An event carrying `isCorrect` becomes a scored attempt (mastery +
 * schedule update); an event without it is recorded as history only.
 */
export async function processLearningEvent(service: RevisionService, studentId: string, raw: unknown) {
  const parsed = LearningEventSchema.safeParse(raw);
  if (!parsed.success) throw new RevisionError("INVALID_LEARNING_EVENT", 400, parsed.error.message);
  const event: LearningEvent = parsed.data;
  if (event.isCorrect !== undefined) {
    return service.recordAttempt(studentId, {
      conceptId: event.conceptId,
      questionId: event.questionId,
      studentAnswer: event.studentAnswer,
      isCorrect: event.isCorrect,
      difficulty: event.difficulty,
      responseTimeMs: event.responseTimeMs,
      sessionId: event.sessionId,
      source: event.source,
    });
  }
  return service.recordEvent(studentId, {
    eventType: SOURCE_TO_EVENT_TYPE[event.source],
    conceptId: event.conceptId,
    metadata: { source: event.source, occurredAt: event.occurredAt ?? null },
  });
}