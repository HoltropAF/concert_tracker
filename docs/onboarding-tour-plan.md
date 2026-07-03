# Onboarding tour — plan

An interactive first-run walkthrough for new users who have just set up their own
copy of settracker and logged in for the first time.

## Can we do this without screenshots or screen recording?

Yes. Tour libraries like Shepherd.js and Driver.js work by overlaying tooltips
directly on the live running app. They highlight real DOM elements — no screenshots,
no video, no assets to maintain. The tour updates automatically whenever the UI
changes because it targets the actual elements, not pictures of them.

## Recommended approach

**Driver.js** (https://driverjs.com) — lightweight (~12 KB), zero dependencies,
works well with React, has a clean look that can be themed to match the existing
dark palette. No paid plan needed.

Alternative: build a tiny custom overlay in React if we want full control and
no external dependency. Driver.js is the faster path.

## When to trigger the tour

Show it once, automatically, when ALL of the following are true:

1. The user is signed in (not guest mode)
2. Their concert list is empty (i.e., they just finished setup)
3. `localStorage.getItem('tour_done')` is not set

After the tour finishes or is skipped, set `localStorage.setItem('tour_done', '1')`
so it never shows again. Optionally expose a "Replay tour" button somewhere in
Settings for users who want to see it again.

## Proposed tour steps (draft — adjust once UI is stable)

| # | Target element           | What to say                                                                 |
|---|--------------------------|-----------------------------------------------------------------------------|
| 1 | Whole screen / center    | "Welcome — you're in. Here's a quick tour of what you can do."              |
| 2 | "Add concert" button/FAB | "Tap here to log a show. Fill in the artist, venue, date, and a rating."    |
| 3 | Concert list area        | "All your shows live here. Tap one to edit or delete it."                   |
| 4 | Festival toggle / type   | "Mark something as a festival instead of a regular concert."                |
| 5 | Stats / overview section | "This updates automatically as you add more shows."                         |
| 6 | Settings / sign-out area | "Your data is in your own Supabase database — only you can see it."         |
| 7 | End card (centered)      | "That's it. Go log your first show." + "Get started" button                 |

Steps are intentionally short. Each tooltip should be one or two sentences max.

## Implementation outline (when ready to build)

1. `npm install driver.js`
2. Create `src/components/OnboardingTour.jsx`
   - Accepts `onDone` callback
   - Initialises Driver with the steps above, themed to match the app colours
   - Calls `onDone` on finish or skip → parent sets localStorage flag
3. In `ConcertTracker.jsx` (or `App.jsx`), check the trigger condition on mount
   and render `<OnboardingTour />` when true
4. Add a "Replay tour" option in Settings

## Theming notes

Driver.js exposes CSS variables. Map them to the existing palette:
- Popover background → `#13131f`
- Border → `#2e2e50`
- Accent / progress → `#a78bfa`
- Text → `#e2e0ff`
- Muted text → `#6b6a8f`

## Pre-release checklist item

Add to `docs/pre-release.md` when tour is implemented:
- [ ] Tour tested on mobile (iOS Safari + Android Chrome)
- [ ] Tour tested on desktop
- [ ] "Replay tour" button accessible in Settings

## Open questions (decide when building)

- Should the tour also show on the setup wizard's final step (step 8), before the
  user even opens the app? Or only inside the app after first login?
- Do we want a short "skip tour" option visible from step 1, or just an X button?
- Should the tour show to guest-mode users too (with a note that their data won't
  be saved)? Probably not — keep it for signed-in users only.
