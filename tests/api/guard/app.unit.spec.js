const { expect } = require("chai");
const request = require("supertest");
const app = require("../../../backend/app");

describe("application routes", () => {
  it("serves the public products collection", async () => {
    const response = await request(app).get("/api/products");

    expect(response.status).to.equal(200);
    expect(response.body).to.be.an("array");
  });
});
