# Issuance (émission)

## Definition
**Issuance** turns a held booking into issued documents: one **ticket** per
passenger and journey, plus **EMDs** for paid services. In metis it happens at
the **pay** step, which is separate from booking creation (hold).

- **Pre-issuance** — PNR is `BOOKED` (status `1`) with a ticketing time limit
  (`pnr.ttl`). Changes and cancellations are free of ticket rules.
- **Post-issuance** — PNR is `TICKETED` (status `2`). Any change goes through
  void, refund, exchange or retain, each with carrier rules and fees.

## Business context
- TA agents hold first and issue later (hold-before-pay). Issuance is when
  money moves: credit is debited, billing rows are finalized and the
  accounting message (MCTO) goes to the agency back-office.
- If the TTL passes without issuance, the booking expires (status `5`).

## Technical context
- **`updateIssuance(json, body, decodedToken, jwtToken, jsonRS, options)`** in
  `api-aerial/src/utils/dossier.utils.js` is the shared issuance writer for
  every provider (call sites: `controllers/AMADEUS_NDCX/order.controller.js`,
  `ACCELYA/`, `TURKISH_AIRLINES/`, `utils/BA/`, `utils/TRANSAVIA/`,
  `utils/SABRE/order/change.shared.js`, `services/NOUVELAIR/`,
  `utils/GOKYTE_LEGACY/issuancePersistence.utils.js`). It:
  - sets the PNR to status `2`;
  - flips facturation segments from `1` to `2` **by the current segment ids**
    (so a flow that recreates segments without facturation loses billing);
  - creates `ticket_aerial` rows from `ticketDocInfo` and their coupons,
    skipping tickets that already exist;
  - links issued services to their EMD; an EMD-S (`Y`) also emits an MCTO
    EMDS, whose failure does not block issuance;
  - debits credit (`recordIssuanceCredit`) unless `options.skipCredit` (repairing
    already-issued tickets, LOC-001);
  - an airline error reply (`Order.StatusCode === "SB"`) marks the PNR
    disrupted (`-5`), except unpaid AF/KL orders in Support (LOC-141b).
- **Document types** (`ticketDocTypeCode`): `T` = ticket, `J` = EMD-A
  (associated to a ticket coupon), `Y` = EMD-S (standalone). See
  `front-reservation/app/components/folder/mctoResend.utils.ts`.
- **NDC[X]**: pay runs on an NDC[X]-only route (ADR-15). OrderPay pairs with
  `updateIssuance` **only**. Never `saveAfterRetreive` (that's retrieve's
  job), never a second `dossierCreate`. CVV is purged after ticketing.
- Ancillaries issued after the ticket: `updateIssuanceAncilaries`.

## Business rules
- Hold and issuance are two calls. Never chain them into one.
- Payment-touching changes: NDC[X] sends the raw PAN over TLS (the AF/KL
  card-encryption path does not fire). Call this out in every payment MR.
- MCTO is **not** sent automatically for EDIFACT bookings or NDC-via-GDS
  bookings, where the GDS sends the accounting message (LOC-124, rule of
  2026-10-30). Manual resend stays possible.
- ⚠️ Whether a pending [approbation](../workflows/approbation-flow.md) blocks
  issuance is not established from the code read so far. Ask before relying
  on it.

## Distinctions
- Issuance ≠ booking/hold (PNR exists, no ticket).
- Ticket (`T`) ≠ EMD (`J`/`Y`).
- **TTL** (ticketing time limit, `pnr.ttl`, hours to days) ≠ **Offer Time
  Limit** (NDC offer validity, 15–30 min, before booking).
- Issuance ≠ payment authorization. A PNR can be in `PAYMENT ERROR` (`8`)
  with no ticket.

## Synonyms
émission, ticketing, emit, billetterie; "émis" = TICKETED.
