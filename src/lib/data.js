// * Static seed/default data. No logic, no imports — everything here is either
// * initial content or the baseline shape of the settings object.

// * Optional hardcoded library, written to the DB on a user's very first login.
// * Empty is the normal case, and useConcerts branches on that: when empty, the DB is
// * the sole source of truth for concerts; when populated, SEED_DATA wins for base
// * fields and the DB only wins for the user-editable ones (rating, merch, notes,
// * friends, solo). Filling this in turns the app into a fixed, curated log.
export const SEED_DATA = []

// * Demo library loaded into localStorage on a visitor's first guest session, so the
// * app has something to show instead of empty views. Never touches Supabase, and is
// * wiped by clearGuest() on exit.
// * Chosen to exercise the interesting cases: solo and group shows, a multi-day
// * festival with an acts list, a support act, a foreign country, and a future date
// * that renders as upcoming.
// ! demo-10 is dated 2027 to stay in the future. It will start reading as a past show
// ! in 2027 and should be pushed forward before then.
export const SAMPLE_CONCERTS = [
  {
    id: 'demo-1',
    artist: 'Nick Cave & The Bad Seeds', date: '2023-05-11',
    venue: 'Paradiso', room: '', city: 'Amsterdam', country: 'Netherlands',
    type: 'concert', tour: 'Wild God Tour', support: [],
    friends: [], solo: true, rating: 5, ticketPrice: 55,
    merch: [{ item: 'Book', price: '30' }],
    notes: 'Transcendent. Wept during Ghosteen Speaks.',
    genre: 'Rock', subgenre: 'Alternative rock', language: ['English'], venueSize: 'Mid-venue', seenAs: 'Headliner',
  },
  {
    id: 'demo-2',
    artist: 'Stromae', date: '2022-05-23',
    venue: 'Ziggo Dome', room: '', city: 'Amsterdam', country: 'Netherlands',
    type: 'concert', tour: 'Multitude Tour', support: [],
    friends: ['Thomas'], solo: false, rating: 5, ticketPrice: 70,
    merch: [{ item: 'T-shirt', price: '40' }],
    notes: 'Put on a show. Every detail perfect.',
    genre: 'Pop', subgenre: 'Electropop', language: ['French', 'Dutch', 'English'], venueSize: 'Arena', seenAs: 'Headliner',
  },
  {
    id: 'demo-3',
    artist: 'The National', date: '2023-10-14',
    venue: 'AFAS Live', room: '', city: 'Amsterdam', country: 'Netherlands',
    type: 'concert', tour: 'First Two Pages of Frankenstein Tour', support: ['Faye Webster'],
    friends: ['Emma'], solo: false, rating: 4, ticketPrice: 45,
    merch: [], notes: '',
    genre: 'Rock', subgenre: 'Indie rock', language: ['English'], venueSize: 'Mid-venue', seenAs: 'Headliner',
  },
  {
    id: 'demo-4',
    artist: 'Caroline Polachek', date: '2022-11-08',
    venue: 'Paradiso', room: '', city: 'Amsterdam', country: 'Netherlands',
    type: 'concert', tour: 'Desire, I Want to Turn Into You Tour', support: ['Yeule'],
    friends: ['Sarah'], solo: false, rating: 5, ticketPrice: 25,
    merch: [{ item: 'Tote bag', price: '20' }],
    notes: '',
    genre: 'Pop', subgenre: 'Indie pop', language: ['English'], venueSize: 'Mid-venue', seenAs: 'Headliner',
  },
  {
    id: 'demo-5',
    artist: 'Mitski', date: '2022-09-28',
    venue: 'Paradiso', room: '', city: 'Amsterdam', country: 'Netherlands',
    type: 'concert', tour: 'Laurel Hell Tour', support: [],
    friends: [], solo: true, rating: 5, ticketPrice: 25,
    merch: [{ item: 'Poster', price: '25' }],
    notes: 'She barely spoke but the music did everything.',
    genre: 'Rock', subgenre: 'Indie rock', language: ['English'], venueSize: 'Mid-venue', seenAs: 'Headliner',
  },
  {
    id: 'demo-6',
    artist: 'Fontaines D.C.', date: '2024-03-06',
    venue: 'AFAS Live', room: '', city: 'Amsterdam', country: 'Netherlands',
    type: 'concert', tour: 'Romance Tour', support: ['Bar Italia'],
    friends: ['Emma'], solo: false, rating: 4, ticketPrice: 35,
    merch: [], notes: '',
    genre: 'Rock', subgenre: 'Indie rock', language: ['English'], venueSize: 'Mid-venue', seenAs: 'Headliner',
  },
  {
    id: 'demo-7',
    artist: 'Kendrick Lamar', date: '2025-06-22',
    venue: 'King Baudouin Stadium', room: '', city: 'Brussels', country: 'Belgium',
    type: 'concert', tour: 'Grand National Tour', support: ['SZA'],
    friends: ['Thomas', 'Sarah'], solo: false, rating: 5, ticketPrice: 110,
    merch: [{ item: 'T-shirt', price: '50' }],
    notes: 'GNX live hit completely different.',
    genre: 'Hip-Hop', subgenre: null, language: ['English'], venueSize: 'Stadium', seenAs: 'Headliner',
  },
  {
    id: 'demo-8',
    artist: 'Lowlands 2023', date: '2023-08-18', endDate: '2023-08-20',
    venue: 'Walibi Holland', room: '', city: 'Biddinghuizen', country: 'Netherlands',
    type: 'festival', tour: '', support: [],
    acts: [
      { name: 'Kendrick Lamar', day: 1, highlight: true },
      { name: 'The National',   day: 1, highlight: false },
      { name: 'Caroline Polachek', day: 2, highlight: true },
      { name: 'Stromae',        day: 2, highlight: false },
      { name: 'Fontaines D.C.', day: 3, highlight: true },
      { name: 'Mitski',         day: 3, highlight: false },
    ],
    friends: ['Emma', 'Thomas', 'Sarah'], solo: false, rating: 5, ticketPrice: 245,
    merch: [{ item: 'Tote bag', price: '25' }],
    notes: '3 days of perfection. Kendrick on day 1 was something else.',
    genre: 'Pop', subgenre: null, language: ['English', 'Dutch'], venueSize: null, seenAs: 'Festival',
  },
  {
    id: 'demo-9',
    artist: 'Radiohead', date: '2016-07-08',
    venue: 'Rock Werchter', room: '', city: 'Werchter', country: 'Belgium',
    type: 'concert', tour: 'Moon Shaped Pool Tour', support: ['Liars'],
    friends: ['Emma', 'Thomas'], solo: false, rating: 5, ticketPrice: 85,
    merch: [{ item: 'T-shirt', price: '35' }],
    notes: 'Pyramid Song in the rain. Still think about this.',
    genre: 'Rock', subgenre: 'Alternative rock', language: ['English'], venueSize: 'Stadium', seenAs: 'Headliner',
  },
  {
    id: 'demo-10',
    artist: 'Fontaines D.C.', date: '2027-02-14',
    venue: 'Ziggo Dome', room: '', city: 'Amsterdam', country: 'Netherlands',
    type: 'concert', tour: '', support: [],
    friends: ['Emma'], solo: false, rating: null, ticketPrice: 55,
    merch: [], notes: '',
    genre: 'Rock', subgenre: 'Indie rock', language: ['English'], venueSize: 'Arena', seenAs: 'Headliner',
  },
]

// * Baseline for every user's settings object. normalizeSettings() in useSupabase.js
// * merges the stored blob over this, so a key added here is picked up automatically
// * by existing accounts.
// ! Any new setting must get an entry here. A key that only exists at the call site
// ! reads as `undefined` for every existing user, and the list-valued ones
// ! (merchCategories, genres, subgenres, languages, venueSizes) are additionally used
// ! as the fallback when a stored value fails validation.
export const DEFAULT_SETTINGS = {
  topArtistsRows: 6,
  topFriendsRows: 8,
  topVenuesRows: 5,
  topExpensiveRows: 10,
  defaultTab: 'stats',
  defaultShowPast: 'closed',
  defaultStatsTab: 'summary',
  merchCategories: ['T-shirt','Hoodie','Crewneck','Tank top','Tote bag','Poster','Print','Hat / Cap','Beanie','Keychain','Pin / Badge','Wristband','Lightstick','Album','Vinyl','Other'],
  genres: ['Pop','K-pop','Rock','Electronic','Country','Hip-Hop','R&B','Metal','Folk','Jazz','Classical','Other'],
  subgenres: ['Indie pop','Dutch pop','Latin pop','Pop punk','Indie rock','Alternative rock','Folk rock','Drum & Bass','EDM','Dance','Singer-songwriter','Electropop'],
  languages: ['English','Dutch','Spanish','French','German','Korean','Japanese','Portuguese','Other'],
  venueSizes: ['Small', 'Medium', 'Large', 'Arena', 'Stadium'],
  // Tags you've chosen to keep even though nothing uses them yet, as "listKey:value".
  keptTags: [],
  colorTheme: 'purple',
  compactView: false,
  showVenueOnCards: true,
  showGenreTagsOnCards: true,
  defaultSort: 'newest',
  groupByMonth: false,
  hiddenChartGroups: [],
  hiddenCharts: [],
  hiddenSummaryBlocks: [],
  topSongsRows: 5,
  summaryYear: 'all',
  summaryFinType: 'all',
  setlistfmApiKey: '',
  savedVenues: [],
  friendGroups: [],
  friendProfiles: {},
  defaultCountry: '',
}

// ! Dead export — nothing imports this. Friends are derived from concert.friends
// ! strings at render time; there is no canonical friend list anywhere.
export const FRIENDS = []
