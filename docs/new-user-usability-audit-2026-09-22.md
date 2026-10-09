# SetTracker: new-user usability audit

Audited 21–23 September 2026. Code and production deployment: `f4716b3`.

## Current resolution — 9 October 2026

The confirmed defects below are addressed in this change: XLSX routing and metadata preservation; setup photo schema and fork instructions; explicit hosted versus private-copy onboarding; guest header layering; wishlist visibility, labels, dates and counts; backup completion/scope accounting; accessible required fields and focus; visible data-load errors with retry; expired email-link feedback; clipboard failures; and import preview/write-count consistency. SMTP setup guidance is included. JSON is explicitly labelled as a preview; exports exclude settings and photo files and say so.

Regression probes cover real XLSX serialization including long metadata, import previews/writes, clipboard failures, and failed/empty/successful data reads. The historical observations below describe the original deployment and must not be read as the current fix status.

Still unverified: external provider integration, real-phone installation/offline behaviour, two-account isolation, fresh infrastructure provisioning, and production browser regression after deployment. These are coverage gaps, not confirmed unresolved bugs. Photos remain separate storage objects; exporting their references does not migrate their bytes to another account.

## Assessment (original audit)

The core concert journal works in several tested paths, but I would not yet describe the complete new-user setup and recovery experience as reliable. The largest problems are conflicting onboarding routes, an incomplete self-hosting database script, and a broken XLSX restore route. This is a first-pass audit, not an end-to-end signoff: real email verification, authenticated persistence, new infrastructure provisioning, and device installation remain untested.

## Scope and evidence

- Live browser testing at https://settracker-theta.vercel.app/ and `/setup.html`, using guest/demo data only.
- Inspected the narrow/mobile presentation and a desktop presentation. This is not a full responsive or accessibility certification.
- Inspected source code, README, schema, setup wizard, and existing audit/planning documents.
- Read-only Supabase inspection: `concerts` and `settings` have RLS enabled and policies restricting rows to `auth.uid() = user_id`; `photos` is private with owner-folder storage policies. These checks do not substitute for a two-user authorization test.
- Vercel reports the latest production deployment READY from `HoltropAF/concert_tracker`, main, commit `f4716b30ee56ff0f97595ad7015c466a8df34582`.
- Existing setlist tests: 3 passed. Vite emitted production assets successfully with a large-chunk warning. The command session was interrupted before final PWA completion could be retrieved, so full build exit is not recorded as verified.
- `node docs/audit-restore-probe.mjs` reproduces the XLSX routing defect using the exact existing import handler and in-memory sheet fixtures, without changing database data.

## Confirmed findings, in priority order

### 1. High: the app's XLSX export cannot restore a library through its XLSX import

**Evidence:** handler reproduction plus code inspection. Export always creates `Shows`, `Setlists`, and `Support acts` sheets. Import checks `Support acts` first and returns before reading `Shows`, even when the support sheet is empty. In an empty library it reports that all support acts are up to date and restores no concerts.

Reproduction output:

```text
shows-only fixture: expected 1, staged 1
app-export-shape fixture: expected 1, staged 0
message: All support acts were already up to date — nothing to add.
```

**Impact:** a new installation cannot recover its library from the prominent XLSX backup format. Users receive success-like feedback rather than a warning.

**Fix:** import Shows first when present, merge setlists/support sheets into those rows by ConcertID, and use support-only mode only for workbooks without Shows. Test an export/restore round trip into an empty library, including festivals, wishlist status, costs and song metadata. The current Shows mapping also omits fields such as wishlist/attendance mode and festival acts, so fixing the early return alone does not establish a lossless backup.

Source: `src/components/ConcertTracker.jsx`, `handleXlsxExport` around 9716 and `handleXlsxImport` at 9989. Reproduction: `docs/audit-restore-probe.mjs`.

### 2. High: following the setup wizard omits photo storage

**Evidence:** live wizard step 4 and code comparison. Its SQL creates only concerts/settings and their policies. The repository's `supabase-schema.sql` additionally creates the private photos bucket and storage policies, which `src/lib/photos.js` requires.

**Impact:** someone following the wizard can create a seemingly working installation where photo upload fails. The existing owner's project already has the bucket, so testing only that project would conceal the defect.

**Fix:** make the wizard consume the canonical schema, including storage, and validate a clean installation. Do not maintain two independently edited SQL copies.

Source: `public/setup.html:757`, `supabase-schema.sql`, `src/lib/photos.js`.

### 3. High usability risk: onboarding presents two incompatible setup stories

**Evidence:** live UI. Main landing → I'm new → optional install → email promises an account on the current installation. Explore demo → want your own copy sends the visitor to a nine-step GitHub/Supabase/Vercel wizard. The README also describes self-hosting. There is no clear choice explaining these different destinations and ownership models.

**Impact:** a newcomer cannot tell whether an email is enough or whether three service accounts are required, and can end up using the wrong installation.

**Fix:** decide and explicitly label the intended default: use this hosted instance, or set up a private copy. Explain the alternative as optional. This is a product decision rather than something to silently infer in a code fix.

Source: `src/components/WelcomeFlow.jsx`, `src/App.jsx:308`, README, `public/setup.html`.

### 4. Medium: demo banner covers detail controls

**Evidence:** live screenshot and interaction. Open a demo concert while the guest banner is visible. The fixed banner overlays its header. Clicking Edit did not enter editing; dismissing the banner made the same control work. Header content was visibly obscured.

**Fix:** reserve actual layout space for the banner, including fixed detail/editor views, or place it within the app layout. Verify mobile and desktop headers, Back, Share, and Save.

Source: `src/App.jsx:310` (fixed top banner, z-index 9999), `src/components/ConcertTracker.jsx:2286` (fixed detail view).

### 5. Medium: an undated wishlist show displays 31 Dec 9999

**Evidence:** live reproduction. Shows → Add a show → Want to go → enter only `QA Test — The Newcomers` → Save. Detail header displays `31 Dec 9999 ·` and a nearly empty venue button, followed by `, Netherlands`.

The entry survives refresh. The list hides the sentinel date correctly, but the detail view does not. The summary's upcoming count increased from 1 to 2 even though there was still only one booked upcoming show; it counts the wishlist entry.

**Fix:** use a shared unknown-date presentation, omit empty location navigation, and keep wishlist counts separate from booked upcoming shows.

Source: `src/components/ConcertTracker.jsx:8489` (sentinel), 2295 (detail date), 11728 (upcoming count).

### 6. Medium: backup status claims success before a backup exists

**Evidence:** live reproduction. Settings → Account → Backup → JSON. Status immediately changes from Never exported to Last export today / Nothing added since then. JSON is only displayed in a textarea; no file is downloaded and Copy has not been pressed.

Code also records the full concert count when exporting only a selected year or photos subset. JSON exports concert rows, not settings; photos are explicitly excluded in the UI when present.

**Fix:** provide a JSON file download, await clipboard success if copying, and record completed exports with their scope. Distinguish a concert export from a complete account backup.

Source: `src/components/ConcertTracker.jsx:9364`, 9765, 9774, 10905.

### 7. Medium: required-field errors are conveyed only by border color

**Evidence:** live reproduction. Add an attended concert and click Save on the empty form. No explanatory text or alert appears; pink borders identify the missing fields visually. Labels are divs rather than associated labels in this form, which also limits accessible identification.

**Fix:** display a short error summary and field-level messages, associate labels, set aria-invalid, and focus the first invalid field. Keep the existing switch to the Show tab when validation fails elsewhere.

Source: `src/components/ConcertTracker.jsx:8473` and field rendering around 8660.

### 8. Medium: wishlist fields are falsely labeled required

**Evidence:** live reproduction. An undated wishlist entry shows Venue name *, City *, and Country *, but saving just an artist succeeds. Validation explicitly exempts wishlist entries from these requirements.

**Fix:** align field labels with validation and show optional location guidance.

### 9. Medium: the wizard's deployment link does not target the user's fork

**Evidence:** live step 6. It says the import page is already pointed at your fork, but the link is `vercel.com/new/clone` with repository-url fixed to `https://github.com/HoltropAF/concert_tracker`. The wizard never asks for the fork URL.

**Impact:** it introduces an unnecessary fork step and can create a separate cloned repository, confusing where subsequent changes belong.

**Fix:** either accept/import the actual fork, or describe the clone-based deployment flow and remove the redundant fork instruction.

Source: `public/setup.html:587`, 885.

### 10. Medium: the README's ZIP-to-Git workflow fails for an existing fork

**Evidence:** source review, not a newly provisioned GitHub reproduction. The guide forks the repository, downloads a ZIP, initializes a new repository with an unrelated root commit, then pushes main to the already populated fork. That push is normally rejected as non-fast-forward. Git installation/configuration is also absent from prerequisites despite later Git commands.

**Fix:** clone the fork to preserve history, or use the GitHub/Vercel web deployment path consistently. Do not suggest force-pushing to get around this.

### 11. Medium: data-load failures can look like an empty or healthy library

**Evidence:** source review; not fault-injected in a signed-in session. `loadConcerts` logs an error and sets loaded true without exposing an error state to the app. Settings load similarly discards the returned error. A missing table, denied read, or outage can therefore look like an empty account or ordinary cached data.

**Fix:** distinguish empty success, stale offline data, and failed reads; give a visible retry action. Verify without a cache as well as with a populated cache.

Source: `src/hooks/useSupabase.js:249`, 358 onward.

## Signup risk requiring a real-account check

The setup guide does not explain custom SMTP or the restriction on the default Supabase email service. Current official documentation says the default service sends only to project-team addresses and is limited to two messages per hour; other users need a suitable delivery setup. This is a confirmed documentation gap, **not proof that the existing SetTracker project lacks SMTP**. Its SMTP configuration and actual delivery have not been verified.

Source checked 22 September 2026: https://supabase.com/docs/guides/auth/auth-smtp

The login UI replaces most errors with generic connection/email advice, so an email-provider configuration failure is also likely to be difficult for a newcomer to diagnose.

## Successful hands-on checks

| Scenario | Result | Limit |
| --- | --- | --- |
| New-user welcome and optional install guidance | Reached email step | No verification email requested |
| Demo entry and tour dismissal | Worked | Seeded demo is not empty-account onboarding |
| Concert form tabs | Show, Setlist, Memories, Costs opened | Fresh dated creation blocked by embedded-browser date interaction |
| Empty required fields | Save prevented | Feedback is color-only |
| Undated wishlist creation | Saved and survived reload | Display/count bugs above |
| Existing demo concert edit | Note saved and survived reload | Needed to dismiss obstructing guest banner |
| Show search | Artist search returned main show and relevant festival | Not an exhaustive filter matrix |
| Malformed JSON import | Clear error; no import | Tested malformed JSON syntax |
| Valid JSON import | Preview showed one new show; import succeeded | Guest/local persistence only |
| Song derivation | QA Opening Song appeared under QA Audit Band | One-song fixture |
| Friend derivation | QA Alex appeared with one show and correct first-show date | One-friend fixture |
| Setup wizard | Walked through steps 1–8 | Placeholder inputs only; no resources provisioned |
| Database ownership configuration | RLS and private storage verified read-only | No two-user or authenticated upload test |
| GitHub-to-Vercel connection | READY production deployment references current commit | Project-details tool failed validation; no env/auth configuration verified |

## Test state and remaining work

### Additional hands-on coverage on 23 September

- Created wishlist artist `QA Wishlist Artist`; edited its album count to 3 and verified it after reloading.
- Created wishlist venue `QA Future Hall`, Utrecht. An unsuccessful location lookup gave a clear explanation and a working “Save without a map pin” alternative. Added a room, tag, parking and transit notes; saved details and parking expansion displayed correctly. Venue map view opened; individual map pins were not verified.
- Edited `QA Audit Band`: added a tour and support act, added a second song, moved it above the first, and appended a section heading. Added `QA Jamie`, a four-star rating and a note. Saved changes appeared in concert details.
- Added a €30 T-shirt and €12.50 transport to the existing €42.50 ticket. Financial details correctly showed €85 total and €42.50 per song for two songs.
- **Additional confirmed display inconsistency:** the headliner setlist badge displayed 3 for two songs plus one section heading, while the financial page correctly counted two songs. Reordering and section display themselves worked.
- Added `QA Festival Act` to day 1 of the demo Lowlands festival. Saving increased the lineup to seven acts and displayed the new act in the correct day. Clicking the act did not visibly navigate; this remains an observation requiring investigation rather than a confirmed defect.
- Tapping the already-selected Venues bottom navigation button while inside a venue retained the detail view. The back arrow returned to the list. Consider whether tapping an active navigation tab should return to its list.

These additional tests used guest/demo data only. They do not establish authenticated cloud persistence. Fresh dated creation, photo and provider integrations, deletion/cancellation, complete filter/calendar/share coverage, file round trips, offline/failure recovery, and an actual fresh self-host deployment remain incomplete.

Only guest browser data was changed: created `QA Test — The Newcomers`, imported `qa-audit-20260922` / `QA Audit Band` with `QA Alex` and `QA Opening Song`, and changed the Kendrick Lamar demo note to a QA message. No real concert records, production configuration, cloud resources, or credentials were changed. The setup wizard was advanced with clearly fake placeholders, not real infrastructure values.

Native date input interaction crashed the embedded browser twice. This is recorded as a **test-environment limitation**, not a confirmed SetTracker browser bug. A Playwright fill also failed to update React's date state, so it is not evidence of a human date-entry failure.

Still needed for a complete assessment:

1. A test inbox or alias controlled by the user; follow the actual email link into a fresh account.
2. Verify empty-account onboarding, dated creation, editing, cloud persistence across sessions, and isolation between accounts.
3. Test authenticated photo upload/replacement, setlist.fm success/failure, and Spotify authorization with suitable test credentials.
4. Walk through a genuinely new private deployment/database if self-hosting is the intended user journey. New provider account creation may require the user's verification or terms acceptance; no such accounts were created during this pass.
5. Test XLSX round trip in-browser after the routing defect is fixed, including metadata preservation.
6. Test phone installation, offline behavior, failed saves, and mobile date controls in Chrome/Safari.

Recommended order: settle the intended onboarding route; fix restore and setup schema; fix blocked controls and misleading backup feedback; then finish authenticated and device tests. Application fixes have not been applied during this investigative pass.

### Email authentication follow-up

The user supplied a controlled test inbox. The setup-email request reached the “Check your inbox” success state, and the user received a verification link. Opening that link returned Supabase `otp_expired` / `access_denied` (“Email link is invalid or has expired”). The reason for invalidation is unknown; do not infer an email delivery failure or configuration fault. The app displayed its initial welcome screen without a visible explanation or recovery message, despite the authentication error in the URL. A fresh login link was requested through the ordinary login flow. Authenticated testing is still pending. Tokens and full verification URLs are intentionally not recorded here.

Correction to the festival observation above: on the next state inspection, QA Festival Act's artist profile was displayed with one live appearance. Festival-to-artist navigation therefore succeeded; the immediate observation was premature.

### Authenticated account results

The second, fresh magic link succeeded. A genuinely empty account opened with zero shows and the welcome tour. The session survived reload. No evidence established why the first link was rejected.

Created `QA Cloud Test Band` / `QA Cloud Hall` through the UI as an undated wishlist entry. Read-only database verification restricted to the test account and this artist confirmed the row persisted with `wishlist: true` and date `9999-12-31`. Thus actual authenticated concert saving is verified for this path, not just browser-local persistence.

**High usability defect: wishlist-only libraries look empty.** After the successful save, Shows displayed “No matches / Nothing fits the current search and filters” with no wishlist section. Clearing filters did not help; reload did not help. Stats showed 1 upcoming. This differs from the populated demo, where the wishlist group was accessible. New users whose first entry is a wishlist show cannot find it in the Shows list.

Date entry through the embedded browser's automation remains blocked: fill plus Tab and keyboard increment did not populate the controlled date input. Fresh dated creation is not verified and this automation limitation is not attributed to the application.

## Follow-up implementation and verification (24–26 September)

Local fixes, not deployed: wishlist-only list rendering and shared search/filter handling; wishlist exclusion from upcoming summary; unknown date/venue presentation; guest banner layering; required-field error summary; email-link error feedback; backup status after successful copy/export and full-scope only; XLSX Shows routing, support-only preview, support/setlist restoration, selected-scope export, wishlist/festival/online/expense fields and section headings; wizard photo schema; correct fork-import guidance and Git clone instructions.

Verification: local browser confirmed wishlist-only search results, unmatched search, accessible Edit with banner present, JSON preview retaining Never exported and successful clipboard copy updating status. Three setlist unit tests passed. audit-restore-probe.mjs passes. audit-workbook-roundtrip.mjs serializes a real XLSX workbook and verifies supported fields, songs/headings and export scope without cloud writes. This is not a claim of lossless backup for every possible field or settings.

Live authenticated checks: imported qa-cloud-dated-20260924 / QA Cloud Concert; UI reported Imported 1 concert, 0 failed. Uploaded public/icon-192.png as a disposable photo, saved a friend tag and visually confirmed the image in concert detail. Replacement with icon-512.png finished uploading but save/reload verification remains pending. Share preview opened; clipboard content could not be confirmed. No messages or share images were sent externally.

Browser blocker: the earlier unified browser control was replaced by Windows Computer Use. That tool refused to continue because it could not identify the browser URL reliably. After the user explicitly reselected @Browser, the ambient tab is visible but no browser control tool or initialized browser runtime is available in the current task. Browser plugin files exist, but its advertised skills directory has no SKILL.md. No undocumented runtime import or desktop workaround was attempted.

Open checks: replacement photo save/reload; date-entry creation; full cancellation/delete/filter/calendar/settings matrix; clipboard/image sharing; Spotify authorization and playlist creation; successful setlist.fm import; offline/failed-save recovery; two-user isolation; device installation and cross-device use; fresh self-host provisioning; final browser regression of local fixes. Also open: load-failure UI, complete field preservation in backups, remaining onboarding ambiguity and accessibility labels. Do not describe the app as fully tested or ready for deployment yet.

## Live browser continuation — 2026-09-29
- Browser control restored; resumed the existing authenticated test account.
- QA Cloud Concert and its photo remain available. Photo storage Check returns 1 file, 48 KB, all in use, no unused photos. This does not establish which earlier replacement upload was saved.
- Entering an unsaved note and leaving the editor retains the draft when reopening; reloading leaves the saved concert with no notes. No accidental cloud save observed.
- Changed only QA Cloud Concert to Online / Concert / QA Stream. Save confirmed; reload and Shows list retained the online platform. Test fixture remains online.
- Concert share text announced success, but clipboard verification did not contain the concert name (case-insensitive). Browser clipboard integration may contribute; source independently confirms unconditional success and unhandled write failures.
- Fixed concert and friend share text handlers locally: await clipboard write, report failure for unavailable or rejected clipboard access. Six mocked success/denied/unavailable checks pass in audit-share-clipboard.mjs.
- Spotify is explicitly shown as not configured; OAuth and playlist creation remain untested.
- Still not a complete every-flow sign-off. Outstanding checks include real provider flows, date entry, deletion confirmation/recovery, multi-account isolation, mobile/PWA, and browser verification of local fixes after deployment.
- Changes remain local and unpublished.

## Sequential checks — 2026-10-08
- Spotify setup guide opens and asks for a Client ID. Asked user for existing public Client ID; OAuth/playlist tests pending configuration.
- Native browser date setValue now works: created QA Date Entry Check, 2026-09-21, QA Hall, Amsterdam. Save succeeded, attended count increased, calendar September 21 showed the exact record. Existing September 20 record also matched its date.
- Delete concert opens an irreversible warning. Cancel preserves record. User explicitly approved deleting only QA Date Entry Check; Delete succeeded, attended count returned to 1, calendar September 21 empty.
- Mobile viewport attempt inconclusive: requested 390px, DOM reported 433px and screenshot rendering was distorted. Reset override; do not count as mobile pass.

## Backup continuation — 2026-10-08
- Live JSON export contains both QA records, song, friend, ticket cost, online platform and photo reference (not photo bytes).
- Pasted the exact export into restore preview: incorrectly reported 1 changed, 1 identical due to normalization defaults. Keep mine completed with 0 writes / 2 skipped.
- Wrong JSON shape rejected with a helpful error, but previous result counters remained visible.
- Restored the same exported QA data using Use the file's: Import 1 actually reported Imported 2 / Added 2 / Failed 0. No new IDs were introduced.
- Local fixes: compare normalized existing/incoming records; skip unchanged records during execution so writes match preview; label successful writes Saved; clear stale report before paste parsing.
- audit-import-preview.mjs verifies unchanged, modified note/song, new record and Keep mine, including actual write counts. All passed. Existing workbook and clipboard probes also passed before the final write-count change.
- All fixes remain local, not deployed. This validates same-account JSON restore, not cross-account recovery of photo files.
- Final verification: restored concert and wishlist both survived reload; final production build including PWA completed successfully (existing large-bundle warning only); git diff --check passed.
