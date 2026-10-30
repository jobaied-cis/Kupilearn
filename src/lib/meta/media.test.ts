import { describe, expect, it, vi } from "vitest";
import { generateTopicImage, transcribeAudio } from "./media";

const ENV = { META_API_KEY: "test-key", META_API_BASE_URL: "https://api.meta.ai/v1" };

describe("Meta media", () => {
  it("generates a topic image as a data URL", async () => {
    const prev = process.env;
    process.env = { ...prev, ...ENV } as NodeJS.ProcessEnv;
    try {
      const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: "UklGRg==" }] }), { status: 200 })) as unknown as typeof fetch;
      const url = await generateTopicImage("balance scale equation", fetchFn);
      expect(url).toBe("data:image/webp;base64,UklGRg==");
      const [endpoint, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(endpoint).toBe("https://api.meta.ai/v1/images/generations");
      expect(JSON.parse(init.body as string).model).toBe("muse-image-1.0");
    } finally {
      process.env = prev;
    }
  });

  it("returns null (honest fallback) when Meta fails or is unconfigured", async () => {
    const prev = process.env;
    process.env = { ...prev, META_API_KEY: "" } as NodeJS.ProcessEnv;
    try {
      expect(await generateTopicImage("x", fetch)).toBeNull();
      expect(await transcribeAudio("AAAA", "wav", fetch)).toBeNull();
    } finally {
      process.env = prev;
    }
  });

  it("transcribes audio through chat input_audio", async () => {
    const prev = process.env;
    process.env = { ...prev, ...ENV } as NodeJS.ProcessEnv;
    try {
      const fetchFn = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "I think x equals three" } }] }), { status: 200 })) as unknown as typeof fetch;
      await expect(transcribeAudio("QUJD", "wav", fetchFn)).resolves.toBe("I think x equals three");
      const [, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { model: string; messages: { content: { type: string }[] }[] };
      expect(body.model).toBe("muse-spark-1.3");
      expect(body.messages[0]?.content[0]?.type).toBe("input_audio");
    } finally {
      process.env = prev;
    }
  });
});
