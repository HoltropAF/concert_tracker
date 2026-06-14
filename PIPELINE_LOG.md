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

---

## 2026-06-11 (7) — Summary: monthly bar graph in current-year mode

When the summary year toggle is set to the current year, the cumulative chart block
now shows vertical bars per month (Jan–Dec): purple = past shows, blue = upcoming,
count above each bar. "All time" keeps the cumulative line. Title switches between
"cumulative shows" and "shows per month".

---

## 2026-06-11 (8) — Songs page also groups by song + artist

The standalone Songs page (Shows → Songs) was still counting by song name only,
so two artists' same-titled songs showed a merged count ("3×") even though the
stats chart had been fixed. Now it uses the same grouping: song + attributed artist
(covers credited to the original artist when linked). Rows show the artist under
the song name, search matches artist too, the detail page matches name+artist and
shows a "· cover" badge, and unique/total counts reflect the split.

---

## 2026-06-11 (9) — Remove Records section, restore bottom group bar

- Removed the Records stats section entirely (Records / Milestones / Year recap
  charts and their settings toggles, hub card, and dead code). Covers, Venue loyalty,
  and Averages charts are kept in their respective sections.
- Restored the 5-button chart-group bar above the bottom nav (Artists / Friends /
  Venues / Financial / Merch) — works alongside the hub: tap a pill to jump straight
  to a section, hub grid and ← back still available.

---

## 2026-06-12 — Concerts/Festivals filter pills in chart sections

- New All / Conc / Fest pills on the stats hub header and on every section header.
- The filter applies to all charts in all sections (top artists, songs, venues,
  loyalty, countries, financial, averages, merch, shows-over-time incl. its
  cumulative line) and to the hub card previews. Filter resets on app reload.
- Summary page and its year toggle remain type-agnostic on purpose (per earlier
  feedback); the "fill the gaps" nudge also stays global.
- The "Averages" chart naturally shows only the relevant section when filtered.

---

## 2026-06-12 (2) — Add form step 1: setlist.fm auto-fill

- api/setlist.js: new search mode `?artist=X&date=YYYY-MM-DD` (uses official API,
  needs SETLISTFM_API_KEY env var on Vercel) returning songs + venue/city/country/
  tour. URL mode now also returns venue metadata when the key is present. Covers
  marked on setlist.fm are mapped to the app's cover field automatically.
- Add-concert form (Show card): "✨ Auto-fill from setlist.fm" button under the date.
  Fills only empty fields (never overwrites typed values) and imports the setlist
  if none was added. Clear success/error states incl. "no API key configured".

---

## 2026-06-12 (3) — Add form step 2: venue memory & autocomplete

- Venue inputs in the add form (Quick add, Festival, Show) now autocomplete from
  your venue history, showing the city next to each suggestion.
- Picking a known venue auto-fills city, country, and venue size (only into empty
  fields). Latest visit wins for remembered details.
- Country now defaults to your most recent show's country when no default country
  is set in settings.

---

## 2026-06-12 (4) — Add form step 3: essentials-first layout

- The add form now leads with essentials only (Show/Festival + Location cards).
- Optional sections — Lineup & genre, Acts seen (festival), Your experience,
  Financial, Notes — are collapsed by default; tap to expand (+/−). A green dot
  marks collapsed sections that already contain data (e.g. after setlist.fm
  auto-fill or merch added earlier in the session).
- Combined with auto-fill and venue memory, logging a show is now:
  artist → date → auto-fill → save.

---

## 2026-06-12 (5) — Quick add: festivals, setlist.fm paste, upcoming-aware

- Festivals now open in a Quick add too (name, start/end date, site with venue
  autocomplete, city/country, friends/rating) with "More details" expanding to the
  full form (acts per day, money, notes). Previously festivals always opened the
  long form.
- Concert Quick add gets a "✨ Paste setlist.fm link" row at the top: pasting a
  setlist URL fills artist, DATE, venue, city, country, tour and the setlist in one
  go (API now returns the event date too). Only empty fields are filled.
- Upcoming-aware quick add: when the chosen date is in the future, rating and
  "went with" are replaced by an "upcoming — extras unlock after the date" hint,
  on both concert and festival quick add.

---

## 2026-06-12 (6) — Location autocomplete + auto-fill on quick add

- City and Country fields autocomplete from your history everywhere in the add form
  (concert + festival, quick + full). Picking a known city fills its country too;
  country suggestions come from all countries you've logged.
- The "✨ Auto-fill from setlist.fm (artist + date)" button now also sits on the
  concert Quick add, under the date — alongside the paste-a-link row, so both
  auto-fill paths are available without expanding the form.
- Refactor: shared autoFillFromSearch handler (used by quick add and full Show card).

---

## 2026-06-12 (7) — One photo per concert

**Backend (Supabase migration `concert_photos_bucket`):** private `photos` storage
bucket, 5 MB cap, jpeg/png/webp only, RLS so users can only read/write files under
their own user-id folder. Photo path stored in the concert JSONB as `photo`.

**Client (src/lib/photos.js):** automatic client-side downsizing (max 1280px long
edge, JPEG ~82% → typically 150–250 KB), upload/replace (upsert to
{userId}/{concertId}.jpg), delete, and signed-URL fetching with a 50-min in-memory
cache. Photos load lazily, never during data sync.

**UI:**
- Concert detail (normal view): photo as a horizontal 16:9 rectangle under the
  venue hero, with overlay "replace" / ✕ buttons; dashed "📷 Add a photo" box when
  none. Hidden in guest mode (no account = no storage).
- Show list: full cards show the photo as a wide 5:2 banner; a 📷 toggle next to
  the compact toggle turns list photos on/off (persisted in settings).
- Compact mode: never shows photos.
- Removing a photo deletes the storage file; replacing upserts in place (no
  orphans). Note: deleting a whole concert does not yet delete its photo file
  (harmless, pennies of space — can add cleanup later).

---

## 2026-06-12 (8) — Data audit fixes + multi-genre support

**Database cleanup (run directly on Supabase):**
- Trimmed trailing spaces in venue/city/country ("Tivoli ", "Oudkarspel ", "Netherlands ")
- "Tivoli" merged into "TivoliVredenburg" (now 11 shows)
- P60 city unified to Amstelveen; Ziggo Dome size unified to Arena
- Fox Stevenson genre unified to Electronic / Drum & Bass
- Liquicity Festival city → Oudkarspel; Down The Rabbit Hole city → Beuningen
- Sportpaleis + AFAS Dome merged as "Sportpaleis (AFAS Dome)" (same building, both names)
- Against the Current set to genres ["Rock","Pop"] + Pop punk

**App: genres are now multi-select** (backward compatible — old single-string
genre still works via getGenres helper):
- Genre pills in add + edit forms toggle multiple genres
- All genre stats (genre pie, summary donut, artist pages) count each genre
- Genre filter matches shows containing the selected genre
- Detail view shows one badge per genre
- Stored as string when 1 genre, array when multiple. Subgenre remains single.

---

## 2026-06-12 (9) — Photo reframing in edit mode

- Edit mode now starts with a Photo card (when the show has a photo): drag the
  image to choose which part is visible in the rectangle, with a "center" reset.
  Saved as photoPos {x,y} percentages in the concert data.
- The chosen framing applies everywhere the photo renders: detail page (16:9)
  and the list banner (5:2). Works with touch and mouse.

---

## 2026-06-12 (10) — Photo fully manageable in edit mode

Edit mode's Photo card now always appears (when signed in): shows the current
photo with drag-to-reframe, plus "📷 Replace photo" and "✕ Remove" buttons; when
no photo, a dashed "Add a photo" box. New/replaced photos upload immediately
(auto-downsized); the photo/framing fields persist when you hit Save. Removing
in edit clears the reference on Save (file is reused/overwritten on next upload).

---

## 2026-06-12 (11) — Photo management only in edit mode

Normal show view now only displays the photo (16:9 rectangle) — no overlay
replace/remove buttons and no "Add a photo" box. All photo actions (add,
replace, remove, reframe) live in edit mode's Photo card.

---

## 2026-06-12 (12) — Photo controls moved into Filters panel

- Removed the standalone 📷 button next to the compact toggle.
- New "Photos" section at the top of the show-list Filters panel:
  - "📷 Show in list" — toggles photo banners on cards (persisted setting)
  - "Only with photo" — filters the list to shows that have a photo
    (counts toward the Filters (n) badge)

---

## 2026-06-12 (13) — Fix color shift in photo resizing

Wide-gamut (Display P3, typical iPhone) photos were desaturated during the
client-side resize because the canvas defaulted to sRGB. The resizer now requests
a 'display-p3' canvas where the browser supports it (Safari 16.4+, modern Chrome),
preserving saturated colors like stage lighting; falls back to sRGB elsewhere.
Note: already-uploaded photos keep their stored colors until replaced (re-upload
via Edit → Replace photo to re-process with the fix).

---

## 2026-06-12 (14) — Filters panel scrollable

The Filters panel (show list and artists page) lives in the fixed header area and
could grow taller than the screen with no way to scroll. It's now capped at 55%
of the viewport height with internal touch scrolling (overscroll contained so the
page behind doesn't move).

---

## 2026-06-12 (15) — Big UX batch (10 items)

1. Show detail reordered: venue/tour hero → photo → 3 stat tiles (Rating, Ticket
   incl. type, With: Solo / friend name / "x friends"). "Went with" section removed;
   replaced by a Costs card listing ticket (+type/add-ons), merch, other costs, total.
2. Ticket type (GA/GC/Seated) + add-ons (Barricade, VIP, Soundcheck, Hi-touch,
   Send-off, Early entry) selectable in add & edit forms (Financial), shown in the
   ticket tile, Costs card, and as pink badges.
3. Ticket types and add-ons editable in Settings → Tags.
4. Settings: clearer tabs (⚙️ General / 🏷️ Tags / 👥 People / 💾 Data) and headers.
5. Saved venues: "⤓ Import venues from my shows" backfills from history.
6. Fix: friend groups and saved venues now persist immediately on add/remove
   (previously lost unless Save settings was pressed).
7. Home header centered; counts now "x concerts · x festivals · x upcoming".
8. Artist page: horizontal photo strip of that artist's shows (tap → concert).
9. Artist page: big "N× seen live" hero, avg ticket price, merch items + spend.
10. Friend page: "Photos together" strip + "Together" stats (avg rating, most seen
    artist together, usual venue).

---

## 2026-06-12 (16) — Settings: per-category tag toggles + counts

- The single "Tags & ticket options" section is split into one collapsible per
  category (🎸 Genres, 🎶 Subgenres, 🗣️ Languages, 🏟️ Venue sizes, 🛍️ Merch items,
  🎫 Ticket types, ✨ Ticket add-ons), each with its item count in the header —
  the closed headers double as a settings summary at a glance.
- Saved venues and Friend groups headers now show their counts too.

---

## 2026-06-12 (17) — Settings de-emoji + stats hub removed

- Settings: removed all emojis from tab labels, section headers, and tag category
  titles (counts kept, e.g. "Genres (12)").
- Stats: removed the "Explore your stats" 5-card hub page. The Stats tab now opens
  directly in a chart section; navigation is the 5-button group bar at the bottom
  (just above the main nav), plus swipe between sections. Back gesture returns to
  summary.

---

## 2026-06-12 (18) — Settings: merge Data into General

Settings now has 3 tabs: General (leftmost, default — includes app preferences,
stats display, account & data, help), Tags, People.


---

## 2026-06-12 (19) — Fix keyboard closing in settings inputs

TagManager (and its styles) were defined inside SettingsView, so every keystroke
re-created the component, remounting the input and dismissing the mobile keyboard.
Hoisted to module scope; settings inputs now keep focus while typing.

---

## 2026-06-12 (20) — Financial chart: other/travel costs in breakdown

- Year-spend chart summary now shows two cards (Concerts / Festivals) each with
  their own ticket + merch + other/travel breakdown, so festival travel costs are
  visibly attributed and nothing is hidden in an undifferentiated "other" total.
- The year bars still show concerts vs festivals (full cost incl. other); legend
  updated to match.

---

## 2026-06-12 (21) — Artist page: cost per song + total songs heard

Artist hero area now shows:
- total songs heard live (across all their setlists you've logged)
- €X.XX / song (ticket + merch total ÷ songs heard, only when both are available)

---

## 2026-06-12 (22) — Friend group import from history

Settings → People → Friend groups: new "⤓ Suggest groups from my shows (3+ together)"
button. Finds all combos of friends seen together 3+ times, skips any already saved,
and shows a one-by-one review flow: group members + show count displayed, pre-filled
name (editable), "Save group" or "Skip" to move to the next. Remaining count shown.
