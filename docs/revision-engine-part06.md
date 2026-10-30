# Kupi Revision Engine — Part 06: Daily Revision Session Runner

Status: implemented. Part 07 has not been started.

Scope note: no original Part 06 specification exists in this repo (see
the Part 06 planning phase). This scope — making daily revision
sessions playable end-to-end — was proposed from Part 01's deferred
capability list and approved by the project owner.

## What changed

The Daily Revision section now runs a real session
(`RevisionSessionRunner`): today's planned concepts (Part 05), one at
a time, answered with existing lesson questions, ending in a summary.
The Start button previously created an orphan empty session; it now
opens the runner, which owns the session lifecycle.

## Flow

1. Start: `POST /api/revision/sessions` (`daily`), concepts taken from
   today's daily plan in plan order (Part 05 fairness), capped by
   `REVISION_CONFIG.session` (2 questions/concept, 10/session).
2. Questions: the existing lesson pipeline (`POST /api/lessons`) for the
   concept's topic — sub-concepts use their parent topic. No new
   question bank, no new AI call path (Meta-only unchanged). A concept
   whose questions cannot load is skipped and **named in the summary**.
3. Answers: `POST /api/revision/attempts` with `sessionId` and
   `source: "revision"` — the one existing scoring pipeline (mastery
   Part 03, scheduling Part 04, session tally, analytics).
4. Finish or end early: `POST /api/revision/sessions` complete
   (idempotent). Summary shows concepts revised, questions, correct,
   accuracy, and skipped concepts. The dashboard then refreshes
   overview + daily plan, so tomorrow's plan already reflects it.

## Concurrency-safe idempotency

A read-before-write check alone is NOT safe under simultaneous
requests, so Part 06 does not rely on one:

- When an attempt carries both `sessionId` and `questionId`, its id is
  deterministic: `att_idem_<sha256(student|session|question)>`.
  Session-less callers (classroom, Parts 01–05) keep random ids and
  identical behaviour.
- Inside the atomic bundle, the attempt write is create-once:
  Neo4j uses `CREATE` (`ADD_ATTEMPT_ONCE`) under the existing unique
  constraint on attempt id — a duplicate fails the whole transaction
  and mastery/schedule/event roll back; the in-memory bundle checks
  existence before writing anything. Both raise
  `DuplicateAttemptError`.
- The service catches it and returns the stored outcome with
  `duplicate: true` — no counters, tally, schedule, or event change.
  On Neo4j this is database-enforced, so it holds across server
  instances; no process-local lock was added (it could not).
- Client side additionally: options lock after selection, a per-question
  submission guard, and a failed recording can be retried without
  advancing — never faked as recorded.

Verified by tests that fire two **simultaneous** identical submissions
(`Promise.all`) and assert exactly one scored attempt on the in-memory
repository, plus a Neo4j fake-executor test proving the bundle uses
create-once and a constraint failure commits nothing.

## Resume after page reload

- localStorage holds **only the session pointer**
  (`kupi-revision-session` → session id), like the other `kupi-*` keys.
  No answers or progress are stored in the browser.
- Real progress lives in the repository session record
  (`conceptsReviewed`, totals, `completedAt`). On load, the dashboard
  finds the in-progress session and offers Resume: remaining concepts =
  today's plan − `conceptsReviewed`, so completed concepts are never
  re-asked. A half-finished concept restarts its questions, and the
  idempotency above makes re-answers safe.
- Honest limit: with the default in-memory store, a **server restart**
  (not a page reload) still ends continuity — unchanged Part 01/02
  semantics. Under the gated Neo4j store, resume survives restarts.

## Compatibility

No API contract changed (one additive `duplicate` field on replayed
attempt responses). No entity or schema change. Direct `addAttempt`
keeps its Part 02 idempotent MERGE; only the bundle uses create-once.
Privacy gate, repositories, and the Meta-only architecture are
untouched.

## Known limitations

- Questions are lesson checkpoint questions, not purpose-built revision
  items; targeted quizzes and AI explanations remain later parts.
- Resume granularity is per concept, not per question.
- An in-progress session abandoned forever stays in history as
  in-progress (Part 01 semantics); there is no expiry job.
