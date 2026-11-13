# Custom Split Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can copy or build their own training splits (named days, Main/Extra exercises with optional alternates), on top of a new `domain/training` module that owns splits, rotation and exercise progression.

**Architecture:** Tasks 1–3 move the training code into `src/domain/training/` with one public `index.ts`, one split registry, one rotation module and one `prescribe()` function, with no behaviour change. Tasks 4–7 add custom splits as data (`AppData.customSplits`) in the same `SplitDef` shape, so the planner, progression and rotation work on them unchanged. Tasks 8–10 add the builder sheets and the acceptance flow.

**Tech Stack:** React 18 + TypeScript 7, Vite, Vitest 5, Zustand 5 (persisted to IndexedDB), Tailwind 4 with the project's own `components/ui`, puppeteer-core e2e script.

**Spec:** `docs/superpowers/specs/2026-11-08-custom-split-builder-design.md`

## Global Constraints

- `schemaVersion` stays `4`. The `customSplits` field is additive and `normalize` fills it.
- Built-in split ids stay `'full-body-abc' | 'upper-lower' | 'ppl' | 'ppl-hybrid'`. Custom ids are `` `custom-${string}` ``. Custom slot ids are `cs-` plus 8 characters.
- Built-in splits plan exactly as today (finishers and the `MAX_EXERCISES` trim of `{ 45: 5, 60: 6, 75: 7, 90: 8 }`). Custom splits get no finishers and no trim.
- Validation: name non-empty; 1 to 7 days; each day has a non-empty title and 1 to 12 exercises.
- Outside `src/domain/training/`, nothing reads the built-in split record, `data.customSplits` or `data.program.rotation` directly, and nothing calls `recommend`, `prescription` or `easedSets`. Screens and other domain files import training code only from `@/domain/training` (or `./training` inside `domain/`).
- `src/domain/splits.ts`, `src/domain/planner.ts` and `src/domain/progression.ts` are deleted, with no re-export shims.
- Exact copy: "Finish or discard your workout first", "Discard changes?", "No exercises yet. Fill this day or add one.", "Give every day at least one exercise", "Not available with your equipment", "No option for your equipment. Pick one.", "<n> exercises · about right for <m> min", "<n> exercises · more than the <limit> that usually fit <m> min".
- Copy names: a copied split is named `My <source name>`; a blank split is `My split` with one day `Day 1`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work happens on `dev`.

## Review Focus

1. **Editing the active split during a workout, then finishing it.** The workout must still be saved to history, and the rotation must stay valid (`sessionIndex < days`) even when days were removed mid-workout. Test in Task 4.
2. **The same exercise added twice to one day.** The planner's `chosen` set would leave the second slot empty. The edit helpers must refuse a duplicate on the same day, either as a main exercise or as an alternate. Test in Task 7.
3. **A custom exercise used in a split, then archived or deleted.** The plan must fall back to alternates or the "Pick one" slot, never crash on `getExercise` returning `undefined`. Test in Task 5.
4. **A backup or synced doc with a custom split but no rotation entry for it.** The split starts at day 1, cycle 1. Test in Task 4 (`normalize`).
5. **Editing a custom split that is not the active one.** Its own rotation is clamped and the active split's plan is left alone. Test in Task 4.

---

## File Structure

```
src/domain/training/
  index.ts              public API (re-exports only)
  types.ts              SplitId family, SplitDef, CustomSplit, Slot, Recommendation, Prescription,
                        PlannedExercise, PlannedSession, RotationState
  progression.ts        moved from domain/progression.ts, unchanged maths
  prescribe.ts          prescription(), prescribe(), setsFrom()
  rotation.ts           currentRotation, advanceRotation, skipDay, setSplit, restartAfterBreak, clampRotation
  planner.ts            moved from domain/planner.ts; buildPlan, ensurePlan, rebuildPlan, swapCandidates, isEligible, planKey, MAX_EXERCISES
  splits/builtins.ts    BUILT_IN_SPLITS (moved from domain/splits.ts)
  splits/registry.ts    getSplit, listSplits, findSlot, FINISHERS
  splits/custom.ts      newCustomSplit, saveCustomSplit, deleteCustomSplit, validateSplit, splitBlurb
  splits/suggest.ts     FOCUS_PATTERNS, suggestDay, dayGuide
  splits/edit.ts        pure draft edits: addDay, removeDay, moveDay, renameDay, addEntry, removeEntry, moveEntry, setRole, addAlternate, removeAlternate
  *.test.ts             next to each file
src/store/splitDraft.ts Zustand store for the split being edited (shared by the editor and day sheets)
src/screens/splits/
  SplitSheet.tsx        replaces src/screens/SplitPicker.tsx (built-in cards + Your splits + Build your own)
  NewSplitSheet.tsx     source list
  SplitEditorSheet.tsx  name + days
  DayEditorSheet.tsx    one day's exercises
```

`domain/types.ts` keeps `Exercise`, `Pattern`, `EquipmentKind`, `WorkoutSession`, `SessionExercise`, `SetRecord`, `AppData` and the non-training types. It imports the moved types from `./training/types` (type-only) for `AppData`, `WorkoutSession` and `SessionExercise`. `domain/session.ts` stays in place.

---

### Task 1: Move training code into `domain/training`

Pure move and rename. No logic changes.

**Files:**
- Create: `src/domain/training/{index.ts,types.ts,progression.ts,planner.ts,splits/builtins.ts}`
- Move tests: `src/domain/planner.test.ts` → `src/domain/training/planner.test.ts`, `src/domain/progression.test.ts` → `src/domain/training/progression.test.ts`
- Delete: `src/domain/splits.ts`, `src/domain/planner.ts`, `src/domain/progression.ts`
- Modify (imports only): `src/domain/types.ts`, `src/domain/session.ts`, `src/domain/catalogue.test.ts`, `src/domain/flow.test.ts`, `src/domain/session.test.ts`, `src/screens/Today.tsx`, `src/screens/Workout.tsx`, `src/screens/workout/ExercisePicker.tsx`, `src/screens/SplitPicker.tsx`, `src/screens/profile/summaries.ts`, `src/screens/profile/TrainingSheet.tsx`, `src/store/app.ts`, plus every file importing a moved type from `@/domain/types` (find with `grep -rlE "\b(SplitId|SplitDef|Slot|Recommendation|Prescription|PlannedExercise|PlannedSession|RotationState)\b" src`)

**Interfaces:**
- Produces: `@/domain/training` exporting everything the old three files exported, plus the moved types. `SPLITS` is renamed `BUILT_IN_SPLITS` and is **not** exported from `index.ts` (screens get splits through the registry in Task 2; until then, export it temporarily as `BUILT_IN_SPLITS` and remove that export in Task 2).

- [ ] **Step 1:** `git mv` the three source files and two test files into place. Rename `SPLITS` to `BUILT_IN_SPLITS`. Move the eight training types into `training/types.ts`, with `SplitId` defined as `BuiltInSplitId | CustomSplitId` (`CustomSplitId = \`custom-${string}\``). Keep `program.rotation` as `Record<BuiltInSplitId, RotationState>` for now.
- [ ] **Step 2:** Write `training/index.ts` re-exporting the public names. Update every import listed above.
- [ ] **Step 3:** Run `npm run typecheck`. Expected: no errors. Run `grep -rn "domain/splits'\|domain/planner'\|domain/progression'\|'\./splits'\|'\./planner'\|'\./progression'" src` from outside `training/`. Expected: no matches.
- [ ] **Step 4:** Run `npm test`. Expected: every suite passes with only import lines changed in tests.
- [ ] **Step 5:** Commit `refactor(training): move splits, planner and progression into domain/training`.

---

### Task 2: Split registry and rotation module

**Files:**
- Create: `src/domain/training/splits/registry.ts`, `src/domain/training/rotation.ts`, `src/domain/training/registry.test.ts`, `src/domain/training/rotation.test.ts`
- Modify: `src/domain/training/types.ts`, `src/domain/types.ts` (`AppData.customSplits`, `program.rotation`), `src/domain/catalogue.ts` (`emptyAppData`), `src/domain/migrate.ts` (`normalize`), `src/domain/training/planner.ts`, `src/domain/session.ts`, `src/screens/Today.tsx`, `src/screens/SplitPicker.tsx`, `src/screens/Workout.tsx`, `src/screens/profile/summaries.ts`, `src/screens/profile/TrainingSheet.tsx`

**Interfaces:**
- Consumes: Task 1's `BUILT_IN_SPLITS`, `FINISHERS` (move it from `planner.ts` into `registry.ts`).
- Produces:
  - `CustomSplit` type exactly as in the spec's Data model. `SplitDef` gains `custom?: true`.
  - `AppData.customSplits: CustomSplit[]`; `AppData.program.rotation: Partial<Record<SplitId, RotationState>>`
  - `getSplit(data: AppData, id: SplitId): SplitDef | undefined` (built-ins, then custom including deleted)
  - `listSplits(data: AppData): { builtIn: SplitDef[]; custom: CustomSplit[] }` (custom excludes `deletedAt`, sorted by `createdAt`)
  - `findSlot(data: AppData, splitId: SplitId | null, slotId: string | null): Slot | undefined`
  - `currentRotation(data: AppData, id: SplitId): RotationState` (missing means `{ sessionIndex: 0, cycle: 1 }`)
  - `advanceRotation(data: AppData, id: SplitId): AppData` (also clears `plannedSession`, as `advance` does today)
  - `skipDay(data: AppData): AppData` (replaces `skipPlannedSession`)
  - `setSplit(data: AppData, id: SplitId): AppData` (moved from `session.ts`)
  - `restartAfterBreak(data: AppData, id: SplitId): AppData` (the tier ≥ 2 reset now inline in `ensurePlan`)
  - `clampRotation(data: AppData, id: SplitId): AppData` (sets `sessionIndex` to `min(index, days - 1)`, keeps the cycle)

- [ ] **Step 1: Write failing tests.**
  - `registry.test.ts`: `getSplit(d, 'ppl')?.name === 'Push / Pull / Legs'`; a custom split in `d.customSplits` with `deletedAt` set is returned by `getSplit` but absent from `listSplits(d).custom`; `getSplit(d, 'custom-missing')` is `undefined`; `findSlot(d, 'full-body-abc', 'f-core')?.pattern === 'core'`; `findSlot(d, null, 'x')` is `undefined`.
  - `rotation.test.ts`: `currentRotation` on an id with no entry returns `{ sessionIndex: 0, cycle: 1 }`; `advanceRotation` from the last day gives `{ sessionIndex: 0, cycle: cycle + 1 }`; `skipDay` with an active session returns the same object; `setSplit` during a workout returns the same object; `clampRotation` on a 2-day split at index 3, cycle 4 gives `{ sessionIndex: 1, cycle: 4 }`.
- [ ] **Step 2:** Run `npx vitest run src/domain/training`. Expected: FAIL, missing exports.
- [ ] **Step 3:** Implement both modules. Replace every `SPLITS[...]`, `data.program.rotation[...]` and `findSlot(splitId, slotId)` call in the files listed above with registry or rotation calls. `emptyAppData` sets `customSplits: []`. `normalize` sets `customSplits: doc.customSplits ?? []`. Remove `BUILT_IN_SPLITS` from `index.ts`.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: all pass. Run `grep -rn "BUILT_IN_SPLITS\|program.rotation\[" src --include=*.ts --include=*.tsx | grep -v "src/domain/training/"`. Expected: no matches.
- [ ] **Step 5:** Commit `refactor(training): one split registry and one rotation module`.

---

### Task 3: `prescribe` as the single source of an exercise's targets

**Files:**
- Create: `src/domain/training/prescribe.ts`, `src/domain/training/prescribe.test.ts`
- Modify: `src/domain/training/planner.ts` (`plannedExercise`, move `prescription` out), `src/domain/session.ts` (`addExercise`, `swapExercise`, `applyProfileToActive`, `startSession`; delete local `setsFrom`)

**Interfaces:**
- Produces:
  - `prescription(profile: Pick<Profile, 'objective' | 'experience'>, role: Slot['role'], ex: Exercise | undefined): Prescription` (moved unchanged)
  - `setsFrom(rec: Recommendation, count: number, repMin: number): SetRecord[]` (moved unchanged)
  - `prescribe(data: AppData, exerciseId: string, role: Slot['role'], now?: string): { exerciseId: string; plan: Prescription; rec: Recommendation; sets: SetRecord[] }`. When the exercise is missing, `exerciseId` is `''` and `rec` is the existing "No option for your equipment. Pick one." recommendation.

- [ ] **Step 1: Write failing tests** in `prescribe.test.ts`, before touching the call sites. Capture current behaviour on a fixture built from `emptyAppData(NOW)` plus three finished sessions of `bench-press` and `db-lateral-raise`:
  - `prescribe(d, 'bench-press', 'anchor', NOW)` deep-equals `{ exerciseId, plan, rec, sets }` built from the current `plannedExercise(d, slot, 'bench-press', NOW)` and the current `setsFrom` (copy the expected literal from a run of the old code, then hard-code it).
  - The same for `'accessory'` with `db-lateral-raise`, and for a session started 15 days after the last one (return tier eases sets).
  - `prescribe(d, 'nope', 'anchor').exerciseId === ''` and `.rec.reason === 'No option for your equipment. Pick one.'`.
- [ ] **Step 2:** Run `npx vitest run src/domain/training/prescribe.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `prescribe.ts`, then rewrite the four call sites to use it. `swapExercise` uses the slot's role when `findSlot` finds a slot and `'accessory'` otherwise. `addExercise` uses `'accessory'`.
- [ ] **Step 4:** Run `npm test`. Expected: all pass, including the unchanged `session.test.ts` and `planner.test.ts`. Run `grep -rn "recommend(\|easedSets(\|prescription(" src --include=*.ts --include=*.tsx | grep -v "src/domain/training/"`. Expected: no matches.
- [ ] **Step 5:** Run `npm run typecheck`, then start `npm run dev -- --port 5199` and run `npm run e2e`. Expected: all `PASS`.
- [ ] **Step 6:** Commit `refactor(training): prescribe() is the single source of exercise targets`.

---

### Task 4: Custom split create, save, delete and normalize

**Files:**
- Create: `src/domain/training/splits/custom.ts`, `src/domain/training/custom.test.ts`
- Modify: `src/domain/migrate.ts` (orphaned custom `splitId`), `src/domain/training/index.ts`

**Interfaces:**
- Consumes: `getSplit`, `clampRotation` (Task 2).
- Produces:
  - `newCustomSplit(data: AppData, from: SplitId | null, now: string, id?: CustomSplitId): { split: CustomSplit }`. Returns a draft; it does **not** store it (the spec's "stored only on first Save").
  - `validateSplit(split: SplitDef): string | null`. It returns the first failing rule's message or `null`. Messages: `'Give your split a name'`, `'A split needs 1 to 7 days'`, `'Give every day a name'`, `'Give every day at least one exercise'`, `'Keep each day to 12 exercises or fewer'`.
  - `splitBlurb(split: SplitDef): string`, for example `'4 days · Push / Pull / Legs / Arms'` (uses `short ?? title`; `'1 day · …'` for one day).
  - `saveCustomSplit(data: AppData, split: CustomSplit, now: string): AppData`. It inserts or replaces by id, sets `updatedAt` and `blurb`, and clamps that split's rotation. When the split is active and there's no `activeSession`, it sets `plannedSession: null`. It returns `data` unchanged when `validateSplit` fails.
  - `deleteCustomSplit(data: AppData, id: CustomSplitId, now: string): AppData`. It sets `deletedAt`. When the split is active: with an `activeSession` it returns `data` unchanged; otherwise `splitId: null` and `plannedSession: null`.
  - `newSlotId(): string` → `'cs-' + 8 random [a-z0-9]`.

- [ ] **Step 1: Write failing tests** in `custom.test.ts`:
  - For each built-in id: the copy has the same day count, titles, `short`, slot roles, patterns and candidates; every slot id matches `/^cs-[a-z0-9]{8}$/` and differs from the source; `name === 'My ' + source.name`; `copiedFrom === source id`; `custom === true`.
  - Blank: `name === 'My split'`, one day titled `'Day 1'`, no slots.
  - `validateSplit` returns each message above for: an empty name, 0 days, 8 days, a day with title `'  '`, a day with no slots, a day with 13 slots; and `null` for a valid copy.
  - `saveCustomSplit` stores the split, sets `blurb`, and on a second save replaces it (length stays 1).
  - Active custom split at `{ sessionIndex: 2, cycle: 3 }`, saved with 2 days: rotation becomes `{ sessionIndex: 1, cycle: 3 }` and `plannedSession` is `null`.
  - **Review Focus 1:** the same, but with an `activeSession` started from that split. `activeSession` is unchanged after save. Then `finishSession(saved, NOW)` adds one entry to `sessions` and `currentRotation(...).sessionIndex < 2`.
  - **Review Focus 5:** an inactive custom split saved with fewer days clamps its own rotation; `plannedSession` of the active built-in split stays the same object.
  - Delete: `listSplits(d).custom` no longer contains it; the active one sets `splitId` to `null`; with an `activeSession` it returns the same object.
  - **Review Focus 4:** `normalize` on a v4 doc without `customSplits` gives `[]`; on a doc whose `program.splitId` is `'custom-gone'` gives `splitId: null` and `plannedSession: null`; on a doc with a custom split and no rotation entry, `currentRotation` gives `{ sessionIndex: 0, cycle: 1 }`.
- [ ] **Step 2:** Run `npx vitest run src/domain/training/custom.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Copy with `structuredClone` and then reassign slot ids.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `feat(training): create, save and delete custom splits`.

---

### Task 5: Planner support for custom splits

**Files:**
- Modify: `src/domain/training/planner.ts` (`buildPlan`)
- Test: `src/domain/training/planner.test.ts` (new `describe('custom splits')`)

**Interfaces:**
- Consumes: `getSplit`, `currentRotation`, `prescribe`, `saveCustomSplit`.
- Produces: no new exports. `buildPlan` skips `FINISHERS` and the trim when `split.custom`. When `getSplit` returns `undefined`, `ensurePlan` returns the data with `plannedSession: null`.

- [ ] **Step 1: Write failing tests:**
  - A saved custom day with 9 eligible exercises and `sessionMinutes: 45` plans all 9, in order, and no exercise id comes from `FINISHERS` unless it was on the day.
  - A day with one Main and one Extra with alternates `[a, b, c]`: across cycles 1, 2 and 3, the Main id stays the same, and the Extra is `a`, `b`, `c`.
  - **Review Focus 3:** an Extra whose first candidate is a custom exercise that is then archived plans its alternate; one whose only candidate is a custom exercise removed from `customExercises` plans `exerciseId: ''` with reason `'No option for your equipment. Pick one.'`.
  - Built-in splits: the existing `buildPlan` tests stay unchanged and passing.
- [ ] **Step 2:** Run `npx vitest run src/domain/training/planner.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `feat(training): plan custom splits exactly as built`.

---

### Task 6: Day suggestions and the session-length guide

**Files:**
- Create: `src/domain/training/splits/suggest.ts`, `src/domain/training/suggest.test.ts`

**Interfaces:**
- Consumes: `isEligible`, `MAX_EXERCISES` (export it from `planner.ts`), `newSlotId`, the planner's beginner ordering (export `BEGINNER_ORDER` from `planner.ts`).
- Produces:
  - `type DayFocus = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'arms-shoulders'`
  - `FOCUS_LABEL: Record<DayFocus, string>` (`'Full body' | 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Arms & shoulders'`)
  - `FOCUS_PATTERNS: Record<DayFocus, Pattern[]>`, copied exactly from the spec's table
  - `suggestDay(data: AppData, focus: DayFocus, existing?: string[]): Slot[]`
  - `dayGuide(profile: Pick<Profile, 'sessionMinutes'>, count: number): { limit: number; over: boolean; text: string }`, where `text` is one of the two guide strings in Global Constraints

- [ ] **Step 1: Write failing tests:**
  - For every focus with the default profile and all equipment: length equals `MAX_EXERCISES[sessionMinutes]` for 45, 60, 75 and 90; every candidate passes `isEligible`; no exercise id repeats across `candidates[0]` and alternates.
  - The first 2 slots are `anchor` (3 for `full` and `lower`); the rest are `accessory`; anchors have exactly one candidate; accessories have at most 3 (one plus up to two alternates).
  - A beginner with all equipment gets a machine or dumbbell exercise as `candidates[0]` of the first `knee` slot.
  - Equipment `['bodyweight']` only: every candidate has `equipment === 'bodyweight'`, and patterns with no eligible exercise are skipped (length can be under the limit).
  - `existing: ['bench-press']` on `push` never suggests `bench-press`.
  - `dayGuide({ sessionMinutes: 60 }, 6)` gives `{ limit: 6, over: false, text: '6 exercises · about right for 60 min' }`; `dayGuide({ sessionMinutes: 60 }, 8).text === '8 exercises · more than the 6 that usually fit 60 min'`.
- [ ] **Step 2:** Run `npx vitest run src/domain/training/suggest.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as the spec's `suggestDay` rule. Repeat the pattern list from the start until the limit is reached, or until a full pass adds nothing.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `feat(training): day suggestions by focus and session-length guide`.

---

### Task 7: Draft edit helpers and the draft store

**Files:**
- Create: `src/domain/training/splits/edit.ts`, `src/domain/training/edit.test.ts`, `src/store/splitDraft.ts`

**Interfaces:**
- Consumes: `newSlotId`, `suggestDay`.
- Produces (all pure, `(split: CustomSplit, ...) => CustomSplit`, returning the same object when the edit is refused):
  - `addDay(split)` (refused at 7; new title `Day <n>`), `removeDay(split, day)` (refused on the last day), `moveDay(split, from, to)`, `renameDay(split, day, title)`
  - `addEntry(split, day, exerciseId, role = 'accessory')`, refused at 12 or when the id is already on that day as a main exercise or an alternate
  - `removeEntry(split, day, slotIdx)`, `moveEntry(split, day, from, to)`
  - `setRole(split, day, slotIdx, role)`. Setting `'anchor'` drops alternates.
  - `addAlternate(split, day, slotIdx, exerciseId)`, refused on an anchor, when the day already has the id, or past 2 alternates
  - `removeAlternate(split, day, slotIdx, exerciseId)`
  - `fillDay(split, day, slots: Slot[])`, which replaces an empty day's slots
  - `useSplitDraft` (Zustand, not persisted): `{ draft: CustomSplit | null; dirty: boolean; focus: Record<number, DayFocus>; open(split: CustomSplit): void; edit(fn: (s: CustomSplit) => CustomSplit): void; setFocus(day: number, f: DayFocus): void; close(): void }`. `edit` sets `dirty` only when `fn` returns a new object.

- [ ] **Step 1: Write failing tests** in `edit.test.ts`:
  - Each refusal above returns the identical object (`toBe`).
  - **Review Focus 2:** `addEntry` of an id already present as a main exercise, and of one present as an alternate, is refused. `addAlternate` of an id that is the day's main exercise is refused.
  - `addEntry` creates `{ id: /^cs-/, role, pattern: <exercise pattern>, candidates: [id] }`.
  - `setRole(…, 'anchor')` on a slot with alternates leaves `candidates.length === 1`.
  - `moveDay(split, 0, 2)` reorders titles and keeps slot ids.
- [ ] **Step 2:** Run `npx vitest run src/domain/training/edit.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the helpers, then the store. The store is UI state, so it lives under `src/store/` and never holds server data.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: all pass.
- [ ] **Step 5:** Commit `feat(training): pure split edits and the draft store`.

---

### Task 8: Split sheet with "Your splits" and the new-split sheet

**Files:**
- Create: `src/screens/splits/SplitSheet.tsx`, `src/screens/splits/NewSplitSheet.tsx`
- Delete: `src/screens/SplitPicker.tsx` (move `SplitChooser` and `SplitSheet` into `splits/SplitSheet.tsx`)
- Modify: `src/App.tsx` (`Sheets`: register `split-new`; update the `SplitSheet` import), `src/screens/Today.tsx` (`SplitChooser` import)

**Interfaces:**
- Consumes: `listSplits`, `getSplit`, `currentRotation`, `setSplit`, `newCustomSplit`, `deleteCustomSplit`, `useSplitDraft.open`.
- Produces: routes `split-new` and `split-edit:<id>` (the second is opened here and rendered in Task 9).

- [ ] **Step 1:** Build `SplitChooser`: the built-in cards exactly as today; then, when `listSplits(data).custom` is non-empty, a "Your splits" heading and one card per custom split with a `menu.tsx` menu (Edit, Duplicate, Delete); then a "Build your own" button opening `split-new`. Switching keeps today's confirm dialog, using `getSplit` and `currentRotation`.
- [ ] **Step 2:** Edit calls `useSplitDraft.open(split)` and then `openSheet('split-edit:' + id)`. Duplicate calls `newCustomSplit(data, id, now)` and opens the result the same way. Delete asks `confirm({ title: 'Delete <name>?', message: 'Your workout history stays.', confirmLabel: 'Delete' })` and then calls `act(d => deleteCustomSplit(d, id, now))`. During a workout, it shows the toast "Finish or discard your workout first" instead.
- [ ] **Step 3:** `NewSplitSheet` titled "Start from": rows for each built-in split, each custom split, and "Blank". A tap calls `newCustomSplit`, `open`, then `openSheet('split-edit:' + split.id, { replace: true })`.
- [ ] **Step 4:** Run `npm run typecheck`. Start the dev server and check in the browser: the cards render, "Build your own" opens "Start from", and an existing user with no custom splits sees no "Your splits" heading.
- [ ] **Step 5:** Commit `feat(splits): your splits list and start-from sheet`.

---

### Task 9: Split editor and day editor sheets

**Files:**
- Create: `src/screens/splits/SplitEditorSheet.tsx`, `src/screens/splits/DayEditorSheet.tsx`
- Modify: `src/App.tsx` (`Sheets`: parse `split-day:<id>:<n>` by splitting the sheet string on `:` into three parts, and register both sheets), `src/screens/workout/ExercisePicker.tsx` (accept an optional `exclude?: string[]` and `pattern?: Pattern` filter)

**Interfaces:**
- Consumes: `useSplitDraft`, the Task 7 edit helpers, `validateSplit`, `saveCustomSplit`, `suggestDay`, `FOCUS_LABEL`, `dayGuide`, `isEligible`, `getExercise`.

- [ ] **Step 1: `SplitEditorSheet`** (`split-edit:<id>`): a name field, day rows ("<title>" and "<n> exercises", up/down, a menu with Delete hidden on the last day), "Add day" (hidden at 7), and a primary **Save** button. Save runs `validateSplit`; on an error it shows the message as a toast. On success it calls `act(d => saveCustomSplit(d, draft, now))`, then `close()`, then goes back to the split sheet with the toast "<name> saved". When the draft is gone (for example after a reload), the sheet closes itself.
- [ ] **Step 2:** Closing with `dirty` asks `confirm({ title: 'Discard changes?', confirmLabel: 'Discard' })`.
- [ ] **Step 3: `DayEditorSheet`** (`split-day:<id>:<n>`): a day-name field; one row per slot with the name, `Segmented` Main/Extra, up/down and remove; under Extras an alternates line with chips and a "+" that opens `ExercisePicker` filtered to the slot's pattern with the day's ids excluded. "Add exercise" opens `ExercisePicker` with `suggested` set to `suggestDay(data, focus[n], dayIds)` mapped to exercises when a focus is set, and otherwise to eligible exercises for the patterns on the day. An ineligible exercise shows the tag "Not available with your equipment". The guide line uses `dayGuide`.
- [ ] **Step 4:** With no slots, the day shows "No exercises yet. Fill this day or add one." and a **Fill this day** button. That opens a list of the seven `FOCUS_LABEL`s; a pick runs `setFocus` and `edit(s => fillDay(s, n, suggestDay(data, f)))`.
- [ ] **Step 5:** Run `npm run typecheck`. In the browser, copy PPL, rename Push to "Chest day", add an alternate to an Extra, check that a duplicate add is refused, save, switch to the split, and check that Today shows "Chest day" with the exercises in order.
- [ ] **Step 6:** Commit `feat(splits): split and day editors`.

---

### Task 10: Acceptance flow and release

**Files:**
- Modify: `e2e/acceptance.mjs`, `package.json` (version `4.5.0`), `next.md` (mark the custom split builder as shipped)

- [ ] **Step 1:** Append to `e2e/acceptance.mjs`, after the existing walk-through, using its helpers (`click`, `typeInto`, `openRow`, `text`, `check`, `dumpState`, `finish`): open the split sheet, Build your own, pick "Push / Pull / Legs", open day 1, rename it "Chest day", add "Cable fly" if it isn't present, Save, switch to "My Push / Pull / Legs", and check that Today's text contains "Chest day". Start and finish the workout, then check that the stored rotation for the custom id is `{ sessionIndex: 1, cycle: 1 }`. Extend `dumpState` to include `customSplits.length` and the active split's rotation.
- [ ] **Step 2:** Run `npm run dev -- --port 5199` in the background, then `npm run e2e`. Expected: every line `PASS`, and no `pageerror` or console errors.
- [ ] **Step 3:** Run `npm test`, `npm run typecheck` and `npm run build`. Expected: all succeed.
- [ ] **Step 4:** Commit `test(e2e): custom split acceptance flow`. Then bump `package.json` to `4.5.0`, update `next.md`, and commit `chore: Repwise 4.5.0` (same shape as `0d44d7a`).
