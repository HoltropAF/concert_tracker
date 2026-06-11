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

---

## 2026-06-11 (2) — Cover marking works without a linked artist

**Bug found while verifying cover flow:** clicking "Mark as cover" (or pressing Enter)
with an empty artist field *removed* the cover mark instead of applying it — `applyCover`
treated an empty string as "remove". Covers could only be saved if the original artist
was typed.

**Changes (src/components/ConcertTracker.jsx):**
- A song can now be marked as a cover without naming the original artist
  (stored as `cover: true`); typing an artist still links it (stored as `cover: "Artist"`).
- Setlist display shows "↩ Artist" when linked, "↩ cover" when not.
- Song stats: only string covers are attributed to the original artist; unlinked covers
  stay credited to the performing artist. Same for the song detail matcher.
- Artist page "Covered by others" unaffected (string match only, as intended).

---

## 2026-06-11 (3) — Stats expansion

**New "Records" chart group:**
- 🏆 Records: busiest month & year, longest streak of consecutive months with shows,
  longest drought between shows, priciest & cheapest ticket (tappable), free show count.
- 🎖️ Artist milestones: artists seen 10+/5–9/3–4 times, tiered.
- 🎁 Year recap: shareable "Wrapped"-style card per year (shows, festivals, spent,
  top artist/song/venue, new artists seen) with year selector.

**Other additions:**
- ↩️ Covers chart (Artists group, shows only if covers exist): most covered artists +
  full list of covers witnessed, each tappable to the concert.
- 💜 Venue loyalty chart (Venues group): % of shows at top venue, new venues per year,
  total venues visited.
- Favourite venues rows now tappable → venue detail page listing all shows there
  (incl. upcoming), each tappable to the concert.
- Top songs: artist now on its own smaller line (better on narrow screens).
- Summary: "fill the gaps" nudge at the bottom (shows missing setlist / price / rating).

All client-side; no schema or API changes.

---

## 2026-06-11 (4) — Financial logging + summary filters + averages

- **Other costs editable**: the "Other costs" (concerts) / "Travel & other costs"
  (festivals) field existed only in the Add form; added it to the edit form too,
  so existing shows can now log other costs.
- **Summary filters apply to the whole page**: year toggle (All time / current year)
  AND new All / Concerts / Festivals pills now filter the top boxes, the cumulative
  chart, and the genre/venue-size donuts together.
- **💶 Averages chart** (Financial group): avg ticket, avg merch (when bought),
  avg other costs (when logged), and avg total — split for concerts vs festivals.
- **Settings chart toggles updated**: Covers, Records group (Records / Milestones /
  Year recap), Venue loyalty, and Averages can now all be hidden/shown in
  Settings → Stats display.

---

## 2026-06-11 (5) — Stats revamp: dashboard + drill-down

- Summary stays the glanceable dashboard (with year + concert/festival filters).
- The Stats tab no longer dumps a swipeable wall of stacked charts. It now lands on
  an "Explore your stats" hub: a 2-column card grid (Artists 🎤, Records 🏆,
  Friends 👯, Venues 📍, Financial 💸, Merch 🛍️), each with a live preview
  (top artist, top venue, total spent…).
- Tapping a card opens that section: sticky header with ← back, section title,
  per-chart labels above each chart. Swipe left/right still moves between sections.
- Hardware/gesture back goes section → hub → summary.
- Removed the cramped chart-group pill bar above the bottom nav (navigation now in-page).
- Hidden groups/charts (Settings → Stats display) are respected in the hub.

---

## 2026-06-11 (6) — Remove concert/festival filter from summary

Per user feedback: removed the All / Concerts / Festivals pills from the summary page.
Year toggle (All time / current year) remains and still filters the whole page
(top boxes, cumulative chart, donuts). Concert vs festival breakdowns live in the
stats sections (Financial averages, etc.) instead.
