# [BUG-21][FR-17] — Delete coupon button has no confirmation dialog

## Description
The admin coupon table's delete button calls `axios.delete` directly from the `onClick` handler with no confirmation step. Clicking "Xóa" removes the coupon immediately and irreversibly — a mis-click deletes a live, possibly-in-use coupon with no chance to cancel.

## Environment
- Component: `frontend-admin` (React + Vite)
- Route: Admin dashboard → "Mã Giảm Giá" tab
- Dev server: `npm run dev` (Vite default port, typically `http://localhost:5174` alongside the other frontends)

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-admin/src/App.jsx` | 754–768 (delete button `onClick` — calls `axios.delete` immediately, no `window.confirm()`/modal) |

## Affect Level
**MEDIUM**

## Steps to Reproduce (CLI)
```bash
grep -n "confirm(" CI-CD_and_Test-Harness_Engineering/frontend-admin/src/App.jsx
# Expected: a confirm()/modal guarding the coupon delete handler (around line 756-765).
# Actual: no matches in the file at all — no confirmation exists for any delete action, coupons included.
```
UI confirmation: log in as admin, open the "Mã Giảm Giá" tab, click "Xóa" next to any coupon — it is deleted immediately with no prompt.

## Suggested Fix
Wrap the `onClick` handler at `App.jsx:756` with a confirmation check, e.g. `if (!window.confirm('Xóa mã giảm giá này?')) return;` before calling `axios.delete`.
