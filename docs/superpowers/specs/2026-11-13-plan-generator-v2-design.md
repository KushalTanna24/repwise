# Plan generator v2 and the "Look better" goal: design

Date: 2026-11-13 · Target release: Repwise 4.7.0 · Status: approved in conversation, awaiting written-spec review

## Goal

Replace the plan builder's generator with one that produces splits a lifter would actually choose, and add a "Look better (aesthetics)" goal on top of it. This is the first of four lookmaxxing sub-projects:

| Sub-project | Scope | Spec |
|---|---|---|
| A. Plan generator v2 | Finer muscle groups, scored exercise choice, split styles including custom pairs, regenerate with variety, history-aware volume | This document |
| B. "Look better" goal | New goal answer, body-fat estimate, leanness target, male and female presets | This document |
| C. Looks tab: daily routine | Skincare, posture, sleep and grooming checklist with streaks | Later spec |
| D. Looks tab: tips library | Evidence-graded guides on skin, hair, posture, body fat, style and face basics | Later spec |

## Why v1 falls short

Observed by the owner and confirmed in `src/domain/plan/generate.ts`:

1. **Groups are too coarse.** Ten groups. "Shoulders" merges front, side and rear delts, so overhead press can fill the shoulder target with zero lateral raises. "Back" merges lats, mid back and traps. No upper chest, neck or forearms.
2. **Exercise choice is weak.** Ties break on catalogue order. Nothing scores how good a move is for the muscle.
3. **Few split styles, no variety.** The template is fixed by days per week (4 days is always Upper/Lower). There is no pairing split like the owner's own (Chest + Biceps, Back + Triceps, Shoulders + Legs, Cardio + Abs). Rerunning with the same answers always returns the same plan.
4. **Volume ignores the person.** Every group starts from the same base, focus groups are multiplied, and workout history plays no part.

## Decisions

| Topic | Decision |
|---|---|
| Architecture | A pipeline of small pure stages in `src/domain/plan/v2/`, with best-of-N candidate search. v1 is deleted once v2 passes the comparison tests. |
| Muscle groups | 17 groups (below). Front delts default to no direct work. Neck and forearms default to 0 and switch on by focus or the look goal. |
| Volume | Evidence-based weekly sets, adjusted by real history (baseline, per-muscle response, finish rate). |
| Split choice | A style step in the builder: "Let Repwise pick" (default) or a named style. "Custom pairs" is an advanced style with its own editor. |
| Regenerate | Same answers, next-best plan that differs by at least 40% from plans already shown in this run. "Back" restores the previous one. Nothing saves until "Use this plan". |
| Look goal | New `PlanGoal` value `look`. Optional tape measurements for body fat, leanness target, presets by sex, all editable. |
| Out of scope | Steroids, SARMs, extreme cuts, bone smashing, face or jaw claims, food logging, the Looks tab itself (C and D). |

## Evidence base

All numbers are hard working sets, taken close to failure.

1. **Weekly volume drives growth, with diminishing returns** (Schoenfeld, Ogborn and Krieger 2017; Pelland et al. 2024; Baz-Valle et al. 2022).
2. **Indirect sets count about half** (Pelland et al. 2024). Primary mover 1, secondary 0.5.
3. **Per-session returns flatten past about 8 to 10 direct sets per muscle** (Pelland et al. 2024). Treated as a per-session cap.
4. **Frequency matters little once volume is equal** (Schoenfeld et al. 2016, 2019), but the per-session cap means a muscle trained once a week cannot reach high weekly volume. Styles that train a muscle under 1.3 times a week get a warning, not a block.
5. **Maintenance takes about one third of growth volume** (Bickel et al. 2011). Floor of 6 sets for non-focus groups.
6. **Lengthened-position training helps growth** (Maeo et al. 2021; Pedrosa et al. 2022). Isolation picks favour moves that load the stretched position.
7. **Order matters** (Simão et al. 2012). Compounds and focus muscles first, abs and cardio last.
8. **Body fat estimates.** US Navy tape method (Hodgdon and Beckett 1984), about ±3–4%. Fallback from BMI, age and sex (Deurenberg et al. 1991), labelled rough.
9. **Rate of loss.** At most about 0.5–1% of body weight a week to keep muscle (Helms et al. 2014). Protein 1.6–2.2 g/kg (Morton et al. 2018).

## A. Plan generator v2

### Muscle groups

| Region | Groups |
|---|---|
| Chest | `upper-chest`, `chest` |
| Back | `lats`, `upper-back` (mid back and rhomboids), `traps` |
| Shoulders | `front-delts`, `side-delts`, `rear-delts` |
| Arms | `biceps`, `triceps`, `forearms` |
| Neck | `neck` |
| Legs | `quads`, `hamstrings`, `glutes` (includes hip abduction), `calves` |
| Core | `abs` (includes obliques) |

Major groups for target purposes: `chest`, `lats`, `upper-back`, `quads`, `hamstrings`, `glutes`. `upper-chest` counts as small unless it is a focus.

Focus areas (pick up to 3): the existing `chest`, `back`, `shoulders`, `arms`, `legs`, `glutes`, `abs`, plus new `upper-chest`, `side-delts`, `lats`, `traps-neck`, `forearms`. Each maps to one or more groups in `groups.ts`. Existing saved `focus` values keep their meaning.

### Weekly targets (`targets.ts`)

**Evidence defaults:**

| Experience | Major groups | Small groups |
|---|---|---|
| Beginner | 8–10 (use 9) | 6 |
| Intermediate | 10–14 (use 12) | 8 |
| Advanced | 12–18 (use 15) | 10 |

- `front-delts`: 0 direct by default; pressing credits it through the 0.5 rule.
- `neck`, `forearms`: 0 unless a focus or the look goal turns them on (4–6 and 4 sets).
- Focus groups: +30–50% (use +40%), capped at 14 for beginners and 20 otherwise. On a cut (`bodyGoal = 'lose'`) the bonus is +15%.

**History adjustments** (`history.ts` feeds `targets.ts`). Applied only when the person has at least 3 weeks with 2 or more finished sessions a week:

1. **Baseline.** Real weekly sets per group over the last 4–6 weeks, using fractional counting on done sets. The target is the evidence number, but never more than +20% or +4 sets (whichever is smaller) above the baseline. If the baseline already exceeds the evidence number, keep the baseline, up to the cap.
2. **Response.** For each group, the estimated 1RM trend (Epley, best done set per session) of exercises where that group is primary, over 6–8 weeks, plus adherence (finished sessions divided by expected sessions from `daysPerWeek`):
   - Trend up (at least +1% over the window): hold.
   - Flat (within ±1%) for 3 or more weeks and adherence at least 75%: +2 sets, up to the cap.
   - Down more than 3%, or adherence under 60%: hold; if the target is above the evidence number, −2.
3. **Finish nudge.** If the median share of planned exercises finished over the last 6 sessions is below 80%, the per-session exercise limit drops by 1 and the plan says so.

**Fitting the time budget** keeps v1's rule: trim non-focus groups toward the floor of 6 first, then focus groups toward their base.

Every adjustment produces a reason, for example "Side delts 12 sets (+2): lateral raise flat 3 weeks."

### Split styles (`styles.ts`)

Weekly frequency of a group = appearances in the cycle × `daysPerWeek` ÷ cycle length, because Repwise rotates rather than using weekdays.

| Style | Days | Layout |
|---|---|---|
| Full body | 2–3 | Full A / B / C |
| Upper / Lower | 3–4 | U / L / U / L; 3-day version U / L / Full |
| PPL | 3 or 6 | Push / Pull / Legs |
| Hybrid PPL | 4–5 | PPL + Upper / Lower (5); PPL + Arms & delts (4) |
| Arnold | 3 or 6 | Chest + Back / Shoulders + Arms / Legs |
| Pairs | 4–6 | Chest + Biceps / Back + Triceps / Shoulders + Legs / Cardio + Abs; 5-day version (used at 5 and 6 days) splits Shoulders and Legs |
| Bro split | 5–6 | Chest / Back / Shoulders / Arms / Legs |
| Custom pairs | 2–7 | User-defined days of groups (and optional cardio) |

A day is a list of groups plus an optional `cardio` flag. Abs may be added to any day by `allocate`.

**"Let Repwise pick"** scores each eligible style: focus groups at 1.5 or more times a week, time fit, and no day carrying too many groups for the session length. Highest score wins; ties go to the simpler style (fewer distinct day types).

**Custom pairs editor (sheet):** 2–7 days; each day takes group chips (the 17 groups plus Cardio) and a name. A group with a target above 0 that appears on no day is shown in red and Save is disabled. Groups under 1.3 times a week get an amber note. The saved layout lives in `profile.customPairs` so a rerun can reuse it.

**Cardio + Abs day:** a `cardio` slot logged as minutes (10 for 45-minute sessions, 15 for 60, 20 for 75 and 90). Modalities: incline walk, bike, rower, stairs, run, each gated by equipment. Abs fill the rest.

### Allocation (`allocate.ts`)

Spread each group's weekly target across the days that include it, as evenly as possible, never more than the per-session cap (about 8–10 direct sets, scaled down to whole exercises). Groups whose target cannot fit on their days are recorded as short with a reason.

### Exercise metadata (`exerciseMeta.ts`)

One record per catalogue exercise:

| Field | Meaning |
|---|---|
| `muscles` | Map of group to 1 (primary) or 0.5 (secondary) |
| `tier` | S, A or B: how well the move trains its primary group (stable, loadable, full range) |
| `stretch` | True when it loads the primary group at long length (overhead triceps extension, incline curl, Romanian deadlift, cable fly) |
| `fatigue` | Low, medium or high systemic cost |
| `skill` | Low or high; high-skill moves are excluded for beginners |

Custom exercises without metadata derive `muscles` from the existing `exerciseMuscles()` mapping and default to tier B, no stretch, medium fatigue, low skill.

### Selection (`select.ts`)

Builds one candidate plan from a seed. For each day and each allocated group, rank eligible exercises by:

1. The first exercise for a major group on a day is a compound; later ones are isolation.
2. Tier, then a stretch bonus for isolation.
3. History: a bonus for moves logged and progressed on, a penalty for moves often swapped out or skipped.
4. No repeated movement pattern within a day; at most 2 high-fatigue compounds a day.
5. Seeded jitter, small enough that it only reorders near-equal options.

The seeded PRNG is a small deterministic function (for example mulberry32) in `v2`, not `Math.random`.

### Plan score and best-of-N (`score.ts`, `generate.ts`)

`generate` builds 20 candidates from seeds `runSeed + i` and scores each whole plan:

| Term | Measures |
|---|---|
| Coverage | Distance from each group's target, focus groups weighted ×2 |
| Frequency | Focus groups touched on 2 or more days where the style allows |
| Variety | The same exercise at most twice a week, main lifts excepted |
| Day fit | Exercise count within the session limit and minimum |
| Order | Compounds first, abs and cardio last |
| Quality | Mean tier and stretch value of picks |
| History match | Share of picks that history ranks well |

It returns the best candidate. Regenerate returns the best candidate whose exercise set differs by at least 40% (Jaccard distance on exercise ids) from every plan already shown in this run, drawing a fresh batch of 20 when needed. When no distinct plan remains, the result says "That's every different plan for these answers" and cycles back to the first. Same seed and same data always give the same plan.

### Explain (`explain.ts`)

Why lines covering the chosen style and its frequencies, each target adjustment and its reason, short or limited groups with a fix ("No side-delt move with your equipment. Add dumbbells or cable in Profile."), and the finish nudge.

## B. "Look better" goal

- **Goal answer:** "Look better (aesthetics)" joins lose, build, strength and fit. It sets `objective = 'hypertrophy'`. `bodyGoal` is `lose` when estimated body fat is above the leanness target's upper bound, otherwise `maintain` (or `gain` at the lower bound and below).
- **Tape step** (look goal only, skippable): waist and neck, plus hips for women. Navy formula. Skipping uses the Deurenberg estimate, labelled "rough estimate".
- **Leanness target:** men 10–15%, women 18–25%. The app never recommends going below 8% for men or 16% for women; at or under that it states that maintaining is the healthy choice.
- **Calories:** reuses `energy()` and `intakeAdvice()`. Deficit capped at about 0.5–1% of body weight a week. Protein 1.6–2.2 g/kg.
- **Presets** (prefilled focus, fully editable):
  - Male V-taper: `side-delts`, `lats`, `upper-chest`; neck and traps on at 4–6 sets, forearms at 4.
  - Female shoulders-waist-glutes: `glutes`, `side-delts`, `lats`; neck and forearms off.
  - Both: `side-delts` and `rear-delts` never below 8 weekly sets, focus or not.
  - No sex given: the person picks focus areas with no preset.
- **Why line example:** "V-taper: side delts 14 sets and lats 14 sets lead the week. Waist stays tight through a 350 kcal deficit, about 0.5 kg a week. Body fat ~19% (rough), aim 12–15%."

## Code layout

```
src/domain/plan/v2/
  groups.ts         17 groups, labels, focus-area mapping
  exerciseMeta.ts   per-exercise muscles, tier, stretch, fatigue, skill
  history.ts        real weekly sets, e1RM trend, adherence, finish rate, likes and skips
  targets.ts        evidence + history + goal + budget -> weekly sets and reasons
  styles.ts         style catalogue, eligibility, frequency, custom pairs validation
  allocate.ts       weekly sets -> per-day sets under the session cap
  select.ts         seeded candidate builder
  score.ts          plan score and plan distance
  generate.ts       best-of-N, regenerate state
  explain.ts        why lines
  rng.ts            seeded PRNG
  index.ts          public API
```

Also changed:

- `src/domain/plan/body.ts`: `navyBodyFat`, `estimateBodyFat`, `leannessTarget`.
- `src/domain/plan/answers.ts`: `PlanGoal` gains `look`; `PlanAnswers` gains tape fields, `style` and `customPairs`.
- `src/domain/catalogue.ts` and `src/domain/guides.ts`: new exercises with guides.
- `src/domain/training`: `cardio` pattern and prescription in minutes, reusing the existing `timed` kind.
- `src/domain/types.ts`: optional `Profile` fields `planGoal`, `waistCm`, `neckCm`, `hipsCm`, `planStyle`, `customPairs`; `FocusArea` gains the new values.
- `src/domain/migrate.ts`: defaults for the new optional fields only. Older synced copies load unchanged.
- `src/screens/onboarding/`: goal option, tape step, style step, custom pairs sheet, result screen with Regenerate, Back and Use this plan.

### New catalogue entries

| Area | Exercises |
|---|---|
| Chest | Incline barbell press, incline machine press, pec deck |
| Back and traps | Dumbbell shrug, barbell shrug, assisted pull-up |
| Neck | Plate neck curl, plate neck extension |
| Forearms | Wrist curl, reverse curl |
| Arms | Preacher curl, incline dumbbell curl, skull crusher |
| Glutes | Hip abduction machine, cable glute kickback |
| Cardio (timed) | Incline walk, bike, rower, stairs, run |

Every new exercise gets a guide in the existing setup, steps, cues and mistakes format.

## States

- Generation is synchronous and takes milliseconds, so there is no loading state.
- Limited group: an inline note naming the group and the equipment that would unlock it.
- Invalid custom pairs: inline red message, Save disabled.
- Regenerate exhausted: "That's every different plan for these answers", then cycle.
- No history: evidence defaults, with a line saying the plan will adapt after a few weeks of training.

## Testing

- Unit tests for every v2 file.
- Golden profiles: owner's Pairs split at 5 days; female look goal; beginner 2 days; advanced 6 days; dumbbells-only home; a cut with 8 weeks of history including a stalled lift.
- Invariants checked on every golden profile and every regenerate step:
  - every group with a target above 0 is trained;
  - focus groups reach at least 90% of target;
  - no day exceeds its exercise limit or the per-session cap;
  - look goal gives `side-delts` at least 8 sets;
  - consecutive regenerated plans differ by at least 40%;
  - same seed and data give an identical plan;
  - 20 candidates generate in under 50 ms in Vitest.
- Comparison: v2's plan score is at least v1's on every golden profile before v1 is removed.
- End-to-end: update `e2e/acceptance.mjs` onboarding flow for the goal, tape and style steps and one Regenerate.
