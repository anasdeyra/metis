# NDC[X] — Passenger info change (contact / name / frequent flyer)

Ticket MET2-2422, branch `deyra-met2-2422`. Companion to
[`NDCX-INTEGRATION.md`](./NDCX-INTEGRATION.md) (source of truth) and
[`NDCX-CONTEXT.md`](./NDCX-CONTEXT.md) (the two-minute guardrail read).

Scope: `BaseAdapter.updatePax(changeType)` for `AMADEUS_NDCX` folders, plus the
`updateAPIS()` path it sits next to.

---

## 1. What NDC[X] can and cannot do

Read off the Amadeus matrix, **WBS channel**
(`.agents/skills/ndcx/references/airline-matrix.csv`) and
`references/12-post-booking-modifications.md`. The front exposes five buttons; NDC[X] has
three operations.

| Front `changeType` | NDC[X] mechanism | Outcome |
|---|---|---|
| `contact` | `Travel_OrderReshop/UpdatePax` → `Travel_OrderChange` | implemented |
| `info` (name) | same pair, `Individual/GivenName`+`Surname` | implemented, gated |
| `fidelity` | same pair, `LoyaltyProgramAccount` | implemented, gated |
| `corp` | **none** | refused with a named reason |
| docs / APIS (`updateAPIS`) | **none** | refused with a named reason |

Per-carrier, for the three that exist (1 = supported):

| | held (status 1) | ticketed (status 2) |
|---|---|---|
| **name** | CX, LO, TP only | nobody in NDC[X] scope (AA and AF/KL only, both directly integrated) |
| **contact** | all but UA, VY | all but LH, QF, VY |
| **fidelity** | all but VY | all but VY |

Plus matrix note **PB03** — *"Only Add frequent Flyer is supported by the airline"* — on every
in-scope carrier except LH, QF and UA: a passenger who already holds an FQTV number cannot
have it changed or removed there.

**ADR-45 — `corp` is refused, not no-op'd.** The only corporate row in the matrix is
"Voluntary change : Voluntary Reprice (Add/Modify Corpocode)", which is a reshop/reprice of
the whole order, not a passenger attribute. AF/KL, SABRE, EK and Aegean all answer
`corpChange()` with an empty `{}` — the button appears to work and does nothing. NDC[X]
returns an explicit error instead: an agent who thinks the corporate code reached the airline
will not chase it.

**ADR-46 — identity documents are refused.** `Traveler's Passport details` is **0 for every
carrier**, held and ticketed. The only row that exists is "Queuing of voluntary change done
with the airline: Travel documents" — the agent updates the document with the airline
directly and Amadeus is notified. The override is *required*, not cosmetic:
`BaseAdapter.updateAPIS()` is concrete (it does not throw) and POSTs to
`${getControllerByOra(ora)}/order/orderChangeRQ`, which for `AMADEUS_NDCX` now resolves to
the NDC[X] **ancillary** route — the agent would get "At least one ancillary offer item is
required" for a passport change.

---

## 2. Shape

```
POST /aerial/AMADEUS_NDCX/order/updatePaxRQ
  → Travel_OrderRetrieve   read the host's PaxIDs + current contact details
  → Travel_OrderReshop     UpdatePax/New ... → ReshopOffer/OfferID   (persists nothing)
  → Travel_OrderChange     AcceptOffer/SelectedOffer{OfferID}        (commits)
```

Capture: `.agents/skills/ndcx/examples/servicing/Update-Pax-Phone-and-Email/`.

**ADR-47 — one route, server-side sequence.** The reshop's OfferID means nothing alone and
expires. Handing it to the front creates a resubmittable intermediate state, which NDC[X]
rule 11 (no duplicate bookings, no re-submittable confirmation) forbids. `handleOrderCancel`
already chains its quote and its cancel the same way.

**ADR-48 — a dedicated route, not `/orderChangeRQ`.** That route is the ancillary add: its
validator demands `AncillaryOfferIdList` + `ShoppingResponseId` and its builder attaches a
`PaymentInfo` on a ticketed order. A pax update has no offer to price and nothing to pay.
Sharing the route would mean a validator meaning two things depending on an unrelated field.
Same situation as `/orderPayRQ` (ADR-15): no generic dispatcher entry, reached only by its
full path.

**ADR-49 — the retrieve is mandatory.** See §3.

---

## 3. Traps — do not repeat

### `UpdatePax/New/PaxID` is the HOST's id, not `PAX{n}`

The capture carries `T1`. Worse, hosts renumber: in
`examples/servicing/SQ-Family-Add-Seats-and-Bags-Post-Payment/3---Travel-OrderCreate`, the
request sends `P1, P2, P3, P1.1` and the reply comes back `PAX2, PAX3, PAX4, PAX5` — not even
1-indexed from 1. Minting `PAX{n}` the way `buildOrderCreatePaxList` does addresses the wrong
passenger, or none, **with no host error either way**. The id is read off a live
`Travel_OrderRetrieve` and joined to metis's travellers by name, position as fallback
(`resolveNdcxHostPax`).

> ⚠️ **Latent, pre-existing, not fixed here:** `orderChange.utils.js`'s
> `resolveNdcxDossierTravelerIdByPax` maps reply `PaxRefID` → traveller by assuming
> `PAX{index+1}`. On an SQ-style renumbering every lookup misses and
> `buildNdcxServiceRows` silently drops every ancillary row (it skips rows with no
> `dossierTravelerId`, which is NOT NULL). Separate ticket — it affects ancillary
> persistence, not this flow.

### Never combine updates — except the one time you must

Sending an FF change and a contact change together returns
`MULTIPLE UPDATES NOT SUPPORTED BY THE AIRLINE. PLEASE RETRY WITH A SINGLE UPDATE`.
But if the order **already holds** a phone and email, an FF reshop that omits them returns
**the same error**. Echo the existing values verbatim; change only
`LoyaltyProgramAccount`. The two rules only look contradictory: the contact data is present
and identical.

### An FF update carries ALL passengers

Not only the one being changed. A contact or name update carries only the target (the
capture sends a single `New`).

### Infant contact data is silently ignored

No error — the change just does not happen. A contact block is never built for an `INF`.

### Element-name asymmetry

The reshop **request** wants `Phone/PhoneNumberText`; the OrderView **reply** returns
`Phone/PhoneNumber`. Both spellings are read so an echo survives the round trip. Email comes
back upper-cased by the airline.

### `OrderItemRefID` carries an ORDER id

Not an order-item id — the capture sends the same value in `Request/OrderItemRefID` and in
the change's `Order/OrderID`. `orderReshop.utils.js` documents the identical quirk for the
cancel quote. `BookingRef/BookingID` is sent **empty**, not omitted and not filled with the
Amadeus PNR.

### Echo the OfferID verbatim

It carries a `_TPID_Eg1DaGFuZ2VQYXhJbmZv` suffix (base64 of a "ChangePaxInfo" token) shared
by both pax-update use cases. Do not parse or rebuild it.

### `Errors[]` is plural on the reshop reply

`AmaTravelOrderReshopRs` spells it `Errors[]`, unlike the cancel reply's `Error`.
`orderReshopReply.mapper.js` already special-cases this.

---

## 4. Gate and persistence

**ADR-50 — gate on matrix + `pnr.status`, before any host call.** The matrix splits all three
update types on the held/ticketed boundary and the halves genuinely disagree. Refusing
upfront saves the agent an opaque host rejection and saves a look-to-book transaction
(rule 10). Unknown carriers stay permissive-but-unverified — the same "let the host decide"
default the ancillary table uses, so a newly-enabled carrier degrades to a warning, not a
locked button. PB03's add-only check needs the retrieve first (it depends on whether the
passenger already holds a card), so it lands after the read and before the write.

**ADR-51 — persistence reuses the shared helpers.** `updateTravelerDate` /
`updateTravelerContact` (`dossier.utils.js`) are what IBERIA, SABRE and BA already call for
their own pax changes; NDC[X] adds a **call site**, not an edit to a shared body
(NDCX-CONTEXT.md §3). They also write the OrderHistory line, so the agent's trail reads the
same whichever carrier did the change. Fidelity has no shared helper (IBERIA's controller
says so in a comment: *"no function found to update ff"*) and is written directly rather than
adding a sixth variation to `dossier.utils.js`.

Persistence is **best-effort**, exactly as `handleOrderChange` persists its services: the
host change has already succeeded, and an agent who sees it reported as failed will retry it.
`saveAfterRetreive` is **not** called — it resyncs segments and recomputes `pnr.status` from
coupon statuses, and a passenger update touches neither.

---

## 5. Files

| File | Change |
|---|---|
| `api-aerial/src/utils/AMADEUS_NDCX/updatePax.utils.js` | new — reshop/change builders, host-pax join, reply readers |
| `api-aerial/src/utils/AMADEUS_NDCX/carrierCapabilities.js` | `PAX_UPDATE` table + `resolveNdcxPaxUpdateSupport` |
| `api-aerial/src/controllers/AMADEUS_NDCX/order.controller.js` | `handleUpdatePax`, `persistNdcxPaxUpdate`, `/updatePaxRQ` |
| `front-reservation/app/utils/adapters/AmadeusNdcxAdapter.ts` | `infoChange`/`contactChange`/`fidelityChange`/`corpChange`/`updateAPIS` |
| `api-aerial/src/utils/AMADEUS_NDCX/__tests__/ndcx-update-pax.utils.test.js` | new — 21 cases |
| `api-aerial/src/controllers/AMADEUS_NDCX/__tests__/updatePax.callSequence.test.js` | new — host-call order, gate, persistence |

---

## 6. Open

- **No live capture for a name or FF update against a pilot carrier.** The builders follow
  the QF contact capture and the guide's prose for the FF variant. Confirm `LabelText`
  handling and the FF echo against a real LO/TP exchange before certification.
- **`ContactRefusedInd ≠ FALSE`** gates sharing contact data with the airline (the guide's
  own double negative). metis has no such field on a traveller, so nothing is checked. If a
  carrier starts rejecting contact updates, this is the first thing to look at.
- **Controller tests need the DB/cert environment.** `updatePax.callSequence.test.js` loads
  `order.controller.js`, which pulls `models/index.js` and `config/afConfig.js` — it fails
  locally without `.environment` exactly as the pre-existing
  `orderCancel.callSequence.test.js` does. Verified in CI, not on a bare checkout.
