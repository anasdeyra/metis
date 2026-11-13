# Amadeus NDC[X] Integration — MET2-2422

Repo: `api-aerial`, branch `deyra-met2-2422`. This file is the single source of
truth for context + remaining work. Written from git history + code
inspection + a grilling session with Deyra on 2026-09-07 — locked decisions
and open questions below are as of that date; update in place as things
change. Refreshed 2026-09-23 against actual repo state (commits + tests) —
only the "Done so far" list, its net-progress summary, and the two
fixture-test checklist items changed; locked decisions/open questions are
unchanged. Refreshed again same day after a review pass turned up (and fixed)
two real bugs in the order-create/retrieve step — see the last "Done so far"
entry and [`NDCX-ORDERCREATE-FINISH-PLAN.md`](./NDCX-ORDERCREATE-FINISH-PLAN.md)
for the full writeup, including what was deliberately scoped out (IdentityDoc,
GenderCode, live-host verification). Extended again 2026-09-23 with two new
companion plans — [`NDCX-ORDERPAY-PLAN.md`](./NDCX-ORDERPAY-PLAN.md) (§3's pay step,
ADR-15…20) and [`NDCX-ORDERCANCEL-PLAN.md`](./NDCX-ORDERCANCEL-PLAN.md) (§5, ADR-21…26);
the only edits to this file are the checklist/open-question pointers into them.

## What NDC[X] is here

Amadeus NDC[X] is a **new, separate provider**, not a replacement of the
classic `AMADEUS` (SOAP TPP) provider:

- `airline-constants.utils.js` registers it as its own pseudo-ora:
  `AIRLINE_TO_PROVIDER["AMADEUS_NDCX"] = "AMADEUS_NDCX"`. Unlike `SABRENDC`,
  there is **no automatic per-carrier redirect** — the frontend must send
  `oras: ["AMADEUS_NDCX"]` explicitly to opt in. Which carriers/offices
  actually use it is a product decision, not inferable from code (and out of
  scope for this doc per the 2026-09-07 session).
- Talks SOAP (via the `soap` npm package) to two separate WSDL-bound
  endpoints, both wrapped by `NdcxClient`
  (`src/utils/AMADEUS_NDCX/NdcxClient.js`):
  - **NDCX_TST_1.0** (`Technical.wsdl`) — legacy TST-style ops
    (`masterPricerSearch`, `pnrAddMultiElements`, `pnrCancel`, `pnrRetrieve`,
    `pnrList`, `queueList`, `queuePlacePnr`, `ticketDisplayTsmp`,
    `ticketDisplayTst`). **Stateful** when `isStateful: true` — session
    lifecycle (`beginSession`/`endSession`/sign-out) is handled automatically
    by `NdcxService`.
  - **NDCX Travel Management 1.14** (`NDCX_PDT_Travel_Management_1.14_4.0.wsdl`)
    — the modern NDC ops: `travelOfferPrice`, `travelOrderCreate`,
    `travelOrderPay`, `travelOrderRetrieve`, `travelOrderCancel`,
    `travelOrderChange`, `travelOrderReshop`, `travelSeatAvailability`,
    `travelServiceList`. **Always stateless** (per the NDC[X] guide: "all NDC
    calls are stateless").
  - All 19 low-level SOAP operations already exist and are typed
    (`src/utils/AMADEUS_NDCX/types.js`, generated `.d.ts` under
    `src/types/NDCX/`). **The SOAP transport layer is done** — what's missing
    is everything above it (request builders, reply mappers,
    services/controllers, dossier persistence) for all operations except
    shopping.
- Errors surface as `NdcxError` (SOAP fault or transport failure), already
  implemented in `types.js`.

### The generic multi-provider dispatch contract

`src/controllers/global.controller.js` is the single Express entry point for
every provider (AMADEUS, SABRE, IBERIA, AFKL, EK, TURKISH_AIRLINES, GOKYTE,
TRANSAVIA, ACCELYA, …) past the shopping step. It resolves `body.oras[0]` to
a provider key via `Oras = { ...AIRLINE_TO_PROVIDER }`, then dispatches to
whatever that provider's controller module exports:

| Route | Dispatches to | Currently wired for AMADEUS_NDCX? |
|---|---|---|
| `POST /airShoppingRQ` | `controllers[key].ShoppingController` | ✅ Yes |
| `POST /offerPriceRQ` | `controllers[key].OfferController.offerPriceRQ` | ✅ Yes |
| `POST /serviceListRQ` | `controllers[key].ServiceController.serviceListRQ` | ❌ No |
| `POST /seatAvailabilityRQ` | `controllers[key].SeatController.seatAvailabilityRQ` | ❌ No |
| `POST /orderCreateRQ` | `controllers[key].OrderController.orderCreateRQ` | ❌ No |
| `POST /orderRetrieveRQ` | `controllers[key].OrderController.orderRetrieveRQ` | ❌ No |
| `POST /orderCancelRQ` | `controllers[key].OrderController.orderCancelRQ` | ❌ No |
| `POST /orderChangeRQ` | `controllers[key].OrderController.orderChangeRQ` | ❌ No |
| `POST /orderReshopRQ` | `controllers[key].OrderController.orderReshopRQ` | ❌ No |

**There is no generic `/orderPayRQ` route.** See Open Questions.

Controller modules are picked up automatically by folder name in
`getControllerFiles()` — the `"AMADEUS_NDCX"` branch already exists there, so
dropping a correctly-shaped `*.controller.js` file into
`src/controllers/AMADEUS_NDCX/` is enough for it to be merged into
`controllers.AMADEUS_NDCX`; no dispatcher change needed for the routes that
already exist in the table above. **"Adding the adapter" = building the
`OfferController`/`ServiceController`/`SeatController`/`OrderController`
modules that satisfy this contract**, the same way `SABRE/` already does
(`offer.controller.js`, `order.controller.js`, `service.controller.js`,
`ocn.controller.js`) — SABRE is the closest working reference since it's
also a stateless NDC-style SOAP provider, not a classic-Amadeus session flow.

### Shared internal response shapes

`src/utils/Structure/` holds shapes multiple providers map their replies
into:

- `AirShoppingRs.js` — used by shopping (already wired for NDC[X]).
- `OfferPriceRs.js` — used by SABRE/AMADEUS/AFKL/EK/IBERIA/ACCELYA's offer
  controllers. **NDC[X]'s offerPrice mapper must map into this same shape.**

No shared `Structure` exists yet for OrderCreate/OrderRetrieve/OrderCancel/
OrderChange/OrderReshop/ServiceList/SeatAvailability replies — every provider
currently shapes those ad hoc in its own controller. Match SABRE's shape for
each, don't invent a new shared Structure unless asked.

**For the Order\* replies there is nonetheless a de-facto target shape**:
`src/types/DossierCreatePayload.d.ts`'s `DossierCreate` — `._text`-wrapped
IATA OrderViewRS, originally modelled on AF/KL. It is what `dossierCreate()`
and `saveAfterRetreive()` in `dossier.utils.js` read, and SABRE's
`formatNDCResponse` emits it. `Travel_OrderCreate`, `Travel_OrderPay` and
`Travel_OrderRetrieve` all return the *same* `AMA_TravelOrderViewRS` document,
so NDC[X] uses **one** mapper for all three — see
[`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md) ADR-6/ADR-7 and its
§4 mapping table.

## Done so far (commits, this branch)

1. `69c8abd81` — Generated NDC[X] SOAP type definitions + WSDL/XSD schemas
   (`src/types/NDCX/`).
2. `75ec71076` — `NdcxClient`, `security.js` (sign-in/session), `ndcxLogger.js`;
   added the `soap` npm dependency.
3. `e281071f8` — `shopping.utils.js` (request builder) +
   `shoppingReply.mapper.js` (reply mapper); registered the `AMADEUS_NDCX`
   provider constant.
4. `1f463b3c7` — `NdcxService` (`src/services/AMADEUS_NDCX/ndcx.service.js`):
   wraps both WSDL clients, exposes all 19 typed operations.
5. `daa6ffa2a` — `controllers/AMADEUS_NDCX/shopping.controller.js` wired into
   `global.controller.js`'s folder-routing.
6. `c2ce566e1` — Fixture-based tests for the shopping reply mapper:
   `src/utils/__tests__/ndcx-shopping-reply.mapper.test.js` +
   `src/utils/__tests__/fixtures/ndcx-*`.
7. `4daa2ad58` — Unrelated null-safety fix in the *classic* AMADEUS shopping
   utils, picked up while working this branch.
8. `e8658bbcb` — `offer.controller.js` + offer/amount utils + reply mapper:
   NDC[X] offerPrice adapter (see `NDCX-OFFERPRICE-PLAN.md`).
9. `904bf101f` — Fixed OfferPrice amount/baggage mapping; extracted shared
   `penalty.utils.js`/`location.utils.js`.
10. `f101160b4` — Always request fare family on NDC[X] shopping, surfaced in
    the reply mapper.
11. `d06f7fd32` — `order.controller.js` + `order.utils.js` +
    `orderViewReply.mapper.js`: NDC[X] `Travel_OrderCreate`/`OrderRetrieve`
    adapter (see `NDCX-ORDERCREATE-PLAN.md`). Landed together with
    fixture-based tests `ndcx-order-create.utils.test.js` and
    `ndcx-orderview-reply.mapper.test.js`, backed by real captures
    (`ndcx-order-create-body-roundtrip.json`,
    `ndcx-orderview-reply-roundtrip.json`).
12. `e73304c19` — Normalize NDC[X] pax `contactInfo` before `dossierCreate`.
13. `4725b186a` — Guard `dossierCreate` against errored/empty NDC[X] order
    responses.
14. `5f8e2528c` — Read NDC[X] offerPrice pax birthdate/gender from
    `individualInfo`.
15. `091e7248c` — JSDoc on `NdcxService`'s `Travel_*` delegate methods (no
    behavior change).
16. `883a6c87e` — Enhanced cabin type handling in the order-view mapper.
17. (uncommitted) — Fixed the penalty `available`/`"NAV"` bug: NDC[X]'s
    `RuleMetadata.Instruction` (`"Not Allowed"`) was passed straight through as
    `DescText` instead of being translated into the `"NAV"` sentinel
    `dossier.utils.js`'s shared availability check actually reads, so a
    non-refundable fare read as refundable. While fixing it, found the reason
    it never worked at all: `Response/Metadata/Other/OtherMetadata` is an
    **array** on real captures (`[{CurrencyMetadatas}, {RuleMetadatas}]`), not
    one object with both as sibling keys — so both the `@refs → RuleMetadata`
    lookup (`penalty.utils.js`) and the ADR-10 currency-decimals read
    (`amount.utils.js`) were silently resolving nothing, the latter only
    "working" by coincidence because EUR's ISO fallback (2) matches its real
    `Decimals` value. Both fixed; 2 new regression tests added against the real
    fixture. Full writeup in
    [`NDCX-ORDERCREATE-FINISH-PLAN.md`](./NDCX-ORDERCREATE-FINISH-PLAN.md).

Plus, in `front-reservation` (same branch), two same-day fixes against the
already-shipped `AmadeusNdcxAdapter.ts` (2026-09-23):

- `9f3f40fd6` — Warn agents in `SelectCompanies` and `result.vue` when a
  selected infant is missing civility/date of birth — NDC[X] pricing 409s
  opaquely ("Offer has expired") in that case.
- `eea7e897a` — `bookFlight()` was reading passengers from `localStorage`
  directly, bypassing the seaman PTC sanitization already applied to
  `bookingFlowStore`'s paxs elsewhere in the booking flow; now sources from
  the store.

**Net (as of 2026-09-23): shopping, offerPrice, and order create/hold +
retrieve are fully wired end-to-end and tested** (fixture-based mapper tests
exist for all three: shopping, order-create, order-view). The create/retrieve
flow is now in a **hardening phase** — contactInfo normalization, guards
against errored/empty replies, pax field completeness (birthdate/gender),
cabin-type mapping fixes, the penalty-availability + currency-decimals bug fix
above, plus front-end bug fixes in `bookFlight()` — rather than initial build.
A few gaps were explicitly triaged and deferred rather than left ambiguous:
**IdentityDoc stays disabled** (trivial, resolved later), **GenderCode derives
from title** (the only source `front-reservation`'s pax type has — accepted,
not an open risk), and **live-host verification is a manual pass** the owner
runs separately, not tracked step-by-step in this repo's docs. See
[`NDCX-ORDERCREATE-FINISH-PLAN.md`](./NDCX-ORDERCREATE-FINISH-PLAN.md) for the
full remaining-work list (SOAPAction version check, duplicate-booking guard,
Corporate/OSI decision, composite `Detail/Application` codes). **Still
greenfield**: pay, cancel/refund/void, order change/reshop, and ancillaries.

## Locked decisions (grilling session, 2026-09-07)

- **Doc location**: this file, at the metis meta-repo root (not inside
  `api-aerial`, not in `obsidian-brain`).
- **Booking is two separate steps**: an order create/hold step, then a
  separate pay/ticket step — not one chained call. Matches TA back-office
  hold-before-pay usage.
- **Cancel/refund/void is one endpoint** (`orderCancelRQ`) with internal
  branching by order/ticket state — not three separate routes. This also
  matches reality: the generic dispatcher only has one cancel route.
- **Tests: one fixture-based mapper test per new operation**, same pattern as
  `ndcx-shopping-reply.mapper.test.js` — no controller/integration tests for
  now. Delivery speed is the priority.
- **Retrieve must include dossier/PNR persistence**, not just a raw
  SOAP-call-and-return. Reference SABRE's pattern: `order.controller.js` calls
  `dossierCreate(...)` from `src/utils/dossier.utils.js` and
  `PnrService.getPnrAndDossierWithOrderid(...)` from `pnr.service.js`.
- **Ancillaries scope: both** `travelServiceList` and `travelSeatAvailability`
  — not service list only.
- **Order change / reshop (`travelOrderChange`/`travelOrderReshop`) is IN
  SCOPE** for this task, added alongside cancel/refund/void even though it
  wasn't in the original next-steps list.
- **One reply mapper for OrderCreate / OrderPay / OrderRetrieve**, because the
  host returns the same `AMA_TravelOrderViewRS` for all three (verified by
  diffing three AF captures). Mirrors SABRE's `formatNDCResponse`; explicitly
  *not* EK/ACCELYA's one-mapper-per-operation split. Detail and ADRs in
  [`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md).
- **`Order.OwnerCode` is the provider (`"AMADEUS_NDCX"`), not the airline.**
  The airline code lives in `Order.BookingRef.BookingEntity.Carrier.
  AirlineDesigCode` and in the synthetic `Order.pnrList`; `Travel_OrderRetrieve`
  recovers it from `pnr.pnrList`, since `pnr.ownerCode` no longer names it.
- **`Order.OrderID` is prefixed `NDCX-`**, SABRE-style, and stripped before every
  host call. `pnr.pnr` is the **airline** record locator; every recloc also goes
  into `Order.pnrList` (plain strings, per `AMADEUS/order.utils.js:1938`) which
  `dossierCreate` fans out into internal notes.
- **Amounts decimalise from the reply's own
  `Metadata/.../CurrencyMetadata/Decimals`**, ISO-4217 table as fallback. This
  supersedes `NDCX-OFFERPRICE-PLAN.md` Trap 1's claim that no decimal indicator
  exists — it does, in both the OfferPrice and OrderView replies.
- **Dossier is created at hold and updated at pay**: `dossierCreate` exactly once
  at `orderCreateRQ`; `saveAfterRetreive` at pay and retrieve. `dossierCreate`
  calls `DossierService.create()` unconditionally, so calling it twice orphans a
  row.
- **Carrier/office pilot scope and deadline are explicitly not tracked** in
  this doc (deemed irrelevant in the session) — don't infer a timeline or
  a carrier list from anything here.

## Open questions / risks — do not assume, resolve before/while building

- **No generic `/orderPayRQ` route exists.** Since booking is two separate
  steps (create/hold, then pay), the pay step has nowhere to hang off the
  shared dispatcher (unlike create/retrieve/cancel/change/reshop, which all
  already have generic routes). Needs one of:
  - a new generic route + `GlobalController.orderPayRQ` method added to
    `global.controller.js` (extends the shared contract — affects all
    providers' route table, bigger change), or
  - an NDC[X]-only route registered directly by
    `controllers/AMADEUS_NDCX/order.controller.js` via
    `AmadeusControllerFactory`'s own `setupRoute` (self-contained, like
    shopping's `/airShoppingRQ` is today), or
  - folding ticketing into an existing route (e.g. how TURKISH_AIRLINES
    seems to route ticketing through order-change — see
    `src/utils/TURKISHA/order/orderChange.utils.js` — worth checking before
    picking this option).
  **Resolved in [`NDCX-ORDERPAY-PLAN.md`](./NDCX-ORDERPAY-PLAN.md) ADR-15**: option 2
  (an NDC[X]-only route). Option 1 is rejected because `global.controller.js`'s
  `?.` guards the *module*, not the *method*, so a new generic route 500s for every
  provider without an `orderPayRQ`; option 3 is rejected as routing but kept as the
  request-body shape. `app.js:202-240` already mounts the folder, so the only work is
  an explicit multi-route `setupRoute`.
- **No shared `Structure` for Order*/ServiceList/SeatAvailability replies.**
  Follow SABRE's ad hoc per-provider shape unless told otherwise.
- **Dossier persistence is shared, cross-provider code** (`dossier.utils.js`,
  `pnr.service.js`). Wiring NDC[X] retrieve/booking into it has blast radius
  beyond this feature — be careful not to regress other providers' dossier
  flows when touching shared helpers; prefer adding NDC[X]-specific call
  sites over modifying shared function bodies.
- **Cancel/refund/void branching condition** (what field(s) on the retrieved
  order distinguish "void" vs "cancel" vs "refund") is not yet defined —
  figure out from the NDCX Travel Management schema / a real retrieved order
  payload before writing the branch logic.
  **Answered as far as the schema allows, in
  [`NDCX-ORDERCANCEL-PLAN.md`](./NDCX-ORDERCANCEL-PLAN.md) ADR-22**: there is no such
  field, and no quote operation to ask for one — `AMA_TravelOrderCancelRQ` has no
  dry-run flag and `Travel_OrderReshop` only reprices/rebooks. So the branch keys off
  metis's own `pnr.status`, and the ticketed VOID-vs-REFUND split has to be classified
  post-hoc from the cancel reply's `TicketDocInfo` coupons — which needs a ticketed
  capture that does not exist yet. Still genuinely open for the ticketed case.

## Steps checklist

### 1. Adapter wiring (provider registration — mirrors SABRE's folder layout)
> Only `offer.controller.js` was created this pass (offerPrice, §2 below). The
> other three controllers stay unbuilt — no stub files either, per
> `NDCX-OFFERPRICE-PLAN.md` §1 ("empty stubs that 500 add nothing but noise").
- [x] `src/controllers/AMADEUS_NDCX/offer.controller.js` → exports
      `OfferController.offerPriceRQ`
- [ ] `src/controllers/AMADEUS_NDCX/service.controller.js` → exports
      `ServiceController.serviceListRQ`
- [ ] `src/controllers/AMADEUS_NDCX/seat.controller.js` (new) → exports
      `SeatController.seatAvailabilityRQ`
- [x] `src/controllers/AMADEUS_NDCX/order.controller.js` → exports
      `OrderController.{orderCreateRQ, orderRetrieveRQ}` (create + retrieve,
      per [`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md)).
      `orderCancelRQ`/`orderChangeRQ`/`orderReshopRQ` still unplanned/unbuilt.
      ⚠️ Unlike `/offerPriceRQ`, these routes are dispatched with real
      `(req, res, next)` and the controller owns the response — does not
      copy `offer.controller.js`'s `sendError` override
      (`global.controller.js:715` vs `:649-655`)
- [ ] Resolve the OrderPay routing open question above (affects
      `order.controller.js`'s shape and/or `global.controller.js`) —
      **planned**, see [`NDCX-ORDERPAY-PLAN.md`](./NDCX-ORDERPAY-PLAN.md) ADR-15
      (dedicated `/AMADEUS_NDCX/order/orderPayRQ`; requires replacing
      `order.controller.js`'s body-sniffing create/retrieve discriminator)
- [x] Sanity-check each new controller actually gets merged via
      `getControllerFiles()`'s existing `"AMADEUS_NDCX"` branch (confirmed for
      `offer.controller.js` — folder-name match on `"offer"`)

### 2. offerPrice
> Planned in detail in [`NDCX-OFFERPRICE-PLAN.md`](./NDCX-OFFERPRICE-PLAN.md)
> (adapter + offerPrice, incl. the front-adapter change it depends on).
- [x] `src/utils/AMADEUS_NDCX/offer.utils.js`: build `travelOfferPrice`
      request payload (mirror `shopping.utils.js`'s
      `createNdcxShoppingPayload` pattern)
- [x] Reply mapper: `src/utils/AMADEUS_NDCX/offerPriceReply.mapper.js` →
      `src/utils/Structure/OfferPriceRs.js` shape. Verified against the AF
      BlueBiz capture (amounts decode to major units, Level 3 sum reconciles
      with Level 2: 30000+620+36854=67474).
- [x] `offer.controller.js` via `AmadeusControllerFactory`, same
      `sendError`/`validateControllerInput` pattern as
      `shopping.controller.js`. Also added
      `src/utils/AMADEUS_NDCX/amount.utils.js` (minor-unit decoder, Trap 1) and
      an `OfferExpiredError` path (ADR-5) — not in the original plan's file
      list but required by it.
- [x] `front-reservation/app/utils/adapters/AmadeusNdcxAdapter.ts` +
      registration in `useOra.ts` (ADR-1 front adapter — ships alongside the
      backend since neither side works without the other).
- [ ] Fixture-based mapper test, mirroring
      `src/utils/__tests__/ndcx-shopping-reply.mapper.test.js` — deliberately
      deferred (ADR-4): needs a live capture from our own office, not the
      vendored AF example. Follow the capture-then-test procedure in
      `NDCX-OFFERPRICE-PLAN.md` §7.

### 3. Flight booking — two steps
> Create/hold planned in detail in
> [`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md) (create + retrieve +
> the shared OrderView mapper + the front adapter it depends on). The pay step is
> planned in [`NDCX-ORDERPAY-PLAN.md`](./NDCX-ORDERPAY-PLAN.md) (ADR-15…20), which
> also resolves the `/orderPayRQ` routing question.
- [x] **Create/hold**: request builder for `travelOrderCreate` (priced offer
      + pax/contact data) → `NdcxService.travelOrderCreate` → reply mapper →
      persist dossier (mirror SABRE's `dossierCreate(...)` call +
      `PnrService` linkage in `order.controller.js`)
- [ ] **Pay**: request builder for `travelOrderPay` (payment/FOP data) →
      wired to whichever route the Open Question above resolves to → reply
      mapper → update dossier ticketing status
- [x] Fixture-based mapper test for create:
      `ndcx-order-create.utils.test.js`, backed by a real capture
      (`ndcx-order-create-body-roundtrip.json`)
- [ ] Fixture-based mapper test for pay — blocked on the pay step itself,
      which doesn't exist yet

### 4. Retrieve (includes dossier persistence — locked decision)
> Planned alongside create in
> [`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md) — it shares the one
> mapper (ADR-6) and the front's `retrieveOrder()` needs it (ADR-13), so the two
> ship together. The "reply mapper → internal order shape" item below is
> therefore satisfied by create's mapper, not a second one.
- [x] Request builder for `travelOrderRetrieve`
- [x] Reply mapper → internal order shape (shared with create, ADR-6)
- [x] Wire into dossier/PNR persistence (`dossierCreate` /
      `PnrService.getPnrAndDossierWithOrderid`, SABRE-style)
- [x] `order.controller.js`'s `orderRetrieveRQ`
- [x] Fixture-based mapper test — `ndcx-orderview-reply.mapper.test.js`,
      backed by a real capture (`ndcx-orderview-reply-roundtrip.json`)

### 5. Cancel / Refund / Void (one endpoint, branching by state)
> Planned in [`NDCX-ORDERCANCEL-PLAN.md`](./NDCX-ORDERCANCEL-PLAN.md) (ADR-21…26).
> Two findings there change the shape of this item: the cancel reply is **not** an
> OrderView, so ADR-6's one-mapper decision does not extend to it (ADR-21); and
> `updateCancel` would fire Amadeus **passive-PNR cancellation against the real
> airline record** for every NDC[X] dossier (ADR-23 — a one-line shared guard that
> must land with this step).
- [ ] Resolve the branching-condition open question above — **planned**, ADR-22:
      no quote operation exists on this interface, so the branch keys off
      `pnr.status`; held-order CANCEL is buildable now, ticketed VOID/REFUND is
      blocked on a ticketed capture (sequence after the pay step)
- [ ] Request builder for `travelOrderCancel`
- [ ] Branching logic (void vs cancel vs refund) based on order/ticket state
- [ ] Reply mapper
- [ ] `order.controller.js`'s `orderCancelRQ`
- [ ] Fixture-based mapper test

### 6. Order change / reshop (in scope per 2026-09-07 session)
> `travelOrderReshop`/`travelOrderChange` are **already shipped** for two narrower uses: the
> cancel quote (`orderReshop.utils.js`, [`NDCX-ORDERCANCEL-PLAN.md`](./NDCX-ORDERCANCEL-PLAN.md)
> ADR-27/29) and the ancillary add + passenger update (`orderChange.utils.js`/`updatePax.utils.js`,
> ADR-36 and ADR-45…51). What remains is **voluntary flight change** — the agent names a
> replacement flight for an existing bound — planned in
> [`NDCX-FLIGHTCHANGE-PLAN.md`](./NDCX-FLIGHTCHANGE-PLAN.md) (ADR-52…59). It needs its own request
> builder and reply mapper (the EXCHANGE reshop reads a different reply shape than the cancel
> quote) and two new routes, since `/orderReshopRQ` and `/orderChangeRQ` are both already taken by
> the uses above.
- [ ] Request builder + reply mapper for the EXCHANGE reshop (`orderExchange.utils.js`) — planned
- [ ] `order.controller.js`'s `orderFlightReshopRQ` (quote) + `orderFlightChangeRQ` (confirm) —
      planned
- [ ] Fixture-based mapper tests + a call-sequence test — planned

### 7. Ancillaries (service list + seat availability — both in scope)
- [ ] Request builder + reply mapper + `service.controller.js`'s
      `serviceListRQ` for `travelServiceList`
- [ ] Request builder + reply mapper + `seat.controller.js`'s
      `seatAvailabilityRQ` for `travelSeatAvailability`
- [ ] Fixture-based mapper test for each
