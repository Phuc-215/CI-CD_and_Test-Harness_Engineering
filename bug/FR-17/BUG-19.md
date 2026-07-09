# [BUG-19][FR-17] — Coupon can be created with `expired_at` in the past or not a valid date

## Description
`POST /api/admin/coupons` writes `expired_at` straight into a `DATETIME` column with no validation. A coupon can be created that is already expired at creation time (nonsensical — it can never be used), and a completely non-date string such as `"abc"` is accepted and stored verbatim, silently corrupting the column's expected type.

## Environment
- Component: `backend` (Node.js + Express 5), admin-authenticated endpoint
- Start: `cd backend && node server.js` (`http://localhost:3000`)
- Requires an admin token (`admin@eshop.com` / `Admin123!`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 457–465 (`POST /api/admin/coupons` — `expired_at` inserted with no format/range check) |
| `backend/database.js` | 29–38 (`coupons.expired_at DATETIME` — SQLite has no real type enforcement, so any string is accepted) |

## Affect Level
**MEDIUM**

## Steps to Reproduce (CLI)
```bash
cd CI-CD_and_Test-Harness_Engineering/backend
node server.js &

ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@eshop.com","password":"Admin123!"}' | node -e \
  "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

curl -s -X POST http://localhost:3000/api/admin/coupons \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"code":"PASTDATE","type":"fixed","discount_value":10000,"min_order_amount":0,"expired_at":"2020-01-01","max_uses_per_user":1}'
# Actual: 200 OK — coupon created already expired. (Business question worth clarifying with stakeholders:
# should creating an already-expired coupon be allowed at all, e.g. for historical/testing records?)

curl -s -X POST http://localhost:3000/api/admin/coupons \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"code":"BADDATE","type":"fixed","discount_value":10000,"min_order_amount":0,"expired_at":"abc","max_uses_per_user":1}'
# Expected: rejected (400, invalid date).
# Actual: 200 OK — "abc" stored directly in the DATETIME column, no error.
```

## Suggested Fix
In `server.js:457-465`, parse `expired_at` with `Date.parse()` (or a stricter date library) and reject with `400` if it's not a valid date. Whether a past date should additionally be rejected is a product decision — flag it for clarification rather than assuming; at minimum, non-date strings like `"abc"` should always be rejected.
