/*
 * Authenticates the request by asking your existing /api/auth/me endpoint
 * who the Bearer token belongs to, then puts that user on req.user.
 *
 * This works with whatever token scheme routes/auth.js uses. If you have a
 * proper auth middleware already (e.g. one that verifies a JWT), replace the
 * require() in routes/studentRoutes.js with it and delete this file; the
 * controller only needs req.user.email (or req.user.enrollmentId).
 *
 * Needs Node 18+ (global fetch).
 */
const AUTH_BASE =
  process.env.AUTH_INTERNAL_URL ||
  `http://127.0.0.1:${process.env.PORT || 5000}`;

module.exports = async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  try {
    const response = await fetch(`${AUTH_BASE}/api/auth/me`, {
      headers: { Authorization: authHeader },
    });

    if (response.status === 401) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    if (!response.ok) {
      throw new Error(`/api/auth/me responded with ${response.status}`);
    }

    const data = await response.json();
    if (!data || !data.user) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    req.user = data.user;
    next();
  } catch (err) {
    next(err);
  }
};