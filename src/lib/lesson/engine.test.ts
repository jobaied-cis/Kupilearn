import { describe, expect, it } from "vitest";
import { generateLesson, offlineLesson } from "./engine";
import { NCTB_CATALOG, findTopic } from "../nctb/catalog";
import { buildRegistry, TEACHERS, CLASSMATES } from "../classroom/catalog";

describe("NCTB catalog", () => {
  it("covers classes 6-10 with subjects, chapters and topics", () => {
    expect(NCTB_CATALOG.map((c) => c.classLevel)).toEqual([6, 7, 8, 9, 10]);
    for (const cls of NCTB_CATALOG) {
      expect(cls.subjects.length).toBeGreaterThanOrEqual(5);
      for (const s of cls.subjects) {
        expect(s.chapters.length).toBeGreaterThanOrEqual(1);
        for (const ch of s.chapters) expect(ch.topics.length).toBeGreaterThanOrEqual(1);
      }
    }
    expect(findTopic(6, "c6-math-equations")?.topic.title).toContain("Equations");
  });
});

describe("lesson engine", () => {
  it("builds a valid offline lesson with board instructions", () => {
    const lesson = offlineLesson(8, "c8-sci-force");
    expect(lesson.explanations.length).toBeGreaterThanOrEqual(2);
    expect(lesson.explanations[0]!.board.length).toBeGreaterThan(0);
    expect(lesson.questions.length).toBeGreaterThan(0);
  });

  it("reports degraded offline mode when Meta is unconfigured", async () => {
    const result = await generateLesson({ classLevel: 6, topicId: "c6-math-equations" });
    expect(result.degraded).toBe(true);
    expect(result.provider).toBe("offline");
    expect(result.lesson.topic).toContain("Equations");
  });
});

describe("persona catalog", () => {
  it("builds a valid registry with 1 teacher and up to 4 classmates", () => {
    const registry = buildRegistry({
      teacherId: TEACHERS[0]!.id,
      classmateIds: CLASSMATES.slice(0, 4).map((c) => c.id),
      classLevel: 6,
      subject: "Mathematics",
      topicTitle: "Solving Simple Equations",
    });
    expect(registry.agents.filter((a) => a.role === "teacher")).toHaveLength(1);
    expect(registry.agents.filter((a) => a.role === "classmate")).toHaveLength(4);
  });
});
