# Venue agenda checks

1. Inspect public agenda formats and add dedicated readers for verified venue sites.
2. Fetch and cache each supported venue agenda independently of the artist query; reuse it across Want to go entries.
3. Retain bounded generic checking for other venues. Report unsupported formats and temporary failures separately from a successful empty match.
4. Show reader support and freshness in source details without adding clutter to the checklist.
5. Test parsing, shared-cache behavior, safe URLs, failure recovery and live public sources. Run the app tests and production build, then commit and push.

Saved venue URLs are account data, not present in the repository. Initial dedicated readers will be selected from public venue sites that can be verified during this task. No claim of support for every saved venue is made.

Checks remain user-triggered. No scheduled notifications or account credentials are required.

## Delivered 26 October 2026

- Verified AFAS Live reader: reads all published agenda cards from one page, then matches each requested artist and date. Preserves cancelled/sold-out labels without inferring ticket availability from a ticket button.
- Shares parsed agendas and in-flight requests for five minutes within a warm server instance; different server instances may fetch separately. Failed reads are evicted for retry.
- Source details identify the reader, cached results and original fetch time. Other venues retain the existing bounded generic reader and coverage warnings.
- 55 automated tests passed, including agenda parsing, concurrent reuse, freshness, date filtering, hostname matching and failure recovery. Live checks found Treasure (31 October) and Tokio Hotel (4 November), with cache reuse.

## Remaining coverage

Ziggo Dome was inspected but has no verified dedicated reader in this change. Additional venue formats need their own tested readers. This release does not automate every saved website, run scheduled checks, or guarantee ticket inventory.
