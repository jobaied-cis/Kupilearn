#!/usr/bin/env python3
"""Kupi RAG retrieval service (internal Vercel service, stdlib-only ASGI).

This is the HTTP face of the local pipeline in this directory. Ingestion
stays offline (`ingest.py`); this app only serves retrieval over chunks
that already exist:

  1. `data/rag/chunks.jsonl` written by `ingest.py`, when present, else
  2. `data/rag/manual/class6-math-contents.json` (verified transcription).

Embeddings use the same deterministic hashed-TF vectors as
`ingest.py:hashed_embedding` ("local:hash-tf-256", 256 dims), so scores
are comparable with the TypeScript retrieval in `src/lib/rag/`.

Routes (internal only — reached via the `RAG_URL` service binding, never
a public rewrite):
  GET  /health            -> {"service": "rag", "chunks": N, ...}
  POST /retrieve          -> {"chunks": [RetrievedPassage, ...]}
       body: {"query": str, "classLevel"?: int, "chapterId"?: str,
              "limit"?: int}

Honesty rule (same as the app): a chunk must share a real token with the
query and score above threshold, otherwise nothing is returned — callers
must say the source is missing instead of inventing textbook content.
"""
from __future__ import annotations

import hashlib, json, math, os, re
from pathlib import Path
from urllib.parse import parse_qs

DIM = 256
TOKEN_RE = re.compile(r"[a-z0-9\u0980-\u09ff]+")
STOP = set("a,an,the,and,or,of,to,in,on,for,by,with,will,be,able,students,what,how".split(","))


def hashed_embedding(text: str, dim: int = DIM) -> list[float]:
    """Identical algorithm to ingest.py:hashed_embedding."""
    vec = [0.0] * dim
    for tok in TOKEN_RE.findall(text.lower()):
        idx = int(hashlib.md5(tok.encode("utf-8")).hexdigest()[:8], 16) % dim
        vec[idx] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _tokens(text: str) -> list[str]:
    return [t for t in TOKEN_RE.findall(text.lower()) if len(t) > 1 and t not in STOP]


def _data_candidates() -> list[Path]:
    here = Path(__file__).resolve()
    roots = [here.parents[2], here.parent, Path.cwd()]
    extra = os.environ.get("RAG_DATA_DIR")
    if extra:
        roots.insert(0, Path(extra))
    seen, out = set(), []
    for root in roots:
        for rel in ("data/rag/chunks.jsonl", "data/rag/manual/class6-math-contents.json"):
            p = (root / rel).resolve()
            if p not in seen:
                seen.add(p)
                out.append(p)
    return out


def _normalize(raw: dict, default_class: int = 6) -> dict | None:
    text = raw.get("text")
    if not isinstance(text, str) or not text:
        return None
    return {
        "id": str(raw.get("id") or hashlib.sha256(text[:80].encode()).hexdigest()[:16]),
        "classLevel": int(raw.get("classLevel") or default_class),
        "subject": str(raw.get("subject") or "Mathematics"),
        "chapterId": str(raw.get("chapterId") or ""),
        "chapterTitle": str(raw.get("chapterTitle") or ""),
        "kind": str(raw.get("kind") or "passage"),
        "text": text,
        "bookPage": int(raw.get("bookPage") or raw.get("book_page") or 0),
        "source": str(raw.get("source") or ""),
        "_embedding": raw.get("embedding"),
    }


def load_chunks() -> list[dict]:
    """Load chunks.jsonl if ingested, else the manual transcription."""
    for path in _data_candidates():
        if not path.exists():
            continue
        try:
            if path.suffix == ".jsonl":
                rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
            else:
                rows = json.loads(path.read_text(encoding="utf-8")).get("chunks", [])
        except Exception:
            continue
        chunks = [c for c in (_normalize(r) for r in rows) if c]
        if chunks:
            for c in chunks:
                if not c["_embedding"]:
                    c["_embedding"] = hashed_embedding(f"{c['chapterTitle']} {c['text']}")
            return chunks
    return []


_CHUNKS: list[dict] | None = None


def get_chunks() -> list[dict]:
    global _CHUNKS
    if _CHUNKS is None:
        _CHUNKS = load_chunks()
    return _CHUNKS


def retrieve_chunks(query: str, class_level: int | None = None,
                    chapter_id: str | None = None, limit: int = 5) -> list[dict]:
    q = hashed_embedding(query)
    if all(v == 0 for v in q):
        return []
    q_tokens = set(_tokens(query))
    limit = max(1, min(int(limit or 5), 20))
    scored = []
    for c in get_chunks():
        if class_level is not None and c["classLevel"] != class_level:
            continue
        if chapter_id and c["chapterId"] not in (chapter_id, "contents"):
            continue
        emb = c["_embedding"]
        score = sum(a * b for a, b in zip(q, emb))
        if score <= 0.05:
            continue
        if not q_tokens.intersection(_tokens(f"{c['chapterTitle']} {c['text']}")):
            continue
        scored.append({k: v for k, v in c.items() if not k.startswith("_")} | {"score": round(score, 6)})
    scored.sort(key=lambda c: c["score"], reverse=True)
    return scored[:limit]


async def _send_json(send, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    await send({"type": "http.response.start", "status": status,
                "headers": [[b"content-type", b"application/json; charset=utf-8"]]})
    await send({"type": "http.response.body", "body": body})


async def app(scope, receive, send):
    """ASGI entrypoint (vercel.json: entrypoint "app:app")."""
    if scope["type"] != "http":
        return
    path = scope.get("path", "/")
    method = scope.get("method", "GET")
    if path in ("/", "/health"):
        await _send_json(send, 200, {"service": "rag", "chunks": len(get_chunks()),
                                     "embeddingModel": "local:hash-tf-256"})
        return
    if path == "/retrieve":
        params: dict = {}
        if method == "POST":
            raw = b""
            while True:
                msg = await receive()
                raw += msg.get("body", b"")
                if not msg.get("more_body"):
                    break
            try:
                params = json.loads(raw or b"{}")
            except Exception:
                await _send_json(send, 400, {"error": "INVALID_JSON"})
                return
        else:
            qs = parse_qs(scope.get("query_string", b"").decode("utf-8", "ignore"))
            params = {k: v[0] for k, v in qs.items()}
            params["query"] = params.get("q") or params.get("query") or ""
        query = str(params.get("query") or "")
        if not query:
            await _send_json(send, 400, {"error": "QUERY_REQUIRED"})
            return
        try:
            class_level = int(params["classLevel"]) if params.get("classLevel") else None
            limit = int(params.get("limit") or 5)
        except (TypeError, ValueError):
            await _send_json(send, 400, {"error": "INVALID_PARAMS"})
            return
        chunks = retrieve_chunks(query, class_level, params.get("chapterId") or None, limit)
        await _send_json(send, 200, {"chunks": chunks})
        return
    await _send_json(send, 404, {"error": "NOT_FOUND"})
