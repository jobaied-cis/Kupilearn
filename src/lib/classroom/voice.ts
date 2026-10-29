import { ClassroomException, type AgentDefinition, type ClassroomMode } from "./types";

/* ------------------------------------------------------------------ */
/* Voice pipeline (§5). Server side owns LLM + TTS; VAD/STT run in the */
/* client or media gateway and arrive here as text (student_input).    */
/*                                                                     */
/* Latency budget (streaming pipeline): VAD ≤200ms, STT ≤300ms, LLM    */
/* first token ≤400ms, TTS first chunk ≤300ms; perceived ≤1.2s for      */
/* teacher turns and ≤800ms for classmate interjections.               */
/* ------------------------------------------------------------------ */

export const LATENCY_BUDGET_MS = {
  vadEndpointing: 200,
  sttFinalization: 300,
  llmFirstToken: 400,
  ttsFirstChunk: 300,
  teacherPerceived: 1200,
  classmatePerceived: 800,
} as const;

export interface Prosody {
  pace: "slow" | "moderate" | "fast";
  pitch: "low" | "medium" | "high";
  /** Rising on questions (curious), downward on challenges (critical). */
  intonation: "rising" | "flat" | "downward";
}

/**
 * Prosodic cues are part of the persona (§5.2): teacher is moderate and
 * clear; the curious classmate is faster/higher with rising intonation;
 * the critical classmate is steady/lower with downward intonation.
 */
export function prosodyForAgent(agent: AgentDefinition): Prosody {
  const traits = agent.persona_traits;
  if (agent.role === "teacher") {
    return { pace: traits.pace ?? "moderate", pitch: "medium", intonation: "flat" };
  }
  if (agent.role === "assistant") {
    return { pace: "moderate", pitch: "medium", intonation: "rising" };
  }
  const curiosity = traits.curiosity ?? 0.5;
  const confidence = traits.confidence ?? 0.5;
  return {
    pace: curiosity >= 0.8 ? "fast" : (traits.pace ?? "moderate"),
    pitch: curiosity >= 0.8 ? "high" : confidence >= 0.7 ? "low" : "medium",
    intonation: curiosity >= 0.8 ? "rising" : confidence >= 0.7 ? "downward" : "flat",
  };
}

export interface SynthesizeInput {
  text: string;
  voice_id: string;
  prosody: Prosody;
}

export interface SynthesizeResult {
  audio_url: string;
  duration_ms: number;
}

export interface VoiceClient {
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}

export class VoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceError";
  }
}

/* ------------------------------------------------------------------ */
/* Mock client — deterministic fixtures for dev, tests, and demos.     */
/* ------------------------------------------------------------------ */

export function stableHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Words-per-minute reading estimate used for fallback durations. */
export function estimateSpeechDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(600, Math.ceil((words / 150) * 60_000));
}

export class MockVoiceClient implements VoiceClient {
  calls: SynthesizeInput[] = [];

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    this.calls.push(input);
    return {
      audio_url: `mock://tts/${input.voice_id}/${stableHash(input.text)}.wav`,
      duration_ms: estimateSpeechDurationMs(input.text),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Generic HTTP client (BYO TTS provider): POST {text, voice_id,        */
/* prosody} to TTS_API_URL, expects {audio_url, duration_ms}.          */
/* ------------------------------------------------------------------ */

export class HttpVoiceClient implements VoiceClient {
  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const url = process.env.TTS_API_URL;
    if (!url) throw new VoiceError("Missing env var TTS_API_URL");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.TTS_API_KEY) headers.authorization = `Bearer ${process.env.TTS_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: input.text, voice_id: input.voice_id, prosody: input.prosody }),
    });
    if (!res.ok) throw new VoiceError(`TTS request failed: ${res.status}`);
    const data = (await res.json()) as { audio_url?: unknown; duration_ms?: unknown };
    if (typeof data.audio_url !== "string" || typeof data.duration_ms !== "number") {
      throw new VoiceError("TTS response missing audio_url/duration_ms");
    }
    return { audio_url: data.audio_url, duration_ms: Math.max(0, Math.round(data.duration_ms)) };
  }
}

export function createVoiceClient(): VoiceClient {
  const provider = (process.env.TTS_PROVIDER ?? "mock").toLowerCase();
  if (provider === "mock") return new MockVoiceClient();
  if (provider === "http") return new HttpVoiceClient();
  if (provider === "google") return new GoogleCloudVoiceClient();
  throw new ClassroomException("TTS_PROVIDER_UNKNOWN", "", 503, `Unknown TTS_PROVIDER: ${provider}`);
}

/* ------------------------------------------------------------------ */
/* Google Cloud Text-to-Speech backend (TTS_PROVIDER=google).           */
/* Registry voice_ids (<provider>_<persona>_<gender>_<locale>) resolve */
/* deterministically to Google voices, so each persona keeps one voice */
/* across the session (§5.2). Auth: GOOGLE_TTS_API_KEY (API key).       */
/* Audio returns as a base64 MP3 data URL; production deployments      */
/* should swap in object storage + CDN URLs.                           */
/* ------------------------------------------------------------------ */

export const GOOGLE_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

const GOOGLE_TTS_LOCALES: Record<string, string> = {
  in: "en-IN",
  us: "en-US",
  gb: "en-GB",
  au: "en-AU",
};

/** Verified against the supported-voices list (Neural2, en-IN). */
const GOOGLE_TTS_FEMALE_POOL = ["en-IN-Neural2-A", "en-IN-Neural2-D"];
const GOOGLE_TTS_MALE_POOL = ["en-IN-Neural2-B", "en-IN-Neural2-C"];

export interface GoogleVoiceSelection {
  languageCode: string;
  /** Omitted → Google picks its default voice for language + gender. */
  name?: string;
  ssmlGender: "FEMALE" | "MALE" | "NEUTRAL";
}

export function selectGoogleVoice(voiceId: string): GoogleVoiceSelection {
  const segments = voiceId.split("_");
  const genderSegment = segments[segments.length - 2] ?? "";
  const localeSegment = segments[segments.length - 1] ?? "";
  const ssmlGender =
    genderSegment === "female" ? "FEMALE" : genderSegment === "male" ? "MALE" : "NEUTRAL";
  const languageCode = GOOGLE_TTS_LOCALES[localeSegment] ?? "en-IN";
  if (languageCode !== "en-IN") return { languageCode, ssmlGender };
  const pool =
    ssmlGender === "MALE"
      ? GOOGLE_TTS_MALE_POOL
      : ssmlGender === "FEMALE"
        ? GOOGLE_TTS_FEMALE_POOL
        : [...GOOGLE_TTS_FEMALE_POOL, ...GOOGLE_TTS_MALE_POOL];
  return { languageCode, name: pool[Number.parseInt(stableHash(voiceId), 16) % pool.length], ssmlGender };
}

export function googleAudioConfig(prosody: Prosody): {
  audioEncoding: "MP3";
  speakingRate: number;
  pitch: number;
} {
  // Intonation (rising/downward) has no REST equivalent; persona
  // distinctiveness there comes from the assigned voice itself.
  return {
    audioEncoding: "MP3",
    speakingRate: prosody.pace === "slow" ? 0.9 : prosody.pace === "fast" ? 1.1 : 1.0,
    pitch: prosody.pitch === "low" ? -2.0 : prosody.pitch === "high" ? 2.0 : 0.0,
  };
}

export class GoogleCloudVoiceClient implements VoiceClient {
  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!apiKey) throw new VoiceError("Missing env var GOOGLE_TTS_API_KEY");
    const voice = selectGoogleVoice(input.voice_id);
    const audioConfig = googleAudioConfig(input.prosody);
    const attempts = voice.name ? [voice.name, undefined] : [undefined];
    const errors: string[] = [];
    for (const name of attempts) {
      const res = await fetch(`${GOOGLE_TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { text: input.text },
          voice: {
            languageCode: voice.languageCode,
            ...(name ? { name } : {}),
            ssmlGender: voice.ssmlGender,
          },
          audioConfig,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { audioContent?: unknown };
        if (typeof data.audioContent !== "string" || data.audioContent.length === 0) {
          throw new VoiceError("Google TTS response missing audioContent");
        }
        return {
          audio_url: `data:audio/mpeg;base64,${data.audioContent}`,
          duration_ms: estimateSpeechDurationMs(input.text),
        };
      }
      errors.push(`${res.status} ${(await safeBodySnippet(res)).slice(0, 200)}`);
      // Only a rejected voice name heals on retry (unnamed fallback);
      // auth/quota/rate errors fail fast.
      if (res.status !== 400 && res.status !== 404) break;
      if (name === undefined) break;
    }
    throw new VoiceError(`Google TTS request failed: ${errors.join(" | ")}`);
  }
}

async function safeBodySnippet(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return res.statusText;
  }
}

/* ------------------------------------------------------------------ */
/* TTS with text fallback (§8): on synthesis failure the turn still     */
/* delivers as text (speech_audio_url null) and the classroom drops     */
/* into text_fallback mode, where the Director throttles classmate      */
/* interjections. Never throws for synthesis failures.                 */
/* ------------------------------------------------------------------ */

export interface SpeechOutcome {
  audio_url: string | null;
  duration_ms: number;
  mode: ClassroomMode;
}

export async function synthesizeSpeechOrFallback(
  voice: VoiceClient,
  input: SynthesizeInput,
): Promise<SpeechOutcome> {
  try {
    const result = await voice.synthesize(input);
    return { audio_url: result.audio_url, duration_ms: result.duration_ms, mode: "voice" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[classroom] TTS failed (${detail}); falling back to text mode.`);
    return { audio_url: null, duration_ms: estimateSpeechDurationMs(input.text), mode: "text_fallback" };
  }
}
