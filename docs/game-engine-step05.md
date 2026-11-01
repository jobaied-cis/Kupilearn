# Kupi Game Engine — Step 05: Game UI, Rewards & Progress

Status: implemented. Step 06 has not been started. All Step 01–04
contracts are preserved; Step 05 API additions are additive.

## Game Zone

Puzzle Quest is the featured experience at the top of the existing
Games dashboard section (`/dashboard/games`, unchanged navigation).
The landing now works as a Game Zone: progress summary (XP,
missions done, correct answers, badges, puzzle types explored),
mission cards showing class/subject, sample-content label, and an
honest status chip — **Completed** only when trusted server progress
contains the mission, **Available** otherwise. No locked state is
displayed because no locking is enforced, and no statistics,
player counts, or achievements are fabricated.

## Reward Engine (`rewards.ts`)

Server-side, transparent, fixed rules:

- +10 XP per correctly answered challenge (understanding, never speed)
- +25 XP for completing a mission
- +15 XP when the final independent challenge is correct with no
  hints used on it
- Incorrect answers never subtract XP

XP is computed in `computeXp` from trusted server evidence only;
client-supplied XP/correctness fields are never read (Step 02 test
already proves claimed scores are ignored). `RewardLedger` awards
exactly once per session id, so repeat submissions or result
re-reads can never double-award.

Badges (deterministic, testable): First Mission (complete a
mission), Puzzle Solver (finish every challenge in a mission),
Independent Thinker (final challenge correct without hints on it),
Concept Explorer (correct answers across ≥4 mechanic types).

Safety: no leaderboard, no rankings, no streaks, no timers, no
loot/random rewards, no ads, nothing that rewards time spent.

## Progress Engine (`progress.ts`)

Aggregates trusted session results per anonymous learner reference:
completed missions, challenges answered/correct, learning
objectives covered, mechanics explored, XP, badges.

**Persistence decision:** the audit found no Firebase/Firestore in
this repo (none exists) and persistent learner records remain
behind the project's legal-review gate (Revision Engine Part 02).
So progress is **session-only in-memory server state**, every API
response carries `persistence: "session-only"`, and the UI labels
it in both languages ("kept for this session only — not a
permanent record yet"). `GameProgressStore` is the adapter boundary
a future approved store implements. Nothing is silently persisted,
and an unknown learner always gets an honest empty progress.

## Results experience

On completion the results screen now shows, in addition to Step 02:
objectives practised, XP earned with its full breakdown (challenge
XP + completion XP + independent-final XP), newly earned badges by
name, total XP so far with the session-only label, supportive
feedback, and a deterministic next-step recommendation
(`recommendNextMission`: next incomplete mission, else replay).
No answer keys are ever included (asserted in tests).

## AI integration

Unchanged Step 04 surfaces (teacher hints/explanations, classmate
discussion, director guidance) remain inside gameplay, with the
same offline fallback labelling. AI never touches validation,
scoring, XP, badges, or progress — rewards derive only from the
deterministic attempt pipeline.

## Accessibility & performance

Existing Kupi cards/buttons/typography; radio-group persona and
answer controls, progressbar semantics, status/alert regions from
earlier steps are preserved. New chips/summaries are plain text and
lists. No new dependencies, animations, polling, or duplicate
submissions (answer buttons remain busy-guarded; rewards are
idempotent server-side). Progress fetch failures never block the
game. Reduced-motion: no new motion was introduced beyond the
existing progress-bar transition.

## Verification

- `progress.test.ts`: XP math (including hinted-final and
  wrong-final edges), ledger duplicate prevention, badge criteria,
  progress aggregation and duplicate-session no-ops, per-learner
  isolation with no fabricated progress, next-mission logic, and a
  full server playthrough awarding exactly 100 XP
  (6×10 + 25 + 15) with all four badges, labelled session-only.
- HTTP smoke on a production server: empty progress (0 XP,
  session-only, next mission recommended) → full playthrough →
  100 XP, 4 badges, 6 mechanics, 6 objectives; games page 200.
- Step 01–04 suites, full project suite, ESLint, TypeScript, and
  production build all pass (see completion report).

## Limitations

- Progress dies with the server process (session-only by policy,
  not by accident); the anonymous learner reference lives in the
  browser's localStorage like other Kupi device ids.
- One mission exists, so "next mission" currently resolves to a
  replay recommendation after completion.
- Browser click-through remains unverified in this environment
  (no browser available); verified through the real HTTP API.

## Step 06 readiness

Final security/integration can build on: idempotent server rewards,
the `GameProgressStore` boundary for an approved persistent store,
and the existing privacy gates — with live Meta verification and a
real-browser pass as the known manual items.
