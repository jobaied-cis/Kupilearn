import type { RetrievedPassage } from "./retrieve";

/**
 * Remote retrieval via the internal `rag` Vercel service.
 *
 * `RAG_URL` is injected by the service binding declared on the `app`
 * service in vercel.json (app -> rag). It is resolved at runtime inside
 * functions only — never set it yourself, and never use it at build
 * time or in middleware.
 *
 * Returns null when the binding is absent (local dev, tests) or the
 * service is unreachable/misbehaving, so callers fall back to the
 * in-process retrieval in retrieve.ts over the same transcribed chunks.
 * An empty array is a real answer: no relevant textbook passage exists.
 */
export async function retrieveRemote(
  query: string,
  opts: { classLevel?: number; chapterId?: string; limit?: number } = {},
  fetchFn: typeof fetch = fetch,
): Promise<RetrievedPassage[] | null> {
  const base = process.env.RAG_URL;
  if (!base) return null;
  try {
    const url = new URL("retrieve", base.endsWith("/") ? base : `${base}/`);
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, ...opts }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object" || !Array.isArray((data as { chunks?: unknown }).chunks)) {
      return null;
    }
    const chunks: RetrievedPassage[] = [];
    for (const raw of (data as { chunks: unknown[] }).chunks) {
      const c = raw as Partial<RetrievedPassage>;
      if (
        typeof c.id === "string" && typeof c.text === "string" &&
        typeof c.chapterId === "string" && typeof c.chapterTitle === "string" &&
        typeof c.bookPage === "number" && typeof c.score === "number"
      ) {
        chunks.push({
          id: c.id,
          classLevel: typeof c.classLevel === "number" ? c.classLevel : 6,
          subject: typeof c.subject === "string" ? c.subject : "Mathematics",
          chapterId: c.chapterId,
          chapterTitle: c.chapterTitle,
          kind: c.kind ?? "passage",
          text: c.text,
          bookPage: c.bookPage,
          source: typeof c.source === "string" ? c.source : "",
          score: c.score,
        });
      }
    }
    return chunks;
  } catch {
    return null;
  }
}
