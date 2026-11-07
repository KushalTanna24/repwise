# Next

## Custom split builder (in design)

Let people build their own split instead of picking one of the fixed four. Spec in progress under `docs/superpowers/specs/`. It starts with a refactor that moves splits, rotation and progression into one `domain/training` module.

## App-wide restructure (after the split builder)

Apply the same module pattern to the rest of the app.

- Split `Today.tsx` (618 lines) into feature widgets.
- Give water, supplements, challenges and fasting their own domain modules, each with one public `index.ts`.
- Break `domain/types.ts` up by feature.
- Needs its own spec.
