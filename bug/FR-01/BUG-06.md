# [BUG-06][FR-01] — No `UNIQUE` constraint on `users.email`

## Description
FR-01 requires the email to be unique system-wide. The `users` table schema declares `email TEXT` with no `UNIQUE` constraint, so nothing at the database layer prevents duplicate rows — combined with the missing application-level check (BUG-04), registering the same email twice succeeds silently and creates two independent user rows.

## Environment
- Component: `backend` (sqlite3 schema, `database.sqlite`)
- Start: `cd backend && node server.js` (schema created on first run in `database.js`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/database.js` | 50–61 (`CREATE TABLE users (... email TEXT ...)` — no `UNIQUE` modifier on the `email` column) |

## Affect Level
**HIGH**

## Steps to Reproduce (CLI)
```bash
cd CI-CD_and_Test-Harness_Engineering/backend
node server.js &

# test@eshop.com is seeded on first startup (database.js:93)
curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Second Test User","email":"test@eshop.com","password":"Aa1@aaaa"}'
# Expected: rejection (409/400, email already exists).
# Actual: 200 {"message":"User registered successfully","id":N} — a second row with the same email exists.

sqlite3 database.sqlite "SELECT id, email FROM users WHERE email='test@eshop.com';"
# Actual: two or more rows returned for the same email.
```
(If `sqlite3` CLI isn't installed, confirm via `GET /api/admin/users` with an admin token instead.)

## Suggested Fix
Add `UNIQUE` to the `email` column in `database.js:53`: `email TEXT UNIQUE`. Since this only fires once the table already exists with duplicate data, this must be paired with an app-level pre-check (BUG-04) that returns a clean `409 Conflict` — otherwise a raw `SQLITE_CONSTRAINT` error will leak to the client (the same failure mode observed for coupon codes in BUG-20).
