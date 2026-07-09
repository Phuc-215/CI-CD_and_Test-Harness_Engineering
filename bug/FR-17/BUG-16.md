# [BUG-16][FR-17] — No cap on `discount_value` for `type = percent` coupons

## Description
When `type` is `percent`, a discount value above 100 is nonsensical — it should be rejected or capped at 100. The spec text for FR-17 only says `discount_value` must be "positive"; the 100% ceiling for percent-type coupons is a business-logic inference, not an explicit spec line, but it matters concretely: the checkout math in FR-09 computes `final_amount = total × (1 - discount_value/100)`, which goes negative once `discount_value > 100`. `POST /api/admin/coupons` accepts `101` and even `500` without complaint. This is a shared concern between FR-17 (where the value is created) and FR-09 (where it is consumed) — flagged here because it surfaced while testing coupon creation.

## Environment
- Component: `backend` (Node.js + Express 5), admin-authenticated endpoint
- Start: `cd backend && node server.js` (`http://localhost:3000`)
- Requires an admin token (`admin@eshop.com` / `Admin123!`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 457–465 (`POST /api/admin/coupons` — no upper-bound/type-conditional check on `discount_value`) |

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
  -d '{"code":"OVER101","type":"percent","discount_value":101,"min_order_amount":0,"expired_at":"2099-12-31","max_uses_per_user":1}'
curl -s -X POST http://localhost:3000/api/admin/coupons \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"code":"OVER500","type":"percent","discount_value":500,"min_order_amount":0,"expired_at":"2099-12-31","max_uses_per_user":1}'
# Expected: both rejected (400) since type=percent.
# Actual: both return 200 OK and are stored as-is (101 and 500).
```

## Suggested Fix
In `server.js:457-465`, when `type === 'percent'`, reject if `discount_value > 100` (`400 Bad Request`). Coordinate with whoever owns FR-09's checkout calculation to also clamp/guard `final_amount` defensively, so a bad coupon value already in the DB can't drive the total negative.
