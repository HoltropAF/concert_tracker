# Pipeline & Change Log

Log of changes made to this repo via the Claude → GitHub → Vercel pipeline.
Every push to `main` auto-deploys to Vercel (project `settracker`).

---

## 2026-06-11 — Setlist editing fix + per-artist song stats

**Issues reported:**
1. Couldn't change setlists after adding them
2. Cover songs: songs with the same name by different artists merged in song stats
3. Opening edit mode triggered an error/reload screen

**Root causes found:**
- (3, and blocking 1) `ConcertDetail`'s edit-mode setlist section referenced `allArtists`,
  but that prop was never passed to `ConcertDetail` → `ReferenceError` → React error
  boundary ("reload" screen) whenever a setlist row was expanded in edit mode.
  Cover-marking UI (↩ button) already existed but was unreachable because of this crash.
- (2) Song stats counted by song *name only* (`songCount[name]++`), merging identical
  titles from different artists, and ignoring cover attribution.

**Changes (src/components/ConcertTracker.jsx):**
- `ConcertDetail` now accepts an `allArtists` prop; the render site passes the same
  deduplicated artist list already used by `AddConcertForm`. Fixes the crash and enables
  artist autocomplete when marking a song as a cover.
- Song stats now group by `song name + attributed artist`, where attributed artist =
  the cover's original artist if marked as cover, otherwise the performing artist.
- "Top songs" list now shows the artist next to each song.
- Song detail page (tap a song in stats) matches on name+artist, shows the artist in the
  header, and shows a "· cover" badge on appearances where it was performed as a cover.

**Not changed:** per-artist song list (inside an artist's page) still groups by name only,
since it's already scoped to one artist. DB schema untouched (songs live in concert JSONB).
