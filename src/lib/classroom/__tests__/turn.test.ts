import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MockLLMClient, type LLMClient } from "../../curriculum/llm";
import { initialDirectorState } from "../director";
import { createDefaultClassroom } from "../registry";
import { MAX_FIDELITY_RETRIES, runClassroomTurn } from "../turn";
import { MockVoiceClient, VoiceError, type VoiceClient } from "../voice";
import {
  ClassroomException,
  ClassroomRegistrySchema,
  ClassroomTurnRequestSchema,
  type DirectorState,
  type MoveType,
  type TurnHistoryEntry,
} from "../types";

const registry = ClassroomRegistrySchema.parse(createDefaultClassroom("turn_room"));

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

const mockDeps = () => ({ llm: new MockLLMClient(), voice: new MockVoiceClient() });

class FailingVoice implements VoiceClient {
  async synthesize(): Promise<never> {
    throw new VoiceError("TTS endpoint unreachable");
  }
}

describe("classroom turn pipeline (§8 tool sequence)", () => {
  it("opens a session with defaults: assistant welcome + voice + advanced state", async () => {
    const response = await runClassroomTurn(ClassroomTurnRequestSchema.parse({}), mockDeps());
    expect(response.classroom_id).toBe("classroom_default");
    expect(response.decision).toMatchObject({ next_speaker: "assistant_01", reason: "session_start" });
    expect(response.turn?.speaker.agent_id).toBe("assistant_01");
    expect(response.turn?.content.speech_audio_url).toContain("mock://tts/");
    expect(response.turn?.persona_fidelity).toEqual({ belief_state_preserved: true, drift_detected: false });
    expect(response.state.turn_count).toBe(1);
    expect(response.state.history).toHaveLength(1);
    expect(response.state.scaffold_level).toBeLessThan(1);
  });

  it("returns a null turn when routing to the student after a classmate error", async () => {
    const state = stateWith({
      history: [
        entry("assistant_01", "assistant", "facilitation"),
        entry("teacher_01", "teacher", "direct_instruction"),
        entry("classmate_curious", "classmate", "misconception_exposure"),
      ],
      last_speaker_id: "classmate_curious",
      last_move_type: "misconception_exposure",
      classmate_utterances_since_checkpoint: 1,
    });
    const response = await runClassroomTurn(ClassroomTurnRequestSchema.parse({ state }), mockDeps());
    expect(response.decision).toMatchObject({
      next_speaker: "student",
      reason: "student_priority_after_error",
    });
    expect(response.turn).toBeNull();
    expect(response.state.turn_count).toBe(1);
    expect(response.state.history).toHaveLength(3);
  });

  it("withholds repeatedly drifted classmate turns and delivers a teacher redirect", async () => {
    let classmateCalls = 0;
    let teacherCalls = 0;
    const drifting: LLMClient = {
      async generateJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
        if (prompt.includes("[TEMPLATE:CLASSMATE]")) {
          classmateCalls += 1;
          return schema.parse({
            text: "Actually, the answer is x = 9. I figured it out!",
            move_type: "misconception_exposure",
            misconception_id: "transpose_sign_ignored",
            invites_student_response: true,
            whiteboard_actions: [],
          });
        }
        teacherCalls += 1;
        return schema.parse({
          text: "Let us look at the problem together and take the next step.",
          move_type: "redirect",
          misconception_id: null,
          invites_student_response: false,
          whiteboard_actions: [],
        });
      },
    };
    const state = stateWith({
      history: [
        entry("assistant_01", "assistant", "facilitation"),
        entry("teacher_01", "teacher", "direct_instruction"),
      ],
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
    });
    const response = await runClassroomTurn(
      ClassroomTurnRequestSchema.parse({ state, student_silence_seconds: 15 }),
      { llm: drifting, voice: new MockVoiceClient() },
    );
    expect(classmateCalls).toBe(1 + MAX_FIDELITY_RETRIES);
    expect(teacherCalls).toBe(1);
    expect(response.decision).toMatchObject({
      next_speaker: "teacher_01",
      reason: "teacher_redirect_after_drift",
    });
    expect(response.turn?.speaker.agent_id).toBe("teacher_01");
    expect(response.turn?.pedagogical_annotation.move_type).toBe("redirect");
    expect(response.turn?.content.text).not.toContain("x = 9");
    expect(response.turn?.persona_fidelity.detail).toContain("withheld");
  });

  it("strips whiteboard actions from agents without board capability", async () => {
    const scribbling: LLMClient = {
      async generateJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
        expect(prompt).toContain("[TEMPLATE:CLASSMATE]");
        return schema.parse({
          text: "I still think moving −7 keeps it −7. Where does that break?",
          move_type: "misconception_exposure",
          misconception_id: "transpose_sign_ignored",
          invites_student_response: true,
          whiteboard_actions: [{ action: "write", content: "3x = 13" }],
        });
      },
    };
    const state = stateWith({
      history: [
        entry("assistant_01", "assistant", "facilitation"),
        entry("teacher_01", "teacher", "direct_instruction"),
      ],
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
    });
    const response = await runClassroomTurn(
      ClassroomTurnRequestSchema.parse({ state, student_silence_seconds: 15 }),
      { llm: scribbling, voice: new MockVoiceClient() },
    );
    expect(response.turn?.whiteboard_actions).toEqual([]);
  });

  it("drops sticky text-fallback mode when TTS fails", async () => {
    const response = await runClassroomTurn(ClassroomTurnRequestSchema.parse({}), {
      llm: new MockLLMClient(),
      voice: new FailingVoice(),
    });
    expect(response.turn?.content.speech_audio_url).toBeNull();
    expect(response.turn?.mode).toBe("text_fallback");
    expect(response.state.mode).toBe("text_fallback");
  });

  it("bounds the echoed speaking history", async () => {
    const history: TurnHistoryEntry[] = Array.from({ length: 45 }, (_, i) =>
      i % 2 === 0
        ? entry("assistant_01", "assistant", "facilitation")
        : entry("teacher_01", "teacher", "direct_instruction"),
    );
    const state = stateWith({
      history,
      last_speaker_id: "teacher_01",
      last_move_type: "direct_instruction",
    });
    const response = await runClassroomTurn(ClassroomTurnRequestSchema.parse({ state }), mockDeps());
    expect(response.state.history.length).toBeLessThanOrEqual(40);
  });

  it("rejects invalid registries with a structured 400 error", async () => {
    const twoTeachers = {
      ...registry,
      agents: registry.agents.map((a) =>
        a.agent_id === "assistant_01" ? { ...a, role: "teacher" as const } : a,
      ),
    };
    await expect(
      runClassroomTurn(ClassroomTurnRequestSchema.parse({ registry: twoTeachers }), mockDeps()),
    ).rejects.toMatchObject({ code: "REGISTRY_INVALID", httpStatus: 400 });
    try {
      await runClassroomTurn(
        ClassroomTurnRequestSchema.parse({ registry: twoTeachers }),
        mockDeps(),
      );
    } catch (error) {
      expect((error as ClassroomException).toPayload().classroom_id).toBe("turn_room");
    }
  });

  it("passes validation on a correct learner answer and terminates", async () => {
    const state = stateWith({
      phase: "validation",
      history: [
        entry("assistant_01", "assistant", "facilitation"),
        entry("teacher_01", "teacher", "checkpoint"),
        entry("student", "student", "student_response"),
      ],
      last_speaker_id: "student",
      last_move_type: "student_response",
    });
    const response = await runClassroomTurn(
      ClassroomTurnRequestSchema.parse({ state, student_input: "x = 9", student_answer_correct: true }),
      mockDeps(),
    );
    expect(response.state.validation_passed).toBe(true);
    expect(response.decision.next_speaker).toBe("terminate");
    expect(response.turn).toBeNull();
  });
});
