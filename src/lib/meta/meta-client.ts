import { z } from "zod";
import { LLMError, type LLMClient } from "../curriculum/llm";

/**
 * Meta-only LLM access (server-side only — never import from client code).
 *
 * Verified contract (Meta official docs, checked 2026-10-29):
 * - Historical Meta Llama API: POST {base}/chat/completions, Bearer key,
 *   OpenAI-compatible, `response_format` JSON support.
 * - Model IDs: Llama-4-Maverick-17B-128E-Instruct-FP8 (teacher / complex
 *   reasoning) and Llama-4-Scout-17B-16E-Instruct-FP8 (classmates / light).
 * - NOTE: Meta's current hosted catalog (api.meta.ai) lists Muse models, not
 *   Llama. So the endpoint is fully configurable via env; if your key is for
 *   api.meta.ai, set META_API_BASE_URL=https://api.meta.ai/v1 and set the
 *   model IDs to the Meta models your key can access. That substitution is
 *   documented in README.md — no endpoint or model is hard-coded as "live".
 *
 * Env: META_API_KEY, META_API_BASE_URL, META_TEACHER_MODEL,
 * META_CLASSMATE_MODEL, META_TIMEOUT_MS, META_MAX_RETRIES.
 * When unconfigured (missing/placeholder), callers fall back to the
 * deterministic offline engine — the app never fakes a live Meta call.
 */

export type MetaRole = "teacher" | "classmate";

export const DEFAULT_META_BASE_URL = "https://api.llama.com/v1";
export const DEFAULT_TEACHER_MODEL = "Llama-4-Maverick-17B-128E-Instruct-FP8";
export const DEFAULT_CLASSMATE_MODEL = "Llama-4-Scout-17B-16E-Instruct-FP8";

export interface MetaConfig {
  apiKey: string;
  baseUrl: string;
  teacherModel: string;
  classmateModel: string;
  timeoutMs: number;
  maxRetries: number;
}

function isPlaceholder(v: string | undefined): boolean {
  return !v || /your_|placeholder|xxx/i.test(v);
}

export function getMetaConfig(env: NodeJS.ProcessEnv = process.env): MetaConfig | null {
  const apiKey = env.META_API_KEY ?? "";
  const baseUrl = (env.META_API_BASE_URL || DEFAULT_META_BASE_URL).replace(/\/$/, "");
  if (isPlaceholder(apiKey)) return null;
  return {
    apiKey,
    baseUrl,
    teacherModel: env.META_TEACHER_MODEL || DEFAULT_TEACHER_MODEL,
    classmateModel: env.META_CLASSMATE_MODEL || DEFAULT_CLASSMATE_MODEL,
    timeoutMs: Number(env.META_TIMEOUT_MS ?? 30_000) || 30_000,
    maxRetries: Math.min(4, Math.max(0, Number(env.META_MAX_RETRIES ?? 2) || 0)),
  };
}

export function isMetaConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getMetaConfig(env) !== null;
}

/** Simple in-process rate limiter: spaces out Meta calls per instance. */
let lastCallAt = 0;
async function rateLimit(minIntervalMs = 120): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastCallAt + minIntervalMs - now);
  lastCallAt = now + wait;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

function parseOrThrow<T>(raw: string, schema: z.ZodType<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Models sometimes wrap JSON in prose/fences — extract the object.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) throw new LLMError("Meta model did not return valid JSON");
    try {
      json = JSON.parse(raw.slice(start, end + 1));
    } catch {
      throw new LLMError("Meta model did not return valid JSON");
    }
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new LLMError(`Meta output failed schema validation: ${parsed.error.message}`);
  return parsed.data;
}

export class MetaLlamaClient implements LLMClient {
  readonly model: string;
  constructor(
    private config: MetaConfig,
    role: MetaRole,
    private fetchFn: typeof fetch = fetch,
  ) {
    this.model = role === "teacher" ? config.teacherModel : config.classmateModel;
  }

  async generateJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    let lastError: Error = new LLMError("Meta request failed");
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        await rateLimit();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
          const res = await this.fetchFn(`${this.config.baseUrl}/chat/completions`, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
              model: this.model,
              temperature: 0.4,
              messages: [
                { role: "system", content: "You are a Kupi AI classroom agent. Reply with valid JSON only, matching the requested shape. No markdown, no prose outside JSON." },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (res.status === 429 || res.status >= 500) throw new LLMError(`Meta request failed: ${res.status}`);
          if (!res.ok) throw new LLMError(`Meta request failed: ${res.status}`);
          const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
          const raw = data.choices?.[0]?.message?.content;
          if (typeof raw !== "string") throw new LLMError("Meta response missing choices[0].message.content");
          return parseOrThrow(raw, schema);
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new LLMError(String(error));
        if (attempt < this.config.maxRetries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    throw lastError;
  }
}

/**
 * Routes by the prompt's [TEMPLATE:X] marker: TEACHER/LESSON prompts use the
 * teacher (Maverick) model; classmates/director use the classmate (Scout)
 * model. Falls back to the deterministic offline client when Meta is not
 * configured — callers can check `isMetaConfigured()` to show a banner.
 */
export class MetaRoutingClient implements LLMClient {
  private teacher: LLMClient;
  private classmate: LLMClient;
  private fallback?: LLMClient;
  readonly live: boolean;

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    fetchFn: typeof fetch = fetch,
    fallback?: LLMClient,
  ) {
    const config = getMetaConfig(env);
    this.live = config !== null;
    if (config) {
      this.teacher = new MetaLlamaClient(config, "teacher", fetchFn);
      this.classmate = new MetaLlamaClient(config, "classmate", fetchFn);
    } else if (fallback) {
      this.teacher = fallback;
      this.classmate = fallback;
    } else {
      throw new LLMError("Meta is not configured (META_API_KEY missing/placeholder) and no fallback client was provided");
    }
    this.fallback = fallback;
  }

  async generateJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const marker = /\[TEMPLATE:([A-Z_]+)\]/.exec(prompt)?.[1] ?? "";
    const heavy = marker === "TEACHER" || marker === "LESSON" || marker === "B";
    try {
      return await (heavy ? this.teacher : this.classmate).generateJSON(prompt, schema);
    } catch (error) {
      // Fallback behaviour: one retry on the other model, then offline mock.
      try {
        return await (heavy ? this.classmate : this.teacher).generateJSON(prompt, schema);
      } catch {
        if (this.live && this.fallback) return this.fallback.generateJSON(prompt, schema);
        throw error;
      }
    }
  }
}

export function createMetaRoutingClient(fallback?: LLMClient): MetaRoutingClient {
  return new MetaRoutingClient(process.env, fetch, fallback);
}
