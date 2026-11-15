# Next

## Pro splits and week view (built, awaiting release)

A library of 12 routines from famous bodybuilders, actors and athletes that people can copy into their own splits, fitted to their equipment and session length. The week strip and split cards now follow days per week, so a 3-day split on 6 days shows all six sessions. Swaps are now recorded (`swappedFrom`) for the learning work below. Spec: `docs/superpowers/specs/2026-11-16-pro-splits-and-learning-design.md`.

## Learn from the user (after pro splits)

Suggest swaps the user keeps making, log and suggest supersets, flag stalled lifts, and project strength toward goals. Explainable, can be undone, history never rewritten. See the spec above, section 3.

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
