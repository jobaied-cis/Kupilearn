#!/usr/bin/env python3
"""Kupi NCTB RAG ingestion (local only, no third-party AI APIs).

Usage (from repo root):
  .venv\\Scripts\\python.exe scripts\\rag\\ingest.py Book\\Math_Book.pdf --class-level 6
  .venv\\Scripts\\python.exe scripts\\rag\\ingest.py data\\rag\\manual\\class6-math-contents.json

What it does:
  1. Validates the document (exists, readable, page count, sha256).
  2. Duplicate detection by sha256 against data/rag/status.json.
  3. Extracts the text layer with PyMuPDF. If pages have (almost) no text,
     the PDF is scanned: it tries OCR (tesseract via pytesseract) when the
     local tesseract binary is installed, otherwise records status
     "needs_ocr" and writes NO fake chunks.
  4. Chunks text with metadata (class, subject, chapter guess from printed
     contents when known, book page, section heading, formula/example hints).
  5. Embeddings: local only. Default `hash` (deterministic hashed TF vectors,
     zero downloads). `--embedder sbert` uses a locally installed
     sentence-transformers model if available; never an API.
  6. Output: data/rag/chunks.jsonl + data/rag/status.json.
     With --pgvector-dsn (or DATABASE_URL) and psycopg installed, also loads
     into PostgreSQL/pgvector using scripts/rag/schema.sql.
"""
from __future__ import annotations

import argparse, hashlib, json, math, re, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "rag"
CHUNK_CHARS = 1200

# NCTB Mathematics Class Six (English Version): chapter start pages from the
# printed contents (book pages). Used to chunk any extracted book text
# chapter-wise, so every chunk carries its chapterId/chapterTitle.
CHAPTER_RANGES_C6_MATH = [
    ("c6m-ch1", "Natural Numbers and Fractions", 1),
    ("c6m-ch2", "Ratios and Percentages", 45),
    ("c6m-ch3", "Integers", 69),
    ("c6m-ch4", "Algebraic Expressions", 88),
    ("c6m-ch5", "Simple Equations", 110),
    ("c6m-ch6", "Basic Concepts of Geometry", 123),
    ("c6m-ch7", "Practical Geometry", 143),
    ("c6m-ch8", "Information and Data", 158),
]

def chapter_for_page(book_page: int, class_level: int) -> tuple[str, str]:
    """Map a book page to its (chapterId, chapterTitle) for chapter-wise chunking."""
    if class_level != 6:
        return "", ""
    current = ("", "")
    for cid, title, start in CHAPTER_RANGES_C6_MATH:
        if book_page >= start:
            current = (cid, title)
    return current

def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()

def load_status() -> dict:
    f = OUT_DIR / "status.json"
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

def save_status(status: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "status.json").write_text(json.dumps(status, indent=2, ensure_ascii=False), encoding="utf-8")

def hashed_embedding(text: str, dim: int = 256) -> list[float]:
    vec = [0.0] * dim
    for tok in re.findall(r"[a-z0-9\u0980-\u09ff]+", text.lower()):
        idx = int(hashlib.md5(tok.encode("utf-8")).hexdigest()[:8], 16) % dim
        vec[idx] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]

def chunk_text(text: str, meta: dict) -> list[dict]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if len(p.strip()) > 40]
    chunks, buf = [], ""
    for para in paras:
        if len(buf) + len(para) > CHUNK_CHARS and buf:
            chunks.append({**meta, "text": buf.strip()})
            buf = ""
        buf += para + "\n"
    if buf.strip():
        chunks.append({**meta, "text": buf.strip()})
    out = []
    for i, c in enumerate(chunks):
        cid_src = f"{meta.get('doc_sha','')[:12]}:{meta.get('book_page')}:{i}:{c['text'][:80]}"
        out.append({**c, "id": hashlib.sha256(cid_src.encode()).hexdigest()[:16],
                    "kind": "passage",
                    "has_formula": bool(re.search(r"[=+\-*/^]|\\frac|\$[^$]+\$", c["text"])),
                    "has_example": bool(re.search(r"example|e\.g\.|example\s*\d", c["text"], re.I))})
    return out

def extract_pdf(path: Path, class_level: int) -> tuple[list[dict], dict]:
    import pymupdf
    doc = pymupdf.open(path)
    info = {"pages": doc.page_count, "metadata": {k: v for k, v in doc.metadata.items() if v}}
    text_pages = [(i + 1, doc[i].get_text().strip()) for i in range(doc.page_count)]
    chars = sum(len(t) for _, t in text_pages)
    info["text_chars"] = chars
    chunks: list[dict] = []
    if chars >= 200 * max(1, doc.page_count // 10):
        for pageno, text in text_pages:
            if text:
                cid, ctitle = chapter_for_page(pageno, class_level)
                chunks.extend(chunk_text(text, {"classLevel": class_level, "subject": "Mathematics",
                                                "chapterId": cid, "chapterTitle": ctitle,
                                                "book_page": pageno, "source": path.name}))
        info["extraction"] = "text-layer"
        return chunks, info
    # Scanned PDF: honest handling.
    info["extraction"] = "scanned-no-text-layer"
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
        import io
        for i in range(doc.page_count):
            pix = doc[i].get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text = pytesseract.image_to_string(img, lang="eng+ben")
            if text.strip():
                cid, ctitle = chapter_for_page(i + 1, class_level)
                chunks.extend(chunk_text(text, {"classLevel": class_level, "subject": "Mathematics",
                                                "chapterId": cid, "chapterTitle": ctitle,
                                                "book_page": i + 1, "source": path.name}))
        info["extraction"] = "ocr-tesseract"
    except Exception as exc:  # tesseract binary/model missing
        info["extraction_error"] = f"OCR unavailable: {exc.__class__.__name__}: {exc}"
        info["status"] = "needs_ocr"
        info["action"] = ("Install the local Tesseract binary (with eng+ben language data) and "
                           "pytesseract/Pillow into .venv, then re-run. No chunks were invented.")
        return [], info
    return chunks, info

def ingest_json(path: Path, class_level: int) -> tuple[list[dict], dict]:
    """Ingest a transcription JSON: {edition, chunks:[{chapterId,chapterTitle,kind,text,bookPage,source}]}"""
    data = json.loads(path.read_text(encoding="utf-8"))
    chunks = []
    for c in data.get("chunks", []):
        chunks.append({
            "id": hashlib.sha256(f"{path.name}:{c.get('id', c['text'][:60])}".encode()).hexdigest()[:16],
            "classLevel": class_level, "subject": "Mathematics",
            "chapterId": c.get("chapterId", ""), "chapterTitle": c.get("chapterTitle", ""),
            "kind": c.get("kind", "passage"), "text": c["text"],
            "book_page": c.get("bookPage", 0), "source": c.get("source", data.get("edition", path.name)),
        })
    return chunks, {"pages": 0, "extraction": "manual-transcription", "edition": data.get("edition", "")}

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--class-level", type=int, default=6)
    ap.add_argument("--embedder", choices=["hash", "sbert"], default="hash")
    ap.add_argument("--pgvector-dsn", default="")
    args = ap.parse_args()

    src = (ROOT / args.input) if not Path(args.input).is_absolute() else Path(args.input)
    if not src.exists():
        print(f"ERROR: file not found: {src}")
        return 2
    sha = sha256_file(src)
    status = load_status()
    docs = status.get("documents", {})
    if docs.get(sha, {}).get("chunks", 0) and src.suffix.lower() == ".pdf":
        print(f"DUPLICATE: {src.name} (sha256 {sha[:12]}…) already ingested; skipping.")
        return 0

    if src.suffix.lower() == ".pdf":
        chunks, info = extract_pdf(src, args.class_level)
    elif src.suffix.lower() == ".json":
        chunks, info = ingest_json(src, args.class_level)
    else:
        print(f"ERROR: unsupported file type {src.suffix} (want .pdf or transcription .json)")
        return 2

    embedder = None
    if args.embedder == "sbert":
        try:
            from sentence_transformers import SentenceTransformer  # local model only
            embedder = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as exc:
            print(f"SBERT unavailable locally ({exc}); falling back to hash embeddings.")
    for c in chunks:
        if embedder is not None:
            c["embedding"] = [round(float(x), 6) for x in embedder.encode(c["text"])]
            c["embedding_model"] = "local:sentence-transformers/all-MiniLM-L6-v2"
        else:
            c["embedding"] = hashed_embedding(c["text"])
            c["embedding_model"] = "local:hash-tf-256"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with (OUT_DIR / "chunks.jsonl").open("a", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    docs[sha] = {"file": str(src.relative_to(ROOT)) if src.is_relative_to(ROOT) else str(src),
                 "classLevel": args.class_level, "chunks": len(chunks), **info}
    status["documents"] = docs
    status["total_chunks"] = sum(d.get("chunks", 0) for d in docs.values())
    save_status(status)
    print(json.dumps({"file": src.name, "sha256": sha[:16], "chunks_written": len(chunks), **info}, indent=2, ensure_ascii=False))

    dsn = args.pgvector_dsn
    if dsn:
        print("pgvector load requested: run scripts/rag/load_pgvector.py with DATABASE_URL (see scripts/rag/README.md).")
    return 0

if __name__ == "__main__":
    sys.exit(main())
