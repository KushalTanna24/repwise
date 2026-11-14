# Groups: train together, see each other, nudge: design

Date: 2026-11-13 · Target release: Repwise 4.7.0 · Status: agreed in conversation, awaiting written-spec review

## Intent

The owner wants their parents to log workouts in Repwise and wants to see their parents' split and progress, while the parents see theirs. Each side can send a "keep pushing" nudge. The aim is a healthy lifestyle supported within the family.

Other users will want the same thing with other people, for example a "gym gang". So the feature is general **groups**. A family is one kind of group, and nothing in the build is specific to families.

Success means a parent who is not a power user can join from a link, keep logging normally, and feel encouraged rather than watched. The owner can see at a glance who trained this week and send a nudge in one tap.

## Goals

1. Anyone signed in can create a group and invite others with a link or code.
2. Members see each other's training read-only: split, workouts, history, streak, strength trends.
3. Body and health data (weight, BMI, photos and more, defined below) is shared per group, by each member's own switch.
4. A weekly scoreboard ranks members fairly across ages and levels.
5. One-tap nudges that reach the other person's phone (Android), with smart limits so they never flood a device.
6. An in-app list of received nudges that works on every platform.

## Non-goals (this release)

- iPhone push. iOS delivers push only to a home-screen install, and that install cannot sign in with a magic link today. The in-app nudge list works on iPhone, and nothing here blocks adding iPhone push later through in-app code sign-in.
- Chat, comments or reactions on individual workouts.
- Group challenges. Existing challenges stay personal.
- Editing another member's plan or data (no coach role).
- Public leaderboards, groups discoverable by search, email invites.
- A morning digest of nudges that were held during quiet hours.

## Anti-goals (failure even if it works)

- Nudges feel like spam, or buzz someone at night.
- The scoreboard shames an older or beginner member. Raw kilos never rank anyone, and the board has no red "last place" styling.
- Body data reaches a group where its owner has the switch off, including through photo URLs or cached copies.
- Viewing a member's data ever writes it into the viewer's own document, or the reverse.
- Joining a group changes anything else about the user's app: their reminders, their sync, or their own data. (The Groups tab itself is visible to everyone; the owner chose that.)

## Constraints from the current app

- Local-first. Each user's whole state is one `AppData` JSON document (`src/domain/types.ts:217`), stored in `public.repwise_user_data (user_id, workout_data, updated_at)` with own-row-only RLS. Sync is in `src/sync/useSync.ts`: one pull after hydration, then a debounced push of `useApp.getState().data` on every change.
- Groups require sign-in. Signed-out users see the feature's empty state with the existing `SignInCard`.
- No display name exists anywhere today. Only `user.email` is shown.
- Web push already exists: `push_subscriptions` (own-row RLS, a per-device `tz` column), the `water-nudge` edge function using `npm:web-push@3.6.7`, VAPID env vars, a service-role client, and the service worker push handler.
- Photos live in the private bucket `progress-photos` at `{userId}/{photoId}.jpg`, with own-folder storage policies, and are viewed through `createSignedUrl`.
- Stats are pure functions of `AppData`, so they work on another member's document unchanged: `weekStats`/`periodStats` (`src/domain/stats.ts`), `streak` (`src/domain/streak.ts`), and `overallStrength` (`src/domain/strength.ts:43`, whose `change` is already improvement against the first session).
- The stack is fixed by the project: shadcn-style components on Tailwind, TanStack Query for every Supabase call, Zustand for client state only, `motion` for animation, and dayjs.

## Approaches considered

**A. Members read each other's existing document through a guarded server function. Chosen.** New tables hold groups, members and nudges. A `security definer` function returns another member's `workout_data` after checking that both people share the group, and removes body fields when the owner's switch is off for that group. The client renders it with the existing screens in a read-only mode.
- Pros: least new code, full detail including history drill-down, and any future feature shows up for members automatically.
- Cons: each member's full document is downloaded (fine at group sizes), and the read-only views must be strictly non-writing.

**B. A published snapshot.** Each phone writes a small summary row on sync, and members read only that.
- Pros: small and selective.
- Cons: duplicates the stats logic, goes stale until the owner syncs, and has no history drill-down. It works against the owner's "share everything" choice for family.

**C. A public share link without accounts.** Rejected: members must log workouts and receive nudges, so they need accounts anyway.

The owner chose A. Plain RLS on the document row was rejected within A because RLS cannot hide parts of a JSON row, and body data must be hideable per group.

## Decisions agreed with the owner

| Topic | Decision |
|---|---|
| Who | Groups of any kind (family, gym gang). One person can be in several groups. |
| Visibility | Symmetric. Every member sees the same things about every other member. No coach role. |
| Training data | Always shared with group members. |
| Body data | Shared per group by each member's own switch. The owner's family group will have it on. |
| Platform | Android first, iPhone later. The in-app nudge list works everywhere. |
| Nudges | Preset lines or a short custom note, with smart limits (below). |
| Scoreboard | Ranked by consistency: workouts done against each person's own weekly target, plus streak. Improvement % is a second column. The ranking resets weekly. |
| Navigation | A fifth tab, Groups, visible to everyone, including users who are signed out or in no group. |

## Calls made by Claude after the spec review (owner to check)

1. **Nudge push is its own opt-in.**
   - `push_subscriptions` gets a `kinds text[]` column. Existing rows are backfilled to `{reminders}`.
   - The water/streak cron sends only to rows containing `reminders`, and `group-nudge` sends only to rows containing `nudges`.
   - The app asks "Get nudges on this phone?" after you create or join a group. A Groups settings row also lets you turn it on or off.
   - Turning reminders off removes only `reminders` from the row. The row is deleted only when `kinds` is empty.
2. **The body set is wider than first drafted** (see Data model). Fields that are always removed, whatever the switch: `exerciseNotes` and `profile.displayName`.
3. **Member photos go through an edge function** with 5-minute signed URLs, checked per group. No storage policy for members.
4. **Removing a member rotates the invite code.**

## Data model (Supabase)

One migration, `supabase/migrations/20261113000000_groups.sql`.

**`groups`**: `id uuid pk`, `name text (1–40 chars)`, `invite_code text unique`, `created_by uuid → auth.users`, `created_at`.

**`group_members`**:
- Columns: `group_id → groups on delete cascade`, `user_id → auth.users on delete cascade`, `display_name text (1–24 chars)`, `role text check in ('owner','member')`, `share_body boolean not null default false`, `joined_at`.
- Primary key: `(group_id, user_id)`.
- The display name is set per group, so someone can be "Dad" in Family and "Raj" in Gym gang.

**`nudges`**:
- Columns: `id`, `group_id → groups on delete cascade`, `from_user`, `to_user`, `preset text null`, `note text null (≤ 80 chars)`, `delivery text check in ('push','quiet','cheer','capped')`, `created_at`, `read_at timestamptz null`.
- Index: `(to_user, created_at desc)`.

**RLS**
- `groups`: select if the caller is a member. Rename only by the group owner. No direct insert or delete; both go through functions.
- `group_members`: select rows of groups the caller belongs to. Update only your own row's `display_name` and `share_body`. Delete your own row (leave), or any row of a group you own (remove).
- `nudges`: select where the caller is `to_user` or `from_user`. Update `read_at` only on rows where the caller is `to_user`. No client insert; only the edge function inserts.
- A helper `is_member(group uuid, uid uuid)` (security definer, stable) avoids recursive policy lookups.

**Functions (security definer, `search_path` pinned)**
- `create_group(name, display_name, share_body) returns groups`: creates the group with a fresh 6-character code from the same unambiguous alphabet as `src/domain/training/splits/custom.ts`, and adds the caller as owner.
- `join_group(code, display_name, share_body) returns groups`: joins by code. Rejects when the group already has 12 members. Joining again is a no-op.
- `leave_group(group)`: removes the caller. If the owner leaves, ownership passes to the longest-standing member. If the last member leaves, the group is deleted.
- `rotate_invite(group)`: owner only. Issues a new code so old links stop working.
- `remove_member(group, member)`: owner only. Deletes the member's row and rotates the invite code in the same transaction, so the removed person cannot rejoin with the old link. Removal goes through this function, not a direct delete.
- `member_doc(group, member) returns jsonb`:
  - Requires both the caller and `member` to be in `group`.
  - Returns the member's `workout_data`, `updated_at` and `share_body`.
  - When `share_body` is false, removes the body set (below).
  - Always removes `activeSession` set data except exercise names and start time, so a live session shows as "training now" without leaking drafts.

**Body set** (removed when `share_body` is off):
- `bodyweights` and `photos`, emptied.
- `fasts`, `supplements` and `suppLog`, emptied.
- Profile fields, removed:
  - height and target weight (`targetWeightKg`)
  - sex and birth year (age)
  - activity level and body goal
  - every calorie, intake and protein field from onboarding
  - `goalNote`

**Always removed**, whatever the switch:
- `exerciseNotes`, because they are personal notes.
- `profile.displayName`, because a name from one group must never leak into another. Members see the `group_members.display_name` for that group instead.

**Kept:**
- Water, because it is a habit ring, not a body measure.
- `goals`, which the streak calculation needs.
- Focus muscles and split, because they are training data.

Builder: confirm the exact profile field names against `types.ts` and list them in the migration in one place.

**Member photos.** There is no new storage policy, because a storage path is per person and cannot tell which group is asking. A new edge function `member-photos` (JWT verified) takes `{group, member}`, checks that both share the group and that `share_body` is true there, and returns signed URLs created with the service role. The URLs are valid for 5 minutes. The client uses them only within the member view and caches them for at most 4 minutes. Turning the switch off, leaving or being removed therefore cuts photo access within about 5 minutes. Sharing photos in one group never exposes them to another.

## Nudges

**Sending.** The client calls a new edge function `group-nudge`, which verifies the JWT (unlike the cron functions), with `{group, to, preset | note}`.

1. **Checks:** the sender and receiver share the group, the sender is not nudging themselves, and the note is at most 80 characters.
2. **Rate limit:** the same sender to the same receiver at most once per receiver-local day, across all groups. A repeat is rejected with a friendly message, and the UI disables the button with "Nudged today".
3. **Decide delivery** with a pure, unit-tested `decideNudge()` in the style of `water-nudge/decide.ts`. The receiver's local time comes from their newest `push_subscriptions.tz` (UTC if none). Rules apply in this order:
   1. **Leave:** the receiver is on leave today (`leave` in their document). The result is `quiet`.
   2. **Cheer:** the receiver already finished a workout today. The result is `cheer`, shown in the list as a cheer with no buzz.
   3. **Quiet hours:** the receiver is outside their awake window. The window is their water-reminder `from`–`to` when water reminders are on, otherwise 08:00–21:00. The result is `quiet`.
   4. **Daily cap:** the receiver already got 2 nudge pushes today from anyone. The result is `capped`.
   5. Otherwise the result is `push`.
4. **Insert** the `nudges` row with that delivery.
5. **Push** only when the delivery is `push`:
   - Sent to all of the receiver's devices whose `kinds` include `nudges`, using `topic: 'nudge'` so a newer nudge replaces an older one still on screen.
   - With no such device, the nudge stays in the in-app list. That is the case on iPhone today.
   - The body names the sender and the line ("Dad: Keep pushing 💪").
   - When the receiver has other unread nudges from today, the body is grouped instead ("Dad and 2 others nudged you").
   - A tap opens `#/groups/nudges`.
   - 404/410 responses delete the subscription, as in `water-nudge`.

The web-push setup and subscription cleanup move into `supabase/functions/_shared/push.ts`, used by both functions.

**Presets:** "Keep pushing 💪", "Missed you at the gym", "Proud of you", "Let's train today". Builder may tune the wording.

**Receiving in app.** Received nudges appear in a list on the Groups tab, newest first, with sender, group, line and time. Opening the list marks them read. The Groups tab icon shows an unread dot.

## Scoreboard

Pure functions in `src/domain/groups/scoreboard.ts`, unit-tested on fixtures. The week is the viewer's current week, using the app's existing `weekStart()`.

For each member, the board computes:
- **This week:** finished sessions this week out of `profile.daysPerWeek`, shown as "2 / 3" with a ring.
- **Consistency:** `min(done / target, 1)`. Going past the target doesn't beat someone who hit theirs, so a 6-day lifter can't outrank a 3-day parent just by volume.
- **Streak:** `streak(doc, today).current` days.
- **Improvement:** `overallStrength(doc).change` as ±%. Shown, not ranked. A dash when there is too little history.

**Ranking:**
- Order: consistency (descending), then streak (descending), then sessions this week (descending), then display name.
- Members tied on all of these share a rank.
- Everyone who hit their target gets a quiet "Target hit" mark. Nobody gets negative styling.
- Last week's top member (rank 1) gets a small crown, recomputed from the same documents. Nothing is stored.

## Screens

A fifth tab, **Groups** (lucide `Users`), is added to `TabBar` and `routeParse`. The tab bar grid goes to 5 columns.

**Groups tab**
- Each screen has one primary action:
  - **Signed out:** an explanation plus `SignInCard`.
  - **No groups:** an empty state, "Train together", with **Create a group** as the primary action and "Join with a code" as secondary.
  - **Has groups:** a group switcher at the top when there is more than one group (last choice remembered in a small Zustand store), then the scoreboard. Each row shows rank, name, ring, streak, improvement % and a **Nudge** button. The viewer's own row is highlighted and has no Nudge button.
- A header button opens group settings:
  - Invite: share the link via the Web Share API, copy the code, rotate the code (owner only).
  - Your display name in this group.
  - The "Share body data with this group" switch.
  - Members, with Remove (owner only), and Leave group.
- **Nudges list** (`#/groups/nudges`), reached from a bell with an unread dot.

**Create / Join sheets**
- Fields: group name (create only), your display name (prefilled from the last name you used), and the body-sharing switch, default off.
- The switch spells out what it shares: "Weight, BMI, photos, fasting and supplements".
- Join is reached by an invite link `#/groups/join:CODE`. A signed-out user who opens the link signs in first and then lands back on the join sheet.

**Member view** (sheet `member:<group>:<user>`)
- A read-only profile of one member with:
  - A header: name, split name, "training now" when relevant, last synced time ("Updated 2 h ago" from `updated_at`).
  - **History, Strength and Body** sections, reusing the existing components.
- Body appears only when that member shares body data with this group. Otherwise it shows "Not shared with this group".
- A Nudge button.

**Read-only reuse**
- Progress (Strength, Body), History (StreakHeader, MuscleMap, Calendar, DayCard) and SessionDetail currently read `useData()` and some call `act`.
- They are refactored to read from a small `DocContext` that provides `{ data, readOnly }`. The provider defaults to the user's own document, and the member view wraps them with the member's document and `readOnly: true`.
- In read-only mode, every edit, delete, add and log control is hidden, not just disabled.

**States.** Every async surface has loading, empty, error and success states in plain words:
- "Loading your group…"
- "No one has trained this week yet"
- "Couldn't load Dad's data. Check your connection."
- "Dad hasn't synced since Monday"

## Data flow and safety

- **Fetching:** member documents are fetched with TanStack Query (`['member-doc', group, user]`), `staleTime` 60 s, refetch on focus. The scoreboard fetches all members of the selected group in parallel.
- **No mixing with your own data:**
  - Member documents are never persisted (no IndexedDB, no Zustand). They live only in the in-memory query cache, which is cleared on sign-out.
  - A member document is never passed to `useApp.replace`, `act`, or any sync path. A unit or lint-level test guards this: the member view module must not import `useApp` write actions.
- **Freshness:** member data is as fresh as that member's last sync. The member view shows "Updated …" so a stale document is never presented as live.
- **Migration:** the document has no schema change. `schemaVersion` stays 4. The only new client-side field is an optional `profile.displayName` used to prefill the name fields.

## Testing

- **Unit (Vitest):**
  - `scoreboard.ts` ranking, ties, capped consistency and the last-week crown.
  - `decideNudge` for each rule and its order, across time zones.
  - The body-set stripping, as a pure TypeScript twin of the SQL list, so the list is reviewed in one place.
- **Database:** a SQL check script, run against a branch or local Supabase. It verifies:
  - A non-member gets nothing from `member_doc`.
  - `share_body = false` removes every body field.
  - `member-photos` refuses when the switch is off or the caller is not in that group.
  - The cron never pushes to a row whose `kinds` lacks `reminders`.
  - A member cannot insert nudges directly.
- **Acceptance (`e2e/acceptance.mjs`):** create a group, join it from a second account, see the other member on the board, open the member view read-only, send a nudge and see it in the receiver's list. Push delivery itself is checked by hand on an Android phone.

## Left to the builder

- Exact component structure and file layout under `src/screens/groups/`.
- Preset wording, icons and the scoreboard row design within the project's existing look.
- Whether `decideNudge` lives in `_shared` or in the function folder.
- How the invite link survives the magic-link round trip. The existing `authUrl` capture is the expected hook.
- Batching member-document fetches into one RPC if parallel calls feel slow.
