const app = require("../../backend/app");
const { reseed } = require("./reseed");

function bearerAuth(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  app,
  reseed,
  bearerAuth,
};
