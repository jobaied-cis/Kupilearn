# Kupi Revision Engine — Part 04: Adaptive Revision Scheduling

Status: implemented. Part 05 has not been started.

## What changed

The Part 01 fixed interval decision behind `nextReview()` is now
adaptive, driven by the Part 03 mastery state. The stored schedule
entity, API contracts, session entities, repository interfaces, and the
Part 02 atomic write bundle are all unchanged - only the interval and
ordering decisions changed. Config lives in `REVISION_CONFIG.scheduling`.

## Rules (all deterministic, in `src/lib/revision/scheduling.ts`)

Base scale is unchanged: the 1/3/7/14/30-day ladder indexed by the
consecutive-correct streak. On top of it:

| Situation (post-attempt) | Interval |
|---|---|
| Failed attempt | Reset to minimum (1 day), priority high |
| Weak concept (Part 03 status) | Capped at 2 days, priority high |
| Learning / practicing | Ladder value for the streak |
| Mastered concept | At least 14 days, and ladder x 1.5 (14 -> 21, 30 -> 45) |
| Any result | Clamped to [1, 45] days |

Worked examples:

- 1st correct answer: streak 1, practicing -> 1 day, medium priority.
- 4 correct in a row: mastered (score 0.833) -> 21 days, low priority.
- A failure right after that: -> 1 day, high priority. Mastery history
  is kept; only the schedule resets.
- A concept that is weak despite a short correct streak: -> at most
  2 days, high priority.

Early-review rule preserved from Part 01: an attempt before the due
date reschedules from the attempt time, not the old due date.

## Upcoming ordering

`GET /api/revision/upcoming` (and the overview) now order by urgency:
already-due first, then priority (high -> medium -> low), then earliest
due date. Response shape is unchanged; the dashboard additionally
labels due items and shows the interval in days.

## Integration and safety

- `RevisionService` computes the post-attempt Part 03 status once and
  passes it to `nextReview`, so the stored mastery record, its status,
  and its schedule can never disagree.
- No schema or Cypher change: `reviewIntervalDays` already existed on
  the schedule; new values flow through the same MERGE writes.
- Privacy gate untouched: adaptive logic is pure computation over the
  repository interface, identical for the session-only in-memory store
  and the gated Neo4j store. No AI is called; Meta-only policy intact.
- Real-Neo4j behaviour remains as verified in Part 02 (mock-verified);
  Part 04 adds no database surface to re-verify.

## Verification

New `scheduling.test.ts`: ladder growth, failure reset from any status,
weak cap, mastered extension, min/max clamps, early-review rule,
priority coherence, urgency ordering, determinism. New service tests:
mastered progression reaches a 21-day low-priority schedule and a
subsequent failure resets it to 1 day/high; a weak concept stays at
1 day and surfaces first in upcoming. Existing fixed-ladder
expectations that remained valid were kept; none needed changes beyond
the new Part 04 assertions.

## Known limitations

- Intervals adapt per concept only; daily workload is not yet balanced
  across concepts (many concepts can land on the same day). A daily
  session planner is a later part.
- The ladder is still streak-indexed at its core; difficulty and
  response-time do not move intervals (mastery score already carries
  difficulty; response time is deliberately unused, as in Part 03).
- Overdue concepts keep their original due date until the next attempt;
  there is no automatic daily roll-forward job.
