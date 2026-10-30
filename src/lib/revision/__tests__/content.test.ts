import { describe, expect, it, vi } from "vitest";
import { RevisionContentSchema, RevisionContentService, buildOfflineContent, buildRevisionPrompt } from "../content";
import { getConcept } from "../concepts";
import type { LLMClient } from "../../curriculum/llm";

const CONCEPT = getConcept("c8-math-algebraic-variables") ?? getConcept("c8-math-algebraic");
if (!CONCEPT) throw new Error("test concept missing");

const validPayload = {
  explanation: {
    title: "Variables, made simple",
    body: ["A variable is a letter that stands for a number we do not know yet.", "When the number changes, the variable's value changes too."],
    example: "If x = 5, then x + 3 = 8.",
    commonMistake: "Treating x as a fixed number instead of a placeholder.",
  },
  flashcards: [
    { id: "card-1", front: "What is a variable?", back: "A letter standing for an unknown number." },
    { id: "card-2", front: "If x = 5, what is x + 3?", back: "8" },
    { id: "card-3", front: "Is x always 5?", back: "No - its value can change." },
  ],
};

const stubLLM = (impl: () => Promise<unknown>): LLMClient => ({
  generateJSON: vi.fn(async () => impl()) as LLMClient["generateJSON"],
});

describe("RevisionContentService (Part 08)", () => {
  it("returns validated Meta content when the model answers well", async () => {
    const service = new RevisionContentService(() => stubLLM(async () => validPayload));
    const content = await service.getContent(CONCEPT.id, "en");
    expect(content.source).toBe("meta");
    expect(content.conceptId).toBe(CONCEPT.id);
    expect(() => RevisionContentSchema.parse(content)).not.toThrow();
    expect(content.flashcards.length).toBeGreaterThanOrEqual(3);
  });

  it("caches per concept+language: the model is called once", async () => {
    const llm = stubLLM(async () => validPayload);
    const service = new RevisionContentService(() => llm);
    await service.getContent(CONCEPT.id, "en");
    await service.getContent(CONCEPT.id, "en");
    expect(llm.generateJSON).toHaveBeenCalledTimes(1);
    await service.getContent(CONCEPT.id, "bn");
    expect(llm.generateJSON).toHaveBeenCalledTimes(2);
  });

  it("falls back to honest offline content when the provider fails", async () => {
    const service = new RevisionContentService(() => stubLLM(async () => { throw new Error("meta down"); }));
    const content = await service.getContent(CONCEPT.id, "en");
    expect(content.source).toBe("offline");
    expect(content.flashcards.length).toBeGreaterThanOrEqual(3);
  });

  it("falls back when model output fails schema validation (bad shape, too few cards)", async () => {
    const service = new RevisionContentService(() => stubLLM(async () => ({ explanation: { title: "x" }, flashcards: [] })));
    const content = await service.getContent(CONCEPT.id, "bn");
    expect(content.source).toBe("offline");
    expect(content.language).toBe("bn");
    expect(() => RevisionContentSchema.parse(content)).not.toThrow();
  });

  it("404s unknown concepts without calling the model", async () => {
    const llm = stubLLM(async () => validPayload);
    const service = new RevisionContentService(() => llm);
    await expect(service.getContent("c6m-ch4", "en")).rejects.toMatchObject({ code: "CONCEPT_NOT_FOUND", status: 404 });
    expect(llm.generateJSON).not.toHaveBeenCalled();
  });
});

describe("buildOfflineContent + buildRevisionPrompt", () => {
  it("offline content is grounded in the concept's own terms and always schema-valid", () => {
    const content = buildOfflineContent(CONCEPT, "en");
    expect(content.source).toBe("offline");
    expect(() => RevisionContentSchema.parse(content)).not.toThrow();
    expect(content.explanation.body.join(" ")).toContain(CONCEPT.keyTerms[0] ?? CONCEPT.name);
  });

  it("the prompt carries curriculum data only - no student identity exists to leak", () => {
    const prompt = buildRevisionPrompt(CONCEPT, "en");
    expect(prompt).toContain(CONCEPT.name);
    expect(prompt).not.toMatch(/stu-|studentId|learnerId|attempt history|mastery score|answers/i);
  });
});
