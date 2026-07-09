# [BUG-11][FR-07] — Cart is lost on page reload or re-login

## Description
The cart is held entirely in a React Context's in-memory `useState([])`, with no `localStorage`/`sessionStorage` persistence and no call to `GET /api/cart` on mount to restore state from the server. A page reload (F5) or a logout/login cycle wipes the cart completely, even though a (unused) backend cart API exists that could persist it. This is not stated verbatim in the FR-07 spec text, but is a reasonable e-commerce baseline expectation and is flagged here as an inferred gap rather than a literal spec violation.

## Environment
- Component: `frontend-web` (React Context, no persistence layer)
- Route: `/cart`, or any route while cart has items
- Dev server: `npm run dev` (default `http://localhost:5173`)

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-web/src/context/CartContext.jsx` | 5–6 (`const [cart, setCart] = useState([])` — no init from `localStorage` or from `GET /api/cart`), whole file (no `useEffect` persisting/restoring cart) |

## Affect Level
**HIGH**

## Steps to Reproduce (CLI)
Client-state defect — confirm from source, then via the UI:
```bash
grep -n "localStorage\|useEffect\|api/cart" \
  CI-CD_and_Test-Harness_Engineering/frontend-web/src/context/CartContext.jsx
# Expected: persistence via localStorage and/or a GET /api/cart call on mount.
# Actual: no matches — cart is pure in-memory React state.
```
UI confirmation: add a product to the cart, press F5 (reload) — the cart is empty. Same result after logging out and back in.

## Suggested Fix
Either (a) persist `cart` to `localStorage` on every change and hydrate from it on mount, or (b) wire `CartContext` to the existing backend cart API (`GET/POST /api/cart`) so the cart survives reloads and is consistent across devices for a logged-in user — the latter also happens to be the fix that closes the integration gap noted across BUG-07 and BUG-13.
