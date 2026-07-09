# [BUG-13][FR-07] — Backend `POST /api/cart` accepts negative/zero/decimal quantity

## Description
`POST /api/cart` pushes `req.body` into the in-memory cart array with no validation on `quantity` — negative numbers, zero, and non-integer (decimal) values are all accepted and stored as-is. This is currently unreachable through the Web UI, since the frontend cart never calls this endpoint at all (see BUG-07/BUG-11 — the two halves of the feature are not integrated), which is why this is rated low severity rather than high. It remains a real gap that would surface immediately if the endpoint is ever wired up to the UI or hit directly by another client.

## Environment
- Component: `backend` (Node.js + Express 5)
- Start: `cd backend && node server.js` (`http://localhost:3000`)

## Location in Codebase
| File | Range Line |
|---|---|
| `backend/server.js` | 290–295 (`POST /api/cart` — pushes `req.body` with no field validation) |

## Affect Level
**LOW**

## Steps to Reproduce (CLI)
```bash
cd CI-CD_and_Test-Harness_Engineering/backend
node server.js &

TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@eshop.com","password":"Test1234!"}' | node -e \
  "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

for Q in -1 0 1.5; do
  curl -s -X POST http://localhost:3000/api/cart -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" -d "{\"id\":1,\"name\":\"Test\",\"price\":1000,\"quantity\":$Q}"
done
curl -s http://localhost:3000/api/cart -H "Authorization: Bearer $TOKEN"
# Expected: all three rejected (400).
# Actual: all three return 200 {"message":"Added to cart"} and are stored verbatim, including quantity: -1 and 1.5.
```

## Suggested Fix
In `server.js:290-295`, validate `req.body.quantity` is an integer `>= 1` before pushing; return `400 Bad Request` otherwise. Should be fixed alongside wiring the frontend to actually use this endpoint (BUG-07/BUG-11), at which point this becomes user-reachable and its severity should be re-evaluated.
