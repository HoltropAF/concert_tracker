# Changelog

## 2026-07-22
- Venues now have a real map (free, no API key) — pins for every venue, tap to open Google Maps, geocodes new venues automatically as you add them
- Track venues you want to visit and artists you want to see, separate from ones you've actually been to
- Rebuilt how you log a show: pick offline/online/festival, then already-happened/upcoming, then whether you have a ticket yet — want-to-go entries skip rating, setlist, and ticket fields since none of that exists yet
- Tickets can now be split into named line items (e.g. base ticket + fan club fee) that sum into one total, replacing the old single price field and the travel/stay/food/other breakdown
- Bottom nav is now Shows / Artists / Songs / Venues / Friends; Stats moved to a header icon
- Custom show tags (Cried, Alt, Alt group, or your own) and an all-time-favorite flag, capped at 5 shows — favorites get a gold star rating
- Filters panels across the app simplified: fewer taps, more options visible at once
- Want to go and Upcoming are collapsible sections again, separate from Past
- Fixed left/right alignment across every tab — headlines and controls now line up flush with the cards below them
- Fixed the +N upcoming badge including future years it shouldn't have, and Up next showing want-to-go shows with no ticket or date
- Cumulative shows chart is more compact; pie chart legends no longer cut off longer words
- Fixed a bug where converting a want-to-go show to "tickets bought" without a date could leave a bogus placeholder date behind and mess up charts
- Fixed several filter panels not opening properly, a friend-tap glitch, and the app losing its Filters button behind other content on Shows/Artists
- Costs on a show's page now group tickets and merch under headings when there's more than one of each
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
