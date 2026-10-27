# Repwise 4.3 — Streaks, challenges and a standard History

Date: 2026-10-27 · Status: approved in chat, pending spec review · Builds on `2026-10-18-repwise-v4-2-design.md` and commit `c09def8` (ease back in after a break)

## Intent

The user wants Repwise to feel gamified, the way Duolingo does: check in, watch a streak ignite with a satisfying animation, and keep it going. They also want challenges in the same app (a 75-day challenge, fasting up to 36 hours, habit stacking, their own), and a History screen that is less cluttered and treats every tracker the same way, so new trackers fit later without a redesign.

User feedback that shaped this:

- History has a weekly list under the calendar that adds clutter.
- The History "Show" dropdown filters workouts only, not water, supplements or anything else. It should be standard across trackers.
- Streaks belong on History too.

Decisions made in chat:

- **Streak rule:** a day is lit when **any one daily goal** is done: workout, water goal, all supplements, a challenge's tasks, or a completed fast.
- **Misses:** **earned freezes plus Leave mode.** Every 7 lit days in a row earns one freeze, held up to 2, spent automatically on a missed day. Planned leave pauses the streak and mutes reminders.
- **Game layer:** streak plus **milestone badges**. No XP, levels or leagues.
- **Scope:** **one release** containing everything in this spec.
- **Challenges at launch:** 75-Day Challenge, fasting timer (16/24/36 h), habit stacking, build your own.
- **Progress photos are stored in the app** (Supabase Storage), not a tick.
- **Fasting milestones send push notifications** through the existing hourly cron.
- **Architecture:** everything is **derived from logged data** (approach A). Streak, freezes, badges and History rows are computed, never stored as counters.

## 1. Data model

### New fields on `AppData`

All additive. Missing fields get empty defaults when data is loaded, imported or synced, so old blobs and backups keep working. Check how `migrate.ts` handles a partial v4 document and add the defaults in the same place, with a migration test.

```ts
leave: { start: string; end: string | null }[];   // local YYYY-MM-DD, inclusive; end null = open-ended
challenges: ChallengeRun[];
fasts: Fast[];
photos: ProgressPhoto[];
seenBadges: string[];
streakHint: { date: string; current: number; lit: boolean } | null;  // cache for the server only
```

```ts
interface ChallengeTask {
  id: string;
  label: string;
  kind: 'tick' | 'photo';
  /** Ticks itself from data the app already has. */
  auto?: 'workout' | 'workout-outdoor' | 'water';
  /** For auto 'water': glasses needed, otherwise the profile goal. */
  target?: number;
}

interface ChallengeRun {
  id: string;
  templateId: '75-day' | 'habit-stack' | 'custom';
  title: string;
  startDate: string;           // local date of day 1 of the current attempt
  days: number;
  rule: 'strict' | 'lenient';
  tasks: ChallengeTask[];
  ticks: Record<string, string[]>;  // date -> ticked manual task ids (auto tasks are never stored)
  status: 'active' | 'done' | 'failed' | 'quit';
  restarts: number;
  /** Habit stack only. */
  anchor?: string;
}

interface Fast {
  id: string;
  startedAt: string;           // ISO
  endedAt: string | null;
  targetHours: 16 | 24 | 36;
}

interface ProgressPhoto {
  id: string;
  date: string;                // local date
  path: string;                // storage object path: {user_id}/{id}.jpg
  challengeId?: string;
}
```

Also add to `Profile`: `fastingSafetyAck?: boolean`, and `streakReminder?: boolean` (default on, toggled in the Reminders sheet next to water reminders).

### Goal registry — `src/domain/goals.ts`

One list of daily goals. Every screen that asks "what got done on this date" reads it.

```ts
interface GoalStatus { done: boolean; progress?: [number, number]; detail?: string }
interface Goal {
  id: string;                  // 'workout' | 'water' | 'supplements' | `challenge:${runId}` | 'fast'
  kind: 'workout' | 'water' | 'supplements' | 'challenge' | 'fast';
  label: string;
  color: string;               // dot colour on the calendar
  status: GoalStatus;
}
function goalsFor(data: AppData, date: string): Goal[];
```

Goals at launch:

- **Workout:** done when a finished session started on that date, or an extra (run, mobility, skills) is logged for it.
- **Water:** done when glasses ≥ `profile.waterGoal`. Progress is `[glasses, goal]`.
- **Supplements:** only included when the user has active supplements. Done when every active supplement is ticked.
- **Challenge:** one goal per run that was active on that date. Done when every task for that date is done, counting auto tasks.
- **Fast:** only included on a date where a fast ended. Done when that fast reached its target.

Known trade-off: water and supplement goals use the current goal and stack, so changing them changes which past days count. Accepted for now.

## 2. Streak

### Day states

- **lit:** any goal done.
- **leave:** inside a leave range. Neither adds to the streak nor breaks it.
- **frozen:** not lit, not leave, and a freeze was spent. The streak survives but does not grow.
- **missed:** not lit, not leave, no freeze available. The streak resets to 0.
- **pending:** today while not lit. Never breaks anything. The flame shows yesterday's count, dimmed.

### Replay — `src/domain/streak.ts`

```ts
function streak(data: AppData, today: string): {
  current: number; best: number; freezes: number; todayLit: boolean;
  days: Map<string, 'lit' | 'frozen' | 'leave' | 'missed'>;
  freezeUsedOn: string | null;   // most recent date a freeze was spent, for the toast
};
```

- Walk every date from the first date with any goal done up to today.
- Lit: `current += 1`. When `current` reaches a multiple of 7, `freezes = min(2, freezes + 1)`.
- Leave: no change.
- Not lit, not leave, before today: spend a freeze if one is held (frozen), otherwise `current = 0` (missed).
- Today: lit counts, otherwise pending.
- `best` is the highest `current` seen.
- Pure function. Memoize on the `data` object, since the store replaces it on every change.

### Leave

- Start from Profile or the Today ••• menu: pick an end date or leave it open.
- The start date can be backdated up to 30 days.
- "End leave" sets `end` to yesterday, so today counts again.
- Starting leave with a strict challenge active shows a warning: "Leave doesn't pause your 75-Day Challenge. Missed tasks still end it."
- Today shows "On leave until 3 Nov. Streak paused." with an End leave button.

### Streak hint for the server

Whenever the store saves data, also write `streakHint = { date: today, current, lit: todayLit }`. The server uses it only to decide the streak-at-risk nudge. The app never reads it.

## 3. History

Top to bottom:

1. **Streak header.** A big flame with the current count, "Best N", one snowflake per freeze held, and an "On leave" chip when on leave. Tap it to open the **badges sheet**: earned badges in colour with their date, locked ones grey with what's left ("12 days to go").
2. **Calendar.** The current month view, with each day filled by streak state: lit orange, frozen blue with a snowflake, leave soft grey, missed plain. Up to five small dots under the date, one per done goal, in the goal's colour, from `goalsFor`. The orange ring for Goals deadlines stays. `dayMarks` in `calendar.ts` is replaced by `goalsFor` plus `streak().days`.
3. **Filter chips** in one row, built from the goal kinds present in the data: `All · Workout · Water · Supplements · Challenges · Fasts`. Picking one dims calendar days where that kind wasn't done. This replaces the exercise "Show" dropdown. Per-exercise history stays in Progress → Strength.
4. **Day card** for the selected date, today by default. One standard row per goal: icon, label, then a check or progress text (`6/8 glasses`). Tapping a row expands it inline:
   - Workout: one row per session (tap to open session detail) and one per extra (tap to delete, with confirm, as today).
   - Water: glasses against goal.
   - Supplements: what was taken.
   - Challenge: each task with its tick, and the day's photo thumbnail.
   - Fast: start, end, duration, and whether it reached the target.

Removed: the week-grouped list below the calendar, `grouped()`, `weekLabel()`, `dayItems()` and `DayRow`.

Empty states:

- No data at all: "Your first lit day starts the flame. Log a workout, hit your water, or take your stack."
- Selected day with nothing: "Nothing logged on Tue 14 Oct."

## 4. Today

- **Flame chip** at the top right of the screen header: flame icon plus count. Grey and dimmed while today is pending, orange once lit. Tap opens History.
- **Ignite moment:** the first time today becomes lit, whichever goal does it, show a full-screen overlay. The flame scales up and flickers, the count rolls from N−1 to N, `navigator.vibrate(30)` fires where supported, and the text says "N-day streak!". Closes on tap or after 2.5 s. Plays once per day per device, stored in `localStorage` key `repwise_ignited` (date). Wrap storage access in try/catch.
- **Badge card:** if any badge is earned and not in `seenBadges`, a card springs up after the ignite overlay closes (or on its own if there was no ignite). Closing it adds the badge id to `seenBadges`.
- **Freeze toast:** on the first open after a freeze was spent: "Freeze used. Streak safe at 12. 1 left." Shown once per `freezeUsedOn` date, tracked in `localStorage`.

Card order:

1. Leave card (only on leave).
2. Workout: Up Next, or Done today (from `c09def8`).
3. Today's challenges (only when a run is active): one card per run with "Day 23 of 75" and a progress bar. Each task is a checkbox row. Auto tasks show their state with "from your workout" or "from water" and can't be ticked by hand. Photo tasks open the camera or file picker. After 20:00 a strict run with open tasks shows an orange "3 tasks left today" chip.
4. Fast (only while a fast is running): a ring of elapsed time against the target, the current phase, and End fast.
5. When no challenge is active, an "Add a challenge" row below the workout card opens the Challenges sheet.
6. Water, supplements, week and recent stay as they are.

The Today ••• menu gains "Start a fast" and "Start leave".

## 5. Challenges

### Templates — `src/domain/challengeTemplates.ts`

**75-Day Challenge** (never called "75 Hard", which is a trademark). 75 days, strict. Tasks:

- Workout 45 min — `auto: 'workout'`: any finished session or extra that date.
- Outdoor workout 45 min — `auto: 'workout-outdoor'`: an extra of type `run` that date. Otherwise ticked by hand.
- Drink 3.7 L — `auto: 'water'`, `target: 15` glasses (250 ml each).
- Follow your diet — tick.
- No alcohol — tick.
- Read 10 pages — tick.
- Progress photo — photo.

**Habit stack.** The user picks an anchor ("After morning coffee") and 1–3 new habits, each a tick task. Length 21, 30 or 66 days. Lenient.

**Build your own.** Name, 7–365 days, 1–10 tasks, each a tick or a photo, optionally linked to workout or water. Strict or lenient.

### Rules — `src/domain/challenges.ts`

- At most 3 active runs. Starting a fourth is blocked with "Finish or quit one first."
- Start date is today or tomorrow.
- Manual ticks are allowed for today and yesterday only. Older dates are locked.
- A task for a date is done when it is ticked, its auto source is met, or (photo) a photo exists for that run and date.
- **Strict:** once a date is locked (it is before yesterday) and any task for it is not done, the run fails. On the next open the app asks "Day 31 missed. Restart from day 1?" Restart sets `startDate` to today, `restarts += 1`, `status: 'active'`, and keeps old ticks for history. Declining sets `status: 'failed'`.
- **Lenient:** a locked date with open tasks is a missed day and the run continues. The run ends after its last day with a score ("27 of 30 days").
- A run is `done` when its last day is locked with every day complete (strict) or when its last day passes (lenient).
- Quit (from run detail, with confirm) sets `status: 'quit'`.
- Leave does not pause challenges.

### Challenges sheet

Opened from Today's "Add a challenge" row, from the Profile "Challenges" row, and from a challenge card on Today.

- Top: the catalogue (three templates plus "Start a fast").
- Below: active runs, then finished, failed and quit runs.
- Run detail: a day grid (done, missed, today, future), the photo timeline, the score or day count, and Quit.

## 6. Fasting — `src/domain/fasting.ts`

- Start from the Today ••• menu or the Challenges sheet. Pick 16, 24 or 36 hours. One fast at a time.
- Before the first fast with a 24 h or 36 h target, show a safety sheet the user must acknowledge once (`profile.fastingSafetyAck`):
  - Not for anyone pregnant or breastfeeding, diabetic or on glucose-lowering medication, under 18, or with a history of eating disorders.
  - Stop if you feel dizzy, faint or unwell. Keep drinking water.
  - Talk to a doctor before long fasts if you have a medical condition.
- Phases, worded as general guidance rather than medical claims:
  - 0–4 h: Digesting
  - 4–12 h: Blood sugar settling
  - 12–18 h: Fat burning
  - 18–24 h: Ketosis
  - 24 h+: Autophagy ramping up
- End fast sets `endedAt`. Ending early is allowed. The fast goal counts as done on the end date only if elapsed ≥ target.

## 7. Progress photos

- New migration: a private Storage bucket `progress-photos`. Storage policies let an authenticated user select, insert and delete only objects whose path starts with their own `auth.uid()` folder.
- Before upload the app resizes to at most 1600 px on the long side and encodes JPEG at about 0.8 quality using a canvas.
- Upload to `{user_id}/{photoId}.jpg`, then add the `ProgressPhoto` record. If the upload fails, nothing is recorded, the task stays open, and the row shows "Upload failed. Retry".
- Display through signed URLs valid for 1 hour, loaded with React Query and keyed by path.
- Deleting a photo removes the object first, then the record.
- Signed out: photo tasks behave as ticks and show "Sign in to save photos". Ticked-while-signed-out days count as done.
- Run detail timeline: a grid by date, and a before/after slider comparing the first and latest photo.

## 8. Badges — `src/domain/badges.ts`

Computed from data, never stored. `seenBadges` only records which were celebrated.

| id | Earned when |
|---|---|
| `streak-3`, `streak-7`, `streak-30`, `streak-100`, `streak-365` | best streak reaches 3 / 7 / 30 / 100 / 365 |
| `first-workout` | first finished session |
| `first-pr` | first session with a PR (`sessionPRs`) |
| `workouts-50`, `workouts-100` | 50 / 100 finished sessions |
| `hydrated-week` | 7 days in a row at the water goal |
| `finish-75`, `finish-stack`, `finish-custom` | a run of that template reaches `done` |
| `fast-24`, `fast-36` | first fast that reached 24 h / 36 h |

Each badge has a title, a one-line description and a lucide icon. Existing users get every badge they've already earned silently: on first load of 4.3, if `seenBadges` is missing, it is set to all currently earned badges.

## 9. Animation

Uses `motion/react`. Motion marks real changes only and respects `useReducedMotion()`.

- Flame: a layered SVG (outer, middle, core). The flicker loop runs only during the ignite overlay. At rest it's static.
- Ignite: flame scales from 0.6 to 1 with a spring, 6–8 embers rise and fade once, the count rolls with `AnimatePresence` (old number slides up and out, new one slides in).
- Badge card: springs up from the bottom.
- Reduced motion: overlay and card fade in and out. No scale, embers or flicker.

## 10. Server — `water-nudge`

The function keeps its name, so the cron setup doesn't change. It follows the current pattern: logic in pure modules with tests, plus parity tests against the app where logic is copied.

- `decideFast.ts`: for an active fast (no `endedAt`), send when a milestone (12 h, 24 h, 36 h, or the target) fell within the last hour. Text: "16 hours done. Your fast hit its target." / "24 hours in. Autophagy ramping up." Parity test for the milestone list against `src/domain/fasting.ts`.
- `decideStreak.ts`: at 20:00 local time, if `streakHint.current ≥ 3` and either `streakHint.date` is today with `lit: false`, or `streakHint.date` is yesterday with `lit: true`: "Your 12-day streak ends at midnight. One goal keeps it alive." At most once a day.
- Leave: when today (local) is inside a `leave` range, send nothing.
- At most one push per subscription per run, in priority order: fast milestone, streak at risk, water.
- `profile.waterReminders.on === false` suppresses water nudges, and `profile.streakReminder === false` suppresses the streak nudge. Fast milestones follow the user's choice to start a fast and are always sent when push is subscribed.

## Error and empty states

- Streak with no data: flame chip shows grey 0. History shows the first-lit-day empty state.
- Photo upload failure: "Upload failed. Retry" on the task row. Signed-out photo task: "Sign in to save photos".
- Signed URL failure: grey placeholder tile with "Couldn't load photo".
- Starting a fourth challenge: "Finish or quit one first."
- Starting a second fast: the Start a fast item is replaced by "Fasting · 14h".
- Strict run failed: the restart prompt above.

## Testing

Unit (vitest):

- `goals`: each goal's done rule, supplements hidden without a stack, challenge auto tasks, fast counted only on its end date.
- `streak`: lit run, a freeze earned at 7 and capped at 2, a freeze spent on a miss, reset with no freeze, leave neither adding nor breaking, backdated leave, pending today, `best`.
- `challenges`: strict fail and restart, lenient score, the tick window (today and yesterday only), max 3 active, done detection.
- `fasting`: phases at each boundary, goal only when the target is reached.
- `badges`: each threshold, and silent back-fill for existing users.
- `migrate`: a v4 blob without the new fields loads with defaults.
- Server: `decideFast`, `decideStreak`, leave suppression, priority order, parity tests.

End-to-end (`e2e/acceptance.mjs`):

- Log water to the goal: the ignite overlay appears, then the flame chip turns orange.
- History: streak header, day card rows, filter chips dim the calendar.
- Start a habit stack, tick a task, see it on Today and in the History day card.
- Start and end a fast.

## Build order

1. Data model, migration, goal registry.
2. Streak replay and leave.
3. History redesign.
4. Today: flame chip, ignite overlay, leave card.
5. Challenges: templates, rules, sheet, Today cards.
6. Fasting.
7. Progress photos and the storage migration.
8. Server nudges.
9. Badges and the badge card.
