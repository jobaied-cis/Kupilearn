import { REVISION_CONFIG } from "./config";
import type { MasteryStatus, RevisionSchedule, SchedulePriority } from "./types";

/**
 * Daily revision workload planning (Part 05).
 *
 * A pure, read-only derivation over Part 04 schedules: it never writes,
 * never reschedules stored records, and never drops a due concept. The
 * "roll-forward" of overdue work is virtual - overdue items are folded
 * into today's allocation at read time; their stored `scheduledAt` only
 * changes when the student actually attempts the concept (Part 04 rule).
 *
 * Day boundaries use the student's school day: Asia/Dhaka is UTC+6
 * year-round with no DST, so a fixed offset (config) gives exact,
 * testable date math on UTC ISO timestamps - no locale/ICU dependence.
 */

const DAY_MS = 86_400_000;

function shifted(instant: Date): Date {
  return new Date(instant.getTime() + REVISION_CONFIG.planning.dayBoundaryOffsetMinutes * 60_000);
}

/** "YYYY-MM-DD" of an instant in Asia/Dhaka. */
export function dhakaDateString(instant: Date): string {
  const d = shifted(instant);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole Dhaka days from `dateA` to `dateB` (both "YYYY-MM-DD"). */
export function dhakaDayDiff(dateA: string, dateB: string): number {
  const toUtc = (s: string) => Date.parse(`${s}T00:00:00.000Z`);
  return Math.round((toUtc(dateB) - toUtc(dateA)) / DAY_MS);
}

export function addDhakaDays(date: string, days: number): string {
  return dhakaDateString(new Date(Date.parse(`${date}T12:00:00.000Z`) + days * DAY_MS - REVISION_CONFIG.planning.dayBoundaryOffsetMinutes * 60_000));
}

export interface PlanningCandidate {
  schedule: RevisionSchedule;
  masteryStatus: MasteryStatus | null;
  masteryScore: number | null;
}

export interface PlannedItem {
  conceptId: string;
  scheduledAt: string;
  /** Dhaka date this item is planned for, or null when carried beyond the window. */
  plannedDate: string | null;
  /** Whole days overdue at planning time (0 = due today, negative = future). */
  overdueDays: number;
  priority: SchedulePriority;
  masteryStatus: MasteryStatus | null;
  masteryScore: number | null;
}

export interface PlannedDay {
  date: string;
  items: PlannedItem[];
}

export interface DailyPlanResult {
  /** Dhaka date the plan starts (today for the student). */
  startDate: string;
  days: PlannedDay[];
  /** Due/overdue items that did not fit the window. Carried, never dropped. */
  carriedForward: PlannedItem[];
  /** Items not yet due within the window (still scheduled for later). */
  futureCount: number;
  /** Every due-or-overdue item accounted for: allocated + carriedForward. */
  totalDue: number;
}

const PRIORITY_RANK: Record<SchedulePriority, number> = { high: 0, medium: 1, low: 2 };
const STATUS_RANK: Record<string, number> = { weak: 0, learning: 1, practicing: 2, not_started: 2, mastered: 3 };

/**
 * Fair allocation order: most overdue first, then higher priority, then
 * weaker concepts before mastered ones, then earliest due, then id -
 * fully deterministic for identical inputs.
 */
export function comparePlanningOrder(a: PlannedItem, b: PlannedItem): number {
  if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays;
  if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  const sa = STATUS_RANK[a.masteryStatus ?? "practicing"] ?? 2;
  const sb = STATUS_RANK[b.masteryStatus ?? "practicing"] ?? 2;
  if (sa !== sb) return sa - sb;
  if (a.scheduledAt !== b.scheduledAt) return a.scheduledAt < b.scheduledAt ? -1 : 1;
  return a.conceptId < b.conceptId ? -1 : a.conceptId > b.conceptId ? 1 : 0;
}

export function buildDailyPlan(
  candidates: PlanningCandidate[],
  now: Date,
  options: { dailyLimit?: number; windowDays?: number } = {},
): DailyPlanResult {
  const dailyLimit = Math.max(1, options.dailyLimit ?? REVISION_CONFIG.planning.dailyConceptLimit);
  const windowDays = Math.max(1, options.windowDays ?? REVISION_CONFIG.planning.planningWindowDays);
  const startDate = dhakaDateString(now);

  const items: PlannedItem[] = candidates
    .filter((c) => c.schedule.status !== "completed" && c.schedule.status !== "cancelled")
    .map((c) => ({
      conceptId: c.schedule.conceptId,
      scheduledAt: c.schedule.scheduledAt,
      plannedDate: null,
      overdueDays: dhakaDayDiff(dhakaDateString(new Date(c.schedule.scheduledAt)), startDate),
      priority: c.schedule.priority,
      masteryStatus: c.masteryStatus,
      masteryScore: c.masteryScore,
    }))
    .sort(comparePlanningOrder);

  const lastDate = addDhakaDays(startDate, windowDays - 1);
  const dueItems = items.filter((i) => i.overdueDays >= 0);

  const days: PlannedDay[] = [];
  const remaining = [...items];
  for (let d = 0; d < windowDays; d += 1) {
    const date = addDhakaDays(startDate, d);
    const allocated: PlannedItem[] = [];
    const stillWaiting: PlannedItem[] = [];
    for (const item of remaining) {
      const itemDueDate = dhakaDateString(new Date(item.scheduledAt));
      // Never allocated before its due date; otherwise fair order + cap.
      if (itemDueDate > date || allocated.length >= dailyLimit) {
        stillWaiting.push(item);
      } else {
        allocated.push({ ...item, plannedDate: date });
      }
    }
    remaining.length = 0;
    remaining.push(...stillWaiting);
    days.push({ date, items: allocated });
  }

  // Due work that did not fit the window is carried forward explicitly -
  // the caller shows it and tomorrow's plan allocates it. Items due only
  // after the window are not carried; they are simply future work.
  const carriedForward = remaining.filter((i) => dhakaDateString(new Date(i.scheduledAt)) <= lastDate);
  const futureCount = remaining.length - carriedForward.length;

  return { startDate, days, carriedForward, futureCount, totalDue: dueItems.length };
}
