const request = require("supertest");
const { expect } = require("chai");
const { app, reseed } = require("../../helpers/supertest-app");

describe("FR04 - Profile Update (SPEC)", () => {
  let token;
  let user;

  beforeEach(async () => {
    await reseed();
    const res = await request(app)
      .post("/api/login")
      .send({ email: "test@eshop.com", password: "Test1234!" });
    token = res.body.token;
    user = res.body.user;
  });

  it("should fail if phone is invalid (missing prefix 0 or wrong length)", async () => {
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "9912345678", name: "New Name", shipping_address: "123 Street" });
    
    // SPEC expects validation failure
    expect(res.status).to.be.at.least(400);
  });

  it("should ignore attempts to change the user's role", async () => {
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "admin", name: user.name, shipping_address: user.shipping_address, phone: "0123456789" });
    
    const meRes = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    
    // SPEC expects role to remain "user"
    expect(meRes.body.role).to.equal("user");
  });

  it("should not wipe unspecified fields on partial update", async () => {
    // Only update name
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name" });
    
    const meRes = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    
    // SPEC expects the shipping_address and phone to not be null if they had previous values,
    // or at least not set to explicitly null by a partial update. Since it's a new user, they start as null.
    // Let's set them first.
    await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Initial", shipping_address: "Initial Addr", phone: "0123456789" });

    // Partial update
    await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name" });

    const meRes2 = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes2.body.name).to.equal("Updated Name");
    expect(meRes2.body.shipping_address).to.equal("Initial Addr");
    expect(meRes2.body.phone).to.equal("0123456789");
  });
});
