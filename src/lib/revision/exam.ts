import { REVISION_CONFIG } from "./config";
import { buildQuizQueue, compareQuizConcepts, type QuizConceptInput, type QuizQueueItem } from "./quiz";

/**
 * Exam preparation selection (Part 09).
 *
 * Pure and deterministic. An exam-prep session mixes concepts the
 * student has actually attempted - weak first, then due/overdue, then
 * practicing/learning, mastered last - interleaved round-robin over
 * EXISTING lesson questions. It invents no exam dates, syllabus
 * weights, readiness scores, or questions.
 */

export type ExamPrepSource = "weak" | "due" | "practicing" | "none";

/** Ranked exam-prep concepts: weakest first, mastered last (stable). */
export function rankExamConcepts(concepts: QuizConceptInput[]): QuizConceptInput[] {
  return [...concepts].sort(compareQuizConcepts);
}

/**
 * Honest label for where an exam-prep queue came from. `none` means
 * the student has attempted nothing yet - the caller must show an
 * empty state rather than fabricate a queue.
 */
export function examPrepSource(concepts: QuizConceptInput[]): ExamPrepSource {
  if (concepts.length === 0) return "none";
  if (concepts.some((c) => c.masteryStatus === "weak")) return "weak";
  if (concepts.some((c) => c.overdueDays > 0)) return "due";
  return "practicing";
}

/** Interleaved exam-prep queue under the Part 09 session budget. */
export function buildExamQueue(concepts: QuizConceptInput[]): QuizQueueItem[] {
  return buildQuizQueue(concepts, {
    perConcept: REVISION_CONFIG.examPrep.questionsPerConcept,
    total: REVISION_CONFIG.examPrep.maxQuestionsPerSession,
  });
}
