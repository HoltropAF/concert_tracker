# Spotify integration — plan

Turn logged concerts into Spotify playlists and unlock setlist-based stats.

## What this enables

- Auto-fetch the setlist for a concert (which songs were played)
- Match those songs to Spotify tracks
- Create a Spotify playlist per concert with one tap
- Stats: most-heard albums, most-heard songs, artist deep-dives

## The two APIs involved

### 1. setlist.fm (<https://api.setlist.fm>)

- Free, just needs an API key (register at setlist.fm/settings/apps)
- Crowd-sourced concert setlists — good coverage for mid-to-large artists
- Search endpoint: `GET /rest/1.0/search/setlists?artistName=X&date=YYYY-MM-DD`
- Returns sets, songs, venue info
- Limitation: small/local/niche shows are often missing

### 2. Spotify Web API (<https://developer.spotify.com>)

- Free tier sufficient for everything we need
- Register an app at developer.spotify.com → get client ID + secret
- Two usage levels:

  - **Client credentials** (no user login) — search for tracks, get artist/album data
  - **OAuth (Authorization Code flow)** — act on behalf of the user, e.g. create playlists

Both client ID and secret go in Vercel env vars (alongside the existing Supabase ones).

## How it would work end-to-end

1. User logs a concert (artist + date + venue, already stored)
2. On the concert detail view, a "find setlist" button queries setlist.fm
3. If found: show the songs, let user confirm or edit the list
4. Store the confirmed setlist in Supabase (new `setlist_songs` table, linked to concert)
5. "Create Spotify playlist" button → triggers Spotify OAuth if not already connected
6. App calls Spotify Search for each song → collects track URIs
7. Calls Spotify Playlist API → creates playlist in user's library
8. Stores the playlist URL so the user can open it later

## Database changes needed

New table: `setlist_songs`

- `id`, `concert_id` (FK), `song_title`, `spotify_track_id` (nullable), `position`

New column on existing table (or separate `user_integrations`):

- `spotify_access_token`, `spotify_refresh_token`, `spotify_token_expiry`

## Spotify OAuth flow

Spotify uses Authorization Code + PKCE for SPAs (no backend secret needed).

1. User clicks "Connect Spotify"
2. Redirect to Spotify auth page with scope: `playlist-modify-public playlist-modify-private`
3. Spotify redirects back to app with a code
4. Exchange code for access + refresh tokens
5. Store tokens in Supabase (encrypted at rest by Supabase)
6. Refresh automatically when expired (tokens last 1 hour)

This is a separate login from Supabase magic link — user has two sessions:
one for the app, one for Spotify. This is normal and standard.

## Stats this unlocks

Once setlist songs + Spotify track IDs are stored:

- Most-heard songs across all concerts
- Most-heard albums (via Spotify album data on each track)
- Artist breakdown: how many songs per show, how it varied across tours
- "You've heard X% of [artist]'s discography live"
- Timeline: when did you first hear a specific song live

## Complexity assessment

| Part                        | Difficulty  | Notes                                          |
|-----------------------------|-------------|------------------------------------------------|
| setlist.fm API integration  | Low         | Simple REST, just needs an API key             |
| Setlist matching/fuzzy find | Medium      | Dates + venue names don't always match exactly |
| Spotify Search (track IDs)  | Low         | Straightforward search endpoint                |
| Spotify OAuth (PKCE)        | Medium      | Standard flow but new auth layer to manage     |
| Playlist creation           | Low         | One API call once tokens are in place          |
| DB schema changes           | Low         | One new table                                  |
| Stats UI                    | Medium      | Aggregation logic + new UI components          |

Overall: medium-high. Not a weekend project but not enormous either.
Best tackled as a dedicated sprint after the app is stable and public.

## Suggested build order (when ready)

1. setlist.fm fetch + display (no Spotify yet, just show the setlist)
2. Store confirmed setlists in DB
3. Spotify OAuth + "Connect Spotify" flow
4. Playlist creation
5. Stats tab additions

## Two-track decision (decide before building)

Before starting, pick one of these paths:

**Track 1 — keep it simple**
No external APIs. The app stays exactly as it is: pure concert logging, no setlists,
no Spotify. Clean, fast, zero extra setup for users.

**Track 2 — enhanced with APIs**
Add setlist.fm + Spotify integration as described in this doc. Unlocks playlists and
deeper stats, but adds setup complexity and two new external dependencies.

These don't have to be mutually exclusive — Track 2 can be fully opt-in:
users who don't want it just never connect anything, and the app behaves like Track 1.

### API keys in Settings, not just env vars

Rather than requiring users to redeploy every time they want to connect or disconnect
an integration, expose the API credentials in the app's Settings page:
- setlist.fm API key field (optional — leave blank to disable setlist lookup)
- "Connect Spotify" button (OAuth, stored in Supabase — not an env var)
- Toggle to enable/disable each integration independently

This way a user can opt in to Spotify today and opt out tomorrow without touching
Vercel or environment variables. Env vars remain as a fallback for power users who
want to pre-configure everything at deploy time.

## Open questions

- Do we want to show setlist.fm results even when they might be wrong/incomplete,
  or only when confidence is high?
- Should the Spotify playlist be public or private by default?
- Do we surface album art anywhere in the UI once we have Spotify data?
- Should "Connect Spotify" be optional (some users won't want it)?
  Answer is probably yes — all Spotify features are opt-in.

## Pre-release checklist item

This is post-launch — do not block release on this.
Add to backlog in `docs/pre-release.md` when ready to plan the sprint.
