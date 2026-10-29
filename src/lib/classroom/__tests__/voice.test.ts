import { describe, expect, it } from "vitest";
import {
  MockVoiceClient,
  VoiceError,
  createVoiceClient,
  estimateSpeechDurationMs,
  prosodyForAgent,
  synthesizeSpeechOrFallback,
  type VoiceClient,
} from "../voice";
import { createDefaultClassroom } from "../registry";
import { ClassroomException, ClassroomRegistrySchema } from "../types";

const registry = ClassroomRegistrySchema.parse(createDefaultClassroom("voice_room"));
const byId = (id: string) => registry.agents.find((a) => a.agent_id === id)!;

class FailingVoice implements VoiceClient {
  async synthesize(): Promise<never> {
    throw new VoiceError("TTS endpoint unreachable");
  }
}

describe("voice pipeline (§5)", () => {
  it("synthesizes deterministically in mock mode", async () => {
    const voice = new MockVoiceClient();
    const input = { text: "Welcome to class!", voice_id: "mock_host_male_in", prosody: prosodyForAgent(byId("assistant_01")) };
    const first = await voice.synthesize(input);
    const second = await voice.synthesize(input);
    expect(first).toEqual(second);
    expect(first.audio_url).toContain("mock://tts/mock_host_male_in/");
    expect(first.duration_ms).toBe(estimateSpeechDurationMs(input.text));
    expect(first.duration_ms).toBeGreaterThanOrEqual(600);
    expect(voice.calls).toHaveLength(2);
  });

  it("falls back to text mode when TTS fails, never throwing", async () => {
    const outcome = await synthesizeSpeechOrFallback(new FailingVoice(), {
      text: "Think of the balance scale.",
      voice_id: "voxcpm2_teacher_female_in",
      prosody: prosodyForAgent(byId("teacher_01")),
    });
    expect(outcome.audio_url).toBeNull();
    expect(outcome.mode).toBe("text_fallback");
    expect(outcome.duration_ms).toBeGreaterThan(0);
  });

  it("rejects unknown TTS providers at wiring time", () => {
    const previous = process.env.TTS_PROVIDER;
    process.env.TTS_PROVIDER = "acme";
    try {
      expect(() => createVoiceClient()).toThrowError(ClassroomException);
      try {
        createVoiceClient();
      } catch (error) {
        expect((error as ClassroomException).code).toBe("TTS_PROVIDER_UNKNOWN");
      }
    } finally {
      if (previous === undefined) delete process.env.TTS_PROVIDER;
      else process.env.TTS_PROVIDER = previous;
    }
  });

  it("maps prosody per persona: steady teacher, rising curious, downward critical", () => {
    expect(prosodyForAgent(byId("teacher_01"))).toEqual({ pace: "moderate", pitch: "medium", intonation: "flat" });
    expect(prosodyForAgent(byId("classmate_curious"))).toEqual({ pace: "fast", pitch: "high", intonation: "rising" });
    expect(prosodyForAgent(byId("classmate_critical"))).toEqual({ pace: "moderate", pitch: "low", intonation: "downward" });
  });
});
