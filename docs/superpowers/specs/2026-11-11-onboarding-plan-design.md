# Onboarding and plan builder: design

Date: 2026-11-11 · Target release: Repwise 4.6.0 · Status: approved in conversation, awaiting written-spec review

## Goal

A new user answers a short set of questions on first launch. The app sets a body goal, a calorie and protein estimate, and an evidence-based training split built around the muscles they want to focus on. The split is an ordinary custom split. The user can edit it in the existing split builder, including adding an "Abs + focus muscles" day.

## Decisions

| Topic | Decision |
|---|---|
| Focus muscles | The user picks 1 to 3 focus areas. Height, weight and BMI never choose muscles. They only shape the body goal, calories and volume. |
| Body goal | The user chooses from Lose fat, Build muscle, Get stronger and Stay fit. BMI preselects a suggestion, but the user always decides. |
| Sex and age | Optional. They are needed only for the calorie estimate (Mifflin-St Jeor). Without them the calorie card is hidden and protein still shows. |
| Calories | Estimate only: maintenance (TDEE), a daily target, protein, and a comparison with the intake the user typed. No food logging. |
| Abs day | Allowed. When added, it is filled as "Abs + focus muscles": 6 to 9 core sets, then the user's focus muscles. Core work stays spread over the other days too, and a one-line note explains why. |
| Output | One recommended split saved as a `CustomSplit` and set active. It comes with "why" lines, an Edit button (the existing split editor) and up to 2 other options. |
| Who sees it | First launch only, when the document has no sessions, no split and no `onboardedAt`. Existing users are marked onboarded by `normalize()`. Profile gets a "Build my plan" row to run it again. |
| Out of scope | Food logging, re-planning when weight changes, editing sets and reps per exercise. |

## Evidence base

Each rule below cites the source it rests on. All numbers are hard working sets (taken close to failure).

1. **Weekly volume drives growth, with diminishing returns.** About 10 or more weekly sets per muscle beats fewer (Schoenfeld, Ogborn and Krieger 2017). Gains keep rising, more slowly, toward about 20 sets (Pelland et al. 2024; Baz-Valle et al. 2022).
2. **Indirect sets count about half.** A set where the muscle is a secondary mover counts 0.5 (Pelland et al. 2024). This matches the existing `exerciseMuscles()` weighting used by the muscle heat map.
3. **Frequency matters little once volume is equal** (Schoenfeld et al. 2016, 2019). Spreading volume over 2 or more days keeps per-session volume in a productive range. Per-session returns flatten past about 6 to 8 hard sets per muscle (Pelland et al. 2024). The app treats this as a practical ceiling, not a hard limit.
4. **Maintenance takes far less volume.** About one third of training volume keeps muscle (Bickel et al. 2011). The floor for a non-focus muscle is 6 sets a week.
5. **Order matters.** Muscles trained earlier in a session respond better (Simão et al. 2012). Focus muscles go first after the day's main compound lift.
6. **No spot reduction.** Training a region does not burn its fat (Vispute et al. 2011; Ramírez-Campillo et al. 2013). Visible abs need low body fat. The app says so when Abs is a focus and BMI is 25 or more.
7. **Energy.** BMR uses the Mifflin-St Jeor equation (Mifflin et al. 1990), the most accurate common equation for non-obese and obese adults (Frankenfield et al. 2005). A deficit of about 20% (roughly 0.5 to 1% of bodyweight a week) protects muscle (Helms et al. 2014). A lean gain uses about +10% (Iraki et al. 2019).
8. **Protein.** 1.6 g/kg/day is enough for most people (Morton et al. 2018). Use 2.0 to 2.2 g/kg in a deficit (Helms et al. 2014). When BMI is over 30, protein uses the weight at BMI 25 for the user's height, so the target is not inflated.

## Onboarding flow

Full screen, one question per screen, with Back and a progress bar. Steps animate with `motion` and honour `prefers-reduced-motion`. In-progress answers live in a small Zustand draft store and are written to `AppData` only when the user finishes.

1. **Welcome.** "Build my plan" (primary). "Skip, I'll pick a split" sets `onboardedAt` and closes. "Have an account? Sign in" opens the existing `SignInCard`, so a cloud restore never shows onboarding again.
2. **Body.** Height (cm), weight (kg or lb, following the units toggle), sex (Male / Female / Skip), age (or Skip). Weight is saved as a weigh-in in `bodyweights`.
3. **Main goal.** Lose fat / Build muscle / Get stronger / Stay fit. BMI from the Body step preselects: 25 or more suggests Lose fat, under 18.5 suggests Build muscle, otherwise nothing is preselected. A one-line hint says why, and that BMI misreads muscular people.
4. **Daily life.** Mostly sitting / On my feet / Physical work.
5. **Calories.** "About how many calories do you eat a day?" Number or "Not sure".
6. **Experience.** Beginner (under 1 year) / Intermediate (1 to 3 years) / Advanced (3+ years).
7. **Schedule.** Days per week (2 to 6) and session length (45 / 60 / 75 / 90).
8. **Equipment.** Same choices as the existing Equipment sheet.
9. **Focus.** Pick 1 to 3: Chest, Back, Shoulders, Arms, Legs, Glutes, Abs. "No preference" gives a balanced plan.
10. **Result.** The split by day, the why lines, and the energy card. "Start with this" saves and activates the split. "Edit" saves, activates and opens the split editor. "Other options" shows up to 2 alternatives with one line each on how they differ.

Goal mapping to the existing `Profile.objective`: Lose fat and Build muscle map to `hypertrophy`, Get stronger to `strength`, Stay fit to `general`. The new `bodyGoal` holds `lose`, `gain` or `maintain`. Get stronger and Stay fit map to `maintain`.

## Body maths: `domain/plan/body.ts`

Pure functions. Weight comes from the latest weigh-in.

- `bmiBand(bmi)`: `under` (below 18.5), `healthy` (18.5 to 25), `over` (25 to 30), `obese` (30 or more).
- `bmr(sex, kg, cm, age)` = 10·kg + 6.25·cm − 5·age + (male: +5, female: −161).
- `activityFactor(activity, daysPerWeek)`: sitting is 1.2, on feet 1.375, physical 1.55, plus one step up (0.175, capped at 1.725) when training 3 or more days a week.
- `energy(profile, kg)` returns `{ tdee, target, proteinG, intakeDelta? }` or `null` when sex or age is missing (protein is then returned on its own).
  - Target: lose is TDEE × 0.8, gain is TDEE × 1.1, maintain is TDEE. Rounded to 50 kcal.
  - Floors: target is never below 1200 kcal (female) or 1500 kcal (male).
  - No deficit is suggested when age is under 18 or BMI is under 18.5. The target falls back to maintenance and a note says why.
  - Intake comparison: within 10% of TDEE is "about maintenance". Otherwise it shows "about N kcal below/above maintenance" with a hint that matches the goal.
- Every energy view carries the footnote "Estimate, not medical advice."

## Split algorithm: `domain/plan/`

Pure and deterministic: the same answers and data always give the same split.

### Volume groups

Ten groups carry targets: chest, back (lats + traps), shoulders (side and front delts), biceps, triceps, quads, hamstrings, glutes, calves, abs. Rear delts, lower back, forearms and obliques are covered indirectly and have no target.

Focus areas map onto groups: Chest → chest. Back → back. Shoulders → shoulders. Arms → biceps, triceps. Legs → quads, hamstrings, calves. Glutes → glutes. Abs → abs.

### `volume.ts`: weekly set targets

- Base by experience for major groups (chest, back, shoulders, quads, hamstrings, glutes): beginner 10, intermediate 12, advanced 14. Minor groups (biceps, triceps, calves, abs): 2 fewer.
- Focus groups: base × 1.5, rounded, capped at 20 (beginner cap 14). In a deficit the multiplier is 1.25.
- Floor for any group: 6.
- Budget: `days × MAX_EXERCISES[sessionMinutes] × setsPerExercise`, where `setsPerExercise` comes from the existing `prescription()` for the user's objective and experience.
- If the summed direct sets exceed the budget, non-focus groups are reduced first, in steps of one set, largest first, down to the floor. Only then are focus groups reduced, but never below their base.
- Counting uses primary = 1 set and secondary = 0.5 (from `exerciseMuscles`). An overhead press gives shoulders 1 and triceps 0.5.

### `template.ts`: day layout by days per week

| Days | Template | Day focuses |
|---|---|---|
| 2 | Full Body A / B | full, full |
| 3 | Full Body A / B / C | full, full, full |
| 4 | Upper / Lower × 2 | upper, lower, upper, lower |
| 5 | Upper / Lower / Push / Pull / Legs | upper, lower, push, pull, legs |
| 6 | Push / Pull / Legs × 2 | push, pull, legs, push, pull, legs |

Each template declares which groups each day may train. With 2 or more days, every group appears on at least 2 days. Alternatives for "Other options": 3 days also offers Upper / Lower / Full, 4 days offers PPL + Abs & focus, and 5 days offers PPL + Upper / Lower.

### `generate.ts`: from targets to slots

1. **Distribute:** each group's weekly target is split evenly across the days that may train it. Any remainder goes to the earliest days. Each day is capped at 8 direct sets per group (beginner 6).
2. **Convert to slots:** sets ÷ `setsPerExercise`, rounded to the nearest whole exercise. Every allowed group gets at least 1 slot unless its weekly target is already met.
3. **Pick exercises:** the first slot of a group on a day is an anchor using a compound movement. Later slots are accessories with up to 2 alternates that rotate by cycle, like the custom builder. Eligibility, beginner machine-first ordering and no duplicates within a day reuse `isEligible` and `BEGINNER_ORDER` from the planner.
4. **Order:** the day's main compound first, then focus groups, then other compounds, then isolation, then core last.
5. **Fit the session:** if a day exceeds `MAX_EXERCISES`, drop non-focus accessories from the end. Focus slots and anchors are never dropped.
6. **Check and report:** recount achieved weekly sets per group. These numbers feed the why lines.
7. **Output:** a `CustomSplit` named "Your plan · {template name}", with `copiedFrom` unset, saved through `saveCustomSplit` and activated through the rotation module's `setSplit`.

### Why lines: `explain.ts`

Short sentences, at most 6, focus groups first. Examples:
- "Chest: 15 sets a week across 2 days (focus)."
- "Other muscles: 10 to 12 sets a week, enough to keep growing."
- "Abs show when body fat is low. Your calorie target does more for them than an extra abs day." (only when Abs is a focus and BMI is 25 or more)
- "Beginners grow on less. Volume rises as you progress." (beginner)

## Abs + focus day in the editor

- New `DayFocus` value `abs-focus`, labelled "Abs + focus muscles", in `domain/training/splits/suggest.ts`.
- `suggestDay(data, 'abs-focus')` fills 2 to 3 core slots (6 to 9 sets), then slots for `profile.focus` groups up to the session limit. With no focus set it fills core plus arms and shoulders.
- When this day is added to a split that has no core on any other day, the day editor shows one line: "Abs recover fast. A few sets on other days work as well as one long abs day."

## Data changes

`Profile` gains optional fields. `schemaVersion` stays 4 because every field is optional.

```ts
sex?: 'male' | 'female';
birthYear?: number;               // age stays current
activity?: 'sitting' | 'feet' | 'physical';
intakeKcal?: number;
bodyGoal?: 'lose' | 'maintain' | 'gain';
focus?: FocusArea[];              // 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'abs'
onboardedAt?: string;
```

`normalize()` sets `onboardedAt` to the document's `meta.updatedAt` when it has sessions or a split, so existing users never see onboarding. Sync needs no change: it is the same document.

## Code layout

```
src/domain/plan/
  index.ts       Public API: energy, buildPlanFromAnswers, alternatives, explain.
  body.ts        BMI band, BMR, TDEE, targets, protein.
  volume.ts      Weekly set targets and budget fitting.
  template.ts    Day layouts by days per week, plus alternatives.
  generate.ts    Targets to slots to CustomSplit.
  explain.ts     Why lines.
src/screens/onboarding/
  Onboarding.tsx Step machine and full-screen shell.
  steps/*.tsx    One file per step.
  Result.tsx     Split preview, why lines, energy card, actions.
src/store/onboarding.ts  Draft answers (Zustand, not persisted).
```

Screens import only from `domain/plan/index.ts` and `domain/training/index.ts`. `App.tsx` renders `Onboarding` instead of the tabs when the gate is true. The Body sheet gains a read-only energy card, and Profile gains a "Build my plan" row.

## Error and edge states

- Missing or out-of-range height or weight: the step blocks Next with an inline message (height 100 to 250 cm, weight 30 to 300 kg).
- Equipment too limited to fill a group: the slot uses the closest eligible pattern, and the why lines say "Limited equipment: some {group} work uses bodyweight."
- No eligible exercise for an anchor: the slot is skipped and the group's achieved sets show the shortfall. The plan is still saved.
- Rerun from Profile: creates a new custom split and activates it. The old split remains in the user's list.

## Testing

Vitest, domain only:
- Mifflin-St Jeor known values for both sexes, activity factors, rounding, floors, under-18 and underweight guards, and the BMI > 30 protein weight.
- Volume invariants across every combination of days (2 to 6), experience (3), session length (4) and focus set (none, each single area, sample pairs and triples):
  - every group at or above its floor
  - focus groups at or above non-focus groups
  - total direct sets within budget
  - no day over the per-group session cap
  - no day over `MAX_EXERCISES`
  - every group on 2 or more days when days ≥ 2
- Determinism: the same input always gives the same split.
- `abs-focus` suggestions: core first, then focus groups.
- `normalize()` marks existing documents as onboarded and leaves empty ones alone.

E2E: add an onboarding run to `e2e/acceptance.mjs`. It answers every step, lands on Today with the plan active, opens Edit, adds an Abs + focus day and saves.
