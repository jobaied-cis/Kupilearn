# Kupi Game Engine — Step 01: Foundation

Status: implemented. Step 02 (playable Puzzle Quest mechanics) has
not been started.

## Repository audit (what actually exists)

| Area | Found in repo | Game Engine decision |
|---|---|---|
| Framework | Next.js 16.4.3 App Router, React 19, Tailwind 4, strict TS, Vitest | New code is framework-free TypeScript under `src/lib/game-engine/`; no routes or UI in Step 01 |
| Curriculum | `src/lib/nctb/catalog.ts` (Classes 6–10, `findTopic`/`getClass`) | Wrapped by `CurriculumAdapter`; never duplicated |
| Lessons | `src/lib/lesson/engine.ts` (`LessonQuestion`, `VizInstruction`) | `LessonContextAdapter` / `VisualizationAdapter` contracts reference these types |
| Learner | `src/lib/learner/adapt.ts` (`adaptLearner`, observable signals only) + new `src/lib/practice` persona engine | `LearnerPreferenceAdapter` wraps `adaptLearner`; session-only, stores nothing |
| Personas | `src/lib/classroom/personas.ts` (teacher/classmate prompt builders) | `PersonaPromptAdapter` contract only; wired in Step 04 |
| Practice/Homework | `src/lib/practice`, `src/lib/homework` (teammate modules, untouched) | Not modified; games will consume content through adapters |
| AI | Meta-only: `src/lib/meta/meta-client.ts`, `createLLMClient()` in curriculum engine | `GameAiAdapter` contract pinned to `provider: "meta"`; no implementation, no model/endpoint invented (Step 04) |
| Progress | Revision Engine (`src/lib/revision`, Parts 01–10) with privacy/legal persistence gate | `LearningProgressAdapter` contract; Step 01 default is session-only no-op — no persistent learner analytics |
| Firebase / auth | **Not present** in this repo (no firebase dependency, no auth system; identity is the anonymous device id from the Revision Engine) | Nothing invented. Adapters are storage-agnostic so an approved backend can be wired later without touching game code |

## Architecture (`src/lib/game-engine/`)

- `types.ts` — client-safe contracts: `GameDefinition`, `GameCategory`,
  `GameMechanic`, `GameSession`, `GameState`, `GameChallenge`,
  `GameEvent`, `GameResult`, `GameAction`, `ValidationResult`.
  `ServerChallenge` (answer key + trusted points) is server-only and
  must never be serialized to a client.
- `registry.ts` — `GameRegistry`: register/get/list by category,
  grade, subject, status. Duplicate ids throw. Only `published`
  games may be offered to students.
- `mechanics.ts` — `MechanicRegistry` plugin architecture for the
  nine future kinds (number-sequence, equation, fraction, shape,
  logic, drag-build, matching, quiz, simulation). Step 01 ships the
  plugin contract, a loud `createStubMechanic` (throws
  `MECHANIC_NOT_IMPLEMENTED`), and one reference multiple-choice
  validator proving the contract. No Puzzle Quest gameplay.
- `challenges.ts` — `ChallengeBank`: only `approved` challenges load;
  `toClientChallenge` strips `answerKey`/`points`.
- `state.ts` — pure deterministic state machine (`ready → playing ⇄
  paused → completed / interrupted`). Invalid actions throw
  `INVALID_TRANSITION`; inputs are never mutated; a bare
  `SUBMIT_ANSWER` transition cannot alter the score trail.
- `events.ts` — typed `GameEventBus` (the eight required event
  types), per-instance listeners, unsubscribe, failure isolation,
  `clear()` for leak-free disposal. No global state.
- `session.ts` — `GameSessionController`: create/start/pause/resume/
  answer/hint/complete/interrupt, auto-complete on the last answer,
  score accumulated only from server-side plugin validation,
  interrupted sessions stay inspectable.
- `runtime.ts` — `GameRuntime`: initializes a registered game,
  verifies referenced mechanics exist, loads approved challenges,
  returns a session controller. Injectable clock/id factory keep it
  deterministic in tests.
- `adapters.ts` — contracts + concrete adapters for NCTB curriculum,
  lesson context, learner preferences (session-only), classroom
  personas, visualization, and learning progress.
- `ai.ts` — Meta-only `GameAiAdapter` contract (Step 04 implements).
- `puzzle-quest.ts` — Puzzle Quest registration: category `puzzle`,
  pilot Class 6 Mathematics, future scope all NCTB subjects
  Classes 6–10, status `development` (never published unfinished).
- `index.ts` — `createGameEngine()` assembly used by tests and
  future steps.

## Safety

- No answer key or trusted scoring in any client-safe type; tests
  assert `toClientChallenge` and `currentChallenge()` strip them.
- No client-trusted scoring: points come only from server-side
  plugin validation.
- No personal data in any type; `learnerRef` is an anonymous
  session reference. No leaderboard, messaging, or profiling.
- Session-only adaptation by default; persistent learner analytics
  remain behind the existing legal-review gate.

## Verification

`game-engine.test.ts` covers registry (duplicates, filters,
published gating), Puzzle Quest registration, stub loudness, plugin
duplicates, challenge approval/client stripping, state transitions
(invalid actions, duplicate answers, pause blocking), event
delivery/unsubscribe/isolation, the full session lifecycle with an
exact event sequence, hints, runtime initialization, and the NCTB /
session-only adapters. Full suite, ESLint, TypeScript, and
production build results are in the Step 01 completion report.

## Step 02 readiness

Step 02 can implement the five Puzzle Quest mechanics
(number-sequence, equation-puzzle, fraction-puzzle, shape-puzzle,
logic-puzzle) as real plugins replacing the stubs, register approved
Class 6 Math challenges, and render them — without changing any
Step 01 contract.
