# [BUG-22][FR-MB] — Privilege escalation: a normal user can self-assign `role: admin` via the profile update endpoint

## Description
FR-04 states a user must not be able to change their own `role`, and SEC-06 states the profile-update API must never allow the `role` field to be changed from the client. The handler for `PUT /api/users/me` does the opposite: it reads `role` from `req.body` and, if present, appends `, role = ?` to the `UPDATE` statement and writes it. Any authenticated user — including one who just self-registered through the completely unvalidated FR-01 registration flow (see `bug/FR-01/BUG-04.md`) — can send a single request with `"role":"admin"` and become an administrator. Combined with the fact that every `/api/admin/*` route only checks `authenticateToken` and never checks `role === 'admin'` (see the cross-cutting note in FR-17's testing report), this is a complete, one-request account-takeover path from a freshly created, unprivileged account. This is the most severe bug found across the entire test pass.

## Environment
- Component: `backend` (Node.js + Express 5 + sqlite3)
- Start: `cd backend && node server.js` (`http://localhost:3000`)
- Requires only a normal, authenticated user token (e.g. seeded account `test@eshop.com` / `Test1234!`, or any freshly self-registered account)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 118–131 (`PUT /api/users/me` — destructures `role` from `req.body` at line 119, conditionally appends `role = ?` to the update query at lines 124–126 whenever `role` is truthy) |

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

# Send a normal-looking profile update, but slip in role: admin
curl -s -X PUT http://localhost:3000/api/users/me -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test User","shipping_address":"123 St","phone":"0912345678","role":"admin"}'
# Actual: 200 {"message":"Profile updated"}

curl -s http://localhost:3000/api/users/me -H "Authorization: Bearer $TOKEN"
# Actual: {"id":2,...,"role":"admin",...}  <-- account is now admin, confirmed live.

# Revert immediately so shared test data isn't left in a corrupted state:
curl -s -X PUT http://localhost:3000/api/users/me -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test User","shipping_address":"123 St","phone":"0912345678","role":"user"}'
```
Verified live against a real running instance on 2026-07-09; the account was reverted back to `role: user` immediately after confirmation.

## Suggested Fix
In `server.js:118-131`, remove `role` from the destructured/writable fields entirely — `PUT /api/users/me` should only ever update `name`, `shipping_address`, and `phone` for the authenticated user (`req.user.id`). Role changes, if ever needed, must go through a separate admin-only endpoint that itself properly checks `req.user.role === 'admin'` (see the related finding on `/api/admin/*` routes never checking role).
