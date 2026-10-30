# Kupi Revision Engine — Part 08: AI Revision Explanations & Flashcards

Status: implemented. Part 09 has not been started.

Scope note: no original Part 08 specification exists in this repo.
This scope was proposed from Part 01's deferred list ("AI-generated
revision content, flashcards") and its `RevisionContentMeta` contract,
then approved by the project owner.

## What changed

Each weak concept now has a **Revise** action opening a quick-revision
panel: a short explanation (title, body, example, common mistake) and
3–5 tappable flashcards for that exact concept, followed by the
existing targeted-quiz entry. Content is generated on demand — opening
the panel is the only trigger.

## How generation works (`src/lib/revision/content.ts`)

- Live path: the existing Meta-only `LLMClient`
  (`createLLMClient()`), the same provider factory the curriculum
  engine uses. No new provider, client, or API key was introduced.
- The prompt contains **only curriculum data**: concept name, chapter,
  class level, key terms, and the NCTB topic summary. There is no
  student parameter in the prompt builder at all — no student id, name,
  answers, or history can leak into a model call (asserted by test).
- Output is Zod-validated and length-capped (config
  `REVISION_CONFIG.content`) before it can reach a student.
- Process-level cache per concept + language: repeated opens do not
  re-call the model. Content is concept-level, so caching stores no
  learner data, and nothing is written to any repository.

## Offline fallback (honest by construction)

If Meta is unavailable, in mock mode, or returns output that fails
validation, a deterministic builder answers from the NCTB topic
summary, the concept's key terms, and its curated sub-concepts. The
response carries `source: "offline"` and the UI labels it "Offline
revision help" — fallback content is never presented as AI-generated.
The panel never blocks or breaks the revision flow: on total failure
it shows a soft error and all progress remains safe.

## API

`GET /api/revision/content?conceptId=&lang=en|bn` — new, read-only,
same student-header ownership (401/403) as every revision route.
400 for a missing conceptId or bad lang; 404 for an unknown concept
(including unmapped textbook ids such as `c6m-ch4`). It creates no
learner records.

## Verification

- Content service tests with stub LLM clients: validated Meta content,
  cache-once per concept+language, offline fallback on provider
  failure **and** on schema-invalid output, 404 without a model call.
- Offline builder and prompt tests: schema-valid output grounded in
  the concept's own terms; prompt carries curriculum data only.
- API tests: ownership, lang/concept validation, Bangla serving.
- Parts 01–07 suites pass unmodified apart from these additions.

## Manual verification still required

**Real Meta generation is NOT verified in this environment** — no
`META_API_KEY` is configured here (only `.env.example`), so live calls
fall back exactly as designed. To verify for real: set a valid key with
`LLM_PROVIDER=meta`, open a weak concept's Revise panel, and confirm
the panel shows the AI-help label (`source: "meta"`) with grounded
content. Everything else — mock model, offline fallback, caching,
validation — is test-verified.

## Known limitations

- The mock LLM client has no revision fixture, so in `LLM_PROVIDER=mock`
  mode the schema check correctly routes to the offline builder; live
  Meta output quality itself can only be judged manually (above).
- Cache is per server process and resets on restart; generated content
  is deliberately never persisted as learner data.
- Explanations are per concept, not yet adapted to the individual
  student's specific wrong answers; flashcards are front/back text
  only (no images or audio in this part).
