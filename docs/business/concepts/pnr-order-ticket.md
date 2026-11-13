# PNR, Order, dossier, ticket

## Definition — the four record layers

| Layer | Owner | What it is | Key identifiers |
|---|---|---|---|
| **PNR** | Airline (via GDS) | Passenger Name Record — the airline's reservation + record locator | `pnr.pnr` (recloc), `pnr.ownerCode`, status `0`/`3`/`4` terminal |
| **Order** | NDC host | NDC-side booking created by `Travel_OrderCreate` | `OrderID` (metis prefixes `NDCX-`), `Order.OwnerCode` (provider) |
| **Dossier** | Metis | Internal booking record — the hub | `dossier.id`, see [dossier.md](dossier.md) |
| **Ticket** | Airline | Issued travel document per passenger | `ticketDocTypeCode` (`T` ticket / EMD ancillary), `status === 1` active |

## Business context
- A booking creates **one dossier**, linked to **one or more PNRs**
  (`pnrList` — a reply can carry 2–3 `Order.BookingRef` entries; select the one
  with `BookingEntity/Carrier` present explicitly, never by array index).
- Classic AMADEUS works on PNRs; NDC[X] works on Orders; both feed the same
  dossier persistence in metis.
- Issuance (at pay) produces tickets; ancillaries produce EMDs.

## Technical context
- `api-aerial/src/services/pnr.service.js`, `models/pnr.js`,
  `utils/AMADEUS_NDCX/order.utils.js`, `dossier.utils.js`.
- **`Order.OwnerCode` is the provider (`"AMADEUS_NDCX"`), not the airline** —
  the airline designator lives in `Order.BookingRef.BookingEntity.Carrier`
  and `Order.pnrList`. Getting this backwards silently bypasses every
  carrier-keyed branch in shared `dossier.utils.js`.
- ⚠️ metis stores the NDC **provider designator** (`UAD`) in
  `pnrList.ownerIataCode`, not the airline code (`UA`) — do "not airline?"
  checks against the right field (see `docs/archive/ndcx/NDCX-FLIGHTMODIFICATION-PLAN.md`).
- `Order.OrderID` gets the `NDCX-` prefix applied by metis; it is stripped
  before every host call (`stripNdcxOrderIdPrefix`). Without it, NDC[X] orders
  collide with classic AMADEUS dossiers in the same office.
- PNR terminal statuses: `0` = void, `3` = annulé, `4` = remboursé —
  a resync never rewrites them (LOC-089).
- Exchange lock: one exchange at a time per order, across api-aerial instances
  (`pnr.exchangeInProgressAt`).

## Distinctions
- Reservation (PNR/Order exists) ≠ issuance (ticket exists).
- A PNR can exist without a ticket (pre-issuance hold); a ticket implies a PNR.
- `pnr.pnr` (airline recloc) ≠ `OrderID` (`NDCX-…`) ≠ dossier id.

## Synonyms
recloc, record locator, réservation (FR, loosely).
