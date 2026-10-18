# Step tracking — parked idea

Date: 2026-10-18 · Status: parked by the user ("not now"). Nothing built. Pick up from here.

## What the user wants

- Daily step count in Repwise, shown as progress (like water).
- Steps feed the recommendation nudges: behind on steps → "take a walk", including a push reminder.
- Android first (the user). iPhone later (the user's brother).

## What we found

- **A web app (PWA) cannot read the phone's step count.** There is no browser API for it. Android's Health Connect is readable only by native Android apps; Apple Health only by native iOS apps.
- **Google Fit APIs are being shut down** (reported end of 2026), so they are not an option.
- **Google Health API** (cloud successor, ex-Fitbit Web API) uses Restricted scopes that need a Google privacy and security review. Not realistic for a family app.
- **Fitbit Web API** turns off on 30 October 2026.
- The build machine already has JDK 17, the Android SDK, Android Studio and adb. Capacitor's current Android toolchain may want JDK 21; check when starting.

## Options, in the order we'd recommend them

1. **Manual steps in the PWA (no native app).**
   - A Steps card on Today: type the day's total from the phone's step counter, or tap +1,000.
   - Daily goal, plus pace nudges reusing `waterPace`-style logic.
   - An evening push reusing the existing water-nudge server and push subscription.
   - Steps in History and Progress.
   - Store steps as `AppData.steps: Record<date, number>` so any later automatic source just writes the same field.
2. **Option 1 + automation upload.**
   - Android: an automation app (for example Tasker) reads steps and POSTs them to a small Supabase function. Whether Tasker can read Health Connect still needs checking.
   - iPhone: the built-in Shortcuts app can read Apple Health steps and POST them on a schedule.
   - Needs a per-user upload token and setup on each phone.
3. **Native Android wrapper (Capacitor) with Health Connect.** The user prefers to wait on this. Consequences to plan for:
   - Magic links can open the app directly through Android App Links on `repwise-eta.vercel.app`, which fixes sign-in properly.
   - Web Push does not work inside the wrapper's WebView. Water reminders would move to native notifications: local notifications, or FCM.
   - Background step reads need `READ_HEALTH_DATA_IN_BACKGROUND` and a WorkManager job. Without them, steps refresh only when the app is open.
   - Open decision: one app replacing the PWA (recommended) or a small steps companion next to it.
4. **Motion-sensor counting while the app is open.** Rejected: it stops when the screen is off, so the daily total is meaningless.

## Related open item

- **iPhone sign-in and reminders.** An iPhone home-screen install can't be signed in with a magic link, because Safari and the installed app don't share storage. That makes push reminders unreachable on iPhone. The fix is a 6-digit code in the sign-in email, entered in the app. See the 4.2 spec, "Known limits".
