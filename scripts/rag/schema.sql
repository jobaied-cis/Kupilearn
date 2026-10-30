-- Kupi RAG store: PostgreSQL + pgvector (local/self-hosted only).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_documents (
  sha256 TEXT PRIMARY KEY,
  file TEXT NOT NULL,
  class_level INT NOT NULL,
  pages INT DEFAULT 0,
  extraction TEXT DEFAULT '',
  status TEXT DEFAULT 'ingested',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  doc_sha256 TEXT REFERENCES rag_documents(sha256),
  class_level INT NOT NULL,
  subject TEXT NOT NULL,
  chapter_id TEXT DEFAULT '',
  chapter_title TEXT DEFAULT '',
  kind TEXT DEFAULT 'passage',
  book_page INT DEFAULT 0,
  source TEXT DEFAULT '',
  text TEXT NOT NULL,
  has_formula BOOLEAN DEFAULT false,
  has_example BOOLEAN DEFAULT false,
  embedding vector(256),
  embedding_model TEXT DEFAULT 'local:hash-tf-256'
);

CREATE INDEX IF NOT EXISTS rag_chunks_class_chapter ON rag_chunks (class_level, chapter_id);
-- Cosine search:  SELECT * FROM rag_chunks ORDER BY embedding <=> $1::vector LIMIT 5;
