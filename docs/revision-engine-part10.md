# Kupi Revision Engine — Part 10: Learning Analytics & Trends

Status: implemented. This completes the Revision Engine parts.

Scope note: no original Part 10 specification exists in this repo.
This scope was proposed from the remaining deferred capability in
the original Part 01 brief ("Learning analytics") and the Part 01
analytics foundation, then approved by the project owner.

## What changed

The revision dashboard gains a **Your progress** section
(`RevisionTrendsPanel`): a read-only, time-window view (7/30/90
Dhaka days) of what the student actually did — daily questions and
correct counts, sessions completed, active-day consistency, accuracy
change, mastery movement, subject breakdown, and which weak concepts
are improving. Every number traces to a recorded attempt or session;
nothing is fabricated, smoothed, or back-filled.

## How trends are derived (`src/lib/revision/analytics.ts`)

`computeRevisionTrends` extends the Part 01 snapshot module — no
duplicate analytics engine. It is pure and writes nothing.

- **Daily series**: attempts/correct/accuracy bucketed by Asia/Dhaka
  date (Part 05 fixed-offset helpers). Accuracy is `null`, never 0,
  on days with no attempts.
- **Accuracy change**: second-half minus first-half accuracy in
  percentage points, reported only when both halves have at least
  `analytics.minAttemptsPerHalf` (5) attempts; otherwise `null` and
  the UI says "Not enough data".
- **Consistency**: active days (≥1 attempt or a completed session)
  and the longest consecutive run **inside the window**, labelled as
  such — no streak is claimed beyond the window.
- **Mastery progression**: current status counts from the stored
  snapshot, plus window-start mastered/weak counts derived by
  replaying recorded attempts through the Part 03 scoring/status
  functions (`computeMasteryScore`, `deriveMasteryStatus`). Mastery
  history is not stored, so this is labelled derived in the UI.
  Concepts weak at window start and not weak now are listed as
  improving; concepts still weak are listed separately.
- **Subjects**: attempts grouped by the concept registry's
  `subjectId`. Concepts with no mapping are counted as
  `unmappedAttempts`, never guessed into a subject.
- **Sessions**: started/completed per session type
  (daily/weak_concepts/exam_prep/free) from stored session records.

## API and integration

- New: `GET /api/revision/trends?days=7|30|90` (default 30; other
  values 400), same 401/403 student-header ownership as every
  revision route.
- `RevisionService.getTrends` reads attempts (explicit cap
  `analytics.maxAttempts` = 1000, since the repository default is
  50), sessions, and mastery through the existing repository
  interface. The response carries `attemptsConsidered` and
  `truncated` — when a cap is hit the UI says totals cover recent
  activity only, so a partial window is never presented as complete.
- Read-only is test-proven: a service test snapshots mastery,
  attempts, sessions, schedules, and events before/after a trends
  read and asserts byte-identical state.
- No entity, schema, Cypher, repository-interface, or persistence
  change. The Part 02 privacy/legal gate is untouched. No AI is
  called anywhere in this part (Meta-only architecture unchanged).
- UI: window toggle (7/30/90), active-day/longest-run/accuracy-change/
  mastered tiles, daily activity bars with an accessible data table,
  subject rows, improving/still-weak lists, truncated notice. All
  strings go through `pick(lang, en, bn)`. Loading skeleton, error
  with retry, and an honest empty state ("Not enough history yet…")
  when nothing has been recorded.

## Verification

- `analytics.test.ts`: empty-window honesty, Dhaka boundary bucketing
  (17:59:59Z vs 18:00:00Z), accuracy-null days, delta suppression and
  100-point delta at threshold, consistency/longest run, replay-based
  improving detection, subject grouping with unmapped counting,
  truncation passthrough.
- Service tests: read-only snapshot equality, per-student isolation,
  capped-read shape.
- API tests: ownership (401/403), window validation (400), honest
  empty trends for a new student.
- Parts 01–09 suites pass unmodified apart from these additions.

## Known limitations

- Mastery at window start is a replay derivation, not stored history;
  scores use attempt timestamps only, so long breaks decay concepts
  uniformly (Part 03 semantics).
- Attempt/session reads are capped (1000/200). Beyond that, totals
  cover recent activity and `truncated` says so.
- With the default in-memory store, trends shrink when the server
  restarts — unchanged Part 01/02 semantics; the gated Neo4j store
  behaves identically through the same interface.
- Abandoned in-progress sessions count as not completed (no expiry
  exists anywhere in the app, and none was invented here).
- Real Neo4j and real-browser verification remain manual, as in
  Parts 06–09; the in-memory default is the test-verified path.
