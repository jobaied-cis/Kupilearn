import corpus from "./corpus.json";

/** Pass mark for the curriculum mapping validator (§3.2). */
export const TEXTBOOK_SIMILARITY_THRESHOLD = 0.72;

export interface TextbookChapter {
  ncertCode: string;
  title: string;
  excerpt: string;
}

export interface TextbookCorpus {
  /** Returns the chapter entry or null when the chapter is not in the corpus. */
  searchTextbookChapter(ncertCode: string): Promise<TextbookChapter | null>;
}

export class JsonTextbookCorpus implements TextbookCorpus {
  private readonly chapters: TextbookChapter[];

  constructor(data: { chapters: TextbookChapter[] } = corpus) {
    this.chapters = data.chapters;
  }

  async searchTextbookChapter(ncertCode: string): Promise<TextbookChapter | null> {
    return this.chapters.find((c) => c.ncertCode === ncertCode) ?? null;
  }
}

/* ------------------------------------------------------------------ */
/* Similarity scoring. Default is a deterministic TF cosine over the   */
/* corpus text; production swaps in embedding cosine via the same      */
/* `SimilarityScorer` signature (see `createSimilarityScorer`).        */
/* ------------------------------------------------------------------ */

export type SimilarityScorer = (generated: string, reference: string) => number | Promise<number>;

const STOPWORDS = new Set(
  "a,an,the,and,or,but,if,then,of,at,by,for,with,about,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,is,are,was,were,be,been,being,have,has,had,do,does,did,will,would,can,could,should,it,its,this,that,these,those,as,so,than,too,very".split(","),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
  return tf;
}

/** Cosine similarity of TF vectors, 0–1. Pure and synchronous. */
export function tfCosineSimilarity(generated: string, reference: string): number {
  const a = termFrequency(tokenize(generated));
  const b = termFrequency(tokenize(reference));
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  for (const [term, count] of a) dot += count * (b.get(term) ?? 0);
  const norm = (v: Map<string, number>) =>
    Math.sqrt([...v.values()].reduce((sum, n) => sum + n * n, 0));
  return dot / (norm(a) * norm(b));
}

export interface EmbeddingClient {
  embed(texts: string[]): Promise<number[][]>;
}

/** Cosine similarity over caller-supplied embeddings. */
export function embeddingCosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  const dot = a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
  const norm = (v: number[]) => Math.sqrt(v.reduce((sum, n) => sum + n * n, 0));
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot / denom;
}

export function createSimilarityScorer(): SimilarityScorer {
  // Meta-only: no third-party embedding endpoint. TF cosine is the
  // deterministic, zero-infra scorer (embeddingCosineSimilarity remains
  // available for caller-supplied vectors in tests).
  return tfCosineSimilarity;
}
