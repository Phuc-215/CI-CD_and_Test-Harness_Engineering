# Mobile — Profile: Domain Testing & BVA

Spec (README FR-04, applies to mobile per FR-20): user can update name, phone, shipping address. Phone must start with '0', 10-11 digits. Email is read-only. User must not be able to change their own `role`. Endpoint: `PUT /api/users/me`.

## Variables and domains

| Variable | Valid domain |
|---|---|
| phone | starts with '0', 10-11 digits total |
| request body shape | must only contain `name`, `phone`, `shipping_address` — `role` must never be an accepted key, regardless of value |

The `role` field deserves its own domain-testing angle: it's not about what value is sent, it's about whether the field is allowed to exist in the request at all.

## Test design

Phone (BVA on length, n=10-11, spec domain):

| Case | phone | Expected |
|---|---|---|
| P1 | `0912345678` (10 digits, leading 0) | Accept |
| P3 | `1912345678` (10 digits, no leading 0) | Reject |
| P4 | `091234567` (9 digits) | Reject |
| P5 | `091234567890` (12 digits) | Reject |
| P6 | `09123456ab` (letters) | Reject |

Request shape:

| Case | Payload | Expected |
|---|---|---|
| R2 | `{name, phone, shipping_address, role: "admin"}` | `role` must be ignored server-side, or the request rejected |

## Execution

Called `PUT /api/users/me` directly with a normal user's token.

- P1: accepted (correct).
- P3, P4, P5, P6: **all accepted** — no server-side phone validation at all.
- R2: logged in as `test@eshop.com` (role `user`), sent `{"role":"admin", ...}` → `200 OK`. Followed up with `GET /api/users/me` → **role was actually `admin`**. Reverted the account back to `role: user` immediately after confirming.
- Also tried the exact payload shape the mobile app sends (`{name, phone, shippingAddress}` — camelCase) after first setting a real shipping address via the correct key: the address came back `null` afterward, even though the API still returned "Profile updated".

## Bugs found

1. **Privilege escalation via profile update.** `server.js` reads `role` from `req.body` and writes it to the DB whenever present — no check that the caller is only allowed to touch their own non-privileged fields. A normal user becomes admin with a single request. This is the most severe bug across the whole test pass; combined with the missing admin-role check on `/api/admin/*` routes (see FR-17 report), it's a full account-takeover path from a freshly self-registered account.
2. **Mobile phone regex is inverted from spec.** `App.js` uses `/^[1-9][0-9]{8,9}$/` — requires the first digit to be 1-9 (rejects a leading 0) and 9-10 digits total. A spec-valid number like `0912345678` gets rejected by the app itself; a spec-invalid one like `912345678` passes.
3. **Shipping address silently wiped on every mobile profile save.** The mobile app sends `shippingAddress` (camelCase); the backend reads `shipping_address` (snake_case). The key never matches, so the column gets set to `NULL` on every save while the app still shows "Cập nhật thành công!" — confirmed by sending the exact payload shape the app produces.
4. **No server-side phone validation** — format is enforced nowhere but the (broken) mobile regex.
5. **Unhelpful error messaging** — any failure surfaces the same generic "Lỗi cập nhật" regardless of the actual server response.

## Environment limitation

No Android/iOS emulator or Expo Go device was available to drive the mobile UI directly in this session. Findings above come from reading `frontend-mobile/App.js` plus replaying the exact request payloads it constructs against the live API — reliable for request/response behavior, but visual/interaction aspects of the mobile UI haven't been checked by hand yet.
