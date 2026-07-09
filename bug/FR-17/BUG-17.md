# [BUG-17][FR-17] — `min_order_amount` accepts negative values

## Description
FR-17 requires `min_order_amount >= 0`. `POST /api/admin/coupons` stores the value as given, with no lower-bound check — a coupon can be created requiring a negative minimum order, which is meaningless (effectively "always applicable").

## Environment
- Component: `backend` (Node.js + Express 5), admin-authenticated endpoint
- Start: `cd backend && node server.js` (`http://localhost:3000`)
- Requires an admin token (`admin@eshop.com` / `Admin123!`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 457–465 (`POST /api/admin/coupons` — `min_order_amount` inserted with no range check) |

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
  -d '{"code":"NEGMIN","type":"fixed","discount_value":10000,"min_order_amount":-500,"expired_at":"2099-12-31","max_uses_per_user":1}'
# Expected: rejection (400).
# Actual: 200 {"message":"Coupon created","id":N}, min_order_amount stored as -500.
```

## Suggested Fix
In `server.js:457-465`, validate `Number(min_order_amount) >= 0` before the insert; return `400 Bad Request` otherwise.
