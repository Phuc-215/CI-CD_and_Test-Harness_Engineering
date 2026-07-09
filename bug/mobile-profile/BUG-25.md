# [BUG-25][FR-MB] — Backend does not validate phone number format at all

## Description
`PUT /api/users/me` writes the `phone` field to the database with no format check whatsoever. The only phone validation anywhere in the system is the (already broken/inverted, see BUG-23) client-side regex in the mobile app — any client bypassing that check, or calling the API directly, can set an arbitrary string as the phone number: too short, too long, wrong leading digit, or containing letters.

## Environment
- Component: `backend` (Node.js + Express 5)
- Start: `cd backend && node server.js` (`http://localhost:3000`)
- Requires an authenticated user token (e.g. `test@eshop.com` / `Test1234!`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 118–131 (`PUT /api/users/me` — `phone` written to `UPDATE` with no validation) |

## Affect Level
**HIGH**

## Steps to Reproduce (CLI)
```bash
cd CI-CD_and_Test-Harness_Engineering/backend
node server.js &

TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@eshop.com","password":"Test1234!"}' | node -e \
  "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

# Wrong leading digit (spec requires leading 0) — verified live, accepted
curl -s -X PUT http://localhost:3000/api/users/me -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"name":"Test","shipping_address":"x","phone":"1912345678"}'
curl -s http://localhost:3000/api/users/me -H "Authorization: Bearer $TOKEN"
# Actual: phone: "1912345678" stored as-is, 200 OK — no rejection.

# Also try: too short (091234567), too long (091234567890), letters (09123456ab)
# — all are accepted identically, since server.js never checks the field.
```

## Suggested Fix
In `server.js:118-131`, validate `phone` against `/^0\d{9,10}$/` (matching the spec: leading `0`, 10–11 digits total) before running the `UPDATE`; return `400 Bad Request` if it fails. This closes the gap left by the mobile-only, currently-broken client-side check in BUG-23.
