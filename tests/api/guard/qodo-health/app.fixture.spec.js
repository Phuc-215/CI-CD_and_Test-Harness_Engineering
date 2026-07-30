const { expect } = require("chai");
const app = require("../../../../backend/app");

// Dedicated Qodo Cover fixture: this folder is the agent's only test target.
describe("application health coverage fixture", () => {
  it("exports an Express application", () => {
    expect(app).to.be.a("function");
  });
});
