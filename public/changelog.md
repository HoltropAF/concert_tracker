# Changelog

## 2026-07-22
- Fixed the diverging monthly chart: shows count grows up, spending grows down (was backwards); cleaner symmetrical bars
- All-time faves gets its own dedicated view on Stats (stat tiles, timeline, ranked list with photos) instead of showing charts that don't say much about 5 specific shows
- Cried / Ult group info on Artist pages redesigned as a small subtitle line instead of a badge
- A droplet icon now shows next to the star rating on any show tagged "Cried"
- Renamed "Alt (group)" to "Ult (group)" — it's ultimate group, not alternative
- Tags and all-time favorites: split onto their own row on cards/detail, a "Moments" filter (ATF + your tags) on Shows, an ATF toggle on Stats, and cried-count/alt-group info now shown on the Artist page
- Merged Alt and Alt group into one "Alt (group)" tag
- Sort artists by average € per song (festivals excluded from that calculation)
- Artist page: Upcoming/Headliner/Support sections now collapse like Shows' Activity does, and photos are narrower so a third one peeks into view
- Fixed a real bug: a show dated today was flipping to "past" the instant the clock struck midnight, hours before the show itself — it now stays "upcoming" until the day is actually over
- Merged the Shows-per-month and Spending-per-month charts into one diverging bar chart (spending up, show count down) when a specific year is selected
- Venues now have a real map (free, no API key) — pins for every venue, tap to open Google Maps, geocodes new venues automatically as you add them
- Track venues you want to visit and artists you want to see, separate from ones you've actually been to
- Rebuilt how you log a show: pick offline/online/festival, then already-happened/upcoming, then whether you have a ticket yet — want-to-go entries skip rating, setlist, and ticket fields since none of that exists yet
- Tickets can now be split into named line items (e.g. base ticket + fan club fee) that sum into one total, replacing the old single price field and the travel/stay/food/other breakdown
- Bottom nav is now Shows / Artists / Songs / Venues / Friends; Stats moved to a header icon
- Custom show tags (Cried, Alt, Alt group, or your own) and an all-time-favorite flag, capped at 5 shows — favorites get a gold star rating
- Tags and the favorite toggle now show up correctly when editing an existing show, not just when adding a new one
- Filters panels across the app simplified: fewer taps, more options visible at once
- Want to go and Upcoming are collapsible sections again, separate from Past
- Photo reframing on a show now shows two live previews at once — how it looks on the detail page and how it looks in the shows list — so you're not guessing or switching back and forth
- Fixed the +N upcoming badge including future years it shouldn't have, and Up next showing want-to-go shows with no ticket or date
- Cumulative shows chart is more compact; pie chart legends no longer cut off longer words
- Fixed a bug where converting a want-to-go show to "tickets bought" without a date could leave a bogus placeholder date behind and mess up charts
- Fixed several filter panels not opening properly, a friend-tap glitch, and the app losing its Filters button behind other content on Shows/Artists
- Costs on a show's page now group tickets and merch under headings when there's more than one of each
- "Find me online" is now a quiet credit line at the bottom of Settings instead of its own card
- Light mode, a bar/line toggle for the Shows Activity chart, and a yearly Spending chart that now follows the same year filter as the rest of the Summary page

## 2026-07-15
- Push notifications actually work now: instant alerts while the app is open, plus a daily background check via ntfy for when it's closed
- Settings redesigned: cleaner layout, real sliders, full-width choice pills, section icons
- Shows: pick multiple years at once, one filter open at a time, "Online" show type, Upcoming can collapse
- Songs: pulls track duration, popularity, and track number from Spotify
- Venues: cleaner stats, a Maps link, a spot for the venue's own website, collapsible past/upcoming
- Costs can now be split into ticket / travel / stay / food instead of one lump sum
- New "Year in pixels" chart — a day-by-day view of your concert activity
- Fixed: Artists tab was missing upcoming festival lineups; want-to-go shows leaking into the wrong filters
