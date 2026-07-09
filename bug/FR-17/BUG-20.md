# [BUG-20][FR-17] — Duplicate `code` leaks a raw SQL error with the wrong HTTP status

## Description
On the positive side, `coupons.code` genuinely has a `UNIQUE` constraint at the database schema level, so a duplicate coupon code *is* correctly rejected — the underlying business rule holds. However, the error handling is poor: the `db.run` error callback returns `res.status(500).json({ error: err.message })` unconditionally, so a duplicate-code request returns **HTTP 500** with the raw driver error string `SQLITE_CONSTRAINT: UNIQUE constraint failed: coupons.code` leaked directly to the client, instead of a clean `409 Conflict` with a user-facing message.

## Environment
- Component: `backend` (Node.js + Express 5 + sqlite3), admin-authenticated endpoint
- Start: `cd backend && node server.js` (`http://localhost:3000`)
- Requires an admin token (`admin@eshop.com` / `Admin123!`)
- `SAVE10` is a coupon code seeded on first startup (`database.js`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 476–478 (generic `if (err) return res.status(500).json({ error: err.message })` — no branch for constraint violations) |
| `backend/database.js` | 31 (`code TEXT UNIQUE` — confirms the constraint is real and correctly enforced at the DB layer) |

## Affect Level
**LOW**

## Steps to Reproduce (CLI)
```bash
cd CI-CD_and_Test-Harness_Engineering/backend
node server.js &

ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@eshop.com","password":"Admin123!"}' | node -e \
  "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:3000/api/admin/coupons \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"code":"SAVE10","type":"percent","discount_value":10,"min_order_amount":0,"expired_at":"2099-12-31","max_uses_per_user":1}'
# Expected: HTTP 409, body like {"error":"Mã giảm giá đã tồn tại"}.
# Actual (verified): HTTP 500, body {"error":"SQLITE_CONSTRAINT: UNIQUE constraint failed: coupons.code"}
```

## Suggested Fix
In the `db.run` callback at `server.js:476-478`, inspect `err.message` (or `err.code === 'SQLITE_CONSTRAINT'`) and return `res.status(409).json({ error: "Mã giảm giá đã tồn tại" })` for a unique-constraint violation, falling back to `500` with a generic message for any other kind of error rather than always echoing the raw driver message.
