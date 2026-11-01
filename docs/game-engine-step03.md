# Kupi Game Engine — Step 03: Learning & Adaptive Engine

Status: implemented. Step 04 (Meta AI Game Director) has not been
started. Step 01/02 contracts are preserved; all Step 03 additions
to API responses are additive fields.

## Curriculum Context Engine (`curriculum-context.ts`)

`resolveCurriculumContext` returns a versioned, traceable context:
source, source reference, class, subject, chapter, topic, subtopic,
learning objective, prerequisites, difficulty, and approval status.

- Structure comes from the repo's NCTB catalog; for Class 6
  Mathematics it links catalog topics to the transcribed textbook
  (`CLASS6_MATH`, NCTB Mathematics Class Six, Revised Edition
  Oct 2025) — e.g. fractions → Chapter One "Natural Numbers and
  Fractions" (book p. 1), equations → Chapter Five "Simple
  Equations", algebraic expressions → Chapter Four, geometry →
  Chapter Six. The source reference carries the edition and chapter,
  so every claim is traceable.
- Approval is honest: textbook-linked contexts are `verified`;
  catalog-only contexts stay `draft-sample`. Prerequisite lists are
  our draft pedagogical mapping and are labelled
  `prerequisitesSource: "draft-sample"`. No chapter numbers, pages,
  or quotations are invented — the link table only claims chapters
  whose verified titles cover the topic.

**Coverage limitation:** verified textbook structure exists only for
Class 6 Mathematics (the one uploaded textbook). Other classes and
subjects resolve through the catalog as draft-sample until their
textbooks are transcribed. Playable content remains the Step 02
Class 6 Math sample mission — nothing broader is claimed.

## Lesson & Context integration (`lesson-context.ts`)

Each challenge resolves context from the existing Lesson & Context
Engine (`offlineLesson` — the same deterministic fallback the lesson
system uses; no duplicate engine, no AI). The response per challenge
includes the curriculum context, a concept explanation, learning
objective, prerequisites, mission context, and available hint
levels. If lesson resolution ever fails, a safe static context built
from the challenge's own learning objective is returned
(`contextSource: "static-fallback"`), and the game continues. The
Games UI shows the chapter · topic (and "NCTB textbook" when
verified) under the progress bar.

## Session performance model (`performance.ts`)

Session-only evidence: recorded attempts per challenge (correct,
attempts used, hints used, difficulty, objective), per-mechanic
totals, correct/incorrect streaks, repeated error-pattern counts,
and completed learning objectives. It stores no identity, infers no
trait, and is discarded when the server session ends. Nothing is
persisted — no learner analytics or profiling is introduced.

## Adaptive difficulty (`adaptive.ts`)

Deterministic rules with recorded reasons:

- No change before 3 recorded challenges (no single-answer reaction).
- Up one level after 3 clean first-try, hint-free correct answers.
- Down one level after 2 recorded incorrect in a row, or when hints
  and retries carried 2 of the last 3 challenges.
- Bounded 1–3 always.

In this step the level drives the recommendation engine and the
UI's "Practice level" label; mission order and completion criteria
are unchanged, so adaptation can never block completion.

## Misconception detection (`misconceptions.ts`)

Extensible rule registry (`MisconceptionRegistry`) with five Class 6
Math rules: sequence counts-by-one, equation adds-instead-of-
undoing, fraction bigger-numerator, shape all-angle-sums-180, and
drag-build balance slips. A rule names an error **pattern**, never a
student label. The tracker surfaces a signal only when the same
pattern occurs at least twice in the session — a single wrong answer
can never trigger it (false-positive prevention, test-proven).
Signals carry supportive explanations ("It looks like… here's the
idea"), never ability claims.

## Recommendations (`recommendations.ts`)

Fixed, inspectable priority: repeated misconception pattern →
review the prerequisite concept; recorded incorrect → easier
challenge (when adaptation eased down) or prerequisite review or
retry; 3+ correct streak → continue; mission complete → continue.
Every recommendation returns its reason. The answer API returns
`adaptation`, `misconception`, and `recommendation` alongside the
Step 02 fields; the UI shows the recommendation and practice level
after each recorded answer.

## Drag & Build fix (Step 02 issue)

`buildKind: "equation"` challenges now validate mathematically:
any tile arrangement (using exactly the given tiles) that forms a
true equation is correct — `3 + 4 = 7`, `4 + 3 = 7`, and `7 = 3 + 4`
all pass; false statements (`3 + 7 = 4`), foreign tiles, and
substituted operators fail. Challenges whose order is the learning
objective set `orderMatters: true` (or `buildKind: "ordered"`) and
still require the exact arrangement, even over a true equation.
The demo mission's final challenge is an equation build.

## Verification

- `learning.test.ts`: curriculum mapping + traceability, draft vs
  verified, lesson resolution + fallback, performance tracking (and
  no identity fields), adaptive up/down/bounds/hint-aware rules,
  misconception signals with the single-error guard, recommendation
  priority, the commutative/ordered/invalid drag-build matrix, and
  server integration (context in missions, adaptation fields,
  commutative build completing the mission for score 65).
- Step 01/02 suites pass unchanged; full project suite, ESLint,
  TypeScript, and production build pass (see completion report).

## Step 04 readiness

The Meta-only `GameAiAdapter` contract (Step 01) can now be
implemented against rich, deterministic session context —
curriculum context, performance snapshot, misconception signals,
and recommendations — without changing validation or difficulty
logic, which must remain deterministic and AI-free.
