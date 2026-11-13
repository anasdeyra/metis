# Booking lifecycle (flight)

Search → price → hold → (approve) → pay/issue → service. Hotel, car and rail
follow a similar shape with their own statuses (out of scope for v1).

## Stages

| # | Stage | What happens | Front page | API (api-aerial) |
|---|---|---|---|---|
| 1 | **Shopping** | Search fans out over every requested ora; Amadeus uses MasterPricer | `front-reservation/app/pages/booking/flight/index.vue` → `result.vue` | `/airShoppingRQ`, `utils/ndc-routing.*` |
| 2 | **Pricing** | Reprice the chosen offer; upsell; optional pre-booking ancillaries and seats | `result.vue` | `/offerPriceRQ`, `/serviceListRQ`, `/seatAvailabilityRQ` |
| 3 | **Hold** (booking) | Order/PNR created, **dossier created exactly once**, PNR `BOOKED` (1) with `ttl` | `order.vue` → `recap.vue` | `/orderCreateRQ` → `dossierCreate` |
| 4 | **Approval** (SBT dossiers only) | Approvers validate or reject each reservation | SBT home, folder | see [approbation flow](approbation-flow.md) |
| 5 | **Pay / issue** | Payment, tickets and EMDs issued, PNR `TICKETED` (2), credit debited, MCTO sent | folder | provider pay route → `updateIssuance` — see [issuance](../concepts/issuance.md) |
| 6 | **Servicing** | Retrieve, exchange, post-booking ancillaries, split, cancel/void/refund/retain, airline change notifications | `front-reservation/app/pages/folder/` | `/orderRetrieveRQ`, `/orderReshopRQ`, `/orderChangeRQ`, `/orderCancelRQ` |

Stages 1–4 are **pre-issuance**; stage 6 after tickets exist is
**post-issuance**. Entry to stage 1 is the same for every
[mode](../concepts/obt-mode.md) (TA, OBT, SBT); the mode changes guards,
visibility and whether approval runs.

## PNR status codes (`pnr.status`)

Numeric, defined by usage, not by an enum. Labels from
`front-reservation/app/pages/journal/etat-pnr.vue` and
`components/folder/widgets/table/filterModal/filterModal.vue`.

| Code | Label | Meaning | Terminal? |
|---|---|---|---|
| `1` | BOOKED | Held, not issued; carries `ttl` | no |
| `2` | TICKETED | Issued | no |
| `5` | EXPIRED | Time limit passed without issuance ⚠️ | yes |
| `3` | CANCELLED | Cancelled, nothing to refund (typically pre-issuance) | **yes** |
| `0` | VOID | Issued, then voided within the void window | **yes** |
| `4` | REFUNDED | Issued, then cancelled with refund | **yes** |
| `9` | RETAINED | Issued, cancelled, ticket value kept for later use (no refund) | yes |
| `-5` | DISRUPTED | Airline error or Order in `SB` state | no |
| `8` | PAYMENT ERROR | Payment failed; kept until payment completes | no (blocked) |
| `6` | ACTION NEEDED | Open airline notification needs an agent ⚠️ | no (blocked) |
| `7` | DAR REQUIRED | Waiting on an intervention from the airline or API provider. Front-only filter value: status 6 with a "DAR Required" notification (type 3) | no (blocked) |

- `0`, `3`, `4` are **never rewritten by a resync** (LOC-089,
  `api-aerial/src/utils/pnrTerminalStatus.utils.js`).
- 6/7/8 are "blocked, not finished" (MET2-2424, `dossier.service.js`
  status filter).
- `status === 1` on a *ticket* or *price row* means "active". That is a
  different field, unrelated to PNR status.

## Airline notifications (queue scan, OCN)
Airline-side changes arrive via Amadeus queues (cron scan) or Order Change
Notifications and become `notification` rows. Types
(`api-aerial/src/services/notifications.service.js`): `1` schedule change
(CANCELLED/REBOOKED), `2` TTL expired, `3` DAR Required, `4` DUPE,
`5` SEAT_CANCELLED. An open notification puts the dossier in ACTION NEEDED.

## Business rules
- Hold and pay/issue are two separate calls (TA hold-before-pay).
- `dossierCreate` runs once, at hold. Retrieve uses `saveAfterRetreive`, pay
  uses `updateIssuance`. A second `dossierCreate` orphans a row.
- An expired NDC offer (Offer Time Limit) must be **re-shopped, never
  repriced**.
- The confirmation step must never be re-submittable (no duplicate bookings).
- Only one exchange may run per order at a time (`pnr.exchangeInProgressAt`).

## Distinctions
- Booking status (`pnr.status`) ≠ approval state (`approvalState`) ≠ booking
  mode (OBT/TA) ≠ OBT visibility.
- Reservation (stage 3) ≠ issuance (stage 5).

## Related
[dossier](../concepts/dossier.md) · [PNR / Order / ticket](../concepts/pnr-order-ticket.md)
· [cancellation, void, refund](cancellation-void-refund.md) · [glossary](../glossary.md)
