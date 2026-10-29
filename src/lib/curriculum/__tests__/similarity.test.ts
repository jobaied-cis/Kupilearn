import { describe, expect, it } from "vitest";
import {
  TEXTBOOK_SIMILARITY_THRESHOLD,
  embeddingCosineSimilarity,
  tfCosineSimilarity,
  tokenize,
} from "../textbook/textbook";

describe("textbook similarity (§3.2)", () => {
  it("pins the acceptance threshold at 0.72", () => {
    expect(TEXTBOOK_SIMILARITY_THRESHOLD).toBe(0.72);
  });

  it("scores identical texts at 1", () => {
    expect(tfCosineSimilarity("photosynthesis uses sunlight", "photosynthesis uses sunlight")).toBeCloseTo(1);
  });

  it("scores disjoint texts at 0", () => {
    expect(tfCosineSimilarity("photosynthesis chlorophyll", "cricket football stadium")).toBe(0);
  });

  it("scores empty input at 0", () => {
    expect(tfCosineSimilarity("", "photosynthesis")).toBe(0);
    expect(tfCosineSimilarity("photosynthesis", "")).toBe(0);
  });

  it("ignores stopwords and case", () => {
    expect(tokenize("The Plants and THE soil")).toEqual(["plants", "soil"]);
  });

  it("computes embedding cosine correctly", () => {
    expect(embeddingCosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(embeddingCosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(embeddingCosineSimilarity([1, 1], [1, 1])).toBeCloseTo(1);
    expect(embeddingCosineSimilarity([], [])).toBe(0);
    expect(embeddingCosineSimilarity([1], [1, 2])).toBe(0);
  });
});
