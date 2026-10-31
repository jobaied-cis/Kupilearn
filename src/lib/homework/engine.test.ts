import { describe, expect, it } from "vitest";
import {
  HomeworkAssignmentSchema,
  WEEKLY_GOAL_POINTS,
  completionStats,
  dueAtForBucket,
  dueSoonCount,
  generateHomeworkFromTopic,
  generateReviewHomework,
  isOverdue,
  markDone,
  migrateLegacyDoneFlags,
  nextOccurrence,
  overdueCount,
  pointsFor,
  pointsThisWeek,
  sortForDisplay,
  starterAssignments,
  taskProgress,
  toBnDigits,
  toggleTask,
  totalPoints,
} from "./engine";

const NOW = new Date("2026-08-04T10:00:00"); // a Tuesday

describe("homework due buckets", () => {
  it("resolves tonight/tomorrow/friday to end-of-day dates", () => {
    const tonight = dueAtForBucket("tonight", NOW);
    expect(tonight.getDate()).toBe(4);
    expect(tonight.getHours()).toBe(23);

    const tomorrow = dueAtForBucket("tomorrow", NOW);
    expect(tomorrow.getDate()).toBe(5);

    const friday = dueAtForBucket("friday", NOW); // Tue 4 Aug 2026 → Fri 7 Aug
    expect(friday.getDay()).toBe(5);
    expect(friday.getDate()).toBe(7);

    const onFriday = dueAtForBucket("friday", new Date("2026-08-07T09:00:00"));
    expect(onFriday.getDate()).toBe(7); // due that same Friday night
  });

  it("flags overdue only for unfinished past-due work", () => {
    const past = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-equations", dueBucket: "tonight", source: "custom", now: new Date("2026-08-01T10:00:00") });
    expect(isOverdue(past, NOW)).toBe(true);
    expect(isOverdue(markDone(past, true, NOW), NOW)).toBe(false);
    const future = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-equations", dueBucket: "tomorrow", source: "custom", now: NOW });
    expect(isOverdue(future, NOW)).toBe(false);
  });
});

describe("homework generation", () => {
  it("generates topic-grounded assignments with bilingual text", () => {
    const hw = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-equations", dueBucket: "tonight", source: "lesson", now: NOW });
    expect(hw.topicTitle).toBe("Solving Simple Equations");
    expect(hw.subjectTitle).toBe("Mathematics");
    expect(hw.instructions).toMatch(/Solve: \d+x [+\u2212] \d+ = -?\d+, \d+x [+\u2212] \d+ = -?\d+/);
    expect(hw.instructionsBn).toContain("সমাধান করো");
    expect(hw.status).toBe("assigned");
    expect(hw.source).toBe("lesson");
  });

  it("falls back to key-term writing for non-math topics", () => {
    const hw = generateHomeworkFromTopic({ classLevel: 6, topicId: "sci-plants", dueBucket: "friday", source: "custom", now: NOW });
    expect(hw.instructions).toContain("photosynthesis");
    expect(hw.dueBucket).toBe("friday");
  });

  it("rejects unknown topics", () => {
    expect(() =>
      generateHomeworkFromTopic({ classLevel: 6, topicId: "nope", dueBucket: "tonight", source: "custom", now: NOW }),
    ).toThrow(/No topic nope/);
  });

  it("seeds the three starter assignments (equations, English, plant cell)", () => {
    const starters = starterAssignments(NOW);
    expect(starters).toHaveLength(3);
    expect(starters.map((s) => s.dueBucket)).toEqual(["tonight", "tomorrow", "friday"]);
    expect(starters[2]!.title).toBe("Draw and label a plant cell");
    expect(starters.every((s) => s.status === "assigned")).toBe(true);
    expect(toBnDigits(12)).toBe("১২");
  });

  it("migrates legacy done flags without inventing completions", () => {
    const migrated = migrateLegacyDoneFlags(starterAssignments(NOW), [true, false], NOW);
    expect(migrated[0]!.status).toBe("done");
    expect(migrated[0]!.completedAt).toBe(NOW.toISOString());
    expect(migrated[1]!.status).toBe("assigned");
    expect(migrated[2]!.status).toBe("assigned");
  });
});

describe("homework checklists, weekend, and review generation", () => {
  it("resolves the weekend bucket to the coming Saturday", () => {
    const sat = dueAtForBucket("weekend", NOW); // Tue 4 Aug 2026 → Sat 8 Aug
    expect(sat.getDay()).toBe(6);
    expect(sat.getDate()).toBe(8);
    const onSat = dueAtForBucket("weekend", new Date("2026-08-08T09:00:00"));
    expect(onSat.getDate()).toBe(8);
  });

  it("generates tickable sub-tasks with an effort estimate", () => {
    const hw = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-equations", dueBucket: "tonight", source: "lesson", now: NOW });
    expect(hw.tasks.length).toBeGreaterThanOrEqual(3);
    expect(hw.tasks.every((t) => t.text.length > 0 && t.textBn.length > 0 && t.done === false)).toBe(true);
    expect(hw.estMinutes).toBeGreaterThan(0);
    expect(taskProgress(hw)).toEqual({ done: 0, total: hw.tasks.length });
  });

  it("derives completion from the checklist and syncs manual done", () => {
    let hw = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-factors", dueBucket: "tonight", source: "custom", now: NOW });
    for (let i = 0; i < hw.tasks.length; i += 1) hw = toggleTask(hw, i, NOW);
    expect(hw.status).toBe("done");
    expect(hw.completedAt).toBe(NOW.toISOString());
    expect(taskProgress(hw).done).toBe(hw.tasks.length);

    hw = toggleTask(hw, 0, NOW);
    expect(hw.status).toBe("assigned");
    expect(hw.completedAt).toBeNull();

    const manual = markDone(hw, true, NOW);
    expect(manual.tasks.every((t) => t.done)).toBe(true);
    expect(markDone(manual, false, NOW).tasks.every((t) => !t.done)).toBe(true);
  });

  it("creates review homework from mistake topics, or nothing", () => {
    const review = generateReviewHomework(6, ["c6-math-equations"], NOW);
    expect(review).not.toBeNull();
    expect(review!.source).toBe("practice");
    expect(review!.topicTitle).toBe("Solving Simple Equations");
    expect(review!.dueBucket).toBe("tomorrow");
    expect(review!.tasks.length).toBe(3);
    expect(generateReviewHomework(6, ["nope", "also-nope"], NOW)).toBeNull();
    expect(generateReviewHomework(6, [], NOW)).toBeNull();
  });

  it("keeps assignments stored before checklists parseable", () => {
    const legacyShape = {
      id: "hw-old",
      title: "Solve: 2x − 1 = 5",
      titleBn: "সমাধান করো: 2x − 1 = 5",
      subjectId: "math",
      subjectTitle: "Mathematics",
      topicId: "c6-math-equations",
      topicTitle: "Solving Simple Equations",
      instructions: "Solve: 2x − 1 = 5",
      instructionsBn: "সমাধান করো: 2x − 1 = 5",
      source: "starter",
      dueBucket: "tonight",
      dueAt: NOW.toISOString(),
      status: "assigned",
      createdAt: NOW.toISOString(),
      completedAt: null,
    };
    const parsed = HomeworkAssignmentSchema.parse(legacyShape);
    expect(parsed.tasks).toEqual([]);
    expect(parsed.estMinutes).toBe(10);
  });
});

describe("homework recurrence, points, and richer tasks", () => {
  it("spawns the next occurrence only for completed recurring work", () => {
    const daily = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-area", dueBucket: "tonight", source: "custom", now: NOW, recurrence: "daily" });
    expect(nextOccurrence(daily, NOW)).toBeNull(); // not done yet
    const doneDaily = markDone(daily, true, NOW);
    const next = nextOccurrence(doneDaily, NOW);
    expect(next).not.toBeNull();
    expect(next!.status).toBe("assigned");
    expect(next!.tasks.every((t) => !t.done)).toBe(true);
    expect(new Date(next!.dueAt).getDate()).toBe(new Date(doneDaily.dueAt).getDate() + 1);
    expect(next!.id).not.toBe(daily.id);

    const weekly = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-area", dueBucket: "tonight", source: "custom", now: NOW, recurrence: "weekly" });
    const nextWeek = nextOccurrence(markDone(weekly, true, NOW), NOW)!;
    expect(Math.round((+new Date(nextWeek.dueAt) - +new Date(weekly.dueAt)) / 86400000)).toBe(7);

    const once = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-area", dueBucket: "tonight", source: "custom", now: NOW });
    expect(nextOccurrence(markDone(once, true, NOW), NOW)).toBeNull();
  });

  it("awards points per ticked step and tracks the weekly goal", () => {
    let hw = generateHomeworkFromTopic({ classLevel: 6, topicId: "sci-plants", dueBucket: "tonight", source: "custom", now: NOW });
    expect(pointsFor(hw)).toBe(0);
    hw = toggleTask(hw, 0, NOW);
    expect(pointsFor(hw)).toBe(5);
    for (let i = 1; i < hw.tasks.length; i += 1) hw = toggleTask(hw, i, NOW);
    expect(pointsFor(hw)).toBe(hw.tasks.length * 5);
    expect(totalPoints([hw])).toBe(pointsFor(hw));
    expect(pointsThisWeek([hw], NOW)).toBe(pointsFor(hw)); // completed today
    expect(pointsThisWeek([hw], new Date("2026-09-01T10:00:00"))).toBe(0); // another week
    expect(WEEKLY_GOAL_POINTS).toBeGreaterThan(0);

    const overdue = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-factors", dueBucket: "tonight", source: "custom", now: new Date("2026-08-01T10:00:00") });
    expect(overdueCount([hw, overdue], NOW)).toBe(1);
  });

  it("writes richer, topic-specific tasks for non-math subjects", () => {
    for (const topicId of ["sci-plants", "sci-animals", "sci-light", "en-tense", "en-speech", "bn-parts", "bgs-liberation", "ict-parts", "ict-safety"]) {
      const hw = generateHomeworkFromTopic({ classLevel: 6, topicId, dueBucket: "tomorrow", source: "custom", now: NOW });
      expect(hw.tasks.length).toBeGreaterThanOrEqual(3);
      expect(hw.tasks.every((t) => t.text.length > 5 && t.textBn.length > 5)).toBe(true);
      // Richer than the generic key-term fallback:
      expect(hw.tasks.some((t) => /Draw|diagram|timeline|password|label/i.test(t.text) || /লেখো|আঁকো/.test(t.textBn))).toBe(true);
    }
  });

  it("defaults recurrence to none for previously stored shapes", () => {
    const parsed = HomeworkAssignmentSchema.parse({
      id: "hw-x", title: "T", titleBn: "T", subjectId: "math", subjectTitle: "Mathematics",
      topicId: "c6-math-area", topicTitle: "Area", instructions: "Do it", instructionsBn: "করো",
      source: "custom", dueBucket: "tonight", dueAt: NOW.toISOString(), status: "assigned",
      createdAt: NOW.toISOString(), completedAt: null,
    });
    expect(parsed.recurrence).toBe("none");
    expect(parsed.tasks).toEqual([]);
  });
});

describe("homework aggregates", () => {
  it("counts due-soon pending work and sorts overdue first, done last", () => {
    const overdue = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-factors", dueBucket: "tonight", source: "custom", now: new Date("2026-08-01T10:00:00") });
    const tonight = generateHomeworkFromTopic({ classLevel: 6, topicId: "math-area", dueBucket: "tonight", source: "custom", now: NOW });
    const friday = generateHomeworkFromTopic({ classLevel: 6, topicId: "sci-plants", dueBucket: "friday", source: "custom", now: NOW });
    const doneOne = markDone(tonight, true, NOW);
    const list = [friday, doneOne, tonight, overdue];

    expect(dueSoonCount(list, NOW)).toBe(2); // overdue (pending) + tonight; friday excluded, done excluded
    expect(completionStats(list)).toEqual({ done: 1, total: 4, rate: 25 });

    const sorted = sortForDisplay(list, NOW);
    expect(sorted[0]!.id).toBe(overdue.id);
    expect(sorted[sorted.length - 1]!.status).toBe("done");
  });
});
