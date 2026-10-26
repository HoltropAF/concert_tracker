# Usability follow-ups — 26 October 2026

1. Keep song totals based on All / Shows / Festivals, independent of the five-row display cap.
2. Show recorded companions or Solo on show details; open one friend directly or filter the friends list to that show's companions. Do not infer Solo from missing information.
3. Repair Spotify linking from song details and expose linking alongside unlinked search results.
4. Default venues to map view. Move discovery into an Up next tab beside Shows, using existing controls and compact result rows.
5. Run Want to go checks once per local calendar day on app opening, persist results per account on this device, and retain manual retry/stop. Never auto-accept changes.
6. Remove duplicate separators and change Where you go to Where you went.
7. Add explicit venue lookup by name / city / country, with selection before filling fields.
8. Medley proposal: one performance row labelled Medley / remix, containing individually linked song parts. Preserve the performance's order and count each component in song statistics. Do not automatically split names on slashes (slashes can be part of real titles).

Verify regression tests and production build, then commit and push. Medley data modelling is a proposal for review, rather than silently changing existing setlists.

## Implemented

Items 1–7 are implemented. Song linking now renders its dialog in the detail view as well as the list; the unlinked filter also searches beyond the top-five display selection. Venue discovery lives in a standalone Up next tab. Venue lookup uses the existing server-side Ticketmaster key and never saves a selection automatically.

Daily checks are once per local calendar day, per account and browser/device. Results persist locally; clearing browser storage resets the daily marker. A manual check of all wishes also counts for the day. Interrupted checks can be resumed manually. Separate devices can each check once; no scheduled background service or automatic acceptance is added.

Venue lookup is bounded to the first 100 Ticketmaster directory matches and filters by city. It cannot promise every venue. Country names supported by the existing discovery selector work; other countries can use two-letter codes. API reference: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/#search-venues-v2

Validation: 58 automated tests plus existing backup/import/share audit scripts passed. Final production compilation and service-worker generation passed. Physical Galaxy S25 interaction and authenticated Spotify matching were not tested in this pass.
