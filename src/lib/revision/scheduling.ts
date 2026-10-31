import { REVISION_CONFIG } from "./config";
import { isWeak } from "./mastery";
import type { MasteryStatus, RevisionSchedule, SchedulePriority } from "./types";

/**
 * Adaptive revision scheduling (Part 04), replacing the fixed Part 01
 * ladder decision behind the same `nextReview` entry point.
 *
 * Base scale is still the 1/3/7/14/30-day ladder indexed by the correct
 * streak. Adaptations, all deterministic and config-driven:
 * - failed attempt: reset to the minimum interval (config min, 1 day);
 * - weak concept (Part 03 status): capped at weakMaxIntervalDays, so a
 *   struggling concept returns quickly whatever the streak says;
 * - mastered concept: extended to at least masteredMinIntervalDays and
 *   grown by masteredExtensionMultiplier off the ladder base, so strong
 *   concepts stop crowding out weaker ones;
 * - every result is clamped to [minIntervalDays, maxIntervalDays].
 * Priority logic is unchanged from Part 01. Early reviews reschedule
 * from the attempt time (the caller's `now`), as before.
 */
export interface NextReview {
  scheduledAt: string;
  reviewIntervalDays: number;
  priority: SchedulePriority;
}

export interface SchedulingInput {
  isCorrect: boolean;
  consecutiveCorrectAfterAttempt: number;
  masteryScore: number;
  masteryStatus: MasteryStatus;
  totalAttempts: number;
  consecutiveIncorrect: number;
}

const clampInterval = (days: number): number =>
  Math.min(REVISION_CONFIG.scheduling.maxIntervalDays, Math.max(REVISION_CONFIG.scheduling.minIntervalDays, days));

export function reviewIntervalDays(
  consecutiveCorrectAfterAttempt: number,
  isCorrect: boolean,
  masteryStatus: MasteryStatus = "learning",
): number {
  const { minIntervalDays, weakMaxIntervalDays, masteredMinIntervalDays, masteredExtensionMultiplier } = REVISION_CONFIG.scheduling;
  if (!isCorrect) return minIntervalDays;
  const ladder = REVISION_CONFIG.reviewIntervalsDays;
  const idx = Math.min(Math.max(consecutiveCorrectAfterAttempt - 1, 0), ladder.length - 1);
  const base = ladder[idx] as number;
  if (masteryStatus === "weak") return clampInterval(Math.min(base, weakMaxIntervalDays));
  if (masteryStatus === "mastered") {
    return clampInterval(Math.max(masteredMinIntervalDays, Math.round(base * masteredExtensionMultiplier)));
  }
  return clampInterval(base);
}

export function priorityFor(input: { isCorrect: boolean; masteryScore: number; masteryStatus?: MasteryStatus; totalAttempts: number; consecutiveIncorrect: number }): SchedulePriority {
  if (!input.isCorrect || input.masteryStatus === "weak" || isWeak(input)) return "high";
  if (input.masteryScore >= REVISION_CONFIG.masteredThreshold) return "low";
  return "medium";
}

export function nextReview(now: Date, input: SchedulingInput): NextReview {
  const days = reviewIntervalDays(input.consecutiveCorrectAfterAttempt, input.isCorrect, input.masteryStatus);
  const scheduled = new Date(now.getTime() + days * 86_400_000);
  return { scheduledAt: scheduled.toISOString(), reviewIntervalDays: days, priority: priorityFor(input) };
}

/** Urgency ordering for upcoming lists: overdue first, then priority, then earliest due. */
export function compareScheduleUrgency(a: RevisionSchedule, b: RevisionSchedule, now: Date): number {
  const aDue = isDue(a, now) ? 0 : 1;
  const bDue = isDue(b, now) ? 0 : 1;
  if (aDue !== bDue) return aDue - bDue;
  const rank: Record<SchedulePriority, number> = { high: 0, medium: 1, low: 2 };
  if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
  return a.scheduledAt < b.scheduledAt ? -1 : a.scheduledAt > b.scheduledAt ? 1 : 0;
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
