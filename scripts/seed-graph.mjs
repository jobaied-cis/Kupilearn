// Loads schema.cypher + seed-data.json into Neo4j.
// Usage: NEO4J_URI=... NEO4J_USERNAME=... NEO4J_PASSWORD=... npm run seed:graph
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import neo4j from "neo4j-driver";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(join(root, "src/lib/curriculum/graph/schema.cypher"), "utf8");
const seed = JSON.parse(
  readFileSync(join(root, "src/lib/curriculum/graph/seed-data.json"), "utf8"),
);

const driver = neo4j.driver(
  requireEnv("NEO4J_URI"),
  neo4j.auth.basic(requireEnv("NEO4J_USERNAME"), requireEnv("NEO4J_PASSWORD")),
);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var ${name}`);
    process.exit(1);
  }
  return value;
}

const SEED_CYPHER = `
MERGE (s:Subject {name: $subject})
WITH s
UNWIND $chapters AS ch
MERGE (c:Chapter {id: ch.id})
SET c.title = ch.title, c.class_level = ch.classLevel, c.ncert_code = ch.ncertCode,
    c.subject = ch.subject, c.textbook_name = ch.textbookName
MERGE (s)-[:HAS_CHAPTER]->(c)
WITH c, ch
UNWIND $concepts AS cp
WITH c, cp WHERE cp.chapterId = c.id
MERGE (n:Concept {id: cp.id})
SET n.name = cp.name, n.chapter_id = cp.chapterId, n.bloom_level = cp.bloomLevel,
    n.difficulty = cp.difficulty, n.mastery_threshold = cp.masteryThreshold,
    n.is_threshold_concept = cp.isThresholdConcept
MERGE (c)-[:COVERS_CONCEPT {depth: 'beginner'}]->(n)
WITH c
UNWIND $prerequisites AS p
MATCH (a:Concept {id: p.from}), (b:Concept {id: p.to})
MERGE (a)-[:IS_PREREQUISITE_OF {type: p.type}]->(b)
WITH c
UNWIND $objectives AS o
WITH c, o WHERE o.chapterId = c.id
MERGE (lo:LearningObjective {id: o.id})
SET lo.text = o.text, lo.competency_code = o.competencyCode, lo.concept_ids = o.conceptIds
MERGE (c)-[:HAS_OBJECTIVE]->(lo)
`;

try {
  // `IF NOT EXISTS` makes constraint creation idempotent; run schema first.
  const cleaned = schema
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  for (const stmt of cleaned.split(";").map((s) => s.trim()).filter(Boolean)) {
    await driver.executeQuery(stmt);
  }
  const subjects = [...new Set(seed.chapters.map((c) => c.subject))];
  for (const subject of subjects) {
    await driver.executeQuery(SEED_CYPHER, {
      subject,
      chapters: seed.chapters.filter((c) => c.subject === subject),
      concepts: seed.concepts,
      prerequisites: seed.prerequisites,
      objectives: seed.objectives,
    });
  }
  const summary = await driver.executeQuery(
    "MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n ORDER BY label",
  );
  console.log(
    "Seeded:",
    summary.records.map((r) => `${r.get("label")}=${r.get("n")}`).join(" "),
  );
} finally {
  await driver.close();
}
