# [BUG-15][FR-17] — `discount_value` accepts negative and zero values

## Description
FR-17 requires `discount_value` to be a positive number. `POST /api/admin/coupons` inserts whatever numeric value it receives with no lower-bound check, so `-10` and `0` are both accepted and stored. A coupon with a non-positive discount is meaningless (or, combined with checkout math in FR-09, could produce unexpected totals).

## Environment
- Component: `backend` (Node.js + Express 5), admin-authenticated endpoint
- Start: `cd backend && node server.js` (`http://localhost:3000`)
- Requires an admin token (`admin@eshop.com` / `Admin123!`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 457–465 (`POST /api/admin/coupons` — `discount_value` inserted with no range check) |

## Affect Level
**HIGH**

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
  -d '{"code":"NEG10","type":"percent","discount_value":-10,"min_order_amount":0,"expired_at":"2099-12-31","max_uses_per_user":1}'
# Actual: 200 OK, coupon created with discount_value: -10

curl -s -X POST http://localhost:3000/api/admin/coupons \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"code":"ZERO01","type":"percent","discount_value":0,"min_order_amount":0,"expired_at":"2099-12-31","max_uses_per_user":1}'
# Actual: 200 OK, coupon created with discount_value: 0
# Expected for both: rejection (400).
```

## Suggested Fix
In `server.js:457-465`, validate `Number(discount_value) > 0` before the insert; return `400 Bad Request` otherwise.
