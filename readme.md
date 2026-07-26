# Geo Narrator

An AI-powered voice tour guide that narrates points of interest as you explore them, and answers your questions out loud — built for OpenAI Codex Hackathon.

**Live demo:** https://geo-narrator.onrender.com

---

<img width="1786" height="865" alt="image" src="https://github.com/user-attachments/assets/ab7393d7-7a10-4723-b0c4-c5e69537a279" />
<img width="1121" height="791" alt="image" src="https://github.com/user-attachments/assets/ad7c6d69-290d-4628-a016-fb6ebca78018" />
<img width="1118" height="796" alt="image" src="https://github.com/user-attachments/assets/885ba516-5540-41c7-b2a3-66a80e21d8db" />




## What it does

- Sign in with Google to start your personal guided walk
- Get short, spoken-style narration for a point of interest, generated live by an AI model
- Ask follow-up questions by voice and get spoken answers back
- Choose a guide "voice" / persona (e.g. Warm Local Guide, Curious Historian, Playful Storyteller, Calm Educator)
- See an AI-generated atmospheric image for each location

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express |
| Auth | Google Identity Services (client-side) + Google token verification server-side (`google-auth-library`) + JWT sessions |
| AI narration & Q&A | Claude models via OpenRouter API |
| AI image generation | Pollinations.ai (free, no key required) |
| Voice |Elevan Labs API  for text-to-speech,speech-to-text) |
| Frontend | Plain HTML / CSS / JavaScript (no framework, no build step) |
| Hosting | Render (single Web Service serves both API and static frontend) |
| Database | PostgreSQL (hosted on Neon), accessed via Prisma ORM |
| Cache    | Redis (hosted on Upstash) — caches AI-generated narration + image URLs |

---
```
Geo-Narrator/
├── index.js                 # Express app entry point
├── prisma/
│   └── schema.prisma          # Database models (User, Poi, Visit)
├── prisma.config.ts           # Prisma 7 datasource config
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── favicon.ico
├── routes/
│   ├── auth.js                # POST /api/auth/google
│   └── narration.js           # POST /api/narration, /api/ask, /api/image, GET /api/journal
├── Services/
│   └── authentication/
│       └── auth.js            # Google token verification (verifyGoogleToken)
├── middleware/
│   └── authMiddleware.js      # JWT session verification
├── lib/
│   ├── claude.js               # callClaude() + generateImage()
│   ├── db.js                   # Prisma client + saveVisit() + getUserJournal()
│   └── cache.js                # Redis client + getCachedNarration() + setCachedNarration()
├── .env                        # local secrets (never committed)
├── .env.example                 # template for required env vars
└── package.json
```
---

## Environment variables

Create a `.env` file in the project root (see `.env.example`):

```dotenv
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
JWT_SECRET=a_long_random_string
ANTHROPIC_API_KEY=your_openrouter_key
ANTHROPIC_MODEL=anthropic/claude-sonnet-4.5
PORT=3000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

| Variable | Where to get it | Required |
|---|---|---|
| `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth Client | Yes |
| `JWT_SECRET` | Generate locally: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | Yes |
| `ANTHROPIC_API_KEY` | [OpenRouter](https://openrouter.ai) → API Keys (this project calls Claude models through OpenRouter, not Anthropic directly) | Yes |
| `ANTHROPIC_MODEL` | Any Claude model slug available on OpenRouter, e.g. `anthropic/claude-sonnet-4.5` | Optional — has a default |
| `PORT` | Any free local port | Optional — defaults to 3000 |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | Yes |
| `DATABASE_URL`      | [Neon](https://neon.com) → your project → Connection string                                                                   | Yes |
| `REDIS_URL`         | [Upstash](https://upstash.com) → your database → Connect → Redis URL (`rediss://..`)                                        | Yes |
| `CACHE_TTL_SECONDS` | How long cached narration/image data lives in Redis, in seconds                                                               | Optional — defaults to 604800 (7 days) |

---

## Running locally

```bash
git clone https://github.com/Srushtik942/Geo-Narator.git
cd Geo-Narrator
npm install
cp .env.example .env   # then fill in real values
node index.js
```

Open **http://localhost:3000** — the same Express server serves both the API and the frontend.

---

## Google Sign-In setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID → Web application
3. Add to **Authorised JavaScript origins**:
   - `http://localhost:3000` (local dev)
   - `https://geo-narrator.onrender.com` (production)
4. Add the same two URLs to **Authorised redirect URIs**
5. Under **Audience**, set publishing status to allow external users (any Google account)
6. Copy the Client ID into `GOOGLE_CLIENT_ID` in your `.env`

---

## API endpoints

All routes below (except `/api/auth/google`) require a valid session token, sent as:
```
Authorization: Bearer <token>
```

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/google` | Verifies a Google credential, creates/finds the user, returns a session JWT |
| `POST` | `/api/narration` | Generates spoken-style narration for a point of interest |
| `POST` | `/api/ask` | Answers a visitor's spoken question about a point of interest |
| `POST` | `/api/image` | Generates an atmospheric image for a point of interest |

### Example: `POST /api/narration`
Request body:
```json
{
  "poiName": "India Gate",
  "persona": "Curious Historian"
}
```
Response:
```json
{
  "narration": "India Gate stands as a solemn tribute...",
  "imageUrl": "https://image.pollinations.ai/prompt/..."
}
```

---

## Deployment (Render)

This app deploys as a **single Render Web Service** — no separate frontend hosting needed, since Express serves the static frontend files directly.

1. Push this repo to GitHub
2. Render → New → Web Service → connect the repo
3. Settings:
   - **Root Directory:** blank (repo root)
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
4. Add all environment variables from the table above in Render's **Environment** tab — make sure `CORS_ORIGINS` includes your live Render URL
5. Deploy, then add the live Render URL to Google Cloud Console's Authorised origins (see above)

---




## Known limitations / hackathon scope notes

- Location detection (Geolocation + Haversine proximity trigger) is designed but the demo primarily uses manual POI selection for reliability during live demos, since GPS is inconsistent indoors/on stage
- `SpeechRecognition` (voice input) works best on Chrome and Safari iOS 14.5+; browser support varies
- Image generation via Pollinations.ai has no guaranteed uptime SLA — it's free and has no key, which is why it was chosen for the hackathon build over paid alternatives
- Persistence is now wired in (PostgreSQL via Neon), but the `/api/journal` endpoint has no frontend UI yet — visit history is recorded but not currently viewable in the app
- The Redis cache is keyed by point-of-interest name only, not persona — so narration text may reflect a different persona's voice than the one currently selected, if that POI was cached by an earlier request

---

## Persistence & Caching

Geo Narrator uses two data stores in production:

**PostgreSQL (via Neon + Prisma)** — permanent storage for:
- `User` — created on Google sign-in, keyed by Google `sub`
- `Poi` — one row per unique point of interest ever narrated
- `Visit` — one row per narration request, linking a user to a POI with the persona used and the narration text/image generated

**Redis (via Upstash)** — a short-lived cache that sits in front of the AI calls. Before generating a new narration, the app checks Redis for an existing entry keyed by `poiName`. On a cache hit, it returns the cached narration + image URL instantly, skipping the Claude and Pollinations calls entirely, and still records a `Visit` for that user. Cache entries expire after `CACHE_TTL_SECONDS` (7 days by default).

**Note:** the cache key is POI-only, not persona-specific — so the first persona to narrate a given place "wins" the cached text until it expires, and later requests for the same POI with a different persona will still receive that cached version. This is a deliberate tradeoff to maximize cache hits and minimize AI API cost.

### Local setup

Both services can be run locally via `docker-compose.yml`:

\`\`\`bash
docker compose up postgres redis -d
\`\`\`

Then run migrations against your database:

\`\`\`bash
npx prisma migrate dev
\`\`\`

For hosted alternatives (recommended if you don't want to run Docker), see:
- [Neon](https://neon.com) for Postgres — free tier, instant connection string
- [Upstash](https://upstash.com) for Redis — free tier, serverless



## 🐳 Running with Docker

### Setup

1. Clone the repo
```bash
   git clone https://github.com/your-username/geo-narrator.git
   cd geo-narrator
```

2. Copy the example environment file and fill in your own keys
```bash
   cp .env.example .env
```
   Then edit `.env` with your own values (Anthropic API key, Google Client ID, ElevenLabs keys, JWT secret, etc.)

3. Build and run
```bash
   docker compose up
```

4. Open the app
```
   http://localhost:3000
```

### Stopping the app
```bash
docker compose down
```

## Future Progress

- Multi-language voice narration — guide speaks in the visitor's chosen language
- Auto-translate Q&A answers to match selected language
- Language-aware voice modulation (tone/accent suited to each language)
- Language selector added to sign-in/onboarding flow
- Automatic GPS-based location detection (no manual selection)
- Voice modulation for more expressive, natural-sounding narration


## License

Built for OpenAI Codex Hackathon, July 2026. If you've have any query please connect here srushtikulkarni09@gmail.com
