import { NCTB_CATALOG } from "../nctb/catalog";

/**
 * Concept identification (Section 5).
 * Source of truth is the existing NCTB catalog (Class -> Subject -> Chapter
 * -> Topic, Classes 6-10). Every catalog topic yields one concept whose id
 * IS the stable topic id (e.g. `c8-math-algebraic`), so lesson, practice and
 * classroom events already carrying a topic id map 1:1 onto a concept.
 * Finer-grained sub-concepts (e.g. Variables / Constants inside Algebraic
 * Expressions) are added through CURATED_SUB_CONCEPTS with the same id
 * convention: `<topicId>-<slug>`. Ids are never renumbered; adding a concept
 * is append-only, which keeps stored mastery rows valid.
 */
export interface ConceptDefinition {
  id: string;
  name: string;
  nameBn: string;
  subjectId: string;
  subjectTitle: string;
  classLevel: number;
  chapterId: string;
  chapterTitle: string;
  /** NCTB topic this concept belongs to (== id for topic-level concepts). */
  topicId: string;
  keyTerms: string[];
}

type SubConcept = { slug: string; name: string; nameBn: string; keyTerms?: string[] };

/** Worked example from the spec: Class 8 Mathematics, Algebraic Expressions. */
const CURATED_SUB_CONCEPTS: Record<string, SubConcept[]> = {
  "c8-math-algebraic": [
    { slug: "variables", name: "Variables", nameBn: "চলক", keyTerms: ["variable", "x", "y"] },
    { slug: "constants", name: "Constants", nameBn: "ধ্রুবক", keyTerms: ["constant"] },
    { slug: "coefficients", name: "Coefficients", nameBn: "সহগ", keyTerms: ["coefficient"] },
    { slug: "like-terms", name: "Like Terms", nameBn: "সদৃশ রাশি", keyTerms: ["like terms"] },
    { slug: "unlike-terms", name: "Unlike Terms", nameBn: "বিসদৃশ রাশি", keyTerms: ["unlike terms"] },
    { slug: "addition", name: "Addition of Algebraic Expressions", nameBn: "বীজগণিতীয় রাশির যোগ", keyTerms: ["addition"] },
    { slug: "subtraction", name: "Subtraction of Algebraic Expressions", nameBn: "বীজগণিতীয় রাশির বিয়োগ", keyTerms: ["subtraction"] },
  ],
};

function buildRegistry(): ConceptDefinition[] {
  const out: ConceptDefinition[] = [];
  for (const cls of NCTB_CATALOG) {
    for (const subject of cls.subjects) {
      for (const chapter of subject.chapters) {
        for (const topic of chapter.topics) {
          const base: ConceptDefinition = {
            id: topic.id,
            name: topic.title,
            nameBn: topic.titleBn,
            subjectId: subject.id,
            subjectTitle: subject.title,
            classLevel: cls.classLevel,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            topicId: topic.id,
            keyTerms: topic.keyTerms,
          };
          out.push(base);
          for (const sub of CURATED_SUB_CONCEPTS[topic.id] ?? []) {
            out.push({
              ...base,
              id: `${topic.id}-${sub.slug}`,
              name: sub.name,
              nameBn: sub.nameBn,
              keyTerms: sub.keyTerms ?? topic.keyTerms,
            });
          }
        }
      }
    }
  }
  return out;
}

export const CONCEPT_REGISTRY: ConceptDefinition[] = buildRegistry();

const BY_ID = new Map(CONCEPT_REGISTRY.map((c) => [c.id, c]));

export function getConcept(conceptId: string): ConceptDefinition | null {
  return BY_ID.get(conceptId) ?? null;
}

/**
 * Safe lesson->concept mapping for producers that carry an NCTB topic id
 * (e.g. BookChapter.topicId). Returns the topic-level concept id, or null
 * when there is no reliable mapping (unknown id, sub-concept, or a
 * textbook chapter id such as c6m-ch4). Callers must skip revision
 * reporting on null instead of guessing a concept.
 */
export function conceptIdForTopicId(topicId: string | null | undefined): string | null {
  if (!topicId) return null;
  const concept = BY_ID.get(topicId);
  return concept && concept.id === concept.topicId ? concept.id : null;
}
export function listConcepts(filter: { classLevel?: number; subjectId?: string; chapterId?: string; topicId?: string } = {}): ConceptDefinition[] {
  return CONCEPT_REGISTRY.filter(
    (c) =>
      (filter.classLevel === undefined || c.classLevel === filter.classLevel) &&
      (filter.subjectId === undefined || c.subjectId === filter.subjectId) &&
      (filter.chapterId === undefined || c.chapterId === filter.chapterId) &&
      (filter.topicId === undefined || c.topicId === filter.topicId),
  );
}

/** Fails loudly at startup/tests if a future edit ever duplicates an id. */
export function validateConceptRegistry(registry: ConceptDefinition[] = CONCEPT_REGISTRY): void {
  const seen = new Set<string>();
  for (const c of registry) {
    if (!c.id || seen.has(c.id)) throw new Error(`Duplicate or empty concept id: "${c.id}"`);
    seen.add(c.id);
    if (c.classLevel < 6 || c.classLevel > 10) throw new Error(`Concept ${c.id} outside Classes 6-10`);
  }
}