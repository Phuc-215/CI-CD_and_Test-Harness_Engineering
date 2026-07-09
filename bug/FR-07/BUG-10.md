# [BUG-10][FR-07] — Wrong total label: "Tổng tạm tính" instead of "Tổng cộng"

## Description
FR-07 explicitly names the label the total-price row must use — "Tổng cộng" — and explicitly calls out "Tổng tạm tính" as the label to avoid. `Cart.jsx` renders exactly the forbidden label. This is a direct, literal spec violation (not an inference).

## Environment
- Component: `frontend-web` (React)
- Route: `/cart`
- Dev server: `npm run dev` (default `http://localhost:5173`)

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-web/src/pages/Cart.jsx` | 62–64 (`Tổng tạm tính: <span>...`) |

## Affect Level
**MEDIUM**

## Steps to Reproduce (CLI)
```bash
grep -n "Tổng" CI-CD_and_Test-Harness_Engineering/frontend-web/src/pages/Cart.jsx
# Expected: "Tổng cộng"
# Actual (line 63): "Tổng tạm tính: <span ...>{cartTotal.toLocaleString()} ₫</span>"
```
UI confirmation: add a product to the cart and open `/cart` — the total row reads "Tổng tạm tính".

## Suggested Fix
Change the literal string in `Cart.jsx:63` from `Tổng tạm tính` to `Tổng cộng`.
