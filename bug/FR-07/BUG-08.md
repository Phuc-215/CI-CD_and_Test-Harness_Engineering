# [BUG-08][FR-07] — No +/- quantity control in the cart

## Description
FR-07 specifies a "Quantity" column with +/- buttons to adjust quantity directly in the cart. `Cart.jsx` renders `{item.quantity}` as static text with no button, input, or handler to change it. Quantity can only ever be set once, at add-to-cart time on the product detail page — it is fixed for the lifetime of the cart entry.

## Environment
- Component: `frontend-web` (React)
- Route: `/cart`
- Dev server: `npm run dev` (default `http://localhost:5173`)

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-web/src/pages/Cart.jsx` | 47 (`<td>{item.quantity}</td>` — plain text, no interactive control) |
| `frontend-web/src/context/CartContext.jsx` | 5–37 (no `updateQuantity`/`incrementQuantity` function exists in the context at all) |

## Affect Level
**HIGH**

## Steps to Reproduce (CLI)
Purely a missing-feature/UI defect — confirm from source:
```bash
grep -n "quantity\|updateQuantity\|increment\|decrement" \
  CI-CD_and_Test-Harness_Engineering/frontend-web/src/context/CartContext.jsx \
  CI-CD_and_Test-Harness_Engineering/frontend-web/src/pages/Cart.jsx
# Expected: a mutator function (e.g. updateQuantity) and +/- buttons wired to it in Cart.jsx.
# Actual: only addToCart/removeFromCart/clearCart in the context; Cart.jsx only reads item.quantity as text.
```
UI confirmation: add a product to the cart, go to `/cart` — there is no way to change its quantity except removing it and re-adding with a different quantity from the product page.

## Suggested Fix
Add an `updateQuantity(index, newQuantity)` function to `CartContext.jsx` that maps over `cart` and replaces the matching item's `quantity` (clamped to `>= 1`). In `Cart.jsx:47`, replace the static text with a `-` button, the quantity value, and a `+` button calling `updateQuantity`.
