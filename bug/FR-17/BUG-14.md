# [BUG-14][FR-17] — `type` is not restricted to `percent`/`fixed` server-side

## Description
FR-17 specifies `type` must be one of `percent` or `fixed`. The Web admin form limits input via a `<select>` with only those two options, but `POST /api/admin/coupons` never checks the value it receives — any string is inserted directly into the `coupons.type` column. A client bypassing the UI can create a coupon with an arbitrary, meaningless `type`.

## Environment
- Component: `backend` (Node.js + Express 5), admin-authenticated endpoint
- Start: `cd backend && node server.js` (`http://localhost:3000`)
- Requires an admin token (seeded account: `admin@eshop.com` / `Admin123!`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 457–465 (`POST /api/admin/coupons` — destructures `type` with no enum check before insert) |
| `frontend-admin/src/App.jsx` | 649–658 (client `<select>` limits UI input, but provides no server-side backstop) |

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
  -d '{"code":"BADTYPE","type":"giamgia","discount_value":10,"min_order_amount":0,"expired_at":"2099-12-31","max_uses_per_user":1}'
# Expected: rejection (400, type must be percent or fixed).
# Actual: 200 {"message":"Coupon created","id":N}
```

## Suggested Fix
In `server.js:457-465`, validate `type === 'percent' || type === 'fixed'` before the `db.run` insert; return `400 Bad Request` otherwise.
