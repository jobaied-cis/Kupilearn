# Kupi Game Engine — Step 02: Puzzle Quest & Core Mechanics

Status: implemented. Step 03 (Learning & Adaptive Engine) has not
been started. Step 01 contracts are preserved; additions are
backward-compatible (`attemptAnswer`, `requestProgressiveHint`,
`createSessionForChallenges`, optional challenge metadata).

## Six mechanic plugins (`src/lib/game-engine/mechanics/`)

All implement the Step 01 `MechanicPlugin` contract, register through
`registerPuzzleQuestMechanics`, validate deterministically with no
AI, return structured `ValidationResult`s, and answer malformed,
empty, or incomplete submissions with a supportive "not correct"
result instead of throwing.

| Mechanic | Validation |
|---|---|
| Number Sequence | Recomputes the arithmetic progression from the visible sequence; supports increasing/decreasing and difficulty via payload |
| Equation Puzzle | Solves a·x + b = c exactly (integer-checked) |
| Fraction Puzzle | Compare / equivalent / simple modes by exact cross-multiplication; accepts "2/4" or {numerator, denominator} |
| Shape Puzzle | Text-defined shape facts (sides, vertices, angle sum (n−2)×180°, name) — no ambiguous diagrams |
| Logic Puzzle | Single unambiguous option; the correct option lives only in the server answer key, never in the payload |
| Drag & Build | Submitted tile order vs server-held target; the same string-array answer serves drag, tap-to-place, and keyboard reordering |

## Mission (Class 6 Mathematics, sample content)

`pq-c6-math-first-steps` — warm-up number sequence → equation →
fraction comparison → shape facts → logic → final drag-build
(3 + 4 = 7). Anchored to repo NCTB catalog topics (`c6-math-factors`,
`c6-math-equations`, `c6-math-fractions`, `c6-math-angles`,
`c6-math-algebraic`). The questions are original demo questions:
`contentStatus: "draft-sample"`, labelled "Sample mission" in the UI,
**not NCTB-approved**. Every challenge carries a server answer key,
3 progressive hints, an explanation, a difficulty, a learning
objective, and points. `validateMission` enforces this shape.

Flow: landing → mission card → introduction (objectives, sample
label) → warm-up → main challenges → final independent challenge →
results. Progressive hints go clue → strategy → guided explanation
and never state the answer. A wrong answer gets supportive feedback
and one retry before it is recorded; nothing shames or pressures.

## Server-side validation (security)

`src/lib/game-engine/server.ts` is server-only and holds every
answer key inside the engine's challenge bank. API:

- `GET /api/games/missions` — client-safe missions
- `POST /api/games/sessions { missionId }` — start (201)
- `POST /api/games/sessions/[id]/answer { challengeId, answer }` —
  validated by plugin; client-sent `correct`/`score` fields are
  ignored (test-proven)
- `POST /api/games/sessions/[id]/hint`, `/pause`, `/resume`

`toClientChallenge` strips `answerKey`, `points`, `hints`, and
`explanation`; tests assert none appears in any client payload.
Scores accumulate only from server plugin validation. No AI provider
is called (Step 04), no leaderboard, no messaging, no persistent
learner data — sessions live in server process memory only.

## UI

`PuzzleQuest` inside the existing Games dashboard section
(`/dashboard/games`): mission cards, introduction, gameplay with
per-mechanic inputs (numeric, fraction choice, option radios,
tile builder with tap-to-place plus ←/→ keyboard reordering and
remove), hint button with level indicator, retry feedback, session
progress bar, pause/resume, and a results screen (challenges,
correct, hints used, server score). English-first with Bangla via
the existing `pick(lang, …)` pattern; existing Kupi card/button
styles; no dashboard redesign.

## Verification

- `mechanics.test.ts` + `game-engine.test.ts`: every mechanic
  (valid/invalid/empty/malformed), fraction equivalence/comparison,
  equation solving, sequence solving, drag-build arrangement,
  registration/discovery, mission validation, client-payload safety,
  progressive hints, retry semantics, event sequence, results.
- `games-api.test.ts`: missions payload safety, session validation
  errors, server scoring ignoring client-claimed score/correctness.
- Live HTTP playthrough on a production server: all six challenges
  answered correctly through the real API, session completed,
  score 65, 6/6 correct; `/dashboard/games` returned 200.
- Full project test suite, ESLint, TypeScript, production build:
  all pass (see completion report).

## Limitations

- In-memory server sessions: a server restart ends in-progress
  games; nothing is persisted (by design in this step).
- One demonstration mission; no other classes/subjects have playable
  content yet, and the mission is sample content, not NCTB-approved.
- Browser click-through was not run (no browser available in this
  environment); gameplay was verified end-to-end through the real
  HTTP API the UI calls, plus the page returning 200.
- Drag & Build accepts the target arrangement exactly; equivalent
  but differently ordered builds (e.g. 4 + 3 = 7) are marked wrong
  for now — commutative acceptance is a Step 03+ refinement.

## Step 03 readiness

Step 03 can add adaptive difficulty on top of the deterministic
plugins (difficulty fields already flow through payloads), wire the
`LearningProgressAdapter`, and expand mission content — without
changing Step 01/02 contracts.
