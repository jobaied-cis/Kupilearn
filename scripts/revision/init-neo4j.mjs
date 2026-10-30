// Initializes the Revision Engine Neo4j schema (constraints + indexes).
//
// Usage:
//   NEO4J_URI=... NEO4J_USERNAME=... NEO4J_PASSWORD=... npm run init:revision-db
// Optional: NEO4J_DATABASE (default "neo4j").
//
// Safety: applies ONLY the idempotent statements in
// src/lib/revision/schema.cypher (every statement uses IF NOT EXISTS).
// It never deletes data, never drops constraints/indexes, never seeds or
// overwrites learner records, and is safe to re-run. Run it manually as
// an operator step - student API requests never run schema statements.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import neo4j from "neo4j-driver";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var ${name}`);
    process.exit(1);
  }
  return value;
}

const schema = readFileSync(join(root, "src/lib/revision/schema.cypher"), "utf8");
const statements = schema
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

// Guard rail: refuse anything that is not a schema statement, even if the
// schema file is edited later. Initialization must stay non-destructive.
for (const stmt of statements) {
  if (!/^(CREATE CONSTRAINT|CREATE INDEX)\b/i.test(stmt)) {
    console.error(`Refusing non-schema statement in schema.cypher: ${stmt.slice(0, 60)}...`);
    process.exit(1);
  }
}

const driver = neo4j.driver(
  requireEnv("NEO4J_URI"),
  neo4j.auth.basic(requireEnv("NEO4J_USERNAME"), requireEnv("NEO4J_PASSWORD")),
  { disableLosslessIntegers: true },
);

try {
  const database = process.env.NEO4J_DATABASE?.trim() || "neo4j";
  for (const stmt of statements) {
    await driver.executeQuery(stmt, {}, { database });
  }
  console.log(`Revision schema initialized (${statements.length} idempotent statements, database: ${database}). No data was created, changed, or deleted.`);
} finally {
  await driver.close();
}
