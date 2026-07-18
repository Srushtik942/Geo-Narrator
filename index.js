require('dotenv').config();

const express = require('express');
const authRoutes = require('./routes/auth');
const narrationRoutes = require('./routes/narration');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  }

  return res.status(403).json({ error: 'Origin is not allowed' });
});

app.use(express.json({ limit: '20kb' }));
// A Google OAuth client ID is public by design; secrets such as JWT_SECRET and
// ANTHROPIC_API_KEY are never sent to the browser.
app.get('/frontend-config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.GEO_NARRATOR_CONFIG = ${JSON.stringify({
    apiBase: '/api',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  })};`);
});
app.use(express.static('frontend'));

app.get('/', (req, res) => res.json({ message: 'Geo Narrator API is running' }));
app.use('/api', authRoutes);
app.use('/api', narrationRoutes);

// Do not expose stack traces or implementation details to API clients.
app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Geo Narrator API listening on port ${PORT}`));
}

module.exports = app;
