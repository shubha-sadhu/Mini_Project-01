const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated. Please log in again." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SESSION_SECRET);
    req.userId = payload.sub;
    // adminMiddleware.js checks req.user.role, so populate this too —
    // keeps req.userId working for existing routes (like /me) while
    // adding what the admin check needs.
    req.user = { id: payload.sub, role: payload.role || "student" };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

module.exports = { requireAuth };
