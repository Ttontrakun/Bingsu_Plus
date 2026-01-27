import { prisma } from "../db.js";
import { requireEmailVerification } from "../config.js";

export const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  emailVerifiedAt: user.emailVerifiedAt,
  role: user.role,
  isActive: user.isActive,
  approvalStatus: user.approvalStatus,
  createdAt: user.createdAt,
});

export const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }
  const tokenHeader = req.headers["x-session-token"];
  if (Array.isArray(tokenHeader)) {
    return tokenHeader[0];
  }
  return tokenHeader;
};

export const authenticate = async (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    res.status(401).json({ error: "Session expired" });
    return;
  }

  if (session.user.isActive === false) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }
  if (
    requireEmailVerification
    && session.user.role === "user"
    && !session.user.emailVerifiedAt
  ) {
    res.status(403).json({ error: "Email not verified" });
    return;
  }
  if (session.user.role === "user" && session.user.approvalStatus !== "approved") {
    res.status(403).json({ error: "Account pending approval" });
    return;
  }

  req.user = session.user;
  req.session = session;
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  next();
};

export const requireAdmin = requireRole("admin");
export const requireAdminMetrics = requireRole("admin", "admin_metrics", "support");
