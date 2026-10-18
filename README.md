# Repwise

A personal workout PWA for one person training full body three times a week. It keeps your place in a training split, builds each session from what you actually lifted last time, and tracks strength, body weight and BMI. The look is light, iOS-Fitness style. It is built to be installed on an Android phone.

Recommendations are **rules-based**, not AI.

## Status

| Phase | State |
|---|---|
| 0. Baseline audit and source recovery | Done. Live app committed to `main` as `legacy-v2` |
| 1–6. Rebuild: split rotation, progression, logging, history, metrics, sync | Implemented on `dev` |
| 7. QA and release | Unit and browser acceptance tests pass locally. Preview deploy pending Vercel access |

## Features

- **Today**: next session in your split (e.g. Full Body B · Cycle 3), its exercises with sets × reps and target load, Start / Resume, weekly rings (workouts, sets, week streak), last workout, latest weight, log extras (run, mobility, skills).
- **Active workout** (full-height sheet):
  - Each set row is `kg | reps | ✓`, with targets shown as placeholders. One tap on ✓ logs the target, or whatever you typed.
  - Rest timer starts automatically and vibrates when it ends.
  - Swap, add, reorder or skip exercises. Skip or remove individual sets.
  - Assistance logging for bodyweight moves.
  - Everything is saved on each tap and survives refresh.
  - Finish shows duration, sets, volume and new bests.
- **Exercise guides**: an ⓘ button on every exercise (Today and workout) opens setup, steps, cues and common mistakes for all 49 built-in exercises, plus a "Watch a demo" YouTube search. Works offline.
- **Water**: one tap logs a 250 ml glass, with undo. The daily goal is set in Profile. It feeds the Today ring and a 7-day chart on Progress → Body.
- **Rebuild workout**: swaps in different accessories while keeping the main lifts, so their progress stays comparable. Refresh keeps the rebuilt plan.
- **Launch splash**: logo, name, then your goal note (about 2 s; tap to skip).
- **Notifications**:
  - Permission is asked from a tap.
  - While rest runs and the app is in the background, you get alerts 10 s before the end and at the end. Tapping one reopens the workout.
  - An iOS-style banner greets you on the first open of each day.
  - Water reminders arrive as Web Push, even with the app closed. Turn them on in Profile → Reminders → Water reminders and pick the window (From/To hours) and how often (every 1–4 h). They need sign-in, and work on Android (the home-screen install, or Chrome). Not on iPhone yet: iOS only delivers push to a home-screen install, and that install can't be signed in with a magic link. In-app sign-in is planned. See "Push deploy" below.
  - Today also shows loud water-pace and supplement-overdue nudges.
- **History**: workouts and extras grouped by week, with a filter by exercise. The detail view shows target vs actual for every set. You can edit actuals or delete a workout; neither changes the rotation.
- **Progress → Strength**: per-exercise best set, last vs previous, a top-set or volume chart, and a session list. Only done sets count.
- **Progress → Body**: weigh-ins (add, edit, delete; same date asks before replacing), a 1M–All chart, and BMI with the formula, the weigh-in it used, and a note on its limits.
- **Supplements**: a built-in library with a pre-filled stack (creatine, whey protein, multivitamin).
- **Profile**: a you-card plus seven rows that open sheets: split, goal, experience, days per week, session length, units (kg/lb), height, target weight, goal note, equipment, exercise library (exclude built-ins; add, rename or archive custom exercises), reminders, magic-link backup, and JSON export and restore.

## Stack

Vite · React 18 · TypeScript (strict) · Tailwind CSS v4 · Radix + vaul (shadcn-style components) · lucide-react · motion · dayjs · Recharts · Zustand (persisted to IndexedDB via idb-keyval) · TanStack React Query (Supabase calls only) · @supabase/supabase-js · vite-plugin-pwa · Vitest · puppeteer-core (acceptance script).

## Architecture

```
src/domain/      pure, unit-tested logic (no React)
  types.ts         AppData v4 document and all entity types
  catalogue.ts     built-in exercises with stable ids; emptyAppData()
  splits.ts        Full Body A/B/C, Upper/Lower, PPL as slot templates
  planner.ts       buildPlan / ensurePlan: deterministic session from rotation + history
  progression.ts   recommend(): double progression with explanations
  session.ts       start/log/finish/discard/skip; the only rotation advance
  library.ts       custom exercises, archive, exclusions
  migrate.ts       repwise_v2 → v4, import validation
  stats.ts         week stats, PRs, history points, BMI, units
src/store/       Zustand store persisted to IndexedDB; first-run migration
src/sync/        Supabase client, resolveSync rules, sync engine hook
src/screens/     Today, Workout, History, SessionDetail, Progress, Profile, sheets
src/components/  UI kit (button, card/list, sheet, alert, menu, segmented, fields), Screen, TabBar, Rings, Chart
legacy/          the recovered single-file app that was live before the rebuild
e2e/             headless Chrome walk-through of the acceptance tests
```

Every state change goes through `act(fn)`, where `fn` is a pure domain function `(AppData) => AppData`. After every change the store stamps `meta.updatedAt` and calls `ensurePlan`.

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest, domain + sync rules
npm run typecheck
npm run build
# acceptance walk-through (needs Chrome installed):
npm run dev -- --port 5199 --strictPort
npm run e2e          # writes screenshots to e2e/shots/
```

### Environment variables

| Name | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL. Falls back to the existing project. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase **publishable** key. Falls back to the existing public key. Never put a service-role key here. |
| `VITE_VAPID_PUBLIC_KEY` | Web Push public key (see "Push deploy"). Water reminders stay off without it. |

See `.env.example`. `.env*` files are git-ignored.

## Authentication and Supabase

- Email magic link (`signInWithOtp`, redirect to the app origin). Sessions persist and auto-refresh.
- The app shows a "You're signed in" banner after a link works and "That link expired or was already used" when it doesn't. A sign-in made in a Chrome tab is picked up by the installed app.
- iPhone: a home-screen install doesn't share storage with Safari, so a link opened in Safari can't sign the installed app in. Sign in from a Safari tab instead.
- Table `public.repwise_user_data (user_id, workout_data jsonb, updated_at)`. One row per user, upserted on `user_id`. Row-level security limits each user to their own row (verified: an anonymous select returns `[]`). The client only ever uses the publishable key.
- `workout_data` holds the whole `AppData` v4 document, so no schema migration was needed.

## Local persistence and storage keys

| Key | Where | Contents |
|---|---|---|
| `repwise_v4` | IndexedDB (`keyval-store`) | Current document (`schemaVersion: 4`) |
| `repwise_v2` | localStorage | Legacy app data. Read once, never modified |
| `repwise_v2_backup` | localStorage | Untouched copy of `repwise_v2`, made before migration |
| `repwise_progression_v3_backup` | localStorage | Raw copy of `repwise_progression_v3` if present (shape unknown, not imported) |
| `repwise_v4_before_cloud` | localStorage | Local document saved just before a cloud copy replaced it |
| `repwise_rest` | localStorage | Rest timer end time |

The app calls `navigator.storage.persist()` so Android doesn't evict the data.

## Data migration

On first run, when no `repwise_v4` exists and `repwise_v2` does:

1. Copy the raw v2 string to `repwise_v2_backup`.
2. Map the data to v4:
   - Exercise names map to catalogue ids by name or alias. Unknown names become custom exercises with slug ids.
   - Each v2 set becomes a `done` set with actuals and no target.
   - Weigh-ins map 1:1.
   - Profile goal, equipment, days and exclusions map where possible.
3. The split is not guessed; you pick it.

The migration is deterministic, and it is idempotent because it only runs when v4 is absent. JSON import uses the same normaliser, so v4 exports, old `{version: 3, state}` exports and raw v2 all load.

## Workout planning and split rotation

- A split is an ordered list of sessions. Each session is a list of **slots** (movement pattern, role, candidate exercises).
- **Anchors** (main lifts) always take the first candidate that fits your equipment, exclusions and archive. They stay the same every cycle so progress is comparable.
- **Accessories** take candidate `(cycle − 1) mod n`, so they rotate predictably between cycles.
- Session length caps the number of exercises: 45 min → 5, 60 → 6, 75 → 7. Accessories are trimmed first.
- Sets and reps come from the goal:
  - Build muscle: anchors 3×6–10, accessories 3×10–15.
  - Strength: anchors 4×4–6.
  - General: 3×8–12.
  - Timed moves: 3×30–60 s.
- The plan is stored in `plannedSession` and keyed `split:index:cycle`. Refreshing shows the same plan. It is rebuilt only when the rotation moves, when a profile or library change clears it, or when you tap "Rebuild plan".
- **The rotation advances only on two events**: finishing a workout that has at least one done set (`finishSession`, idempotent by session id) or a confirmed "Skip this session". Refreshing, viewing or editing history, and discarding never move it. Each split remembers its own position.

## Progressive overload rules

`recommend()` looks at the most recent finished session containing that exercise, and only at sets marked **done**.

| Last time | Next target |
|---|---|
| Never done | Load blank; "pick a weight you could do ~2 more reps with" |
| Fewer sets done than prescribed | Hold the load and reps |
| Any set below the range minimum, once | Hold ("One off day") |
| Below the minimum two sessions in a row at the same load | Drop one increment |
| Every set at the top of the range | Add one increment, reps back to the bottom |
| Otherwise | Same load, +1 rep on each set |

Increments: barbell 2.5 kg, dumbbell 2 kg, machine and cable 2.5 kg.

For bodyweight moves at the top of the range: if you logged assistance, the target drops assistance by 5 kg; otherwise it suggests +2.5 kg added load. Timed holds add 5 s. Every target shows its reason, built from the actual numbers.

## Sync and conflict rules

The cloud is a backup for one device. On sign-in or app start, `resolveSync` applies these rules in order:

1. A failed or unreadable fetch is an error. Local data is kept and nothing is pushed.
2. There is no cloud row: push local.
3. The cloud copy is empty: push local. Local is empty: take the cloud copy.
4. Both have data: the newer `meta.updatedAt` wins. Before taking the cloud copy, local is saved to `repwise_v4_before_cloud`.

Pushes wait until a pull has succeeded. After that, local changes are pushed 1.5 s after the last edit. A failure shows "Not backed up" with a Retry button.

## Backup and restore

- **Export**: Profile → Export backup downloads the full v4 document as JSON.
- **Restore**: Profile → Restore from file.
  - The file is validated and summarised (workout and weigh-in counts, date range).
  - You confirm before anything changes.
  - Your current data is downloaded first, then replaced. Unsupported or newer versions are rejected with a message.

## Testing

- `npm test`: 91 Vitest tests covering:
  - progression rules, including the 10/9/8 → 12/12/12 example from the brief
  - planner determinism, coverage, equipment and exclusion fallbacks, and empty slots
  - rotation: advances exactly once; discard, refresh, history and edits don't move it
  - migration and import validation
  - stats: timezone, week streak, PRs, BMI and units
  - sync conflict rules
- `npm run e2e`: 18 browser checks at 412×915 that follow the brief's acceptance tests. Covers split persistence, A → B → C → A of cycle 2, values surviving a mid-workout refresh, discard, history target vs actual, progression reasons, BMI, the weight chart, and no console errors.

## Deployment, preview and production

- `main` holds the recovered live baseline (tag `legacy-v2`). Work happens on `dev` and reaches `main` through a pull request.
- The live project served static files. Before the first deploy of this branch, set the Vercel project's framework preset to **Vite** (build `npm run build`, output `dist`). The service worker is written to `/sw.js`, the same path as the legacy one, so installed clients update cleanly.
- **Preview first**: connect the GitHub repo to the existing Vercel project (each branch then gets a preview URL), or deploy with the Vercel CLI. Production promotion needs explicit approval.

### Push deploy

Water reminders need these one-time steps:

1. `npx web-push generate-vapid-keys`
2. `supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:info@optin8.com`
3. Supabase Dashboard → Vault: add a secret named `service_role_key` whose value is the legacy `service_role` JWT (the same value as the function's `SUPABASE_SERVICE_ROLE_KEY`, found under Project Settings → API Keys → Legacy). Not an `sb_secret_…` key: with a different key every cron run is rejected with 401.
4. `supabase db push` (creates `push_subscriptions` and the hourly `water-nudge-hourly` cron job)
5. `supabase functions deploy water-nudge --no-verify-jwt`
6. Vercel → Project → Settings → Environment Variables: `VITE_VAPID_PUBLIC_KEY` = the public key from step 1, then redeploy.

To check it, run `select * from cron.job_run_details order by start_time desc limit 5;` and `select * from net._http_response order by created desc limit 5;` in the SQL editor.

## Rollback

- Vercel dashboard → Deployments → the previous production deployment → **Instant Rollback**, or
- redeploy tag `legacy-v2`: at that tag the repo root is exactly the four static files that were live (the same files are kept in `legacy/` on `dev`).

Local data is not affected by a rollback. The legacy app still reads `repwise_v2`, which the rebuild never modifies. Anything logged in v4 lives in `repwise_v4` and in the cloud row.

## Known issues and limits

- Vercel deployment history and the `repwise_progression_v3` build could not be inspected (no Vercel access during the rebuild).
- Renaming a custom exercise uses the browser's prompt dialog.
- Rest alerts rely on Android keeping a backgrounded PWA's timers alive, which holds for the first few minutes. Very long rests may miss the alert.
- Magic-link sign-in needs the Supabase Auth URL configuration (Site URL and Redirect URLs set to the production domain) and, for reliable delivery, custom SMTP. Both are set in the Supabase dashboard, not in this repo.
- Cloud sync is designed for one device. Two devices editing offline would resolve by last write wins.
- The streak counts weeks where the number of workouts met your days-per-week target.
