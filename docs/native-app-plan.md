# Native app — plan

Options for turning settracker into a real mobile app with native notifications
and deep linking, while keeping costs as low as possible.

## What the app already does (PWA)

The current app is already a Progressive Web App:

- Installs to home screen on iOS and Android
- Works offline (service worker)
- Push notifications: fully supported on Android, supported on iOS 16.4+ when
  installed to home screen
- Deep linking: works via URL — any link to the app opens the right screen

So some "native" features are already available without any changes. The gap vs
a real native app is mainly: iOS notification reliability, access to more device
APIs, and being listed in the App Store / Play Store.

## Option 1 — Improve the PWA (free, least effort)

Wire up push notifications properly (Supabase has a built-in push service, or use
a free tier of OneSignal/Firebase Cloud Messaging). Handle deep links via URL
patterns. Add a proper app manifest with splash screens.

**Cost:** free  
**Effort:** low (1–2 days)  
**Result:** works well on Android, acceptable on iOS 16.4+. No app store presence.

## Option 2 — Capacitor (recommended if going native)

Capacitor (<https://capacitorjs.com>) wraps the existing web app in a native iOS/Android
shell. Almost no code rewriting — add a Capacitor config, run a build command, and
the same React app runs inside a native container with access to native APIs.

What you get over the PWA:

- Full native push notifications on all iOS versions
- Deep linking via universal links / app links
- Access to native share sheet, camera, contacts, etc.
- Can be submitted to App Store and Play Store
- Looks and feels like a real app (custom splash screen, no browser chrome)

**Cost to develop:** free  
**App Store costs:**

| Store        | Cost              | Notes                                      |
|--------------|-------------------|--------------------------------------------|
| Apple (iOS)  | $99/year          | No way around this for App Store listing   |
| Google Play  | $25 one-time      | Much more reasonable                       |
| Android APK  | Free              | Distribute a direct download link instead  |

**Effort:** medium (3–5 days to get a working build, longer for store submission)

## Option 3 — React Native (not recommended)

Full rewrite of the UI layer. More native feel but most existing code gets thrown
away. Only worth it if we need very deep native integration that Capacitor can't
provide. Not recommended for this project.

## The bigger architectural question

Right now every user deploys their own stack (GitHub fork + Supabase + Vercel).
This works for a self-hosted tool but creates friction and makes a native app
in the App Store very awkward — you can't publish an app where every user needs
their own backend.

### Two architectural paths

#### Path A — Stay self-hosted (current model)

- Each user keeps their own Supabase + Vercel
- Can still use Capacitor, but the app would be a DIY build, not an App Store listing
- Setup wizard stays relevant
- You pay nothing, users control their own data

#### Path B — Centralised backend (single shared database) — RECOMMENDED

- You run one Supabase project, everyone's accounts live on it
- Setup wizard disappears entirely — sign up is just an email
- One app in the App Store / Play Store that anyone can install
- Adding Spotify, setlist.fm, and other APIs becomes much simpler (one integration,
  not one per user)
- The app scales naturally — new features roll out to everyone instantly
- **Cost: still free.** Same Supabase + Vercel free tiers as before, just one shared
  instance. Supabase free tier covers 50,000 MAU and 500MB storage — a small community
  will never come close. Only becomes a cost if the app grows to thousands of active
  users, at which point $25/month Supabase is the only expense.
- **Trade-off:** you become responsible for other people's data (not hosting cost)

### Recommendation

If the goal is staying simple and free for a small group:
→ Path A + improved PWA or Capacitor Android APK (no App Store needed)

If the goal is a polished app anyone can install:
→ Path B + Capacitor + App Store ($99/year Apple, $25 once Google)

## How this connects to the Spotify / API plan

With Path B (centralised backend), the Spotify OAuth and setlist.fm integration
becomes much cleaner:

- One set of API credentials configured server-side (not per-user in Settings)
- Users just click "Connect Spotify" and OAuth handles the rest
- No setup wizard, no env vars for users to manage
- See `docs/spotify-integration-plan.md` for details

## Summary

| Option                  | Cost          | Effort  | App Store | Best for                         |
|-------------------------|---------------|---------|-----------|----------------------------------|
| Improved PWA            | Free          | Low     | No        | Quick win, Android-first         |
| Capacitor + APK sideload| Free          | Medium  | No        | Native feel, avoid store fees    |
| Capacitor + Play Store  | $25 once      | Medium  | Android   | Wider Android reach              |
| Capacitor + both stores | $99/yr + $25  | High    | Yes       | Full public launch               |

## Decision needed before building

1. Stay self-hosted (Path A) or move to centralised backend (Path B)?
2. If native: iOS too, or Android-first?
3. App Store listing or direct APK / improved PWA?

Answers to these drive everything else.
