import { describe, expect, it } from "vitest";
import { addDhakaDays, buildDailyPlan, dhakaDateString, dhakaDayDiff, type PlanningCandidate } from "../planning";
import type { MasteryStatus, RevisionSchedule, SchedulePriority } from "../types";

// 2026-01-15T04:00:00Z is 10:00 in Dhaka on 2026-01-15.
const NOW = new Date("2026-01-15T04:00:00.000Z");
const at = (isoDayOffset: number, hourUtc = 4) => new Date(NOW.getTime() + isoDayOffset * 86_400_000 + (hourUtc - 4) * 3_600_000).toISOString();

let seq = 0;
function candidate(over: { daysFromNow?: number; priority?: SchedulePriority; status?: MasteryStatus | null; conceptId?: string } = {}): PlanningCandidate {
  seq += 1;
  const conceptId = over.conceptId ?? `c-${seq}`;
  const schedule: RevisionSchedule = {
    id: `sched:stu:${conceptId}`,
    studentId: "stu",
    conceptId,
    scheduledAt: at(over.daysFromNow ?? 0),
    reviewIntervalDays: 1,
    priority: over.priority ?? "medium",
    status: "pending",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
  return { schedule, masteryStatus: over.status ?? "practicing", masteryScore: 0.6 };
}

describe("Dhaka day math (Asia/Dhaka, UTC+6)", () => {
  it("maps UTC instants to the correct Dhaka calendar date", () => {
    expect(dhakaDateString(new Date("2026-01-15T04:00:00.000Z"))).toBe("2026-01-15"); // 10:00 Dhaka
    expect(dhakaDateString(new Date("2026-01-15T17:59:59.000Z"))).toBe("2026-01-15"); // 23:59:59 Dhaka
    expect(dhakaDateString(new Date("2026-01-15T18:00:00.000Z"))).toBe("2026-01-16"); // 00:00 Dhaka next day
    expect(dhakaDateString(new Date("2026-01-15T00:30:00.000Z"))).toBe("2026-01-15"); // 06:30 Dhaka
    expect(dhakaDateString(new Date("2026-01-14T18:30:00.000Z"))).toBe("2026-01-15"); // 00:30 Dhaka
  });

  it("day diffs and additions are exact across month boundaries", () => {
    expect(dhakaDayDiff("2026-01-15", "2026-01-15")).toBe(0);
    expect(dhakaDayDiff("2026-01-10", "2026-01-15")).toBe(5);
    expect(dhakaDayDiff("2026-01-15", "2026-01-10")).toBe(-5);
    expect(addDhakaDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDhakaDays("2026-01-15", 3)).toBe("2026-01-18");
  });
});

describe("buildDailyPlan allocation", () => {
  it("returns an empty plan with no candidates", () => {
    const plan = buildDailyPlan([], NOW);
    expect(plan.days).toHaveLength(3);
    expect(plan.days.every((d) => d.items.length === 0)).toBe(true);
    expect(plan.totalDue).toBe(0);
    expect(plan.carriedForward).toEqual([]);
  });

  it("enforces the daily cap and carries the overflow forward - nothing dropped", () => {
    const candidates = Array.from({ length: 12 }, () => candidate({ daysFromNow: 0 }));
    const plan = buildDailyPlan(candidates, NOW, { dailyLimit: 8, windowDays: 3 });
    expect(plan.days[0]?.items).toHaveLength(8);
    expect(plan.days[1]?.items).toHaveLength(4);
    expect(plan.carriedForward).toHaveLength(0);
    const allocated = plan.days.flatMap((d) => d.items.map((i) => i.conceptId));
    expect(new Set(allocated).size).toBe(12);
    expect(plan.totalDue).toBe(12);
  });

  it("carries due work beyond the window instead of dropping it", () => {
    const candidates = Array.from({ length: 30 }, () => candidate({ daysFromNow: -1 }));
    const plan = buildDailyPlan(candidates, NOW, { dailyLimit: 8, windowDays: 3 });
    const allocatedCount = plan.days.reduce((n, d) => n + d.items.length, 0);
    expect(allocatedCount).toBe(24);
    expect(plan.carriedForward).toHaveLength(6);
    expect(allocatedCount + plan.carriedForward.length).toBe(plan.totalDue);
  });

  it("gives weak concepts priority over mastered ones when capacity is scarce", () => {
    const mastered = candidate({ daysFromNow: 0, priority: "low", status: "mastered", conceptId: "mastered-1" });
    const weak = candidate({ daysFromNow: 0, priority: "high", status: "weak", conceptId: "weak-1" });
    const plan = buildDailyPlan([mastered, weak], NOW, { dailyLimit: 1, windowDays: 3 });
    expect(plan.days[0]?.items[0]?.conceptId).toBe("weak-1");
    expect(plan.days[1]?.items[0]?.conceptId).toBe("mastered-1");
  });

  it("most overdue wins over fresher due work", () => {
    const fresh = candidate({ daysFromNow: 0, priority: "high", conceptId: "fresh" });
    const ancient = candidate({ daysFromNow: -10, priority: "low", status: "mastered", conceptId: "ancient" });
    const plan = buildDailyPlan([fresh, ancient], NOW, { dailyLimit: 1, windowDays: 3 });
    expect(plan.days[0]?.items[0]?.conceptId).toBe("ancient");
    expect(plan.days[0]?.items[0]?.overdueDays).toBe(10);
  });

  it("never allocates an item before its due date, and counts later work as future", () => {
    const future = candidate({ daysFromNow: 5, conceptId: "future-1" });
    const plan = buildDailyPlan([future], NOW, { dailyLimit: 8, windowDays: 3 });
    expect(plan.days.flatMap((d) => d.items)).toHaveLength(0);
    expect(plan.futureCount).toBe(1);
    expect(plan.carriedForward).toHaveLength(0);
    // Due inside the window: allocated exactly on its due day.
    const soon = candidate({ daysFromNow: 2, conceptId: "soon-1" });
    const plan2 = buildDailyPlan([soon], NOW, { dailyLimit: 8, windowDays: 3 });
    expect(plan2.days[0]?.items).toHaveLength(0);
    expect(plan2.days[2]?.items[0]?.conceptId).toBe("soon-1");
    expect(plan2.days[2]?.items[0]?.plannedDate).toBe(addDhakaDays(plan2.startDate, 2));
  });

  it("ignores completed and cancelled schedules", () => {
    const done = candidate({ conceptId: "done-1" });
    done.schedule.status = "completed";
    const plan = buildDailyPlan([done], NOW);
    expect(plan.totalDue).toBe(0);
    expect(plan.futureCount).toBe(0);
  });

  it("is deterministic for identical inputs", () => {
    const candidates = [candidate({ daysFromNow: -3, priority: "low" }), candidate({ daysFromNow: 0, priority: "high", status: "weak" }), candidate({ daysFromNow: -3, priority: "high" })];
    expect(buildDailyPlan(candidates, NOW)).toEqual(buildDailyPlan(candidates, NOW));
  });
});
