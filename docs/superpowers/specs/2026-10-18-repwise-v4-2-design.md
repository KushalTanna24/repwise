# Repwise 4.2 — Sign-in that shows itself, supplement library, calmer Profile, water nudges

Date: 2026-10-18 · Status: approved in chat, pending spec review · Builds on `2026-10-17-repwise-v4-1-design.md`

## Intent

After real use the user reported:

- Tapping the magic link opens the app but nothing happens. No success is shown, and Profile still asks for an email.
- Recommendations should be loud and in the face, especially for water: remind them to drink when water isn't logged, including a phone notification.
- Supplements should come from a built-in library, like exercises do.
- Profile is too long and cluttered. It should be restructured, and the "How recommendations work" explainer removed.

Devices: mainly Android with Repwise installed to the home screen. An iPhone user (the user's brother) may start soon.

Decisions made in chat:

- Sign-in stays **magic link only** (option B). No 6-digit code and no passwords. Known limit: on iPhone, a home-screen install does not share storage with Safari, so the iPhone user signs in from a Safari tab. A code option can be added later without rework.
- Water reminders use **real server push** (Supabase scheduled function + Web Push), so they arrive with the app closed.
- New users start with a **pre-filled stack**: creatine, whey, multivitamin.
- Profile problem is **length and clutter**, not visual style. Keep the current iOS look.

Build order: 1 sign-in fix, 2 supplement library, 3 Profile restructure, 4 water nudges and push.

## 1. Magic link sign-in

### Confirm the root cause first

Before changing code, reproduce on a real Android home-screen install and record:

- The URL the link lands on: implicit flow (`#access_token=…&type=magiclink`), PKCE (`?code=…`) or an error (`#error=access_denied&error_code=otp_expired…`).
- Whether the link opens in a Chrome tab or in the installed app.
- The Supabase dashboard's Site URL and Redirect URLs. `supabase/config.toml` only configures the local stack. Production must allow `https://repwise-eta.vercel.app` and `https://repwise-eta.vercel.app/**`.

If the cause is something the changes below don't cover, stop and revise this section before fixing.

### Changes

- **Success is shown.** `useSyncEngine` already sets `user` from `onAuthStateChange`. When the user goes from `null` to a signed-in user on a `SIGNED_IN` event, show a full-width confirmation: "You're signed in as {email}. Backing up now." It must not appear on a normal launch with a stored session (`INITIAL_SESSION`).
- **Link errors are shown.** At startup, before Supabase clears the URL, read `error_code` and `error_description` from the hash and the query string. For `otp_expired` or an access-denied error, show "That link expired or was already used" with a "Send a new link" action that opens the Profile sign-in card with the last email filled in. Then remove the error parameters from the URL with `history.replaceState`, keeping the `#/tab` route.
- **The app picks up a sign-in made in another tab.** On Android the link usually opens in a Chrome tab, which shares storage with the installed app. Re-check the session with `supabase.auth.getSession()` when the document becomes visible (`visibilitychange`) and on a `storage` event for the Supabase auth key. A newly found user triggers the same success confirmation.
- **Route parsing ignores auth fragments.** `parse()` in `src/lib/route.ts` must treat a hash that starts with `access_token=`, `error=` or similar as the `today` tab with no sheet, not as a sheet name.
- **"Check your email" state** in the sign-in card:
  - Copy: "Open the link in the email, then come back to Repwise."
  - "Resend" with a 60 s cooldown.
  - "Change email" returns to the input.
  - The last email is kept in `localStorage.repwise_last_email` so it survives a reload.

## 2. Supplement library

### Catalogue

`src/domain/supplementCatalogue.ts`, following the pattern of `src/domain/catalogue.ts`. Each entry:

```ts
interface CatalogueSupplement {
  id: string;            // stable slug, same id space as Supplement.id
  name: string;
  dose: string;          // typical dose, e.g. "5 g"
  timing: SuppTiming;    // 'morning' | 'pre' | 'post' | 'meal' | 'night' | 'any'
  note: string;          // one factual line, no medical claims
}
```

Starting entries: creatine, whey protein, casein, multivitamin, vitamin D3, vitamin B12, omega-3 fish oil, magnesium, zinc, iron, calcium, electrolytes, caffeine / pre-workout, beta-alanine, citrulline, ashwagandha, melatonin, collagen, glucosamine, probiotic.

Notes give a typical dose range and when people usually take it. No health claims.

### Data

- `Supplement` gains `timing?: SuppTiming`. Custom supplements default to `'any'`.
- Adding from the catalogue copies name, dose and timing into the user's stack with the catalogue id. The dose stays editable. If the id already exists (archived), adding unarchives it instead of creating a duplicate.

### Default stack

- New data starts with: creatine "5 g" (`any`), whey protein "1 scoop" (`post`), multivitamin "1 tablet" (`meal`).
- Existing users: `normalize` seeds the same three once, only when `supplements` is empty, then sets `meta.suppSeeded = true`. A non-empty stack just sets the flag. The flag stops the seed from returning after sync or import.
- Seeding must not change `meta.updatedAt`, so a freshly seeded device never wins a sync over the cloud copy. `isEmpty` already ignores supplements, so a seeded fresh device still takes the cloud copy.

### UI

- A "Supplement library" sheet (route `supps`): a search field, then "Your stack" (rename, edit dose, archive) and the catalogue grouped by timing. Tap a catalogue row to add it. "Add custom" stays at the bottom.
- Today's supplement card groups pills by timing in day order (morning, pre, post, meal, night, any).

## 3. Profile restructure

Keep the current iOS visual language. Cut length: no inline forms on the main page.

### Main page, top to bottom

1. **You card.**
   - Signed out: "Saved on this phone only", an email field and "Send link" (the sign-in card from section 1).
   - Signed in: email, backup state ("Backed up · 14:02", "Backing up…", or the error message with Retry), and the current workout streak.
2. **Grouped rows**, each opening its own sheet with the existing controls moved in unchanged:
   - Training plan: split, goal, experience, days per week, session length, units, and "Apply to current workout" while a workout is open.
   - Goals: the existing goal list and add form.
   - Body & water: height, target weight, water goal, goal note.
   - Supplements: opens the Supplement library sheet.
   - Equipment & exercises: equipment switches, then the exercise library row.
   - Reminders: rest timer alerts and water reminders (section 4).
   - Your data: export, restore, sign out when signed in.
3. Footer: app version from `__APP_VERSION__`. The hard-coded "Repwise 4.0" goes.

Each row shows a short summary value, for example "Full Body · 5×/wk", "2 goals", "8 glasses", "3 in stack", "On".

### Removed

- The "How recommendations work" card.
- The long footnote under Training. Its content moves to a single short line inside the Training plan sheet.

### Routing

Sheets reuse `openSheet` with ids `profile:training`, `profile:goals`, `profile:body`, `profile:equipment`, `profile:reminders` and `profile:data`, rendered from `Sheets()` in `App.tsx`. `supps` opens the library.

## 4. Water nudges and push

### Shared pace rule

In `src/domain/water.ts`:

```ts
waterPace(glasses: number, goal: number, nowMinutes: number, window: { from: number; to: number })
  → { expected: number; behind: number; inWindow: boolean }
```

`expected = ceil(goal × elapsed fraction of the window)`, clamped to 0..goal. `behind = max(0, expected - glasses)`. The app and the edge function use the same rule: the function imports a copy of this file, kept in sync by a unit test that compares both outputs on fixed inputs.

### In-app (Today)

- The water card turns loud when `behind ≥ 1` inside the window: tinted background, a big count and the copy "{glasses} of {goal}. You're {behind} behind. Have one now." The +1 button stays the primary action. When on pace or done, the card stays as it is today.
- The supplement card turns loud for any active supplement not taken once its timing slot has passed (morning after 11:00, meal after 14:00, night after 22:00; `pre`, `post` and `any` after 18:00): "Creatine not taken yet."

### Settings

`Profile.waterReminders?: { on: boolean; from: number; to: number; everyHours: number }`, defaulting to `{ on: false, from: 9, to: 21, everyHours: 2 }`. Hours are local. It lives in the synced profile so the server can read it.

### Database

Migration `supabase/migrations/<timestamp>_push_subscriptions.sql`:

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  tz text not null,
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy "own rows" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

One row per device, so an Android phone and an iPhone both get reminders.

### Edge function `water-nudge`

- Runs hourly on the hour, from Supabase Cron (pg_cron + pg_net calling the function URL with the service role key).
- Reads every subscription joined to `repwise_user_data.workout_data` with the service role.
- Per subscription:
  1. Compute local time from `tz`.
  2. Skip if `waterReminders.on` is false, or local time is outside `from..to`, or `last_sent_at` is within `everyHours`.
  3. Read `water[localDate]` and `profile.waterGoal`, and run `waterPace`. Skip unless `behind ≥ 1`.
  4. Send Web Push with `npm:web-push` and VAPID: title "Time for water", body "{glasses} of {goal} glasses. You're {behind} behind, have one now.", url `/#/today`.
  5. Set `last_sent_at`. Delete the row on a 404 or 410 response.
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. The app reads the public key from `VITE_VAPID_PUBLIC_KEY`.

### App

- Reminders sheet → "Water reminders" switch, plus From, To and Every pickers.
- Turning it on, from a tap:
  1. Request notification permission.
  2. `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
  3. Upsert the row with `tz` from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
  4. Set `waterReminders.on`.
- Turning it off unsubscribes and deletes this device's row. The profile flag turns off only when the user turns it off.
- Signed out: the switch is disabled with "Sign in to get water reminders".
- On launch while signed in with reminders on, re-check the subscription and re-upsert it if the endpoint changed. Browsers rotate endpoints.
- `public/notify-sw.js` gains a `push` handler that shows the notification with `data.url`. The existing `notificationclick` handler opens it.
- iPhone: push needs iOS 16.4+ and a home-screen install. Elsewhere the sheet says "Install Repwise to your home screen to get reminders".

### Known limits

- Water logged offline reaches the server only after the next sync, so a reminder can arrive just after logging offline.
- A reminder can be up to an hour late, because the job runs hourly.

## Error and empty states

- Sign-in: sending, sent (with resend cooldown), success, expired or used link, network failure ("Couldn't send the link. Check your connection").
- Supplement library: no search match shows "No match. Add '{query}' as custom".
- Reminders: permission denied ("Notifications are blocked. Allow them in Chrome site settings, then come back"), subscribe failure ("Couldn't turn on reminders. Try again"), unsupported browser.
- Profile row summaries never show blank values. Use "Not set" when there is nothing to show.

## Testing

- **Unit:**
  - Auth URL error parsing.
  - `parse()` ignoring auth fragments.
  - Catalogue ids are unique, and adding from it unarchives instead of duplicating.
  - Seed-once behaviour, and the seed leaving `updatedAt` unchanged.
  - `waterPace` edges: before the window, the window start, mid-window, past the goal, zero goal.
  - Supplement overdue slots.
  - The edge function copy of `waterPace` matching the app's.
- **Edge function:** a local run with `supabase functions serve` against fixture rows, covering skips (off, outside the window, recently sent, on pace) and one send; a 410 response deletes the row.
- **e2e additions:**
  - The sign-in success banner, with `onAuthStateChange` stubbed.
  - The expired-link banner from a crafted hash.
  - Adding from the supplement library.
  - Profile rows opening each sheet.
  - The loud water card when behind (clock mocked).
- **Manual, on a real Android install:**
  - The full magic link round trip.
  - Turn on water reminders, close the app, receive a push within the hour, tap it to land on Today.
