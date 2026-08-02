const { expect } = require("chai");
const request = require("supertest");
const app = require("../../../../backend/app");

// Dedicated Qodo Cover fixture: this folder is the agent's only test target.
describe("application health coverage fixture", () => {
  it("exports an Express application", () => {
    expect(app).to.be.a("function");
  });

  it("returns an OK health payload without database access", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).to.equal(200);
    expect(response.body).to.deep.equal({ status: "ok" });
  });
});
