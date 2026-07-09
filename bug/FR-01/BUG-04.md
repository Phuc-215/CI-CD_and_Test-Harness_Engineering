# [BUG-04][FR-01] — Backend `POST /api/register` performs zero validation

## Description
Every constraint in FR-01 (password length/complexity, email format, email uniqueness) is enforced only in the Web client (and even there, incorrectly — see BUG-01/02/03). The backend handler for `POST /api/register` inserts whatever it receives directly into the `users` table with no checks at all. Any client that bypasses the UI (curl, Postman, devtools, a different frontend) can register with an empty password, a malformed email, or a duplicate email. This is the most severe functional gap in FR-01 because client-side validation is the *only* line of defense and it is trivially bypassable.

## Environment
- Component: `backend` (Node.js + Express 5 + sqlite3)
- Start: `cd backend && node server.js` (listens on `http://localhost:3000`, port hardcoded in `server.js:8`)
- No auth/token required — `POST /api/register` is a public endpoint.

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 20–30 (`POST /api/register` handler — destructures `name/email/password` and inserts directly, no checks) |

## Affect Level
**CRITICAL**

## Steps to Reproduce (CLI)
```bash
cd CI-CD_and_Test-Harness_Engineering/backend
node server.js &   # starts on http://localhost:3000

# 1. Empty/weak password, no uppercase/digit/special char — spec requires rejection
curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test D8","email":"d8test@example.com","password":""}'
# Expected: 4xx rejection. Actual: 200 {"message":"User registered successfully","id":N}

# 2. Malformed email — spec requires rejection
curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test E2","email":"notanemail","password":"anything"}'
# Actual: 200 OK, user created with an invalid email.

# 3. Duplicate email (test@eshop.com is seeded on startup, see database.js:93)
curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Duplicate","email":"test@eshop.com","password":"anything"}'
# Expected: rejection (email already registered). Actual: 200 OK, a second user row with the same email is created.
```

## Suggested Fix
In the `POST /api/register` handler (`server.js:20`), before the `db.run` insert:
1. Validate `password` against the spec regex (len ≥ 8, upper/lower/digit/`@$!%*?&`).
2. Validate `email` format with a regex.
3. Query `users` for an existing row with the same `email` first (or rely on a DB `UNIQUE` constraint, see BUG-06) and return `409 Conflict` if found.
4. Return `400 Bad Request` with a clear message for any failed check, and only call `db.run` once all checks pass.
