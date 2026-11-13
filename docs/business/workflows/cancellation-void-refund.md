# Cancellation, void, refund, retain

## Entry
One generic route for every provider: `POST /orderCancelRQ`
(`api-aerial/src/controllers/global.controller.js`) → the provider's
`OrderController.orderCancelRQ`. There are no separate void or refund routes.
The provider branches internally on the order and ticket state.

**Actors**: agent (TA or SBT). An OBT traveler can cancel a reservation that
is still pending approval. Agent-only accounting actions stay agent-only.

## Outcomes

| Situation | Outcome | PNR status | Money | Accounting |
|---|---|---|---|---|
| Not issued (BOOKED) | **Cancel** | `3` CANCELLED | none | — |
| Issued, inside void window | **Void**: coupons → `V` | `0` VOID | full, no fee | MCTO Void |
| Issued, agent asks to keep ticket value | **Retain** | `9` RETAINED | none now; value kept for reuse | **no** facturation, **no** MCTO |
| Issued, otherwise | **Refund** | `4` REFUNDED | carrier-dependent (`refund-amount.utils.js`) | MCTO Refund |

Reference implementation of the branch: the Kyte branch in
`api-aerial/src/utils/dossier.utils.js` (`voided ? 0 : retained ? 9 :
wasTicketed ? 4 : 3`).

## Quote before acting
- The front fetches the cancellation estimate when the agent opens the cancel
  dialog (`front-reservation/app/components/folder/cancelCard/`), shows the
  refund amount, then cancels on confirmation.
- **Exception: one-step-void carriers** (`ONE_STEP_VOID_CARRIERS = ["AA"]`
  via Kyte). Their "estimate" *is* the cancellation, so it must never fire on
  dialog open, and no amount can be shown first —
  `front-reservation/app/utils/helpers/cancelVoidCarriers.ts`.
- **NDC[X]**: the quote is `Travel_OrderReshop`, **mandatory** between retrieve
  and cancel once an order is paid (ADR-27, which superseded ADR-22's "no
  quote" claim). A cancelled NDC[X] order is **not retrievable** (code 119),
  so no host call follows the cancel (ADR-28). Do not put `AMADEUS_NDCX` back
  in `ONE_STEP_VOID_CARRIERS`.

## Business rules
- **Void window** is provider-specific. Kyte legacy: no fee and the same
  calendar day as issuance, **in the sales point's time zone** (LOC-093).
- Coupon statuses come from the airline (`json.couponStatuses`) and are never
  invented (MET2-2845) — `cancelCouponStatuses.utils.js`.
- Terminal statuses `0`/`3`/`4` are never rewritten by a resync (LOC-089).
- Cancelling an already RETAINED PNR is a no-op. Re-cancelling would flip it
  to `3` and regenerate billing.
- Cancelling a dossier deletes pending approval reminder/auto-approval jobs
  and emails the approvers.
- Refund amounts differ by carrier (on the test host: AI 100 %, KQ/SQ
  taxes-only). Don't hard-code a rule.
- ⚠️ NDC[X] cancellation must not trigger passive-PNR cancellation against the
  real airline record (ADR-23 guard).
- Accounting messages can be re-sent by hand from the folder
  (`components/folder/MctoResend.vue`).

## Distinctions
- Cancel (pre-issuance) ≠ void (same-window, post-issuance) ≠ refund ≠ retain.
- Cancellation ≠ **exchange** (flight or fare change: `orderReshopRQ` /
  `orderChangeRQ`, one at a time per order).
- Voiding a ticket ≠ voiding an EMD (separate MCTO types: Void vs Void EMDA).

## Related
[booking lifecycle](booking-lifecycle.md) · [issuance](../concepts/issuance.md)
· archived detail: `docs/archive/ndcx/NDCX-ORDERCANCEL-PLAN.md`,
`NDCX-FLIGHTMODIFICATION-PLAN.md`
