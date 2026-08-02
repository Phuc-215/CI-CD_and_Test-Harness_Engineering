const jwt = require("jsonwebtoken");

const SECRET_KEY = "super_secret_key_that_should_not_be_here";

const extractBearerToken = (authHeader) => {
  if (typeof authHeader !== "string") return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;

  return parts[1];
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = extractBearerToken(authHeader);
  if (token == null) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken, extractBearerToken, SECRET_KEY };
