const { expect } = require("chai");
const { requestLabel } = require("../../../../backend/utils/request-label");

describe("requestLabel", () => {
  it("keeps a supplied request label", () => {
    expect(requestLabel("jenkins")).to.equal("jenkins");
  });

  it("takes first line when newline present", () => {
    expect(requestLabel("hello\nworld")).to.equal("hello");
  });


  it("truncates string to 64 characters when longer than 64", () => {
    expect(requestLabel("a".repeat(65))).to.equal("a".repeat(64));
  });

});
