import { describe, expect, it } from "vitest";
import { compareScheduleUrgency, nextReview, reviewIntervalDays, type SchedulingInput } from "../scheduling";
import { REVISION_CONFIG } from "../config";
import type { MasteryStatus, RevisionSchedule } from "../types";

const NOW = new Date("2026-01-15T09:00:00.000Z");
const input = (over: Partial<SchedulingInput> = {}): SchedulingInput => ({
  isCorrect: true,
  consecutiveCorrectAfterAttempt: 1,
  masteryScore: 0.667,
  masteryStatus: "practicing",
  totalAttempts: 1,
  consecutiveIncorrect: 0,
  ...over,
});
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe("reviewIntervalDays ladder growth (Part 04 base scale)", () => {
  it("grows with the correct streak on the original ladder", () => {
    expect([1, 2, 3, 4, 5, 6].map((streak) => reviewIntervalDays(streak, true, "practicing"))).toEqual([1, 3, 7, 14, 30, 30]);
  });

  it("is deterministic", () => {
    expect(reviewIntervalDays(3, true, "learning")).toBe(reviewIntervalDays(3, true, "learning"));
  });
});

describe("failure reset", () => {
  it("a failed attempt resets to the minimum interval whatever the streak or status", () => {
    for (const status of ["learning", "practicing", "mastered", "weak"] as MasteryStatus[]) {
      expect(reviewIntervalDays(9, false, status)).toBe(REVISION_CONFIG.scheduling.minIntervalDays);
    }
    const review = nextReview(NOW, input({ isCorrect: false, consecutiveCorrectAfterAttempt: 0, masteryScore: 0.25, masteryStatus: "weak", consecutiveIncorrect: 2 }));
    expect(review.reviewIntervalDays).toBe(1);
    expect(review.scheduledAt).toBe(daysFromNow(1));
    expect(review.priority).toBe("high");
  });
});

describe("weak concepts are shortened", () => {
  it("caps the interval at weakMaxIntervalDays even mid-streak", () => {
    expect(reviewIntervalDays(4, true, "weak")).toBe(REVISION_CONFIG.scheduling.weakMaxIntervalDays);
    expect(reviewIntervalDays(1, true, "weak")).toBe(1);
    const review = nextReview(NOW, input({ masteryStatus: "weak", masteryScore: 0.4, consecutiveCorrectAfterAttempt: 3 }));
    expect(review.reviewIntervalDays).toBeLessThanOrEqual(2);
    expect(review.priority).toBe("high");
  });
});

describe("mastered concepts are extended", () => {
  it("waits at least masteredMinIntervalDays and grows off the ladder", () => {
    expect(reviewIntervalDays(1, true, "mastered")).toBe(REVISION_CONFIG.scheduling.masteredMinIntervalDays);
    expect(reviewIntervalDays(4, true, "mastered")).toBe(21);
    const review = nextReview(NOW, input({ masteryStatus: "mastered", masteryScore: 0.9, consecutiveCorrectAfterAttempt: 4, totalAttempts: 8 }));
    expect(review.priority).toBe("low");
    expect(review.scheduledAt).toBe(daysFromNow(21));
  });

  it("never exceeds the maximum interval cap, and never goes below the minimum", () => {
    expect(reviewIntervalDays(50, true, "mastered")).toBe(REVISION_CONFIG.scheduling.maxIntervalDays);
    expect(reviewIntervalDays(50, true, "practicing")).toBeLessThanOrEqual(REVISION_CONFIG.scheduling.maxIntervalDays);
    expect(reviewIntervalDays(0, true, "learning")).toBeGreaterThanOrEqual(REVISION_CONFIG.scheduling.minIntervalDays);
  });
});

describe("early review rule (preserved from Part 01)", () => {
  it("reschedules from the attempt time, not from the previous due date", () => {
    const early = new Date("2026-01-10T09:00:00.000Z"); // reviewed 5 days before a Jan-15 due date
    const review = nextReview(early, input({ consecutiveCorrectAfterAttempt: 2 }));
    expect(review.scheduledAt).toBe(new Date(early.getTime() + 3 * 86_400_000).toISOString());
  });
});

describe("compareScheduleUrgency (upcoming ordering)", () => {
  const sched = (conceptId: string, scheduledAt: string, priority: RevisionSchedule["priority"]): RevisionSchedule => ({
    id: `sched:stu:${conceptId}`, studentId: "stu", conceptId, scheduledAt, reviewIntervalDays: 1, priority,
    status: "pending", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
  });

  it("orders overdue first, then priority, then earliest due date", () => {
    const items = [
      sched("future-low", daysFromNow(3), "low"),
      sched("overdue-low", daysFromNow(-2), "low"),
      sched("future-high", daysFromNow(1), "high"),
      sched("overdue-high", daysFromNow(-1), "high"),
      sched("overdue-high-earlier", daysFromNow(-5), "high"),
    ];
    const sorted = [...items].sort((a, b) => compareScheduleUrgency(a, b, NOW)).map((s) => s.conceptId);
    expect(sorted).toEqual(["overdue-high-earlier", "overdue-high", "overdue-low", "future-high", "future-low"]);
  });
});
