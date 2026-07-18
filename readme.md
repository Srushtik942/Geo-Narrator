# Trailtale — Backend Build Rules (for Codex)

These are the rules to follow, in order, when building the Trailtale backend. Follow the sequence — do not build features out of order. Only required services are listed; no optional/nice-to-have integrations are included.

---

## Build Order (must follow this sequence)

1. **Authentication first** — nothing else gets built until Google Sign-In + session handling works end-to-end.
2. **Anthropic Claude API integration** — narration + Q&A endpoints, protected behind auth.
3. **Supporting endpoints** — POI data, journal/history storage.

Do not skip ahead to narration or POI features before auth is working and tested.

---

## 1. Authentication (build this first)

### Requirement
Users sign in with Google on the frontend (Google Identity Services). The backend must verify the Google token, create/find the user, and issue the app's own session token. All other endpoints must be protected by this session token.

### Rules
- Never trust the frontend's claim of "who the user is" — always verify the Google credential server-side.
- Never store or log the raw Google ID token beyond the verification step.
- Session tokens (JWT) must expire (7 days max for hackathon demo) and must be signed with a secret stored in an environment variable, never hardcoded.
- Every protected route must go through auth middleware — no exceptions.

### Required package
```bash
npm install google-auth-library jsonwebtoken express dotenv
```

### Environment variables (`.env`, never commit this file)
```
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
JWT_SECRET=long_random_string
PORT=3000
```

### `auth.js` — verify Google token
```js
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

async function verifyGoogleToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: CLIENT_ID,
  });
  return ticket.getPayload(); // { email, name, picture, sub, ... }
}

module.exports = { verifyGoogleToken };
```

### `POST /api/auth/google` — login endpoint
```js
const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyGoogleToken } = require('./auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

router.post('/auth/google', async (req, res) => {
  try {
    const { credential } = req.body; // JWT sent from the frontend Google button

    const payload = await verifyGoogleToken(credential);

    // Find or create the user (replace with real DB call)
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
    }

    const sessionToken = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token: sessionToken,
      user: { name: user.name, email: user.email, picture: user.picture },
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

module.exports = router;
```

### `authMiddleware.js` — protect routes
```js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization; // "Bearer <token>"
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
```

### Checklist before moving to step 2
- [ ] Google Client ID set in `.env`
- [ ] `/api/auth/google` returns a valid session token when tested with a real Google credential
- [ ] Protected test route (`/api/me`) rejects requests with no/invalid token
- [ ] Protected test route accepts requests with a valid session token

---

## 2. Anthropic Claude API (narration + Q&A) — build this second

### Requirement
All Claude API calls happen **server-side only**. The frontend never sees or holds the Anthropic API key. Every narration/Q&A request must pass through `authMiddleware` first.

### Where to get the key
- Anthropic Console: https://console.anthropic.com
- Sign up → "API Keys" → Create Key. New accounts usually get some free credit.

### Environment variable
```
ANTHROPIC_API_KEY=your_key_here
```

### `claude.js` — helper
```js
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.content && data.content[0] && data.content[0].text) {
    return data.content[0].text.trim();
  }
  throw new Error('Claude API returned no content');
}

module.exports = { callClaude };
```

### `POST /api/narration` — protected route
```js
router.post('/narration', authMiddleware, async (req, res) => {
  try {
    const { poiName, facts, persona } = req.body;
    const prompt = `You are Trailtale, an AI guide narrating live at "${poiName}".
Persona: ${persona}
Use ONLY these grounding facts: ${facts.join(' ')}
Write 2-3 short spoken-style sentences. No lists, no headers.`;

    const narration = await callClaude(prompt);
    res.json({ narration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate narration' });
  }
});
```

### `POST /api/ask` — protected route
```js
router.post('/ask', authMiddleware, async (req, res) => {
  try {
    const { question, poiName, facts, persona } = req.body;
    const prompt = `You are Trailtale, speaking aloud to a visitor at "${poiName}".
Persona: ${persona}
Known facts: ${facts.join(' ')}
The visitor asked: "${question}"
Answer in 1-3 short spoken sentences.`;

    const answer = await callClaude(prompt);
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});
```

### Rules
- Reject the request with `400` if `poiName`, `facts`, or `persona` is missing.
- Never let the frontend pass a raw prompt string directly to Claude — always build the prompt server-side from structured fields, to prevent prompt injection.
- Rate-limit these two routes per user if time allows (not required for hackathon demo, but flag it as a TODO).

---

## 3. Supporting Data (build this third)

### POI data endpoint
```js
router.get('/pois', authMiddleware, (req, res) => {
  res.json(POIS); // hardcoded array for hackathon: id, name, lat, lng, radiusMeters, facts
});
```

### Journal/history endpoint (optional to persist, but keep the shape ready)
```js
router.post('/journal', authMiddleware, async (req, res) => {
  const { poiId, type, text } = req.body; // type: 'narration' | 'question' | 'answer'
  // Save to DB, associated with req.user.userId
  res.json({ saved: true });
});

router.get('/journal', authMiddleware, async (req, res) => {
  // Fetch entries for req.user.userId
  res.json({ entries: [] });
});
```

---

## Location & Voice — no backend needed

These run entirely in the browser. Do **not** build backend endpoints for these — there is nothing to proxy:

| Capability | API | Notes |
|---|---|---|
| Get user's live position | `navigator.geolocation.watchPosition` | Native browser API, no key |
| Speak narration aloud | `window.speechSynthesis` | Native browser API, no key |
| Capture spoken question | `window.SpeechRecognition` / `webkitSpeechRecognition` | Native browser API, no key |

---

## Global Rules (apply everywhere)

1. **Auth is mandatory** on every route except `/api/auth/google` itself.
2. **No API keys in frontend code** — Anthropic key lives only in backend `.env`.
3. **`.env` is never committed** — add it to `.gitignore` immediately.
4. **Validate all request bodies** — reject with `400` on missing required fields before calling any external API.
5. **Wrap every external API call in try/catch** and return a clean `500` with a generic error message — never leak stack traces or raw error objects to the frontend.
6. **CORS** — only allow requests from your known frontend origin(s) (localhost dev URL + deployed Vercel URL), not `*`.
7. Do not add ElevenLabs, Whisper, or Google Maps integrations — out of scope for this build.

---

## Minimal folder structure
```
/backend
  .env
  .gitignore
  server.js
  /routes
    auth.js
    narration.js
    pois.js
    journal.js
  /middleware
    authMiddleware.js
  /lib
    claude.js
    googleAuth.js
```