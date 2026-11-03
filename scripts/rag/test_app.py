#!/usr/bin/env python3
"""Tests for the internal RAG service. Run: python -m unittest discover -s scripts/rag -p "test_*.py" """
import sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import app as rag_app


class RetrieveTest(unittest.TestCase):
    def test_chunks_load_from_manual_transcription(self):
        self.assertGreater(len(rag_app.get_chunks()), 0)
        for c in rag_app.get_chunks():
            self.assertTrue(c["source"])
            self.assertGreater(c["bookPage"], 0)

    def test_equation_query_finds_simple_equations_chapter(self):
        hits = rag_app.retrieve_chunks("how to solve simple equation x+1=5", class_level=6)
        self.assertTrue(hits)
        self.assertEqual(hits[0]["chapterId"], "c6m-ch5")
        self.assertEqual(hits[0]["bookPage"], 110)

    def test_unrelated_query_returns_nothing(self):
        self.assertEqual(rag_app.retrieve_chunks("photosynthesis chlorophyll sunlight", class_level=6), [])

    def test_chapter_filter_is_respected(self):
        hits = rag_app.retrieve_chunks("ratio percentage", class_level=6, chapter_id="c6m-ch2")
        self.assertTrue(all(h["chapterId"] in ("c6m-ch2", "contents") for h in hits))


if __name__ == "__main__":
    unittest.main()
