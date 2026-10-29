// Curriculum Concept Graph — constraints & indexes (§2).
// Applied by `npm run seed:graph` before seed data is loaded, and safe to
// re-run (all statements are idempotent).

CREATE CONSTRAINT subject_name_unique IF NOT EXISTS
FOR (s:Subject) REQUIRE s.name IS UNIQUE;

CREATE CONSTRAINT chapter_id_unique IF NOT EXISTS
FOR (c:Chapter) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
FOR (c:Concept) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT microlesson_id_unique IF NOT EXISTS
FOR (m:MicroLesson) REQUIRE m.id IS UNIQUE;

CREATE CONSTRAINT objective_id_unique IF NOT EXISTS
FOR (o:LearningObjective) REQUIRE o.id IS UNIQUE;

CREATE INDEX chapter_ncert_code IF NOT EXISTS
FOR (c:Chapter) ON (c.ncert_code);

CREATE INDEX concept_bloom_level IF NOT EXISTS
FOR (c:Concept) ON (c.bloom_level);

CREATE INDEX concept_chapter IF NOT EXISTS
FOR (c:Concept) ON (c.chapter_id);

// Relationship inventory (enforced by the seed loader & repository, Neo4j
// Community has no native relationship-type constraints):
//   (Subject)-[:HAS_CHAPTER {sequence}]->(Chapter)
//   (Chapter)-[:COVERS_CONCEPT {depth}]->(Concept)
//   (Concept)-[:IS_PREREQUISITE_OF {type: 'hard'|'soft'}]->(Concept)
//   (MicroLesson)-[:ASSESSES {weight}]->(LearningObjective)
//   (Chapter)-[:HAS_OBJECTIVE]->(LearningObjective)   (implementation wiring:
//     objectives are authored per chapter and reference concepts by id)
