import { CLASS6_MATH, type MathChapter } from "../nctb/math-book";
import { embedText, embeddingCosine } from "./embed";

/**
 * Local retrieval over chapter-wise textbook chunks. Embeddings are local
 * hashed TF vectors (embed.ts, "local:hash-tf-256") — the same model the
 * Python pipeline in scripts/rag writes into data/rag/chunks.jsonl — so
 * retrieval is embedding cosine over per-chapter chunks, fully offline.
 *
 * Honesty rule: chunks only contain content transcribed from the uploaded
 * textbook (contents page + chapter objectives/opening subtopics, each with
 * a book-page reference). When nothing relevant is found, callers must say
 * the source is missing — never invent chapters, exercises or page numbers.
 */

export interface RagChunk {
  id: string;
  classLevel: number;
  subject: string;
  chapterId: string;
  chapterTitle: string;
  kind: "contents" | "objective" | "subtopic" | "passage";
  text: string;
  bookPage: number;
  source: string;
}

function chapterChunks(ch: MathChapter): RagChunk[] {
  const base = { classLevel: 6, subject: "Mathematics", chapterId: ch.id, chapterTitle: ch.title, source: ch.source };
  return [
    {
      ...base, id: `${ch.id}-contents`, kind: "contents", bookPage: ch.bookPage,
      text: `Chapter ${ch.number}: ${ch.title} (${ch.titleBn}). Starts at book page ${ch.bookPage}, ends at book page ${ch.endBookPage}.`,
    },
    ...ch.objectives.map((o, i) => ({
      ...base, id: `${ch.id}-obj-${i + 1}`, kind: "objective" as const, bookPage: ch.bookPage,
      text: `Learning objective (${ch.title}): students will be able to ${o}`,
    })),
    ...ch.subtopics.map((s) => ({
      ...base, id: s.id, kind: "subtopic" as const, bookPage: s.bookPage,
      text: `Subtopic ${s.title} in ${ch.title}, book page ${s.bookPage}.`,
    })),
  ];
}

export const RAG_CHUNKS: RagChunk[] = [
  {
    id: "c6m-contents", classLevel: 6, subject: "Mathematics", chapterId: "contents", chapterTitle: "Contents",
    kind: "contents", bookPage: 4,
    text: `Contents of NCTB Mathematics Class Six: ${CLASS6_MATH.chapters.map((c) => `Chapter ${c.number} ${c.title} (page ${c.bookPage})`).join("; ")}; Answer (page 172).`,
    source: `${CLASS6_MATH.edition}, Contents`,
  },
  ...CLASS6_MATH.chapters.flatMap(chapterChunks),
];

const STOP = new Set("a,an,the,and,or,of,to,in,on,for,by,with,will,be,able,students,what,how".split(","));
export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9\u0980-\u09FF]+/).filter((t) => t.length > 1 && !STOP.has(t));
}
export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [k, v] of a) dot += v * (b.get(k) ?? 0);
  const norm = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, n) => s + n * n, 0));
  const d = norm(a) * norm(b);
  return d === 0 ? 0 : dot / d;
}

export interface RetrievedPassage extends RagChunk { score: number }

/** Every chunk carries its local embedding (same model as the Python ingestion). */
export const RAG_EMBEDDINGS: Map<string, number[]> = new Map(
  RAG_CHUNKS.map((c) => [c.id, embedText(`${c.chapterTitle} ${c.text}`)]),
);

/**
 * Embedding retrieval: embed the query once, then cosine-rank the chunk
 * embeddings for the requested class/chapter. Falls back to the TF scorer
 * only for the integer-exact evaluation helper below.
 */
export function retrieve(query: string, opts: { classLevel?: number; chapterId?: string; limit?: number } = {}): RetrievedPassage[] {
  const q = embedText(query);
  if (q.every((v) => v === 0)) return [];
  const qTokens = new Set(tokenize(query));
  return RAG_CHUNKS
    .filter((c) => (opts.classLevel === undefined || c.classLevel === opts.classLevel) && (!opts.chapterId || c.chapterId === opts.chapterId || c.chapterId === "contents"))
    .map((c) => ({ ...c, score: embeddingCosine(q, RAG_EMBEDDINGS.get(c.id) ?? []) }))
    // Hashed embeddings collide occasionally; a chunk must also share a
    // real token with the query, so unrelated queries honestly find nothing.
    .filter((c) => c.score > 0.05 && tokenize(`${c.chapterTitle} ${c.text}`).some((t) => qTokens.has(t)))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 5);
}

/** All chunks of one chapter, in book order — the content the teacher teaches from. */
export function chapterContent(chapterId: string): RagChunk[] {
  return RAG_CHUNKS
    .filter((c) => c.chapterId === chapterId)
    .sort((a, b) => a.bookPage - b.bookPage || a.id.localeCompare(b.id));
}

/** Chapter-wise chunk index: chapterId -> its chunks (contents/overview excluded). */
export function chunksByChapter(): Map<string, RagChunk[]> {
  const map = new Map<string, RagChunk[]>();
  for (const c of RAG_CHUNKS) {
    if (c.chapterId === "contents") continue;
    map.set(c.chapterId, [...(map.get(c.chapterId) ?? []), c]);
  }
  return map;
}

/** Retrieval evaluation: fraction of labelled queries whose expected chapter is in the top-k. */
export function evaluateRetrieval(cases: { query: string; chapterId: string }[], k = 3): { total: number; hits: number; accuracy: number } {
  let hits = 0;
  for (const c of cases) {
    if (retrieve(c.query, { limit: k }).some((r) => r.chapterId === c.chapterId)) hits += 1;
  }
  return { total: cases.length, hits, accuracy: cases.length ? hits / cases.length : 0 };
}
