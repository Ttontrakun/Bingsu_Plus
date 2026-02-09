import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../db.js";
import { rateLimit } from "../lib/rateLimit.js";
import { authenticate, sanitizeUser } from "../lib/auth.js";
import { getRequestContext } from "../lib/requestContext.js";
import { logEvent } from "../lib/logging.js";
import { createSession } from "../services/sessions.js";
import {
  emailVerificationTokenTtlHours,
  passwordResetTokenTtlHours,
  requireEmailVerification,
  isProduction,
} from "../config.js";

export const authRouter = express.Router();

const buildExpiryDate = (hours) => {
  const ttlHours = Number.isFinite(hours) && hours > 0 ? hours : 1;
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
};

const createToken = () => crypto.randomBytes(24).toString("hex");

const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

authRouter.post("/signup", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  const context = getRequestContext(req);

  if (!email || !password || !name) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }
  if (!(await rateLimit(`auth:${context.ip || "unknown"}`))) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = requireEmailVerification ? createToken() : null;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      // UX for local/dev:
      // - In production, new users must be approved by support/admin.
      // - In dev, allow signups to log in immediately.
      approvalStatus: isProduction ? "pending" : "approved",
      emailVerifiedAt: requireEmailVerification ? null : new Date(),
      emailVerificationToken: verificationToken ? hashToken(verificationToken) : null,
      emailVerificationExpiresAt: verificationToken
        ? buildExpiryDate(emailVerificationTokenTtlHours)
        : null,
    },
  });

  await logEvent({
    event: "user.signup.pending",
    actorId: user.id,
    targetType: "user",
    targetId: user.id,
    meta: { email: user.email, name: user.name, ...context },
  });

  res.status(201).json({
    user: sanitizeUser(user),
    pending: true,
    verificationRequired: requireEmailVerification,
    verificationToken: !isProduction ? verificationToken : undefined,
  });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const context = getRequestContext(req);

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  if (!(await rateLimit(`auth:${context.ip || "unknown"}`))) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.isActive === false) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }
  if (requireEmailVerification && user.role === "user" && !user.emailVerifiedAt) {
    res.status(403).json({ error: "Email not verified" });
    return;
  }
  if (user.role === "user" && user.approvalStatus !== "approved") {
    res.status(403).json({
      error: user.approvalStatus === "rejected" ? "Account rejected" : "Account pending approval",
    });
    return;
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const session = await createSession(user.id);
  await logEvent({
    event: "auth.login",
    actorId: user.id,
    targetType: "session",
    targetId: session.id,
    meta: { ...context },
  });
  res.json({
    user: sanitizeUser(user),
    token: session.token,
    expiresAt: session.expiresAt,
  });
});

authRouter.post("/verify-email", async (req, res) => {
  const { token } = req.body ?? {};
  const context = getRequestContext(req);

  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  if (!(await rateLimit(`auth:${context.ip || "unknown"}`))) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const tokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: tokenHash },
  });
  if (!user || (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date())) {
    res.status(400).json({ error: "Invalid or expired token" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    },
  });
  await logEvent({
    event: "auth.email.verified",
    actorId: user.id,
    targetType: "user",
    targetId: user.id,
    meta: { ...context },
  });

  res.json({ ok: true });
});

authRouter.post("/resend-verification", async (req, res) => {
  const { email } = req.body ?? {};
  const context = getRequestContext(req);

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  if (!(await rateLimit(`auth:${context.ip || "unknown"}`))) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) {
    res.json({ ok: true });
    return;
  }

  const token = createToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hashToken(token),
      emailVerificationExpiresAt: buildExpiryDate(emailVerificationTokenTtlHours),
    },
  });
  await logEvent({
    event: "auth.email.resend",
    actorId: user.id,
    targetType: "user",
    targetId: user.id,
    meta: { email: user.email, ...context },
  });

  res.json({ ok: true, verificationToken: !isProduction ? token : undefined });
});

authRouter.post("/request-password-reset", async (req, res) => {
  const { email } = req.body ?? {};
  const context = getRequestContext(req);

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  if (!(await rateLimit(`auth:${context.ip || "unknown"}`))) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = createToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashToken(token),
        passwordResetExpiresAt: buildExpiryDate(passwordResetTokenTtlHours),
      },
    });
    await logEvent({
      event: "auth.password.reset.requested",
      actorId: user.id,
      targetType: "user",
      targetId: user.id,
      meta: { email: user.email, ...context },
    });
    res.json({ ok: true, resetToken: !isProduction ? token : undefined });
    return;
  }

  res.json({ ok: true });
});

authRouter.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body ?? {};
  const context = getRequestContext(req);

  if (!token || !newPassword) {
    res.status(400).json({ error: "token and newPassword are required" });
    return;
  }
  if (String(newPassword).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  if (!(await rateLimit(`auth:${context.ip || "unknown"}`))) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const tokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: tokenHash },
  });
  if (!user || (user.passwordResetExpiresAt && user.passwordResetExpiresAt < new Date())) {
    res.status(400).json({ error: "Invalid or expired token" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await logEvent({
    event: "auth.password.reset",
    actorId: user.id,
    targetType: "user",
    targetId: user.id,
    meta: { ...context },
  });

  res.json({ ok: true });
});

authRouter.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const context = getRequestContext(req);

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }
  if (String(newPassword).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const user = req.user;
  const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!validPassword) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await prisma.session.deleteMany({
    where: { userId: user.id, id: { not: req.session.id } },
  });
  await logEvent({
    event: "auth.password.changed",
    actorId: user.id,
    targetType: "user",
    targetId: user.id,
    meta: { ...context },
  });

  res.json({ ok: true });
});

authRouter.get("/me", authenticate, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

authRouter.post("/logout", authenticate, async (req, res) => {
  try {
    await prisma.session.deleteMany({ where: { id: req.session.id } });
    await logEvent({
      event: "auth.logout",
      actorId: req.user?.id,
      targetType: "session",
      targetId: req.session.id,
      meta: { ...getRequestContext(req) },
    });
  } catch (error) {
    console.error("Logout failed", error);
  }
  res.json({ ok: true });
});
