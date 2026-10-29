/**
 * Parameterized Cypher for the Curriculum Concept Graph.
 * All engine reads go through these statements so prerequisite enforcement
 * stays at the database layer (§2 schema validation rule).
 */

/** Hard-prerequisite audit for one concept. Runs before any generation. */
export const PREREQUISITE_CHECK_CYPHER = `
MATCH (target:Concept {id: $conceptId})
MATCH (prereq:Concept)-[r:IS_PREREQUISITE_OF]->(target)
WHERE r.type = 'hard'
RETURN prereq.id AS id,
       prereq.name AS name,
       prereq.mastery_threshold AS masteryThreshold
`.trim();

export interface PrerequisiteCheckParams {
  conceptId: string;
}

/**
 * Breadth-first prerequisite closure, depth ≤ 3 (§3.1 knowledge context
 * window). Shortest path per prerequisite keeps the window tight.
 */
export const CONCEPT_CONTEXT_WINDOW_CYPHER = `
MATCH (target:Concept {id: $conceptId})
MATCH path = (prereq:Concept)-[:IS_PREREQUISITE_OF*1..3]->(target)
WITH prereq, length(path) AS depth, relationships(path) AS rels
ORDER BY depth ASC
WITH prereq, head(collect(depth)) AS depth, head(collect(rels)) AS rels
RETURN prereq.id AS id,
       prereq.name AS name,
       prereq.mastery_threshold AS masteryThreshold,
       depth AS depth,
       [r IN rels | r.type] AS edgeTypes
ORDER BY depth ASC
`.trim();

export interface ConceptContextWindowParams {
  conceptId: string;
}

/** Concept + its chapter + chapter objectives aligned to the concept. */
export const CONCEPT_DETAILS_CYPHER = `
MATCH (c:Concept {id: $conceptId})
OPTIONAL MATCH (ch:Chapter)-[:COVERS_CONCEPT]->(c)
OPTIONAL MATCH (ch)-[:HAS_OBJECTIVE]->(o:LearningObjective)
WHERE o.id IS NULL OR $conceptId IN o.concept_ids
RETURN c AS concept, ch AS chapter, collect(DISTINCT o) AS objectives
`.trim();

export interface ConceptDetailsParams {
  conceptId: string;
}

/** All concepts of a chapter plus hard edges, for batch map-reduce (§6). */
export const CHAPTER_CONCEPTS_CYPHER = `
MATCH (ch:Chapter {id: $chapterId})-[:COVERS_CONCEPT]->(c:Concept)
OPTIONAL MATCH (p:Concept)-[r:IS_PREREQUISITE_OF {type: 'hard'}]->(c)
WHERE p.chapter_id = $chapterId
RETURN collect(DISTINCT c) AS concepts,
       collect(DISTINCT [p.id, c.id]) AS hardEdges
`.trim();

export interface ChapterConceptsParams {
  chapterId: string;
}
