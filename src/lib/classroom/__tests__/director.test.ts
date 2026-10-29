import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { LLMClient } from "../../curriculum/llm";
import {
  advanceAfterAgentTurn,
  applyDirectorRules,
  computePhase,
  decideNextSpeaker,
  initialDirectorState,
  repairMonologueViolation,
  scaffoldForTurnCount,
} from "../director";
import { createDefaultClassroom } from "../registry";
import {
  ClassroomRegistrySchema,
  type ClassroomTurn,
  type DirectorState,
  type MoveType,
  type TurnHistoryEntry,
} from "../types";

const registry = ClassroomRegistrySchema.parse(createDefaultClassroom("director_room"));

let seq = 0;
function entry(
  speaker_id: string,
  role: TurnHistoryEntry["role"],
  move_type: MoveType,
): TurnHistoryEntry {
  seq += 1;
  return { turn_id: `t${seq}`, speaker_id, role, move_type, text_preview: `${speaker_id} speaks` };
}

function stateWith(overrides: Partial<DirectorState>): DirectorState {
  return { ...initialDirectorState(), ...overrides };
}

const assistantThenTeacher = () => [
  entry("assistant_01", "assistant", "facilitation"),
  entry("teacher_01", "teacher", "direct_instruction"),
];

function agentTurn(speaker_id: string, role: ClassroomTurn["speaker"]["role"], move: MoveType): ClassroomTurn {
  return {
    turn_id: `turn-${speaker_id}`,
    speaker: { agent_id: speaker_id, display_name: speaker_id, role },
    content: { text: "spoken line", speech_audio_url: "mock://tts/x.wav", duration_ms: 1200 },
    pedagogical_annotation: { move_type: move, misconception_id: null, invites_student_response: true },
    persona_fidelity: { belief_state_preserved: true, drift_detected: false },
    whiteboard_actions: [],
    mode: "voice",
  };
}

class ThrowingLLM implements LLMClient {
  async generateJSON<T>(): Promise<T> {
    throw new Error("LLM down");
  }
}

class ScriptedLLM implements LLMClient {
  calls: string[] = [];
  constructor(private decision: unknown) {}
  async generateJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    this.calls.push(prompt);
    return schema.parse(this.decision);
  }
}

const llmPick = (next_speaker: string) => ({
  next_speaker,
  reason: "llm_selected",
  scaffold_level: 0.5,
  wait_for_student_seconds: 0,
});

describe("director turn-taking rules (§4.2)", () => {
  it("opens the session with the assistant welcome", () => {
    const outcome = applyDirectorRules({ registry, state: initialDirectorState(), studentSilenceSeconds: 0 });
    expect(outcome).toEqual({
      kind: "decided",
      decision: { next_speaker: "assistant_01", reason: "session_start", scaffold_level: 1, wait_for_student_seconds: 0 },
    });
  });

  it("routes to the student first after a classmate error", () => {
    const state = stateWith({
      history: [...assistantThenTeacher(), entry("classmate_curious", "classmate", "misconception_exposure")],
      last_speaker_id: "classmate_curious",
      last_move_type: "misconception_exposure",
      classmate_utterances_since_checkpoint: 1,
    });
    const outcome = applyDirectorRules({ registry, state, studentSilenceSeconds: 0 });
    expect(outcome.kind).toBe("decided");
    if (outcome.kind === "decided") {
      expect(outcome.decision.next_speaker).toBe("student");
      expect(outcome.decision.reason).toBe("student_priority_after_error");
      expect(outcome.decision.wait_for_student_seconds).toBeGreaterThan(0);
    }
  });

  it("inserts a teacher checkpoint every 3 classmate utterances, unless the student is mid-explanation", () => {
    const checkpointDue = stateWith({
      history: assistantThenTeacher(),
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
      classmate_utterances_since_checkpoint: 3,
    });
    const due = applyDirectorRules({ registry, state: checkpointDue, studentSilenceSeconds: 0 });
    expect(due).toMatchObject({ kind: "decided", decision: { next_speaker: "teacher_01", reason: "teacher_checkpoint_due" } });

    const midExplanation = stateWith({
      ...checkpointDue,
      history: [...checkpointDue.history, entry("student", "student", "student_response")],
      last_speaker_id: "student",
      last_move_type: "student_response",
    });
    const held = applyDirectorRules({ registry, state: midExplanation, studentSilenceSeconds: 0 });
    expect(held.kind).toBe("uncertain");
  });

  it("routes learner questions to the teacher", () => {
    const state = stateWith({
      history: [...assistantThenTeacher(), entry("student", "student", "student_response")],
      last_speaker_id: "student",
      last_move_type: "student_response",
    });
    const outcome = applyDirectorRules({
      registry,
      state,
      studentInput: "Why do we add 7 to both sides?",
      studentSilenceSeconds: 0,
    });
    expect(outcome).toMatchObject({
      kind: "decided",
      decision: { next_speaker: "teacher_01", reason: "learner_asked_question" },
    });
  });

  it("repairs LLM monologue violations via priority fallback and owns the scaffold level", async () => {
    const state = stateWith({
      history: [
        ...assistantThenTeacher(),
        entry("classmate_curious", "classmate", "clarifying_question"),
      ],
      last_speaker_id: "classmate_curious",
      last_move_type: "clarifying_question",
      classmate_utterances_since_checkpoint: 1,
      scaffold_level: 1,
    });
    const repaired = await decideNextSpeaker(
      { registry, state, studentSilenceSeconds: 0 },
      new ScriptedLLM(llmPick("classmate_curious")),
    );
    expect(repaired.next_speaker).toBe("teacher_01");
    expect(repaired.reason).toBe("priority_fallback");

    const scaffold = await decideNextSpeaker(
      { registry, state, studentSilenceSeconds: 0 },
      new ScriptedLLM(llmPick("teacher_01")),
    );
    expect(scaffold.next_speaker).toBe("teacher_01");
    expect(scaffold.scaffold_level).toBe(1);
  });

  it("lets the teacher double only during direct instruction (max 2 consecutive)", async () => {
    const double = stateWith({
      history: [...assistantThenTeacher(), entry("teacher_01", "teacher", "direct_instruction")],
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
      consecutive_teacher_turns: 1,
      phase: "shared_understanding",
    });
    const allowed = await decideNextSpeaker(
      { registry, state: double, studentSilenceSeconds: 0 },
      new ScriptedLLM(llmPick("teacher_01")),
    );
    expect(allowed.next_speaker).toBe("teacher_01");

    const triple = stateWith({ ...double, consecutive_teacher_turns: 2 });
    const blocked = await decideNextSpeaker(
      { registry, state: triple, studentSilenceSeconds: 0 },
      new ScriptedLLM(llmPick("teacher_01")),
    );
    expect(blocked.next_speaker).toBe("assistant_01");
    expect(blocked.reason).toBe("priority_fallback");
    expect(repairMonologueViolation(registry, double, "assistant_01")).toBeNull();
  });

  it("inserts a classmate think-aloud on strategic delay, then yields to the student", () => {
    const silent = stateWith({
      history: assistantThenTeacher(),
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
    });
    const interject = applyDirectorRules({ registry, state: silent, studentSilenceSeconds: 15 });
    expect(interject.kind).toBe("decided");
    if (interject.kind !== "decided") return;
    expect(interject.decision.reason).toBe("discussion_stalled");
    const classmate = registry.agents.find((a) => a.agent_id === interject.decision.next_speaker);
    expect(classmate?.role).toBe("classmate");

    const after = advanceAfterAgentTurn(
      silent,
      interject.decision,
      agentTurn(interject.decision.next_speaker, "classmate", "thinking_aloud"),
    );
    expect(after.pending_student_yield).toBe(true);
    const yielded = applyDirectorRules({ registry, state: after, studentSilenceSeconds: 0 });
    expect(yielded).toMatchObject({
      kind: "decided",
      decision: { next_speaker: "student", reason: "strategic_delay_yield" },
    });
  });

  it("throttles interjections in text mode (higher threshold, every other skipped)", () => {
    const base = stateWith({
      history: assistantThenTeacher(),
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
      mode: "text_fallback",
    });
    const belowThreshold = applyDirectorRules({ registry, state: base, studentSilenceSeconds: 15 });
    expect(belowThreshold.kind).toBe("uncertain");

    const even = applyDirectorRules({
      registry,
      state: stateWith({ ...base, text_mode_skips: 0 }),
      studentSilenceSeconds: 25,
    });
    expect(even).toMatchObject({ kind: "decided", decision: { reason: "discussion_stalled" } });
    if (even.kind === "decided") expect(even.decision.next_speaker).not.toBe("student");

    const odd = applyDirectorRules({
      registry,
      state: stateWith({ ...base, text_mode_skips: 1 }),
      studentSilenceSeconds: 25,
    });
    expect(odd).toMatchObject({
      kind: "decided",
      decision: { next_speaker: "student", reason: "discussion_stalled" },
    });
  });

  it("fades the scaffold 1.0 → 0.0 and routes to peers at zero", () => {
    expect(scaffoldForTurnCount(0)).toBe(1);
    expect(scaffoldForTurnCount(10)).toBe(0.5);
    expect(scaffoldForTurnCount(20)).toBe(0);
    expect(scaffoldForTurnCount(99)).toBe(0);

    const faded = stateWith({
      history: assistantThenTeacher(),
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
      scaffold_level: 0,
    });
    const outcome = applyDirectorRules({ registry, state: faded, studentSilenceSeconds: 0 });
    expect(outcome.kind).toBe("decided");
    if (outcome.kind === "decided") {
      expect(outcome.decision.reason).toBe("scaffold_fade_peer_routing");
      const peer = registry.agents.find((a) => a.agent_id === outcome.decision.next_speaker);
      expect(peer?.role).toBe("classmate");
    }
  });

  it("terminates only after validation passes and never on LLM request alone", async () => {
    const done = stateWith({ phase: "validation", validation_passed: true });
    expect(applyDirectorRules({ registry, state: done, studentSilenceSeconds: 0 })).toMatchObject({
      kind: "decided",
      decision: { next_speaker: "terminate", reason: "session_complete" },
    });

    const open = stateWith({
      history: assistantThenTeacher(),
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
    });
    const guarded = await decideNextSpeaker(
      { registry, state: open, studentSilenceSeconds: 0 },
      new ScriptedLLM({ ...llmPick("terminate"), reason: "session_complete" }),
    );
    expect(guarded.next_speaker).toBe("assistant_01");
    expect(guarded.reason).toBe("priority_fallback");
  });

  it("falls back to priority order when the LLM fails or hallucinates a speaker", async () => {
    const open = stateWith({
      history: assistantThenTeacher(),
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
    });
    const failed = await decideNextSpeaker({ registry, state: open, studentSilenceSeconds: 0 }, new ThrowingLLM());
    expect(failed).toMatchObject({ next_speaker: "assistant_01", reason: "priority_fallback" });

    const hallucinated = await decideNextSpeaker(
      { registry, state: open, studentSilenceSeconds: 0 },
      new ScriptedLLM(llmPick("ghost_agent")),
    );
    expect(hallucinated).toMatchObject({ next_speaker: "assistant_01", reason: "priority_fallback" });
  });
});

describe("pedagogical phase machine (§4.3)", () => {
  it("walks the five-stage CPS framework and never regresses", () => {
    expect(computePhase("shared_understanding", [])).toBe("shared_understanding");
    const framed = [entry("teacher_01", "teacher", "direct_instruction"), entry("teacher_01", "teacher", "direct_instruction")];
    expect(computePhase("shared_understanding", framed)).toBe("team_organization");
    const organized = [...framed, entry("assistant_01", "assistant", "facilitation"), entry("assistant_01", "assistant", "facilitation")];
    expect(computePhase("team_organization", organized)).toBe("planning");
    const planned = [...organized, entry("classmate_curious", "classmate", "clarifying_question"), entry("classmate_critical", "classmate", "extension_question")];
    expect(computePhase("planning", planned)).toBe("execution");
    const executed = [...planned, entry("teacher_01", "teacher", "checkpoint"), entry("student", "student", "student_response"), entry("student", "student", "student_response")];
    expect(computePhase("execution", executed)).toBe("validation");
    expect(computePhase("validation", [])).toBe("validation");
  });
});
