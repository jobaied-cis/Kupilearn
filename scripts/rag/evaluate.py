#!/usr/bin/env python3
"""Retrieval evaluation over data/rag/chunks.jsonl (local TF cosine, top-k hit rate)."""
import json, math, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CASES = [
    ("how to solve simple equation x+1=5", "Simple Equations"),
    ("ratio percentage unitary method", "Ratios and Percentages"),
    ("negative integers number line", "Integers"),
    ("mean median mode data", "Information and Data"),
    ("prime composite gcd lcm fractions", "Natural Numbers and Fractions"),
]

def toks(t):
    return [x for x in re.findall(r"[a-z0-9]+", t.lower()) if len(x) > 1]

def tf(t):
    m = {}
    for x in toks(t):
        m[x] = m.get(x, 0) + 1
    return m

def cos(a, b):
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    na = math.sqrt(sum(v * v for v in a.values())) or 1
    nb = math.sqrt(sum(v * v for v in b.values())) or 1
    return dot / (na * nb)

def main():
    f = ROOT / "data" / "rag" / "chunks.jsonl"
    if not f.exists():
        print("No chunks yet. Run ingest.py first.")
        return 1
    chunks = [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"chunks: {len(chunks)}")
    hits = 0
    for query, want in CASES:
        q = tf(query)
        ranked = sorted(chunks, key=lambda c: cos(q, tf(c.get("chapterTitle", "") + " " + c["text"])), reverse=True)[:3]
        ok = any(want in c.get("chapterTitle", "") or want in c["text"] for c in ranked)
        hits += ok
        print(f"{'HIT ' if ok else 'MISS'} {query!r} -> {[c.get('chapterTitle') for c in ranked]}")
    print(f"top-3 accuracy: {hits}/{len(CASES)} = {hits/len(CASES):.2f}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
