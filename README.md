# settracker

Track every concert and festival you've ever been to. Rate nights, log setlists, see your stats, remember who you went with.

Built by [@annuhfloor](https://www.threads.com/@annuhfloor) — fork it and make it yours.

> **Just want to try it?** Open the live app and tap **"or explore it first"** — no account needed, sample concerts already loaded.

---

## Table of contents

- [Setup — get the app running](#setup)
- [Local development — fast edit loop without deploying](#local-development)
- [Using the app](#using-the-app)
- [Something went wrong — how to fix it](#something-went-wrong)

> **Prefer a guided walkthrough?** Open the **[Setup Wizard](https://settracker-theta.vercel.app/setup.html)** — a step-by-step page that covers everything below, with copy buttons and direct links to each dashboard.

---

## Setup

### What you'll need

- A computer (Windows or Mac)
- A phone
- An email address
- All free — no costs involved
- About 20–30 minutes

---

### Step 1 — Install Node.js (one time only)

Node.js lets you run the project on your computer.

1. Go to **nodejs.org**
2. Click the big **LTS** download button
3. Run the installer → keep clicking Next → Finish
4. Open **Terminal** (Mac) or **PowerShell** (Windows: press Start, type "PowerShell", press Enter)
5. Confirm it worked:

   ```sh
   node -v
   ```

   You should see something like `v20.x.x`. If you do, move on.

---

### Step 2 — Fork and download the project

1. Go to **github.com** and create a free account if you don't have one
2. Go to [github.com/HoltropAF/concert_tracker](https://github.com/HoltropAF/concert_tracker)
3. Click **Fork** (top right) → click **Create fork** — this makes a copy under your own account
4. On your fork, click the green **Code** button → **Download ZIP**
5. Unzip it somewhere easy to find (e.g. your Desktop)
6. In PowerShell/Terminal, navigate into the folder:

   ```sh
   cd C:\Users\YOUR_NAME\Desktop\concert_tracker-main
   ```

   Replace `YOUR_NAME` with your actual Windows username. On Mac: `cd ~/Desktop/concert_tracker-main`

7. Install dependencies (this downloads everything the app needs):

   ```sh
   npm install
   ```

   Wait about a minute. A lot of text will scroll by — that's normal.

---

### Step 3 — Set up Supabase (your database)

Supabase stores all your concert data in the cloud so it syncs across devices. It's free.

1. Go to **supabase.com** → create a free account
2. Click **New project** → give it a name (e.g. `settracker`) → set any password → click **Create project**
3. Wait about 2 minutes for it to finish
4. In the left sidebar, click **SQL Editor**
5. Open the file `supabase-schema.sql` from your project folder in Notepad/TextEdit
6. Copy all the text → paste it into the SQL Editor → click **Run**. You should see "Success. No rows returned"
7. In the left sidebar go to **Project Settings → API**
8. Copy these two things (paste them into Notepad so you don't lose them):

   - **Project URL** — looks like `https://xxxxxxxx.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`

---

### Step 4 — Create your .env file

This file tells the app where your database is. It lives only on your computer and is never shared.

1. In your project folder, find `.env.example`
2. Make a copy of it and rename the copy to `.env` (delete the `.example` part)
3. Open `.env` in Notepad
4. Replace the placeholder text with your real values from Step 3:

   ```env
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your key here...
   ```

5. Save and close

---

### Step 5 — Push your code to GitHub

Vercel (the next step) needs your code to be on GitHub to deploy it.

1. Run these one by one in PowerShell/Terminal:

   ```sh
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/concert_tracker.git
   git push -u origin main
   ```

   Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

2. If it asks for a password, you need a **Personal Access Token** (GitHub no longer accepts plain passwords):

   - Go to GitHub → your profile picture → **Settings** → scroll to the very bottom → **Developer settings**
   - **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
   - Give it any name, check the **repo** checkbox → **Generate token** → copy the token
   - Paste it when PowerShell asks for a password

---

### Step 6 — Deploy to Vercel

Vercel puts your app online for free so you can use it anywhere.

1. Go to **vercel.com** → sign up with your GitHub account
2. Click **Add New Project** → select your `concert_tracker` repo
3. Before clicking Deploy, scroll down to **Environment Variables** and add both:

   - Key: `VITE_SUPABASE_URL` — Value: your `https://xxxxxxxx.supabase.co`
   - Key: `VITE_SUPABASE_ANON_KEY` — Value: your `eyJ...` key

4. Click **Deploy** → wait about 60 seconds
5. You'll get a URL like `concert-tracker-xyz.vercel.app` — that's your app!

---

### Step 7 — Finish Supabase auth setup

1. Go back to **supabase.com** → your project → **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL (e.g. `https://concert-tracker-xyz.vercel.app`)
3. Under **Redirect URLs**, add:

   ```text
   https://concert-tracker-xyz.vercel.app/**
   ```

4. Click **Save**

---

### Step 8 — Sign in

1. Open your Vercel URL in a browser
2. Enter your email → click **Send magic link**
3. Check your inbox (and spam!) for an email from Supabase
4. Click the link in the email → you're in

> Magic links are limited to **twice per hour** on Supabase's free plan. If you see a rate limit error, wait an hour.

---

### Step 9 — Install on your phone

**Android (Chrome):**

1. Open your Vercel URL in Chrome
2. Tap the ⋮ menu → **Add to Home screen** → **Add**

**iPhone (Safari):**

1. Open your Vercel URL in Safari
2. Tap the share button (box with upward arrow)
3. Tap **Add to Home Screen** → **Add**

The app opens fullscreen like a regular app — no browser bar.

---

### Step 10 — Set up push notifications (optional)

Get a native push notification on your phone when a ticket sale starts — even when the app is fully closed. This uses **ntfy**, a free open-source notification service.

**Cost:**

- Android: completely free
- iPhone: free app + **€1.99 one-time in-app purchase** to unlock push delivery (without it, notifications only work when the app is open)

**Step-by-step:**

1. Install the **ntfy** app on your phone
   - Android: [Play Store → ntfy](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
   - iPhone: [App Store → ntfy](https://apps.apple.com/app/ntfy/id1625396347) — buy the push delivery unlock inside the app

2. Open ntfy → tap **+** → **Subscribe to topic**
   - Enter a unique topic name, e.g. `settracker-yourname-2024`
   - **Make it hard to guess** — anyone who knows your topic can send you messages
   - Tap **Subscribe**

3. In settracker → **Settings → Push notifications**
   - Toggle **Enable notifications** on
   - Enter the same topic name
   - Tap **Test** — you should get a test notification on your phone within seconds

4. Add these environment variables in Vercel → your project → **Settings → Environment Variables**:
   - `CRON_SECRET` — any random string you make up (e.g. generate one at [randomkeygen.com](https://randomkeygen.com)). This protects the cron endpoint.
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Project Settings → API → **service_role** key (keep this secret!)

   After adding them, redeploy from Vercel → Deployments → Redeploy.

5. The cron job runs every 15 minutes automatically. It checks for upcoming ticket sales and sends:
   - A notification **30 minutes before** the sale starts
   - A notification **at the exact sale time**

> **Note:** If you skip Step 4 (the environment variables), the in-app test button still works, but background notifications won't fire when the app is closed.

---

### Step 11 — Personalise it

This is a fork of someone else's project, so a few details still point to the original creator. Find and replace these:

**Social links** (shown on the login screen and bottom of Settings):

- Open `src/components/AuthScreen.jsx` — find the section marked `social links` and replace the URLs
- Open `src/components/ConcertTracker.jsx` — find the section marked `follow me on` and replace the URLs

After editing, push your changes so Vercel picks them up:

```sh
git add .
git commit -m "update social links"
git push
```

Vercel redeploys automatically within about a minute.

---

### Using it on multiple devices

Open the same Vercel URL on any device and sign in with the same email. Everything syncs automatically through Supabase.

---

### Keeping your database alive

Supabase **pauses free projects after 7 days of no activity**. Your data is never lost — it just goes to sleep.

If the app shows a "database is napping" screen:

1. Go to **supabase.com** → your project → click **Restore project**
2. Wait 30 seconds → tap **try again** in the app

To prevent this, set up a free automated ping at **cron-job.org** to visit your Supabase URL every 5 days.

---

### Backing up your data

In the app: **Settings → Data → Export** — downloads a file with all your concerts.

Keep it somewhere safe (Google Drive, iCloud). Export regularly — especially before trying anything new.

To restore: **Settings → Data → Restore from backup** → select your file.

---

---

## Local development

The default workflow for making changes is: edit → commit → push → wait ~60 seconds for Vercel → check the live site. For anything more than a one-liner, that loop is too slow. This section documents a faster local workflow using a `dev` branch and Vite's built-in dev server, so you can see changes instantly before anything touches main or production.

### 1. Create a dev branch

Branch off main so all work stays isolated until it's ready:

```sh
git checkout -b dev
```

### 2. Start the local dev server

```sh
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173/`. Open it in the browser. This instance reads from your existing `.env`, so it's connected to the real Supabase project — auth, concert data, and setlist imports all work exactly as in production.

### 3. Edit and hot-reload

Edit any component — for example `src/components/ConcertTracker.jsx` or `src/components/AuthScreen.jsx` — and save. Vite hot-reloads the browser in well under a second, no deploy, no waiting on Vercel.

### 4. Commit on dev as you go

```sh
git add .
git commit -m "tweak stats chart layout"
```

### 5. Optional: push dev for a Vercel preview

Since the repo is linked to Vercel, pushing a non-main branch triggers a separate preview URL — separate from the production URL — which is useful for testing on a phone or sharing a work-in-progress without touching production:

```sh
git push -u origin dev
```

### 6. Merge into main to redeploy production

When the work is ready, merge into main — this is the step that actually redeploys the live site:

```sh
git checkout main
git merge dev
git push
```

---

### A note on the shared database

`npm run dev` points at the same Supabase database as production, because it uses the same `.env`. That's fine for UI and layout work, but riskier for anything touching real data or schema changes. If a true sandbox is needed, spin up a second free Supabase project, run the schema SQL in it, and point a separate `.env.dev` at it.

---

---

## Using the app

### The five tabs

At the bottom of the screen you'll find five buttons: **Shows, Artists, Songs, Venues, Friends**. Stats live behind a small icon at the top-left of the header, and Settings behind the **⋯** icon at the top-right — reachable from any tab.

| Tab | What it does |
| --- | ------------ |
| **Shows** | Your list of concerts and festivals — past, upcoming, and want-to-go together |
| **Artists** | Everyone you've seen live, plus artists you want to see |
| **Songs** | Every song heard live, ranked by times heard |
| **Venues** | Every place you've been, with a map, plus venues you want to visit |
| **Friends** | Who you've gone with |

---

### Adding a show

Tap **+** (top right of the Shows list). It asks three quick questions:

1. **What are you logging?** — Offline show / Online show / Festival
2. **When is it?** — Already happened / Coming up
3. *(if coming up)* **Got a ticket?** — Yes opens the full form; No saves it as **Want to go**

Want-to-go entries skip rating, setlist, and ticket fields since none of that exists yet — you can mark tickets as bought later, which brings the rest of the form back.

**In the full form, fill in:**

- **Artist** — the headliner's name. Start typing and suggestions appear from your existing concerts.
- **Date** — when it was (or will be)
- **Venue** — the venue name
- **City + Country** — where it was
- **Tour** *(optional)* — the tour name
- **Support acts** *(optional)* — tap the field and type a name, press Enter to add. You can give each act a role: Support, Guest, or Headliner.
- **Genre / Subgenre** *(optional)* — helps with stats and filtering
- **Language** *(optional)* — what language the artist performed in
- **Venue size** *(optional)* — Club / Small hall / Mid-venue / Arena / Stadium
- **Rating** — tap a star to rate the night (once it's happened)
- **Tickets** — add one or more priced line items (e.g. base ticket + a fan-club add-on) — they're summed automatically
- **Friends** — who you went with. Tap a name to add, or type a new one.
- **Solo** — toggle on if you went alone
- **Notes** — anything you want to remember
- **Merch** — tap **+ merch item** to log what you bought and what you paid

Tap **Save** when done.

---

### Adding a festival

Pick **Festival** in step 1 of the add flow. A festival works differently from a concert:

- **Festival name** — goes in the Artist field (e.g. "Lowlands 2024")
- **Start date + End date** — for multi-day festivals
- **Venue / Grounds** — the festival site name
- **Acts** — this is the important part. Tap **+ artist** or paste a setlist.fm festival URL to import the lineup automatically. Each act has:
  - A **name**
  - A **day** (if it's a multi-day festival)
  - A **♥ highlight** — mark your favourites

The acts you add here are what appear in your **Artists** stats. A festival called "Lowlands 2024" won't show up as an artist — only the individual acts do.

> **Tip:** If you saw an artist at a festival AND at their own concert, add them in both places. The app combines all their appearances automatically into one artist page.

---

### Viewing and editing a concert

Tap any concert card to open it. You'll see all the details you entered, plus any setlist.

To make changes, tap **Edit** (top right). Change whatever you need, then tap **Save**.

To delete, open a concert → tap **Edit** → scroll to the bottom → **Delete**.

---

### Importing a setlist

Inside a concert (view or edit mode), find the **Setlist** section.


**Option 1 — From setlist.fm:**

1. Find the show on setlist.fm in your browser
2. Copy the URL from the address bar
3. Paste it into the setlist field in the app → the songs load automatically

You can also go to **Settings → Setlist.fm API key** and add a free API key from setlist.fm for more reliable imports.

**Option 2 — Manually:**

Type song names one by one. Press Enter after each one.

---

### The Shows list

The main Shows tab lists all your concerts and festivals. A few things to know:

- **Upcoming** shows appear at the top, separated from past shows
- Tap **Past** to expand/collapse the list
- Use the **search bar** to find a show by artist, venue, city, friend name, or tour name
- The **All / Shows / Festivals** dropdown filters by type
- The **Year** dropdown filters by year
- **Sort** lets you sort by newest, oldest, A→Z, price, or rating
- **Filters** opens a panel where you can filter by friend, venue, rating, genre, subgenre, country, or solo shows
- The **☰ / ▤** button in the top right toggles compact view (smaller cards, more shows visible)

---

### The Artists tab

Tap **Shows** in the bottom nav — then tap **Artists** in the sub-nav below the header.

This lists every artist you've seen, with a count of how many times. It combines:

- Shows where they were the headliner
- Times they appeared as a support or guest act
- Times they were listed as a festival act

Tap an artist to see their full page: when you first saw them, average rating, every show they appeared in.

Use the **Sort** button to sort by most seen, A–Z, recently seen, or rating.
Use the **Filters** button to filter by genre, minimum times seen, or upcoming only.

---

### The Stats tab

Tap **Stats** in the bottom nav to see charts. Use the row of tabs above the bottom nav to switch between chart groups:

| Group | What it shows |
| ----- | ------------- |
| **Artists** | Top artists by times seen, with role breakdown |
| **Shows** | Shows over time (bar chart or heatmap), cumulative |
| **Venues** | Top venues and countries |
| **Financial** | Spending over time, most expensive shows, merch breakdown |
| **Genres** | Genre and subgenre breakdown |
| **Songs** | Most-heard songs across all your setlists |

You can hide chart groups you don't use in **Settings → Stats**.

---

### The Summary tab

Tap **Summary** (the ▤ icon) for a quick overview: total shows, countries, top artists, spending, and more — all on one scrollable page.

Tap most of the blocks to jump straight to the related chart.

---

### The Friends tab

Tap **Friends** (inside Stats) to see everyone you've been to shows with, how many times, and what you've seen together.

Tap a friend's name to see their full profile: shows together, top artists you share, first and last show.

---

### Settings

Tap the **⚙** button (top right of the main screen) or the **Settings** tab in the bottom nav.

Things you can configure:

- **Default country** — pre-fills the country field when adding a concert
- **Color theme** — changes the app's accent color
- **Rating system** — 5 or 10 stars
- **Genres / Subgenres** — the options shown when adding a concert
- **Venue sizes** — the options shown in the venue size field
- **Languages** — the options shown in the language field
- **Merch categories** — the options shown when logging merch
- **Saved venues** — save frequently visited venues for one-tap fill-in when adding concerts
- **Friend groups** — group friends together (e.g. "Work friends") for easier filtering
- **Stats** — show or hide individual chart blocks
- **Top N rows** — how many rows to show in top-artists, top-venues, etc.
- **Data** — export your data, import from a backup, import from CSV
- **Setlist.fm API key** — for more reliable setlist imports

---

### Exporting and importing data

**Export:** Settings → Data → Export — saves a JSON file with all your concerts. Keep a backup somewhere safe.

**Import from backup:** Settings → Data → Restore from backup — select a JSON file you exported before.

**Import from CSV/XLSX:** Settings → Data → Import from file — for spreadsheet imports. Download the template first so the column names match.

---

---

## Something went wrong

### How to find errors in the browser

If something isn't working, the browser's developer tools can tell you what went wrong.

**On desktop:**

1. Open the app in Chrome or Firefox
2. Press **F12** (Windows) or **Cmd + Option + I** (Mac)
3. Click the **Console** tab
4. Red text = an error. Copy the message and search for it online, or share it when asking for help.

**What to look for:**

- A red message starting with `TypeError` or `ReferenceError` — usually means something in the code broke
- A message containing `403` or `401` — usually a Supabase permission issue
- A message containing `Failed to fetch` — usually a wrong URL in your .env file

---

### Common mistakes and how to fix them

#### A concert I added isn't showing up

The most common reason: the date is in the future, so it's in the Upcoming section at the top — not in Past. Scroll up or check the upcoming section.

If the date is correct and it's still missing, check that you tapped **Save** before leaving the form.

---

#### An artist shows up twice in the Artists tab

This almost always means the name was typed slightly differently in two places — like `The National` and `The National` with a trailing space, or `nick cave` vs `Nick Cave`.

To fix it:

1. Find both entries in the Artists tab
2. Tap each one to see which concerts are linked
3. Open the concerts with the wrong version → tap **Edit** → fix the name → **Save**

The app ignores trailing spaces automatically, but extra spaces in the middle or capitalisation differences will still create duplicates.

---

#### A festival act isn't appearing in the Artists tab

Check that you added them as an **Act** inside the festival entry — not just mentioned them in the Notes field.

Open the festival → tap **Edit** → look for the Acts section → make sure the artist is listed there.

---

#### The app shows a "database is napping" screen

Your Supabase project paused from inactivity. Go to **supabase.com** → your project → click **Restore project**. Takes 30 seconds.

---

#### Magic link email never arrived

1. Check your spam folder
2. Make sure you typed your email correctly
3. Supabase limits magic links to twice per hour — wait an hour if you've tried recently

---

#### "Failed to fetch" error on login

Your Supabase URL or key is wrong. Go to Vercel → your project → **Settings → Environment Variables** and check:

- The URL ends in `.co` not `.com`
- You pasted the **anon public** key, not the secret key
- There are no spaces before or after the values

After fixing, go to **Deployments** → click the three dots on the latest deployment → **Redeploy**.

---

#### I pushed a change and the app looks broken

Wait about 60 seconds for Vercel to redeploy. If it's still broken after that, go to Vercel → your project → **Deployments** → find the last working deployment → click the three dots → **Promote to Production**.

To find what went wrong: open the app → press F12 → Console tab → look for red errors.

---

#### I edited the code and now it crashes on startup

1. Press F12 → Console — read the red error message
2. It will usually say something like `SyntaxError` with a file name and line number
3. Open that file in a text editor and look at that line — a missing comma, bracket, or quote mark is the usual culprit
4. Fix it → save → push again

If you can't figure it out, undo your last change:

```sh
git restore src/components/ConcertTracker.jsx
```

Replace the filename with whichever file you edited. This puts it back to how it was before.

---

#### Something else is wrong

1. Press F12 → Console → copy the red error message
2. Search for it on Google — most errors have been seen before
3. Or open an issue at [github.com/HoltropAF/concert_tracker/issues](https://github.com/HoltropAF/concert_tracker/issues) with the error message and what you were doing when it happened
