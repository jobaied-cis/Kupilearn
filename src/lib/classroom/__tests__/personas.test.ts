import { describe, expect, it } from "vitest";
import {
  buildAssistantPrompt,
  buildClassmatePrompt,
  buildDirectorPrompt,
  buildTeacherPrompt,
} from "../personas";
import { createDefaultClassroom, getTeacher } from "../registry";
import { ClassroomRegistrySchema } from "../types";
import { initialDirectorState as freshState } from "../director";

const registry = ClassroomRegistrySchema.parse(createDefaultClassroom("persona_room"));
const teacher = getTeacher(registry);
const classmate = registry.agents.find((a) => a.agent_id === "classmate_curious")!;
const assistant = registry.agents.find((a) => a.agent_id === "assistant_01")!;

describe("persona prompt templates (§3)", () => {
  it("frames classmates with a belief-maintenance objective, not a tutoring one", () => {
    const { text } = buildClassmatePrompt({
      agent: classmate,
      personaState: classmate.persona_state!,
      taskSchema: registry.task_schema,
      classLevel: 8,
      history: [],
      learnerAddressedConcept: false,
    });
    expect(text).toContain("[TEMPLATE:CLASSMATE]");
    expect(text).toContain("You are NOT a tutor. You are a peer.");
    expect(text).toContain(classmate.persona_state!.misconception_statement);
    expect(text).toContain('Never state the correct answer. Never say "actually, the answer is..."');
    expect(text).toContain("1-2 sentences");
  });

  it("injects question briefs into classmate prompts", () => {
    const { text } = buildClassmatePrompt({
      agent: classmate,
      personaState: classmate.persona_state!,
      classLevel: 8,
      history: [],
      learnerAddressedConcept: false,
      questionBrief: "RELATED MISTAKE: assert a wrong value with flawed reasoning.",
    });
    expect(text).toContain("Question Brief: RELATED MISTAKE");
  });

  it("adapts teacher prompts to emotion, comprehension, and checkpoints", () => {
    const { text } = buildTeacherPrompt({
      agent: teacher,
      signals: { learner_emotion: "frustrated", learner_comprehension: "low", last_checkpoint: "failed" },
      classLevel: 8,
      subject: "Mathematics",
      localContext: "Indian daily life",
      history: [],
      taskSchema: registry.task_schema,
      isCheckpoint: true,
    });
    expect(text).toContain("[TEMPLATE:TEACHER]");
    expect(text).toContain("emotion estimate: frustrated");
    expect(text).toContain("comprehension estimate: low");
    expect(text).toContain("break the concept into a smaller step");
    expect(text).toContain("Switch modality");
    expect(text).toContain("Checkpoint Turn: yes");
    expect(text).toContain("textbook terminology");
  });

  it("renders drift redirects as neutral bridges that never mention the error", () => {
    const { text } = buildTeacherPrompt({
      agent: teacher,
      signals: { learner_emotion: "calm", learner_comprehension: "medium", last_checkpoint: "not_attempted" },
      classLevel: 8,
      subject: "Mathematics",
      localContext: "Indian daily life",
      history: [],
      redirectAfterDrift: true,
    });
    expect(text).toContain("[REDIRECT]");
    expect(text).toContain("Do NOT mention the peer, the mistake, or any error");
  });

  it("keeps the assistant in a facilitation role with distinct welcome framing", () => {
    const welcome = buildAssistantPrompt({
      agent: assistant,
      classLevel: 8,
      subject: "Mathematics",
      history: [],
      isWelcome: true,
    });
    expect(welcome.text).toContain("[TEMPLATE:ASSISTANT]");
    expect(welcome.text).toContain("You do NOT teach content");
    expect(welcome.text).toContain("session start");
    const handover = buildAssistantPrompt({
      agent: assistant,
      classLevel: 8,
      subject: "Mathematics",
      history: [],
    });
    expect(handover.text).not.toContain("session start");
  });

  it("constrains director selection with hard rules and a typed contract", () => {
    const { text } = buildDirectorPrompt({
      registryAgents: registry.agents.map((a) => ({
        agent_id: a.agent_id,
        role: a.role,
        speaking_priority: a.speaking_priority,
      })),
      state: freshState(),
      studentSilenceSeconds: 0,
    });
    expect(text).toContain("[TEMPLATE:DIRECTOR]");
    expect(text).toContain("You are the classroom Director, a meta-agent. You do not teach.");
    expect(text).toContain("Never select the same agent twice in a row");
    expect(text).toContain("teacher_01(teacher,p10)");
  });
});
