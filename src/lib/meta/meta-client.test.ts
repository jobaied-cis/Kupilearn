import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MetaLlamaClient, MetaRoutingClient, getMetaConfig, isMetaConfigured } from "./meta-client";
import { MockLLMClient } from "../curriculum/llm";

const schema = z.object({ ok: z.boolean() });
const ENV = {
  META_API_KEY: "test-key",
  META_API_BASE_URL: "https://api.llama.com/v1",
  META_TEACHER_MODEL: "Llama-4-Maverick-17B-128E-Instruct-FP8",
  META_CLASSMATE_MODEL: "Llama-4-Scout-17B-16E-Instruct-FP8",
} as unknown as NodeJS.ProcessEnv;

function fetchReturning(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("Meta config", () => {
  it("treats missing/placeholder keys as unconfigured", () => {
    expect(isMetaConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isMetaConfigured({ META_API_KEY: "your_key_here" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(getMetaConfig(ENV)?.teacherModel).toContain("Maverick");
    expect(getMetaConfig(ENV)?.classmateModel).toContain("Scout");
  });
});

describe("MetaLlamaClient", () => {
  it("posts chat/completions with bearer key and validates JSON", async () => {
    const fetchFn = fetchReturning({ choices: [{ message: { content: '{"ok":true}' } }] });
    const client = new MetaLlamaClient(getMetaConfig(ENV)!, "teacher", fetchFn);
    await expect(client.generateJSON("hi", schema)).resolves.toEqual({ ok: true });
    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.llama.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body as string).model).toContain("Maverick");
  });

  it("retries on 500 then succeeds", async () => {
    let n = 0;
    const fetchFn = vi.fn(async () => {
      n += 1;
      return n === 1
        ? new Response("oops", { status: 500 })
        : new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new MetaLlamaClient(getMetaConfig(ENV)!, "classmate", fetchFn);
    await expect(client.generateJSON("hi", schema)).resolves.toEqual({ ok: true });
    expect(n).toBe(2);
  });

  it("rejects schema-invalid output after retries", async () => {
    const client = new MetaLlamaClient(getMetaConfig({ ...ENV, META_MAX_RETRIES: "0" })!, "teacher", fetchReturning({ choices: [{ message: { content: '{"nope":1}' } }] }));
    await expect(client.generateJSON("hi", schema)).rejects.toThrow();
  });
});

describe("MetaRoutingClient fallback", () => {
  it("uses the offline fallback when Meta is unconfigured", async () => {
    const client = new MetaRoutingClient({} as unknown as NodeJS.ProcessEnv, fetch, new MockLLMClient());
    expect(client.live).toBe(false);
    const out = await client.generateJSON("[TEMPLATE:TEACHER]\n- Display Name: Rakib Sir", z.object({ text: z.string() }));
    expect(out.text.length).toBeGreaterThan(0);
  });
});
