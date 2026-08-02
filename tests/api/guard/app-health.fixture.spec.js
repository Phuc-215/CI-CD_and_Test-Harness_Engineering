const { expect } = require("chai");
const app = require("../../../backend/app");

// This minimal fixture identifies backend/app.js as the source file for Qodo
// Cover. The generated test should extend this file with health-route coverage.
describe("application health fixture", () => {
  it("exports an Express application", () => {
    expect(app).to.be.a("function");
  });
});
