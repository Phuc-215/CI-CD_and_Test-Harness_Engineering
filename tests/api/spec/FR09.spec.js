const request = require("supertest");
const { expect } = require("chai");
const { app, reseed } = require("../../helpers/supertest-app");

describe("FR09 - Apply Coupon (SPEC)", () => {
  let token;

  beforeEach(async () => {
    await reseed();
    const res = await request(app)
      .post("/api/login")
      .send({ email: "test@eshop.com", password: "Test1234!" });
    token = res.body.token;
  });

  it("should require authentication to apply a coupon", async () => {
    const res = await request(app)
      .post("/api/apply-coupon")
      .send({ code: "SAVE10", total_amount: 500000 });
    
    // SPEC expects 401 Unauthorized, but BUG-07 means it's missing auth and will pass or give 200
    expect(res.status).to.equal(401);
  });

  it("should correctly calculate percent discount", async () => {
    // SAVE10 is 10% off. Total 500k -> 50k discount, final 450k.
    const res = await request(app)
      .post("/api/apply-coupon")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "SAVE10", total_amount: 500000, user_id: 2 }); // user_id 2 is Test User
    
    expect(res.body.discount_amount).to.equal(50000);
    expect(res.body.final_amount).to.equal(450000);
  });

  it("should apply coupon if total_amount is exactly equal to min_order_amount (>=' threshold)", async () => {
    // SAVE10 min is 300000
    const res = await request(app)
      .post("/api/apply-coupon")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "SAVE10", total_amount: 300000, user_id: 2 });
    
    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
  });

  it("should enforce guest coupon bypass limit (no user_id)", async () => {
    // Guest shouldn't be able to apply a coupon that requires tracking uses
    const res = await request(app)
      .post("/api/apply-coupon")
      // .set("Authorization", `Bearer ${token}`) -> Assuming we still pass auth or not.
      // Wait, if it requires auth, guest cannot reach here. But the guest bypass bug says:
      // "guest coupon bypass (no user_id -> else branch)"
      .send({ code: "SAVE10", total_amount: 500000 });
    
    // SPEC expects this to fail either via auth or validation
    expect(res.status).to.be.at.least(400);
  });
});
