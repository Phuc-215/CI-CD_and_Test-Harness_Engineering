const request = require("supertest");
const { expect } = require("chai");
const { app, reseed } = require("../../helpers/supertest-app");

describe("FR15 - Product CRUD (SPEC)", () => {
  let userToken;
  let adminToken;

  beforeEach(async () => {
    await reseed();
    
    // Normal user
    const uRes = await request(app)
      .post("/api/login")
      .send({ email: "test@eshop.com", password: "Test1234!" });
    userToken = uRes.body.token;

    // Admin user
    const aRes = await request(app)
      .post("/api/login")
      .send({ email: "admin@eshop.com", password: "Admin123!" });
    adminToken = aRes.body.token;
  });

  it("should deny normal users from creating products", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ name: "New Phone", price: 10000, category_id: 1 });
    
    expect(res.status).to.equal(403);
  });

  it("should deny normal users from updating products", async () => {
    const res = await request(app)
      .put("/api/products/1")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ name: "Updated Phone", price: 10000, category_id: 1 });
    
    expect(res.status).to.equal(403);
  });

  it("should deny normal users from deleting products", async () => {
    const res = await request(app)
      .delete("/api/products/1")
      .set("Authorization", `Bearer ${userToken}`);
    
    expect(res.status).to.equal(403);
  });

  it("should validate product input (e.g. empty name, negative price)", async () => {
    const res1 = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "", price: 10000, category_id: 1 });
    expect(res1.status).to.be.at.least(400);

    const res2 = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Valid Name", price: -100, category_id: 1 });
    expect(res2.status).to.be.at.least(400);
  });
});
