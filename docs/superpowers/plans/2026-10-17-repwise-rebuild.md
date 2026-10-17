# Repwise Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Repwise as a light, iOS-Fitness-style React PWA with persistent Full Body A/B/C rotation, rules-based progressive overload from actual sets, body metrics with BMI, and the existing Supabase backup.

**Architecture:** Pure TypeScript domain (`src/domain`) holds types, catalogue, planner, progression, session lifecycle, migration and stats, all unit-tested. A single Zustand store persists the `AppData` v4 document to IndexedDB and calls domain functions for every transition. React screens render the store; React Query only wraps Supabase pull/push.

**Tech Stack:** Vite, React 18, TypeScript strict, Tailwind CSS v4, Radix/vaul (shadcn-style components), lucide-react, motion, dayjs, Recharts, Zustand + idb-keyval, TanStack React Query, @supabase/supabase-js, vite-plugin-pwa, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-repwise-rebuild-design.md`

## Global Constraints

- All loads stored in kg; lb conversion (1 kg = 2.20462 lb) is display-only.
- Exercise identity = stable `id` slug; never key history by name.
- Actual set values are written only by explicit user action (typing or tapping ✓).
- Only `finishSession` and confirmed `skipPlannedSession` advance rotation, exactly once.
- Never write a service-role key; client uses `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback `sb_publishable_6aEgv0uKGkQaIIUdIEZPBQ_PtKfNWc7`) and `VITE_SUPABASE_URL` (fallback `https://mvrimyshkrwsjuwyapgw.supabase.co`).
- Local key `repwise_v4` (IndexedDB). Never delete `repwise_v2`.
- Colours: bg `#F2F2F7`, card `#FFFFFF`, label `#000`, secondary `#3C3C4399`, separator `rgba(60,60,67,0.12)`, blue `#007AFF`, green `#34C759`, orange `#FF9500`, red `#FF3B30`, purple `#AF52DE`.
- Copy says "rules-based", never "AI".
- Respect `prefers-reduced-motion`.

## Review Focus

1. Double-tap Finish / finish while a previous finish is persisting — rotation must advance once. (Task 5 test `finishSession is idempotent`.)
2. Weights entered as text with comma decimal (`62,5`) or empty — must parse to 62.5 or null, never NaN in data. (Task 7 test `parseNumber`.)
3. Workout started before midnight and finished after — session date = start date, streak/week stats use local date not UTC. (Task 7 test `localDate uses local timezone`.)
4. Cloud fetch fails on app start while local has data — local must remain and status shows error. (Task 9 test `resolveSync keeps local on error`.)
5. Profile excludes every candidate for a slot — plan must contain a visible empty slot, not silently drop it. (Task 4 test `empty slot when no candidate`.)

---

### Task 1: Scaffold

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/index.css`, `.gitignore`, `.env.example`; move legacy files to `legacy/`.

- [ ] Step 1: `git mv index.html sw.js icon.svg manifest.webmanifest legacy/`; copy `legacy/icon.svg` to `public/icon.svg` (recoloured later in Task 15).
- [ ] Step 2: Create Vite React TS project files by hand; install deps listed in Tech Stack plus `vitest`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-dropdown-menu`.
- [ ] Step 3: Scripts: `dev`, `build` (`tsc -b && vite build`), `test` (`vitest run`), `typecheck` (`tsc -b --noEmit`).
- [ ] Step 4: Verify `npm run build` succeeds with a placeholder App.
- [ ] Step 5: Commit `chore: scaffold vite react ts app, move legacy files`.

### Task 2: Domain types and catalogue

**Files:** Create `src/domain/types.ts`, `src/domain/catalogue.ts`, `src/domain/splits.ts`; Test `src/domain/catalogue.test.ts`.

**Produces:** all types from spec §3; `BUILTIN_EXERCISES: Exercise[]`; `getExercise(id, custom: Exercise[]): Exercise | undefined`; `SPLITS: Record<SplitId, SplitDef>` where `SplitDef = { id, name, sessions: { title: string; slots: Slot[] }[] }`, `Slot = { id: string; pattern: Pattern; role: 'anchor'|'accessory'; candidates: string[] }`; `emptyAppData(): AppData`.

- [ ] Step 1: Tests: every candidate id in `SPLITS` exists in `BUILTIN_EXERCISES`; ids are unique; `SPLITS['full-body-abc'].sessions.map(s=>s.title)` equals `['Full Body A','Full Body B','Full Body C']`; across A/B/C the anchor patterns include knee, hip, hpush, vpush, hpull, vpull.
- [ ] Step 2: Implement catalogue (~45 exercises incl. legacy names as `aliases?: string[]` for migration, plus run/mobility not needed) and splits per spec §6 table; Upper/Lower and PPL with same slot system.
- [ ] Step 3: `npm test` passes. Commit `feat(domain): types, exercise catalogue, split templates`.

### Task 3: Progression engine

**Files:** Create `src/domain/progression.ts`; Test `src/domain/progression.test.ts`.

**Produces:** `recommend(ex: Exercise, rx: { sets:number; repMin:number; repMax:number }, history: WorkoutSession[]): Recommendation`; `INCREMENT: Record<Exercise['equipment'], number>` = barbell 2.5, dumbbell 2, machine 2.5, cable 2.5, bodyweight 2.5.

- [ ] Step 1: Tests (weighted, rx 3×8–12, history built with helper `sess(date, [[kg,reps,status]...])`):
  - no history → `kind:'first'`, `targetKg:null`, `targetReps:[8,8,8]`, reason contains "First time".
  - last 20×[10,9,8] done → `kind:'reps'`, `targetKg:20`, `targetReps:[11,10,9]`, reason `"Keeping 20 kg. Beat 10 · 9 · 8."`.
  - last 20×[12,12,12] → `kind:'increase'`, `targetKg:22.5`, `targetReps:[8,8,8]`.
  - dumbbell 20×[12,12,12] → `targetKg:22`.
  - 2 done + 1 skipped → `kind:'hold'`, reason contains "only 2 of 3".
  - one session with a 6 at 25 → `kind:'hold'`, reason "One off day. Same target."
  - two consecutive sessions with a set below 8 at 25 → `kind:'deload'`, `targetKg:22.5`.
  - pending sets never count; sessions with `finishedAt:null` ignored.
  - bodyweight pull-up rx 3×6–10, last [10,10,10] no assist → `kind:'increase'`, reason mentions "+2.5 kg"; with `assistKg:20` → `kind:'assist'`, reason mentions 15 kg assistance.
  - timed plank rx 3×30–60 last [60,60,60] → `targetReps:[65,65,65]`.
- [ ] Step 2: Run, see failures. Step 3: implement. Step 4: pass. Step 5: commit `feat(domain): rules-based double progression`.

### Task 4: Planner

**Files:** Create `src/domain/planner.ts`; Test `src/domain/planner.test.ts`.

**Consumes:** `SPLITS`, `recommend`, `getExercise`. **Produces:** `buildPlan(data: AppData, splitId: SplitId): PlannedSession`; `planKey(splitId, idx, cycle): string`; `ensurePlan(data: AppData): AppData` (returns data with `plannedSession` rebuilt only when null or key mismatch); `swapCandidates(slot: Slot, data: AppData): Exercise[]`.

- [ ] Step 1: Tests: same input twice → deep-equal; A, B, C exercise id sets differ; 45 min → 5 exercises and all anchors present; 75 → 7 (or all slots if fewer); accessory candidate changes between cycle 1 and 2 when slot has ≥2 eligible; exclusion of `back-squat` makes A's knee slot use next candidate; **empty slot when no candidate** (exclude all knee candidates → planned exercise with `exerciseId:''`); hypertrophy anchor rx 3×6–10, strength anchor 4×4–6; `ensurePlan` returns same object reference when key matches.
- [ ] Steps 2–5: fail, implement, pass, commit `feat(domain): deterministic split planner`.

### Task 5: Session lifecycle

**Files:** Create `src/domain/session.ts`; Test `src/domain/session.test.ts`.

**Produces (all pure `(data, ...) => AppData`):** `startSession(data, now)`, `updateSet(data, exIdx, setIdx, patch: Partial<SetRecord>)`, `confirmSet(data, exIdx, setIdx)` (fills null actuals from targets, status done), `skipSet`, `addSet`, `swapExercise(data, exIdx, exerciseId)`, `skipExercise`, `moveExercise(data, from, to)`, `addExercise(data, exerciseId)`, `finishSession(data, now)`, `discardSession(data)`, `skipPlannedSession(data)`, `setSplit(data, splitId)`, `editHistorySet(data, sessionId, exIdx, setIdx, patch)`, `deleteHistorySession(data, sessionId)`. Each sets `meta.updatedAt`.

- [ ] Step 1: Tests: start copies plan targets (`targetKg`, `targetReps[i]`) with `status:'pending'`, actuals null; confirmSet on empty row → actuals = targets; confirmSet keeps typed values; finish A → rotation `{sessionIndex:1, cycle:1}` and plannedSession null; finish C (idx 2) → `{0, 2}`; **finishSession is idempotent** (calling on result again leaves rotation & sessions length unchanged); discard → rotation unchanged; editHistorySet and deleteHistorySession → rotation unchanged; setSplit to another split keeps other split's rotation and clears plannedSession; swapExercise recomputes rec for new id and resets that exercise's pending sets' targets.
- [ ] Steps 2–5: fail, implement, pass, commit `feat(domain): session lifecycle with single rotation advance`.

### Task 6: Migration and import

**Files:** Create `src/domain/migrate.ts`, `src/domain/fixtures/v2.json`; Test `src/domain/migrate.test.ts`.

**Produces:** `migrateV2(v2: unknown, now: string): AppData`; `parseImport(json: string): { ok: true; data: AppData; summary: { sessions:number; bodyweights:number; from?:string; to?:string } } | { ok:false; error:string }`; `isEmpty(data: AppData): boolean`; `normalize(doc: unknown, now): AppData | null` (accepts v4, `{version:3,state}`, raw v2).

- [ ] Step 1: Tests with fixture (2 sessions incl. "Incline dumbbell press" and unknown "Ring rows", 2 weights): names map to catalogue ids, unknown → custom exercise `custom-ring-rows`; sets `done` with actuals and null targets; weights preserved; `meta.migratedFrom==='repwise_v2'`; migrating twice gives deep-equal output; `parseImport('{"foo":1}')` → `ok:false`; `parseImport` on v4 export round-trips.
- [ ] Steps 2–5: fail, implement, pass, commit `feat(domain): v2 migration and validated import`.

### Task 7: Stats and helpers

**Files:** Create `src/domain/stats.ts`, `src/lib/format.ts`; Test `src/domain/stats.test.ts`.

**Produces:** `localDate(iso: string): string` (YYYY-MM-DD local); `parseNumber(s: string): number | null`; `bmi(kg, heightCm): number | null` (1 decimal); `latestWeight(data)`; `weekStats(data, now) → { sessions, sets, streakWeeks }`; `exerciseHistory(data, exerciseId) → { date, bestKg, bestReps, volume, sets: SetRecord[] }[]`; `bestSet(data, exerciseId)`; `sessionPRs(data, session) → { exerciseId, kg, reps }[]` (heaviest load beaten, or more reps at best load); `toDisplay(kg, units)`, `fromDisplay(v, units)`.

- [ ] Step 1: Tests: `parseNumber('62,5')===62.5`, `parseNumber('')===null`, `parseNumber('abc')===null`; `bmi(70,175)===22.9`; **localDate uses local timezone** (`process.env.TZ='Asia/Kolkata'` set in vitest config; `localDate('2026-10-16T20:00:00Z')==='2026-10-17'`); weekStats counts Monday-start weeks; streakWeeks counts consecutive weeks with sessions ≥ daysPerWeek (current week counted if met, otherwise starting last week); volume sums only done sets; PR detection ignores skipped sets.
- [ ] Steps 2–5: fail, implement, pass, commit `feat(domain): stats, BMI, PRs, formatting helpers`.

### Task 8: Store and persistence

**Files:** Create `src/store/app.ts`, `src/store/boot.ts`.

**Consumes:** Tasks 4–6. **Produces:** `useApp` Zustand store `{ data: AppData; hydrated: boolean; act(fn: (d: AppData) => AppData): void; replace(d: AppData): void }` persisted via `idb-keyval` under `repwise_v4`; `act` applies `ensurePlan` after every transition. `boot()` runs once after hydration: if no v4 data and `localStorage.repwise_v2` exists → back up to `repwise_v2_backup` and migrate; back up `repwise_progression_v3` if present; call `navigator.storage?.persist?.()`.

- [ ] Step 1: Implement; verify in dev server that refresh preserves a set value typed into the active session (manual, Task 16).
- [ ] Step 2: Commit `feat: persisted app store with v2 boot migration`.

### Task 9: Supabase sync

**Files:** Create `src/sync/client.ts`, `src/sync/resolve.ts`, `src/sync/useSync.ts`; Test `src/sync/resolve.test.ts`.

**Produces:** `resolveSync(local: AppData, remote: { ok:true; doc: AppData|null } | { ok:false }) → { action: 'push'|'take'|'keep'|'error'; data: AppData }`; `useSync()` hook → `{ user, status: 'local'|'syncing'|'synced'|'error', signIn(email), signOut(), retry() }`. Pull via React Query `useQuery(['cloud', userId])`, push via `useMutation` debounced 1500 ms on `data.meta.updatedAt` change. Before `take` with non-empty local, write local JSON to `localStorage.repwise_v4_before_cloud`.

- [ ] Step 1: Tests: remote null → push; local empty + remote non-empty → take; both non-empty, remote newer → take; local newer → push; **resolveSync keeps local on error** → action `error`, data === local; remote v2 shape normalised.
- [ ] Steps 2–5: fail, implement, pass, commit `feat: supabase backup sync with safe conflict rules`.

### Task 10: UI kit and shell

**Files:** Create `src/components/ui/{button,card,sheet,segmented,list,alert,input,menu}.tsx`, `src/components/{TabBar,LargeTitle,Rings,Stepper}.tsx`, `src/lib/cn.ts`, `src/lib/route.ts`, `src/App.tsx`.

**Produces:** `useRoute()` hash router → `{ tab: 'today'|'history'|'progress'|'profile'; sheet: string | null; go(tab), open(sheet), close() }` (Android back closes sheets). `Rings({ rings: {value:number; max:number; color:string}[] })` animated SVG concentric rings. `Sheet` = vaul drawer full-height with grabber. `LargeTitle` collapses into blurred inline header on scroll.

- [ ] Step 1: Implement; App renders TabBar + current tab placeholder. Build passes. Commit `feat(ui): iOS-style kit, tab shell, rings`.

### Task 11: Today screen

**Files:** Create `src/screens/Today.tsx`, `src/screens/SplitPicker.tsx`, `src/screens/LogExtra.tsx`.

- [ ] Step 1: Implement per spec §8 Today, including no-split empty state (SplitPicker cards for the 3 splits), Resume when `activeSession` exists, "Skip this session" in hero menu with confirm, Log extra sheet (type, minutes, km, note).
- [ ] Step 2: Commit `feat(ui): Today screen`.

### Task 12: Active workout

**Files:** Create `src/screens/Workout.tsx`, `src/screens/workout/{ExerciseCard,SetRow,RestTimer,FinishSummary,ExercisePicker}.tsx`.

- [ ] Step 1: Implement per spec §8. Set row inputs are `inputMode="decimal"`, values parsed with `parseNumber`, shown in user units. ✓ calls `confirmSet` then starts rest timer (exercise `restSec`) persisted as `restEndsAt` in component state; vibrate `[200,100,200]` at zero. Finish button disabled while finishing; computes PRs before calling `finishSession`; summary shows duration, done sets, volume, PRs.
- [ ] Step 2: Commit `feat(ui): active workout logging`.

### Task 13: History

**Files:** Create `src/screens/History.tsx`, `src/screens/SessionDetail.tsx`.

- [ ] Step 1: Week-grouped list (sessions + extras), exercise filter, detail with target vs actual per set, edit actual via inline inputs, delete session with confirm. Commit `feat(ui): history and session detail`.

### Task 14: Progress

**Files:** Create `src/screens/Progress.tsx`, `src/screens/progress/{Strength,Body}.tsx`.

- [ ] Step 1: Strength: exercise picker, Recharts line (best load or reps for bodyweight; volume toggle), best set, last vs previous. Body: weigh-in form (same date → confirm overwrite), range segments, chart, list with edit/delete, BMI card with formula, weigh-in date and height used, screening note. Commit `feat(ui): progress strength and body`.

### Task 15: Profile, data, PWA

**Files:** Create `src/screens/Profile.tsx`, `src/screens/profile/{Training,Library,Account,DataTools,HowItWorks}.tsx`; Modify `vite.config.ts` (VitePWA `filename:'sw.js'`, `registerType:'autoUpdate'`, manifest name "Repwise", theme `#F2F2F7`); `public/icon.svg`.

- [ ] Step 1: Profile sections per spec §8; split change sheet explains rotation; export downloads `repwise-backup-YYYY-MM-DD.json` of `AppData`; import shows `parseImport` summary, downloads current backup, then `replace`. Commit `feat(ui): profile, library, account, data tools, PWA`.

### Task 16: Verify, document, ship to preview

**Files:** Create `README.md`.

- [ ] Step 1: `npm test`, `npm run typecheck`, `npm run build` all pass.
- [ ] Step 2: Run dev server; in Chrome at 412×915 walk brief Part 11 acceptance tests (split persistence, A→B→C→A cycle 2, refresh mid-workout keeps values, double Finish, discard doesn't advance, progression reason after logging, BMI, weigh-in refresh, export/import).
- [ ] Step 3: README per brief Part 12 (only implemented features). Commit `docs: README`.
- [ ] Step 4: Push `dev`, open PR to `main`. Preview deploy depends on Vercel access (report).
