# FR-10 Order State Machine - Domain Testing & BVA Test Design

## 1. Objective and Scope

Design a functional test suite for **FR-10: Order State Machine** using Domain Testing, Equivalence Partitioning, Boundary Value Analysis for enumerations, Decision Tables, and State Transition testing.

Scope:

- User cancel order API: `PUT /api/orders/:id/cancel`
- Admin update order status API: `PUT /api/admin/orders/:id/status`
- Order creation precondition: checkout creates a new order with initial status `pending`
- Role-specific behavior: User/Admin actions
- Final-state behavior for `delivered` and `canceled`

Primary requirement source: `README.md`, FR-10.

Related requirement traces:

- FR-10: Orders have 5 states: `pending`, `confirmed`, `shipping`, `delivered`, `canceled`.
- FR-10: Valid admin flow is `pending -> confirmed -> shipping -> delivered`.
- FR-10: User/Admin can cancel from `pending` and `confirmed`.
- FR-10: `delivered` and `canceled` are final states and must not transition to any other state.
- FR-10: When an order is in `shipping`, User must not self-cancel; only Admin can operate.
- FR-10: Invalid transitions must return an error with a suitable message.
- FR-18: Admin order management must follow the FR-10 state machine.
- FR-20: Mobile cancel must follow FR-10 and only allow cancel when `pending` or `confirmed`.

## 2. Current Codebase Deviations to Capture

These implementation differences were observed while reading the current codebase:

| Area | File | Current behavior | Requirement impact |
| --- | --- | --- | --- |
| User cancel from `shipping` | `backend/server.js` | User cancel blocks only `delivered` and `canceled`, so `shipping` can be canceled by a user. | Violates FR-10: User must not self-cancel when status is `shipping`. |
| `canceled -> delivered` admin transition | `backend/server.js` | Admin endpoint explicitly allows `canceled -> delivered`. | Violates final-state rule: `canceled` must not transition to any state. |
| Admin authorization | `backend/server.js` | `PUT /api/admin/orders/:id/status` uses `authenticateToken` but does not check `role = 'admin'`. | A normal authenticated user may be able to perform admin state transitions. |
| Invalid status value validation | `backend/server.js` | Unknown statuses are rejected indirectly as invalid transitions. | Acceptable behavior if a clear error is returned, but should be covered. |
| State machine ambiguity | `README.md` | Text says when `shipping`, user cannot cancel and "only Admin can operate"; diagram only shows `shipping -> delivered`. | This test design treats `shipping -> delivered` as the only valid shipping transition, and flags admin cancel from shipping as an assumption/gap. |

## 3. Variables and Constraints

| Variable | Source | Valid domain | Invalid / boundary classes |
| --- | --- | --- | --- |
| `currentStatus` | Existing order state | `pending`, `confirmed`, `shipping`, `delivered`, `canceled` | Unknown DB status, missing order |
| `targetStatus` | Admin request body | `confirmed`, `shipping`, `delivered`, `canceled` when allowed by current state | Same state, backwards state, skipped state, unknown value, wrong case, empty, missing |
| `actorRole` | Auth token / endpoint | `user`, `admin` | anonymous, invalid token, non-owner user, normal user calling admin endpoint |
| `orderOwnership` | User cancel endpoint | Owner can cancel own eligible order | Other user's order, non-existent order ID |
| `transitionResult` | API response + persisted state | Accepted transition updates status exactly once | Rejected transition returns error and keeps old status |

## 4. State Partitions

### Valid states

- S1: `pending`
- S2: `confirmed`
- S3: `shipping`
- S4: `delivered` final
- S5: `canceled` final

### Valid transitions

- T1: `pending -> confirmed` by Admin
- T2: `pending -> canceled` by User/Admin
- T3: `confirmed -> shipping` by Admin
- T4: `confirmed -> canceled` by User/Admin
- T5: `shipping -> delivered` by Admin

### Invalid transition classes

- I1: Same-state transition, e.g. `pending -> pending`
- I2: Skipped forward transition, e.g. `pending -> shipping`, `pending -> delivered`
- I3: Backward transition, e.g. `shipping -> confirmed`, `delivered -> shipping`
- I4: Transition from final state `delivered`
- I5: Transition from final state `canceled`
- I6: User cancel from `shipping`
- I7: Unknown target status, e.g. `returned`
- I8: Wrong case, e.g. `Confirmed`
- I9: Missing/empty target status
- I10: Unauthorized or wrong role attempts

## 5. Boundary Values for Enumerations

FR-10 uses an enumeration rather than numeric ranges. Robust BVA is applied by covering:

- Every valid enum member: `pending`, `confirmed`, `shipping`, `delivered`, `canceled`
- Just-outside/invalid enum values: `""`, missing `status`, `Confirmed`, `returned`, `null`
- Terminal-state boundaries: entering `delivered` and `canceled`, then attempting one more transition out

## 6. Decision Table

| Row | Actor | Current state | Requested action / target | Expected |
| --- | --- | --- | --- | --- |
| D1 | Admin | `pending` | `confirmed` | Accepted |
| D2 | Admin | `pending` | `canceled` | Accepted |
| D3 | User owner | `pending` | cancel | Accepted |
| D4 | Admin | `confirmed` | `shipping` | Accepted |
| D5 | Admin | `confirmed` | `canceled` | Accepted |
| D6 | User owner | `confirmed` | cancel | Accepted |
| D7 | Admin | `shipping` | `delivered` | Accepted |
| D8 | User owner | `shipping` | cancel | Rejected |
| D9 | Admin | `delivered` | any target | Rejected |
| D10 | Admin | `canceled` | any target | Rejected |
| D11 | Anonymous | any state | cancel/update | Rejected with auth error |
| D12 | Normal user | any state | admin status endpoint | Rejected with authorization error |
| D13 | Non-owner user | eligible state | cancel | Rejected; order not found or forbidden |
| D14 | Admin | any non-final state | invalid target | Rejected; state unchanged |

## 7. State Transition Test Cases

| ID | Requirement Trace | Technique | Condition / Input | Class or Boundary | Expected Outcome |
| --- | --- | --- | --- | --- | --- |
| FR10-001 | "Checkout creates order state flow starts at pending" | Happy Path | Create an order through checkout | Initial state | New order is persisted with `status = pending`. |
| FR10-002 | "`pending` -> `confirmed` [Admin xác nhận]" | State Transition | Admin updates `pending` order to `confirmed` | T1 | `200 OK`; status becomes `confirmed`. |
| FR10-003 | "`pending` -> `canceled` [User/Admin hủy]" | State Transition | Owner user cancels `pending` order | T2 | `200 OK`; status becomes `canceled`. |
| FR10-004 | "`pending` -> `canceled` [User/Admin hủy]" | State Transition | Admin updates `pending` order to `canceled` | T2 | `200 OK`; status becomes `canceled`. |
| FR10-005 | "`confirmed` -> `shipping` [Admin giao hàng]" | State Transition | Admin updates `confirmed` order to `shipping` | T3 | `200 OK`; status becomes `shipping`. |
| FR10-006 | "`confirmed` -> `canceled` [User/Admin hủy]" | State Transition | Owner user cancels `confirmed` order | T4 | `200 OK`; status becomes `canceled`. |
| FR10-007 | "`confirmed` -> `canceled` [User/Admin hủy]" | State Transition | Admin updates `confirmed` order to `canceled` | T4 | `200 OK`; status becomes `canceled`. |
| FR10-008 | "`shipping` -> `delivered` [Admin hoàn tất]" | State Transition | Admin updates `shipping` order to `delivered` | T5 | `200 OK`; status becomes `delivered`. |
| FR10-009 | "User không được phép tự hủy khi shipping" | Decision Table | Owner user cancels `shipping` order via `/api/orders/:id/cancel` | I6 | Rejected with suitable error; status remains `shipping`. Current code is expected to fail because it allows this transition. |
| FR10-010 | "Final state delivered" | State Transition | Admin attempts `delivered -> pending` | I4 | Rejected; status remains `delivered`. |
| FR10-011 | "Final state delivered" | State Transition | Admin attempts `delivered -> canceled` | I4 | Rejected; status remains `delivered`. |
| FR10-012 | "Final state canceled" | State Transition | Admin attempts `canceled -> pending` | I5 | Rejected; status remains `canceled`. |
| FR10-013 | "Final state canceled" | State Transition | Admin attempts `canceled -> delivered` | I5 | Rejected; status remains `canceled`. Current code is expected to fail because it allows `canceled -> delivered`. |
| FR10-014 | "Invalid transitions return error" | Negative | Admin attempts `pending -> shipping` | I2 | Rejected with suitable error; status remains `pending`. |
| FR10-015 | "Invalid transitions return error" | Negative | Admin attempts `pending -> delivered` | I2 | Rejected; status remains `pending`. |
| FR10-016 | "Invalid transitions return error" | Negative | Admin attempts `confirmed -> delivered` | I2 | Rejected; status remains `confirmed`. |
| FR10-017 | "Invalid transitions return error" | Negative | Admin attempts `shipping -> confirmed` | I3 | Rejected; status remains `shipping`. |
| FR10-018 | "Invalid transitions return error" | Negative | Admin attempts `shipping -> canceled` | Ambiguous/I2 | Assumption-based expected: rejected; status remains `shipping` because diagram has no shipping cancel transition. If product owner interprets "only Admin can operate" as admin may cancel shipping, update this expected result. |
| FR10-019 | "Invalid transitions return error" | Negative | Admin attempts `pending -> pending` | I1 | Rejected; status remains `pending`. |
| FR10-020 | "Invalid transitions return error" | Negative | Admin attempts `confirmed -> confirmed` | I1 | Rejected; status remains `confirmed`. |
| FR10-021 | "Invalid transitions return error" | Robust BVA / Enum | Admin sends target `status = returned` | I7 | Rejected with suitable error; status unchanged. |
| FR10-022 | "Invalid transitions return error" | Robust BVA / Enum | Admin sends target `status = Confirmed` | I8 | Rejected; status unchanged because enum is case-sensitive. |
| FR10-023 | "Invalid transitions return error" | Robust BVA / Enum | Admin sends empty `status = ""` | I9 | Rejected; status unchanged. |
| FR10-024 | "Invalid transitions return error" | Robust BVA / Enum | Admin sends missing `status` field | I9 | Rejected; status unchanged. |
| FR10-025 | "Admin xác nhận/giao hàng/hoàn tất" | Decision Table | Normal user token calls `/api/admin/orders/:id/status` with valid `pending -> confirmed` | I10 | Rejected with authorization error; status unchanged. Current code may fail because endpoint does not check admin role. |
| FR10-026 | "Admin xác nhận/giao hàng/hoàn tất" | Negative | Anonymous request calls admin status endpoint | I10 | Rejected with `401 Unauthorized`; status unchanged. |
| FR10-027 | "User/Admin hủy" and ownership | Negative | User A attempts to cancel User B's `pending` order | I10 / ownership | Rejected; order remains `pending`. |
| FR10-028 | "User/Admin hủy" | Negative | Anonymous request calls `/api/orders/:id/cancel` | I10 | Rejected with `401 Unauthorized`; status unchanged. |
| FR10-029 | "Invalid transitions return error" | Negative | Admin updates non-existent order ID | Missing order | Rejected with `404 Order not found`. |
| FR10-030 | "Final states are terminal" | State Transition | User attempts to cancel `delivered` order | I4 | Rejected; status remains `delivered`. |
| FR10-031 | "Final states are terminal" | State Transition | User attempts to cancel `canceled` order again | I5/repeated action | Rejected; status remains `canceled`. |
| FR10-032 | "Order state machine complete path" | Happy Path | Admin performs `pending -> confirmed -> shipping -> delivered` | Valid path | All steps accepted in order; final state is `delivered`; further transition rejected. |
| FR10-033 | "Canceled final state" | State Transition | Owner user cancels `pending`, then admin attempts to update it to `confirmed` | Final-state boundary | First cancel accepted; second transition rejected; final state remains `canceled`. |

## 8. Suggested Test Setup

### Backend API automation

Recommended file:

```text
backend/__tests__/fr10.order-state-machine.api.test.js
```

Recommended tools:

```bash
cd backend
npm install --save-dev jest supertest cross-env
```

Because `backend/server.js` currently starts the server directly, make the app importable before using Supertest:

```js
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
```

### Test data setup

Each test should create a fresh order in a controlled status. Options:

1. Create an order through `POST /api/checkout`, which should produce `pending`.
2. Use admin valid transitions to move the order to `confirmed`, `shipping`, or `delivered`.
3. For final `canceled`, cancel from `pending` or `confirmed`.
4. Reset/reseed the SQLite database between tests, or create a new order per test to avoid cross-test state leakage.

### Useful tokens

- Admin token: JWT with `{ id: 1, role: "admin" }`
- User token: JWT with `{ id: 2, role: "user" }`
- Other-user token: create or seed another user, then create/cancel cross-owner cases.

## 9. Expected Initial Results Against Current Code

The following tests are expected to reveal current implementation defects:

- `FR10-009`: User cancel from `shipping` should be rejected, but current backend allows it.
- `FR10-013`: `canceled -> delivered` should be rejected, but current backend allows it.
- `FR10-025`: A normal user should not call the admin status endpoint, but current backend only checks for a valid token and does not check `role = 'admin'`.

## 10. Priority Recommendation

Automate in this order:

1. Full happy path: `pending -> confirmed -> shipping -> delivered`.
2. User/Admin cancel from `pending` and `confirmed`.
3. Final-state immutability for `delivered` and `canceled`.
4. User cannot cancel `shipping`.
5. Invalid enum values and skipped/backward transitions.
6. Authorization and ownership cases.

