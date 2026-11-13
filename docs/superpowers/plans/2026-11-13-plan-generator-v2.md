# Plan Generator v2 and "Look better" Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plan builder's generator with a pipeline that uses 17 muscle groups, scored exercise choice, named split styles (including the owner's Pairs split and custom pairs), best-of-20 candidates with a distinct Regenerate, and history-aware volume; add a "Look better (aesthetics)" goal on top.

**Architecture:** Pure stages in `src/domain/plan/v2/` (groups, exerciseMeta, history, targets, styles, allocate, select, score, generate, explain), exposed through `src/domain/plan/v2/index.ts` and re-exported from `src/domain/plan/index.ts`. Onboarding switches from v1 `generatePlan` to `generatePlanV2`; v1 files are deleted in the last task after v2 out-scores v1 on golden profiles.

**Tech Stack:** TypeScript, React 18, Zustand, Vitest, puppeteer-core e2e. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-13-plan-generator-v2-design.md`

## Global Constraints

- No new npm dependencies. Seeded randomness comes from `v2/rng.ts`, never `Math.random`, inside the generator.
- All new `Profile` fields are optional; `normalize()` already merges `{ ...base.profile, ...doc.profile }`, so no migration code beyond types.
- Same `AppData`, request and seed must produce an identical plan (slot ids excluded).
- Per-session cap: `SESSION_CAP = 10` direct sets per group per day.
- Low-frequency warning threshold: `LOW_FREQ = 1.3` times a week. "Let Repwise pick" wants focus groups at `>= 1.5`.
- Best-of-N: `CANDIDATES = 20`, regenerate distance `MIN_DISTANCE = 0.4` (Jaccard on exercise ids).
- Floor for non-focus groups with a target: `FLOOR = 6`.
- Leanness: men 10–15% (floor 8%), women 18–25% (floor 16%). Deficit never larger than 1% of body weight a week.
- Never suggest steroids, SARMs, extreme cuts, bone smashing, or face/jaw claims in any copy.
- Copy follows existing style: plain sentences, no exclamation marks, numbers as digits.
- Commit after each task; messages `feat(plan): ...`, `test(plan): ...`, `feat(onboarding): ...`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `npm test` and `npm run typecheck` before every commit; both must pass.

## Spec corrections made while planning

- Cardio minutes key off real session lengths (`45 | 60 | 75 | 90`): 45 min gives 10, 60 gives 15, 75 and 90 give 20.
- Pairs is eligible at 4–6 days (5-day layout used for 5 and 6) and Bro split at 5–6, because Repwise rotates the cycle rather than mapping weekdays. The owner trains the 4-day pairs cycle more than 4 days a week.
- `Profile` also gains `planGoal?: PlanGoal`, so a rerun can prefill "Look better".
- Male look preset: traps keep their normal small-group target; neck 5 sets, forearms 4.
- The "order" plan-score term is enforced by construction in `select` (sorted slots), not scored.

## Review Focus

1. **A person with custom exercises only, or exercises excluded until a group has nothing eligible:** plan still builds, the group lands in `limited` with an equipment hint, no crash. Test in Task 9.
2. **History with sessions but no done sets, or sets with `actualKg = null`:** `readHistory` returns zero baselines and `qualifies = false`, never NaN. Test in Task 4.
3. **Custom pairs with a day that has no groups and no cardio:** rejected by validation as an empty day. Test in Task 6.
4. **Regenerate pressed many times on a tiny pool (dumbbells-only, 2 days):** `exhausted` turns true and the UI cycles instead of looping or throwing. Test in Task 9.
5. **Look goal with no sex given:** no preset, no body-fat estimate, `bodyGoal` falls back to `maintain`, energy card hidden as today. Test in Task 10.

---

### Task 1: Groups, focus areas and shared types

**Files:**
- Create: `src/domain/plan/v2/groups.ts`
- Create: `src/domain/plan/v2/groups.test.ts`
- Modify: `src/domain/types.ts` (`FocusArea`, `Pattern`, `Profile`, new `PlanGoal`)
- Modify: `src/domain/plan/answers.ts` (re-export `PlanGoal` from types instead of defining it)
- Modify: `src/domain/flow.ts:6`, `src/domain/muscles.ts:128`, `src/screens/workout/ExercisePicker.tsx:8` (add `cardio` keys to the `Record<Pattern, …>` maps)

**Interfaces:**
- Produces:
  - `type Group = 'upper-chest' | 'chest' | 'lats' | 'upper-back' | 'traps' | 'front-delts' | 'side-delts' | 'rear-delts' | 'biceps' | 'triceps' | 'forearms' | 'neck' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs'`
  - `GROUPS: Group[]` (that order), `MAJOR: ReadonlySet<Group>` = chest, lats, upper-back, quads, hamstrings, glutes
  - `GROUP_LABEL: Record<Group, string>` ("Upper chest", "Side delts", …)
  - `FOCUS_GROUPS: Record<FocusArea, Group[]>`, `focusGroups(focus?: FocusArea[]): Set<Group>`
  - `type StyleId = 'full' | 'upper-lower' | 'ppl' | 'hybrid-ppl' | 'arnold' | 'pairs' | 'bro' | 'custom'` and `interface DayLayout { title: string; groups: Group[]; cardio?: boolean }`. They live here so `types.ts` can use them before `styles.ts` exists; `styles.ts` (Task 6) re-exports them.
  - In `types.ts`: `FocusArea` adds `'upper-chest' | 'side-delts' | 'lats' | 'traps-neck' | 'forearms'`; `Pattern` adds `'neck' | 'cardio'`; `export type PlanGoal = 'lose' | 'build' | 'strength' | 'fit' | 'look'`; `Profile` adds `planGoal?: PlanGoal; waistCm?: number; neckCm?: number; hipsCm?: number; planStyle?: StyleId | 'auto'; customPairs?: DayLayout[]` (`import type { StyleId, DayLayout } from './plan/v2/groups'`; type-only cycles are fine)

- [ ] **Step 1: Write the failing test** `groups.test.ts`

```ts
it('maps focus areas to fine groups', () => {
  expect(FOCUS_GROUPS.shoulders).toEqual(['side-delts', 'rear-delts']);
  expect(FOCUS_GROUPS.chest).toEqual(['upper-chest', 'chest']);
  expect(FOCUS_GROUPS.back).toEqual(['lats', 'upper-back']);
  expect(FOCUS_GROUPS['traps-neck']).toEqual(['traps', 'neck']);
  expect(FOCUS_GROUPS.legs).toEqual(['quads', 'hamstrings', 'calves']);
  expect([...focusGroups(['side-delts', 'lats'])]).toEqual(['side-delts', 'lats']);
});
it('labels every group and has 17', () => {
  expect(GROUPS).toHaveLength(17);
  for (const g of GROUPS) expect(GROUP_LABEL[g]).toMatch(/^[A-Z]/);
});
```
Remaining mappings: arms → biceps, triceps; glutes → glutes; abs → abs; upper-chest, side-delts, lats, forearms → themselves.

- [ ] **Step 2: Run** `npx vitest run src/domain/plan/v2/groups.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `groups.ts` and the type changes. New pattern entries: `flow.ts` gives `neck` the same region as `shoulders` and `cardio` the same as `core`; `muscles.ts` `BY_PATTERN.neck = t(['traps'])`, `BY_PATTERN.cardio = t([])`; picker labels `'Neck'` and `'Cardio'`.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(plan): v2 muscle groups, focus areas and profile fields`

---

### Task 2: Catalogue additions, guides and cardio prescription

**Files:**
- Modify: `src/domain/catalogue.ts` (new rows)
- Modify: `src/domain/guides.ts` (a guide per new id)
- Modify: `src/domain/muscles.ts` (`BY_ID` entries for new ids, using existing `Muscle` names)
- Modify: `src/domain/training/prescribe.ts` (`prescription` handles cardio)
- Test: `src/domain/catalogue.test.ts`, `src/domain/guides.test.ts`, `src/domain/training/prescribe.test.ts`

**Interfaces:**
- Produces: catalogue ids `incline-barbell-press`, `incline-machine-press`, `pec-deck`, `db-shrug`, `barbell-shrug`, `assisted-pull-up`, `plate-neck-curl`, `plate-neck-extension`, `wrist-curl`, `reverse-curl`, `preacher-curl`, `incline-db-curl`, `skull-crusher`, `hip-abduction`, `cable-glute-kickback`, `incline-walk`, `bike`, `rower`, `stairs`, `run`.
- Patterns and equipment: incline barbell press `hpush` barbell; incline machine press and pec deck `hpush` machine; shrugs `shoulders` (dumbbell, barbell); assisted pull-up `vpull` machine; neck curl and extension `neck` bodyweight (plate held, kind `weighted`); wrist curl, reverse curl, preacher curl, incline dumbbell curl, skull crusher `arms`; hip abduction `hip` machine; cable glute kickback `hip` cable.
- Cardio rows: pattern `'cardio'`, kind `'timed'`, equipment `machine` (incline walk, bike, rower, stairs) or `bodyweight` (run).
- `V2_ONLY_IDS: ReadonlySet<string>` exported from `catalogue.ts`, holding every id added here.
- Produces: `cardioMinutes(sessionMinutes: Profile['sessionMinutes']): 10 | 15 | 20` exported from `prescribe.ts` and re-exported by `training/index.ts`.
- `prescription(profile, role, ex)` with `ex.pattern === 'cardio'` returns `{ sets: 1, repMin: m * 60, repMax: m * 60, restSec: 0 }`. It takes an optional 4th arg `sessionMinutes?: Profile['sessionMinutes']`, default 60.

- [ ] **Step 1: Write failing tests**

```ts
// prescribe.test.ts
it('cardio is one timed block sized by session length', () => {
  const ex = getExercise(emptyAppData(NOW), 'incline-walk')!;
  expect(prescription(p, 'accessory', ex, 45)).toEqual({ sets: 1, repMin: 600, repMax: 600, restSec: 0 });
  expect(cardioMinutes(60)).toBe(15);
  expect(cardioMinutes(90)).toBe(20);
});
// guides.test.ts already asserts every built-in has a guide; add:
it('has guides for the v2 additions', () => {
  for (const id of ['pec-deck', 'plate-neck-curl', 'hip-abduction', 'incline-walk']) expect(GUIDES[id]?.steps.length).toBeGreaterThan(1);
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/training/prescribe.test.ts src/domain/guides.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** rows, guides (setup, steps, cues, mistakes in the existing voice; neck moves start light and controlled, and cue a neutral spine) and the cardio branch. Add `&& !V2_ONLY_IDS.has(e.id)` to v1's pool filter in `src/domain/plan/generate.ts` so v1 output and its tests stay unchanged until Task 12.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: pass, including the existing v1 snapshot/invariant tests.
- [ ] **Step 5: Commit** `feat(catalogue): aesthetic and cardio exercises with guides`

---

### Task 3: Exercise metadata

**Files:**
- Create: `src/domain/plan/v2/exerciseMeta.ts`
- Test: `src/domain/plan/v2/exerciseMeta.test.ts`

**Interfaces:**
- Consumes: `Group` (Task 1), catalogue ids (Task 2), `exerciseMuscles` from `src/domain/muscles.ts`.
- Produces:
  - `interface ExerciseMeta { muscles: Partial<Record<Group, 1 | 0.5>>; tier: 'S' | 'A' | 'B'; stretch: boolean; fatigue: 'low' | 'medium' | 'high'; skill: 'low' | 'high'; compound: boolean }`
  - `META: Record<string, ExerciseMeta>`: one entry per built-in non-calisthenics exercise.
  - `metaFor(ex: Exercise): ExerciseMeta`: `META[ex.id]` or a derived fallback.
  - `primaryGroups(m: ExerciseMeta): Group[]`

Fallback for custom exercises: map `exerciseMuscles(ex)` to groups. Primary gets 1 and secondary gets 0.5, with these rules: `chest` goes to `chest`; `shoulders` goes to `front-delts` when the pattern is `vpush` or `hpush`, otherwise `side-delts`; `rear-delts` goes to `rear-delts`; `obliques` goes to `abs`; `lower-back` is dropped. Every other muscle maps to the group with the same name. Fallback values: tier `B`, `stretch: false`, fatigue `medium`, skill `low`, and `compound` true when the pattern is one of knee, hip, hpush, vpush, hpull or vpull.

- [ ] **Step 1: Write failing tests**

```ts
it('covers every built-in non-calisthenics exercise with valid groups', () => {
  for (const ex of allExercises(emptyAppData(NOW)).filter((e) => !e.calisthenics)) {
    const m = META[ex.id];
    expect(m, ex.id).toBeDefined();
    expect(primaryGroups(m).length, ex.id).toBeGreaterThan(0);
    for (const g of Object.keys(m.muscles)) expect(GROUPS).toContain(g);
  }
});
it('pins the aesthetic distinctions', () => {
  expect(META['db-lateral-raise'].muscles).toEqual({ 'side-delts': 1 });
  expect(META['overhead-press'].muscles['front-delts']).toBe(1);
  expect(META['overhead-press'].muscles['side-delts']).toBe(0.5);
  expect(META['incline-db-press'].muscles).toMatchObject({ 'upper-chest': 1, chest: 0.5, 'front-delts': 0.5, triceps: 0.5 });
  expect(META['overhead-triceps-extension'].stretch).toBe(true);
  expect(META['back-squat'].fatigue).toBe('high');
  expect(META['face-pull'].muscles['rear-delts']).toBe(1);
  expect(META['db-shrug'].muscles).toEqual({ traps: 1, forearms: 0.5 });
  expect(META['incline-walk'].muscles).toEqual({});
});
it('derives a fallback for custom exercises', () => {
  const m = metaFor({ id: 'c1', name: 'Landmine press', muscle: 'Shoulders', pattern: 'vpush', equipment: 'barbell', kind: 'weighted', custom: true });
  expect(m.muscles['front-delts']).toBe(1);
  expect(m).toMatchObject({ tier: 'B', compound: true, skill: 'low' });
});
```
Cardio entries have empty `muscles` and are exempt from the "primary > 0" check (filter `pattern !== 'cardio'` there).

- [ ] **Step 2: Run** `npx vitest run src/domain/plan/v2/exerciseMeta.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `META`.** Tier S is for the best-in-class move per group (e.g. squat, Romanian deadlift, lateral raise, pulldown, incline dumbbell press, cable fly, overhead extension, incline curl). Skill `high` is for barbell back squat, front squat, deadlift variants and barbell row. Compound picks match v1's `isCompound`; leg extension, leg curl, cable fly and straight-arm pulldown are isolation.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** `feat(plan): v2 exercise metadata`

---

### Task 4: Seeded RNG and history reader

**Files:**
- Create: `src/domain/plan/v2/rng.ts`, `src/domain/plan/v2/history.ts`
- Test: `src/domain/plan/v2/rng.test.ts`, `src/domain/plan/v2/history.test.ts`
- Create: `src/domain/plan/v2/fixtures.ts` (test-only builders: `sessionOn(date, sets: { id: string; kg: number; reps: number; n: number }[], opts?)`)

**Interfaces:**
- Consumes: `metaFor`, `primaryGroups` (Task 3); `setScore` from `src/domain/strength.ts`; `findSlot` from `src/domain/training`.
- Produces:
  - `rng(seed: number): () => number`, mulberry32, values in [0, 1).
  - `interface History { qualifies: boolean; baseline: Record<Group, number>; trend: Partial<Record<Group, { change: number; flatWeeks: number }>>; adherence: number; finishRate: number | null; liked: Set<string>; avoided: Set<string> }`
  - `readHistory(data: AppData, now: string): History`

Rules (pin these in tests):
- Only finished sessions (`finishedAt != null`) and `status === 'done'` sets count.
- `qualifies`: at least 3 of the last 6 calendar weeks (Monday-start, before `now`) have 2 or more finished sessions.
- `baseline[g]`: total fractional done sets for `g` (primary 1, secondary 0.5 from `metaFor`) over the last 6 weeks ÷ 6, rounded to 0.5.
- `trend[g]`: for each exercise where `g` is primary and that has at least 3 sessions in the last 8 weeks, take the best `setScore` per session. `change` = (latest − first) ÷ first, averaged across those exercises. `flatWeeks` = whole weeks since that best last rose by 1% or more, taking the minimum across exercises.
- `adherence`: finished sessions in the last 8 weeks ÷ (`daysPerWeek` × 8), capped at 1.
- `finishRate`: median over the last 6 finished sessions of (exercises with at least one done set ÷ exercises planned). `null` if there are fewer than 6.
- `liked`: exercise ids with 3 or more sessions in 8 weeks and `change > 0`.
- `avoided`: ids with `skipped: true` 3 or more times in 8 weeks, or that are `candidates[0]` of a slot where a different exercise was logged in that `slotId` 3 or more times (use `findSlot(data, s.splitId, e.slotId)`).

- [ ] **Step 1: Write failing tests**

```ts
it('rng is deterministic and in range', () => {
  const a = rng(42), b = rng(42);
  const xs = Array.from({ length: 5 }, a);
  expect(Array.from({ length: 5 }, b)).toEqual(xs);
  for (const x of xs) expect(x).toBeGreaterThanOrEqual(0), expect(x).toBeLessThan(1);
});
it('does not qualify with under 3 good weeks', () => { /* 2 weeks × 2 sessions */ expect(readHistory(d, NOW).qualifies).toBe(false); });
it('baseline counts primary 1 and secondary 0.5 over 6 weeks', () => {
  // 6 weeks × 2 sessions, each 3 done sets of incline-db-press
  const h = readHistory(d, NOW);
  expect(h.baseline['upper-chest']).toBe(6);
  expect(h.baseline.triceps).toBe(3);
});
it('flags a stalled lift', () => {
  // db-lateral-raise best set unchanged for 4 weeks after an early rise
  expect(readHistory(d, NOW).trend['side-delts']).toMatchObject({ flatWeeks: 4 });
});
it('survives sessions with no done sets and null loads', () => {
  const h = readHistory(dWithEmptySessions, NOW);
  expect(h.qualifies).toBe(false);
  for (const v of Object.values(h.baseline)) expect(Number.isFinite(v)).toBe(true);
});
it('marks skipped-three-times exercises as avoided', () => { expect(readHistory(d, NOW).avoided.has('hip-thrust')).toBe(true); });
```

- [ ] **Step 2: Run** `npx vitest run src/domain/plan/v2/rng.test.ts src/domain/plan/v2/history.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files. Use dayjs for week boundaries, like `strength.ts` `monday()`.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** `feat(plan): v2 seeded rng and history reader`

---

### Task 5: Weekly targets

**Files:**
- Create: `src/domain/plan/v2/targets.ts`
- Test: `src/domain/plan/v2/targets.test.ts`

**Interfaces:**
- Consumes: `Group`, `GROUPS`, `MAJOR`, `focusGroups` (Task 1); `History` (Task 4); `MAX_EXERCISES`, `prescription` from training.
- Produces:
  - `FLOOR = 6`, `SESSION_CAP = 10`
  - `interface TargetReason { group: Group; delta: number; text: string }`
  - `interface Targets { sets: Record<Group, number>; focus: Set<Group>; budget: number; exerciseLimit: number; reasons: TargetReason[] }`
  - `evidenceTargets(p: Profile): Record<Group, number>`
  - `weeklyTargets(p: Profile, h: History | null): Targets`

Rules:
- Base targets: beginner 9 for major groups and 6 for small; intermediate 12 and 8; advanced 15 and 10. `front-delts` = 0. `neck` and `forearms` = 0 unless they are a focus group.
- Focus groups: base × 1.4, rounded, capped at 14 for beginners and 20 otherwise. When `bodyGoal === 'lose'` the factor is 1.15.
- Look goal (`p.planGoal === 'look'`):
  - `side-delts` and `rear-delts` = max(current, 8).
  - If `p.sex === 'male'`: neck = max(current, 5) and forearms = max(current, 4).
- History (only when `h?.qualifies`), for each group with an evidence value `ev > 0`:
  - If baseline `b >= ev`: `t = min(b, cap)`.
  - Otherwise: `t = min(ev, max(FLOOR_or_ev, b + min(0.2 * b, 4)))`, where `FLOOR_or_ev = min(ev, FLOOR)`.
  - Then trend:
    - `change >= 0.01`: hold.
    - `flatWeeks >= 3 && adherence >= 0.75`: `t = min(cap, t + 2)`, reason "{Label} {t} sets (+2): {exercise name} flat {n} weeks". The exercise name is the group's most-logged exercise.
    - `change < -0.03 || adherence < 0.6`: if `t > ev`, `t -= 2`.
- `exerciseLimit = MAX_EXERCISES[p.sessionMinutes] - (h?.finishRate != null && h.finishRate < 0.8 ? 1 : 0)`. Add a reason with group `'abs'` and delta 0 whose text is "Days have 1 fewer exercise: you usually finish about {pct}% of them."
- `budget = p.daysPerWeek * exerciseLimit * prescription(p, 'accessory', undefined).sets`
- Trim to budget like v1: non-focus groups first, decrementing the largest, down to `FLOOR` (or their value if lower). Then focus groups down to their base.

- [ ] **Step 1: Write failing tests**

```ts
const p = (o: Partial<Profile>) => ({ ...emptyAppData(NOW).profile, daysPerWeek: 5, sessionMinutes: 90, ...o }) as Profile;
it('evidence defaults by experience', () => {
  const t = evidenceTargets(p({ experience: 'intermediate', focus: [] }));
  expect(t.chest).toBe(12); expect(t.biceps).toBe(8); expect(t['front-delts']).toBe(0); expect(t.neck).toBe(0);
});
it('focus gets +40%, +15% on a cut', () => {
  expect(evidenceTargets(p({ experience: 'intermediate', focus: ['side-delts'] }))['side-delts']).toBe(11);
  expect(evidenceTargets(p({ experience: 'intermediate', focus: ['side-delts'], bodyGoal: 'lose' }))['side-delts']).toBe(9);
});
it('look goal floors delts and turns on neck and forearms for men', () => {
  const t = evidenceTargets(p({ experience: 'beginner', planGoal: 'look', sex: 'male', focus: [] }));
  expect(t['side-delts']).toBe(8); expect(t['rear-delts']).toBe(8); expect(t.neck).toBe(5); expect(t.forearms).toBe(4);
  expect(evidenceTargets(p({ experience: 'beginner', planGoal: 'look', sex: 'female', focus: [] })).neck).toBe(0);
});
it('never ramps more than +20% or +4 above real baseline', () => {
  const t = weeklyTargets(p({ experience: 'advanced' }), hist({ baseline: { chest: 6 } }));
  expect(t.sets.chest).toBe(7);
});
it('adds 2 sets to a stalled group when attendance is good', () => {
  const t = weeklyTargets(p({ experience: 'intermediate' }), hist({ baseline: { 'side-delts': 8 }, trend: { 'side-delts': { change: 0, flatWeeks: 3 } }, adherence: 0.8 }));
  expect(t.sets['side-delts']).toBe(10);
  expect(t.reasons.find((r) => r.group === 'side-delts')?.delta).toBe(2);
});
it('drops one exercise when sessions are usually unfinished', () => {
  expect(weeklyTargets(p({ sessionMinutes: 60 }), hist({ finishRate: 0.7 })).exerciseLimit).toBe(5);
});
```
`hist()` is a fixture helper that fills an unqualified-by-default `History` with `qualifies: true` and the overrides.

- [ ] **Step 2: Run** `npx vitest run src/domain/plan/v2/targets.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `targets.ts`.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** `feat(plan): v2 weekly targets from evidence and history`

---

### Task 6: Split styles, frequency, auto-pick and custom pairs validation

**Files:**
- Create: `src/domain/plan/v2/styles.ts`
- Test: `src/domain/plan/v2/styles.test.ts`

**Interfaces:**
- Consumes: `Group`, `GROUPS` (Task 1); `Targets` (Task 5).
- Produces:
  - Re-exports `StyleId` and `DayLayout` from `groups.ts`
  - `STYLE_NAME: Record<StyleId, string>`
  - `LOW_FREQ = 1.3`
  - `eligibleStyles(daysPerWeek: number): StyleId[]`: always ends with `'custom'`
  - `styleLayout(id: Exclude<StyleId, 'custom'>, daysPerWeek: number): DayLayout[]`
  - `frequency(layout: DayLayout[], daysPerWeek: number): Record<Group, number>`: appearances × daysPerWeek ÷ layout.length
  - `pickStyle(daysPerWeek: number, targets: Targets): Exclude<StyleId, 'custom'>`
  - `validateCustomPairs(days: DayLayout[], targets: Targets, daysPerWeek: number): { missing: Group[]; lowFrequency: Group[]; emptyDays: number[]; ok: boolean }`. `ok` requires 2–7 days, no missing groups and no empty days.

Day group lists (front-delts is never listed; abs only where shown):

| Day | Groups |
|---|---|
| Full | every group except `front-delts` |
| Upper | upper-chest, chest, lats, upper-back, traps, side-delts, rear-delts, biceps, triceps, forearms, neck |
| Lower / Legs | quads, hamstrings, glutes, calves, abs |
| Push | upper-chest, chest, side-delts, triceps, abs |
| Pull | lats, upper-back, traps, rear-delts, biceps, forearms, neck |
| Arms & delts | side-delts, rear-delts, biceps, triceps, forearms, neck |
| Chest + Back | upper-chest, chest, lats, upper-back, traps, abs |
| Shoulders + Arms | side-delts, rear-delts, biceps, triceps, forearms, neck |
| Chest + Biceps | upper-chest, chest, biceps, forearms |
| Back + Triceps | lats, upper-back, traps, triceps, neck |
| Shoulders + Legs | side-delts, rear-delts, quads, hamstrings, glutes, calves |
| Shoulders (pairs-5) | side-delts, rear-delts, neck |
| Cardio + Abs | abs, `cardio: true` |
| Bro Chest / Back / Shoulders / Arms | chest group: upper-chest, chest, abs; back: lats, upper-back, traps, neck; shoulders: side-delts, rear-delts, abs; arms: biceps, triceps, forearms |

Eligibility and layouts:
- full: 2–3 days; Full A / B (/ C)
- upper-lower: 3–4 days; 3 days = Upper, Lower, Full; 4 days = Upper, Lower, Upper, Lower
- ppl: 3 or 6 days
- hybrid-ppl: 4 days = Push, Pull, Legs, Arms & delts; 5 days = Push, Pull, Legs, Upper, Lower
- arnold: 3 or 6 days
- pairs: 4–6 days; the 4-day layout for 4, the 5-day layout (Chest + Biceps, Back + Triceps, Shoulders, Legs, Cardio + Abs) for 5 and 6
- bro: 5–6 days

`pickStyle` scores each eligible non-custom style as `2 × (share of focus groups with frequency ≥ 1.5) + (share of groups with target > 0 and frequency ≥ 1.3) − 0.5 × (1 if any day has more groups with target > 0 than targets.exerciseLimit, else 0)`. Ties go to the earlier entry in the order full, upper-lower, ppl, hybrid-ppl, arnold, pairs, bro.

- [ ] **Step 1: Write failing tests**

```ts
it('lists eligible styles by day count', () => {
  expect(eligibleStyles(4)).toEqual(['upper-lower', 'hybrid-ppl', 'pairs', 'custom']);
  expect(eligibleStyles(5)).toEqual(['hybrid-ppl', 'pairs', 'bro', 'custom']);
});
it("builds the owner's pairs split", () => {
  expect(styleLayout('pairs', 4).map((d) => d.title)).toEqual(['Chest + Biceps', 'Back + Triceps', 'Shoulders + Legs', 'Cardio + Abs']);
  expect(styleLayout('pairs', 4)[3]).toMatchObject({ groups: ['abs'], cardio: true });
});
it('computes rotation frequency', () => {
  const f = frequency(styleLayout('pairs', 4), 5);
  expect(f.chest).toBeCloseTo(1.25); expect(f.abs).toBeCloseTo(1.25);
});
it('auto-picks a style that hits focus groups 1.5x a week', () => {
  const t = targetsFixture({ focus: ['side-delts', 'lats'], daysPerWeek: 4 });
  expect(pickStyle(4, t)).toBe('upper-lower');
});
it('validates custom pairs', () => {
  const t = targetsFixture({ daysPerWeek: 4 });
  const r = validateCustomPairs([{ title: 'A', groups: ['chest'] }, { title: 'B', groups: [] }], t, 4);
  expect(r.ok).toBe(false); expect(r.emptyDays).toEqual([1]); expect(r.missing).toContain('quads');
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/plan/v2/styles.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `styles.ts`.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: pass.
- [ ] **Step 5: Commit** `feat(plan): v2 split styles, frequency and custom pairs`

---

### Task 7: Allocation

**Files:**
- Create: `src/domain/plan/v2/allocate.ts`
- Test: `src/domain/plan/v2/allocate.test.ts`

**Interfaces:**
- Consumes: `DayLayout` (Task 6); `Targets`, `SESSION_CAP` (Task 5).
- Produces:
  - `interface DayPlan { title: string; cardio: boolean; sets: Partial<Record<Group, number>> }` (direct sets per cycle day)
  - `interface Allocation { days: DayPlan[]; short: Group[] }`
  - `allocate(layout: DayLayout[], targets: Targets, daysPerWeek: number): Allocation`

Rule: work out per-cycle sets per group as `need = target × layout.length ÷ daysPerWeek`. Split `need` as evenly as possible over the days whose layout lists the group, in whole sets, with any remainder going to earlier days. Clamp each day at `SESSION_CAP`. A group whose clamped total ends up below 90% of `need` goes into `short`. Groups with target 0 are skipped.

- [ ] **Step 1: Write failing tests**

```ts
it('spreads sets evenly and converts weekly to per-cycle', () => {
  const a = allocate(styleLayout('upper-lower', 4), tf({ chest: 12 }), 4);
  expect(a.days.map((d) => d.sets.chest ?? 0)).toEqual([6, 0, 6, 0]);
});
it('respects the session cap and reports short groups', () => {
  const a = allocate(styleLayout('pairs', 4), tf({ chest: 20 }), 4);
  expect(a.days[0].sets.chest).toBe(10);
  expect(a.short).toContain('chest');
});
it('rotation: a 4-day cycle trained 5 days needs fewer sets per cycle day', () => {
  expect(allocate(styleLayout('pairs', 4), tf({ chest: 10 }), 5).days[0].sets.chest).toBe(8);
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/plan/v2/allocate.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `allocate.ts`.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** `feat(plan): v2 per-day set allocation`

---

### Task 8: Candidate selection and plan score

**Files:**
- Create: `src/domain/plan/v2/select.ts`, `src/domain/plan/v2/score.ts`
- Test: `src/domain/plan/v2/select.test.ts`, `src/domain/plan/v2/score.test.ts`

**Interfaces:**
- Consumes: Tasks 3–7; `isEligible`, `newCustomSplit`, `newSlotId`, `prescription`, `cardioMinutes`, `splitBlurb` from training; `allExercises` from catalogue.
- Produces:
  - `interface Ctx { data: AppData; targets: Targets; layout: DayLayout[]; allocation: Allocation; history: History | null; now: string }`
  - `interface Candidate { sessions: { title: string; slots: Slot[] }[]; picks: string[][]; achieved: Record<Group, number>; daysHit: Record<Group, number> }`. `achieved` is weekly: per-cycle credit × daysPerWeek ÷ layout.length.
  - `buildCandidate(ctx: Ctx, seed: number): Candidate`
  - `limitedGroups(data: AppData): Group[]`: groups with no eligible exercise that has them as primary
  - `SCORE_WEIGHTS = { coverage: 4, frequency: 1, variety: 1, dayFit: 2, quality: 1, history: 1 }`
  - `scorePlan(c: Candidate, ctx: Ctx): number` (higher is better)
  - `planDistance(a: string[][], b: string[][]): number`: 1 − |A∩B| ÷ |A∪B| on the flattened id sets

**Selection:**
- **Pool:** `isEligible(e, data) && !e.calisthenics`, with skill `high` removed for beginners.
- **Day order:** focus major groups, then other major, then focus small, then other small, then abs. A cardio slot always goes last.
- **Loop:** for each group, while the day's remaining direct sets for it are above 0 and `slots.length < targets.exerciseLimit`, add the top-ranked exercise. Skip the group once its weekly `achieved` has reached its target, because spill from compounds counts.
- **Ranking score:**
  - tier: S = 3, A = 2, B = 1
  - +0.5 if the move is isolation and `stretch`
  - +0.75 if in `history.liked`; −1.5 if in `history.avoided`
  - + `rand() * 0.3`
  - Hard order: the first slot of a major group on a day must be compound when any compound is available.
- **Filters:**
  - The exercise isn't already on the day.
  - No second compound with the same pattern on the day.
  - At most 2 `fatigue === 'high'` per day.
  - At most 2 uses a week unless the slot is the anchor.
- **Slot:**
  - `role`: anchor for the first compound of a major group on the day, otherwise accessory.
  - `candidates`: the pick plus up to 2 alternates with the same pattern and the same primary groups.
  - `pattern`: the exercise's pattern.
  - Sets and credit come from `prescription(p, role, ex)`.
- **Cardio day:** one cardio slot. Eligible cardio exercises are ranked by `rand()` only.
- **Sort within a day:** anchors, then focus groups, then compounds, then isolation, then abs, then cardio.

**Score terms:**
- coverage: `−Σ w × |achieved − target| ÷ max(target, 1)`, with w = 2 for focus groups
- frequency: `+` the count of focus groups with `daysHit >= 2` where the layout lists them on 2 or more days
- variety: `−` the count of non-anchor ids used more than twice
- dayFit: `−Σ max(0, n − limit) + max(0, min(limit, max(3, limit − 2)) − n)`, for non-cardio days only
- quality: mean (tier + stretch bonus) ÷ 3.5
- history: (liked picks − avoided picks) ÷ total picks

- [ ] **Step 1: Write failing tests**

```ts
it('is deterministic for a seed and varies across seeds', () => {
  const ctx = ctxFor(profile({ daysPerWeek: 4 }), 'upper-lower');
  expect(buildCandidate(ctx, 7).picks).toEqual(buildCandidate(ctx, 7).picks);
  const seeds = [1, 2, 3, 4, 5].map((s) => buildCandidate(ctx, s).picks.flat().join());
  expect(new Set(seeds).size).toBeGreaterThan(1);
});
it('puts a lateral raise in a V-taper plan', () => {
  const c = buildCandidate(ctxFor(profile({ planGoal: 'look', sex: 'male', focus: ['side-delts', 'lats', 'upper-chest'], daysPerWeek: 4 }), 'upper-lower'), 1);
  expect(c.picks.flat().some((id) => id.includes('lateral-raise'))).toBe(true);
  expect(c.achieved['side-delts']).toBeGreaterThanOrEqual(8);
});
it('opens a major group with a compound and caps high-fatigue moves', () => {
  const c = buildCandidate(ctxFor(profile({ daysPerWeek: 3, experience: 'advanced' }), 'full'), 3);
  for (const day of c.picks) expect(day.filter((id) => META[id]?.fatigue === 'high').length).toBeLessThanOrEqual(2);
});
it('fills a cardio day with one timed block plus abs', () => {
  const c = buildCandidate(ctxFor(profile({ daysPerWeek: 4 }), 'pairs'), 1);
  expect(c.sessions[3].slots.at(-1)!.pattern).toBe('cardio');
});
it('distance is Jaccard on exercise ids', () => {
  expect(planDistance([['a', 'b']], [['b', 'c']])).toBeCloseTo(2 / 3);
  expect(planDistance([['a']], [['a']])).toBe(0);
});
```
`ctxFor(profile, style)` is a test helper in `fixtures.ts` that runs targets (no history), `styleLayout` and `allocate`.

- [ ] **Step 2: Run** `npx vitest run src/domain/plan/v2/select.test.ts src/domain/plan/v2/score.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** `feat(plan): v2 seeded candidate selection and plan score`

---

### Task 9: Generate, regenerate, explain and golden profiles

**Files:**
- Create: `src/domain/plan/v2/generate.ts`, `src/domain/plan/v2/explain.ts`, `src/domain/plan/v2/index.ts`
- Modify: `src/domain/plan/index.ts` (re-export v2 public API)
- Test: `src/domain/plan/v2/generate.test.ts`, `src/domain/plan/v2/golden.test.ts`, `src/domain/plan/v2/explain.test.ts`

**Interfaces:**
- Consumes: everything above; v1 `generatePlan`, `templateFor`, `exerciseGroups` only inside `golden.test.ts` for the comparison.
- Produces:
  - `CANDIDATES = 20`, `MIN_DISTANCE = 0.4`
  - `interface PlanRequest { style: StyleId | 'auto'; customPairs?: DayLayout[]; seed: number; shown: string[][][] }`
  - `interface PlanResultV2 { split: CustomSplit; style: StyleId; layout: DayLayout[]; targets: Targets; achieved: Record<Group, number>; daysHit: Record<Group, number>; frequency: Record<Group, number>; short: Group[]; limited: Group[]; picks: string[][]; exhausted: boolean; score: number }`
  - `generatePlanV2(data: AppData, req: PlanRequest, now: string): PlanResultV2`
  - `explainV2(r: PlanResultV2, p: Profile, body: BodyFatEstimate | null): string[]`. `BodyFatEstimate` comes from Task 10. Until then, declare the parameter type in `explain.ts` as `{ pct: number; method: 'navy' | 'rough' } | null`, and Task 10 exports the same shape.
  - `index.ts` exports: `generatePlanV2`, `explainV2`, `readHistory`, `weeklyTargets`, `eligibleStyles`, `styleLayout`, `frequency`, `validateCustomPairs`, `STYLE_NAME`, `GROUP_LABEL`, `GROUPS`, `LOW_FREQ`, and the types `Group`, `StyleId`, `DayLayout`, `PlanRequest`, `PlanResultV2`.

`generatePlanV2`:
1. `history = readHistory(data, now)`
2. `targets = weeklyTargets(profile, history)`
3. Resolve the style. `'auto'` uses `pickStyle`. `'custom'` uses `req.customPairs`, or falls back to `pickStyle` if that is missing or invalid.
4. Run the layout through `allocate`.
5. Build seeds `req.seed + k*CANDIDATES + i` for `i < 20` and score each. Return the best with `planDistance >= MIN_DISTANCE` to every entry of `req.shown`, drawing batches `k = 0..4`. If none qualifies, return the overall best with `exhausted: true`.
6. Build the split with `newCustomSplit(data, null, now).split`, `name: "Your plan · {STYLE_NAME}"`, then `splitBlurb`.

`explainV2` returns up to 7 lines, in order:
1. Style and frequency: "Pairs split. Each muscle trained about 1.3 times a week."
2. A low-frequency note for any focus group under `LOW_FREQ`: "Chest trained about 1 time a week. Fine for holding, slower for growing. Train 5 or more days or pick a style with more frequency."
3. Up to 3 focus lines: "Side delts: 14 sets a week across 2 days (focus)."
4. `targets.reasons` texts.
5. Short and limited lines, reusing v1's wording. Limited lines add an equipment hint: "Add dumbbells or cable in Profile."
6. Look-goal line, when `p.planGoal === 'look'` and `body` is present. Example: "V-taper: side delts 14 sets and lats 14 sets lead the week. Body fat ~19% (rough), aim 10–15%." The female wording uses "Shoulders, waist and glutes". Task 10 adds the calorie clause.
7. "No training history yet. The plan adapts after a few weeks of logged workouts." when `!history.qualifies`.

- [ ] **Step 1: Write failing tests** (golden profiles in `golden.test.ts`)

```ts
const GOLDEN = {
  ownerPairs5: { daysPerWeek: 5, experience: 'intermediate', sessionMinutes: 60, focus: ['chest', 'arms'], style: 'pairs' },
  femaleLook: { daysPerWeek: 4, experience: 'beginner', sessionMinutes: 60, sex: 'female', planGoal: 'look', focus: ['glutes', 'side-delts', 'lats'], style: 'auto' },
  beginner2: { daysPerWeek: 2, experience: 'beginner', sessionMinutes: 45, focus: [], style: 'auto' },
  advanced6: { daysPerWeek: 6, experience: 'advanced', sessionMinutes: 90, focus: ['side-delts'], style: 'ppl' },
  dumbbellsHome: { daysPerWeek: 3, experience: 'intermediate', sessionMinutes: 45, equipment: ['dumbbell', 'bodyweight'], focus: ['arms'], style: 'auto' },
  cutWithHistory: { daysPerWeek: 4, experience: 'intermediate', sessionMinutes: 60, bodyGoal: 'lose', focus: ['side-delts'], style: 'upper-lower', history: 'stalledLateralRaise8w' },
} as const;

for (const [name, g] of Object.entries(GOLDEN)) {
  describe(name, () => {
    const d = dataFor(g);
    let shown: string[][][] = [];
    for (let step = 0; step < 4; step++) {
      it(`invariants on regenerate step ${step}`, () => {
        const r = generatePlanV2(d, { style: g.style, seed: 1, shown }, NOW);
        for (const grp of GROUPS) if (r.targets.sets[grp] > 0 && !r.limited.includes(grp)) expect(r.daysHit[grp], grp).toBeGreaterThan(0);
        for (const grp of r.targets.focus) if (!r.limited.includes(grp) && !r.short.includes(grp)) expect(r.achieved[grp], grp).toBeGreaterThanOrEqual(0.9 * r.targets.sets[grp]);
        for (const s of r.split.sessions) expect(s.slots.filter((x) => x.pattern !== 'cardio').length).toBeLessThanOrEqual(r.targets.exerciseLimit);
        if (d.profile.planGoal === 'look') expect(r.achieved['side-delts']).toBeGreaterThanOrEqual(8);
        if (!r.exhausted) for (const prev of shown) expect(planDistance(prev, r.picks)).toBeGreaterThanOrEqual(0.4);
        expect(validateSplit(r.split)).toBeNull();
        shown = [...shown, r.picks];
      });
    }
  });
}
it('same seed and data give the same plan', () => { /* strip slot ids, compare two runs */ });
it('20 candidates generate in under 50 ms', () => {
  const t0 = performance.now(); generatePlanV2(dataFor(GOLDEN.advanced6), { style: 'ppl', seed: 1, shown: [] }, NOW);
  expect(performance.now() - t0).toBeLessThan(50);
});
it('v2 scores at least as well as v1 on every golden profile', () => {
  // Score v1's split with v2's scorePlan by converting v1 sessions into a Candidate (picks = slot.candidates[0]).
});
// dataFor() maps `excluded` to profile.excludedExerciseIds and `history` to a named fixture from fixtures.ts.
it('a group with nothing eligible is limited, not a crash', () => {
  const r = generatePlanV2(dataFor({ ...GOLDEN.beginner2, equipment: ['bodyweight'], excluded: ['back-extension', 'nordic-curl'] }), { style: 'auto', seed: 1, shown: [] }, NOW);
  expect(r.limited).toContain('hamstrings');
});
it('a tiny pool exhausts regenerate and reports it', () => {
  // dumbbells-only, 2 days: loop up to 30 times accumulating shown; expect some result.exhausted === true and no throw.
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/plan/v2`. Expected: FAIL.
- [ ] **Step 3: Implement** `generate.ts`, `explain.ts`, `index.ts` and the re-exports. If the 50 ms test fails, profile `buildCandidate` first; precompute the eligible pool and meta once per `generatePlanV2` call and pass them through `Ctx`.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: pass, including the v1-vs-v2 comparison. If v2 loses on a profile, tune `SCORE_WEIGHTS` or ranking, not the test.
- [ ] **Step 5: Commit** `feat(plan): v2 best-of-N generator, regenerate and explain`

---

### Task 10: Body fat, leanness target and the look goal answers

**Files:**
- Modify: `src/domain/plan/body.ts`, `src/domain/plan/answers.ts`, `src/domain/plan/index.ts`
- Test: `src/domain/plan/body.test.ts`, `src/domain/plan/answers.test.ts`
- Modify: `src/domain/plan/v2/explain.ts` (calorie clause on the look line)

**Interfaces:**
- Produces:
  - `navyBodyFat(sex: 'male' | 'female', heightCm: number, waistCm: number, neckCm: number, hipsCm?: number): number | null`. Returns null when a log argument is ≤ 0 or `hipsCm` is missing for women.
  - `deurenbergBodyFat(sex: 'male' | 'female', bmi: number, age: number): number`
  - `interface BodyFatEstimate { pct: number; method: 'navy' | 'rough' }`
  - `estimateBodyFat(p: Profile, kg: number, nowYear: number): BodyFatEstimate | null`. Returns null without `sex` or `heightCm`; uses age 30 when there is no `birthYear`.
  - `leannessTarget(sex: 'male' | 'female'): { min: number; max: number; floor: number }`, giving `{10, 15, 8}` and `{18, 25, 16}`
  - `lookBodyGoal(est: BodyFatEstimate | null, sex?: 'male' | 'female'): BodyGoal`. Returns `maintain` when either input is missing, `lose` when pct > max, `maintain` when pct ≤ floor, `gain` when pct ≤ min, otherwise `maintain`.
  - `lookPreset(sex?: 'male' | 'female'): FocusArea[]`: male `['side-delts', 'lats', 'upper-chest']`, female `['glutes', 'side-delts', 'lats']`, otherwise `[]`
  - `PlanAnswers` gains `waistCm?`, `neckCm?`, `hipsCm?`, `style?: StyleId | 'auto'`, `customPairs?: DayLayout[]`
  - `applyAnswers` writes `planGoal`, the tape fields, `planStyle` and `customPairs`. For `look` it sets `objective: 'hypertrophy'` and `bodyGoal: lookBodyGoal(estimateBodyFat(...), sex)`.
  - `goalFromProfile` returns `p.planGoal` when set.
  - `energy()`: in a deficit the daily target is never below `tdee − kg × 0.01 × 7700 ÷ 7`.

Formulas, all lengths in cm:
- Navy, male: `495 / (1.0324 − 0.19077·log10(waist − neck) + 0.15456·log10(height)) − 450`
- Navy, female: `495 / (1.29579 − 0.35004·log10(waist + hips − neck) + 0.22100·log10(height)) − 450`
- Deurenberg: `1.20·BMI + 0.23·age − 10.8·(male ? 1 : 0) − 5.4`

- [ ] **Step 1: Write failing tests**

```ts
it('navy formula', () => {
  expect(navyBodyFat('male', 180, 85, 38)).toBeCloseTo(16.1, 1);
  expect(navyBodyFat('female', 165, 70, 32, 95)).toBeCloseTo(24.9, 1);
  expect(navyBodyFat('female', 165, 70, 32)).toBeNull();
  expect(navyBodyFat('male', 180, 30, 38)).toBeNull();
});
it('deurenberg fallback', () => { expect(deurenbergBodyFat('male', 24, 30)).toBeCloseTo(19.5, 1); });
it('look goal body goal', () => {
  expect(lookBodyGoal({ pct: 19, method: 'rough' }, 'male')).toBe('lose');
  expect(lookBodyGoal({ pct: 12, method: 'navy' }, 'male')).toBe('maintain');
  expect(lookBodyGoal({ pct: 9, method: 'navy' }, 'male')).toBe('gain');
  expect(lookBodyGoal({ pct: 7, method: 'navy' }, 'male')).toBe('maintain');
  expect(lookBodyGoal(null, undefined)).toBe('maintain');
});
it('look answers write planGoal, tape and hypertrophy', () => {
  const out = applyAnswers(emptyAppData(NOW), { ...answers, goal: 'look', sex: 'male', waistCm: 85, neckCm: 38, style: 'pairs' }, NOW);
  expect(out.profile).toMatchObject({ planGoal: 'look', objective: 'hypertrophy', waistCm: 85, planStyle: 'pairs' });
  expect(goalFromProfile(out.profile)).toBe('look');
});
it('look goal without sex has no preset and maintains', () => {
  expect(lookPreset(undefined)).toEqual([]);
  expect(applyAnswers(emptyAppData(NOW), { ...answers, goal: 'look', sex: undefined }, NOW).profile.bodyGoal).toBe('maintain');
});
it('deficit never exceeds 1% body weight a week', () => {
  // 50 kg, very active, lose: target >= tdee - 55
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/plan/body.test.ts src/domain/plan/answers.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, including the explain calorie clause: "Waist stays tight through a {n} kcal deficit, about {kg} kg a week." Use it only when `bodyGoal === 'lose'` and `energy()` returns a value.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: pass.
- [ ] **Step 5: Commit** `feat(plan): body fat estimate, leanness target and look goal answers`

---

### Task 11: Onboarding UI on v2

**Files:**
- Modify: `src/store/onboarding.ts`: steps are Welcome, Body, Goal, Tape (look only), Daily life, Calories, Experience, Schedule, Equipment, Focus, Style, Result. Replace `template` with `regen: { seed: number; shown: string[][][]; history: PlanResultV2[] }`.
- Modify: `src/screens/onboarding/steps.tsx`: "Look better (aesthetics)" goal (hint: "Shoulders, waist and lean, built by the numbers"); new `Tape` step; Focus gets the 5 new areas and is prefilled from `lookPreset(sex)` when the goal is `look` and focus is empty.
- Create: `src/screens/onboarding/StyleStep.tsx` (style cards from `eligibleStyles`, each with day titles and "Each muscle ~{x}× a week"; amber note under `LOW_FREQ`)
- Create: `src/screens/onboarding/CustomPairsSheet.tsx` (2–7 days, group chips plus Cardio, rename, live `validateCustomPairs`, Save disabled while `!ok`, red for missing groups, amber for low frequency)
- Modify: `src/screens/onboarding/Onboarding.tsx` (step switch, prefill `planStyle`, `customPairs`, tape fields)
- Modify: `src/screens/onboarding/Result.tsx` (use `generatePlanV2` + `explainV2`; buttons Regenerate, Back (disabled with no history), Use this plan; exhausted message; remove "Other options")
- Modify: `e2e/acceptance.mjs` (onboarding section)

**Interfaces:**
- Consumes: v2 index exports (Task 9), `lookPreset`, `estimateBodyFat` (Task 10).
- Tape step skip: the "Skip, use rough estimate" button sets no tape fields and advances.
- The Tape step is skipped by `next()` and `back()` when `answers.goal !== 'look'`. Add `skipTape` logic in the store so the step indices stay fixed.

- [ ] **Step 1: Write failing store test** `src/store/onboarding.test.ts`

```ts
it('skips the tape step unless the goal is look', () => {
  const s = useOnboarding.getState();
  s.start({ goal: 'build' }, 2); s.next();
  expect(useOnboarding.getState().step).toBe(4);
  s.start({ goal: 'look' }, 2); s.next();
  expect(useOnboarding.getState().step).toBe(3);
});
it('regenerate keeps history and back pops it', () => { /* push two results, back() on regen returns the first */ });
```

- [ ] **Step 2: Run** `npx vitest run src/store/onboarding.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the store, the steps, `StyleStep`, `CustomPairsSheet` and `Result`. Compose from the existing `parts.tsx`, `ChoiceList` and `Segmented`, plus the `components/ui` card/list primitives. Motion only on step transitions (existing), respecting `useReducedMotion`. Copy:
  - Regenerate exhausted: "That's every different plan for these answers"
  - Tape skip: "Skip, use rough estimate"
  - Style default card: "Let Repwise pick"
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run build`. Expected: pass.
- [ ] **Step 5: Update e2e.** In the onboarding section of `e2e/acceptance.mjs`, pick "Look better", skip tape, pick the "Pairs" style, tap Regenerate once and assert the plan text changed, then "Use this plan" and assert `d.profile.planGoal === 'look'` and `d.profile.planStyle === 'pairs'`. Run `npm run dev -- --port 5199` in the background, then `npm run e2e`. Expected: all checks pass.
- [ ] **Step 6: Commit** `feat(onboarding): look goal, tape, split style, custom pairs and regenerate`

---

### Task 12: Remove v1 and release notes

**Files:**
- Delete: `src/domain/plan/generate.ts`, `generate.test.ts`, `template.ts`, `volume.ts`, `volume.test.ts`, `explain.ts`, `explain.test.ts`
- Modify: `src/domain/plan/index.ts` (drop v1 exports), `src/domain/plan/v2/golden.test.ts` (drop the v1 comparison test)
- Modify: `package.json` version to `4.7.0`, `README.md` (plan builder bullet), `next.md` (mark sub-projects A and B shipped; list C and D next)

- [ ] **Step 1: Delete and fix imports.** Run `npm run typecheck`. Expected: errors only where v1 names were still used; replace them with the v2 exports.
- [ ] **Step 2: Run** `npm test && npm run build`. Expected: pass.
- [ ] **Step 3: Run** e2e as in Task 11 Step 5. Expected: pass.
- [ ] **Step 4: Commit** `chore: remove plan generator v1, Repwise 4.7.0`
