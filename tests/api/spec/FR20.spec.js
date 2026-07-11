const request = require("supertest");
const { expect } = require("chai");
const { app, reseed } = require("../../helpers/supertest-app");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("FR20 - Mobile Login & Account Lock (SPEC)", function () {
  beforeEach(async () => {
    await reseed();
  });

  it("should increment login counter by 1 on failed login", async () => {
    await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });
    
    // Admin checks user
    const aRes = await request(app).post("/api/login").send({ email: "admin@eshop.com", password: "Admin123!" });
    const adminToken = aRes.body.token;
    const usersRes = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${adminToken}`);
    const testUser = usersRes.body.find((u) => u.email === "test@eshop.com");
    
    // SPEC expects +1
    expect(testUser.login_attempts).to.equal(1);
  });

  it("should not lock after 2 failed attempts", async () => {
    await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });
    await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });
    
    const aRes = await request(app).post("/api/login").send({ email: "admin@eshop.com", password: "Admin123!" });
    const usersRes = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${aRes.body.token}`);
    const testUser = usersRes.body.find((u) => u.email === "test@eshop.com");
    
    expect(testUser.locked_until).to.be.null;
  });

  it("should unlock after 30 seconds", async function () {
    this.timeout(60000); // Allow 60s
    // 3 failed logins to lock it
    await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });
    await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });
    await request(app).post("/api/login").send({ email: "test@eshop.com", password: "wrong" });

    // Wait 31s
    await delay(31000);

    // Should be able to login now
    const res = await request(app).post("/api/login").send({ email: "test@eshop.com", password: "Test1234!" });
    
    // SPEC expects success because lock was 30s
    expect(res.status).to.equal(200);
  });
});
