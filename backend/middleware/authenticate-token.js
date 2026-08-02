const jwt = require("jsonwebtoken");

const SECRET_KEY = "super_secret_key_that_should_not_be_here";

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  // A header such as `Bearer ` does not contain a usable token. Treat it the
  // same way as a missing header instead of passing an empty value to JWT.
  if (token == null || token.trim() === "") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken, SECRET_KEY };
