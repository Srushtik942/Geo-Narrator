const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyGoogleToken } = require('../Services/authentication/auth');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
// Temporary demo store. Move this find-or-create operation to the database when
// user persistence is introduced in the supporting-data stage.
const usersByGoogleId = new Map();

router.post('/auth/google', async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Authentication is not configured' });
    }

    const payload = await verifyGoogleToken(req.body?.credential);
    let user = usersByGoogleId.get(payload.sub);
    if (!user) {
      user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture || null,
      };
      usersByGoogleId.set(payload.sub, user);
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '7d' }
    );

    return res.json({ token, user: { name: user.name, email: user.email, picture: user.picture } });
  } catch (error) {
    console.error('Google authentication failed:', error.message);
    return res.status(401).json({ error: 'Invalid Google token' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
