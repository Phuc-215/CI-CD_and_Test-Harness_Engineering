# [BUG-09][FR-07] — Delete button has no confirmation dialog

## Description
FR-07 requires a confirmation dialog before a product is removed from the cart. `Cart.jsx`'s delete button calls `removeFromCart(index)` directly on click, which immediately calls `Array.prototype.splice` on the cart state — there is no `window.confirm()`, no modal, no intermediate step of any kind (confirmed by grepping the whole repo for `confirm(` — no match in the cart flow).

## Environment
- Component: `frontend-web` (React)
- Route: `/cart`
- Dev server: `npm run dev` (default `http://localhost:5173`)

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-web/src/pages/Cart.jsx` | 50–55 (`<button onClick={() => removeFromCart(index)}>Xóa</button>`) |
| `frontend-web/src/context/CartContext.jsx` | 12–16 (`removeFromCart` — calls `splice` unconditionally) |

## Affect Level
**HIGH**

## Steps to Reproduce (CLI)
```bash
grep -rn "confirm(" CI-CD_and_Test-Harness_Engineering/frontend-web/src/
# Expected: a confirm()/modal guarding removeFromCart.
# Actual: no matches anywhere in the removeFromCart call path.
```
UI confirmation: add a product to the cart, go to `/cart`, click "Xóa" — the row disappears immediately with no confirmation prompt.

## Suggested Fix
Wrap the click handler in `Cart.jsx:51` with a confirmation step, e.g. `onClick={() => { if (window.confirm('Xóa sản phẩm này khỏi giỏ hàng?')) removeFromCart(index); }}`, or replace with a proper modal component for a better UX than the native `confirm()`.
