# Next

## Custom split builder (shipped in 4.5.0)

People can build their own split: start blank or from any split, edit days and exercises, and switch between splits while each keeps its place. Splits, rotation and progression now live in one `domain/training` module.

## App-wide restructure (after the split builder)

Apply the same module pattern to the rest of the app.

- Split `Today.tsx` (618 lines) into feature widgets.
- Give water, supplements, challenges and fasting their own domain modules, each with one public `index.ts`.
- Break `domain/types.ts` up by feature.
- Needs its own spec.
