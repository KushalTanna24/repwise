# Repwise Rebuild — Design Spec

Date: 2026-10-17
Status: Approved in brainstorming (sections 1–5)
Brief: `docs/brief.txt`

## 1. Context and intent

Repwise is a personal workout PWA with exactly one user, training **3× per week, full body, in a full commercial gym**, on **one Android phone** (installed PWA). The goal is an app that is fun to use and nails the core loop: know today's session, log it fast, get sensible next targets from what was actually lifted, and see progress. Explicit instruction: **do not over-engineer**.

### Baseline audit (2026-10-17)

- GitHub `KushalTanna24/repwise` was empty. Live production (`repwise-eta.vercel.app`) is four static files: `index.html` (vanilla JS, 36,123 bytes, complete), `sw.js` (cache-first, never registered by the page), `icon.svg`, `manifest.webmanifest`. These were committed to `main` as `ef88da2`, tagged `legacy-v2`.
- Storage key `repwise_v2`: `{ profile, sessions[{id,date,split,emphasis,sets[{name,group,tags,load,reps}]}], weights[{date,weight}] }`. Export format `{ version: 3, state }`.
- Supabase table `public.repwise_user_data (user_id, workout_data jsonb, updated_at)`, RLS on (anonymous select returns `[]`). Auth is email magic link; client uses the publishable key.
- Vercel: no CLI or connector access in this environment. Historical deployments and the `repwise_progression_v3` build could not be inspected.
- The user confirmed there is no important existing data. Migration from `repwise_v2` is still supported for safety.

### User decisions

| Decision | Choice |
|---|---|
| Stack | Vite + React + TypeScript rebuild (approach A) |
| Look | Light theme, iOS Fitness feel |
| Device | Android only, one device; cloud = backup/restore |
| Main split | Full Body A/B/C (Upper/Lower and PPL also available) |
| Running / mobility / skills | Kept as optional off-rotation "extras" |
| Scope | Simple and fun; defaults in code over configuration |

## 2. Stack

- Vite, React 18, TypeScript (strict), Tailwind CSS, shadcn/ui-style components (Radix primitives), lucide-react icons, `motion` for animation, dayjs for dates, Recharts for charts.
- Zustand with `persist` to IndexedDB (`idb-keyval`) for the app document.
- TanStack React Query for Supabase pull/push only.
- `@supabase/supabase-js` from npm, `vite-plugin-pwa` (output `sw.js`).
- Vitest for tests.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key only; never a service-role key). Defaults fall back to the existing project's public URL and publishable key so the build works without a `.env`.

## 3. Data model (`schemaVersion: 4`)

One JSON document. Stored locally in IndexedDB key `repwise_v4` and remotely in `repwise_user_data.workout_data`.

```ts
type Kg = number; // all loads stored in kg; lb is display-only

interface AppData {
  schemaVersion: 4;
  profile: {
    heightCm?: number;
    units: 'kg' | 'lb';
    experience: 'beginner' | 'intermediate' | 'advanced';
    objective: 'hypertrophy' | 'strength' | 'general';
    daysPerWeek: number;          // 2..6, drives weekly ring target
    sessionMinutes: 45 | 60 | 75;
    equipment: Equipment[];       // default: full gym
    excludedExerciseIds: string[];
    goalNote?: string;
    targetWeightKg?: number;
  };
  program: {
    splitId: 'full-body-abc' | 'upper-lower' | 'ppl' | null;
    rotation: Record<SplitId, { sessionIndex: number; cycle: number }>;
  };
  customExercises: Exercise[];    // user-created; built-ins live in code
  archivedExerciseIds: string[];
  plannedSession: PlannedSession | null;
  activeSession: WorkoutSession | null;
  sessions: WorkoutSession[];     // finished, newest last
  extras: ExtraSession[];
  bodyweights: { id: string; date: string /* YYYY-MM-DD */; kg: Kg }[];
  meta: { updatedAt: string; migratedFrom?: 'repwise_v2'; migratedAt?: string };
}

interface Exercise {
  id: string;                     // stable slug, never changes
  name: string;                   // label only
  muscle: string;
  pattern: Pattern;               // knee | hip | hpush | vpush | hpull | vpull | core | arms | calves | shoulders
  equipment: 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';
  kind: 'weighted' | 'bodyweight' | 'timed';
  custom?: boolean;
}

interface PlannedExercise {
  exerciseId: string;
  slotId: string;
  role: 'anchor' | 'accessory';
  sets: number;
  repMin: number; repMax: number;  // seconds for timed
  restSec: number;
  rec: Recommendation;             // frozen at plan time
}

interface PlannedSession {
  key: string;                     // `${splitId}:${sessionIndex}:${cycle}`
  splitId: SplitId; sessionIndex: number; cycle: number;
  title: string;                   // "Full Body B"
  exercises: PlannedExercise[];
  createdAt: string;
}

interface SetRecord {
  targetReps: number | null; targetKg: Kg | null;
  actualReps: number | null; actualKg: Kg | null;
  assistKg?: Kg | null; addedKg?: Kg | null;
  status: 'pending' | 'done' | 'skipped';
  note?: string;
}

interface WorkoutSession {
  id: string;
  planKey: string | null;          // null for legacy/imported
  splitId: SplitId | null; sessionIndex: number | null; cycle: number | null;
  title: string;
  startedAt: string; finishedAt: string | null;
  exercises: { exerciseId: string; plan: Omit<PlannedExercise,'rec'> | null; rec: Recommendation | null; sets: SetRecord[]; skipped?: boolean }[];
  note?: string;
}

interface ExtraSession { id: string; date: string; type: 'run' | 'mobility' | 'skills'; minutes?: number; distanceKm?: number; note?: string }

interface Recommendation { targetKg: Kg | null; targetReps: number[]; reason: string; kind: 'first' | 'hold' | 'increase' | 'reps' | 'deload' | 'assist' }
```

### Invariants

1. Exercise identity is the `id`. Renaming a custom exercise changes `name` only. Removing it adds it to `archivedExerciseIds`; history is never deleted.
2. Targets and actuals are separate fields. Actuals are only written by explicit user action.
3. `finishSession` is one atomic store transition: move `activeSession` into `sessions` with `finishedAt`, advance `rotation[splitId]` once, set `plannedSession = null`. If a session with the same `id` is already in `sessions`, it is a no-op.
4. Only `finishSession` and an explicit, confirmed `skipPlannedSession` advance the rotation. Refresh, viewing history, editing history, and discarding never do.

## 4. Migration and import

- On boot, if `repwise_v4` is absent and `localStorage.repwise_v2` exists: copy the raw string to `localStorage.repwise_v2_backup` (if not already there), map to v4, set `meta.migratedFrom`. `repwise_v2` is left untouched. Idempotent: guarded by presence of `repwise_v4`.
- Mapping: each v2 set name maps to a catalogue id by case-insensitive name/alias; unknown names become custom exercises with slug ids. Each v2 set becomes a `done` SetRecord with `actualKg = load`, `actualReps = reps`, no target. Sessions keep date; `planKey = null`. Weights map 1:1. Split is not inferred (user picks it).
- JSON import accepts v4 documents, `{ version: 3, state }`, and raw v2 state. It validates shape, shows a summary (counts of sessions/weigh-ins and date range) and requires confirmation; the current document is downloaded as a backup file before replacing.
- If `repwise_progression_v3` is present in localStorage, its raw value is copied to `repwise_progression_v3_backup` and ignored (shape unknown).

## 5. Sync

- Push: when signed in, any store change debounces 1.5 s then upserts `{ user_id, workout_data, updated_at }`. On failure the status becomes "Not synced · Retry"; the next change or manual retry pushes again.
- Pull: on sign-in (and on app start when a session exists), fetch the row.
  - No row → push local.
  - Row exists, local is empty (no sessions, no bodyweights) → take cloud.
  - Both non-empty → newer `meta.updatedAt` wins; if cloud wins, the local document is first saved to `localStorage.repwise_v4_before_cloud`.
  - Fetch error → keep local, show error; never treat as empty.
- Cloud documents in v2 shape are passed through the migrator.

## 6. Planner

Pure function `buildPlan(profile, splitId, rotationState, history, catalogue) → PlannedSession`.

- Split = ordered list of session templates. Template = ordered slots `{ id, pattern, role, candidates: exerciseId[] }`.
- Candidate choice: filter by equipment and exclusions and archive; anchors take the first eligible candidate; accessories take eligible candidate at `cycle % eligible.length`. Deterministic.
- No eligible candidate → planned exercise with `exerciseId = ''` and reason "No option for your equipment"; UI prompts a pick.
- Session length trims accessories from the end: 45 → 5 exercises, 60 → 6, 75 → 7 (anchors are never trimmed).
- Prescription by objective: hypertrophy anchors 3×6–10, accessories 3×10–15; strength anchors 4×4–6, accessories 3×8–12; general 3×8–12. Timed: 3×30–60 s. Rest: anchors 150 s, accessories 90 s.

### Full Body A/B/C

| Slot | A | B | C |
|---|---|---|---|
| Knee | Back squat (anchor) | Bulgarian split squat (accessory) | Leg press (anchor) |
| Hip | Leg curl (acc) | Romanian deadlift (anchor) | Hip thrust (acc) |
| H-push | Bench press (anchor) | — | Incline DB press (anchor) |
| V-push | — | Overhead press (anchor) | — |
| H-pull | Chest-supported row (anchor) | Seated cable row (acc) | — |
| V-pull | — | Lat pulldown (anchor) | Pull-up (anchor) |
| Shoulders | Lateral raise (acc) | — | Face pull / rear-delt fly (acc) |
| Arms | — | Curl variations (acc) | Triceps variations (acc) |
| Calves | — | Calf raise (acc) | — |
| Core | Plank (acc) | — | Hanging knee raise (acc) |

Upper/Lower (2 sessions) and PPL (3 sessions) use the same slot system.

The plan is persisted in `plannedSession`. It is rebuilt only if missing, if its `key` no longer matches the rotation, or on explicit "Rebuild plan". Starting a workout copies the plan into `activeSession`.

## 7. Progression

Pure function `recommend(exercise, prescription, history) → Recommendation`. Uses only `done` sets of the most recent finished sessions containing that `exerciseId`.

| Condition (last session) | Target | Reason template |
|---|---|---|
| No history | load null, reps = repMin… | "First time: pick a weight you could do ~2 more reps with." |
| Done sets < prescribed sets | same load, same reps as last | "Holding: only {n} of {m} sets done last time." |
| All prescribed sets done and all reps ≥ repMax | load + increment, reps = repMin | "All sets hit {repMax} at {kg}. Up to {kg+inc}, aim for {repMin}." |
| All done, not all at top | same load, each set +1 (cap repMax) | "Keeping {kg}. Beat {r1 · r2 · r3}." |
| Two consecutive sessions with any set below repMin at the same load | load − increment (min 0), reps = repMin | "Two tough sessions at {kg}. Drop to {kg−inc}, rebuild." |
| One session with set below repMin | hold | "One off day. Same target." |

- Reference load = the most common `actualKg` among done sets (ties → max).
- Increments: barbell 2.5, dumbbell 2, machine 2.5, cable 2.5. Results rounded to the increment.
- Bodyweight: reps progress as above; at top → if last `assistKg` > 0 recommend assist − 5 ("assist" kind), else recommend `addedKg` +2.5. Never invent bodyweight or assistance.
- Timed: +5 s target when all sets hit target.
- Recommendations are frozen into the plan, so the reason shown always matches the data at plan time.

## 8. UI

Light iOS Fitness look: background `#F2F2F7`, white cards (radius 20), hairline separators `rgba(60,60,67,0.12)`, large titles 34/700 collapsing on scroll, translucent blurred tab bar, Inter font. Semantic colours: blue `#007AFF` action, green `#34C759` done, orange `#FF9500` rest, red `#FF3B30` destructive, purple `#AF52DE` PR highlights. Rings in iOS activity style.

Tabs: **Today**, **History**, **Progress** (segments Strength / Body), **Profile**. Active workout = full-screen sheet.

- Today: date eyebrow, hero card (session title, cycle, exercise list with sets×reps, Start / Resume), weekly rings (sessions vs daysPerWeek, sets this week vs daysPerWeek × 15, streak in weeks meeting target), last workout, latest weight, "Log extra". Empty states: no split chosen (split picker), no history.
- Active workout: elapsed timer, Finish. Exercise cards with reason chip, "Last · …", set rows `[#] [kg] [reps] [✓]`, placeholders = targets, ✓ on empty row confirms targets, swipe/long-press menu skip. Rest pill auto-starts after ✓ with `navigator.vibrate` at zero. Card menu: swap (same slot candidates + any exercise), skip, reorder, add exercise. Every change persists. Finish → summary sheet (duration, sets, volume, PRs) with ring animation. Discard requires confirmation.
- History: list grouped by week; detail with target vs actual per set; edit actuals/delete session (does not touch rotation). Exercise filter.
- Progress/Strength: exercise picker (only exercises with history), line chart of best set load and session volume, best set (heaviest load at most reps), last vs previous. Bodyweight exercises chart reps.
- Progress/Body: weigh-in add (date, kg; same date overwrites with confirm), list with edit/delete, chart with 1M/3M/6M/1Y/All, BMI card `kg / m²` showing which weigh-in and height used plus a screening-measure note.
- Profile: training profile, split change sheet, equipment, exclusions, units, exercise library (built-in list, custom add/rename/archive), account (magic link, status, sign out), data (export, import with preview), "How recommendations work" (rules-based, not AI).

Motion explains state changes only (sheet presentation, set check, ring fill, PR badge); respects `prefers-reduced-motion`.

## 9. Testing

Vitest unit tests for `src/domain`: progression table rows (including the 10/9/8 → 12/12/12 brief example), planner determinism and A/B/C coverage, equipment/exclusion fallback, rotation advance-once and no-advance cases, migration of a v2 fixture (idempotent), import validation. Then `tsc --noEmit`, `vite build`, and a manual pass in Chrome at Android width covering brief Part 11.

## 10. Delivery

- `main` = `legacy-v2` baseline. Work on `dev`, milestone commits, PR to `main`.
- Preview deploys need Vercel access (user to connect the repo in Vercel or run `npx vercel login`). Production promotion only with explicit approval. Rollback: Vercel instant rollback or redeploy tag `legacy-v2`.
- README rewritten to describe the real implementation.

## Out of scope

Goal-milestone engine, multi-device merge, running programming, AI features, relational Supabase schema.
