const { expect } = require("chai");
const {
  authenticateToken,
} = require("../../../backend/middleware/authenticate-token");

describe("authenticateToken", () => {
  it("Rejects a request without an authorization token", () => {
    const req = { headers: {} };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    let nextCalled = false;

    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    expect(res.statusCode).to.equal(401);
    expect(res.body).to.deep.equal({ error: "Unauthorized" });
    expect(nextCalled).to.equal(false);
  });

  const req = {
    headers: {
      authorization: "Bearer invalid.token.value",
    },
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;
  
  authenticateToken(req, res, () => {
    nextCalled = true;
  });
  
  expect(res.statusCode).to.equal(403);
  expect(res.body).to.deep.equal({ error: "Forbidden" });
  expect(nextCalled).to.equal(false);
  expect(req.user).to.equal(undefined);

});
