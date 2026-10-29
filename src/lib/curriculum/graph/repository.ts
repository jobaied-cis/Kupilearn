import {
  type Chapter,
  type Concept,
  type ConceptDetails,
  type LearningObjective,
  type PrerequisiteInfo,
  type PrerequisiteType,
  BloomLevelSchema,
} from "../types";
import {
  CHAPTER_CONCEPTS_CYPHER,
  CONCEPT_CONTEXT_WINDOW_CYPHER,
  CONCEPT_DETAILS_CYPHER,
} from "./queries";
import { queryConceptGraph } from "./neo4j";
import defaultSeedData from "./seed-data.json";

/* ------------------------------------------------------------------ */
/* Repository interface — the engine depends only on this.             */
/* ------------------------------------------------------------------ */

export interface ChapterConcepts {
  concepts: Concept[];
  /** [fromConceptId, toConceptId] hard edges within the chapter. */
  hardEdges: [string, string][];
}

export interface ConceptGraphRepository {
  getConceptDetails(conceptId: string): Promise<ConceptDetails | null>;
  getChapterConcepts(chapterId: string): Promise<ChapterConcepts>;
}

export interface SeedDataset {
  chapters: Chapter[];
  concepts: Concept[];
  prerequisites: { from: string; to: string; type: PrerequisiteType }[];
  objectives: LearningObjective[];
}

/* ------------------------------------------------------------------ */
/* Neo4j implementation — single source of truth in production.         */
/* ------------------------------------------------------------------ */

function toConcept(node: Record<string, unknown>): Concept {
  return {
    id: String(node.id),
    name: String(node.name),
    chapterId: String(node.chapter_id ?? node.chapterId),
    bloomLevel: BloomLevelSchema.parse(node.bloom_level ?? node.bloomLevel),
    difficulty: Number(node.difficulty),
    masteryThreshold: Number(node.mastery_threshold ?? node.masteryThreshold ?? 0.8),
    isThresholdConcept: Boolean(node.is_threshold_concept ?? node.isThresholdConcept ?? false),
  };
}

export class Neo4jConceptGraphRepository implements ConceptGraphRepository {
  async getConceptDetails(conceptId: string): Promise<ConceptDetails | null> {
    const details = await queryConceptGraph(
      CONCEPT_DETAILS_CYPHER,
      { conceptId },
      conceptId,
      (row) => row,
    );
    const first = details[0] as
      | { concept: Record<string, unknown> | null; chapter: Record<string, unknown> | null; objectives: Record<string, unknown>[] }
      | undefined;
    if (!first?.concept) return null;

    const prerequisites = await queryConceptGraph(
      CONCEPT_CONTEXT_WINDOW_CYPHER,
      { conceptId },
      conceptId,
      (row): PrerequisiteInfo => ({
        id: String(row.id),
        name: String(row.name),
        masteryThreshold: Number(row.masteryThreshold ?? 0.8),
        // Nearest edge to the target decides blocking semantics.
        type: (lastOf(row.edgeTypes as PrerequisiteType[]) ?? "hard") as PrerequisiteType,
        depth: Number(row.depth),
      }),
    );

    const chapterNode = first.chapter ?? {};
    const chapter: Chapter = {
      id: String(chapterNode.id ?? ""),
      title: String(chapterNode.title ?? ""),
      classLevel: Number(chapterNode.class_level ?? chapterNode.classLevel ?? 0),
      ncertCode: String(chapterNode.ncert_code ?? chapterNode.ncertCode ?? ""),
      subject: String(chapterNode.subject ?? ""),
      textbookName: String(chapterNode.textbook_name ?? chapterNode.textbookName ?? ""),
    };
    const objectives: LearningObjective[] = (first.objectives ?? [])
      .filter((o) => o && o.id)
      .map((o) => ({
        id: String(o.id),
        text: String(o.text ?? ""),
        competencyCode: String(o.competency_code ?? o.competencyCode ?? ""),
        chapterId: chapter.id,
        conceptIds: ((o.concept_ids ?? o.conceptIds ?? []) as unknown[]).map(String),
      }));

    return { concept: toConcept(first.concept), chapter, objectives, prerequisites };
  }

  async getChapterConcepts(chapterId: string): Promise<ChapterConcepts> {
    const rows = await queryConceptGraph(
      CHAPTER_CONCEPTS_CYPHER,
      { chapterId },
      "",
      (row) => row,
    );
    const first = rows[0] as
      | { concepts: Record<string, unknown>[]; hardEdges: ([string, string] | [null, null])[] }
      | undefined;
    return {
      concepts: (first?.concepts ?? []).map(toConcept),
      hardEdges: (first?.hardEdges ?? []).filter(
        (e): e is [string, string] => e[0] !== null && e[1] !== null,
      ),
    };
  }
}

function lastOf<T>(arr: T[] | undefined): T | undefined {
  return arr && arr.length > 0 ? arr[arr.length - 1] : undefined;
}

/* ------------------------------------------------------------------ */
/* In-memory implementation — local dev, tests, and zero-infra demos.  */
/* It mirrors the Cypher semantics exactly (BFS closure, depth ≤ 3).   */
/* ------------------------------------------------------------------ */

export class InMemoryConceptGraphRepository implements ConceptGraphRepository {
  private readonly data: SeedDataset;

  constructor(data: SeedDataset = defaultSeedData as SeedDataset) {
    this.data = data;
  }

  async getConceptDetails(conceptId: string): Promise<ConceptDetails | null> {
    const concept = this.data.concepts.find((c) => c.id === conceptId);
    if (!concept) return null;
    const chapter = this.data.chapters.find((c) => c.id === concept.chapterId);
    if (!chapter) return null;
    return {
      concept,
      chapter,
      objectives: this.data.objectives.filter((o) => o.conceptIds.includes(conceptId)),
      prerequisites: breadthFirstPrerequisites(this.data, conceptId, 3),
    };
  }

  async getChapterConcepts(chapterId: string): Promise<ChapterConcepts> {
    const ids = new Set(
      this.data.concepts.filter((c) => c.chapterId === chapterId).map((c) => c.id),
    );
    return {
      concepts: this.data.concepts.filter((c) => ids.has(c.id)),
      hardEdges: this.data.prerequisites
        .filter((p) => p.type === "hard" && ids.has(p.from) && ids.has(p.to))
        .map((p): [string, string] => [p.from, p.to]),
    };
  }
}

/** BFS over incoming IS_PREREQUISITE_OF edges, nearest-depth wins. */
export function breadthFirstPrerequisites(
  data: SeedDataset,
  conceptId: string,
  maxDepth: number,
): PrerequisiteInfo[] {
  const byId = new Map(data.concepts.map((c) => [c.id, c]));
  const incoming = new Map<string, { from: string; type: PrerequisiteType }[]>();
  for (const p of data.prerequisites) {
    const list = incoming.get(p.to) ?? [];
    list.push({ from: p.from, type: p.type });
    incoming.set(p.to, list);
  }
  const seen = new Map<string, PrerequisiteInfo>();
  let frontier: string[] = [conceptId];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const edge of incoming.get(current) ?? []) {
        if (edge.from === conceptId || seen.has(edge.from)) continue;
        const node = byId.get(edge.from);
        if (!node) continue;
        seen.set(edge.from, {
          id: node.id,
          name: node.name,
          masteryThreshold: node.masteryThreshold,
          type: edge.type,
          depth,
        });
        next.push(edge.from);
      }
    }
    frontier = next;
  }
  return [...seen.values()].sort((a, b) => a.depth - b.depth);
}
