import { describe, expect, it, vi } from "vitest";
import {
  DriverSessionExecutor,
  getRevisionNeo4jConfig,
  isRevisionNeo4jConfigured,
  revisionDbUnavailable,
} from "../neo4j/connection";
import { RevisionError } from "../types";

const asEnv = (v: Record<string, string>): NodeJS.ProcessEnv => v as NodeJS.ProcessEnv;
const FULL = asEnv({ NEO4J_URI: "neo4j://localhost:7687", NEO4J_USERNAME: "neo4j", NEO4J_PASSWORD: "test-password" });

describe("getRevisionNeo4jConfig", () => {
  it("accepts complete config and defaults the database to neo4j", () => {
    const config = getRevisionNeo4jConfig(FULL);
    expect(config).toMatchObject({ uri: "neo4j://localhost:7687", username: "neo4j", database: "neo4j", passwordConfigured: true });
    expect(isRevisionNeo4jConfigured(FULL)).toBe(true);
  });

  it("respects NEO4J_DATABASE when provided", () => {
    expect(getRevisionNeo4jConfig({ ...FULL, NEO4J_DATABASE: "kupi-revision" }).database).toBe("kupi-revision");
  });

  it("rejects missing env vars by name only - values are never exposed", () => {
    const env = asEnv({ NEO4J_USERNAME: "neo4j", NEO4J_PASSWORD: "super-secret-value" });
    let caught: unknown;
    try {
      getRevisionNeo4jConfig(env);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RevisionError);
    expect(caught).toMatchObject({ code: "REVISION_DB_NOT_CONFIGURED", status: 503 });
    expect((caught as Error).message).toContain("NEO4J_URI");
    expect((caught as Error).message).not.toContain("super-secret-value");
    expect(isRevisionNeo4jConfigured(env)).toBe(false);
    expect(isRevisionNeo4jConfigured(asEnv({}))).toBe(false);
  });

  it("wraps driver failures in a safe generic error", () => {
    const wrapped = revisionDbUnavailable(new Error("auth failed for neo4j/test-password at bolt://db.internal:7687"));
    expect(wrapped).toMatchObject({ code: "REVISION_DB_UNAVAILABLE", status: 503 });
    expect(wrapped.message).toBe("Revision database unavailable");
    expect(wrapped.message).not.toContain("test-password");
    expect(wrapped.message).not.toContain("bolt://");
  });
});

describe("DriverSessionExecutor session lifecycle", () => {
  function fakeDriver(runImpl: () => Promise<unknown>) {
    const session = {
      run: vi.fn(runImpl),
      executeWrite: vi.fn(async (fn: (tx: { run: () => Promise<unknown> }) => Promise<unknown>) => fn({ run: session.run })),
      close: vi.fn(async () => undefined),
    };
    return { driver: { session: vi.fn(() => session) }, session };
  }

  it("closes the session after a successful run and after executeWrite", async () => {
    const { driver, session } = fakeDriver(async () => ({ records: [{ toObject: () => ({ n: 1 }) }] }));
    const executor = new DriverSessionExecutor(driver as never, "neo4j");
    await expect(executor.run("MATCH (n) RETURN n", {})).resolves.toEqual([{ n: 1 }]);
    await executor.writeTransaction(async (run) => run("MERGE (n) RETURN n", {}));
    expect(session.close).toHaveBeenCalledTimes(2);
  });

  it("closes the session and throws a safe 503 when the database is unavailable", async () => {
    const { driver, session } = fakeDriver(async () => {
      throw new Error("ServiceUnavailable: bolt://db.internal:7687 password=hunter2");
    });
    const executor = new DriverSessionExecutor(driver as never, "neo4j");
    let caught: unknown;
    try {
      await executor.run("MATCH (n) RETURN n", {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ code: "REVISION_DB_UNAVAILABLE", status: 503 });
    expect((caught as Error).message).not.toContain("hunter2");
    expect(session.close).toHaveBeenCalledTimes(1);
  });
});
