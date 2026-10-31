# Kupi Revision Engine — Part 02: Neo4j Persistent Storage

Status: implemented behind a privacy gate. **Persistence is OFF by
default.** Part 03 has not been started.

## Architecture

```
API routes (Part 01, unchanged contracts)
  -> RevisionService (unchanged business logic)
    -> RevisionRepository interface (unchanged, plus atomic saveAttemptOutcome)
      -> InMemoryRevisionRepository   (REVISION_STORE=memory, default)
      -> Neo4jRevisionRepository      (REVISION_STORE=neo4j, gated)
           -> RevisionNeo4jExecutor   (one session per operation, always closed)
             -> shared neo4j-driver singleton (lib/revision/neo4j/connection.ts)
```

- Existing dependency reused: `neo4j-driver` ^6.2.0 (already used by the
  curriculum graph). No new database library, no second database system.
- The revision driver is a lazy pooled singleton - never created per
  request. Sessions are opened per operation and closed in `finally`,
  including on error. Write bundles use `session.executeWrite`, so a
  multi-statement write commits or rolls back as one transaction.
- Server-side only. No `NEXT_PUBLIC_` Neo4j variable exists; credentials
  are never logged or returned. All failures surface as
  `RevisionError` 503 (`REVISION_DB_NOT_CONFIGURED`,
  `REVISION_DB_UNAVAILABLE`, `REVISION_PERSISTENCE_NOT_AUTHORIZED`,
  `REVISION_STORE_UNKNOWN`) with generic messages - internal driver
  errors, hosts and credentials are stripped.

## Privacy gate (read before enabling)

Mastery records, attempt history and revision events are learner records
about school-age students. The product requirement is that persistent
inferred mastery / behavioural profiling needs **legal review first**.
That approval is not recorded anywhere in this codebase, so:

- Default `REVISION_STORE=memory`: session-only adaptation, nothing is
  persisted. This remains fully functional.
- `REVISION_STORE=neo4j` additionally requires
  `REVISION_PERSIST_LEARNER_DATA=true`. Without it the API returns
  `503 REVISION_PERSISTENCE_NOT_AUTHORIZED`.
- There is **no silent fallback**: asking for Neo4j and failing config,
  gate, or connectivity returns 503. A write is never reported as
  persisted when it only reached memory.
- Records store only the Part 01 fields plus the existing anonymous
  device student id. No names, school names, addresses, emails or other
  profile data exist in these entities. Persisted event metadata is
  additionally filtered (`sanitizeEventMetadata` in
  `src/lib/revision/neo4j/queries.ts`) - keys matching personal-data
  patterns are dropped before writing.
- Session-only adaptation (learner profile in localStorage, in-memory
  revision store) is unaffected.

## Repositories and Cypher

`Neo4jRevisionRepository` implements every `RevisionRepository` method:

- All Cypher lives in `src/lib/revision/neo4j/queries.ts`. Every value is
  a `$parameter`; no string interpolation of ids, answers or metadata.
- Writes are `MERGE` on the schema node keys
  (`{student_id, concept_id}`, `{student_id, session_id}`, attempt/event
  `id`), so repeating an operation updates in place - no duplicates.
- `saveAttemptOutcome` writes attempt + mastery + schedule + event in
  one write transaction (service now builds the bundle, then the
  repository commits it atomically).
- Reads filter on `student_id` first; bounded lists pass `LIMIT $limit`
  (clamped 1..500). Property mapping snake_case <-> camelCase happens
  only in `queries.ts`.

## Schema and initialization

Source of truth: `src/lib/revision/schema.cypher` (Part 01 constraints,
plus Part 02 indexes for mastery-by-subject, mastery-by-chapter and
session-by-time lookups).

Initialize manually, as an operator step:

```bash
cp .env.example .env.local   # set NEO4J_* to your real values, locally
npm run init:revision-db
```

`scripts/revision/init-neo4j.mjs` applies only `CREATE CONSTRAINT` /
`CREATE INDEX ... IF NOT EXISTS` statements and refuses anything else.
It never deletes data, never seeds learner records, and is safe to
re-run. Student API requests never run schema statements.

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `REVISION_STORE` | no | `memory` (default) or `neo4j` |
| `REVISION_PERSIST_LEARNER_DATA` | for neo4j | must be `true`, only after legal review |
| `NEO4J_URI` | for neo4j | e.g. `neo4j://localhost:7687` |
| `NEO4J_USERNAME` | for neo4j | database user |
| `NEO4J_PASSWORD` | for neo4j | database password (server-side only) |
| `NEO4J_DATABASE` | no | database name, default `neo4j` |

## Manual setup still required (before enabling persistence)

1. Legal review approving persistent mastery/attempt/event records for
   school-age learners, plus consent and data-retention decisions.
2. A real Neo4j instance (e.g. `docker compose up -d neo4j`) with a
   non-default password in `.env.local`.
3. `npm run init:revision-db` against that instance.
4. Set `REVISION_STORE=neo4j` and `REVISION_PERSIST_LEARNER_DATA=true`.
5. Re-run the revision API smoke checks against the real database.

## Verification status

- Unit/integration tests use a fake executor with the same
  all-or-nothing transaction contract: config validation, missing env,
  session close on success/error, CRUD, duplicate MERGE behaviour,
  transaction rollback, parameterized-Cypher audit, DB-unavailable 503s,
  privacy gate, metadata filtering, and Part 01 API compatibility.
- **No real Neo4j connection was available in the development
  environment** (no server on :7687, no Docker), so real-database
  integration is NOT verified. Steps 2-5 above remain manual.

## Known limitations

- Real-database behaviour (constraint violations, integer coercion,
  transaction retries) is mock-verified only, per above.
- The session tally after a bundled attempt (`noteAttemptInSession`) is
  a separate write; if it fails the attempt bundle stays committed and
  the tally can lag. Acceptable for Part 02; a future part can fold it
  into the same transaction.
- In-memory store remains the default and resets on restart by design.
