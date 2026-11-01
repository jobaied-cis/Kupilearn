# Kupi Game Engine — Step 04: Meta AI Game Director

Status: implemented with mocked Meta responses. **Live Meta is NOT
verified in this environment** — no `META_API_KEY` is configured
here, so every AI call deterministically falls back to built-in
help, exactly as designed. Step 05 has not been started.

## Meta provider (verified from the project, not invented)

Kupi already had a complete Meta-only stack; Step 04 reuses it and
adds no new client, SDK, model, or endpoint:

- Transport/config: `src/lib/meta/meta-client.ts` — env config
  (`META_API_KEY`, `META_API_BASE_URL`, `META_TEACHER_MODEL`,
  `META_CLASSMATE_MODEL`, `META_TIMEOUT_MS`, `META_MAX_RETRIES`),
  timeout via AbortController, bounded retries (capped at 4),
  in-process rate limiting, JSON schema validation.
- Models (per `.env.example`, verified against the project's Meta
  account model list): teacher `muse-wonder-1.0`, classmates
  `muse-spark-1.3` at `https://api.meta.ai/v1`, OpenAI-compatible
  chat completions. The client routes teacher/classmate by role.
- **Blocker for live verification:** no `META_API_KEY` in this
  environment (checked: env unset, no `.env.local`). To verify live:
  set a real key with `LLM_PROVIDER=meta`, start a Puzzle Quest
  session, press "Ask for a hint", and confirm the reply is *not*
  labelled "built-in help" (`source: "meta"`). Until then, only
  mock-based behaviour is claimed.

## Architecture

- `meta-adapter.ts` — `MetaGameAiAdapter` (implements the Step 01
  `GameAiAdapter`): wraps the existing `createLLMClient()` routing
  client, adds per-session throttling (800 ms spacing, 12-call
  session budget), strict zod response schema, and an `available`
  flag that is false when Meta is unconfigured or
  `LLM_PROVIDER=mock`. Test double: `createMockGameAiAdapter`.
- `personas.ts` — configurable personas. AI Teacher (friendly,
  patient, supportive; six teaching modes: hint, concept, step-by-
  step, misconception correction, revision, encouragement) and three
  AI Classmates: Rafi · Curious Explorer, Tania · Logical Thinker,
  Arif · Friendly Learner. Each has id, display name (Bangla too,
  always labelled "AI classmate"), avatar config from the existing
  Icon/design system, personality, speaking style, role, safety
  rules, model role, languages. They are fictional AI characters —
  the UI says so in both languages, and there is no student-to-
  student messaging anywhere.
- `director.ts` — `GameDirector`: validates the action, builds a
  minimal prompt from trusted server-side context only (question,
  learning objective, verified-or-draft curriculum status, session
  performance summary, practice level), calls the adapter with the
  persona's model role, validates the response, and falls back
  deterministically. Actions: GENERATE_HINT, EXPLAIN_CONCEPT,
  EXPLAIN_MISTAKE, ASK_GUIDING_QUESTION, START_CLASSMATE_DISCUSSION,
  SUMMARIZE_LEARNING, ENCOURAGE_LEARNER. The Director returns display
  text only — it cannot modify state, scores, correctness, or
  difficulty (test-asserted).
- `ai-service.ts` — one Director per game session, capped
  conversation history (10 turns, server process memory only, never
  persisted), served via `POST /api/games/sessions/[id]/director`.
- `ai-safety.ts` — every response is checked: non-empty, length cap,
  fabricated NCTB/page claims, unsafe language, personal-data
  solicitation, and answer leakage (for hints below level 3, guiding
  questions, and classmate discussion the answer value may not
  appear). Student free text is length-capped, stripped of
  emails/phones, and instruction-like content is dropped;
  prompts present it as quoted data, never instructions.

## Progressive AI hints

GENERATE_HINT levels 1–3 are clamped server-side; the prompt pins
the level, and leakage validation rejects early hints containing
the answer. When AI is unavailable or its output is rejected, the
deterministic Step 02 static hint for that level is served instead
— the same hint text, honestly labelled built-in help.

## UI

In the Puzzle Quest gameplay screen: an "AI learning friends" panel
with persona selection (Teacher + three classmates, radio group),
Ask for a hint / Explain the idea / Encourage me actions, loading
state, session conversation history (last 10), an explicit
"fictional AI characters" note, and an offline note when built-in
help was served. English-first, Bangla via the existing i18n,
existing Kupi card/button styles. AI is optional: the whole game
works identically without it.

## Privacy

Prompts contain only the current question, trusted curriculum/
lesson context, and a temporary session performance summary. No
student name, birth date, contact, school, or history exists in a
game session to send. No conversation memory persists beyond the
session, no trait inference, no background AI calls.

## Verification

Mock-based tests (`ai.test.ts`) cover: adapter configuration and
unavailable behaviour, verified model selection, retry/timeout
config caps, per-session throttling, three persona configs, teacher
config, director routing for all action kinds, hint-level
enforcement, answer-leakage and unsafe-output rejection with
fallback, prompt-injection sanitization, privacy filtering,
curriculum grounding lines, session history caps, and no game-state
mutation. Step 01–03 suites pass; full suite, ESLint, TypeScript,
and production build pass (see completion report). Live Meta smoke
test: **not performed** (no credentials — blocker above).

## Step 05 readiness

Rewards/progress expansion can consume the same session result and
director history surfaces. Before any live rollout, run the manual
live-Meta smoke test above with a real key.
