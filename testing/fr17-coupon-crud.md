# FR-17 — Coupon CRUD (Admin): Domain Testing & BVA

Spec (README FR-17): admin can Add/View/Delete coupons (no Edit). Required fields: `code` (unique), `type` (percent/fixed), `discount_value` (positive), `min_order_amount` (>=0), `expired_at`, `max_uses_per_user` (>=1). Endpoint: `POST /api/admin/coupons`.

## Variables and domains

Six variables on one form — each tested in isolation, keeping the rest valid:

| Variable | Valid domain |
|---|---|
| code | unique string |
| type | enum: percent \| fixed |
| discount_value | > 0 (and, by business logic though not stated in the spec, <= 100 when type=percent) |
| min_order_amount | >= 0 |
| max_uses_per_user | >= 1, integer |
| expired_at | valid date |

## Test design

| Case | Field under test | Value | Expected |
|---|---|---|---|
| CD1 | code | `SAVE10` (already seeded) | Reject — duplicate |
| CD5 | type | `"giamgia"` (outside enum) | Reject |
| CD6 | discount_value | `-10` | Reject |
| CD7 | discount_value | `0` | Reject |
| CD8 | discount_value (percent) | `500` | Reject (business logic — not explicit in spec) |
| CD9 | min_order_amount | `-500` | Reject |
| CD11 | max_uses_per_user | `0` | Reject |
| CD12 | max_uses_per_user | `-5` | Reject |
| CD13 | expired_at | `2020-01-01` (past) | Flag for clarification — should creating an already-expired coupon be allowed? |
| CD14 | expired_at | `"abc"` (not a date) | Reject |

BVA around discount_value's business-inferred upper bound (100 for percent):

| Case | discount_value | Expected |
|---|---|---|
| B2 | 1 | Accept |
| B3 | 100 | Accept |
| B4 | 101 | Reject (inferred, not written in spec) |

## Execution

Logged in as admin, called `POST /api/admin/coupons` directly for each case.

| Case | Result |
|---|---|
| CD1 (duplicate code) | **500**, `SQLITE_CONSTRAINT: UNIQUE constraint failed: coupons.code` — correctly rejected at the DB level, but leaks a raw SQL error with the wrong status code (should be 409 with a clean message) |
| CD5–CD9, CD11–CD14 | **200 OK — all accepted** |
| B2, B3 | 200 OK, accepted (correct) |
| B4 (discount_value=101) | **200 OK — accepted** (should be capped at 100 for percent type) |

## Bugs found

1. `type` isn't restricted to `percent`/`fixed` server-side — `"giamgia"` gets stored as-is.
2. `discount_value` accepts negative and zero.
3. No cap on `discount_value` for percent coupons — 101%, 500% all accepted. This can drive `final_amount` negative in the checkout/coupon calculation (FR-09), so it's a shared concern between the two features.
4. `min_order_amount` accepts negative values.
5. `max_uses_per_user` accepts 0 and negative values.
6. `expired_at` accepts past dates and non-date strings (`"abc"` gets written straight into a `DATETIME` column).
7. Duplicate `code` *is* correctly blocked (DB has a real `UNIQUE` constraint) but the error handling is bad: raw SQL error message, HTTP 500 instead of 409.
8. Delete has no confirmation dialog (`frontend-admin/src/App.jsx` calls `axios.delete` straight from the click handler).

Cross-cutting note, found while testing this feature but out of its scope: every `/api/admin/*` route only checks `authenticateToken`, never `role === 'admin'`. Any logged-in user can hit these coupon endpoints directly. Belongs to FR-12 (Access Control), flagging here since it's how it surfaced.
