# Next

## Lookmaxxing, part 2: Looks tab daily routine (next)

A checklist tracker for skincare, posture, sleep and grooming with streaks, built on the challenges model. Needs its own spec.

## Lookmaxxing, part 3: Looks tab tips library (after the routine)

Evidence-graded guides on skin, hair, posture, body fat, style and face basics, in the exercise-guide format. Needs its own spec.

## Plan generator v2 and "Look better" goal (shipped in 4.8.0)

The plan builder was rebuilt as a pipeline in `domain/plan/v2`: 17 muscle groups (upper chest, side and rear delts, lats vs upper back, traps, neck, forearms), scored exercise choice, split styles (Full body, Upper/Lower, PPL, Hybrid PPL, Arnold, Pairs, Bro split and Custom pairs), best of 20 candidates with a Regenerate that gives a properly different plan, and weekly volume that adapts to logged history. A "Look better (aesthetics)" goal adds a tape-measure body-fat estimate, a leanness target and V-taper or shoulders-waist-glutes presets. Spec: `docs/superpowers/specs/2026-11-13-plan-generator-v2-design.md`.

## Onboarding and plan builder (shipped in 4.6.0)

New users answer a short set of questions (body, goal, daily life, calories, experience, schedule, equipment and up to three focus muscles) and get an evidence-based custom split plus a calorie and protein estimate. The split builder gains an "Abs + focus muscles" day, and Profile has "Build my plan" to run it again.

## Custom split builder (shipped in 4.5.0)

People can build their own split: start blank or from any split, edit days and exercises, and switch between splits while each keeps its place. Splits, rotation and progression now live in one `domain/training` module.

## App-wide restructure (after the split builder)

Apply the same module pattern to the rest of the app.

- Split `Today.tsx` (618 lines) into feature widgets.
- Give water, supplements, challenges and fasting their own domain modules, each with one public `index.ts`.
- Break `domain/types.ts` up by feature.
- Needs its own spec.
