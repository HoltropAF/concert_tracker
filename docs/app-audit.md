# App Audit — settracker

Living document. We update this as we go through every part of the app: what it does, what's inconsistent, and what's still open. Not a changelog — a reference for the current state of things.

---

## Status: IN PROGRESS — pass 1 (structural/functional pass)

Pass 1 covers: what filters/sorts/view-modes exist on each tab, and where they're inconsistent with each other. Visual audit (pass 2) hasn't started yet — see questions at the bottom before we go there.

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
- Sort: yes — **no asc/desc direction toggle**
- Compact/non-compact toggle: **no**

### Venues
- Filters: country, min-visited, want-to-go-only, type (concert/festival), search
- Sort: yes — **no asc/desc direction toggle**
- Compact/non-compact toggle: **no**

### Friends
- Filters: min-times-together, has-upcoming-only, type, search
- Sort: yes — **no asc/desc direction toggle**
- Compact/non-compact toggle: **no**

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
