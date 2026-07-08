# FR-07 — Shopping Cart: Domain Testing & BVA

Spec (README FR-07): columns Product/Unit price/Quantity (+/- buttons)/Subtotal/Actions. Adding the same product again should increase quantity, not add a new row. Delete needs a confirm dialog. "Continue shopping" button back to home. Total label must read "Tổng cộng" (not "Tổng tạm tính"). Empty cart needs an illustration + message.

## Variables and domains

| Variable | Domain |
|---|---|
| quantity | integer >= 1, no upper bound specified |
| add-to-cart target | {new product} vs {product already in cart} |
| cart state | {empty} vs {non-empty} |

## Test design

| Case | Scenario | Expected |
|---|---|---|
| G1 | Add product A (not yet in cart) | New row, quantity 1 |
| G2 | Add product A again | Same row, quantity 2 — no new row |
| G3 | Cart empty | Illustration + message |
| G4 | Cart non-empty | Full column set rendered |
| G5 | Quantity boundary: click "-" at quantity 1 | Either row is removed (with confirm) or the button is disabled at 1 |
| G6 | Click Delete | Confirm dialog before removal |
| G7 | Total label | Reads "Tổng cộng" |
| G9 | Reload page with items in cart | Cart persists |

BVA on quantity (n=1, no upper bound in spec):

| Case | quantity | Expected |
|---|---|---|
| Q5 | -1, 0, 1.5 (sent directly to the API, bypassing the UI) | Rejected |

## Execution

Called `GET/POST /api/cart` directly and read `CartContext.jsx` / `Cart.jsx` since most of this feature turned out to be pure client state with no backend calls at all.

- G1/G2: posted the same product id twice to `POST /api/cart` → `GET /api/cart` returned two separate rows, both quantity 1. Confirmed the same thing happens purely client-side: `CartContext.jsx` does `setCart([...cart, {...product, quantity}])` — always appends, no id check anywhere, client or server.
- Q5: posted quantity -1, 0, and 1.5 to `POST /api/cart` → all three accepted (200 OK), no validation.
- Everything else (G5–G9) verified by reading `Cart.jsx` directly, since the logic is small and explicit.

## Bugs found

1. **Duplicate add-to-cart never merges.** Confirmed both via the API and in `CartContext.jsx` — no merge logic exists anywhere, client or server. Every "add to cart" click appends a new row.
2. **No +/- quantity control in the cart.** `Cart.jsx` renders `{item.quantity}` as plain text. Quantity can only be set once, at add time, on the product detail page.
3. **Delete has no confirmation dialog.** `removeFromCart` calls `splice()` immediately on click. No `confirm()`/modal anywhere in the file.
4. **Wrong total label.** `Cart.jsx` literally renders "Tổng tạm tính" — the exact label the spec says not to use.
5. **Cart is lost on page reload or re-login.** It's `useState([])` in a React Context with no localStorage and no call to `GET /api/cart` on mount.
6. **Empty cart has no illustration**, just text + a link.
7. **Backend `POST /api/cart` accepts negative/zero/decimal quantity** with no validation. Currently unreachable through the UI (since the frontend never calls this route at all), but a real gap if the endpoint is ever wired up or hit directly.

Bigger picture: the cart frontend never talks to the cart backend at all — two independently built halves that were never integrated. Worth flagging as its own ticket beyond the individual bugs above.
