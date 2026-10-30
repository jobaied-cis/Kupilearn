import neo4j, { type Driver, type Session } from "neo4j-driver";
import { RevisionError } from "../types";

/**
 * Neo4j connection management for the Revision Engine (Part 02).
 *
 * Server-side only - this module must never be imported from client code,
 * and no NEO4J_* value is ever exposed through a NEXT_PUBLIC_ variable.
 *
 * One lazy, pooled driver singleton for revision work (neo4j-driver is
 * the project's existing driver; no new database library). The curriculum
 * graph keeps its own read-only driver - drivers are cheap, connections
 * are pooled inside each, and neither is created per request.
 */

export interface RevisionNeo4jConfig {
  uri: string;
  username: string;
  /** Presence-checked only. Never logged, returned, or put in errors. */
  passwordConfigured: boolean;
  database: string;
}

const REQUIRED = ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"] as const;

/**
 * Validates revision Neo4j configuration from env. Missing-variable errors
 * name the variables only - values are never included.
 */
export function getRevisionNeo4jConfig(env: NodeJS.ProcessEnv = process.env): RevisionNeo4jConfig {
  const missing = REQUIRED.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new RevisionError(
      "REVISION_DB_NOT_CONFIGURED",
      503,
      `Revision Neo4j store is not configured (missing: ${missing.join(", ")})`,
    );
  }
  return {
    uri: env.NEO4J_URI as string,
    username: env.NEO4J_USERNAME as string,
    passwordConfigured: true,
    database: env.NEO4J_DATABASE?.trim() || "neo4j",
  };
}

export function isRevisionNeo4jConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return REQUIRED.every((name) => !!env[name]?.trim());
}

let revisionDriver: Driver | null = null;

/**
 * The revision driver singleton: created lazily on first use from the
 * validated config, then reused (the driver pools connections itself).
 * Only revision code uses it; it is never created per request.
 */
export function getRevisionDriver(env: NodeJS.ProcessEnv = process.env): Driver {
  const config = getRevisionNeo4jConfig(env);
  revisionDriver ??= neo4j.driver(config.uri, neo4j.auth.basic(config.username, env.NEO4J_PASSWORD as string), {
    disableLosslessIntegers: true,
  });
  return revisionDriver;
}

/** Closes the revision driver (shutdown / tests). Safe to call when unset. */
export async function closeRevisionDriver(): Promise<void> {
  if (revisionDriver) await revisionDriver.close();
  revisionDriver = null;
}

/** Wraps any driver/session failure in a safe, credential-free error. */
export function revisionDbUnavailable(error: unknown): RevisionError {
  if (error instanceof RevisionError) return error;
  return new RevisionError("REVISION_DB_UNAVAILABLE", 503, "Revision database unavailable");
}

/**
 * Parameter bag for Cypher execution, derived from the official
 * neo4j-driver 6.2.0 types: it is exactly the `parameters` argument of
 * `Session.run` (neo4j-driver-core `Parameters`). Repository code builds
 * plain Record<string, unknown> objects, which are assignable to it, and
 * every value reaches the driver as a bound $parameter - never as
 * interpolated Cypher text.
 */
export type CypherParams = NonNullable<Parameters<Session["run"]>[1]>;
export type RowRunner = (cypher: string, params: CypherParams) => Promise<Record<string, unknown>[]>;

/**
 * Minimal execution surface the repository depends on. The production
 * implementation runs each operation in its own driver session (closed
 * in `finally`); tests inject a fake with the same shape.
 */
export interface RevisionNeo4jExecutor {
  run: RowRunner;
  /** All writes inside `work` commit together or roll back together. */
  writeTransaction<T>(work: (run: RowRunner) => Promise<T>): Promise<T>;
}

function rows(result: { records: { toObject(): Record<string, unknown> }[] }): Record<string, unknown>[] {
  return result.records.map((r) => r.toObject());
}

/** Production executor over the shared driver. One session per operation. */
export class DriverSessionExecutor implements RevisionNeo4jExecutor {
  constructor(
    private driver: Driver,
    private database: string,
  ) {}

  private session(): Session {
    return this.driver.session({ database: this.database });
  }

  async run(cypher: string, params: CypherParams): Promise<Record<string, unknown>[]> {
    const session = this.session();
    try {
      return rows(await session.run(cypher, params));
    } catch (error) {
      throw revisionDbUnavailable(error);
    } finally {
      await session.close();
    }
  }

  async writeTransaction<T>(work: (run: RowRunner) => Promise<T>): Promise<T> {
    const session = this.session();
    try {
      return await session.executeWrite(async (tx) => work(async (cypher, params) => rows(await tx.run(cypher, params))));
    } catch (error) {
      throw revisionDbUnavailable(error);
    } finally {
      await session.close();
    }
  }
}

export function createRevisionNeo4jExecutor(env: NodeJS.ProcessEnv = process.env): RevisionNeo4jExecutor {
  const config = getRevisionNeo4jConfig(env);
  return new DriverSessionExecutor(getRevisionDriver(env), config.database);
}
