import { describe, expect, it } from "vitest";
import {
  INSTRUCTION_TOKEN_BUDGET,
  STRICT_RETRY_CONSTRAINT,
  buildMicroLessonPrompt,
  buildRemediationPrompt,
  buildTeachingScriptPrompt,
  estimateTokens,
} from "../prompts";

const MICRO_ARGS = {
  classLevel: 7,
  subject: "Science",
  conceptName: "Photosynthesis",
  textbookName: "Science VII",
  chapterTitle: "Nutrition in Plants",
  learningObjectiveText: "Explains the process of photosynthesis.",
  masteredPrerequisites: ["Modes of Nutrition"],
  difficulty: 0.55,
  bloomLevel: "understand",
  textbookExcerpt: "Green plants prepare their own food by photosynthesis.",
};

describe("prompt templates (§4)", () => {
  it("keeps every instruction block within the 200-token budget", () => {
    const a = buildMicroLessonPrompt(MICRO_ARGS);
    const b = buildTeachingScriptPrompt({
      classLevel: 7,
      subject: "Science",
      chapterTitle: "Nutrition in Plants",
      conceptNames: ["Photosynthesis"],
      objectiveTexts: ["Explains the process of photosynthesis."],
      allHardPrerequisitesMet: true,
      prerequisiteConcepts: ["Modes of Nutrition"],
      textbookExcerpt: "Green plants prepare their own food by photosynthesis.",
    });
    const c = buildRemediationPrompt({
      classLevel: 7,
      targetConcept: "Photosynthesis",
      missingPrerequisite: "Modes of Nutrition",
    });
    for (const built of [a, b, c]) {
      expect(estimateTokens(built.instruction)).toBeLessThanOrEqual(INSTRUCTION_TOKEN_BUDGET);
    }
  });

  it("injects curriculum context into Template A", () => {
    const { text } = buildMicroLessonPrompt(MICRO_ARGS);
    expect(text).toContain("[TEMPLATE:A]");
    expect(text).toContain("Photosynthesis");
    expect(text).toContain("Modes of Nutrition");
    expect(text).toContain("Green plants prepare their own food");
    expect(text).toContain("≤160 characters");
  });

  it("injects chapter context and format into Template B", () => {
    const { text } = buildTeachingScriptPrompt({
      classLevel: 7,
      subject: "Science",
      chapterTitle: "Nutrition in Plants",
      conceptNames: ["Photosynthesis"],
      objectiveTexts: [],
      allHardPrerequisitesMet: true,
      prerequisiteConcepts: [],
      textbookExcerpt: "excerpt",
    });
    expect(text).toContain("[TEMPLATE:B]");
    expect(text).toContain("Nutrition in Plants");
    expect(text).toContain("Bridge Activity");
    expect(text).toContain("durationMin");
  });

  it("names both concepts in the Template C remediation drill", () => {
    const { text } = buildRemediationPrompt({
      classLevel: 7,
      targetConcept: "Photosynthesis",
      missingPrerequisite: "Modes of Nutrition",
    });
    expect(text).toContain("[TEMPLATE:C]");
    expect(text).toContain("Photosynthesis");
    expect(text).toContain("Modes of Nutrition");
  });

  it("provides a non-empty strict retry constraint", () => {
    expect(STRICT_RETRY_CONSTRAINT.length).toBeGreaterThan(20);
  });
});
