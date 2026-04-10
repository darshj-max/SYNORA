# SYNORA Backend

Secure backend for the SYNORA academic OS. Handles:
- **Anthropic proxy** — API key lives server-side only
- **Cloud sync** — user data stored in Supabase Postgres
- **Google auth** — via Supabase OAuth
- **Rate limiting** — 50 AI calls / user / day + IP-level throttle

---

## Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Backend | Node.js + Express | Free |
| Database | Supabase (Postgres) | Free tier |
| Auth | Supabase (Google OAuth) | Free tier |
| Hosting | Railway | Free tier (~500h/month) |

---

## Setup Guide (30 minutes)

### Step 1 — Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Pick a name (e.g. `synora`), set a strong database password, choose a region close to your users
3. Wait ~2 minutes for provisioning
4. Go to **SQL Editor** → **New Query** → paste the entire contents of `schema.sql` → click **Run**
5. Go to **Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `anon` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY` (keep this secret!)

### Step 2 — Enable Google OAuth in Supabase

1. Go to **Authentication → Providers → Google**
2. Enable it
3. You need a Google OAuth client ID + secret from [console.cloud.google.com](https://console.cloud.google.com):
   - Create a project → APIs & Services → Credentials → Create OAuth 2.0 Client ID
   - Application type: **Web application**
   - Authorised redirect URIs: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Paste the Client ID and Secret back into Supabase → Save

### Step 3 — Deploy the backend to Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Push this `synora-backend` folder to a GitHub repo first:
   ```bash
   cd synora-backend
   git init
   git add .
   git commit -m "SYNORA backend v1"
   gh repo create synora-backend --public --push
   ```
3. In Railway: connect the repo → it auto-detects Node.js
4. Go to **Variables** and add these environment variables:
   ```
   ANTHROPIC_API_KEY    = sk-ant-...
   SUPABASE_URL         = https://xxxx.supabase.co
   SUPABASE_SERVICE_KEY = eyJ...
   SUPABASE_ANON_KEY    = eyJ...
   FRONTEND_ORIGIN      = https://yourusername.github.io
   PORT                 = 3001
   AI_DAILY_LIMIT       = 50
   ```
5. Railway will deploy automatically. Copy the public URL (e.g. `https://synora-backend-production.up.railway.app`)

### Step 4 — Update the frontend

In `study-buddy-v4.html`, find these two lines and fill them in:

```javascript
const BACKEND_URL = 'https://synora-backend-production.up.railway.app'; // ← your Railway URL

const SUPABASE_URL      = 'https://xxxx.supabase.co'; // ← your Supabase URL
const SUPABASE_ANON_KEY = 'eyJ...';                   // ← your anon key
```

### Step 5 — Deploy the frontend to GitHub Pages

1. Create a GitHub repo called `synora` (or `yourusername.github.io`)
2. Upload `study-buddy-v4.html` — rename it to `index.html`
3. Go to repo **Settings → Pages → Source: main branch** → Save
4. Your app is live at `https://yourusername.github.io/synora`

---

## API Reference

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | None | Server health check |
| GET | `/api/auth/me` | JWT | Get current user profile |
| GET | `/api/sync` | JWT | Fetch user's saved data |
| POST | `/api/sync` | JWT | Save user's data |
| POST | `/api/ai` | JWT | Anthropic proxy |
| GET | `/api/usage` | JWT | Today's AI call count |

---

## Local Development

```bash
# Clone and install
git clone https://github.com/you/synora-backend
cd synora-backend
npm install

# Set up environment
cp .env.example .env
# Fill in .env with your keys

# Start the server
npm run dev   # uses nodemon for auto-reload

# Server runs at http://localhost:3001
# Health check: http://localhost:3001/health
```

For the frontend during local dev:
- Open `study-buddy-v4.html` with Live Server (VS Code extension)
- Make sure `BACKEND_URL = 'http://localhost:3001'` in the frontend

---

## Security Notes

- The `SUPABASE_SERVICE_KEY` bypasses all Row Level Security. **Never expose it in the browser.**
- The `ANTHROPIC_API_KEY` never leaves the server.
- The `SUPABASE_ANON_KEY` is safe to include in frontend code — it is rate-limited and RLS-protected.
- All routes except `/health` require a valid Supabase JWT.
- Base64 image data from saved files is stripped before cloud storage to keep database size small.

---

## Monetisation Path

Once you have users, add a `is_pro` column to a `profiles` table in Supabase.
Gate features (higher AI limits, export formats, etc.) by checking `req.user.is_pro` in the backend.
Use Gumroad or Lemon Squeezy for payment → webhook sets `is_pro = true` in Supabase.
