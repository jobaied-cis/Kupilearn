import { describe, expect, it } from "vitest";
import { RAG_CHUNKS, evaluateRetrieval, retrieve } from "./retrieve";
import { mathBookForClass } from "../nctb/math-book";

describe("NCTB Class 6 math book (from uploaded PDF)", () => {
  it("has the 8 real chapters in contents order", () => {
    const status = mathBookForClass(6);
    expect(status.available).toBe(true);
    if (!status.available) return;
    expect(status.chapters.map((c) => c.title)).toEqual([
      "Natural Numbers and Fractions",
      "Ratios and Percentages",
      "Integers",
      "Algebraic Expressions",
      "Simple Equations",
      "Basic Concepts of Geometry",
      "Practical Geometry",
      "Information and Data",
    ]);
    expect(status.chapters[4]).toMatchObject({ title: "Simple Equations", bookPage: 110 });
  });

  it("refuses to invent chapters for classes without an uploaded book", () => {
    const status = mathBookForClass(9);
    expect(status.available).toBe(false);
    if (status.available) return;
    expect(status.reason).toContain("not been uploaded");
  });
});

describe("local RAG retrieval", () => {
  it("retrieves the equation chapter for an equation query with a page reference", () => {
    const hits = retrieve("how do I solve a simple equation x+1=5", { classLevel: 6 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.chapterId).toBe("c6m-ch5");
    expect(hits[0]?.bookPage).toBe(110);
  });

  it("returns nothing for unrelated queries instead of inventing a source", () => {
    expect(retrieve("photosynthesis chlorophyll sunlight", { classLevel: 6 })).toEqual([]);
  });

  it("every chunk carries a source and book page", () => {
    for (const c of RAG_CHUNKS) {
      expect(c.source).toContain("NCTB");
      expect(c.bookPage).toBeGreaterThan(0);
    }
  });

  it("retrieval evaluation finds expected chapters", () => {
    const r = evaluateRetrieval([
      { query: "ratio and percentage unitary method", chapterId: "c6m-ch2" },
      { query: "negative integers on a number line", chapterId: "c6m-ch3" },
      { query: "mean median mode of data", chapterId: "c6m-ch8" },
    ]);
    expect(r.accuracy).toBe(1);
  });
});
