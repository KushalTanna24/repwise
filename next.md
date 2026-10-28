# Next

## Custom split builder

Let people build their own split instead of picking one of the fixed four.

- Recommendations come from the selected experience level and session length (`profile.experience`, `profile.sessionMinutes`), the same inputs the planner already uses for sets and exercise count.
- Only offer exercises the user has enabled in Equipment & exercises (respect `profile.equipment`, `excludedExerciseIds`, `archivedExerciseIds`; reuse `isEligible`).
- Open question: start from a suggested full split the user then edits, or start from blank days with suggestions per day.
- Touches the planner: `SplitId` is a closed union and `SPLITS` a fixed record today, so custom splits need their own storage and rotation entry. Needs a written spec before building.
