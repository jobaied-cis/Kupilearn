# Kupi NCTB RAG pipeline (local only)

No third-party AI APIs anywhere in this pipeline. Embeddings are local
(`hash` deterministic vectors by default, or a locally installed
sentence-transformers model with `--embedder sbert`).

## Setup

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r scripts\rag\requirements.txt
```

## Ingest the uploaded textbook

```powershell
.venv\Scripts\python.exe scripts\rag\ingest.py Book\Math_Book.pdf --class-level 6
.venv\Scripts\python.exe scripts\rag\evaluate.py
```

Status is written to `data/rag/status.json`; chunks to `data/rag/chunks.jsonl`.
Re-running the same file is a no-op (sha256 duplicate detection).

## Scanned PDFs (important)

`Book/Math_Book.pdf` is a **scanned** book: 182 pages, no text layer.
The ingester detects this and tries OCR with a **local** Tesseract binary
(`eng+ben` language data + `pytesseract`/`Pillow` in `.venv`). If Tesseract
is not installed it records `status: "needs_ocr"` in `data/rag/status.json`
and writes **no invented chunks**. Install Tesseract locally, re-run, and
the full chapter text (formulas, examples, exercises, page numbers) becomes
searchable.

Until OCR runs, the app retrieves from the verified transcription in
`data/rag/manual/class6-math-contents.json` (Contents page + each chapter's
printed learning objectives and first subtopic, with book-page references),
which mirrors `src/lib/nctb/math-book.ts`. Regenerate it after editing that
file — do not hand-invent textbook content.

## PostgreSQL + pgvector (production store)

```powershell
docker compose up -d postgres
$env:DATABASE_URL = "postgresql://kupi:kupi@localhost:5433/kupi"
psql $env:DATABASE_URL -f scripts\rag\schema.sql
```

Then load `data/rag/chunks.jsonl` into `rag_chunks` (any psql/JSON loader;
vectors are stored in the JSONL `embedding` field, model
`local:hash-tf-256`, 256 dimensions — keep the schema dimension in sync if
you switch to sbert, 384 dimensions).

## Guarantees

- Every chunk carries class, chapter, book page and source.
- The AI must cite these chunks; when retrieval finds nothing, the lesson
  API returns `missingSource: true` and the UI says the source is missing
  instead of inventing chapters, exercises or page numbers.
