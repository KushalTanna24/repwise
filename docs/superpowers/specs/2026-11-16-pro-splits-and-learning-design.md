# Pro splits, week view and learning groundwork: design

Date: 2026-11-16 · Status: built on branch `worktree-pro-splits`, awaiting review

## Goals

1. **Pro splits.** A library of routines that well-known bodybuilders, actors and athletes trained, in the spirit of the copy-paste pro configs in competitive games. People browse it, see how each person trained and copy a routine into their own splits. Repwise fits the copy to their equipment and session length.
2. **Week view bug.** A 3-day split such as Hybrid PPL still showed 3 days after the user set 6 days a week. The rotation was already correct, because it cycles the 3 days twice. The screens showed the split's own day list and ignored `daysPerWeek`.
3. **Learning groundwork.** Record the data a later release needs to learn from the user (swaps, supersets, strength over time), without changing any plan yet.

## 1. Pro splits

### Data

`src/domain/training/splits/pros.ts` holds `PRO_SPLITS: ProSplit[]`, which is static and read-only. Each entry has:

- Who: `person`, `title` (for example "7× Mr. Olympia"), `category` (`bodybuilder | hollywood | athlete`) and `era`.
- What: `name` (the name the user's copy gets), `tagline`, `daysPerWeek`, `schedule` and `techniques`.
- `sessions`: the same `Slot` shape as the built-in splits. The first candidate is what the person used, or the closest exercise in the catalogue. The candidates after it are stand-ins for other equipment.
- `supersets`: pairs of slot ids on a day. These are shown in the detail view now, labelled A1 and A2, and logged as supersets later (see 3).
- `source` and `inspired`: where the routine comes from. `inspired: true` marks entries that sources disagree on (The Rock, Hugh Jackman, Jay Cutler and Cristiano Ronaldo). The UI says so.

The first release has 12 entries. Bodybuilders: Arnold Schwarzenegger, Ronnie Coleman, Dorian Yates, Frank Zane, Mike Mentzer, Jay Cutler, Chris Bumstead, Steve Reeves and Reg Park. Hollywood: Dwayne Johnson and Hugh Jackman. Athletes: Cristiano Ronaldo.

Pro splits are never trained directly. `ProSplitId` (`pro-${string}`) is not a `SplitId`, so the rotation, the planner, sync and migration do not change. A copy is an ordinary `CustomSplit` with `copiedFrom: ProSplitId`.

### Adopting a pro split

`adoptProSplit(data, pro, now, { fit })` returns `{ split, changes }`:

- It keeps only the candidates the user can do. When none are left, it falls back to any eligible, non-calisthenics exercise with the same pattern. When there is none, it drops the slot. It never repeats an exercise within a day.
- With `fit: true`, it drops extras from the end of each day until the day fits `MAX_EXERCISES[sessionMinutes]`. Main lifts are always kept.
- `changes` lists every difference from the original, written for the user. It covers substitutions, trims, and how the person's weekly frequency compares with the user's.

`adoptedCopy(data, pro)` finds the user's live copy, so the library shows "In your splits" or "Training", and the primary action becomes "Switch to your copy".

### Screens

- **Split chooser**: a "Pro splits" card after the built-in splits.
- **New split**: a "Start from" sheet that also offers "A pro split".
- **`pros` sheet**: the library, with a category filter (All, Bodybuilders, Hollywood, Athletes).
- **`pro:<id>` sheet**: a detail view covering how they trained, each day with Main and superset markers, a "Fitted to you" list and the source note.
  - Primary action: **Train this split**. It saves the fitted copy and switches to it.
  - Secondary action: **Copy and edit first**. It opens the full, untrimmed copy in the split editor.
- A footnote says the routines are rebuilt from public sources and that no one listed is affiliated with Repwise or endorses it. Avatars are initials, not photos.

Sets, reps and loads stay automatic: they follow the user's goal, experience and history, as in every other split. The techniques say how the person ran their sets. For example, Mentzer and Yates did one all-out set.

## 2. Week view

`weekView(split, daysPerWeek, rotation)` in `training/week.ts` returns the user's training week. The week is `daysPerWeek` sessions long, in rotation order, and each session is marked done, current or upcoming. Weeks are counted in sessions, not calendar days. `weekSummary(len, days)` gives one line such as "Each day twice a week. Extras change on the second round".

It is used in three places:

- **Today, the "Up next" card**: the strip shows the whole week, for example 6 chips for Hybrid PPL at 6 days, with "4 of 6 this week".
- **Split chooser cards**: each card shows "Your 6-day week · …" and the week's chips.
- **Training sheet**: a line under "Days per week" explains how the active split fills the week. A plan from the plan builder is marked `generated: true`; older plans are recognised by a name that starts with "Your plan". When the day count of a generated plan differs from `daysPerWeek`, the sheet offers **Rebuild your plan for N days**, which opens the plan builder with the previous answers filled in.

## 3. Learning groundwork (no behaviour change yet)

What is recorded now:

- `SessionExercise.swappedFrom`: the exercise the plan picked, kept across repeated swaps and cleared when the user swaps back. It is set only for exercises that belong to a plan slot.
- `swapSignals(data)` in `training/learn.ts`, a pure read over finished sessions. For each `(split, slot)` it returns what the planned exercise was replaced with, how often, when that last happened, and how many times the slot was trained in total.

Planned next steps, each in its own release:

1. **Learn swaps.** When a slot's planned exercise is swapped in most of its recent sessions, at least 3 of the last 4, put the replacement first in that slot's candidates. Show it as a suggestion with an undo, never as a silent change. The input is `swapSignals`.
2. **Supersets.** Add `supersetWith?: number` (an exercise index) to `SessionExercise`, and a "Pair with next" action in the workout. Pro split copies carry their pairs into `CustomSplit` sessions. Pairs the user keeps doing become a suggestion for that day.
3. **Strength flow.** `strength.ts` already has per-lift trends (Epley e1RM). Detect stalls, meaning three sessions with no e1RM gain, and suggest a rep-range change or a swap for that slot. This feeds the same suggestion surface as step 1.
4. **Prediction.** Project the e1RM trend per main lift and show a "by <date>" estimate next to goals, using `goals.ts`.

Rules for all of these steps: suggestions are explainable in one line, can be undone, and never rewrite history.
