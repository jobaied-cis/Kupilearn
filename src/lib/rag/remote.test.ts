import { afterEach, describe, expect, it, vi } from "vitest";
import { retrieveRemote } from "./remote";

const CHUNK = {
  id: "c6m-ch5-obj-1", classLevel: 6, subject: "Mathematics",
  chapterId: "c6m-ch5", chapterTitle: "Simple Equations", kind: "objective",
  text: "Learning objective: solve simple equations", bookPage: 110,
  source: "NCTB Mathematics Class Six", score: 0.42,
};

describe("remote RAG retrieval (RAG_URL service binding)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when RAG_URL is not injected, so callers use local retrieval", async () => {
    vi.stubEnv("RAG_URL", "");
    const fetchFn = vi.fn();
    await expect(retrieveRemote("simple equation", {}, fetchFn as never)).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("posts to <RAG_URL>/retrieve and parses scored chunks", async () => {
    vi.stubEnv("RAG_URL", "https://rag.internal");
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ chunks: [CHUNK] }), { status: 200 }),
    );
    const hits = await retrieveRemote("simple equation", { classLevel: 6, limit: 8 }, fetchFn as never);
    expect(hits).toEqual([CHUNK]);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://rag.internal/retrieve");
    expect(JSON.parse(String(init.body))).toEqual({ query: "simple equation", classLevel: 6, limit: 8 });
  });

  it("returns null on service failure so callers fall back instead of failing", async () => {
    vi.stubEnv("RAG_URL", "https://rag.internal/");
    const fetchFn = vi.fn(async () => new Response("down", { status: 503 }));
    await expect(retrieveRemote("simple equation", {}, fetchFn as never)).resolves.toBeNull();
  });

  it("treats an empty chunk list as a real no-source answer, not a failure", async () => {
    vi.stubEnv("RAG_URL", "https://rag.internal/");
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ chunks: [] }), { status: 200 }),
    );
    await expect(retrieveRemote("photosynthesis", {}, fetchFn as never)).resolves.toEqual([]);
  });
});
