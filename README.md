This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Curriculum Engine (CBSE / NCERT, Classes 6–10)

`src/lib/curriculum/` implements the prerequisite-aware lesson engine:

- `graph/` — Neo4j concept graph: `schema.cypher` (constraints/indexes),
  parameterized `queries.ts`, `repository.ts` (Neo4j + in-memory drivers),
  and `seed-data.json` (sample Class 7 Science slice).
- `textbook/` — NCERT corpus retrieval + §3.2 similarity validator
  (threshold 0.72; deterministic TF cosine — Meta-only, no embedding endpoint).
- `prompts.ts` — Templates A (micro-lesson), B (40-min script), C (remediation);
  every instruction block ≤ 200 tokens.
- `engine.ts` — orchestration: prerequisite audit → textbook retrieval →
  generation → similarity validation with one strict retry; batch map-reduce
  per chapter in dependency order.
- `POST /api/curriculum/lessons` — `{ conceptId, learnerMastery? }` →
  strictly-typed lesson payload or structured error payload.

Decisions: blocking gaps are direct (depth-1) hard prerequisites per the §2
schema rule; the depth-3 window is injected context. Seed objectives/corpus
excerpts are illustrative placeholders — replace with verbatim NCF-SE 2023 /
NCERT text before production use.

```bash
cp .env.example .env.local   # fill META_* to go live; empty key = offline lesson mode
npm test                     # vitest suite
npm run seed:graph           # load schema + seed data into Neo4j (needs NEO4J_*)
docker compose up -d neo4j   # local Neo4j (browser: http://localhost:7474)
```

## Multi-Agent Classroom (Director–Agent Registry)

`src/lib/classroom/` implements the orchestration layer as a multi-agent
classroom, not a single chatbot:

- `registry.ts` — agent registry schema + rules (exactly one teacher, ≥1
  fallible classmate, teacher outranks all, voice mapping); default
  1 Teacher + 1 Assistant + 4 Classmates composition.
- `personas.ts` — per-agent constrained prompts: classmate
  belief-maintenance (§3.2), teacher adaptive explanation (§3.3),
  assistant facilitation, director selection.
- `director.ts` — meta-agent: mandatory turn-taking rules (student
  priority after peer error, 3-utterance checkpoint cadence,
  anti-monologue, strategic delay, scaffold fade), five-stage CPS phase
  machine, LLM selection only when no rule fires, priority fallback.
- `fidelity.ts` — post-generation persona-drift guardrail; drifted
  classmate turns regenerate (≤2) then yield to a teacher redirect.
- `questions.ts` — contextual classmate questions from three triggers
  (boundary clarification, extension, related mistake).
- `voice.ts` — browser-native speech (client `speechSynthesis`) with
  per-persona prosody, latency budget constants, and text-mode fallback.
  No third-party TTS; `TTS_PROVIDER=browser|mock`.
- `turn.ts` — per-turn pipeline: decide → generate → fidelity-check →
  synthesize; stateless agents, Director holds authoritative state.
- `POST /api/classroom/turns` — `{ registry?, state?, student_input?, … }`
  → `{ decision, turn|null, state, registry }`. `turn` is null when the
  Director routes to the student or terminates.

Decisions: VAD/STT live client-side (the server consumes text); the
Director owns `scaffold_level` (the LLM never sets it); phases never
regress; Browser-speech failure drops the session into sticky text mode with
throttled classmate interjections. Offline LLM/TTS fixtures keep the full
loop runnable with zero infra.


## Kupi AI Classroom (Meta-only)

Live classroom: Dashboard → **AI Classroom** (`/dashboard/classroom`).

- **Engines:** Persona Engine (teacher/classmate cards, `src/lib/classroom/`),
  Lesson & Context Engine (`src/lib/lesson/engine.ts`, `POST /api/lessons`),
  Learner adaptation (`src/lib/learner/adapt.ts` — behavior signals only,
  never fixed-intelligence labels), Visualization Engine
  (`src/components/classroom/Whiteboard.tsx` — KaTeX, SVG chart/timeline/
  diagram, pause/replay/zoom, subtitles).
- **Curriculum:** NCTB Classes 6–10, Class → Subject → Chapter → Topic →
  Micro-lesson (`src/lib/nctb/catalog.ts`). Topic objectives only — no
  verbatim textbook text is stored.
- **AI provider:** Meta Llama only, server-side via `META_API_KEY`
  (never sent to the client). Teacher prompts route to
  `META_TEACHER_MODEL` (default `Llama-4-Maverick-17B-128E-Instruct-FP8`),
  classmate/director prompts to `META_CLASSMATE_MODEL` (default
  `Llama-4-Scout-17B-16E-Instruct-FP8`), with JSON validation, retries,
  rate limiting and offline fallback. All Groq/Gemini/OpenAI/Azure/Google
  integrations have been removed; speech is browser-native
  (`speechSynthesis` / `SpeechRecognition` where supported).
- **Substitution note (verified 2026-10-29):** Meta's current hosted
  catalog (`api.meta.ai`) lists Muse models, not Llama 4. If your key is
  for `api.meta.ai`, set `META_API_BASE_URL=https://api.meta.ai/v1` and
  point the two model IDs at models your key can access. With no key
  configured, the app runs the deterministic offline lesson engine and
  shows an "offline lesson mode" banner — it never fakes a live call.
