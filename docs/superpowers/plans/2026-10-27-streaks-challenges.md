# Streaks, Challenges and a Standard History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Repwise 4.3: a daily streak with freezes, leave and badges; challenges (75-Day, habit stack, custom) with progress photos; a fasting timer; a History screen built on one standard goal list; server nudges for fasts and streaks.

**Architecture:** Everything is derived from logged data. A goal registry (`goals.ts`) answers "what got done on date X". Streak, badges, History and Today all read it. The only new saved state is leave ranges, challenge runs and ticks, fasts, photo records, seen badges and a streak hint for the server. Pure domain modules with vitest tests sit under `src/domain`. React screens read them through the existing Zustand store.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind 4, Zustand (`useApp`, `act`), TanStack React Query, `motion/react`, dayjs, vaul sheets, Supabase (Postgres, Storage, Deno edge function `water-nudge`), vitest, puppeteer e2e.

**Spec:** `docs/superpowers/specs/2026-10-27-streaks-challenges-design.md`

## Global Constraints

- Dates are local `YYYY-MM-DD` strings made with dayjs (`dayjs(x).format('YYYY-MM-DD')`). Instants are ISO strings. Never use hand-rolled `Date` arithmetic.
- Every domain transition is a pure `(data: AppData, ...) => AppData` that returns the same object when nothing changes (the store relies on this).
- Never use the name "75 Hard". The template is called "75-Day Challenge".
- Motion uses `motion/react`, honours `useReducedMotion()`, and only marks a real change.
- Every `localStorage` access is wrapped in try/catch.
- Server data (signed photo URLs) goes through React Query only, never Zustand.
- Fasting copy is general guidance: phase labels exactly `Digesting`, `Blood sugar settling`, `Fat burning`, `Ketosis`, `Autophagy ramping up`.
- Goal colours: workout `#FF2D55`, water `#007AFF`, supplements `#AF52DE`, challenge `#FF9500`, fast `#34C759`.
- Bump `package.json` version to `4.3.0`. `schemaVersion` stays `4`. New fields are additive.
- Comments match the codebase: sparse, one-line JSDoc on exported functions where the name doesn't say it.

## Review Focus

1. **Midnight and time zones:** a session started at 23:30 local belongs to that local date, and the app left open past midnight treats the new day as pending. Test in Task 3.
2. **Editing or deleting old data:** deleting the only workout of a past day recomputes the streak, possibly spending a freeze, with no stale counter. Test in Task 4.
3. **Challenge starting tomorrow:** it shows as upcoming, adds no goal today, and never fails for days before it starts. Test in Task 2.
4. **Bad leave input:** an end before the start, a start more than 30 days back, or a range overlapping an existing one is rejected or merged, never stored as nonsense. Test in Task 4.
5. **Fast left running for days:** elapsed past 36 h keeps the last phase, the server sends no milestone beyond 36 h, and the goal counts only on the end date. Tests in Task 1 and Task 12.

---

## File Map

Create:
- `src/domain/fasting.ts`: phases, milestones, start and end fast.
- `src/domain/challengeTemplates.ts`: drafts for the 75-Day Challenge and habit stack.
- `src/domain/challenges.ts`: run lifecycle, tick window, task and day completion, settle.
- `src/domain/photos.ts`: add and remove photo records.
- `src/domain/goals.ts`: goal registry.
- `src/domain/leave.ts`: leave ranges.
- `src/domain/streak.ts`: replay, memo, streak hint.
- `src/domain/badges.ts`: badge definitions, earned dates, unseen and back-fill.
- Tests next to each: `src/domain/<name>.test.ts`.
- `src/lib/photos.ts`: resize, upload, delete, and `usePhotoUrl` (React Query).
- `src/components/Flame.tsx`, `src/components/StreakChip.tsx`, `src/components/IgniteOverlay.tsx`, `src/components/BadgeCard.tsx`
- `src/screens/history/StreakHeader.tsx`, `src/screens/history/DayCard.tsx`, `src/screens/history/FilterChips.tsx`
- `src/screens/BadgesSheet.tsx`, `src/screens/LeaveSheet.tsx`, `src/screens/FastSheet.tsx`
- `src/screens/challenges/ChallengesSheet.tsx`, `src/screens/challenges/NewChallengeSheet.tsx`, `src/screens/challenges/RunDetailSheet.tsx`, `src/screens/challenges/PhotoTimeline.tsx`
- `src/screens/today/ChallengeCard.tsx`, `src/screens/today/FastCard.tsx`, `src/screens/today/LeaveCard.tsx`
- `supabase/migrations/20261027000000_progress_photos.sql`
- `supabase/functions/water-nudge/decideFast.ts`, `supabase/functions/water-nudge/decideStreak.ts`, `supabase/functions/water-nudge/leave.ts`, plus tests.

Modify:
- `src/domain/types.ts`, `src/domain/catalogue.ts` (`emptyAppData`), `src/domain/migrate.ts` (`normalize`), `src/domain/calendar.ts` (remove `dayMarks`)
- `src/store/app.ts`: pipeline adds settle, streak hint, badge back-fill.
- `src/App.tsx`: register sheets, mount `IgniteOverlay`.
- `src/screens/History.tsx`, `src/screens/history/Calendar.tsx`, `src/screens/Today.tsx`, `src/screens/Profile.tsx`, `src/screens/profile/summaries.ts`, `src/screens/profile/RemindersSheet.tsx`
- `supabase/functions/water-nudge/run.ts`, `supabase/functions/water-nudge/index.ts`
- `e2e/acceptance.mjs`, `package.json`

---

### Task 1: Data model, defaults, and the fasting module

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/catalogue.ts:91-120`, `src/domain/migrate.ts:134-145`
- Create: `src/domain/fasting.ts`
- Test: `src/domain/migrate.test.ts`, `src/domain/fasting.test.ts`

**Interfaces:**
- Produces, in `types.ts`, exactly the spec §1 types `ChallengeTask`, `ChallengeRun`, `Fast` and `ProgressPhoto`, with these additions to `ChallengeRun`: `endedOn?: string` (local date set on done, fail or quit), `failedDay?: number` (day number that failed), `failAck?: boolean` (restart prompt answered).
- `AppData` gains `leave: { start: string; end: string | null }[]`, `challenges: ChallengeRun[]`, `fasts: Fast[]`, `photos: ProgressPhoto[]`, `seenBadges?: string[]` (optional: missing means back-fill, see Task 13), `streakHint: { date: string; current: number; lit: boolean } | null`.
- `Profile` gains `fastingSafetyAck?: boolean` and `streakReminder?: boolean`.
- `fasting.ts`:
  - `FAST_TARGETS = [16, 24, 36] as const`
  - `FAST_PHASES: { fromH: number; label: string }[]`, with the five labels from Global Constraints at 0, 4, 12, 18, 24.
  - `FAST_MILESTONES_H = [12, 24, 36]`
  - `activeFast(data): Fast | null`
  - `elapsedHours(fast, now: string): number`
  - `fastPhase(hours): string`
  - `fastReached(fast): boolean` (ended and elapsed ≥ target)
  - `needsSafetyAck(data, target): boolean` (target ≥ 24 and not acked)
  - `startFast(data, target, now, id = crypto.randomUUID()): AppData` (no-op while one is active)
  - `endFast(data, now): AppData`
  - `fastsEndedOn(data, date): Fast[]` (by local date of `endedAt`)

- [ ] **Step 1: Write failing tests**

`migrate.test.ts`:
```ts
it('a v4 doc without the 4.3 fields loads with empty defaults and no seenBadges', () => {
  const doc = { ...emptyAppData(NOW) } as Record<string, unknown>;
  for (const k of ['leave', 'challenges', 'fasts', 'photos', 'seenBadges', 'streakHint']) delete doc[k];
  const d = normalize(doc, NOW)!;
  expect([d.leave, d.challenges, d.fasts, d.photos, d.streakHint]).toEqual([[], [], [], [], null]);
  expect(d.seenBadges).toBeUndefined();
});
it('new users start with seenBadges = []', () => expect(emptyAppData(NOW).seenBadges).toEqual([]));
```

`fasting.test.ts`:
- `fastPhase` at 0, 3.9, 4, 11.9, 12, 18, 24 and 80 gives Digesting, Digesting, Blood sugar settling, Blood sugar settling, Fat burning, Ketosis, Autophagy ramping up, Autophagy ramping up.
- `startFast` while one is active returns the same object.
- `endFast` after 15 h of a 16 h fast leaves `fastReached === false`. After 16 h, `true`.
- `fastsEndedOn` uses the local date of `endedAt`. A fast started 2026-10-20 20:00 and ended 2026-10-21 12:00 local belongs to `2026-10-21`.
- `needsSafetyAck`: true for 24 and 36 when not acked, false for 16, false once `profile.fastingSafetyAck` is true.

- [ ] **Step 2: Run, expect failures**

Run: `npx vitest run src/domain/migrate.test.ts src/domain/fasting.test.ts`
Expected: FAIL (missing fields, missing module).

- [ ] **Step 3: Implement**

- `emptyAppData`: `leave: []`, `challenges: []`, `fasts: []`, `photos: []`, `seenBadges: []`, `streakHint: null`.
- `normalize` (v4 branch): after spreading `base` and `doc`, set `seenBadges: doc.seenBadges` so a missing value stays `undefined`, and default the other five from `base` when the doc lacks them.
- Write `fasting.ts` per the interfaces.

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run && npx tsc -b --noEmit`
Expected: all pass, no type errors. Fix any test fixtures that build `AppData` by hand.

- [ ] **Step 5: Commit**

`git commit -m "feat(4.3): data model for leave, challenges, fasts, photos; fasting module"`

---

### Task 2: Challenge templates and lifecycle

**Files:**
- Create: `src/domain/challengeTemplates.ts`, `src/domain/challenges.ts`, `src/domain/photos.ts`
- Test: `src/domain/challenges.test.ts`

**Interfaces:**
- Consumes: Task 1 types, plus `data.sessions`, `data.extras`, `data.water` and `data.profile.waterGoal`.
- `challengeTemplates.ts`:
  - `type ChallengeDraft = Pick<ChallengeRun, 'templateId' | 'title' | 'days' | 'rule' | 'tasks' | 'anchor'>`
  - `seventyFiveDraft(): ChallengeDraft`: title `75-Day Challenge`, 75 days, strict. Tasks in this order, with these ids:
    - `workout` "Workout 45 min", `auto: 'workout'`
    - `outdoor` "Outdoor workout 45 min", `auto: 'workout-outdoor'`
    - `water` "Drink 3.7 L", `auto: 'water'`, `target: 15`
    - `diet` "Follow your diet"
    - `alcohol` "No alcohol"
    - `read` "Read 10 pages"
    - `photo` "Progress photo", kind `photo`
  - `habitStackDraft(anchor: string, habits: string[], days: 21 | 30 | 66): ChallengeDraft`: title `Habit stack`, lenient, one tick task per habit with ids `h1`, `h2`, `h3`, and `anchor` set.
  - `HABIT_STACK_DAYS = [21, 30, 66] as const`
- `challenges.ts`:
  - `MAX_ACTIVE = 3`
  - `canStart(data): boolean`
  - `startChallenge(data, draft, startDate, id = crypto.randomUUID()): AppData`: no-op when 3 runs are active.
  - `dayNumber(run, date): number` (1-based)
  - `runCoversDate(run, date): boolean`: date is between `startDate` and the last day, and not after `endedOn` when that is set.
  - `taskDone(data, run, task, date): boolean`:
    - ticked, or
    - auto `workout`: a finished session started that date or any extra that date
    - auto `workout-outdoor`: an extra of type `run` that date
    - auto `water`: glasses ≥ `task.target ?? profile.waterGoal`
    - kind `photo`: also done when a photo exists with that `challengeId` and date
  - `dayComplete(data, run, date): boolean`
  - `canTick(date, today): boolean` (today or yesterday)
  - `toggleTask(data, runId, taskId, date, today): AppData`: no-op outside the window and for auto tasks.
  - `settleChallenges(data, today): AppData`: for each active run, walk locked dates (before yesterday) inside the run.
    - Strict with an incomplete day: `status: 'failed'`, `failedDay`, `endedOn`.
    - Last day locked: `status: 'done'` (strict needs every day complete), `endedOn`.
  - `restartChallenge(data, runId, today): AppData`: `startDate: today`, `restarts + 1`, `status: 'active'`, clears `failedDay`, `failAck` and `endedOn`, keeps `ticks`.
  - `ackChallengeFail(data, runId): AppData`
  - `quitChallenge(data, runId, today): AppData`
  - `challengeScore(data, run, today): { complete: number; elapsed: number; days: number }`
  - `activeRuns(data): ChallengeRun[]`
- `photos.ts`:
  - `addPhoto(data, photo: ProgressPhoto): AppData`
  - `removePhoto(data, id): AppData`
  - `photoFor(data, runId, date): ProgressPhoto | undefined`

- [ ] **Step 1: Write failing tests** in `challenges.test.ts`. Use a fixed `TODAY = '2026-10-27'` and hand-built `AppData` via `emptyAppData`.
  - `seventyFiveDraft` has 7 tasks, `water.target === 15`, strict, 75 days, and the title does not contain "Hard".
  - A fourth `startChallenge` returns the same object, and `canStart` is false.
  - `toggleTask` on 2026-10-25 (locked) returns the same object. On today and yesterday it toggles. On an auto task it returns the same object.
  - Auto `workout` is done from a finished session that day, and also from an extra. `workout-outdoor` only from an extra of type `run`. `water` at 15 glasses even when `waterGoal` is 8.
  - Photo task done when `photoFor` returns a photo.
  - Strict run started 2026-10-20 with 2026-10-24 incomplete: `settleChallenges` gives `failed`, `failedDay: 5`, `endedOn: '2026-10-27'`.
  - `restartChallenge` sets `startDate` to today and `restarts: 1`, and keeps the old ticks.
  - Lenient 30-day run with 3 incomplete locked days stays `active`. `challengeScore` gives `complete = elapsed - 3`.
  - Run whose last day is locked and all complete becomes `done`.
  - **Review Focus 3:** a run with `startDate` tomorrow: `runCoversDate(run, TODAY)` is false, and `settleChallenges` leaves it `active` with no `failedDay`.

- [ ] **Step 2: Run, expect failure:** `npx vitest run src/domain/challenges.test.ts` fails with missing modules.
- [ ] **Step 3: Implement** the three modules per the interfaces.
- [ ] **Step 4: Run:** `npx vitest run && npx tsc -b --noEmit`. Expect pass.
- [ ] **Step 5: Commit:** `git commit -m "feat(4.3): challenge templates, lifecycle and photo records"`

---

### Task 3: Goal registry

**Files:**
- Create: `src/domain/goals.ts`
- Modify: `src/domain/calendar.ts` (delete `dayMarks`; keep `monthCells`, `nextGoal`, `addGoal`)
- Test: `src/domain/goals.test.ts`

**Interfaces:**
- Consumes: `activeSupplements` (supplements.ts), `runCoversDate` and `dayComplete` (Task 2), `fastsEndedOn` and `fastReached` (Task 1).
- Produces:
  ```ts
  export type GoalKind = 'workout' | 'water' | 'supplements' | 'challenge' | 'fast';
  export const GOAL_COLOR: Record<GoalKind, string>;   // values from Global Constraints
  export const GOAL_LABEL: Record<GoalKind, string>;   // Workout, Water, Supplements, Challenges, Fasts
  export interface GoalStatus { done: boolean; progress?: [number, number]; detail?: string }
  export interface Goal { id: string; kind: GoalKind; label: string; color: string; status: GoalStatus; runId?: string }
  /** Precomputes per-date indexes once; call the result per date. */
  export function goalIndex(data: AppData): (date: string) => Goal[];
  export function goalsFor(data: AppData, date: string): Goal[];
  /** Earliest date with any goal done, or null. */
  export function firstGoalDate(data: AppData): string | null;
  ```
- Goal ids: `workout`, `water`, `supplements`, `challenge:${run.id}`, `fast`. Order: workout, water, supplements, challenges in run order, fast.
- `detail` examples: workout `"Push A · 52 min"` (first session) or `"Run · 30 min"`; water progress `[glasses, goal]`.

- [ ] **Step 1: Write failing tests**
  - Workout done from a finished session; not from an unfinished one; done from an extra alone.
  - Water progress `[6, 8]` and not done; `[8, 8]` done.
  - Supplements goal absent with no active supplements; present and done only when all are ticked.
  - Challenge goal present only on dates the run covers; done when `dayComplete`.
  - Fast goal present only on the end date; done only if `fastReached`.
  - `firstGoalDate` returns the earliest date among done goals.
  - **Review Focus 1:** a session with `startedAt: '2026-10-20T23:30:00'` (local, no Z) and finished after midnight counts for `2026-10-20` and not `2026-10-21`.
- [ ] **Step 2:** `npx vitest run src/domain/goals.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.** `goalIndex` builds maps once (sessions by local start date, extras by date, fasts by end date), then returns a closure. Remove `dayMarks` and its test. `Calendar.tsx` stops compiling until Task 6; replace its `dayMarks` call with `goalsFor` in this task so the build stays green (dots from `goalsFor(...).filter(g => g.status.done)` with `g.color`; legend from `GOAL_LABEL`).
- [ ] **Step 4:** `npx vitest run && npx tsc -b --noEmit`. Expect pass.
- [ ] **Step 5:** `git commit -m "feat(4.3): goal registry replaces dayMarks"`

---

### Task 4: Leave, streak replay, store pipeline

**Files:**
- Create: `src/domain/leave.ts`, `src/domain/streak.ts`
- Modify: `src/store/app.ts`
- Test: `src/domain/leave.test.ts`, `src/domain/streak.test.ts`

**Interfaces:**
- `leave.ts`:
  - `MAX_BACKDATE_DAYS = 30`
  - `onLeave(data, date): boolean`
  - `currentLeave(data, today): { start: string; end: string | null } | null`
  - `startLeave(data, start, end: string | null, today): AppData | { error: string }`. Errors, in exact words:
    - `"Leave can start at most 30 days ago."`
    - `"End date is before the start."`
    - Overlapping or touching ranges merge into one.
  - `endLeave(data, today): AppData`: sets the current range's `end` to yesterday. If it started today, removes it.
- `streak.ts`:
  ```ts
  export type DayState = 'lit' | 'frozen' | 'leave' | 'missed';
  export interface StreakResult {
    current: number; best: number; freezes: number; todayLit: boolean;
    days: Map<string, DayState>;
    counts: Map<string, number>;     // date -> current after that date (for badges)
    freezeUsedOn: string | null;
  }
  export const FREEZE_EVERY = 7, FREEZE_CAP = 2;
  export function streak(data: AppData, today: string): StreakResult;   // memoized per (data object, today)
  export function withStreakHint(data: AppData, today: string): AppData; // sets streakHint {date: today, current, lit: todayLit}
  ```
  Replay rules exactly as spec §2. Memoize with a `WeakMap<AppData, { today: string; result: StreakResult }>`.
- `store/app.ts`: in `act`, after `fn`, run `withStreakHint(ensurePlan(settleChallenges(next, today)), today)` with `today = dayjs().format('YYYY-MM-DD')`, keeping the `updatedAt` stamp. `merge` and `replace` run `ensurePlan(settleChallenges(d, today))`; no hint, because hint writes ride on real changes.

- [ ] **Step 1: Write failing tests**

`streak.test.ts` (helper: `lit(dates)` sets `water[date] = goal`):
- 5 consecutive lit days ending yesterday, today unlit: `current 5`, `todayLit false`, `freezes 0`.
- 7 lit days: `freezes 1`. 21 lit days: `freezes 2` (cap).
- 7 lit, 1 miss, 2 lit: `current 9`, that day `frozen`, `freezes 0`, `freezeUsedOn` is that date.
- 3 lit, 1 miss (no freeze), 2 lit: `current 2`, `best 3`, that day `missed`.
- Leave on the gap day: `current 5` across it, day state `leave`, no freeze spent.
- Today lit: `current` includes today, `todayLit true`.
- No data: `current 0`, `best 0`.
- `withStreakHint` writes `{ date: today, current, lit }`.
- **Review Focus 2:** after `deleteHistorySession` of the only workout on a mid-streak day, `streak(newData, today)` shows that day `frozen` or `missed` (new object, so no stale memo).

`leave.test.ts`:
- Backdating 31 days gives the 30-day error. 30 days is OK.
- An end before the start gives the error.
- A new range overlapping an existing one merges.
- `endLeave` started earlier sets `end` to yesterday. `endLeave` started today removes the range.
- `onLeave` with an open-ended range is true for any later date.

- [ ] **Step 2:** `npx vitest run src/domain/streak.test.ts src/domain/leave.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement** both modules and the store pipeline.
- [ ] **Step 4:** `npx vitest run && npx tsc -b --noEmit`. Expect pass.
- [ ] **Step 5:** `git commit -m "feat(4.3): streak replay with freezes and leave; store writes streak hint"`

---

### Task 5: Flame, streak chip, ignite overlay

**Files:**
- Create: `src/components/Flame.tsx`, `src/components/StreakChip.tsx`, `src/components/IgniteOverlay.tsx`
- Modify: `src/App.tsx` (mount `<IgniteOverlay />` beside `<Sheets />`), `src/screens/Today.tsx` (pass `action={<StreakChip />}` to `Screen`)

**Interfaces:**
- `Flame({ lit, size = 24, flicker = false }: { lit: boolean; size?: number; flicker?: boolean })`: a three-path SVG (outer `#FF9500`, middle `#FF6B00`, core `#FFD60A`). Grey `#C7C7CC` at 50% opacity when not lit. The flicker loop only runs when `flicker` is set and motion isn't reduced.
- `StreakChip()`: reads `streak(useData(), today)`. Renders `<Flame lit={todayLit} size={18} />` and the count (`current`). Tapping it calls `go('history')`. `aria-label` is `"{n}-day streak"`.
- `IgniteOverlay()`: opens when `todayLit` becomes true and `localStorage.repwise_ignited !== today`.
  - Shows a big flame scaling 0.6→1 with a spring, 6–8 embers rising once, the count rolling from `current-1` to `current` with `AnimatePresence`, and the heading `"{n}-day streak!"`.
  - Calls `navigator.vibrate?.(30)`.
  - Closes on tap or after 2500 ms, then writes `repwise_ignited = today`.
  - Reduced motion: fade only.
  - Exposes `onClosed` ordering for Task 13 by firing a `window` event `repwise:ignite-closed` on close.
- Freeze toast: in `IgniteOverlay`'s effect, if `freezeUsedOn` is set and `localStorage.repwise_freeze_seen !== freezeUsedOn`, call `toast("Freeze used. Streak safe at {current}. {freezes} left.")` and store it.
- Today's date must refresh: derive `today` from the minute ticker already in `Today`. For `IgniteOverlay`, re-check on `visibilitychange` and every 60 s.

- [ ] **Step 1:** Build the components.
- [ ] **Step 2: Verify manually** with `npm run dev`:
  - Log water to the goal; the overlay plays once.
  - Reload; it doesn't play again.
  - In devtools, emulate reduced motion; it fades instead.
- [ ] **Step 3:** `npx tsc -b --noEmit && npx vitest run`. Expect pass.
- [ ] **Step 4:** `git commit -m "feat(4.3): flame chip and ignite moment"`

---

### Task 6: History redesign

**Files:**
- Create: `src/screens/history/StreakHeader.tsx`, `src/screens/history/FilterChips.tsx`, `src/screens/history/DayCard.tsx`
- Modify: `src/screens/History.tsx` (rewrite), `src/screens/history/Calendar.tsx`

**Interfaces:**
- Consumes: `streak`, `goalIndex`, `GOAL_COLOR`, `GOAL_LABEL`, `GoalKind`, `onLeave`, `currentLeave`.
- `Calendar` props become `{ data; selected: string; onSelect(date: string); filter: GoalKind | null }`.
  - Cell fill by `streak().days`: lit `bg-orange/20`, frozen `bg-blue/15` with a snowflake, leave `bg-fill`.
  - Today keeps the pink ring; selected keeps the dark fill.
  - Dots come from done goals.
  - With a `filter`, days without a done goal of that kind get `opacity-35`.
  - The legend lists the kinds present plus Goal date.
- `StreakHeader({ data })`: a `Flame` at size 56, the count, `Best {best}`, a lucide `Snowflake` per freeze, and an `On leave` chip. Tap calls `openSheet('badges')`. (The sheet itself is Task 13; until then register a stub so the route doesn't break.)
- `FilterChips({ kinds: GoalKind[]; value: GoalKind | null; onChange })`: `All` plus one chip per kind that has at least one done goal anywhere.
- `DayCard({ data, date })`: one row per goal from `goalIndex(data)(date)`. Collapsed rows show an icon, label, and either a check or progress. Tapping expands inline per spec §3 (workout sessions open `session:{id}`; extras delete with the existing confirm and toast; challenge tasks show tick state and a photo thumbnail via Task 11's `usePhotoUrl`, which is a grey tile until Task 11).
- `History.tsx`: `StreakHeader`, `Calendar`, `FilterChips`, `DayCard`. `selected` defaults to today. Delete `grouped`, `weekLabel`, `dayItems`, `DayRow`, `SessionRow`, `ExtraRow` (move what `DayCard` needs into it) and the exercise `Select`.
- Empty copy, exactly:
  - no data: `"Your first lit day starts the flame. Log a workout, hit your water, or take your stack."`
  - empty day: `"Nothing logged on {ddd D MMM}."`

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Update `e2e/acceptance.mjs` History checks:
  - replace `'History shows the calendar and a daily habits row'` with a check that the text includes `Best` and the day card shows `Water`
  - the `button::-p-text(Full Body A)` step now needs the day card's workout row expanded first: click `button::-p-text(Workout)`, then the session.
- [ ] **Step 3:** `npx tsc -b --noEmit && npx vitest run`, then run e2e (build, `npx vite preview --port 5199 --strictPort --host 127.0.0.1` in the background, `node e2e/acceptance.mjs`). Expect exit 0.
- [ ] **Step 4:** `git commit -m "feat(4.3): History on the goal registry with streak header, filter chips and day card"`

---

### Task 7: Leave sheet and Today leave card

**Files:**
- Create: `src/screens/LeaveSheet.tsx`, `src/screens/today/LeaveCard.tsx`
- Modify: `src/App.tsx` (sheet `leave`), `src/screens/Today.tsx`, `src/screens/Profile.tsx`, `src/screens/profile/summaries.ts`

**Interfaces:**
- `LeaveSheet({ open, onClose })`:
  - Start date: defaults to today, min today−30.
  - End: a date, or an "Until I turn it off" switch.
  - Start leave calls `startLeave` and shows the error inline.
  - If any active strict run exists, show above the button: `"Leave doesn't pause your {title}. Missed tasks still end it."`
- `LeaveCard()`: `"On leave until {D MMM}. Streak paused."` (open-ended: `"On leave. Streak paused."`) with an `End leave` button that calls `endLeave`. It renders first on Today when `currentLeave` is set.
- Today session menus (Up Next and Done today) gain `Start leave`, which calls `openSheet('leave')`.
- `ProfileRow` gains `'leave'` and `'challenges'`. Summaries:
  - leave: `On until 3 Nov` or `Off`
  - challenges: `{n} active` or `None`
  - `Profile` row mapping opens `leave` and `challenges` directly. Icons: lucide `Plane` and `Trophy`.
- Replace Profile's `"{n}-week streak"` line with the day streak: `<Flame lit size={16}/> {current}-day streak`, shown when `current > 0`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npx tsc -b --noEmit && npx vitest run`. Update `summaries.test.ts` for the two new rows. Expect pass.
- [ ] **Step 3:** `git commit -m "feat(4.3): leave mode"`

---

### Task 8: Challenges sheet, setup, run detail, Today cards

**Files:**
- Create: `src/screens/challenges/ChallengesSheet.tsx`, `src/screens/challenges/NewChallengeSheet.tsx`, `src/screens/challenges/RunDetailSheet.tsx`, `src/screens/today/ChallengeCard.tsx`
- Modify: `src/App.tsx` (sheets `challenges`, `challenge-new:{templateId}`, `challenge:{runId}`), `src/screens/Today.tsx`

**Interfaces:**
- Consumes: everything in Task 2.
- `ChallengesSheet`:
  - Catalogue rows: 75-Day Challenge, Habit stack, Build your own, Start a fast. Start a fast opens `fast`, wired in Task 9.
  - Below: active runs, then a "Past" section (done, failed, quit) showing score or day.
  - At 3 active, catalogue rows are disabled with the footnote `"Finish or quit one first."`
- `NewChallengeSheet({ templateId })`:
  - `75-day`: shows the task list, a start choice (Today / Tomorrow), and Start.
  - `habit-stack`: anchor text, 1–3 habit inputs, length `Segmented` 21/30/66.
  - `custom`: name, days 7–365, 1–10 tasks (label, kind tick/photo, link none/workout/water), and rule Strict/Lenient.
  - Start calls `startChallenge`, then `openSheet('challenge:{id}')`.
- `RunDetailSheet({ runId })`: header `Day {n} of {days}` or the final score, a day grid (done green, missed red/grey, today outlined, future empty), the photo timeline (Task 11 fills it), and Quit (confirm, destructive) calling `quitChallenge`.
- `ChallengeCard({ run })` on Today, below the workout card:
  - Title, `Day {n} of {days}`, a progress bar of `dayNumber/days`.
  - Task checkbox rows calling `toggleTask(data, run.id, task.id, today, today)`.
  - Auto tasks show `from your workout` or `from water` and are disabled.
  - Photo tasks show a camera button (wired in Task 11; until then they toggle as ticks).
  - After 20:00, a strict run with open tasks shows an orange chip `"{k} tasks left today"`.
  - A run starting tomorrow shows `Starts tomorrow` with no tasks.
- Failed-run prompt: on Today, for any run with `status: 'failed'` and no `failAck`, call `confirm({ title: 'Day {failedDay} missed', message: 'Restart {title} from day 1?', confirmLabel: 'Restart' })`. Yes calls `restartChallenge`, No calls `ackChallengeFail`. Run it once per mount with a ref guard.
- When no run is active, Today shows a row `"Add a challenge"` (icon `Trophy`) that opens `challenges`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** e2e additions: open `Add a challenge`, pick Habit stack, fill anchor `After coffee` and habit `Stretch`, Start. Back on Today the check is: text includes `Day 1 of 30`. Tick `Stretch`, then go to History; the day card shows `Habit stack`.
- [ ] **Step 3:** Typecheck, unit tests, e2e. Expect pass.
- [ ] **Step 4:** `git commit -m "feat(4.3): challenges sheet, setup, run detail and Today cards"`

---

### Task 9: Fasting UI

**Files:**
- Create: `src/screens/FastSheet.tsx`, `src/screens/today/FastCard.tsx`
- Modify: `src/App.tsx` (sheet `fast`), `src/screens/Today.tsx`

**Interfaces:**
- `FastSheet`:
  - Target `Segmented` 16/24/36, then Start fast.
  - If `needsSafetyAck`, show the safety block first (the three bullets from spec §6, verbatim) and a checkbox `"I understand"`. Start stays disabled until it's ticked, then `profile.fastingSafetyAck = true` is set together with `startFast`.
  - While a fast is active, the sheet shows its state and End fast.
- `FastCard()` while `activeFast`:
  - An SVG ring of `elapsed/target` (reuse the `Rings` style if it fits; otherwise a single stroke circle).
  - `"{h}h {m}m of {target}h"`, `fastPhase` label, and End fast calling `endFast`.
  - On end, toast `"Fast complete. {h}h."` if reached, else `"Fast ended at {h}h."`
- Today session menus gain `Start a fast`, which opens `fast`. While active it's replaced by a disabled item `"Fasting · {h}h"`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** e2e: start a 16 h fast from the menu; the card shows `of 16h` and `Digesting`. End it; the toast says `Fast ended`.
- [ ] **Step 3:** Typecheck, unit tests, e2e. Expect pass.
- [ ] **Step 4:** `git commit -m "feat(4.3): fasting timer"`

---

### Task 10: Server — fast milestones, streak at risk, leave, topics

**Files:**
- Create: `supabase/functions/water-nudge/decideFast.ts`, `supabase/functions/water-nudge/decideStreak.ts`, `supabase/functions/water-nudge/leave.ts`, plus `*.test.ts` for each
- Modify: `supabase/functions/water-nudge/run.ts`, `supabase/functions/water-nudge/index.ts`, `src/screens/profile/RemindersSheet.tsx`

**Interfaces:**
- Shared decision type in `decide.ts` (extend `NudgeDecision`): the send variant gains `topic: 'water' | 'fast' | 'streak'`. `decideNudge` returns `topic: 'water'`.
- `leave.ts`: `onLeaveDoc(doc: unknown, date: string): boolean`. Parity test against `src/domain/leave.ts` `onLeave` for 5 dates.
- `decideFast.ts`: `decideFast({ now: Date; doc: unknown }): NudgeDecision`.
  - Active fast = the last item in `doc.fasts` with no `endedAt`.
  - Milestones = unique sorted `[12, 24, 36, targetHours]`.
  - Send when `startedAt + m hours ∈ (now − 1h, now]`.
  - Copy:
    - target reached: title `"Fast complete"`, body `"{target} hours done. Your fast hit its target."`
    - otherwise: title `"{m} hours in"`, body `"{phase}."`
  - `url: '/#/today'`, `topic: 'fast'`.
  - Copy `FAST_MILESTONES_H` and `FAST_PHASES` locally, with a parity test against `src/domain/fasting.ts`.
- `decideStreak.ts`: `decideStreak({ now: Date; tz: string; doc: unknown }): NudgeDecision`.
  - Send only when local minutes are in 1200–1259, `profile.streakReminder !== false`, and `streakHint.current ≥ 3`, and either (`hint.date === today && !hint.lit`) or (`hint.date === yesterday && hint.lit`).
  - Title `"{n}-day streak"`, body `"Your {n}-day streak ends at midnight. One goal keeps it alive."`, `topic: 'streak'`.
- `run.ts`: per row, if `onLeaveDoc(doc, localDate)` skip. Otherwise take the first `send` among `decideFast`, `decideStreak`, `decideNudge`, in that order. Payload adds `topic`.
- `index.ts`: `send` uses `{ TTL: 1800, urgency: 'normal', topic: payloadTopic }`. Change the `NudgeDeps.send` signature to `send(sub, payload: string, topic: string)`.
- `RemindersSheet`: add `<Switch label="Streak reminder" checked={profile.streakReminder !== false} …/>` with the hint `"8 pm nudge when today isn't lit yet."` Toggling on needs push enabled, using the same flow as water.

- [ ] **Step 1: Write failing tests**
  - `decideFast`: started 11.5 h ago gives no send; 12.2 h ago gives send `12 hours in` / `Fat burning.`; a 16 h target at 16.1 h gives `Fast complete`.
  - **Review Focus 5:** a fast started 40 h ago with target 36 gives no send. An ended fast gives no send.
  - `decideStreak`: 20:10 local with a hint for today unlit and current 5 sends. 19:50 doesn't. Current 2 doesn't. `streakReminder: false` doesn't. Hint dated yesterday and lit sends. Hint dated yesterday and unlit (the streak already broke yesterday or a freeze applies) doesn't.
  - `run.test.ts`: priority fast > streak > water; a leave day sends nothing; the payload carries `topic`.
- [ ] **Step 2:** `npx vitest run supabase/functions`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run && npx tsc -b --noEmit`. Expect pass.
- [ ] **Step 5:** `git commit -m "feat(push): fast milestones, streak-at-risk nudge, leave mutes all"`

---

### Task 11: Progress photos

**Files:**
- Create: `supabase/migrations/20261027000000_progress_photos.sql`, `src/lib/photos.ts`, `src/screens/challenges/PhotoTimeline.tsx`
- Modify: `src/screens/today/ChallengeCard.tsx`, `src/screens/history/DayCard.tsx`, `src/screens/challenges/RunDetailSheet.tsx`

**Interfaces:**
- Migration:
  - `insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false) on conflict do nothing;`
  - Three policies on `storage.objects` for `authenticated`: select, insert and delete, each with `bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text`.
- `src/lib/photos.ts`:
  - `resizeToJpeg(file: Blob, maxPx = 1600, quality = 0.8): Promise<Blob>` (`createImageBitmap` plus canvas)
  - `uploadPhoto(userId: string, photoId: string, blob: Blob): Promise<string>`: returns the path `{userId}/{photoId}.jpg`, throws on error.
  - `deletePhotoObject(path: string): Promise<void>`
  - `usePhotoUrl(path: string | undefined)`: React Query `['photo', path]`, `createSignedUrl(path, 3600)`, `staleTime` 50 min.
- `ChallengeCard` photo task:
  - Signed in: a hidden `<input type="file" accept="image/*" capture="environment">`. On pick: resize, upload, `addPhoto({ id, date: today, path, challengeId })`.
  - While uploading the row shows a spinner. On failure the row shows `"Upload failed. Retry"` and no record is added.
  - Signed out (`useSyncState().user == null`): plain tick plus the footnote `"Sign in to save photos"`.
- `PhotoTimeline({ run })`:
  - A 3-column grid of the run's photos by date, each tile from `usePhotoUrl`. Loading is a grey tile; an error tile says `"Couldn't load photo"`.
  - A before/after slider: two stacked images, the top clipped by a range input, first vs latest. Hidden when there are fewer than 2 photos.
  - Long-press or a menu on a tile offers Delete (confirm): `deletePhotoObject` first, then `removePhoto`.
- `DayCard`'s challenge row shows the day's thumbnail.

- [ ] **Step 1:** Write the migration and the lib.
- [ ] **Step 2: Apply the migration** (PowerShell, where the Supabase CLI is logged in): `npx supabase db push`. Expected: the migration applies. Verify the bucket: `npx supabase db query --linked "select id, public from storage.buckets where id = 'progress-photos'"` returns one row, `public = false`.
- [ ] **Step 3:** Wire the UI.
- [ ] **Step 4: Manual check** on the dev server, signed in: take a photo on a 75-Day run. The task ticks, the thumbnail shows in the History day card, and the timeline shows it. Delete it; the task reopens.
- [ ] **Step 5:** Typecheck and unit tests pass. `git commit -m "feat(4.3): progress photos in private storage"`

---

### Task 12: Deploy the edge function

**Files:** none new.

- [ ] **Step 1** (PowerShell): `npx supabase functions deploy water-nudge --no-verify-jwt`. Expected: `Deployed Function water-nudge`.
- [ ] **Step 2:** Trigger one run the way it was verified in 4.2 (`net.http_post` with the vault `cron_secret`) and check the JSON response has `checked`, `sent` and `removed` with no `error`.
- [ ] **Step 3:** No commit needed unless config changed.

---

### Task 13: Badges

**Files:**
- Create: `src/domain/badges.ts`, `src/components/BadgeCard.tsx`, `src/screens/BadgesSheet.tsx`
- Modify: `src/store/app.ts` (back-fill), `src/App.tsx` (sheet `badges` replaces the Task 6 stub, mount `<BadgeCard />`)
- Test: `src/domain/badges.test.ts`

**Interfaces:**
- `badges.ts`:
  ```ts
  export type BadgeId = 'streak-3' | 'streak-7' | 'streak-30' | 'streak-100' | 'streak-365' | 'first-workout' | 'first-pr'
    | 'workouts-50' | 'workouts-100' | 'hydrated-week' | 'finish-75' | 'finish-stack' | 'finish-custom' | 'fast-24' | 'fast-36';
  export interface BadgeDef { id: BadgeId; title: string; description: string; icon: string /* lucide name */; progress?: (data, today) => string }
  export const BADGES: BadgeDef[];
  export function earnedBadges(data: AppData, today: string): Map<BadgeId, string>; // id -> local date earned
  export function unseenBadges(data: AppData, today: string): BadgeId[];          // earned and not in seenBadges
  export function markBadgesSeen(data: AppData, ids: BadgeId[]): AppData;
  export function withBadgeBackfill(data: AppData, today: string): AppData;       // seenBadges undefined -> all earned ids
  ```
  - Streak badges use the first date in `streak().counts` where the count ≥ N.
  - `first-pr` uses `sessionPRs` per finished session, in date order.
  - `hydrated-week` is the 7th day of the first run of 7 water-goal days.
  - `finish-*` uses `endedOn` of the first `done` run per template.
  - `fast-24` and `fast-36` use the first ended fast with elapsed ≥ 24 or 36.
  - `progress` gives locked copy like `"12 days to go"` for streak and workout badges.
- Store: `merge` and `replace` apply `withBadgeBackfill(…, today)`.
- `BadgeCard`:
  - Shows when `unseenBadges` is non-empty, after the `repwise:ignite-closed` event, or straight away if no ignite is pending today.
  - Springs up from the bottom with the icon, title and description.
  - Close calls `markBadgesSeen` for the shown id. Then the next one, if any, shows.
- `BadgesSheet`: a grid of all `BADGES`. Earned ones show in colour with `D MMM YYYY`; locked ones are grey with `progress`.

- [ ] **Step 1: Write failing tests**
  - 7 lit days earns `streak-3` (day 3 date) and `streak-7` (day 7 date).
  - The first finished session earns `first-workout`.
  - A completed `done` 75-Day run earns `finish-75` on `endedOn`.
  - A 24.5 h ended fast earns `fast-24` and not `fast-36`.
  - `withBadgeBackfill` with `seenBadges` undefined sets it to all earned. With `[]` it leaves it unchanged.
  - `unseenBadges` excludes seen ones.
- [ ] **Step 2:** `npx vitest run src/domain/badges.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement the module, card, sheet and store back-fill.
- [ ] **Step 4:** Typecheck, unit tests and e2e pass. The e2e starts from empty data, so the first lit day triggers `streak-3` only after 3 days; no badge card appears in e2e. Confirm the e2e doesn't break on it.
- [ ] **Step 5:** `git commit -m "feat(4.3): milestone badges"`

---

### Task 14: Release

**Files:** `package.json`, `e2e/acceptance.mjs`

- [ ] **Step 1:** Bump `package.json` `version` to `4.3.0`.
- [ ] **Step 2:** e2e: after logging water to the goal on Today, check that an element with text `-day streak!` appears, then that the flame chip's `aria-label` reads `1-day streak`.
- [ ] **Step 3:** Full verification:
  - `npx vitest run` passes everything.
  - `npx tsc -b --noEmit` is clean.
  - `npx vite build` succeeds.
  - e2e against preview exits 0.
- [ ] **Step 4:** `git commit -m "chore: Repwise 4.3.0"`
- [ ] **Step 5:** Deploy: `npx vercel deploy --prod --yes`. Verify by grepping the live `assets/index-*.js` for `-day streak!` and `75-Day Challenge`.
