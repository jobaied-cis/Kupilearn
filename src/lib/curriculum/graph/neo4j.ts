import neo4j, { type Driver, type QueryResult } from "neo4j-driver";
import { EngineException } from "../types";

let driver: Driver | null = null;

/**
 * Lazily created Neo4j driver singleton. Reads NEO4J_URI / NEO4J_USERNAME /
 * NEO4J_PASSWORD — see `.env.example`. Never connects until first query.
 */
export function getDriver(): Driver {
  driver ??= neo4j.driver(
    requireEnv("NEO4J_URI"),
    neo4j.auth.basic(requireEnv("NEO4J_USERNAME"), requireEnv("NEO4J_PASSWORD")),
    { disableLosslessIntegers: true },
  );
  return driver;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new EngineException("GRAPH_CONFIG_MISSING", "", `Missing env var ${name}`);
  return value;
}

/**
 * Read-only graph tool (`query_concept_graph`, §6). Only Cypher starting with
 * MATCH/WITH/OPTIONAL/RETURN/CALL is accepted — the engine never writes.
 */
export async function queryConceptGraph<T>(
  cypher: string,
  params: Record<string, unknown>,
  conceptId: string,
  mapRow: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  const head = cypher.trim().split(/\s+/, 1)[0]?.toUpperCase();
  if (!["MATCH", "OPTIONAL", "WITH", "RETURN", "CALL"].includes(head ?? "")) {
    throw new EngineException("GRAPH_WRITE_BLOCKED", conceptId, "Only read queries are allowed");
  }
  try {
    const result: QueryResult = await getDriver().executeQuery(cypher, params, {
      routing: "READ",
    });
    return result.records.map((record) => mapRow(record.toObject()));
  } catch (error) {
    if (error instanceof EngineException) throw error;
    throw new EngineException(
      "PREREQUISITE_DATA_UNAVAILABLE",
      conceptId,
      error instanceof Error ? error.message : "Neo4j query failed",
    );
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) await driver.close();
  driver = null;
}
