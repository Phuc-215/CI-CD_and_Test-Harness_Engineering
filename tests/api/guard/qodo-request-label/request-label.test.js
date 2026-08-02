const { expect } = require("chai");
const { requestLabel } = require("../../../../backend/utils/request-label");

describe("requestLabel", () => {
  it("keeps a supplied request label", () => {
    expect(requestLabel("jenkins")).to.equal("jenkins");
  });
});
