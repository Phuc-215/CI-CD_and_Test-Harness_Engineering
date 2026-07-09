# [BUG-02][FR-01] — Web password regex requires whitespace instead of a special character

## Description
FR-01 requires the password to contain at least one uppercase letter, one lowercase letter, one digit, and one special character from the set `@$!%*?&`. The Web client's regex instead requires a **whitespace character** (`\s`) and its character class `[A-Za-z\d\s]` **excludes** every allowed special character. A spec-valid password such as `Aa1@aaaa` is rejected client-side, while the displayed error text still says "cần ký tự đặc biệt" (needs a special character) — the message and the actual logic disagree, which is actively misleading to the user (there is no way to satisfy the stated requirement through the UI, since typing a space passes but is not what the message asks for).

## Environment
- Component: `frontend-web` (React + Vite)
- Route: `/register`
- Dev server: `npm run dev` (default `http://localhost:5173`)
- Purely client-side logic — no backend interaction needed to reproduce.

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-web/src/pages/Register.jsx` | 15 (regex definition), 17–20 (check + error message), 64–66 (displayed hint text) |

## Affect Level
**HIGH**

## Steps to Reproduce (CLI)
This is client-side validation, so the fastest reproduction is evaluating the exact regex used in the code:
```bash
node -e '
const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\s)[A-Za-z\d\s]{8,}$/;
console.log("Aa1@aaaa ->", re.test("Aa1@aaaa"));   // spec-valid password, expect true, actual false
console.log("Aa1 aaaa ->", re.test("Aa1 aaaa"));   // contains a space instead of @, expect false, actual true
'
```
UI confirmation: open `/register`, fill in a spec-compliant password like `Aa1@aaaa`, submit — the form blocks it with "Mật khẩu quá yếu! ... KÝ TỰ ĐẶC BIỆT" even though `@` is a valid special character.

## Suggested Fix
Replace the regex in `Register.jsx:15` with one that matches the spec's allowed special-character set, e.g.:
```js
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
```
This should also be the exact rule the backend enforces server-side (see BUG-04), so both layers agree.
