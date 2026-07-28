const { expect } = require("chai");
const app = require("../../../backend/app");

describe("backend/app unit tests", () => {
  it("exports a configured Express application", () => {
    expect(app).to.be.a("function");
    expect(app.use).to.be.a("function");
  });
});
