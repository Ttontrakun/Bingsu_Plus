export const getRequestContext = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return {
    ip: (forwardedIp || req.ip || "").toString().trim() || null,
    userAgent: req.headers["user-agent"] || null,
  };
};
