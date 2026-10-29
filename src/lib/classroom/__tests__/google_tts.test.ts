import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GoogleCloudVoiceClient,
  VoiceError,
  estimateSpeechDurationMs,
  googleAudioConfig,
  selectGoogleVoice,
} from "../voice";
import { createDefaultClassroom } from "../registry";
import { ClassroomRegistrySchema } from "../types";

const registry = ClassroomRegistrySchema.parse(createDefaultClassroom("gtts_room"));

let previousKey: string | undefined;
beforeEach(() => {
  previousKey = process.env.GOOGLE_TTS_API_KEY;
  process.env.GOOGLE_TTS_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (previousKey === undefined) delete process.env.GOOGLE_TTS_API_KEY;
  else process.env.GOOGLE_TTS_API_KEY = previousKey;
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("google cloud TTS backend", () => {
  it("resolves registry voice_ids to gender-matched en-IN Neural2 voices", () => {
    expect(selectGoogleVoice("voxcpm2_teacher_female_in")).toEqual({
      languageCode: "en-IN",
      name: expect.stringMatching(/^en-IN-Neural2-[AD]$/),
      ssmlGender: "FEMALE",
    });
    expect(selectGoogleVoice("voxcpm2_child_male_in")).toEqual({
      languageCode: "en-IN",
      name: expect.stringMatching(/^en-IN-Neural2-[BC]$/),
      ssmlGender: "MALE",
    });
  });

  it("assigns every default persona a stable voice", () => {
    for (const agent of registry.agents) {
      const first = selectGoogleVoice(agent.voice_id);
      const second = selectGoogleVoice(agent.voice_id);
      expect(first).toEqual(second);
      expect(first.languageCode).toBe("en-IN");
      expect(first.name).toMatch(/^en-IN-Neural2-[A-D]$/);
    }
  });

  it("leaves the voice unnamed for locales without a verified pool", () => {
    expect(selectGoogleVoice("voxcpm2_host_male_us")).toEqual({
      languageCode: "en-US",
      ssmlGender: "MALE",
    });
  });

  it("maps prosody to speaking rate and pitch", () => {
    expect(googleAudioConfig({ pace: "slow", pitch: "low", intonation: "flat" })).toEqual({
      audioEncoding: "MP3",
      speakingRate: 0.9,
      pitch: -2.0,
    });
    expect(googleAudioConfig({ pace: "fast", pitch: "high", intonation: "rising" })).toEqual({
      audioEncoding: "MP3",
      speakingRate: 1.1,
      pitch: 2.0,
    });
    expect(googleAudioConfig({ pace: "moderate", pitch: "medium", intonation: "flat" })).toEqual({
      audioEncoding: "MP3",
      speakingRate: 1.0,
      pitch: 0.0,
    });
  });

  it("posts text:synthesize and returns a base64 MP3 data URL", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: JSON.parse((init?.body as string) ?? "{}") });
        return jsonResponse({ audioContent: "QUJD" });
      }),
    );
    const result = await new GoogleCloudVoiceClient().synthesize({
      text: "Welcome to class!",
      voice_id: "voxcpm2_teacher_female_in",
      prosody: { pace: "moderate", pitch: "medium", intonation: "flat" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize?key=test-key");
    expect(calls[0]!.body).toMatchObject({
      input: { text: "Welcome to class!" },
      voice: { languageCode: "en-IN", ssmlGender: "FEMALE" },
      audioConfig: { audioEncoding: "MP3" },
    });
    expect((calls[0]!.body.voice as Record<string, unknown>).name).toMatch(/^en-IN-Neural2-[AD]$/);
    expect(result.audio_url).toBe("data:audio/mpeg;base64,QUJD");
    expect(result.duration_ms).toBe(estimateSpeechDurationMs("Welcome to class!"));
  });

  it("retries once unnamed when the named voice is rejected", async () => {
    const bodies: Record<string, unknown>[] = [];
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        n += 1;
        bodies.push(JSON.parse((init?.body as string) ?? "{}"));
        return n === 1 ? jsonResponse({ error: "voice not found" }, 404) : jsonResponse({ audioContent: "QUJD" });
      }),
    );
    const result = await new GoogleCloudVoiceClient().synthesize({
      text: "Hello.",
      voice_id: "voxcpm2_child_male_in",
      prosody: { pace: "moderate", pitch: "medium", intonation: "flat" },
    });
    expect(n).toBe(2);
    expect((bodies[0]!.voice as Record<string, unknown>).name).toBeDefined();
    expect((bodies[1]!.voice as Record<string, unknown>).name).toBeUndefined();
    expect(result.audio_url).toContain("data:audio/mpeg;base64,");
  });

  it("fails fast on auth errors without retrying", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        return jsonResponse({ error: "API key not valid" }, 403);
      }),
    );
    await expect(
      new GoogleCloudVoiceClient().synthesize({
        text: "Hello.",
        voice_id: "voxcpm2_teacher_female_in",
        prosody: { pace: "moderate", pitch: "medium", intonation: "flat" },
      }),
    ).rejects.toThrowError(VoiceError);
    expect(n).toBe(1);
  });

  it("requires an API key and a valid audio payload", async () => {
    delete process.env.GOOGLE_TTS_API_KEY;
    await expect(
      new GoogleCloudVoiceClient().synthesize({
        text: "Hello.",
        voice_id: "voxcpm2_teacher_female_in",
        prosody: { pace: "moderate", pitch: "medium", intonation: "flat" },
      }),
    ).rejects.toThrowError(/GOOGLE_TTS_API_KEY/);

    process.env.GOOGLE_TTS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));
    await expect(
      new GoogleCloudVoiceClient().synthesize({
        text: "Hello.",
        voice_id: "voxcpm2_teacher_female_in",
        prosody: { pace: "moderate", pitch: "medium", intonation: "flat" },
      }),
    ).rejects.toThrowError(/audioContent/);
  });
});
