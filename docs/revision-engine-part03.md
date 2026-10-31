# Kupi Revision Engine — Part 03: Concept Mastery Algorithm & Weak Detection

Status: implemented. Part 04 has not been started.

Scope note: no standalone 10-part plan or PRD exists in this repository.
Part 03's scope was confirmed with the project owner from Part 01's
deferred items ("Do not implement the complete mastery algorithm yet"):
the real mastery algorithm and weak-topic detection. Adaptive spaced
repetition was explicitly left for a later part.

## What changed

`placeholderMasteryScore` (plain accuracy, Part 01) is gone.
`computeMasteryScore(attempts, now)` in `src/lib/revision/mastery.ts`
now computes mastery from a concept's attempt history:

```
weight(attempt) = difficultyWeight x 0.5 ^ (ageDays / 14)
score = (weighted correct + 0.5 x 2) / (weighted total + 2)
```

- Only the newest 20 attempts per concept count.
- Difficulty weights: 1 -> 0.8, 2 -> 1.0, 3 -> 1.25 (null -> 1.0).
- Recency half-life 14 days: old mistakes fade, so a student can always
  recover by re-learning; old successes fade too, so mastery must be
  maintained.
- Evidence prior (0.5 with weight 2): one correct answer scores 0.667,
  one wrong answer 0.333. Nobody is "mastered" or "weak" from a single
  answer.
- All knobs live in `REVISION_CONFIG.mastery` (config.ts).

Status rules (`deriveMasteryStatus`):

| Status | Rule |
|---|---|
| `not_started` | no attempts |
| `weak` | >= 2 incorrect in a row, OR score < 0.5 with >= 2 attempts |
| `mastered` | score >= 0.8 AND >= 4 attempts AND >= 3 correct in a row |
| `practicing` | score >= 0.5 |
| `learning` | otherwise |

Weak concepts now carry explainable reasons ("Last 3 answers in a row
were incorrect.", "Mastery is 25% after 4 attempts...") from
`weaknessReasons()`. They are returned by `GET /api/revision/weak-concepts`
and in the overview (additive `reasons` field - Part 01 contracts are
otherwise unchanged), and shown in the dashboard's Weak Concepts section.

## Guardrails

- Observable answers only: correctness, difficulty, recency, streaks.
  No fixed-ability inference (same rule as `lib/learner/adapt.ts`).
- Response time is recorded on attempts but deliberately **not** scored:
  speed is not understanding, and slower readers must not be penalised.
- Deterministic: same history + same instant = same score; no AI model
  is involved (Meta-only policy untouched; no AI is called at all).
- Server-computed only, as before: clients still cannot submit scores.

## Integration

- `RevisionService.recordAttempt` loads the concept's recent attempt
  history, computes the post-attempt score once, and uses it for the
  stored mastery record **and** scheduling priority - one consistent
  value, still written atomically (Part 02 bundle).
- Scheduling itself is unchanged (fixed 1/3/7/14/30-day ladder).
  Adaptive intervals remain a later part and now have a real mastery
  signal to adapt from.
- Works identically on both repositories (in-memory default and gated
  Neo4j): the algorithm reads through the `RevisionRepository`
  interface, so the Part 02 privacy gate and persistence behaviour are
  untouched. Stored records keep the Part 01 shape; pre-Part-03 scores
  are simply recomputed from history on the next attempt (no migration).

## Verification

New `mastery.test.ts` covers: prior behaviour at 1 attempt, mastered
evidence requirements, difficulty weighting, recency recovery, recent
window, determinism/order-independence, weak reasons, and the pure
counter transition. Part 01 service/API expectations that encoded the
placeholder (first-correct = 1.0/mastered) were updated to the new
algorithm's exact values (0.667/practicing, 0.333/learning).

## Known limitations

- Score is history-based per concept; cross-concept transfer (e.g.
  algebra supporting equations) is not modelled.
- Recency uses attempt timestamps only; long school breaks decay all
  concepts uniformly.
- The fixed scheduling ladder does not yet consume mastery beyond
  priority - that is the adaptive-scheduling part, still to come.
