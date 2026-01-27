import { prisma } from "../db.js";

export const createSystemLog = async ({ level, message, meta, userId }) => {
  try {
    await prisma.systemLog.create({
      data: {
        level,
        message,
        meta,
        userId,
      },
    });
  } catch (error) {
    console.error("Failed to write system log", error);
  }
};

export const logEvent = async ({
  level = "info",
  event,
  actorId,
  targetType,
  targetId,
  outcome = "success",
  meta = {},
}) => {
  await createSystemLog({
    level,
    message: event,
    userId: actorId ?? undefined,
    meta: {
      event,
      actorId,
      targetType,
      targetId,
      outcome,
      ...meta,
    },
  });
};
