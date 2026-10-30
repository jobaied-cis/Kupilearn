import { createHash } from "node:crypto";

/**
 * Local embedding system for the RAG chunks (no external embedding API).
 *
 * Same algorithm as scripts/rag/ingest.py `hashed_embedding`, so vectors
 * produced by the Python ingestion (data/rag/chunks.jsonl, model
 * "local:hash-tf-256") and vectors computed here at runtime are directly
 * comparable: every token is hashed (MD5) into one of 256 dimensions,
 * counted, and the vector is L2-normalized. Retrieval is cosine
 * similarity over these embeddings, filtered per class and chapter.
 */

export const EMBEDDING_DIM = 256;
export const EMBEDDING_MODEL = "local:hash-tf-256";

const STOP = new Set("a,an,the,and,or,of,to,in,on,for,by,with,will,be,able,students,what,how".split(","));

export function tokenizeForEmbedding(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9\u0980-\u09FF]+/).filter((t) => t.length > 1 && !STOP.has(t));
}

/** Deterministic hashed TF embedding, identical in shape to the Python pipeline. */
export function embedText(text: string, dim: number = EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const tok of tokenizeForEmbedding(text)) {
    const idx = parseInt(createHash("md5").update(tok, "utf8").digest("hex").slice(0, 8), 16) % dim;
    vec[idx] = (vec[idx] ?? 0) + 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** Cosine similarity. Inputs are expected to be (near-)normalized embeddings. */
export function embeddingCosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) dot += (a[i] ?? 0) * (b[i] ?? 0);
  const norm = (v: readonly number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  const d = norm(a) * norm(b);
  return d === 0 ? 0 : dot / d;
}
