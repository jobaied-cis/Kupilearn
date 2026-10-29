import { describe, expect, it } from "vitest";
import {
  buildPrerequisiteContext,
  generateChapterLessons,
  generateLesson,
  topoSort,
  type EngineDeps,
} from "../engine";
import { InMemoryConceptGraphRepository } from "../graph/repository";
import { JsonTextbookCorpus } from "../textbook/textbook";
import { MockLLMClient } from "../llm";
import { EngineException, LessonResponseSchema } from "../types";

const PHOTOSYNTHESIS = "c7-sci-photosynthesis";

function testDeps(score: number | null = 0.89): EngineDeps {
  return {
    graph: new InMemoryConceptGraphRepository(),
    corpus: new JsonTextbookCorpus(),
    llm: new MockLLMClient(),
    scoreSimilarity: score === null ? undefined : () => score,
  };
}

const MASTERED = { "c7-sci-nutrients": 0.9, "c7-sci-nutrition-modes": 0.85 };

describe("generateLesson", () => {
  it("returns a schema-valid ready payload when prerequisites are met", async () => {
    const res = await generateLesson(
      { conceptId: PHOTOSYNTHESIS, learnerMastery: MASTERED },
      testDeps(),
    );
    expect(LessonResponseSchema.safeParse(res).success).toBe(true);
    expect(res.engine_status).toBe("ready");
    expect(res.prerequisite_audit).toEqual({ all_met: true, missing_prerequisites: [] });
    expect(res.lesson_payload?.micro_lesson?.messages).toHaveLength(5);
    for (const m of res.lesson_payload?.micro_lesson?.messages ?? []) {
      expect(m.text.length).toBeLessThanOrEqual(160);
    }
    expect(res.lesson_payload?.teaching_script?.sections.length).toBeGreaterThanOrEqual(5);
    expect(res.validation?.textbook_similarity_score).toBe(0.89);
    expect(res.curriculum_alignment.ncf_competency_code).toBe("SCI-C7-01");
  });

  it("returns a schema-valid payload with the real TF scorer (no stubs)", async () => {
    const res = await generateLesson(
      { conceptId: PHOTOSYNTHESIS, learnerMastery: MASTERED },
      testDeps(null),
    );
    expect(LessonResponseSchema.safeParse(res).success).toBe(true);
  });

  it("requires remediation with a 3-paragraph bridge lesson when a hard prerequisite is missing", async () => {
    const res = await generateLesson({ conceptId: PHOTOSYNTHESIS, learnerMastery: {} }, testDeps());
    expect(res.engine_status).toBe("remediation_required");
    expect(res.prerequisite_audit).toEqual({
      all_met: false,
      missing_prerequisites: ["c7-sci-nutrition-modes"],
    });
    expect(res.lesson_payload).toBeNull();
    expect(res.remediation?.bridgeLesson.paragraphs).toHaveLength(3);
  });

  it("treats mastery exactly at threshold as met", async () => {
    const res = await generateLesson(
      {
        conceptId: PHOTOSYNTHESIS,
        learnerMastery: { "c7-sci-nutrition-modes": 0.8, "c7-sci-nutrients": 0.8 },
      },
      testDeps(),
    );
    expect(res.engine_status).toBe("ready");
  });

  it("fails closed with CONCEPT_NOT_MAPPED for unknown concepts", async () => {
    const res = await generateLesson({ conceptId: "nope", learnerMastery: {} }, testDeps());
    expect(res.engine_status).toBe("generation_failed");
    expect(res.reason).toBe("CONCEPT_NOT_MAPPED");
  });

  it("retries once with the strict constraint, then fails on low similarity", async () => {
    const llm = new MockLLMClient();
    const res = await generateLesson(
      { conceptId: PHOTOSYNTHESIS, learnerMastery: MASTERED },
      { ...testDeps(0.5), llm },
    );
    expect(res.engine_status).toBe("generation_failed");
    expect(res.reason).toBe("LOW_TEXTBOOK_SIMILARITY");
    const scriptCalls = llm.calls.filter((c) => c.includes("[TEMPLATE:B]"));
    expect(scriptCalls).toHaveLength(2);
    expect(scriptCalls[1]).toContain("STRICT RETRY");
  });

  it("maps graph outages to PREREQUISITE_DATA_UNAVAILABLE instead of hallucinating", async () => {
    const broken = {
      getConceptDetails: async () => {
        throw new Error("connection refused");
      },
      getChapterConcepts: async () => ({ concepts: [], hardEdges: [] }),
    };
    await expect(
      generateLesson({ conceptId: PHOTOSYNTHESIS, learnerMastery: {} }, { ...testDeps(), graph: broken }),
    ).rejects.toMatchObject({ code: "PREREQUISITE_DATA_UNAVAILABLE" });
  });
});

describe("buildPrerequisiteContext", () => {
  it("collects mastered prerequisites and flags only direct hard gaps", async () => {
    const graph = new InMemoryConceptGraphRepository();
    const details = await graph.getConceptDetails("c7-sci-starch-test");
    if (!details) throw new Error("seed missing");
    // starch-test needs photosynthesis (hard, depth 1); deeper chain unmet.
    const ctx = buildPrerequisiteContext(details, { "c7-sci-photosynthesis": 0.85 });
    expect(ctx.targetConcept.id).toBe("c7-sci-starch-test");
    expect(ctx.gapFlags).toEqual([]);
    expect(ctx.activePrerequisites.map((p) => p.id)).toContain("c7-sci-photosynthesis");
  });
});

describe("topoSort", () => {
  it("orders concepts after their hard prerequisites", () => {
    const order = topoSort(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "c"],
      ],
    );
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("rejects cycles", () => {
    expect(() => topoSort(["a", "b"], [["a", "b"], ["b", "a"]])).toThrowError(EngineException);
  });
});

describe("generateChapterLessons", () => {
  it("assembles chapter lessons in prerequisite order", async () => {
    const full = Object.fromEntries(
      ["c7-sci-nutrients", "c7-sci-nutrition-modes", "c7-sci-photosynthesis", "c7-sci-saprotrophs"].map(
        (id) => [id, 1],
      ),
    );
    const batch = await generateChapterLessons("ch-c7-sci-01", full, testDeps());
    expect(batch.ordered_concept_ids).toHaveLength(5);
    expect(batch.lessons).toHaveLength(5);
    const pos = new Map(batch.ordered_concept_ids.map((id, i) => [id, i]));
    const before = (a: string, b: string) => (pos.get(a) as number) < (pos.get(b) as number);
    expect(before("c7-sci-nutrients", "c7-sci-nutrition-modes")).toBe(true);
    expect(before("c7-sci-nutrition-modes", "c7-sci-photosynthesis")).toBe(true);
    expect(before("c7-sci-photosynthesis", "c7-sci-starch-test")).toBe(true);
    expect(before("c7-sci-nutrition-modes", "c7-sci-saprotrophs")).toBe(true);
    for (const lesson of batch.lessons) {
      expect(LessonResponseSchema.safeParse(lesson).success).toBe(true);
    }
  });
});
