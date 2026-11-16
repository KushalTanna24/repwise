# Onboarding and Plan Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-launch onboarding that asks about body, goal, schedule and focus muscles, then builds an evidence-based custom split plus a calorie and protein estimate.

**Architecture:** A new pure domain module `src/domain/plan/` (body maths, volume targets, day templates, a greedy slot generator, why lines) produces an ordinary `CustomSplit` that is saved through the existing `saveCustomSplit` and `setSplit`. A full-screen onboarding flow in `src/screens/onboarding/` collects answers into a non-persisted Zustand draft and commits them in one `act()`. `App.tsx` shows the flow instead of the tabs while `needsOnboarding(data)` is true.

**Tech Stack:** React 18, TypeScript, Zustand, motion, dayjs, Tailwind and the project's own `components/ui`, Vitest, puppeteer e2e.

**Spec:** `docs/superpowers/specs/2026-11-11-onboarding-plan-design.md`

## Global Constraints

- Copy rules: sentence case, no exclamation marks, words a gym user says ("sets a week", not "weekly volume").
- Every energy view shows the footnote exactly: `Estimate, not medical advice.`
- `schemaVersion` stays 4. All new `Profile` fields are optional.
- Screens import only from `@/domain/plan` (its `index.ts`) and `@/domain/training`.
- Domain functions are pure and deterministic: no `Date.now()`, no `Math.random()`. Pass `now`. Slot ids come from `newSlotId()`, so tests compare slot content, not ids.
- Motion only explains a step change, and honours `useReducedMotion()`.
- The generator never picks exercises with `calisthenics: true`. They are skill work that needs coaching.
- Height 100 to 250 cm. Weight 30 to 300 kg. Age 13 to 100. Calories 800 to 6000.
- Release: bump `package.json` to `4.6.0` and add a "shipped in 4.6.0" entry to `next.md` in the last task.

## Review Focus

1. **Tight budget** (2 days × 45 min = 30 sets for 10 groups): the floor of 6 sets per group cannot be met. Expect no crash, focus groups still served first, and a why line naming the groups below 6 sets. Test in Task 4.
2. **Bodyweight-only equipment:** groups with no eligible exercise (for example calves) are skipped. Expect a saved split, no empty day, and a "Limited equipment" why line. Test in Task 4.
3. **Returning cloud user on a fresh device:** data is empty until sync. Expect onboarding to disappear as soon as synced data with sessions arrives, even without `onboardedAt`. Test in Task 1 through the `needsOnboarding` cases.
4. **Sex or age skipped:** expect protein to still show, the calorie card hidden, and no `NaN` anywhere. Test in Task 2.
5. **Rerun from Profile while a workout is active:** expect the new split to be saved but not activated, with a toast saying it will apply after the workout. This matches `deleteCustomSplit`'s active-session guard. Test in Task 5 (`commitPlan`).

---

### Task 1: Profile fields, onboarding gate, normalize

**Files:**
- Modify: `src/domain/types.ts` (Profile)
- Modify: `src/domain/migrate.ts` (`normalize`)
- Create: `src/domain/plan/gate.ts`
- Test: `src/domain/plan/gate.test.ts`, `src/domain/migrate.test.ts`

**Interfaces:**
- Produces in `types.ts`:
  - `type FocusArea = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'abs'`
  - `type Activity = 'sitting' | 'feet' | 'physical'`
  - `type BodyGoal = 'lose' | 'maintain' | 'gain'`
  - `Profile` gains `sex?: 'male' | 'female'`, `birthYear?: number`, `activity?: Activity`, `intakeKcal?: number`, `bodyGoal?: BodyGoal`, `focus?: FocusArea[]`, `onboardedAt?: string`.
- Produces in `gate.ts`: `needsOnboarding(data: AppData): boolean`, true only when `!profile.onboardedAt && isEmpty(data) && !program.splitId && customSplits.length === 0`.

- [ ] **Step 1: Write failing tests.**
  - `gate.test.ts`:
    - `emptyAppData(NOW)` needs onboarding.
    - It stops needing onboarding when any one of these is true: `onboardedAt` set, one session, one bodyweight, `splitId: 'ppl'`, one custom split.
  - `migrate.test.ts`:
    - `normalize` of a v4 doc with one session and no `onboardedAt` returns `profile.onboardedAt === doc.meta.updatedAt`.
    - A doc with `splitId: 'ppl'` and no sessions also gets it.
    - An empty v4 doc stays without `onboardedAt`.
    - An existing `onboardedAt` is never overwritten.
- [ ] **Step 2:** `npx vitest run src/domain/plan/gate.test.ts src/domain/migrate.test.ts`. Expect FAIL (module missing, field undefined).
- [ ] **Step 3:** Add the types. Implement `needsOnboarding` (reuses `isEmpty` from `migrate.ts`). In `normalize`'s v4 branch, set `profile.onboardedAt = doc.meta.updatedAt` when it is missing and the doc is not empty or has a split. `migrateV2` output gets `onboardedAt: now`, because a v2 user is an existing user.
- [ ] **Step 4:** Run the same command. Expect PASS. Then `npm run typecheck` is clean.
- [ ] **Step 5:** Commit `feat(plan): profile fields and onboarding gate`.

### Task 2: Body maths

**Files:**
- Create: `src/domain/plan/body.ts`
- Test: `src/domain/plan/body.test.ts`

**Interfaces:**
- Consumes: `bmi()` from `domain/stats`, Task 1 types.
- Produces:
  - `type BmiBand = 'under' | 'healthy' | 'over' | 'obese'`
  - `bmiBand(bmi: number): BmiBand` with cut points 18.5, 25 and 30, lower bound inclusive.
  - `bmr(sex: 'male' | 'female', kg: number, cm: number, age: number): number`
  - `activityFactor(activity: Activity, daysPerWeek: number): number`
  - `proteinGrams(kg: number, cm: number, goal: BodyGoal): number`
  - `interface Energy { tdee: number; target: number; proteinG: number; intake?: { kcal: number; delta: number; label: 'below' | 'about' | 'above' }; note?: string }`
  - `energy(p: Profile, kg: number, nowYear: number): { proteinG: number; energy: Energy | null }`
  - `suggestedGoal(band: BmiBand): 'lose' | 'build' | null`

- [ ] **Step 1: Write failing tests.**
  - `bmr('male', 80, 180, 30) === 1780` and `bmr('female', 60, 165, 30) === 1320.25`.
  - `activityFactor('sitting', 2) === 1.2`, `('sitting', 3) === 1.375`, `('feet', 4) === 1.55`, `('physical', 6) === 1.725` (capped).
  - Male, 80 kg, 180 cm, age 30, sitting, 4 days, goal `lose`:
    - `tdee === Math.round(1780 * 1.375)`
    - `target` = `tdee * 0.8` rounded to 50
    - `proteinG === Math.round(80 * 2.0)`
  - Goal `gain` gives `target` = `tdee * 1.1` rounded to 50. Goal `maintain` gives `target === round50(tdee)`.
  - Floors:
    - Female, 45 kg, 150 cm, age 60, sitting, 2 days, lose: `target === 1200`.
    - The male equivalent: `target === 1500`.
  - Guards: age 16 with goal lose, and BMI 17.5 with goal lose, both give `target === round50(tdee)` and a non-empty `note`.
  - Protein when BMI > 30: 120 kg at 170 cm, maintain gives `proteinG === Math.round(25 * 1.7 * 1.7 * 1.6)` (73 kg × 1.6 = 116).
  - Skipped sex or age: `energy` returns `energy === null` with `proteinG > 0` and no `NaN`.
  - Intake 2000 against tdee 2448 (`Math.round(1780 * 1.375)`) gives label `below`, `delta === -448`. Intake within ±10% gives `about`.
  - `suggestedGoal`: `over` and `obese` give `'lose'`, `under` gives `'build'`, `healthy` gives `null`.
- [ ] **Step 2:** `npx vitest run src/domain/plan/body.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement with the spec's values:
  - BMR: `10kg + 6.25cm − 5age + (male 5 | female −161)`.
  - Activity base: 1.2 / 1.375 / 1.55, plus 0.175 when days ≥ 3, capped at 1.725.
  - Protein: 1.6 g/kg, or 2.0 when goal is `lose`. Use the BMI 25 weight when BMI > 30.
  - Age is `nowYear − birthYear`.
  - `note` copy for the under-18 guard: `Under 18: eat to maintain and let training do the work.` For the underweight guard: `Your BMI is low, so the target stays at maintenance.`
- [ ] **Step 4:** Run again. Expect PASS.
- [ ] **Step 5:** Commit `feat(plan): calorie and protein estimates`.

### Task 3: Volume groups and weekly targets

**Files:**
- Create: `src/domain/plan/volume.ts`
- Test: `src/domain/plan/volume.test.ts`

**Interfaces:**
- Consumes: `exerciseMuscles` from `domain/muscles`, `prescription` and `MAX_EXERCISES` from `domain/training`.
- Produces:
  - `type Group = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs'`
  - `GROUPS: Group[]` in that order.
  - `MAJOR: Set<Group>` = chest, back, shoulders, quads, hamstrings, glutes.
  - `FOCUS_GROUPS: Record<FocusArea, Group[]>` per the spec.
  - `MUSCLE_GROUP: Partial<Record<Muscle, Group>>`: lats and traps to back, obliques to abs. Rear-delts, lower-back and forearms are unmapped.
  - `exerciseGroups(ex: Exercise): Partial<Record<Group, number>>`: primary 1, secondary 0.5, summing the maximum per group (lats + traps both primary still gives back = 1).
  - `focusGroups(focus: FocusArea[]): Set<Group>`
  - `setsPerExercise(p: Pick<Profile, 'objective' | 'experience'>): number`: `prescription(p, 'accessory', undefined).sets`.
  - `weeklyBudget(p: Profile): number`: `daysPerWeek × MAX_EXERCISES[sessionMinutes] × setsPerExercise`.
  - `FLOOR = 6`
  - `interface Targets { sets: Record<Group, number>; focus: Set<Group>; budget: number }`
  - `weeklyTargets(p: Profile): Targets`

- [ ] **Step 1: Write failing tests.**
  - Intermediate, no focus, large budget (6 days, 90 min): majors 12, minors 10.
  - Beginner: majors 10, minors 8. Advanced: majors 14, minors 12.
  - Focus `['chest']`, intermediate: chest 18. `bodyGoal: 'lose'`: chest 15. Advanced with focus chest: 20 (capped). Beginner: 14 (cap).
  - Focus `['arms']` raises both biceps and triceps.
  - Budget fitting, intermediate, 3 days × 45 min (45 sets), focus chest:
    - sum of targets ≤ 45
    - every non-focus group ≥ FLOOR
    - chest ≥ 12
    - non-focus groups reduced largest-first (no non-focus group is more than 1 above another non-focus group of a lower base)
  - When `sum(FLOOR × 10) + focus bases > budget`: focus groups keep their base, non-focus sit at FLOOR, and the sum may exceed budget (the generator reports the shortfall).
  - `exerciseGroups(bench-press)` = `{ chest: 1, shoulders: 0.5, triceps: 0.5 }`. `exerciseGroups(romanian-deadlift)` = `{ hamstrings: 1, glutes: 1 }` (lower-back and forearms are unmapped).
- [ ] **Step 2:** `npx vitest run src/domain/plan/volume.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `weeklyTargets`:
  - Base: majors by experience 10 / 12 / 14, minors 2 less.
  - Focus: `round(base × (bodyGoal === 'lose' ? 1.25 : 1.5))`, capped at 20 (beginner 14).
  - Fit: while sum > budget, take one set from the non-focus group with the most sets above FLOOR (ties go to the later group in `GROUPS`). Then from focus groups above their base, the same way. Stop when nothing can be reduced.
- [ ] **Step 4:** Run again. Expect PASS.
- [ ] **Step 5:** Commit `feat(plan): weekly set targets per muscle group`.

### Task 4: Templates and the split generator

**Files:**
- Create: `src/domain/plan/template.ts`, `src/domain/plan/generate.ts`
- Test: `src/domain/plan/generate.test.ts`

**Interfaces:**
- Consumes: Task 3 exports, `allExercises`, `getExercise`, `isEligible`, `BEGINNER_ORDER`, `MAX_EXERCISES`, `prescription`, `newSlotId`, and the `Slot` / `CustomSplit` types.
- Produces in `template.ts`:
  - `type TemplateId = 'full-2' | 'full-3' | 'ul-full' | 'ul-4' | 'ppl-abs' | 'ulppl' | 'ppl-ul' | 'ppl-6'`
  - `type DayKind = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'abs-focus'`
  - `interface Template { id: TemplateId; name: string; days: { title: string; kind: DayKind }[] }`
  - `TEMPLATES: Record<TemplateId, Template>`
  - `templateFor(days: number): TemplateId`: 2 gives full-2, 3 full-3, 4 ul-4, 5 ulppl, 6 ppl-6.
  - `alternativesFor(days: number): TemplateId[]`: 3 gives `['ul-full']`, 4 gives `['ppl-abs']`, 5 gives `['ppl-ul']`, others `[]`.
  - `DAY_GROUPS: Record<DayKind, Group[]>` per the table below. `abs-focus` resolves at runtime as abs + focus groups, or abs + shoulders, biceps and triceps when there is no focus.

| Kind | Groups |
|---|---|
| full | all 10 |
| upper | chest, back, shoulders, biceps, triceps, abs |
| lower | quads, hamstrings, glutes, calves, abs |
| push | chest, shoulders, triceps, abs |
| pull | back, biceps, abs |
| legs | quads, hamstrings, glutes, calves, abs |

  Template names:

  | Id | Name |
  |---|---|
  | full-2, full-3 | Full Body |
  | ul-full | Upper / Lower / Full |
  | ul-4 | Upper / Lower |
  | ppl-abs | PPL + Abs & focus |
  | ulppl | Upper / Lower + PPL |
  | ppl-ul | PPL + Upper / Lower |
  | ppl-6 | Push / Pull / Legs |

  Day titles: Full Body A/B/C, Upper, Lower, Push, Pull, Legs, "Abs & focus". `ul-full` is Upper / Lower / Full Body. `ppl-abs` is Push / Pull / Legs / Abs & focus. `ppl-ul` is Push / Pull / Legs / Upper / Lower.

- Produces in `generate.ts`:
  - `interface PlanResult { split: CustomSplit; template: TemplateId; targets: Targets; achieved: Record<Group, number>; daysHit: Record<Group, number>; short: Group[]; limited: Group[] }`
  - `generatePlan(data: AppData, template: TemplateId, now: string): PlanResult`, reading the profile already in `data`.

- [ ] **Step 1: Write failing tests** in `generate.test.ts`. Build `data` from `emptyAppData` with a profile override. Loop over days 2–6 × experience (3) × minutes (4) × focus sets `[[], ['chest'], ['arms'], ['legs'], ['glutes'], ['abs'], ['back', 'shoulders'], ['chest', 'arms', 'abs']]`. For each:
  - `validateSplit(result.split) === null`. Day count equals the template's days. Every day has between 1 and `MAX_EXERCISES` slots. No exercise id repeats within a day.
  - No candidate is a `calisthenics` exercise. Every candidate passes `isEligible`.
  - For every day and group, primary sets on that day ≤ 8 (beginner 6).
  - When `budget >= targets` sum: every group's `achieved >= targets.sets[g] − setsPerExercise`, every group's `daysHit >= 2` (days ≥ 2), and `short` is empty.
  - Every focus group's `achieved` ≥ every non-focus group of the same class (major or minor) minus `setsPerExercise`.
  - Order within each day: core (`pattern === 'core'`) slots come last. Anchors come before accessories.
  - Determinism: two calls produce the same `split.sessions` with slot ids stripped.
  - Review Focus 1: intermediate, 2 days, 45 min, focus chest. No throw. `short` is non-empty and excludes chest.
  - Review Focus 2: equipment `['bodyweight']`. No throw, `limited` includes `calves`, no empty day.
- [ ] **Step 2:** `npx vitest run src/domain/plan/generate.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `generatePlan` with this greedy algorithm (deterministic, no randomness except `newSlotId`):

```
targets = weeklyTargets(profile); spe = setsPerExercise(profile); cap = beginner ? 6 : 8
days = TEMPLATES[t].days, each with allowed groups and an empty slot list; limit = MAX_EXERCISES[sessionMinutes]
pool = allExercises(data).filter(e => isEligible(e, data) && !e.calisthenics)
achieved[g] = 0; dayDirect[d][g] = 0
loop:
  candidates = for each day d with slots < limit, for each allowed group g on d
               where dayDirect[d][g] + spe <= cap and achieved[g] < targets[g]:
                 need = (targets[g] - achieved[g]) / targets[g]
  if none: break
  choose max by (need + (focus has g ? 0.25 : 0)), then fewest dayDirect[d][g], then earliest day, then GROUPS order
  ex = best exercise in pool whose exerciseGroups(ex)[g] === 1 and not already on day d:
       prefer compound (pattern not in shoulders/arms/calves/core) when the day has no slot for g yet,
       else isolation first; then least used this week; then beginner BEGINNER_ORDER; then catalogue order
  if no ex: mark (d,g) exhausted; if g has no eligible exercise anywhere add g to limited; continue
  sets = prescription(profile, role, ex).sets, where role = anchor if compound and first slot for g on d, else accessory
  add slot { id: newSlotId(), pattern: ex.pattern, role, candidates: [ex.id, ...up to 2 same-pattern alternates for accessories] }
  for each [h, w] of exerciseGroups(ex): achieved[h] += sets*w; if w === 1: dayDirect[d][h] += sets
order each day: rank 0 compound+focus, 1 compound, 2 isolation+focus, 3 isolation, 4 core; stable
daysHit[g] = days with any slot touching g; short = groups with achieved < FLOOR (not in limited)
split = newCustomSplit(data, null, now).split with name `Your plan · ${template.name}` and these sessions
```

  Alternates must pass the same filter, must not be used elsewhere on that day, and must not be calisthenics.
- [ ] **Step 4:** Run again. Expect PASS. Run `npm test` and confirm nothing else broke.
- [ ] **Step 5:** Commit `feat(plan): split generator from weekly targets`.

### Task 5: Why lines, answers and commit

**Files:**
- Create: `src/domain/plan/explain.ts`, `src/domain/plan/answers.ts`, `src/domain/plan/index.ts`
- Test: `src/domain/plan/answers.test.ts`, `src/domain/plan/explain.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `type Goal = 'lose' | 'build' | 'strength' | 'fit'`
  - `interface PlanAnswers { heightCm: number; weightKg: number; sex?: 'male' | 'female'; age?: number; goal: Goal; activity: Activity; intakeKcal?: number; experience: Profile['experience']; daysPerWeek: number; sessionMinutes: Profile['sessionMinutes']; equipment: EquipmentKind[]; focus: FocusArea[] }`
  - `applyAnswers(data: AppData, a: PlanAnswers, now: string): AppData`. Sets the profile:
    - objective: lose and build map to hypertrophy, strength to strength, fit to general.
    - bodyGoal: lose to `lose`, build to `gain`, others to `maintain`.
    - `birthYear = year(now) − age`.
    - activity, intake, focus, experience, days, minutes, equipment and height.
    - `onboardedAt = now`.

    Also upserts today's weigh-in `{ id: crypto.randomUUID(), date: localDate(now), kg }`, replacing any entry for the same date.
  - `explain(r: PlanResult, p: Profile, bmiValue: number | null): string[]`, at most 6 lines.
  - `commitPlan(data: AppData, split: CustomSplit, now: string): { data: AppData; activated: boolean }`: `saveCustomSplit`, then `setSplit` only when there is no `activeSession`.
  - `skipOnboarding(data: AppData, now: string): AppData`: sets `onboardedAt`.
  - `index.ts` re-exports `needsOnboarding`, `energy`, `bmiBand`, `suggestedGoal`, `generatePlan`, `templateFor`, `alternativesFor`, `TEMPLATES`, `applyAnswers`, `commitPlan`, `skipOnboarding`, `explain`, `FOCUS_GROUPS` and the types.

- [ ] **Step 1: Write failing tests.**
  - `applyAnswers` maps every goal correctly. `birthYear` for age 30 at `2026-11-11` is 1996. A same-day weigh-in is replaced, not duplicated. `needsOnboarding` is false afterwards.
  - `commitPlan` with no active session: `data.program.splitId === split.id`, `activated === true`. With an active session (Review Focus 5): the split is in `customSplits`, `splitId` is unchanged, `activated === false`.
  - `explain`:
    - Focus chest gives a first line matching `/^Chest: \d+ sets a week across \d days \(focus\)\.$/`.
    - Abs focus with BMI 27 includes `Abs show when body fat is low. Your calorie target does more for them than an extra abs day.`
    - A beginner includes `Beginners grow on less. Volume rises as you progress.`
    - A non-empty `short` includes a line starting `Short on time:` that names those groups and ends `Add a day or longer sessions.`
    - A non-empty `limited` includes a line starting `Limited equipment:`.
    - There are never more than 6 lines.
- [ ] **Step 2:** `npx vitest run src/domain/plan`. Expect FAIL.
- [ ] **Step 3:** Implement. Line order: focus groups (in `GROUPS` order), then `Other muscles: {min} to {max} sets a week, enough to keep growing.`, then short, limited, abs and beginner lines, truncated to 6.
- [ ] **Step 4:** Run again. Expect PASS.
- [ ] **Step 5:** Commit `feat(plan): answers, why lines and plan commit`.

### Task 6: Abs + focus day in the split editor

**Files:**
- Modify: `src/domain/training/splits/suggest.ts`
- Modify: `src/screens/splits/DayEditorSheet.tsx`
- Test: `src/domain/training/suggest.test.ts`

**Interfaces:**
- Produces:
  - `DayFocus` gains `'abs-focus'`, with `FOCUS_LABEL['abs-focus'] = 'Abs + focus muscles'`.
  - `FOCUS_PATTERNS['abs-focus'] = ['core', 'core', 'shoulders', 'arms', 'arms', 'vpush']` (the default when there is no focus).
  - `AREA_PATTERNS: Record<FocusArea, Pattern[]>`: chest `['hpush']`, back `['vpull', 'hpull']`, shoulders `['shoulders', 'vpush']`, arms `['arms', 'arms']`, legs `['knee', 'hip']`, glutes `['hip']`, abs `['core']`.
  - `needsCoreNote(split: SplitDef, day: number): boolean`: true when the day's slots start with core and no other day has a core slot.

- [ ] **Step 1: Write failing tests.**
  - The existing per-focus loop now covers `abs-focus` automatically (eligible, unique, fills to the limit).
  - Core count is the first `limit >= 7 ? 3 : 2` slots. With profile `focus: ['chest']`, the slot right after the core slots has pattern `hpush`. No other slot is core.
  - `needsCoreNote`: PPL copy + abs-focus day gives true. Full-body copy (which has core) + abs-focus day gives false.
- [ ] **Step 2:** `npx vitest run src/domain/training/suggest.test.ts`. Expect FAIL.
- [ ] **Step 3:** In `suggestDay`, when `focus === 'abs-focus'` use the pattern list `[core × n, ...cycle(focus patterns from AREA_PATTERNS for profile.focus minus 'abs', or the default tail)]`. `anchors = 0` for this focus. In `DayEditorSheet`, under the day guide, render `Abs recover fast. A few sets on other days work as well as one long abs day.` (`text-footnote text-label-2`) when `needsCoreNote` is true.
- [ ] **Step 4:** Run again. Expect PASS. Then `npm run typecheck` is clean.
- [ ] **Step 5:** Commit `feat(splits): abs and focus day suggestion`.

### Task 7: Onboarding screens, gate and Profile entry points

**Files:**
- Create: `src/store/onboarding.ts`, `src/screens/onboarding/Onboarding.tsx`, `src/screens/onboarding/steps.tsx`, `src/screens/onboarding/Result.tsx`, `src/screens/onboarding/EnergyCard.tsx`
- Modify: `src/App.tsx`, `src/screens/Profile.tsx`, `src/screens/profile/summaries.ts`, `src/screens/profile/BodySheet.tsx`, `src/lib/route.ts` (only if a `plan` route is needed for rerun)

**Interfaces:**
- Consumes: `@/domain/plan` (Task 5 index), `SignInCard`, `Button`, `List`, `Row`, `Segmented`, `TextInput`, `Picker`.
- Produces:
  - `useOnboarding` (Zustand, not persisted): `{ step: number; answers: Partial<PlanAnswers>; template: TemplateId | null; set(patch), next(), back(), reset() }`.
  - `<Onboarding onDone={() => void} />`
  - `<EnergyCard profile kg />`, reused by `BodySheet`.

- [ ] **Step 1:** Draft store with `next`/`back` clamped to steps 0–9. Unit test `src/store/onboarding.test.ts`: `back` at 0 stays 0, `next` at 9 stays 9, `reset` clears answers.
- [ ] **Step 2:** Steps in the spec's order (Welcome, Body, Goal, Daily life, Calories, Experience, Schedule, Equipment, Focus, Result).
  - One primary button per step, `Next`, disabled until the step is valid. The ranges from Global Constraints show as inline messages.
  - Goal step: preselect from `suggestedGoal(bmiBand(bmi))`, with the hint `Suggested from your BMI. BMI can misread muscular builds, so pick what you want.`
  - Focus step: up to 3 chips, plus `No preference` which clears them.
  - Units follow `profile.units`, with a kg/lb `Segmented` on the Body step.
  - Progress bar at the top, Back at the top left (hidden on Welcome).
  - Step transitions use a `motion` x-slide of 24px, or opacity only when `useReducedMotion()` is true.
- [ ] **Step 3:** Result:
  - Run `applyAnswers` on a copy of `data`, then `generatePlan(copy, template ?? templateFor(days), now)`.
  - Show day titles with exercise names, the `explain` lines, and `EnergyCard`.
  - Buttons:
    - `Start with this` (primary): one `act(d => commitPlan(applyAnswers(d, a, now), split, now).data)`, then reset the draft.
    - `Edit`: same commit, then `openSheet('split-edit:' + split.id)`.
    - `Other options`: lists `alternativesFor(days)` with template names. Tapping one regenerates.
  - If commit returns `activated === false`, toast `Saved. Applies after this workout`.
  - Loading state: none needed (sync compute). Empty state: if the generated split fails `validateSplit`, show `We couldn't build a plan with this equipment. Add equipment or pick a split yourself.` with a `Pick a split` button that skips.
- [ ] **Step 4:** Welcome:
  - `Build my plan` (primary).
  - `Skip, I'll pick a split` runs `act(d => skipOnboarding(d, now))`.
  - `Have an account? Sign in` reveals `<SignInCard />` inline.
- [ ] **Step 5:** `App.tsx`: when `hydrated && needsOnboarding(data)` and no rerun is in progress, render `<Onboarding />` instead of the tab content, `TabBar` and `DailyBanner`. Keep `Toaster`, `ConfirmHost`, `Splash` and `AuthBanner` mounted.
- [ ] **Step 6:** Profile:
  - Add a `Build my plan` row (subtitle `Answer a few questions and get a split`) that opens onboarding as a rerun. Use route `openSheet('plan')`, which renders `<Onboarding />` full screen with the answers prefilled from the profile.
  - `BodySheet` renders `<EnergyCard>` above the list when height and a weigh-in exist. The card shows maintenance, target and protein, the intake comparison when `intakeKcal` is set, `note` when present, and the footnote `Estimate, not medical advice.` Without sex or age it shows protein and `Add sex and age in Build my plan for a calorie estimate.`
- [ ] **Step 7:** Run `npm run typecheck && npm test && npm run build`. All clean. Then run `npm run dev` and walk the flow once at 390px width in light and dark.
- [ ] **Step 8:** Commit `feat(onboarding): first-launch plan builder`.

### Task 8: E2E, version and notes

**Files:**
- Modify: `e2e/acceptance.mjs`, `package.json`, `next.md`

- [ ] **Step 1:** In `acceptance.mjs`, right after the reset `reload()`:
  - Check `Onboarding shows on a fresh device`: the text includes `Build my plan`.
  - Click `Skip, I'll pick a split`. The existing `Pick how you train` check then runs unchanged.
- [ ] **Step 2:** Append a new block at the end. Clear storage, reload, then:
  1. Click `Build my plan`.
  2. Body: 180 / 80 / Male / 30.
  3. Goal stays as preselected.
  4. Daily life: Mostly sitting. Calories: 2200. Experience: Intermediate. Schedule: 4 days, 60 min. Equipment: unchanged. Focus: Chest and Abs.
  5. Check `Result shows a plan`: text includes `Your plan · Upper / Lower` and `Chest:`.
  6. Click `Start with this`. Check `Plan is active`: `dumpState().splitId` starts with `custom-` and Today shows `Upper`.
  7. Reload. Check `No onboarding after finishing`.
  8. Open Profile, then the split editor. Add a day, fill it with `Abs + focus muscles`, save. Check `Abs day saved`: `customSplits` count is 1 and the split has 5 days.
- [ ] **Step 3:** Run `npm run build && npx vite preview --port 5199 &`, then `npm run e2e`. Every line is PASS.
- [ ] **Step 4:** Set `package.json` version to `4.6.0`. Add `## Onboarding and plan builder (shipped in 4.6.0)` to the top of `next.md` with a two-sentence summary.
- [ ] **Step 5:** Commit `test(e2e): onboarding flow` and `chore: Repwise 4.6.0`.
