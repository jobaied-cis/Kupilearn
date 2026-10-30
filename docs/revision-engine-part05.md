# Kupi Revision Engine — Part 05: Daily Workload Balancing

Status: implemented. Part 06 has not been started.

## What changed

Per-concept schedules (Part 04) can pile many concepts onto one day.
Part 05 derives a balanced **daily plan** at read time: at most 8
concepts per school day (configurable), weak concepts protected,
mastered concepts yielding, and overdue work folded into today —
without ever dropping a due concept and without writing anything.

## Rules (`src/lib/revision/planning.ts`, config `REVISION_CONFIG.planning`)

- School day = Asia/Dhaka calendar date. Dhaka is UTC+6 year-round with
  no DST, so day boundaries are exact fixed-offset math on the stored
  UTC ISO timestamps (no locale/ICU dependence). `now` is injected, so
  every rule is deterministic and unit-testable.
- Fair allocation order: most overdue first → higher priority → weaker
  before mastered → earliest due → concept id (stable tiebreak).
- Each day fills to `dailyConceptLimit` (default 8). Overflow moves to
  the next day in the same order. Items are never allocated before
  their due date.
- Anything due that does not fit the 3-day window (configurable) is
  returned as `carriedForward` — visible, counted, and allocated by
  tomorrow's plan. `allocated + carriedForward = totalDue` always;
  the test suite asserts nothing is ever lost.
- Completed/cancelled schedules are excluded, as in Part 04.

## Roll-forward: virtual, by design

There is no background scheduler anywhere in this app, and Part 05 does
not invent one. Overdue roll-forward is a **read-time derivation**:
overdue items are allocated into today by the plan, while their stored
`scheduledAt` changes only when the student actually attempts the
concept (Part 04's rule). Reading the plan creates, updates, and
deletes **nothing** — the service test snapshots the repository before
and after repeated plan reads and asserts byte-identical state.

## API and UI

- New: `GET /api/revision/daily-plan?days=3` (days clamped 1..7,
  validated; same student-header ownership: 401/403 as Part 01).
  Response: `{ studentId, plan: { startDate, days[], carriedForward,
  futureCount, totalDue } }`, items enriched with concept data.
- All Part 01–04 contracts are unchanged, including `GET overview`
  (the dashboard fetches the daily plan separately and degrades to the
  previous empty state if that call ever fails).
- Dashboard Daily Revision now shows today's balanced list with
  overdue badges and an honest overflow line ("N more planned for the
  next days — nothing is dropped", en/bn). No layout redesign.

## Persistence and privacy

Zero persistence change: no entity, repository, Cypher, or atomic-bundle
modification. The plan reads through the existing repository interface,
so the Part 02 legal-review gate behaves exactly as before, and reading
a plan against the gated Neo4j store adds no new data surface.

## Verification

- `planning.test.ts`: Dhaka boundary instants (17:59:59Z vs 18:00:00Z),
  month-boundary day math, cap + overflow accounting, carried-forward
  accounting at 30 due items, weak-over-mastered scarcity, most-overdue
  wins, never-early allocation, due-inside-window placement, terminal
  schedule exclusion, determinism.
- Service tests: plan derivation from real attempts, repeated reads are
  byte-identical, student isolation.
- API tests: ownership (401/403), `days` validation, window shape,
  isolation.
- Part 01–04 suites pass unmodified apart from these additions.

## Known limitations

- The roll-forward is virtual: stored due dates do not move until an
  attempt happens. There is still no cron/background job (none exists
  in the app to reuse).
- The daily cap is a single global config value, not per-student; there
  is no student settings system yet to hang it on.
- Allocation is per calendar day, not timed within a day, and does not
  yet consider session length or subject variety within a day.
