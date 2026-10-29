import { ClassroomException, type AgentDefinition, type ClassroomMode } from "./types";

/**
 * Voice pipeline. Meta Llama models do not synthesize speech, and no
 * third-party TTS is allowed in Kupi — so speech is browser-native:
 * the server delivers text (speech_audio_url: null, text_fallback mode)
 * and the client speaks it with speechSynthesis where supported.
 * MockVoiceClient remains for deterministic tests/demos only.
 */

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
  intonation: "rising" | "flat" | "downward";
}

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

/** Voice client that always falls back to browser-spoken text. */
export class BrowserVoiceClient implements VoiceClient {
  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    throw new VoiceError(`Browser speech synthesis handles "${input.voice_id}" on the client`);
  }
}

export function stableHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

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

export function createVoiceClient(): VoiceClient {
  // Default mock: deterministic placeholder URLs for tests/demos. The live
  // UI never plays these — it speaks with browser speechSynthesis instead.
  // "browser" makes the server return text_fallback (audio_url: null).
  const provider = (process.env.TTS_PROVIDER ?? "mock").toLowerCase();
  if (provider === "browser") return new BrowserVoiceClient();
  if (provider === "mock") return new MockVoiceClient();
  throw new ClassroomException("TTS_PROVIDER_UNKNOWN", "", 503, `Unknown TTS_PROVIDER: ${provider} (want browser|mock)`);
}

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
  } catch {
    return { audio_url: null, duration_ms: estimateSpeechDurationMs(input.text), mode: "text_fallback" };
  }
}
