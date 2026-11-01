import { z } from "zod";
import { createLLMClient, MockLLMClient, type LLMClient } from "../curriculum/llm";
import { getMetaConfig } from "../meta/meta-client";
import { GAME_AI_PROVIDER, type GameAiAdapter } from "./ai";

/**
 * Meta AI adapter for games (Step 04) — SERVER ONLY.
 *
 * This is the single door to Meta for Puzzle Quest. It reuses the
 * project's existing Meta stack (`getMetaConfig` env config and the
 * `LLMClient` contract whose live implementation is the Meta routing
 * client: teacher model muse-wonder-1.0, classmate model
 * muse-spark-1.3, verified against this project's Meta account in
 * .env.example). Timeout, bounded retries, and base rate limiting
 * already live in that client; this adapter adds per-session
 * throttling and strict structured-output validation.
 *
 * When Meta is not configured (no META_API_KEY) or LLM_PROVIDER=mock,
 * `available` is false and callers must use deterministic fallbacks —
 * the adapter never pretends a live call happened.
 */

export const AiResponseSchema = z.object({
  text: z.string().min(1).max(2000),
  question: z.string().max(300).optional(),
});
export type AiResponse = z.infer<typeof AiResponseSchema>;

export class GameAiUnavailableError extends Error {
  constructor(message = "Meta AI is not available") {
    super(message);
    this.name = "GameAiUnavailableError";
  }
}

/** Per-session throttling: minimum spacing + a hard call budget. */
export class SessionThrottle {
  private lastAt = 0;
  private count = 0;

  constructor(
    private maxCalls = 12,
    private minIntervalMs = 800,
    private now: () => number = () => Date.now(),
  ) {}

  check(): void {
    const at = this.now();
    if (this.count >= this.maxCalls) throw new GameAiUnavailableError("AI help limit reached for this session");
    if (at - this.lastAt < this.minIntervalMs) throw new GameAiUnavailableError("AI help is cooling down — try again in a moment");
    this.lastAt = at;
    this.count += 1;
  }

  get callsUsed(): number {
    return this.count;
  }
}

export interface MetaGameAiDeps {
  client?: LLMClient;
  env?: NodeJS.ProcessEnv;
}

export class MetaGameAiAdapter implements GameAiAdapter {
  readonly provider = GAME_AI_PROVIDER;
  readonly available: boolean;
  private client: LLMClient | null;

  constructor(deps: MetaGameAiDeps = {}) {
    const env = deps.env ?? process.env;
    if (deps.client) {
      this.client = deps.client;
      this.available = true;
      return;
    }
    const provider = (env.LLM_PROVIDER ?? "meta").toLowerCase();
    const configured = getMetaConfig(env) !== null;
    this.available = provider === "meta" && configured;
    this.client = this.available ? createLLMClient() : null;
  }

  /** Model label for the role, from the verified project configuration. */
  modelFor(role: "teacher" | "classmate", env: NodeJS.ProcessEnv = process.env): string | null {
    const config = getMetaConfig(env);
    if (!config) return null;
    return role === "teacher" ? config.teacherModel : config.classmateModel;
  }

  async complete(role: "teacher" | "classmate", prompt: string, throttle?: SessionThrottle): Promise<AiResponse> {
    if (!this.available || !this.client) throw new GameAiUnavailableError();
    throttle?.check();
    // The existing Meta routing client selects teacher/classmate model
    // by the [TEMPLATE:X] marker.
    const marker = role === "teacher" ? "TEACHER" : "CLASSMATE";
    return this.client.generateJSON(`${prompt}\n[TEMPLATE:${marker}]`, AiResponseSchema);
  }

  // GameAiAdapter contract (Step 01): deterministic prompt shapes.
  async hintFor(input: { topicTitle: string; prompt: string; grade: number }): Promise<string> {
    const res = await this.complete("teacher",
      `Give ONE gentle hint (no final answer) for a Class ${input.grade} student.\nTopic: ${input.topicTitle}\nQuestion: ${input.prompt}\nReply JSON: {"text": "..."}`);
    return res.text;
  }

  async explain(input: { topicTitle: string; prompt: string; correct: boolean }): Promise<string> {
    const res = await this.complete("teacher",
      `Briefly explain the idea behind this Class question for a school student. The student's answer was ${input.correct ? "correct" : "incorrect"} — be supportive either way.\nTopic: ${input.topicTitle}\nQuestion: ${input.prompt}\nReply JSON: {"text": "..."}`);
    return res.text;
  }
}

export function createMetaGameAiAdapter(deps: MetaGameAiDeps = {}): MetaGameAiAdapter {
  return new MetaGameAiAdapter(deps);
}

/** Test/dev double: deterministic, character-faithful, never leaks answers. */
export function createMockGameAiAdapter(responder?: (prompt: string) => string): MetaGameAiAdapter {
  const client: LLMClient = {
    async generateJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
      const text = responder ? responder(prompt) : "Think about what changes step by step. What is the first small step you can try?";
      return schema.parse({ text } as unknown);
    },
  };
  void MockLLMClient;
  return new MetaGameAiAdapter({ client });
}
