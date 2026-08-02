const { expect } = require("chai");
const {
  authenticateToken,
} = require("../../../backend/middleware/authenticate-token");
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../../../backend/middleware/authenticate-token");

describe("authenticateToken", () => {
  it("rejects a request without an authorization token", () => {
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

  it("rejects a request that does not use the Bearer scheme", () => {
    const req = { headers: { authorization: "Basic encoded-credentials" } };
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

  it("authenticates with valid token", () => {
    const token = jwt.sign({ id: 1 }, SECRET_KEY);
    const req = { headers: { authorization: `Bearer ${token}` }, user: null };
    const res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let nextCalled = false;
    authenticateToken(req, res, () => { nextCalled = true; });
    expect(res.statusCode).to.be.null;
    expect(req.user).to.not.be.null;
    expect(nextCalled).to.equal(true);
  });


  it("rejects bearer scheme with missing token", () => {
    const req = { headers: { authorization: "Bearer" } };
    const res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let nextCalled = false;
    authenticateToken(req, res, () => { nextCalled = true; });
    expect(res.statusCode).to.equal(401);
    expect(res.body).to.deep.equal({ error: "Unauthorized" });
    expect(nextCalled).to.equal(false);
  });

});
