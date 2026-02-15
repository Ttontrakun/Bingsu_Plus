import express from "express";
import { prisma } from "../../shared/database/db.js";
import { authenticate } from "../../shared/lib/auth.js";

export const integrationsRouter = express.Router();

const PROVIDERS = ["line", "messenger", "website", "api"];

const normalizeProvider = (value) => String(value || "").trim().toLowerCase();

integrationsRouter.get("/integrations", authenticate, async (req, res) => {
  const rows = await prisma.integrationSetting.findMany({
    where: { userId: req.user.id },
    orderBy: { provider: "asc" },
  });
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  res.json(
    PROVIDERS.map((provider) => {
      const row = byProvider.get(provider);
      return {
        provider,
        enabled: Boolean(row?.enabled),
        config: row?.config ?? null,
        updatedAt: row?.updatedAt?.toISOString?.() ?? null,
      };
    }),
  );
});

integrationsRouter.patch("/integrations/:provider", authenticate, async (req, res) => {
  const provider = normalizeProvider(req.params.provider);
  if (!PROVIDERS.includes(provider)) {
    res.status(400).json({ error: "Unsupported provider" });
    return;
  }

  const { enabled, config } = req.body ?? {};
  if (enabled === undefined && config === undefined) {
    res.status(400).json({ error: "enabled or config is required" });
    return;
  }

  const safeEnabled = enabled === undefined ? undefined : Boolean(enabled);
  const safeConfig = config === undefined ? undefined : config;

  const updated = await prisma.integrationSetting.upsert({
    where: {
      userId_provider: {
        userId: req.user.id,
        // Prisma enum mapping: IntegrationProvider values are the same strings
        provider,
      },
    },
    update: {
      enabled: safeEnabled,
      config: safeConfig,
    },
    create: {
      userId: req.user.id,
      provider,
      enabled: safeEnabled ?? false,
      config: safeConfig ?? undefined,
    },
  });

  res.json({
    provider: updated.provider,
    enabled: updated.enabled,
    config: updated.config ?? null,
    updatedAt: updated.updatedAt.toISOString(),
  });
});

