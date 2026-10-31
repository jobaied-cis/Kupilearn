# Kupi Revision Engine — Part 09: Exam Preparation Mode

Status: implemented. Part 10 has not been started.

Scope note: no original Part 09 specification exists in this repo.
This scope was proposed from the remaining deferred capabilities in
the original Part 01 brief ("Exam preparation") and the already
defined but unused `exam_prep` session type in `types.ts`, then
approved by the project owner. Learning analytics/trends remains for
a later part.

## What changed

The dashboard gains an **Exam preparation** section. Starting it runs
a Part 06 session (`exam_prep` type) whose concepts are everything
the student has actually attempted, ranked for an exam: weak first,
then most overdue, then practicing/learning, mastered last —
interleaved round-robin over existing lesson questions.

Deliberately **not** included, because no honest data source exists
for them: exam dates or countdowns, syllabus weighting, predicted
marks, and readiness percentages. None is computed or displayed.

## How selection works (`src/lib/revision/exam.ts`, pure)

- Ranking reuses Part 07's `compareQuizConcepts` (weak → learning →
  practicing → mastered, then lowest score, most overdue, concept id).
- `buildExamQueue` reuses Part 07's interleaving and recently-correct
  de-prioritisation with the Part 09 budget from
  `REVISION_CONFIG.examPrep`: at most 3 questions per concept, 15 per
  session. `quiz.ts` gained optional cap parameters; Part 07 defaults
  are byte-identical (its tests pass unmodified).
- `examPrepSource` labels the queue honestly: `"weak"`, `"due"`,
  `"practicing"`, or `"none"` — a student who has attempted nothing
  gets an empty queue and the runner's empty state, never a
  fabricated one.

## API and integration

- New: `GET /api/revision/exam-prep` (read-only, same 401/403
  student-header ownership as every revision route). Response:
  `{ studentId, exam: { source, concepts[] } }`. No exam dates,
  weights, or readiness fields exist in the contract.
- `RevisionService.getExamPrep` reads mastery + schedules through the
  existing repository interface and derives recently-correct indexes
  via the same parser as Part 07 (now shared as
  `parseRecentlyCorrectIndexes`). It writes nothing.
- The Part 06 runner gained an exam mode (`examConcepts` prop):
  creates the session as `exam_prep` (already accepted by
  `StartSessionInputSchema`), fetches up to the exam per-concept cap,
  and orders with `buildExamQueue`. Daily and weak-concepts modes are
  unchanged.
- Exam answers are ordinary session attempts: Part 03 mastery,
  Part 04 adaptive scheduling, and Part 06 concurrency-safe
  idempotency (deterministic attempt ids, create-once bundle,
  duplicate = stored outcome) apply unchanged — verified by a test
  firing two simultaneous identical `exam_prep` submissions and
  asserting exactly one scored attempt.
- No entity, schema, Cypher, repository, or persistence change. The
  Part 02 privacy/legal gate is untouched, and no AI is called
  (selection is deterministic; Meta-only architecture unchanged).

## Verification

- `exam.test.ts`: weak-first/mastered-last ranking, overdue order,
  source labels, interleaving, 3/15 caps, recently-correct handling,
  empty honesty, determinism.
- Service tests: honest `none`, weak queue with parsed
  recently-correct indexes, per-student isolation, no readiness
  property, simultaneous-duplicate scores exactly once.
- API tests: ownership (401/403) and empty-queue contract.
- Parts 01–08 suites pass; Part 07 quiz expectations unchanged.

## Known limitations

- Exam prep covers only concepts with at least one recorded attempt;
  untouched syllabus topics are not pulled in (there is no honest
  signal to rank them, and no syllabus-weight data to order by).
- Class 6 Math textbook chapters (`c6m-ch*`) still have no NCTB
  concept mapping, so they cannot appear here either.
- Resume after reload follows Part 06 semantics (repository session
  record; localStorage holds only the session pointer). As with quiz
  sessions, resuming from the dashboard's daily section re-enters in
  daily mode; per-question resume granularity does not exist.
- Real Neo4j behaviour and real-browser behaviour remain manually
  unverified, as in Parts 06–08; the in-memory default is the
  test-verified path.
