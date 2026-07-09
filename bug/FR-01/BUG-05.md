# [BUG-05][FR-01] — Passwords stored in plaintext and echoed back verbatim on login (SEC-01)

## Description
Passwords are never hashed. `POST /api/register` inserts the raw password string into the `users.password` column, and `POST /api/login` authenticates by direct string comparison (`user.password === password`). Worse, the full `user` row — including the plaintext `password` field — is included in the JSON response body of a successful login. This is a credential-leak vulnerability: any component that logs, proxies, or caches the login response (browser devtools, a reverse proxy, an error-tracking tool) now holds the user's raw password.

## Environment
- Component: `backend` (Node.js + Express 5 + sqlite3)
- Start: `cd backend && node server.js` (`http://localhost:3000`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 24 (plaintext `password` inserted on register), 46 (plaintext comparison on login), 52 (`res.json({ message, token, user })` — `user` includes `password`) |

## Affect Level
**CRITICAL**

## Steps to Reproduce (CLI)
```bash
cd CI-CD_and_Test-Harness_Engineering/backend
node server.js &

# 1. Register a new account
curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Plain Test","email":"plaintest@example.com","password":"Aa1@aaaa"}'

# 2. Log in and inspect the response body
curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"plaintest@example.com","password":"Aa1@aaaa"}'
# Expected: user object with no password field.
# Actual: {"message":"Login successful","token":"...","user":{"id":N,...,"password":"Aa1@aaaa",...}}
```

## Suggested Fix
1. Hash passwords with `bcrypt` (or similar) before the `INSERT` in `POST /api/register` (`server.js:20-30`).
2. Replace the direct comparison at `server.js:46` with `bcrypt.compare(password, user.password)`.
3. Strip `password` from the `user` object before sending it in any response (`server.js:52` and the `GET /api/users/me` handler) — e.g. `const { password, ...safeUser } = user;` and return `safeUser`.
