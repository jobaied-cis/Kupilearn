import { describe, expect, it } from "vitest";
import {
  InMemoryConceptGraphRepository,
  breadthFirstPrerequisites,
  type SeedDataset,
} from "../graph/repository";

describe("in-memory concept graph", () => {
  it("returns null for unmapped concepts", async () => {
    const repo = new InMemoryConceptGraphRepository();
    expect(await repo.getConceptDetails("missing")).toBeNull();
  });

  it("resolves concept + chapter + objectives + prerequisites", async () => {
    const repo = new InMemoryConceptGraphRepository();
    const details = await repo.getConceptDetails("c7-sci-photosynthesis");
    expect(details?.concept.name).toBe("Photosynthesis");
    expect(details?.chapter.ncertCode).toBe("G7-SCI-01");
    expect(details?.objectives.map((o) => o.competencyCode)).toEqual(["SCI-C7-01"]);
    expect(details?.prerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "c7-sci-nutrition-modes", type: "hard", depth: 1 }),
        expect.objectContaining({ id: "c7-sci-nutrients", depth: 1 }),
      ]),
    );
  });

  it("lists chapter concepts and hard edges for batch assembly", async () => {
    const repo = new InMemoryConceptGraphRepository();
    const { concepts, hardEdges } = await repo.getChapterConcepts("ch-c7-sci-01");
    expect(concepts).toHaveLength(5);
    expect(hardEdges).toHaveLength(4);
  });

  it("caps the BFS context window at depth 3", () => {
    const chain = ["c0", "c1", "c2", "c3", "c4", "c5"];
    const data: SeedDataset = {
      chapters: [],
      concepts: chain.map((id) => ({
        id,
        name: id,
        chapterId: "ch",
        bloomLevel: "remember",
        difficulty: 0.1,
        masteryThreshold: 0.8,
        isThresholdConcept: false,
      })),
      prerequisites: chain.slice(1).map((to, i) => ({ from: chain[i] as string, to, type: "hard" as const })),
      objectives: [],
    };
    const window = breadthFirstPrerequisites(data, "c5", 3);
    expect(window.map((p) => p.id).sort()).toEqual(["c2", "c3", "c4"]);
    expect(Math.max(...window.map((p) => p.depth))).toBe(3);
  });
});
