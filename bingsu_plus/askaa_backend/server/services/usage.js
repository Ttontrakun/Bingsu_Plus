import { prisma } from "../db.js";

export const getDateKey = () => new Date().toISOString().slice(0, 10);

export const getOrCreateUsageDaily = async (userId) => {
  const dateKey = getDateKey();
  const existing = await prisma.usageDaily.findUnique({
    where: { userId_dateKey: { userId, dateKey } },
  });
  if (existing) return existing;
  return prisma.usageDaily.create({
    data: { userId, dateKey },
  });
};
