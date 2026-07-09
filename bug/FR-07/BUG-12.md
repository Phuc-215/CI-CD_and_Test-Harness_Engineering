# [BUG-12][FR-07] — Empty cart has no illustration

## Description
FR-07 requires the empty-cart state to include an illustration plus a clear message. `Cart.jsx`'s empty branch renders only a text heading and a "Tiếp tục mua sắm" link — no icon, SVG, or image of any kind.

## Environment
- Component: `frontend-web` (React)
- Route: `/cart` (with an empty cart)
- Dev server: `npm run dev` (default `http://localhost:5173`)

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-web/src/pages/Cart.jsx` | 20–27 (empty-cart early return — text + link only, no image/icon element) |

## Affect Level
**LOW**

## Steps to Reproduce (CLI)
```bash
grep -n "img\|svg\|icon" CI-CD_and_Test-Harness_Engineering/frontend-web/src/pages/Cart.jsx
# Expected: an <img>/<svg> in the empty-cart branch (lines 20-27).
# Actual: no matches — only <h2> text and a <Link>.
```
UI confirmation: with a fresh session (no items ever added, or after clearing cart), open `/cart` — only text and a link appear, no illustration.

## Suggested Fix
Add an illustrative `<img>` or inline SVG (e.g. an empty-box/cart icon) above the "Giỏ hàng của bạn đang trống" heading in `Cart.jsx:21-25`.
