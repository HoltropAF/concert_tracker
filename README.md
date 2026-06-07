# settracker — setup guide

Track every concert you've ever been to. Rate nights, see stats, remember who you went with.

Built by [@annuhfloor](https://www.threads.com/@annuhfloor) — fork it and make it yours.

> **Just want to try it?** Visit the live app and tap **"or explore it first"** — no account needed, 10 sample concerts preloaded.

---

## What you'll need

- A computer (Windows or Mac)
- A phone
- An email address
- All free — no costs involved
- About 20–30 minutes

---

## Step 1 — Install Node.js (one time only)

Node.js lets you run the project on your computer.

1. Go to **nodejs.org**
2. Click the big **LTS** download button
3. Run the installer → keep clicking Next → Finish
4. Open **Terminal** (Mac) or **PowerShell** (Windows: press Start, type "PowerShell", press Enter)
5. Confirm it worked:

   ```sh
   node -v
   ```

   You should see a version number like `v20.x.x`

---

## Step 2 — Fork and download the project

1. Go to **github.com** and create a free account if you don't have one
2. Go to [github.com/HoltropAF/concert_tracker](https://github.com/HoltropAF/concert_tracker)
3. Click **Fork** (top right) → click **Create fork** — this makes your own copy under your account
4. On your fork, click the green **Code** button → **Download ZIP**
5. Unzip it somewhere on your computer (e.g. your Desktop)
6. In PowerShell/Terminal, navigate to the folder:

   ```sh
   cd C:\Users\YOUR_NAME\Desktop\concert_tracker-main
   ```

   Replace `YOUR_NAME` with your actual username. On Mac use `~/Desktop/concert_tracker-main`

7. Install dependencies:

   ```sh
   npm install
   ```

   Wait about a minute for it to finish.

---

## Step 3 — Set up Supabase (your database)

Supabase is where all your concert data lives in the cloud. It's free.

1. Go to **supabase.com** → create a free account
2. Click **New project** → give it a name (e.g. `settracker`) → set any password → click **Create project**
3. Wait about 2 minutes for it to finish setting up
4. In the left sidebar, click **SQL Editor**
5. Open the file `supabase-schema.sql` from your project folder in Notepad/TextEdit
6. Copy all the text → paste it into the SQL Editor → click **Run**
   You should see "Success. No rows returned"
7. In the left sidebar go to **Project Settings → API**
8. Copy and save these two things (paste them into Notepad):

   - **Project URL** — looks like `https://xxxxxxxx.supabase.co`
   - **anon public** key — long string starting with `eyJ...`

---

## Step 4 — Create your .env file

This file tells the app where your database is. It stays on your computer only — never shared.

1. In your project folder, find `.env.example`
2. Make a copy of it and rename the copy to `.env` (remove `.example`)
3. Open `.env` in Notepad/TextEdit
4. Replace the placeholders with your real values from Step 3:

   ```sh
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your key here...
   ```

5. Save and close

---

## Step 5 — Push your code to GitHub

Vercel (next step) needs your code to be on GitHub to deploy it.

1. In your project folder, run these one by one:

   ```sh
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/concert_tracker.git
   git push -u origin main
   ```

   Replace `YOUR_GITHUB_USERNAME` with your GitHub username.

2. When asked for a password, you need a **Personal Access Token** (GitHub no longer accepts plain passwords):

   - Go to GitHub → your profile → **Settings** → scroll to bottom → **Developer settings**
   - **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
   - Give it any name, check the **repo** box → click **Generate token** → copy it
   - Paste the token when PowerShell asks for your password

---

## Step 6 — Deploy to Vercel

Vercel puts your app online for free.

1. Go to **vercel.com** → sign up with your GitHub account
2. Click **Add New Project** → select your `concert_tracker` repo
3. Before clicking Deploy, scroll down to **Environment Variables** and add both:

   - Key: `VITE_SUPABASE_URL` — Value: your `https://xxxxxxxx.supabase.co` URL
   - Key: `VITE_SUPABASE_ANON_KEY` — Value: your long `eyJ...` key

4. Click **Deploy** → wait about 60 seconds
5. You'll get a URL like `concert-tracker-xyz.vercel.app` — this is your app!

---

## Step 7 — Finish Supabase auth setup

1. Go back to **supabase.com** → your project → **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL (e.g. `https://concert-tracker-xyz.vercel.app`)
3. Under **Redirect URLs**, add:

   ```sh
   https://concert-tracker-xyz.vercel.app/**
   ```

4. Click **Save**

---

## Step 8 — Sign in

1. Open your Vercel URL in your browser
2. Enter your email → click **send magic link**
3. Check your inbox (and spam!) for an email from Supabase
4. Click the link in the email → you're in!

> Note: magic links are limited to **twice per hour** on the free plan. If you get a rate limit error, wait an hour and try again.

---

## Step 9 — Install on your phone

**Android (Chrome):**

1. Open your Vercel URL in Chrome
2. Tap the ⋮ menu → **Add to Home screen** → **Add**

**iPhone (Safari):**

1. Open your Vercel URL in Safari
2. Tap the Share button (box with arrow pointing up)
3. Tap **Add to Home Screen** → **Add**

The app now opens fullscreen like a native app — no browser bar.

---

## Step 10 — Personalise it

Since this is a fork, a few things have the original creator's personal details. Update these to your own:

**Social links** — shown on the login screen and at the bottom of Settings.
Open these two files and find the social links sections, then replace the 5 `href` URLs with your own profiles:

- `src/components/AuthScreen.jsx` — look for the comment `social links`
- `src/components/ConcertTracker.jsx` — look for the comment `follow me on`

After editing, push your changes:

```sh
git add .
git commit -m "personalise social links"
git push
```

Vercel will automatically redeploy within a minute.

---

## Using it on multiple devices

Open the same Vercel URL on any device and sign in with the same email. Everything syncs automatically.

---

## Keeping your database alive

Supabase **pauses free projects after 7 days of no activity**. Your data is never lost — it just sleeps.

If the app shows a "database is napping" screen:

1. Go to **supabase.com** → your project → click **Restore project**
2. Wait 30 seconds
3. Tap **try again** in the app

To avoid this altogether, set up a free ping at **cron-job.org** to hit your Supabase URL every 5 days.

---

## Backing up your data

In the app: **Settings → Data → Export** — downloads a JSON file with all your concerts.
Keep this somewhere safe (Google Drive, iCloud, etc.) and export regularly.

To restore: **Settings → Data → Restore from backup** → select your JSON file.

---

## Troubleshooting

**"Failed to fetch" on login** — Your Supabase URL must end in `.co` not `.com`. Check Vercel's environment variables and redeploy.

**Magic link doesn't work** — Make sure your Vercel URL is added to Supabase → Authentication → URL Configuration → both Site URL and Redirect URLs.

**App looks wrong after an update** — Vercel → your project → Deployments → Redeploy latest.

**Supabase "project paused"** — Go to supabase.com → your project → Restore project. Takes 30 seconds.
