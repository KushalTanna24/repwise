# Custom split builder — design

Date: 2026-11-08 · Target release: Repwise 4.5.0 · Status: approved in conversation, awaiting written-spec review

## Goal

Let people build their own training split instead of only choosing one of the four built-in splits. A user names their own days and chooses the exercises on each day, with suggestions drawn from their experience, session length and equipment.

The work also restructures the training code into one module, so that splits, rotation and exercise progression each have exactly one home. That restructure is the first step and changes no behaviour.

## Decisions

| Topic | Decision |
|---|---|
| What the user controls | Day names, day count and order, and the exercises on each day. |
| Starting point | "Copy an existing split" (any built-in or custom split) or "Start blank". Per-day suggestions are available either way. |
| One entry on a day | An exercise, marked **Main** or **Extra**. Extras can have optional alternates that rotate by cycle. Mains never rotate. |
| Session length | Custom days are planned exactly as built: no trimming and no finishers. The day editor shows a guide and warns when the day exceeds the recommended count. |
| Sets, reps, rest | Stay automatic, from objective, experience and Main/Extra role. Not editable in the builder. |
| How many | Several custom splits per user, each with its own rotation position. Deleted splits are hidden, not erased. |
| Architecture | Custom splits are stored in AppData using the same `SplitDef` shape as built-ins (approach 1). |
| Scope | Training core only. The app-wide restructure (Today.tsx, other feature modules, `types.ts`) is a separate spec, tracked in `next.md`. |

## Problems in the current code this fixes

1. "What should this exercise be today" is computed in four places: `planner.plannedExercise`, `session.addExercise`, `session.swapExercise` and `session.applyProfileToActive`. Each repeats prescription, eased sets, `recommend` and `setsFrom` with small differences.
2. `SPLITS[id]` is read directly in seven files, including screens.
3. Rotation logic is split between `planner.ensurePlan` (break reset) and `session.ts` (`advance`, skip).
4. `SplitId` is a closed union and `program.rotation` is a fixed record, so new splits cannot be added as data.

## Module structure

```
src/domain/training/
  index.ts        Public API. Screens and other domain files import only from here.
  types.ts        Split, slot, plan, session and prescription types.
  splits/
    builtins.ts   The four fixed splits (today's splits.ts).
    custom.ts     Create, copy, save and delete custom splits; suggestDay; dayGuide.
    registry.ts   getSplit, listSplits, findSlot.
  rotation.ts     Every rotation change: current position, advance, skip, break reset, clamp, setSplit.
  prescribe.ts    The single source of an exercise's plan, recommendation and starting sets.
  progression.ts  Pure maths: recommend, increments, return tiers, eased sets.
  planner.ts      buildPlan, ensurePlan, rebuildPlan, swapCandidates, isEligible.
```

Rules:

- Progression is decided in one place (`prescribe`) and shown from one place (the planned session and session records it produces). No screen or other domain file calls `recommend`, `prescription` or `easedSets` directly.
- Nothing outside `domain/training/` reads `BUILT_IN_SPLITS`, `customSplits` or `program.rotation` directly.
- Old import paths (`domain/splits`, `domain/planner`, `domain/progression`) are removed with no re-export shims, so leftover callers fail typecheck.
- `session.ts` stays where it is for this release and keeps workout mutations (sets, add, swap, finish, discard). It calls `prescribe` and `advanceRotation` instead of repeating that logic.

### `prescribe`

```ts
prescribe(data: AppData, exerciseId: string, role: 'anchor' | 'accessory', now?: string)
  -> { plan: Prescription; rec: Recommendation; sets: SetRecord[] }
```

It applies the objective and experience prescription, eases sets after a break (return tier from `now`), runs `recommend` against history, and builds the pending sets. When the exercise does not exist or is not eligible, it returns the existing "No option for your equipment. Pick one." recommendation with an empty exercise id. `plannedExercise`, `addExercise`, `swapExercise` and `applyProfileToActive` all call it.

## Data model

```ts
type BuiltInSplitId = 'full-body-abc' | 'upper-lower' | 'ppl' | 'ppl-hybrid';
type CustomSplitId = `custom-${string}`;
type SplitId = BuiltInSplitId | CustomSplitId;

interface SplitDef {
  id: SplitId;
  name: string;
  blurb: string;
  custom?: true;
  sessions: { title: string; short?: string; slots: Slot[] }[];
}

interface CustomSplit extends SplitDef {
  id: CustomSplitId;
  custom: true;
  createdAt: string;
  updatedAt: string;
  copiedFrom?: SplitId;
  /** Set on delete. Hidden from lists, still resolved for history and swaps. */
  deletedAt?: string;
}

interface AppData {
  // ...existing fields
  customSplits: CustomSplit[];
  program: {
    splitId: SplitId | null;
    /** A missing entry means day 1, cycle 1. */
    rotation: Partial<Record<SplitId, RotationState>>;
  };
}
```

- A custom slot is a `Slot` whose `candidates[0]` is the chosen exercise and whose remaining candidates are its alternates. `role` is `anchor` for Main and `accessory` for Extra. A Main slot keeps only its first candidate, so mains never rotate.
- Custom slot ids are random (`cs-` plus 8 characters) and never change when the split is edited, so swaps on past workouts still find their slot. Copying a split assigns new slot ids.
- The `blurb` of a custom split is generated on save, for example "4 days · Push / Pull / Legs / Arms".
- Progression is keyed by exercise id, not by split or slot. Copying a split or switching between splits keeps every lift's history and weights.

### Storage, sync and migration

- The change is additive. `schemaVersion` stays at 4.
- `normalize` fills `customSplits ?? []` and leaves `rotation` entries as stored (missing means day 1, cycle 1).
- If `program.splitId` is a custom id that does not resolve, `normalize` sets it to `null` and clears `plannedSession`. Today then shows the split chooser instead of crashing.
- Sync, backup export and import carry the field because it is part of AppData.

## Planner behaviour for custom splits

- `buildPlan` resolves the split through `getSplit`. When `split.custom` is true it skips `FINISHERS` and skips the `MAX_EXERCISES` trim. Built-in splits behave exactly as today.
- Eligibility, beginner machine-first ordering, Main fixed and Extra rotation by `(cycle - 1 + variant)` all reuse the existing code.
- An entry whose exercise and alternates are all ineligible produces the existing empty "Pick one" slot.
- `findSlot(data, splitId, slotId)` searches built-ins, custom splits (including deleted ones) and finishers.

## Editing rules (`splits/custom.ts`)

- `newCustomSplit(data, from, now)` creates the split and returns `{ data, id }`. With `from` set, it copies that split's days, titles, Main/Extra roles and alternates, with new slot ids and `copiedFrom` set; the name is "My <name>". With `from` null, the split is named "My split" with one empty day called "Day 1".
- `saveCustomSplit(data, split, now)` replaces the stored split as a whole and bumps `updatedAt`. Validation: a non-empty name, 1 to 7 days, each day with a non-empty title and 1 to 12 exercises. On an invalid split it returns `data` unchanged and the editor shows the reason. If the split is active and no workout is running, `plannedSession` is cleared so `ensurePlan` rebuilds it. If days were removed, its rotation index is clamped to `min(index, days - 1)` and the cycle is kept.
- `deleteCustomSplit(data, id, now)` sets `deletedAt`. If it was the active split, `splitId` becomes `null` and `plannedSession` is cleared. A running workout blocks deletion of the active split.
- `suggestDay(data, focus)` returns slots for one day. The focus maps to movement patterns:

  | Focus | Patterns, in order |
  |---|---|
  | Full body | knee, hpush, hpull, hip, shoulders, core |
  | Upper | hpush, vpull, hpull, vpush, shoulders, arms, arms |
  | Lower | knee, hip, knee, hip, calves, core |
  | Push | hpush, vpush, hpush, shoulders, arms, hpush |
  | Pull | vpull, hpull, shoulders, arms, arms, vpull |
  | Legs | knee, hip, knee, hip, calves, core |
  | Arms & shoulders | vpush, shoulders, arms, arms, shoulders, arms |

  For each pattern it picks the first eligible exercise not already on the day (beginners get machines and dumbbells first, as in the planner), with up to two eligible same-pattern alternates for Extras. It fills up to `MAX_EXERCISES[sessionMinutes]`, repeating the pattern list from the start if needed. The first two entries are Main (three for Full body and Lower). Patterns with no eligible exercise are skipped.
- `dayGuide(profile, count)` returns `{ limit: MAX_EXERCISES[profile.sessionMinutes], over: count > limit }`.

## Screens

All new views are sheets opened through the existing `openSheet` routing. They reuse `Sheet`, `List`/`Row`, `Segmented`, `Button`, `confirm` and `ExercisePicker`.

### Split sheet (existing, extended)

```
Training split
  [Full Body] [Upper/Lower] [PPL] [Hybrid PPL]    built-in cards, as today
  Your splits
  [Gym split  ✓]   ⋯  Edit · Duplicate · Delete
  [Home split   ]
  + Build your own
```

Tapping any card switches split with the existing confirm dialog. "Duplicate" calls `newCustomSplit` with that split as the source and opens the editor. "Delete" asks for confirmation first. With no custom splits, the "Your splits" heading is hidden and only "Build your own" shows.

### New split (`split-new`)

A list of sources: each built-in split, each custom split, and "Blank". Picking one calls `newCustomSplit` and opens the editor on a draft (nothing is stored until Save; see Drafts).

### Split editor (`split-edit:<id>`)

```
Name  [Gym split          ]
Days
  1  Push    5 exercises   ↑↓  ›
  2  Pull    6 exercises   ↑↓  ›
  + Add day                          (1 to 7 days)
                           [Save]
```

Each day row has a menu with Delete (not offered on the last remaining day).

### Day editor (`split-day:<id>:<n>`)

```
Day name [Push    ]
  Bench press        [Main|Extra]   ↑↓  ✕
  Lateral raise      [Main|Extra]   ✕
     Alternates: Cable lateral raise  +
  + Add exercise
  5 exercises · about right for 60 min
```

- When the day has no exercises, a **Fill this day** button asks for a focus and fills the day with `suggestDay`.
- **Add exercise** opens `ExercisePicker` with eligible exercises only. Its suggested list is `suggestDay` output for the day's focus, minus exercises already on the day. The focus is not stored in the split; the day editor keeps it in its draft state only after **Fill this day** was used in the same editing session. Otherwise the suggested list is eligible exercises for the patterns already on the day.
- Alternates can be added only to Extras, picked from eligible exercises of the same pattern.
- An exercise that is no longer eligible shows a "Not available with your equipment" tag.
- The guide line uses `dayGuide`. Over the limit it reads "8 exercises · more than the 6 that usually fit 60 min".

### Drafts

The editor holds the split as a local draft in component state. Save calls `saveCustomSplit` once. Closing with unsaved changes asks "Discard changes?". A split created from `split-new` is only stored on its first Save.

### Copy

- Empty "Your splits": heading hidden, "Build your own" button only.
- Empty day: "No exercises yet. Fill this day or add one."
- Blocked save: the first failing rule, for example "Give every day at least one exercise".
- Blocked delete or switch during a workout: "Finish or discard your workout first".

## Testing

### Step 1: refactor (no behaviour change)

- The existing `planner`, `session`, `progression`, `migrate` and `flow` tests pass unchanged apart from import paths.
- New test: `prescribe` gives the same plan, recommendation and sets as the pre-refactor paths for plan, add, swap and apply-profile on fixture data.
- `npm run typecheck`, `npm test` and `npm run e2e` pass.

### Step 2: custom split domain (tests written first)

- Create from each built-in and from blank. A copy keeps days, titles, alternates and roles, with new slot ids.
- Save clamps the rotation when days are removed, clears the plan when the split is active, and never touches a running workout.
- Validation rejects an empty name, 0 or 8 days, an empty day and a 13-exercise day.
- Delete hides the split from `listSplits`, clears the active split, and is blocked during a workout. `findSlot` still resolves its slots afterwards.
- `buildPlan` on a custom split adds no finishers and trims nothing. Mains stay fixed and extras rotate by cycle.
- Ineligible exercises fall back to alternates, then to the empty "Pick one" slot.
- `suggestDay` for every focus fills to the session-length count, uses only eligible exercises, and orders machines first for beginners.
- `dayGuide` limits match `MAX_EXERCISES`.
- `normalize` handles a missing `customSplits` and an orphaned custom `splitId`.
- Finishing a custom-split workout advances that split's rotation, including wrap-around to the next cycle.

### Step 3: screens

- Acceptance flow in `e2e/acceptance.mjs`: copy PPL, rename a day, add an exercise, save, switch to the new split, check Today shows the custom day, finish a workout, check the rotation moved to the next day.

## Delivery

Three commits on `dev`, in order: the training module refactor, the custom split domain, the builder screens. They ship together as Repwise 4.5.0.

## Out of scope

- Editing sets, reps or rest per exercise.
- Fixed weekdays for days (the rotation stays "next day in order").
- Sharing splits between users.
- The app-wide restructure, which has its own spec next.
