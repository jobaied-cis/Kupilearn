import { describe, expect, it } from "vitest";
import { checkPersonaFidelity } from "../fidelity";
import { createDefaultClassroom } from "../registry";
import { ClassroomRegistrySchema } from "../types";

const registry = ClassroomRegistrySchema.parse(createDefaultClassroom("fidelity_room"));
const personaState = registry.agents.find((a) => a.agent_id === "classmate_curious")!.persona_state!;
const taskSchema = registry.task_schema!;

describe("persona fidelity guardrail (§7)", () => {
  it("passes clean belief defenses", () => {
    expect(
      checkPersonaFidelity({
        utteranceText: "I still think moving −7 keeps it as −7, so 3x = 13. Where does that break?",
        personaState,
        taskSchema,
        learnerAddressedConcept: false,
      }),
    ).toEqual({ belief_state_preserved: true, drift_detected: false });
  });

  it("flags verbatim correct-answer leaks as drift", () => {
    const result = checkPersonaFidelity({
      utteranceText: "Hmm, working it through, x = 9 seems right.",
      personaState,
      taskSchema,
      learnerAddressedConcept: false,
    });
    expect(result.drift_detected).toBe(true);
    expect(result.belief_state_preserved).toBe(false);
    expect(result.detail).toContain("correct answer");
  });

  it("flags solution-snapping phrasings as drift", () => {
    for (const text of [
      "Actually, the answer is 9, I just realized.",
      "The correct answer is clearly 9 here.",
      "Here's the solution: divide both sides properly.",
    ]) {
      expect(
        checkPersonaFidelity({ utteranceText: text, personaState, taskSchema, learnerAddressedConcept: false })
          .drift_detected,
      ).toBe(true);
    }
  });

  it("flags helpful-assistant leakage as drift", () => {
    for (const text of [
      "As an AI, I should clarify the method for you.",
      "As a tutor, let me correct that mistake.",
    ]) {
      expect(
        checkPersonaFidelity({ utteranceText: text, personaState, taskSchema, learnerAddressedConcept: false })
          .drift_detected,
      ).toBe(true);
    }
  });

  it("permits belief updates once the learner addresses the concept", () => {
    expect(
      checkPersonaFidelity({
        utteranceText: "Oh — so the balance tips unless I undo −7 with +7 on both sides? Then x = 9.",
        personaState,
        taskSchema,
        learnerAddressedConcept: true,
      }).drift_detected,
    ).toBe(false);
  });

  it("ignores too-short correct answers to avoid false positives", () => {
    expect(
      checkPersonaFidelity({
        utteranceText: "I think 9 works, but I cannot show why yet.",
        personaState,
        taskSchema: { ...taskSchema, correct_answer: "9" },
        learnerAddressedConcept: false,
      }).drift_detected,
    ).toBe(false);
  });
});
