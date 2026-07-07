// Shared test-isolation helper.
// Each API suite calls `await reseed()` before running so every suite starts from
// the same known seed state, independent of run order (fixes cross-suite DB pollution).
// It opens its OWN sqlite connection to the same file the running server uses; SQLite
// file-level sharing means the server reads the refreshed rows on the next request.
const path = require("path");
const sqlite3 = require(path.resolve(__dirname, "../../backend/node_modules/sqlite3")).verbose();

const DB_PATH = path.resolve(__dirname, "../../backend/database.sqlite");

function reseed() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
    });
    db.serialize(() => {
      db.run("DROP TABLE IF EXISTS coupon_usage");
      db.run("DROP TABLE IF EXISTS coupons");
      db.run("DROP TABLE IF EXISTS users");
      db.run("DROP TABLE IF EXISTS products");
      db.run("DROP TABLE IF EXISTS categories");
      db.run("DROP TABLE IF EXISTS orders");

      db.run(`CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
      db.run(`CREATE TABLE coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, type TEXT DEFAULT 'percent',
        discount_value INTEGER, min_order_amount INTEGER DEFAULT 0, expired_at DATETIME,
        is_active INTEGER DEFAULT 1, max_uses_per_user INTEGER DEFAULT 1)`);
      db.run(`CREATE TABLE coupon_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT, coupon_id INTEGER, user_id INTEGER,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, password TEXT,
        role TEXT DEFAULT 'user', login_attempts INTEGER DEFAULT 0, locked_until DATETIME,
        reset_token TEXT, shipping_address TEXT, phone TEXT)`);
      db.run(`CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER, description TEXT,
        imageUrl TEXT, category_id INTEGER)`);
      db.run(`CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, total_amount INTEGER,
        status TEXT DEFAULT 'pending', shipping_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

      const cat = db.prepare("INSERT INTO categories (name) VALUES (?)");
      cat.run("Điện thoại"); cat.run("Laptop"); cat.run("Phụ kiện"); cat.finalize();

      const usr = db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)");
      usr.run("Admin User", "admin@eshop.com", "Admin123!", "admin");
      usr.run("Test User", "test@eshop.com", "Test1234!", "user");
      usr.finalize();

      const prod = db.prepare("INSERT INTO products (name, price, description, imageUrl, category_id) VALUES (?, ?, ?, ?, ?)");
      prod.run("iPhone 15 Pro Max", 30000000, "Điện thoại cao cấp của Apple", "https://placehold.co/300x300/png?text=iPhone+15", 1);
      prod.run("Samsung Galaxy S24 Ultra", 28000000, "Màn hình hiển thị xuất sắc", "https://placehold.co/300x300/png?text=Samsung+S24", 1);
      prod.run("MacBook Pro M3", 45000000, "Laptop chuyên nghiệp mạnh mẽ", "https://placehold.co/300x300/png?text=Macbook+Pro", 2);
      prod.run("Tai nghe AirPods Pro 2", 6000000, "Chống ồn chủ động xuất sắc", "https://placehold.co/300x300/png?text=AirPods+Pro", 3);
      prod.run("Bàn phím cơ Keychron Q1", 4000000, "Gõ cực sướng", "https://placehold.co/300x300/png?text=Keychron+Q1", 3);
      prod.finalize();

      const cp = db.prepare("INSERT INTO coupons (code, type, discount_value, min_order_amount, expired_at, is_active, max_uses_per_user) VALUES (?, ?, ?, ?, ?, ?, ?)");
      cp.run("SAVE10", "percent", 10, 300000, "2099-12-31", 1, 1);
      cp.run("BIGBUY", "fixed", 50000, 500000, "2099-12-31", 1, 1);
      cp.run("VIP100", "fixed", 100000, 300000, "2099-12-31", 1, 2);
      cp.run("EXPIRED", "percent", 20, 100000, "2020-01-01", 1, 1);
      // Added seed: an INACTIVE coupon so EC-I2 (is_active = 0) is testable.
      cp.run("LOCKEDCODE", "percent", 15, 100000, "2099-12-31", 0, 1);
      cp.finalize();
    });
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { reseed };
