# App Audit — settracker

Living document. We update this as we go through every part of the app: what it does, what's inconsistent, and what's still open. Not a changelog — a reference for the current state of things.

---

## Status: pass 1 fixes applied. Pass 2 (deeper consistency) not started. Visual pass not started.

---

## Confirmed inconsistencies (pass 1 findings)

1. ~~Asc/desc sort direction only on Artists~~ — **FIXED**: now on Songs, Venues, Friends too.
2. ~~Compact/non-compact toggle only on Shows and Artists~~ — **FIXED**: now on Songs, Venues, Friends too, each with its own compact row layout.
3. ~~"Clear filters" / empty-state / search consistency~~ — **CHECKED (pass 2)**:
   - Search: consistently live (no submit button) on all 4 tabs. No gaps.
   - "Back to default" clear-filters link: present on all 4 tabs' sort/filter panels. No gaps.
   - Empty states: **FIXED** — Venues was using a plain unstyled div instead of the shared `EmptyState` component (which Artists/Songs/Friends all use, with a title + helpful detail line). Now consistent.
   - Filters button label: Songs shows its filter state ("Linked"/"Unlinked") instead of a count like the others do — this is intentional, not a bug, since Songs only has one filter and the state is more useful than a count of 1.

## Pass 2: done. No more functional consistency gaps found across the 5 main tabs.

---

## The 5 main tabs

### Shows
- Filters: type (concerts/festivals/all), search
- Sort: yes
- Compact/non-compact toggle: **yes**
- Default view (past/upcoming/wishlist) settable in Settings

### Artists
- Filters: genre, min-times-seen, type (concert/festival), upcoming-only, ult-group-only, search
- Sort: yes, **with asc/desc direction toggle**
- Compact/non-compact toggle: **yes** (separate setting from Shows' compact mode)
- Per-artist customizable Overview page (drag to reorder/hide tiles, in edit mode)

### Songs
- Filters: type (concert/festival), Spotify-linked-only, search
- Sort: yes, with asc/desc direction toggle
- Compact/non-compact toggle: yes

### Venues
- Filters: country, min-visited, want-to-go-only, type (concert/festival), search
- Sort: yes, with asc/desc direction toggle
- Compact/non-compact toggle: yes

### Friends
- Filters: min-times-together, has-upcoming-only, type, search
- Sort: yes, with asc/desc direction toggle
- Compact/non-compact toggle: yes

---

## Confirmed inconsistencies (pass 1 findings)

1. **Asc/desc sort direction** only exists on Artists. Songs, Venues, and Friends can sort by different criteria but can't flip the direction.
2. **Compact/non-compact view toggle** only exists on Shows and Artists (as two separate settings). Songs, Venues, and Friends don't have it at all.
3. Not yet checked: whether every filter has a matching "clear filters" affordance, whether search behaves identically (live vs submit) across tabs, whether empty-state messaging is consistent.

---

## Artist detail page (the most-worked-on part of the app)

Four tabs: **Overview**, **Shows**, **Songs**, **Info**.

- Overview: fully customizable tile row (drag reorder, hide, per-artist, in edit mode). Photo gallery, three styles to choose from (Strip / Polaroid / Pinned) in Settings.
- Shows: chronological timeline of every appearance type, with photo thumbnails, venue-type icons, companion avatars.
- Songs: dotted list, play-count bars, sort control (Most seen / A-Z / Album), completion bar (manual total, overall + per-album).
- Info: Numbers (discography), Milestones (one-time dates), Every Year (recurring dates — birthdays, fandom days — with today highlighted green and past ones dimmed).

---

## Open questions before we go further

1. **Should the 3 gaps above (asc/desc, compact mode) be fixed to match everywhere, or are they fine as-is because those tabs don't need it?**
2. **For the visual-upgrade pass — do you want one unified pass across the whole app, or should we go tab by tab (e.g. finish Shows tab visuals fully before moving to Songs)?**
3. **Is there a reference look/feel you want the whole app pulled toward** (more like the Artist detail page's current style, or something else entirely), or is it more "make each page nicer in its own way"?
4. Should this document keep growing as we go (pass 2, pass 3...), or do you want a fresh one per pass?
