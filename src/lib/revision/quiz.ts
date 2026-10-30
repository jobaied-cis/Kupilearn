import { REVISION_CONFIG } from "./config";
import type { MasteryStatus } from "./types";

/**
 * Targeted weak-concept quiz selection (Part 07).
 *
 * Pure and deterministic. It selects and sequences EXISTING lesson
 * questions only - it never generates questions or content. Targeting
 * means: weakest concepts first, questions interleaved round-robin so
 * the quiz feels mixed, per-concept and total caps from the Part 06
 * session budget, and questions the student recently answered correctly
 * are de-prioritized while any alternative exists.
 */

export interface QuizConceptInput {
  conceptId: string;
  topicId: string;
  classLevel: number;
  masteryStatus: MasteryStatus | null;
  masteryScore: number | null;
  /** Whole days overdue (negative = not yet due). */
  overdueDays: number;
  /** How many lesson questions this concept actually has. */
  questionCount: number;
  /** Question indexes (within the concept's lesson) recently answered correctly. */
  recentlyCorrectIndexes: number[];
}

export interface QuizQueueItem {
  conceptId: string;
  questionIndex: number;
}

const STATUS_RANK: Record<string, number> = { weak: 0, learning: 1, practicing: 2, not_started: 2, mastered: 3 };

/** Weak first, then lowest score, then most overdue, then id (stable). */
export function compareQuizConcepts(a: QuizConceptInput, b: QuizConceptInput): number {
  const sa = STATUS_RANK[a.masteryStatus ?? "practicing"] ?? 2;
  const sb = STATUS_RANK[b.masteryStatus ?? "practicing"] ?? 2;
  if (sa !== sb) return sa - sb;
  const scoreA = a.masteryScore ?? 0.5;
  const scoreB = b.masteryScore ?? 0.5;
  if (scoreA !== scoreB) return scoreA - scoreB;
  if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays;
  return a.conceptId < b.conceptId ? -1 : a.conceptId > b.conceptId ? 1 : 0;
}

/**
 * Per-concept question order: never-recently-correct first (original
 * order), then - only if nothing else exists - the recently correct
 * ones, oldest-proven first is unknowable here, so registry order.
 */
export function orderQuestionIndexes(concept: QuizConceptInput): number[] {
  const all = Array.from({ length: Math.max(0, concept.questionCount) }, (_, i) => i);
  const recent = new Set(concept.recentlyCorrectIndexes);
  const fresh = all.filter((i) => !recent.has(i));
  const proven = all.filter((i) => recent.has(i));
  return [...fresh, ...proven].slice(0, REVISION_CONFIG.session.questionsPerConcept);
}

/**
 * Builds the interleaved quiz queue: round-robin across ranked concepts
 * (A1 B1 C1 A2 B2 ...), capped per concept and in total. Concepts with
 * no questions contribute nothing. Empty input -> empty queue.
 */
export function buildQuizQueue(concepts: QuizConceptInput[]): QuizQueueItem[] {
  const ranked = [...concepts].sort(compareQuizConcepts);
  const perConcept = ranked.map((c) => orderQuestionIndexes(c));
  const queue: QuizQueueItem[] = [];
  const maxRounds = Math.max(0, ...perConcept.map((q) => q.length));
  for (let round = 0; round < maxRounds; round += 1) {
    for (let c = 0; c < ranked.length; c += 1) {
      const questionIndex = perConcept[c]?.[round];
      if (questionIndex === undefined) continue;
      queue.push({ conceptId: ranked[c]!.conceptId, questionIndex });
      if (queue.length >= REVISION_CONFIG.session.maxQuestionsPerSession) return queue;
    }
  }
  return queue;
}
