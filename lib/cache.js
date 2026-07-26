const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
const TTL = parseInt(process.env.CACHE_TTL_SECONDS || '604800', 10);

function buildKey(poiName) {
  return `narration:${String(poiName).toLowerCase().trim()}`;
}

async function getCachedNarration(poiName) {
  const key = buildKey(poiName);
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

async function setCachedNarration(poiName, data) {
  const key = buildKey(poiName);
  await redis.set(key, JSON.stringify(data), 'EX', TTL);
}

module.exports = { getCachedNarration, setCachedNarration };