# [BUG-03][FR-01] — Email field has no client-side format validation

## Description
FR-01 requires the email to be in valid `user@domain.tld` format. The Web registration form's email input uses `type="text"` (not `type="email"`) and has no regex or format check anywhere in the component — any string, including one without an `@`, is accepted client-side and forwarded to the backend as-is.

## Environment
- Component: `frontend-web` (React + Vite)
- Route: `/register`
- Dev server: `npm run dev` (default `http://localhost:5173`)

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-web/src/pages/Register.jsx` | 45–54 (email `<input type="text">`, no `onBlur`/regex validation) |

## Affect Level
**MEDIUM**

## Steps to Reproduce (CLI)
Client-only defect — confirm via source, then via the UI:
```bash
grep -n "type=\"text\"\|type=\"email\"\|email" CI-CD_and_Test-Harness_Engineering/frontend-web/src/pages/Register.jsx
# Expected: email input uses type="email" or a regex check before submit
# Actual: input type="text" (line 48), no validation logic referencing `email` anywhere in handleSubmit
```
UI confirmation: open `/register`, type `notanemail` in the Email field, submit — no client-side error appears; the request goes straight to the backend (which also does not validate it, see BUG-04).

## Suggested Fix
Change the input to `type="email"` for basic browser-level validation, and add an explicit regex check (e.g. `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) in `handleSubmit` before the `axios.post` call at line 23, consistent with the password check pattern already used at lines 17–20.
