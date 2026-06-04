# settracker

Your personal concert tracker — PWA with cloud sync across phone and PC.

## Stack
- React + Vite
- Supabase (database + auth)
- Vercel (hosting)
- vite-plugin-pwa (installable on homescreen)

---

## Setup (one time, ~20 minutes)

### 1. Supabase

1. Go to [supabase.com](https://supabase.com) → create a free account
2. New project → choose a name and password → wait ~2 min for it to spin up
3. Go to **SQL Editor** → paste the contents of `supabase-schema.sql` → Run
4. Go to **Settings → API** → copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### 2. Local setup

```bash
# Clone or unzip this project
cd settracker

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

```bash
# Run locally
npm run dev
```

Open http://localhost:5173 → sign in with your email → magic link arrives → click it → your data loads automatically.

### 3. Deploy to Vercel

1. Push this folder to a GitHub repo (public or private)
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variables:
   - `VITE_SUPABASE_URL` → your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key
4. Deploy → get your URL (e.g. `settracker.vercel.app`)

### 4. Install as app on phone

- **Android (Chrome):** open your Vercel URL → three dots menu → "Add to Home Screen"
- **iPhone (Safari):** open your Vercel URL → share button → "Add to Home Screen"

### 5. Sync between devices

Just open the same URL on any device and sign in with the same email. Data syncs automatically — any show you edit on your phone is immediately visible on PC.

---

## Adding new shows

Edit `src/lib/data.js` → add to `SEED_DATA` array → the next time you sign in on a new device it'll pick them up. For your existing account, go to Settings → add the show manually, or paste updated JSON via the restore tool.

## Development

```bash
npm run dev      # local dev server
npm run build    # production build
npm run preview  # preview production build
```
