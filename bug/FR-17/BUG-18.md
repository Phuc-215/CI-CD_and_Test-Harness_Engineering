# [BUG-18][FR-17] — `max_uses_per_user` accepts 0 and negative values

## Description
FR-17 requires `max_uses_per_user >= 1`. `POST /api/admin/coupons` stores whatever value it receives with no lower-bound check. A value of `0` or a negative number is nonsensical and can additionally create indeterminate behavior in FR-09's usage-tracking logic (e.g. a comparison like `usage_count < max_uses_per_user` behaves inconsistently once the right-hand side is `<= 0`).

## Environment
- Component: `backend` (Node.js + Express 5), admin-authenticated endpoint
- Start: `cd backend && node server.js` (`http://localhost:3000`)
- Requires an admin token (`admin@eshop.com` / `Admin123!`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 457–465, 474 (`max_uses_per_user || 1` only guards against falsy/missing values — `0` and negative numbers pass straight through since they aren't checked, only defaulted when absent) |
| `frontend-admin/src/App.jsx` | 698–710 (client input has `min="1"`, but this is only a client-side HTML attribute, not enforced server-side) |

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
  -d '{"code":"USES0","type":"fixed","discount_value":10000,"min_order_amount":0,"expired_at":"2099-12-31","max_uses_per_user":0}'
curl -s -X POST http://localhost:3000/api/admin/coupons \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"code":"USESNEG","type":"fixed","discount_value":10000,"min_order_amount":0,"expired_at":"2099-12-31","max_uses_per_user":-5}'
curl -s http://localhost:3000/api/coupons -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: both rejected (400).
# Actual (verified by running the two calls above against a live instance):
#  - USES0:   200 OK, but max_uses_per_user is silently coerced to 1 — `0` is falsy in JS, so
#    `max_uses_per_user || 1` at server.js:474 rewrites it before insert. No error is returned,
#    so the admin has no idea their input was silently changed.
#  - USESNEG: 200 OK, max_uses_per_user stored as -5 verbatim — a negative number is truthy in JS,
#    so it passes straight through the `|| 1` fallback unchanged.
```

## Suggested Fix
In `server.js:457-465`, explicitly validate `Number.isInteger(max_uses_per_user) && max_uses_per_user >= 1` before the insert, rather than relying on the `|| 1` fallback (which only catches falsy values like `0`/`undefined`, not negative numbers).
