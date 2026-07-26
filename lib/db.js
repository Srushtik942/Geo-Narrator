const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function saveVisit({ userId, userEmail, poiName, persona, language, narration, imageUrl }) {
  const user = await prisma.user.upsert({
    where: { googleId: userId },
    update: {},
    create: {
      googleId: userId,
      email: userEmail,
      name: userEmail?.split('@')[0] || null,
    },
  });

  const poi = await prisma.poi.upsert({
    where: { name: poiName },
    update: {},
    create: { name: poiName },
  });

  return prisma.visit.create({
    data: {
      userId: user.id,
      poiId: poi.id,
      persona,
      language: language || 'en',
      narration,
      imageUrl,
    },
  });
}

async function getUserJournal(userId) {
  const user = await prisma.user.findUnique({ where: { googleId: userId } });
  if (!user) return [];

  return prisma.visit.findMany({
    where: { userId: user.id },
    include: { poi: true },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = { prisma, saveVisit, getUserJournal };