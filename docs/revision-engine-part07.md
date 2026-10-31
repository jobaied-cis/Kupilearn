# Kupi Revision Engine — Part 07: Targeted Weak-Concept Quizzes

Status: implemented. Part 08 has not been started.

Scope note: no original Part 07 specification exists in this repo.
This scope was proposed from Part 01's deferred list ("targeted
quizzes") and the Part 06 limitation ("questions are lesson checkpoint
questions, not purpose-built revision items"), then approved by the
project owner.

## What changed

The Weak Concepts section now starts a **targeted quiz**: a Part 06
session (`weak_concepts` type) whose questions are selected and
sequenced for this student — weakest concepts first, interleaved,
already-proven questions de-prioritized. Question content is unchanged:
existing lesson questions only. Nothing is generated, no AI is called,
and no question bank was created.

## How targeting works (`src/lib/revision/quiz.ts`, pure)

1. Concept ranking: weak → learning → practicing → mastered, then
   lowest mastery score, then most overdue, then concept id.
2. Per concept, question order: indexes not recently answered correctly
   first; recently-correct ones only when no fresh alternative exists
   (preference, never a blocker).
3. Round-robin interleave (A1 B1 C1 A2 B2 …) with the Part 06 session
   budget: at most 2 questions per concept, 10 per quiz.
4. Deterministic: identical history → identical queue.

`GET /api/revision/targeted-quiz` (new, read-only, same 401/403
ownership) returns the ranked concepts plus `recentlyCorrectIndexes`
derived server-side from recorded attempts. Its `source` field is
honest: `"weak"`, `"due"` (fallback when nothing is weak but work is
due), or `"none"` (empty queue — the runner then shows its empty
state and fabricates nothing).

## Integration

- The Part 06 runner gained a quiz mode (concepts + `weak_concepts`
  session type); the daily-plan flow is byte-identical in behaviour
  and covered by its existing tests.
- Quiz answers are ordinary session attempts: Part 03 mastery, Part 04
  adaptive scheduling, Part 05 planning, and Part 06
  concurrency-safe idempotency (deterministic attempt ids, create-once
  bundle, duplicate = stored outcome) all apply unchanged. A quiz
  answer submitted twice — even simultaneously — scores exactly once.
- No entity, schema, or contract change anywhere else. Privacy gate
  and Meta-only architecture untouched.

## Verification

- `quiz.test.ts`: weak-first ordering, interleaving, per-concept and
  total caps, recently-correct exclusion and fallback, empty honesty,
  determinism.
- Service tests: weak queue with parsed recently-correct indexes,
  due fallback, honest `none`.
- API tests: ownership and empty-queue contract.
- Parts 01–06 suites pass; quiz answers move mastery/schedules through
  the same assertions as Part 06.

## Known limitations

- Targeting is selection and sequencing of existing per-topic lesson
  questions. Purpose-built question authoring and AI-generated
  revision content remain later parts.
- Recently-correct detection parses question indexes from our own
  attempt question ids (`:revision:N` / `:checkpoint:N`); questions
  answered under other id schemes are treated as fresh.
- Interleaving is simple round-robin; difficulty does not adapt
  within a quiz session yet.
