# [BUG-01][FR-01] — Missing "Confirm Password" field on the Web registration form

## Description
FR-01 requires the registration form to have a "Confirm Password" field, and the system must reject submission when it doesn't match the "Password" field. The actual Web registration form (`Register.jsx`) renders only a single password input — there is no second field and no comparison logic anywhere in the component.

## Environment
- Component: `frontend-web` (React + Vite)
- Route: `/register`
- Dev server: `npm run dev` (Vite, default `http://localhost:5173`)
- Backend not required to reproduce — this is a pure UI/markup defect.

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-web/src/pages/Register.jsx` | 5–83 (whole component — only one password `<input>` at 56–66, no second field exists) |

## Affect Level
**HIGH**

## Steps to Reproduce (CLI)
No API call can reproduce a missing UI field — verify directly from the source, or render the page:
```bash
# Confirm there is only one password input and no confirmPassword state in the file
grep -n "password" CI-CD_and_Test-Harness_Engineering/frontend-web/src/pages/Register.jsx
# Expected: a "Confirm Password" input/state; Actual: only `password`/`setPassword` (line 8),
# one <input type="password"> (line 58), no second input, no mismatch check.
```
UI confirmation: start the app (`cd frontend-web && npm run dev`), open `/register`, and observe the form only has "Họ Tên", "Email", "Mật khẩu".

## Suggested Fix
Add a `confirmPassword` state and a second `<input type="password">` field in `Register.jsx`. In `handleSubmit`, before calling the API, reject (set an error and `return`) when `password !== confirmPassword`, mirroring the existing regex-check pattern at lines 15–20.
