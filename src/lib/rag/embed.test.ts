import { describe, expect, it } from "vitest";
import { EMBEDDING_DIM, embedText, embeddingCosine } from "./embed";
import { chapterContent, chunksByChapter, retrieve } from "./retrieve";

describe("local embedding system", () => {
  it("produces normalized 256-dim embeddings", () => {
    const v = embedText("solving simple equations by balancing both sides");
    expect(v).toHaveLength(EMBEDDING_DIM);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1);
    expect(embedText("")).toEqual(new Array(EMBEDDING_DIM).fill(0));
  });

  it("ranks identical and related text above unrelated text", () => {
    const q = embedText("simple equation balance both sides");
    const same = embedText("simple equation balance both sides");
    const near = embedText("solve the equation and keep both sides balanced");
    const far = embedText("photosynthesis chlorophyll sunlight leaf");
    expect(embeddingCosine(q, same)).toBeCloseTo(1);
    expect(embeddingCosine(q, near)).toBeGreaterThan(embeddingCosine(q, far));
  });
});

describe("chapter-wise chunks", () => {
  it("groups chunks per chapter with book pages", () => {
    const by = chunksByChapter();
    expect([...by.keys()].sort()).toEqual(["c6m-ch1", "c6m-ch2", "c6m-ch3", "c6m-ch4", "c6m-ch5", "c6m-ch6", "c6m-ch7", "c6m-ch8"]);
    for (const [id, chunks] of by) {
      expect(chunks.length).toBeGreaterThan(3);
      for (const c of chunks) expect(c.chapterId).toBe(id);
    }
    const ch5 = chapterContent("c6m-ch5");
    expect(ch5[0]?.chapterTitle).toBe("Simple Equations");
    expect(ch5.every((c) => c.bookPage >= 110)).toBe(true);
  });

  it("embedding retrieval finds the right chapter content", () => {
    const hits = retrieve("how do I solve a simple equation x+1=5", { classLevel: 6 });
    expect(hits[0]?.chapterId).toBe("c6m-ch5");
    expect(retrieve("mean median mode of data", { classLevel: 6 })[0]?.chapterId).toBe("c6m-ch8");
  });
});
