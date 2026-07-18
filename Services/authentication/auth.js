const { OAuth2Client } = require('google-auth-library');

function getClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');
  return new OAuth2Client(clientId);
}

async function verifyGoogleToken(idToken) {
  if (typeof idToken !== 'string' || !idToken.trim()) {
    throw new Error('Google credential is required');
  }

  const ticket = await getClient().verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email || !payload.email_verified) {
    throw new Error('Google token has no verified email');
  }
  return payload;
}

module.exports = { verifyGoogleToken };
