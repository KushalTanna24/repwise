# Repwise 4.1 — Freestyle flow, supplements, Today polish

Date: 2026-10-17 · Status: approved in chat · Builds on `2026-10-17-repwise-rebuild-design.md`

## Intent

The user trains 5×/week on Full Body A/B/C, **freestyle**: they move between exercises (legs, then chest, then back) based on what is free and fresh, rather than finishing one exercise before the next. After real use they reported:

- Up Next should not dominate after the workout is done.
- "Session 1 of 3" read like a weekly count.
- Water is invisible in History.
- Profile changes appeared to do nothing.
- They want a supplement checklist.

Keep it simple and fun.

## 1. Today

- **Up Next card collapses** (iOS disclosure). The header row is always visible: rotation strip, title, exercise count and a chevron. Tapping it toggles the exercise list with a spring height animation; Start / Resume stays visible.
- **Default open state:** expanded when nothing was finished today, collapsed when a workout was finished today. A manual toggle is remembered for that day (`localStorage.repwise_upnext = {date, open}`).
- **Done for today:** when a session finished today and none is active, a green "Done today" summary card (title, duration, sets) sits above the collapsed Up Next, which is labelled "Next time".
- **Rotation strip** replaces "session x of y": one chip per session in the split (A B C, or Push Pull Legs), the current one filled, plus "Cycle n".
- **Supplements card** under Water. Pills, one per active supplement; one tap toggles taken for today. When the stack is empty, the card shows "Add your stack" and opens Profile.

## 2. Freestyle workout flow

- `SetRecord.doneAt?: string` is written by `confirmSet` (an ISO time passed in by the caller).
- `region(pattern)`: knee, hip, calves → `legs`; hpush, vpush → `push`; hpull, vpull → `pull`; shoulders, arms, core → `other`.
- `suggestNext(session, catalogue, now) → { exIdx, setIdx } | null`:
  1. Candidates are exercises that are not skipped and have a pending set (the first pending set is the target).
  2. The last region is the region of the exercise holding the latest `doneAt`. Exercises in a different region rank first.
  3. Then readiness: the exercise has never been done this session, or the time since its last `doneAt` is ≥ its `restSec`.
  4. Then the longest time since its last set (never done = infinite).
  5. Then anchors before accessories.
  6. Then plan order.
- **UI:** a pinned "Next" bar at the top of the workout shows exercise, set number and target. Tapping it scrolls to the card and highlights the row for 1.5 s. Each card shows a chip: "Ready" (green) or "Rested m:ss" (counting).
- **Rest timer** after a tick: 45 s when the newly suggested exercise is in a different region from the one just ticked; otherwise that exercise's `restSec`. No suggestion left → no timer.

## 3. Supplements & history

- `AppData.supplements: { id; name; dose?; archived? }[]` and `AppData.suppLog: Record<date, string[]>`. `normalize` defaults both to empty.
- Domain: `addSupplement`, `renameSupplement`, `setSupplementArchived`, `toggleSupplement(date, id)`, `suppStreak(data, today)`. The streak counts consecutive days, ending today (or yesterday if today is not complete yet), on which every active supplement was taken. It is 0 with no active supplements.
- Profile → Supplements: add (name plus optional dose), rename, archive.
- **History:** each date with water > 0 or any supplement taken gets a "Day" row (💧 n/goal · 💊 n/active) grouped in its week alongside workouts.
- **Progress → Body:** a supplement streak line under the water chart.

## 4. Profile settings with visible effect

- **Session length** options: 45, 60, 75, 90 min, allowing 5, 6, 7 and 8 exercises.
- **Finisher slots:** after the template slots, the planner appends finisher accessory slots for calves, core and arms, each only when the session lacks that pattern. Trimming still removes accessories from the end, so longer sessions add finishers.
- **Experience:**
  - Beginner: eligible candidates are ordered machine → dumbbell → cable → bodyweight → barbell (stable), and anchor sets drop by 1 (minimum 2).
  - Advanced: accessory sets increase by 1.
  - Intermediate: unchanged.
- **Apply to current workout:** `applyProfileToActive(data)` rebuilds the prescription and pending sets of each exercise in the active session that has no done sets and a known slot. Done sets are never touched. Profile shows an "Apply to current workout" row while a workout is open.

## Testing

- Unit tests: `suggestNext` ordering rules, `doneAt` written on confirm, finishers by session length, experience ordering and set counts, `applyProfileToActive` keeping done sets, supplements functions and streak, normalize defaults.
- e2e additions: collapse/expand Up Next, Done-today state after finishing, supplement pill toggles and history Day row, the next-set bar updating after a tick.
