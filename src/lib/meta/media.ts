import { getMetaConfig } from "./meta-client";

/**
 * Meta media APIs (server-side only), verified against the provided key at
 * https://api.meta.ai/v1:
 * - Image generation: POST /images/generations, model muse-image-1.0,
 *   returns b64_json (WebP). Used for one visualization per lesson topic.
 * - Speech-to-text: POST /chat/completions with an `input_audio` content
 *   part, model muse-spark-1.3 — the account has no /audio/transcriptions
 *   route and no TTS model (teacher speech stays browser-native).
 */

export const DEFAULT_IMAGE_MODEL = "muse-image-1.0";
export const DEFAULT_STT_MODEL = "muse-spark-1.3";

function authHeaders(apiKey: string): Record<string, string> {
  return { "content-type": "application/json", authorization: `Bearer ${apiKey}` };
}

const imageCache = new Map<string, string>();

/** Generate one educational image; returns a data URL, or null when Meta is unavailable. */
export async function generateTopicImage(prompt: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  const config = getMetaConfig();
  if (!config) return null;
  const cached = imageCache.get(prompt);
  if (cached) return cached;
  try {
    const res = await fetchFn(`${config.baseUrl}/images/generations`, {
      method: "POST",
      headers: authHeaders(config.apiKey),
      body: JSON.stringify({
        model: process.env.META_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
        prompt: `${prompt} Educational whiteboard illustration for school students, clear labels, simple shapes, bright colours, no text errors, English labels only.`,
        size: "1024x1024",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      const url = `data:image/webp;base64,${b64}`;
      if (imageCache.size > 40) imageCache.clear();
      imageCache.set(prompt, url);
      return url;
    }
    return data.data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

/** Transcribe recorded student audio (base64 WAV/WebM) with Meta; "" when nothing is heard. */
export async function transcribeAudio(audioBase64: string, format: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  const config = getMetaConfig();
  if (!config) return null;
  try {
    const res = await fetchFn(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: authHeaders(config.apiKey),
      body: JSON.stringify({
        model: process.env.META_STT_MODEL || DEFAULT_STT_MODEL,
        messages: [{
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: audioBase64, format } },
            { type: "text", text: "Transcribe the student's spoken words exactly. Reply with the transcript only, no quotes, no commentary. If there is no speech, reply with an empty string." },
          ],
        }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : "";
  } catch {
    return null;
  }
}
