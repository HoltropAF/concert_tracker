# Pre-release checklist

Things to do before sharing settracker with friends, colleagues, and the public.
Do not announce or hand out links until all items here are checked off.

## Must-have before going public

- [ ] Write the first changelog entry in `public/changelog.md`
- [ ] (add more items here as they come up)

## Nice-to-have

- [ ] (add more items here as they come up)

## Backlog (good ideas, not blocking release)

- [ ] **Architecture decision — RECOMMENDED: move to centralised backend**
      The self-hosted model (each user runs their own Supabase + Vercel + GitHub) creates
      too much friction for non-technical users. The only real fix is to run one shared
      Supabase so onboarding becomes: open URL → enter email → done.
      COST: still free. Same Supabase + Vercel free tiers, just one shared instance.
      Supabase free tier covers 50,000 MAU and 500MB — more than enough for a small
      community. Only becomes paid if the app grows to thousands of active users, which
      is a good problem to have. Trade-off: users' data lives on your Supabase instead
      of their own. Unlocks native app, simplifies Spotify integration, and removes
      the setup wizard entirely.
      Plan: `docs/native-app-plan.md`

- [ ] Native app — Capacitor wrapper for iOS/Android, native push notifications and
      deep linking. Cost depends on architecture decision above.
      Plan: `docs/native-app-plan.md`

- [ ] Onboarding tour for new users — interactive first-run walkthrough using Driver.js,
      no screenshots needed, triggers once on first login with an empty concert list.
      Plan: `docs/onboarding-tour-plan.md`

- [ ] Spotify integration — two tracks to choose from:
      1. Keep the app as-is (simple concert logging, no external APIs)
      2. Enhanced version: connect setlist.fm + Spotify to get setlists, create playlists,
         and unlock album/song stats
      Either way, API keys and integration toggles should live in the Settings page
      (not just as environment variables), so users can opt in/out without redeploying.
      Plan: `docs/spotify-integration-plan.md`

---

Last updated: 2026-07-03
