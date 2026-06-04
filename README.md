# settracker — setup guide

A step-by-step guide to get settracker running on your phone and PC.
No technical experience needed. Takes about 20–30 minutes.

---

## What you'll need
- A computer (Windows or Mac)
- A phone
- An email address
- All free accounts — no costs involved

---

## Step 1 — Install Node.js (one time)

Node.js is a tool that lets you run the app on your computer.

1. Go to **nodejs.org**
2. Click the big green **LTS** download button
3. Run the installer → keep clicking Next → Finish
4. Open **PowerShell** (Windows: press Start, type "PowerShell", press Enter)

---

## Step 2 — Get the project files

1. Download the `settracker.zip` file
2. Unzip it — right click → Extract All → choose a location like your Desktop
3. In PowerShell, navigate to the folder:
   ```
   cd C:\Users\YOUR_NAME\Desktop\settracker
   ```
   (replace YOUR_NAME with your Windows username)
4. Run:
   ```
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```
   Type `Y` and press Enter when asked.
5. Run:
   ```
   npm install
   ```
   Wait for it to finish (takes about a minute).

---

## Step 3 — Set up Supabase (your database)

Supabase stores all your concert data in the cloud.

1. Go to **supabase.com** → create a free account
2. Click **New project** → give it a name (e.g. "settracker") → set a password → click Create
3. Wait about 2 minutes for it to set up
4. In the left sidebar, click **SQL Editor**
5. Open the file `supabase-schema.sql` from your settracker folder in Notepad
6. Copy all the text → paste it into the SQL Editor → click **Run**
   You should see "Success. No rows returned"
7. In the left sidebar, go to **Settings → API**
8. Copy two things and save them somewhere (like Notepad):
   - **Project URL** — looks like `https://xxxxxxxx.supabase.co` (ends in .co not .com!)
   - **anon public** key — long string starting with `eyJ...`
9. In the left sidebar, go to **Authentication → URL Configuration**
10. Set **Site URL** to your Vercel URL (you'll fill this in after Step 5)

---

## Step 4 — Create your .env file

This file tells the app where your database is.

1. In your settracker folder, find the file `.env.example`
2. Make a copy of it and rename the copy to just `.env` (no .example)
3. Open `.env` in Notepad
4. Replace the placeholder text with your real values:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your key here...
   ```
5. Save and close

---

## Step 5 — Put it on GitHub

GitHub stores your code so Vercel can deploy it.

1. Go to **github.com** → create a free account
2. Click **+** (top right) → **New repository**
3. Name it `settracker` → click **Create repository**
4. Go to your profile → **Settings** → scroll to bottom → **Developer settings**
   → **Personal access tokens** → **Tokens (classic)** → **Generate new token**
   → give it any name → check the **repo** box → click Generate → copy the token
5. Back in PowerShell (in your settracker folder), run these one by one:
   ```
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/settracker.git
   git push -u origin main
   ```
   When asked for username → your GitHub username
   When asked for password → paste the token you copied

---

## Step 6 — Deploy to Vercel

Vercel puts your app online so you can open it on any device.

1. Go to **vercel.com** → sign up with your GitHub account
2. Click **Add New Project** → select your `settracker` repo
3. Before clicking Deploy, scroll down to **Environment Variables** and add:
   - Key: `VITE_SUPABASE_URL` → Value: your Supabase URL (ending in .co!)
   - Click **+ Add More**
   - Key: `VITE_SUPABASE_ANON_KEY` → Value: your long `eyJ...` key
4. Click **Deploy** → wait about 60 seconds
5. You'll get a URL like `settracker-xyz.vercel.app` — this is your app!

---

## Step 7 — Finish Supabase setup

1. Go back to Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL (e.g. `https://settracker-xyz.vercel.app`)
3. Under **Redirect URLs**, add `https://settracker-xyz.vercel.app/**`
4. Save

---

## Step 8 — Sign in

1. Open your Vercel URL in your browser
2. Enter your email → click **Send magic link**
3. Check your email (check spam too!) for an email from Supabase
4. Click the link in the email → you're signed in!
5. Your concerts will load automatically on first sign-in

> ⚠️ Note: Supabase limits magic link emails to a few per hour on the free plan.
> If you see "email rate limit exceeded", just wait an hour and try again.

---

## Step 9 — Install on your phone

**Android (Chrome):**
1. Open your Vercel URL in Chrome
2. Tap the three dots ⋮ menu
3. Tap **Add to Home screen**
4. Tap **Add**

**iPhone (Safari):**
1. Open your Vercel URL in Safari
2. Tap the Share button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

The app now works like a native app — no browser bar, opens fullscreen!

---

## Using the app on multiple devices

Just open the same Vercel URL on any device and sign in with the same email.
All your data syncs automatically — edit on your phone, see it on your PC instantly.

---

## Adding your own concert data

The app starts with empty data (no pre-loaded concerts).
To add concerts, use the app's interface — tap any show to edit it,
or go to Settings → Restore to import a JSON backup.

If you want to pre-load concerts, edit `src/lib/data.js` on your computer,
update the `SEED_DATA` array, then push to GitHub:
```
git add .
git commit -m "update concerts"
git push
```
Vercel will automatically redeploy with the new data.

---

## Troubleshooting

**"Failed to fetch"** → Check your Supabase URL ends in `.co` not `.com` in Vercel's environment variables. Redeploy after fixing.

**"Email rate limit exceeded"** → Wait 1 hour, then try again.

**Magic link doesn't work** → Make sure you added your Vercel URL to Supabase → Authentication → URL Configuration.

**App looks broken after update** → Go to Vercel → Deployments → Redeploy.

**Lost your data** → Use Settings → Export in the app regularly to keep a backup.
