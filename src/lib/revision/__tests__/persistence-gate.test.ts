import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryRevisionRepository,
  getRevisionRepository,
  isLearnerPersistenceAuthorized,
  setRevisionRepositoryForTests,
} from "../repository";
import { Neo4jRevisionRepository } from "../neo4j/neo4j-repository";
import { GET as overviewGET } from "../../../app/api/revision/overview/route";

const asEnv = (v: Record<string, string>): NodeJS.ProcessEnv => v as NodeJS.ProcessEnv;
const NEO4J_ENV = asEnv({ REVISION_STORE: "neo4j", NEO4J_URI: "neo4j://localhost:7687", NEO4J_USERNAME: "neo4j", NEO4J_PASSWORD: "test-password" });

afterEach(() => {
  setRevisionRepositoryForTests(null);
  delete process.env.REVISION_STORE;
  delete process.env.REVISION_PERSIST_LEARNER_DATA;
});

describe("learner persistence privacy gate", () => {
  it("is off by default and only opens on an explicit true", () => {
    expect(isLearnerPersistenceAuthorized(asEnv({}))).toBe(false);
    expect(isLearnerPersistenceAuthorized(asEnv({ REVISION_PERSIST_LEARNER_DATA: "false" }))).toBe(false);
    expect(isLearnerPersistenceAuthorized(asEnv({ REVISION_PERSIST_LEARNER_DATA: "yes" }))).toBe(false);
    expect(isLearnerPersistenceAuthorized(asEnv({ REVISION_PERSIST_LEARNER_DATA: "true" }))).toBe(true);
  });

  it("defaults to the session-only in-memory store", () => {
    setRevisionRepositoryForTests(null);
    expect(getRevisionRepository(asEnv({}))).toBeInstanceOf(InMemoryRevisionRepository);
  });

  it("refuses Neo4j persistence without legal-review authorization (no silent fallback)", () => {
    setRevisionRepositoryForTests(null);
    let caught: unknown;
    try {
      getRevisionRepository(NEO4J_ENV);
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ code: "REVISION_PERSISTENCE_NOT_AUTHORIZED", status: 503 });
  });

  it("refuses Neo4j persistence when authorized but not configured - missing vars named, values hidden", () => {
    setRevisionRepositoryForTests(null);
    let caught: unknown;
    try {
      getRevisionRepository(asEnv({ REVISION_STORE: "neo4j", REVISION_PERSIST_LEARNER_DATA: "true", NEO4J_PASSWORD: "super-secret-value" }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ code: "REVISION_DB_NOT_CONFIGURED", status: 503 });
    expect((caught as Error).message).toContain("NEO4J_URI");
    expect((caught as Error).message).not.toContain("super-secret-value");
  });

  it("constructs the Neo4j repository only when authorized AND configured", () => {
    setRevisionRepositoryForTests(null);
    const repo = getRevisionRepository({ ...NEO4J_ENV, REVISION_PERSIST_LEARNER_DATA: "true" });
    expect(repo).toBeInstanceOf(Neo4jRevisionRepository);
  });

  it("rejects unknown stores instead of guessing", () => {
    setRevisionRepositoryForTests(null);
    let caught: unknown;
    try {
      getRevisionRepository(asEnv({ REVISION_STORE: "postgres" }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ code: "REVISION_STORE_UNKNOWN", status: 503 });
  });
});

describe("API behaviour when the persistent store is unavailable", () => {
  it("overview returns a safe 503 - no silent in-memory fallback, no internals leaked", async () => {
    setRevisionRepositoryForTests(null);
    process.env.REVISION_STORE = "neo4j"; // gate closed by default
    const res = await overviewGET(new Request("http://localhost/api/revision/overview", { headers: { "x-kupi-student-id": "stu-1" } }));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: string; detail: string };
    expect(json.error).toBe("REVISION_PERSISTENCE_NOT_AUTHORIZED");
    expect(json.detail).not.toContain("neo4j://");
    // The route must not have fallen back to a working in-memory store:
    // a second call fails the same way rather than returning data.
    const again = await overviewGET(new Request("http://localhost/api/revision/overview", { headers: { "x-kupi-student-id": "stu-1" } }));
    expect(again.status).toBe(503);
  });
});
