const request = require("supertest");
const { expect } = require("chai");
const { app, reseed } = require("../../helpers/supertest-app");

describe("Guard Suite - Actual Buggy Behavior", () => {
  let userToken;
  let adminToken;
  let testUser;

  beforeEach(async () => {
    await reseed();
    const uRes = await request(app).post("/api/login").send({ email: "test@eshop.com", password: "Test1234!" });
    userToken = uRes.body.token;
    testUser = uRes.body.user;

    const aRes = await request(app).post("/api/login").send({ email: "admin@eshop.com", password: "Admin123!" });
    adminToken = aRes.body.token;
  });

  describe("FR04", () => {
    it("BUG-04: allows privilege escalation (setting role to admin)", async () => {
      await request(app).put("/api/users/me").set("Authorization", `Bearer ${userToken}`)
        .send({ role: "admin", name: "hacked", shipping_address: "hacked", phone: "123" });
      const meRes = await request(app).get("/api/users/me").set("Authorization", `Bearer ${userToken}`);
      expect(meRes.body.role).to.equal("admin");
    });

    it("BUG-05: has no phone validation", async () => {
      const res = await request(app).put("/api/users/me").set("Authorization", `Bearer ${userToken}`)
        .send({ phone: "invalid", name: "test", shipping_address: "test" });
      expect(res.status).to.equal(200);
    });

    it("BUG-11: partial update wipes fields (NULL)", async () => {
      await request(app).put("/api/users/me").set("Authorization", `Bearer ${userToken}`)
        .send({ name: "just name" });
      const meRes = await request(app).get("/api/users/me").set("Authorization", `Bearer ${userToken}`);
      expect(meRes.body.phone).to.be.null;
    });
  });

  describe("FR09", () => {
    it("BUG-06: percent discount uses (1 - value) resulting in negative discount", async () => {
      // SAVE10 (value=10). Total 500k -> 500k * (1 - 10) = -4.5M discount!
      const res = await request(app).post("/api/apply-coupon").set("Authorization", `Bearer ${userToken}`)
        .send({ code: "SAVE10", total_amount: 500000, user_id: testUser.id });
      expect(res.body.discount_amount).to.equal(-4500000);
    });

    it("BUG-07: apply-coupon allows missing auth", async () => {
      const res = await request(app).post("/api/apply-coupon")
        .send({ code: "SAVE10", total_amount: 500000, user_id: testUser.id });
      expect(res.status).to.equal(200);
    });

    it("BUG-08: threshold is > not >=", async () => {
      // SAVE10 min is 300000. Exactly 300k fails.
      const res = await request(app).post("/api/apply-coupon").set("Authorization", `Bearer ${userToken}`)
        .send({ code: "SAVE10", total_amount: 300000, user_id: testUser.id });
      expect(res.status).to.equal(400);
    });

    it("BUG-12: guest coupon bypass", async () => {
      // applying without user_id ignores usage limits
      const res = await request(app).post("/api/apply-coupon")
        .send({ code: "VIP100", total_amount: 500000 });
      expect(res.status).to.equal(200);
    });
  });

  describe("FR15", () => {
    it("BUG-09: no access control on product creation", async () => {
      const res = await request(app).post("/api/products").set("Authorization", `Bearer ${userToken}`)
        .send({ name: "hacked", price: 10, category_id: 1 });
      expect(res.status).to.equal(200);
    });

    it("BUG-10: no product input validation", async () => {
      const res = await request(app).post("/api/products").set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "", price: -100, category_id: 1 });
      expect(res.status).to.equal(200);
    });
  });

  describe("FR20", () => {
    it("BUG-01 & BUG-02: login counter +2 and locks after 2 fails", async () => {
      await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });
      const usersRes = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${adminToken}`);
      const u = usersRes.body.find(u => u.email === "test@eshop.com");
      expect(u.login_attempts).to.equal(2); // BUG-01
      
      // Second fail should reach 4 and lock
      await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });
      const usersRes2 = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${adminToken}`);
      const u2 = usersRes2.body.find(u => u.email === "test@eshop.com");
      expect(u2.locked_until).to.not.be.null; // BUG-02
    });

    it("BUG-03: lock 180s instead of 30s", async () => {
      await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });
      await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });
      
      const usersRes = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${adminToken}`);
      const u = usersRes.body.find(u => u.email === "test@eshop.com");
      
      const lockedTime = new Date(u.locked_until).getTime();
      const now = Date.now();
      const diffSecs = (lockedTime - now) / 1000;
      
      expect(diffSecs).to.be.greaterThan(35); // Definitely > 30s
    });
  });
});
