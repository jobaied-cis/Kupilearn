import { describe, expect, it } from "vitest";
import {
  EngineErrorSchema,
  LessonRequestSchema,
  LessonResponseSchema,
  MicroLessonMessageSchema,
} from "../types";

describe("API contract (§5)", () => {
  it("accepts a valid lesson request and defaults mastery to {}", () => {
    const parsed = LessonRequestSchema.parse({ conceptId: "c1" });
    expect(parsed.learnerMastery).toEqual({});
  });

  it("rejects out-of-range mastery scores", () => {
    expect(() =>
      LessonRequestSchema.parse({ conceptId: "c1", learnerMastery: { c2: 1.5 } }),
    ).toThrow();
  });

  it("accepts a full ready response", () => {
    const res = {
      engine_status: "ready",
      concept_id: "c1",
      curriculum_alignment: { ncert_chapter: "Science VII, Chapter: X (G7-SCI-01)", ncf_competency_code: "SCI-C7-01" },
      prerequisite_audit: { all_met: true, missing_prerequisites: [] },
      lesson_payload: {
        micro_lesson: {
          messages: (["hook", "core", "example", "misconception", "takeaway"] as const).map(
            (type, i) => ({ seq: i + 1, type, text: "ok" }),
          ),
        },
        teaching_script: {
          sections: ["a", "b", "c", "d", "e"].map((t) => ({ title: t, durationMin: 5, body: "ok" })),
        },
      },
      validation: { textbook_similarity_score: 0.89, bloom_level_verified: "apply" },
    };
    expect(LessonResponseSchema.safeParse(res).success).toBe(true);
  });

  it("accepts a remediation response with a null lesson payload", () => {
    const res = {
      engine_status: "remediation_required",
      concept_id: "c1",
      curriculum_alignment: { ncert_chapter: "x", ncf_competency_code: "y" },
      prerequisite_audit: { all_met: false, missing_prerequisites: ["c0"] },
      lesson_payload: null,
      validation: null,
      remediation: { missingPrerequisite: "Modes", bridgeLesson: { paragraphs: ["a", "b", "c"] } },
    };
    expect(LessonResponseSchema.safeParse(res).success).toBe(true);
  });

  it("rejects micro-lesson messages over 160 characters", () => {
    expect(
      MicroLessonMessageSchema.safeParse({ seq: 1, type: "hook", text: "x".repeat(161) }).success,
    ).toBe(false);
  });

  it("accepts the structured error payload", () => {
    expect(
      EngineErrorSchema.safeParse({ error: "PREREQUISITE_DATA_UNAVAILABLE", concept_id: "c1" })
        .success,
    ).toBe(true);
  });
});
