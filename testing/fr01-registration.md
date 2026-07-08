# FR-01 — Registration: Domain Testing & BVA

Spec (README FR-01): name, email, password required. Email must be valid format and unique. Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char from `@$!%*?&`. Must have a confirm-password field that rejects mismatches. Endpoint: `POST /api/register`.

## Variables and domains

| Variable | Valid domain |
|---|---|
| password | len >= 8 AND has uppercase AND has lowercase AND has digit AND has one of `@$!%*?&` |
| email | valid `user@domain.tld` format, not already registered |
| confirmPassword | must equal password |
| name | non-empty |

Password has 5 conditions ANDed together — classic domain testing setup: isolate one condition at a time (on/off point), keep the rest valid, so a failure points at exactly one boundary.

## Test design

### Password (each case violates exactly one condition)

| Case | password | Violates | Expected |
|---|---|---|---|
| D1 | `Aa1@aaaa` (8 chars) | none — baseline | Accept |
| D2 | `Aa1@aaa` (7 chars) | length | Reject |
| D3 | `aa1@aaaa` | no uppercase | Reject |
| D4 | `AA1@AAAA` | no lowercase | Reject |
| D5 | `Aaa@aaaa` | no digit | Reject |
| D6 | `Aa1Xaaaa` | no special char | Reject |
| D7 | `Aa1#aaaa` | special char outside allowed set | Reject |
| D8 | `` (empty) | everything | Reject |

### Email

| Case | email | Expected |
|---|---|---|
| E2 | `notanemail` | Reject |
| E3 | `user@domain` (no TLD) | Reject |
| E4 | `test@eshop.com` (already seeded) | Reject (duplicate) |

### Length boundary (BVA on password length, n=8)

| Case | len | Expected |
|---|---|---|
| B1 | 7 | Reject |
| B2 | 8 | Accept |
| B3 | 9 | Accept |

No max length is specified anywhere for name/email/password. Two exploratory cases instead of guessing a number:
- name = 500 chars, password = 1000 chars → should not error/crash, since spec sets no cap.

## Execution

Ran directly against `POST /api/register` (backend on a local port, bypassing the UI to test the API surface directly).

| Case | Result |
|---|---|
| D1 | 200 OK — accepted (correct) |
| D2–D8 | **200 OK — all accepted** (should all have been rejected) |
| E2–E4 | **200 OK — all accepted** (should all have been rejected) |
| name=500 chars, password=1000 chars | 200 OK, no crash (fine, no cap was specified) |

Also logged in with the D1 account and checked the response body: it echoes the password back in plaintext (`user.password` field).

## Bugs found

1. **No confirm-password field in the Web UI at all.** `Register.jsx` has a single password input with no comparison logic. Can't satisfy the spec's mismatch-rejection requirement because the field doesn't exist.
2. **Web password regex is broken.** `Register.jsx` uses `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\s)[A-Za-z\d\s]{8,}$/` — requires a whitespace character instead of a special character, and the character class excludes `@$!%*?&` entirely. A spec-compliant password like `Aa1@aaaa` gets rejected client-side, while the error message still says "needs a special character."
3. **Email has no format check client-side** (`type="text"`, no regex).
4. **Backend performs zero validation.** `POST /api/register` inserts whatever it's given — no length/complexity check, no email format check, no uniqueness check. Confirmed by the D2–D8/E2–E4 results above.
5. **Passwords stored and returned in plaintext.** Login compares `user.password === password` directly and the login response includes the raw password field. No hashing anywhere.
6. **No unique constraint on `users.email`** — `database.js` schema has `email TEXT` with no `UNIQUE`, so duplicate registrations succeed silently.

Note: mobile registration (`frontend-mobile/App.js`) uses a different, mostly-correct regex (`[^A-Za-z\d]` for special char) but also has no confirm-password field. Out of scope here (this report covers the web flow only) but worth a follow-up ticket.
