# Kupi Revision Engine — Part 01: Foundation

Status: implemented. Part 02 (real mastery algorithm, adaptive scheduling,
AI revision content) must build on these interfaces without changing them.

## What already existed (reused, not duplicated)

| Area | Existing system | How Part 01 reuses it |
|---|---|---|
| Curriculum | `src/lib/nctb/catalog.ts` — NCTB Class 6–10 → Subject → Chapter → Topic, stable topic ids | Concept registry is derived from it; a topic id **is** a concept id |
| Curriculum graph | `src/lib/curriculum/graph/` — Neo4j + in-memory repository, `schema.cypher` | Same repository-interface + in-memory-default + Cypher-schema convention |
| Lessons | `src/lib/lesson/engine.ts`, `POST /api/lessons` | Untouched; classroom checkpoints feed the revision pipeline |
| Learner profile | `src/lib/profile.ts`, `src/lib/learner/` (localStorage, no login) | `recordAnswer` behaviour unchanged; revision reporting is additive |
| AI | Meta-only (`src/lib/meta/meta-client.ts`) | No AI is called in Part 01; no new provider added |
| UI | Dashboard shell, `DashboardViews`, i18n (`en`/`bn`), Icon, card styles | `/dashboard/revision` now renders `RevisionDashboard` |

There is **no student database and no auth system** in Kupi today. Part 01
therefore does not invent one: persistence sits behind
`RevisionRepository` (in-memory default, `REVISION_STORE=memory`), and
`src/lib/revision/schema.cypher` defines the Neo4j constraints/indexes for
the production store, mirroring the curriculum graph convention.

## Module map (`src/lib/revision/`)

- `config.ts` — interval ladder (1/3/7/14/30 days), weak/mastered thresholds.
- `types.ts` — the five logical entities as Zod-checked types + API inputs.
  API inputs deliberately contain **no** `masteryScore`/`masteryStatus`:
  scores are computed server-side only.
- `concepts.ts` — concept registry from the NCTB catalog plus curated
  sub-concepts (Class 8 Algebraic Expressions: variables, constants,
  coefficients, like/unlike terms, addition, subtraction). Append-only ids.
  `conceptIdForTopicId()` is the only approved lesson→concept mapping.
- `mastery.ts` — placeholder scoring (accuracy) + status derivation.
  **Part 02 replaces `placeholderMasteryScore` behind the same signature.**
- `scheduling.ts` — deterministic next-review/priority calculation.
- `repository.ts` — `RevisionRepository` interface + in-memory impl.
  Every read is scoped by `studentId`; there is no cross-student query.
- `service.ts` — `RevisionService`: overview, mastery, weak concepts,
  upcoming, attempts, events, sessions.
- `events.ts` — `processLearningEvent` for lesson_completion,
  understanding_check, practice, homework, exam_prep sources.
- `analytics.ts` — pure metrics (accuracy is `null`, never `0`, when
  nothing has been attempted).
- `server.ts` — ownership. `x-kupi-student-id` header is required (401),
  and any conflicting `studentId` in query/body is rejected (403).
  Swap `getRequestStudentId` for real auth later; nothing else changes.
- `client.ts` — stable anonymous student id (`kupi-student-id` in
  localStorage), `revisionFetch`, fire-and-forget `submitRevisionAttempt`,
  duplicate-safe `createCheckpointReporter`.

## Concept mapping rule (important)

`lesson.id` must **never** be used as a conceptId: the lesson engine
overwrites it with a textbook chapter id (`c6m-ch4`) for real-book lessons.
Classroom checkpoints map through `chapter.topicId` → `conceptIdForTopicId`.

Missing mappings are reported, never faked: Class 6 Mathematics textbook
chapters (`c6m-ch1`–`c6m-ch8`, subtopics `c6m-chX-1`) have no NCTB topic
concept yet, so classroom answers there create **no** mastery record
(a `console.warn` names the chapter). The server independently rejects
unknown concept ids with `404 CONCEPT_NOT_FOUND` and writes nothing.

Attribution is topic-level only: checkpoint questions
(`LessonQuestion`) carry no concept tag, so attempts are never attributed
to sub-concepts such as “Variables”.

## API contract (`/api/revision/*`)

All requests need the `x-kupi-student-id` header. All responses are JSON;
errors are `{ error, detail }` with 400/401/403/404/500 as appropriate.

| Route | Description |
|---|---|
| `GET /overview` | Metrics, mastery, weak concepts, upcoming, due-today, recent sessions/attempts |
| `GET /mastery?subjectId=&classLevel=&chapterId=` | Student mastery records (filters validated; classLevel 6–10) |
| `GET /weak-concepts` | Concepts flagged weak, lowest score first |
| `GET /upcoming?days=7` | Schedules due now or within `days` (0–90) |
| `POST /events` | `{ eventType, conceptId?, metadata? }` → 201 |
| `POST /attempts` | `{ conceptId, isCorrect, questionId?, studentAnswer?, difficulty?, responseTimeMs?, sessionId?, source? }` → 201 with server-computed mastery + schedule |
| `GET /sessions?sessionId=` | One session, or session history without `sessionId` |
| `POST /sessions` | `{ sessionType? }` starts; `{ action: "complete", sessionId }` completes (idempotent) |

## Frontend

- `/dashboard/revision` → `src/components/revision/RevisionDashboard.tsx`
  (overview/mastery summary, daily revision, weak concepts, upcoming,
  history; loading, error and empty states; `en`/`bn`).
- `/revision` redirects to `/dashboard/revision`.
- Classroom integration: correct/incorrect checkpoint answers in
  `ClassroomFlow` call `reportCheckpointAttempt` after the existing
  `recordAnswer` learner tracking, which is unchanged.

## Known limitations (Part 01 scope)

1. In-memory store resets on server restart; Neo4j/Postgres persistence
   is Part 02+ work behind `RevisionRepository` (schema already provided).
2. Student identity is a device-local anonymous id — there is no login in
   Kupi yet. Ownership checks enforce header↔student match, but this is
   not authentication.
3. Mastery score is placeholder accuracy; no adaptive algorithm yet.
4. No AI-generated revision content, flashcards or targeted quizzes yet
   (metadata types only, in `types.ts`).
5. Class 6 Math textbook chapters have no concept mapping yet (above).
6. Dashboard home “Revision cards” count and Progress placeholders are
   pre-existing fabricated UI outside the revision page; left untouched.

## Part 02 entry points

- Replace `placeholderMasteryScore` in `mastery.ts`.
- Make scheduling adaptive inside `scheduling.ts#nextReview`.
- Implement a persistent `RevisionRepository` using `schema.cypher`.
- Add NCTB concepts for Class 6 Math textbook subtopics, then map
  `mathChapterId` subtopics through the same `conceptIdForTopicId`-style
  resolver (append-only; do not rename existing ids).
