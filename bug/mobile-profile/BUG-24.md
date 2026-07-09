# [BUG-24][FR-MB] — Shipping address silently wiped on every mobile profile save (field-name mismatch)

## Description
The mobile app sends the profile update payload as `{ name, phone, shippingAddress }` (camelCase). The backend's `PUT /api/users/me` handler reads `shipping_address` (snake_case) from `req.body`. Since the key never matches, the destructured `shipping_address` is always `undefined`, and the `UPDATE` statement writes `NULL` into that column on **every single mobile profile save** — while the app still shows "Cập nhật thành công!" (optimistic local state update), so the user has no indication their shipping address was just erased server-side. They'd only discover it at checkout, when the address is missing.

## Environment
- Component: `frontend-mobile` (React Native / Expo) + `backend` (Node.js + Express 5)
- Start backend: `cd backend && node server.js` (`http://localhost:3000`)
- No physical device/emulator available in this session — verified by replaying the exact request payload the mobile code constructs (`App.js:302`) against the live API, which is a faithful reproduction since it's the same final HTTP request the app sends.

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-mobile/App.js` | 302 (`body: JSON.stringify({ name, phone, shippingAddress })` — camelCase key) |
| `backend/server.js` | 118–119 (`const { name, shipping_address, phone, role } = req.body;` — snake_case key, never matches what mobile sends) |

## Affect Level
**CRITICAL**

## Steps to Reproduce (CLI)
```bash
cd CI-CD_and_Test-Harness_Engineering/backend
node server.js &

TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@eshop.com","password":"Test1234!"}' | node -e \
  "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

# 1. Set a real address using the correct backend key first
curl -s -X PUT http://localhost:3000/api/users/me -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test User","shipping_address":"123 Real Address","phone":"0912345678"}'
curl -s http://localhost:3000/api/users/me -H "Authorization: Bearer $TOKEN"
# Actual: shipping_address: "123 Real Address" — confirmed saved correctly.

# 2. Now replay the EXACT payload shape the mobile app sends (camelCase shippingAddress)
curl -s -X PUT http://localhost:3000/api/users/me -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test User","shippingAddress":"999 Mobile Update Address","phone":"0912345678"}'
# Actual: 200 {"message":"Profile updated"} — app would show "Cập nhật thành công!" here.

curl -s http://localhost:3000/api/users/me -H "Authorization: Bearer $TOKEN"
# Actual (verified live): shipping_address: null  <-- silently wiped, despite the "success" response.
```
Verified live against a real running instance on 2026-07-09.

## Suggested Fix
Change `frontend-mobile/App.js:302` to send `shipping_address` (snake_case) to match what the backend actually reads — either rename the payload key at the call site, or (more robustly) have the backend accept both `shipping_address` and `shippingAddress` during a migration window. Also consider validating on the backend that expected fields are non-null before silently overwriting existing data with `undefined`/`null`.
