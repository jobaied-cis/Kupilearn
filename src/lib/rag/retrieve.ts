import { CLASS6_MATH, type MathChapter } from "../nctb/math-book";

/**
 * Local retrieval over textbook chunks (no third-party APIs, no embeddings
 * service). Scoring is deterministic TF cosine — the same zero-infra scorer
 * used by the curriculum engine. The Python pipeline in scripts/rag can
 * additionally produce pgvector embeddings (local models) for production;
 * this in-app retriever always works offline.
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
function tf(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}
export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [k, v] of a) dot += v * (b.get(k) ?? 0);
  const norm = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, n) => s + n * n, 0));
  const d = norm(a) * norm(b);
  return d === 0 ? 0 : dot / d;
}

export interface RetrievedPassage extends RagChunk { score: number }

export function retrieve(query: string, opts: { classLevel?: number; chapterId?: string; limit?: number } = {}): RetrievedPassage[] {
  const q = tf(tokenize(query));
  if (q.size === 0) return [];
  return RAG_CHUNKS
    .filter((c) => (opts.classLevel === undefined || c.classLevel === opts.classLevel) && (!opts.chapterId || c.chapterId === opts.chapterId || c.chapterId === "contents"))
    .map((c) => ({ ...c, score: cosine(q, tf(tokenize(`${c.chapterTitle} ${c.text}`))) }))
    .filter((c) => c.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 5);
}

/** Retrieval evaluation: fraction of labelled queries whose expected chapter is in the top-k. */
export function evaluateRetrieval(cases: { query: string; chapterId: string }[], k = 3): { total: number; hits: number; accuracy: number } {
  let hits = 0;
  for (const c of cases) {
    if (retrieve(c.query, { limit: k }).some((r) => r.chapterId === c.chapterId)) hits += 1;
  }
  return { total: cases.length, hits, accuracy: cases.length ? hits / cases.length : 0 };
}
