# [BUG-07][FR-07] — Adding a duplicate product never merges into the existing row

## Description
FR-07 requires that adding a product already present in the cart increases its quantity rather than creating a new row. `CartContext.jsx` always appends a new entry (`setCart([...cart, {...product, quantity}])`) with no check for an existing matching `id` — neither client-side nor via the backend, which likewise just pushes to an array. Adding the same product twice results in two separate rows, each with quantity 1, instead of one row with quantity 2.

## Environment
- Component: `frontend-web` (state) + `backend` (API, for the equivalent server-side behavior)
- Frontend dev server: `npm run dev` (default `http://localhost:5173`)
- Backend: `cd backend && node server.js` (`http://localhost:3000`)
- The Web UI never actually calls the cart API (see BUG-11's root cause) — the client-side defect below is verified from `CartContext.jsx` directly and reproduced live on the API path, which shows the same missing-merge behavior at the backend layer.

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-web/src/context/CartContext.jsx` | 8–10 (`addToCart` — unconditional append, no `id` lookup) |
| `backend/server.js` | 290–295 (`POST /api/cart` — `userCarts[userId].push(req.body)`, unconditional) |

## Affect Level
**HIGH**

## Steps to Reproduce (CLI)
```bash
cd CI-CD_and_Test-Harness_Engineering/backend
node server.js &

TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@eshop.com","password":"Test1234!"}' | node -e \
  "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

# Add the same product id twice
curl -s -X POST http://localhost:3000/api/cart -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"id":1,"name":"Test","price":1000,"quantity":1}'
curl -s -X POST http://localhost:3000/api/cart -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"id":1,"name":"Test","price":1000,"quantity":1}'

curl -s http://localhost:3000/api/cart -H "Authorization: Bearer $TOKEN"
# Expected: one entry, {"id":1,...,"quantity":2}
# Actual: two separate entries, each {"id":1,...,"quantity":1}
```

## Suggested Fix
Client-side: in `CartContext.jsx:8-10`, look up an existing item by `product.id` in `cart` first; if found, return a new array with that item's `quantity` incremented instead of appending. Server-side: in `server.js:290-295`, do the equivalent lookup in `userCarts[userId]` by product id before pushing.
