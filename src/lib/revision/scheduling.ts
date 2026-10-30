import { REVISION_CONFIG } from "./config";
import { isWeak } from "./mastery";
import type { RevisionSchedule, SchedulePriority } from "./types";

/**
 * Scheduling foundation (Section 3C). Deterministic interval ladder only;
 * the adaptive algorithm of Part 02 plugs in behind `nextReview`.
 */
export interface NextReview {
  scheduledAt: string;
  reviewIntervalDays: number;
  priority: SchedulePriority;
}

export function reviewIntervalDays(consecutiveCorrectAfterAttempt: number, isCorrect: boolean): number {
  const ladder = REVISION_CONFIG.reviewIntervalsDays;
  if (!isCorrect) return ladder[0] as number;
  const idx = Math.min(Math.max(consecutiveCorrectAfterAttempt - 1, 0), ladder.length - 1);
  return ladder[idx] as number;
}

export function priorityFor(input: { isCorrect: boolean; masteryScore: number; totalAttempts: number; consecutiveIncorrect: number }): SchedulePriority {
  if (!input.isCorrect || isWeak(input)) return "high";
  if (input.masteryScore >= REVISION_CONFIG.masteredThreshold) return "low";
  return "medium";
}

export function nextReview(
  now: Date,
  input: { isCorrect: boolean; consecutiveCorrectAfterAttempt: number; masteryScore: number; totalAttempts: number; consecutiveIncorrect: number },
): NextReview {
  const days = reviewIntervalDays(input.consecutiveCorrectAfterAttempt, input.isCorrect);
  const scheduled = new Date(now.getTime() + days * 86_400_000);
  return { scheduledAt: scheduled.toISOString(), reviewIntervalDays: days, priority: priorityFor(input) };
}

export function createSchedule(
  studentId: string,
  conceptId: string,
  review: NextReview,
  now: Date,
  previous?: RevisionSchedule,
): RevisionSchedule {
  const ts = now.toISOString();
  return {
    id: `sched:${studentId}:${conceptId}`,
    studentId,
    conceptId,
    scheduledAt: review.scheduledAt,
    reviewIntervalDays: review.reviewIntervalDays,
    priority: review.priority,
    status: "pending",
    createdAt: previous?.createdAt ?? ts,
    updatedAt: ts,
  };
}

/** A schedule is due when its time has arrived and it is not closed. */
export function isDue(schedule: RevisionSchedule, now: Date): boolean {
  return schedule.status !== "completed" && schedule.status !== "cancelled" && schedule.scheduledAt <= now.toISOString();
}