# NDC[X] Next Step — Provider Adapter + `offerPrice` — MET2-2422

Companion to [`NDCX-INTEGRATION.md`](./NDCX-INTEGRATION.md) (the standing source of
truth for the whole integration). This file plans **only** the next step: registering
`AMADEUS_NDCX` as an offerPrice-capable provider and implementing
`Travel_OfferPrice` end to end.

Repos: `api-aerial` (branch `deyra-met2-2422`) **and** `front-reservation`.
Written from code inspection + the vendored Amadeus knowledge base at
`.agent/skills/ndcx/` + a grilling session on 2026-09-07. Decisions below are
locked as of that date; update in place.

---

## 1. Scope

**In scope**

- `src/controllers/AMADEUS_NDCX/offer.controller.js` — the provider adapter for
  the existing generic `POST /offerPriceRQ` route.
- `Travel_OfferPrice` request builder + reply mapper into
  `src/utils/Structure/OfferPriceRs.js`.
- A currency/amount decoder (see [Trap 1](#trap-1--two-amount-conventions-in-one-flow) — this is not optional).
- `front-reservation/app/utils/adapters/AmadeusNdcxAdapter.ts` + registration in
  `useOra.ts`.
- One fixture-based mapper test, from a **live capture** (see §7).

**Explicitly not in scope** (stays in `NDCX-INTEGRATION.md`'s checklist)

- `service.controller.js`, `seat.controller.js`, `order.controller.js`. No stub
  files either — the dispatcher already fails loudly on a missing controller, and
  empty stubs that 500 add nothing but noise.
- The `/orderPayRQ` routing question. Untouched by offerPrice.
- Ancillary/servicing `Travel_OfferPrice` (the 2nd-and-later OfferPrice calls in
  `.agent/skills/ndcx/examples/servicing/`). Prime-booking pricing only.
- Carrier/office pilot scope — deliberately not tracked (see `NDCX-INTEGRATION.md`).

---

## 2. Decisions taken this session (ADRs)

### ADR-1 — The four mandatory IDs reach the backend via a new front adapter

**Context.** `Travel_OfferPrice` mandates four values carried from shopping
(NDC[X] rule 7): `ShoppingResponseRefID`, `OfferRefID`, `OfferItemRefID`(s) and
the airline `OwnerCode`. Today only two survive the round-trip. The generic
`BaseAdapter.getOffer()`
(`front-reservation/app/utils/adapters/BaseAdapter.ts:308-370`) sends:

```ts
OfferID: offer.OfferID,
OfferIdList: offer.OfferIdList,          // carries OfferItemRefID — OK
responseId: offer.reponseId ?? bookingFlow().shoppingResponseId,
AirlineDesigCode: bookingFlow().ora,     // "AMADEUS_NDCX", not the airline
```

`offer.reponseId` (sic — misspelled in the front) is a key the NDC[X] mapper never
emits, and `bookingFlow().shoppingResponseId` is never set by the NDC[X] shopping
flow, so `responseId` arrives empty. Meanwhile the NDC[X] mapper keeps the real
values under different names: per-offer `ShoppingResponseId` and
`validatingCarrier`, with `OwnerCode` hardcoded to the literal string
`"AMADEUS_NDCX"` (`shoppingReply.mapper.js:24,199-206`).

**Decision.** Add a dedicated `AmadeusNdcxAdapter` in `front-reservation` that
overrides `getOffer()` and echoes the NDC[X] fields verbatim. Do **not** encode
the IDs into an opaque `OfferID` blob, and do **not** repurpose the shared
`OwnerCode` field.

**Consequences.**
- This step is a two-repo change. The backend cannot be exercised end-to-end
  until the front adapter ships.
- `ShoppingResponseId` stays **per-offer**, which is correct: MasterPricer returns
  one `internalId` per `offersGroup` (`shoppingReply.mapper.js:257`), so a single
  scalar at flow level would be wrong for multi-group replies.
- The already-tested shopping mapper and its fixtures stay untouched.

### ADR-2 — Price from Level 3, and do our own summing

**Context.** The guide returns the priced offer at three levels
(`.agent/skills/ndcx/references/03-prime-booking-flow.md:120-133`). Level 1
(`Offer/TotalPrice`) is flagged for deprecation — "recommended NOT to use".
Level 2 (`OfferItem/Price/TotalAmount`) is base + tax + surcharges but excludes
CC/OB fees. Level 3 (`OfferItem/FareDetail/Price`) is the fully-normalized
breakdown including CC fees, but **does not sum** — the client must.

**Decision.** Read Level 3 and implement the summing.

**Consequences.** Only option that can ever surface OB/CC fees, and the guide
guarantees its breakdown accuracy. Costs us arithmetic that must be test-covered.
Level 1 is never read.

### ADR-3 — Generic *N* offer items, driven by `OfferIdList`

**Context.** `offerItemID` granularity is provider-dependent: AF/KL and Altéa NDC
return **one** `offerItemID` for all travellers; Accelya returns **one per PTC**
(`03-prime-booking-flow.md:47`). Beyond that, VY prices per bound and QF
per-bound-per-PTC (captured examples exist for both).

**Decision.** Emit one `SelectedOfferItem` per entry in the incoming
`OfferIdList`, each with its own `PaxRefID` group. Guard and fail clearly on
per-bound multi-`SelectedOffer` shapes (VY/QF).

**Consequences.** Covers Altéa/AF-KL *and* Accelya per-PTC for free, because
`buildOfferIdList()` (`shoppingReply.mapper.js:280-290`) already produces exactly
one entry per offer item with resolved `PaxRefID`s. Per-bound carriers are a
later, separate task with no own-office capture to verify against today.

### ADR-4 — The reply fixture comes from our own live capture

**Context.** `api-aerial/use cases/NDCX/` holds only the two MasterPricer RQ/RS
pairs — there is no OfferPrice capture from our office. The vendored AF examples
exist but are from another office and had repeating elements trimmed to 3.

**Decision.** Build the builder and mapper against the AF example as a *reference*,
then run the real flow from the front in development, capture the logged
`Travel_OfferPriceAsync` RQ/RS, and generate the fixture from our own capture.

**Consequences.** The mapper test lands **after** the wiring works, not before.
This is a deliberate ordering, not an oversight — see §7 for the procedure. It
works because `ndcxLogger` already writes raw RQ/RS XML into `use cases/NDCX/`
in development (`ndcxLogger.js:56-59`), the same folder the existing shopping
fixture generator reads from.

### ADR-5 — Reject expired offers locally, never reprice or auto-reshop

Not a fork — rules 8 and 10 make it mandatory. An offer past its Offer Time Limit
**must** be re-shopped, and we must never build re-shop retry loops (look-to-book
is capped at 1000 offers : 1 order). So the controller checks
`OfferExpirationDateTime` before spending a call, and returns a distinct error the
front can act on by re-shopping. `OfferExpirationDateTime` is therefore added to
the fields ADR-1's adapter echoes.

---

## 3. Domain model — the ID lifecycle

The whole feature is an exercise in carrying identifiers across a boundary
without corrupting them. Four IDs enter, four different IDs leave.

```
Fare_MasterPricerTravelBoardSearch  (TST 1.0 WSDL, legacy endpoint)
  offersGroup/response/applicationDetails/internalId ──┐  ShoppingResponseID
  offers/offerDetails/uniqueOfferReference ────────────┤  OfferID
  offers/offerItems/offerItemDetails/offerItemId ──────┤  OfferItemID(s)
  recommendation/../codeShareDetails/company ──────────┘  OwnerCode (the airline)
        │
        │  mapNdcxShoppingReply  ->  AirShoppingRs
        │    offer.ShoppingResponseId · offer.OfferID
        │    offer.OfferIdList[].OfferItemRefID · offer.validatingCarrier
        │
        │  [ADR-1] AmadeusNdcxAdapter.getOffer() echoes all four + expiry
        ▼
Travel_OfferPrice  (Travel Management 1.14 WSDL, stateless)
  Request/PricedOffer/SelectedOffer/ShoppingResponseRefID
                                   /OfferRefID
                                   /OwnerCode
                                   /SelectedOfferItem[]/OfferItemRefID + PaxRefID
        │
        ▼
  Response/ShoppingResponse/ShoppingResponseID ────┐  *new* pricing IDs,
  Response/PricedOffer/Offer/OfferID ──────────────┤  which supersede the
  Response/PricedOffer/Offer/OwnerCode ────────────┤  shopping ones and feed
  Response/PricedOffer/Offer/OfferItem/OfferItemID ┘  Travel_OrderCreate later
```

Two things about this diagram are load-bearing:

- **Element names change between calls for the same value.** OfferPrice uses
  `OfferRefID` / `OfferItemRefID`; OrderCreate uses `OfferID` / `OfferItemID`.
  `ShoppingResponseRefID` is spelled the same in both.
- **The reply's IDs are new, not echoes.** OrderCreate must consume the *pricing*
  IDs, never the shopping ones. So the mapper has to surface them, which is what
  `OfferPriceRs.OfferID` / `.ResponseID` / `OrderItems[].OfferItemID` are for.

**`PaxID` is ours and must stay stable across every call in the flow.** Shopping
issues `PAX1..PAXn` (`shoppingReply.mapper.js:534-537`); OfferPrice must reuse
exactly those, and so must OrderCreate/OrderPay afterwards.

### Infant modelling differs between shopping and pricing

This is not a copy-paste from `shopping.utils.js`. The same relationship is
expressed two different ways:

| | Shopping (MasterPricer) | OfferPrice (NDC) |
|---|---|---|
| Where the link lives | separate `paxReference` block, `traveller.ref` = the **adult's** ref + `infantIndicator="1"` | `PaxRefID` on the **adult's** `Pax`, pointing at the infant's `PaxID` |
| Infant in head count | excluded from the `PX` unit | listed as its own `Pax` with `PTC=INF` |
| Extra required fields | none | `Birthdate` (`YYYY-MM-DD`) **and** `GenderCode` |

---

## 4. Traps confirmed against real captures

### Trap 1 — Two amount conventions in one flow

**Verified.** MasterPricer returns **decimal major units**; Travel_OfferPrice
returns **integer minor units**.

> ⚠️ **Corrected 2026-09-07** (`NDCX-ORDERCREATE-PLAN.md` ADR-10). This trap
> originally said "with no decimal-places indicator anywhere". That is wrong.
> Every Travel Management reply — OfferPrice and OrderView alike — carries
> `Response/Metadata/Other/OtherMetadata/CurrencyMetadatas/CurrencyMetadata[@MetadataKey="EUR"]/Decimals`
> (= `2` in the AF captures), and the guide names that path as the one to read
> (`references/03-prime-booking-flow.md:388,690`). `amount.utils.js`'s hardcoded
> ISO-4217 exponent table should read the metadata first and keep the table only
> as a fallback. Its `sumNdcxAmounts` also rounds at a hardcoded `* 100`, which
> truncates 3-decimal currencies (BHD, JOD, KWD, OMR, TND, LYD).

```
use cases/NDCX/...MasterPricerTravelBoardSearchAsync-RS.xml
  <amount>513.09</amount>                       ->  513.09 EUR

.agent/skills/ndcx/examples/prime-booking/AF-OIN-BLUEBIZ/2-Reply-Travel-OfferPrice.xml
  <BaseAmount Code="EUR">30000</BaseAmount>     ->  300.00 EUR
  <Total Code="EUR">36854</Total>               ->  368.54 EUR
  <TotalAmount CurCode="EUR">67474</TotalAmount> -> 674.74 EUR
```

Reusing shopping's `toNumber(amount)` here inflates every price **100×**. The
shopping mapper's amount handling (`shoppingReply.mapper.js:142-149`) must not be
copied into the offer mapper.

There is no existing currency-exponent helper anywhere in `api-aerial` (checked),
so this needs a new one. Note also the inconsistent attribute names — `Code` on
`BaseAmount`/`Total`, `CurCode` on `TotalAmount` — and that both land under
`$attributes`, because `NdcxClient` sets `attributesKey: "$attributes"`.

### Trap 2 — `PaxRefID` cardinality is per-service

OfferPrice puts multiple travellers in **one** space-separated element
(`<PaxRefID>T1 T2</PaxRefID>`); OrderCreate uses **repeated** elements
(`03-prime-booking-flow.md:43,153,701`). `node-soap` serializes a JS array as
repeated elements, so for OfferPrice the builder must `.join(" ")` into a single
string. Passing the array straight through produces a schema-invalid request.

### Trap 3 — Element order is enforced

These services are schema-validated and the host rejects reordered children. Build
the payload object with keys in the documented order and match
`.agent/skills/ndcx/examples/` exactly — the JS object's insertion order *is* the
XML order.

### Trap 4 — The generated types will not help you

`AmaTravelOfferPriceRq` resolves to a generic `Request` interface shared across all
nine Travel operations (`src/types/NDCX/ndcxpdttravelmanagement11440/definitions/` —
3688 files, `Request.d.ts` through `Request8.d.ts`, every member optional). It
will not catch a wrong shape. The captured XML is the authority.

### Trap 5 — `validatingCarrier` can be `null`

`shoppingReply.mapper.js:152-155` falls through two `codeShareDetails` lookups to
`null`. `OwnerCode` is mandatory at pricing, so a null carrier must be caught in
validation with a clear message rather than sent as an empty element. See §8.

### Trap 6 — SOAPAction version drift

`NdcxClient.js:70` declares `Travel_OfferPrice_1.3`, matching the guide's service
list. The captured AF example was taken against `1.2`. Keep 1.3; if the host
rejects the message, check this first.

---

## 5. `api-aerial` implementation checklist

### 5.1 `src/utils/AMADEUS_NDCX/amount.utils.js` (new)

- [ ] `parseNdcxAmount(node)` → `{ amount: number, currency: string }`, reading the
      integer text plus `$attributes.Code ?? $attributes.CurCode`, and dividing by
      the currency's minor-unit exponent.
- [ ] Exponent table: default `2`; `0` for JPY, KRW, VND, CLP, ISK, XOF, XAF, PYG,
      RWF, UGX, VUV, GNF, KMF, DJF, BIF; `3` for BHD, IQD, JOD, KWD, OMR, TND, LYD.
- [ ] `sumNdcxAmounts(...)` guarding against mixed currencies in one offer item.

### 5.2 `src/utils/AMADEUS_NDCX/offer.utils.js` (new)

- [ ] `createNdcxOfferPricePayload(body)`, mirroring
      `createNdcxShoppingPayload`'s validate-then-build structure.
- [ ] `Party.Sender.TravelAgency` = `{ AgencyID: "unused", PseudoCityID: "unused" }`
      — unused but mandatory.
- [ ] `Request.DataLists.PaxList.Pax[]`: reuse shopping's `PAX{n}` IDs; `PTC` via
      `getPaxCodeFromMetis` (CNN never CHD, rule 5); infant linkage in the
      **OfferPrice** form per §3, incl. `Birthdate` + `GenderCode`.
- [ ] `Request.PricedOffer.SelectedOffer`:
      `OfferRefID` ← `body.OfferID`, `OwnerCode` ← `body.OwnerCode`,
      `ShoppingResponseRefID` ← `body.ShoppingResponseId`.
- [ ] One `SelectedOfferItem` per `body.OfferIdList` entry (ADR-3), with
      `PaxRefID` **space-joined** (Trap 2).
- [ ] Reject: missing/expired `OfferExpirationDateTime` (ADR-5), missing
      `OwnerCode` (Trap 5), empty `OfferIdList`, any `OfferItemRefID` of `null`.

### 5.3 `src/utils/AMADEUS_NDCX/offerPriceReply.mapper.js` (new)

`mapNdcxOfferPriceReply(reply, body)` → the `OfferPriceRs` shape. Paths below are
confirmed against the AF capture, not read off prose.

- [ ] `ResponseID` ← `Response.ShoppingResponse.ShoppingResponseID`
- [ ] `OfferID` ← `Response.PricedOffer.Offer.OfferID`;
      `OfferExpirationDateTime` ← same node's field. Also carry
      `OwnerCode` / `ValidatingCarrierCode` and `PaymentTimeLimitDateTime`
      (OrderCreate and the hold step need them).
- [ ] `DataLists` ← `Response.DataLists.{PaxList, PaxSegmentList, BaggageAllowanceList}`
      (the reply also carries `FareList`, `OriginDestList`, `PaxJourneyList`).
- [ ] `BaggageAllowance` ← `Offer.BaggageAllowance[]`
      `{PaxJourneyRefID[], PaxRefID, BaggageAllowanceRefID}`.
- [ ] `OrderItems[]` — one per `Offer.OfferItem`, shaped to match SABRE's
      `buildOrderItemsFromOffer` (`src/utils/SABRE/offer.utils.js:515-535`) so the
      front consumes it unchanged:
      `{ PaxRefID[], Fare, FarePriceType, MandatoryInd, OfferItemID, Price, service, bagages }`.
- [ ] `Price` per item, from **Level 3** `OfferItem.FareDetail.Price` (ADR-2),
      shaped like `normalizePriceComponents` (`SABRE/offer.utils.js:412-460`):
      `{ BaseAmount, Loyalty, Taxes[], TotalTaxAmount, TotalAmount }` where
      `Taxes[] = { TaxCode, AddlTaxCode, Amount }`.
      Sum = `BaseAmount` + `Surcharges.Surcharge[].Total` + `Taxes.Total`.
      Every read goes through `parseNdcxAmount` (Trap 1).
- [ ] ⚠️ **Penalty normalization is wrong as shipped** — `buildPenalties`
      (`offerPriceReply.mapper.js:246-266`) emits `AppCode: "1"|"2"|"3"` and
      `TypeCode: "Cancel"`, but `dossier.utils.js:1666-1710` matches on
      `date === "PDE"|"ADE"` and `title === "Cancellation"`, so those conditions
      match nothing. Fix via the shared normalizer in
      `NDCX-ORDERCREATE-PLAN.md` ADR-11 (`{1:"NOS",2:"PDE",3:"ADE"}`,
      `Cancel → Cancellation`). Safe to change: ADR-4 deferred this mapper's
      test, so nothing asserts the broken values.
- [ ] `PaxRefID` ← `OfferItem.FareDetail.PassengerRefs` (split on whitespace —
      it comes back space-separated, mirroring Trap 2).
- [ ] `PaymentInfo` ← `Response.Payments.PaymentInfo` when present; `[]` otherwise.
      (Iberia's installment `PlanCode` lives here and OrderPay will need it — map
      it through even though nothing consumes it yet.)
- [ ] Surface `reply.Error[]` as `Errors` in the `OfferPriceRs` shape.

### 5.4 `src/controllers/AMADEUS_NDCX/offer.controller.js` (new)

Copy the structure of `shopping.controller.js` — it already solves the dispatcher's
quirks.

- [ ] `new AmadeusControllerFactory("/offerPriceRQ")`.
- [ ] Override `sendError` to **return** the shaped error and never touch `res` —
      the dispatcher calls `handleRequest({ body })` with no real response object
      (`global.controller.js:649-652`).
- [ ] `validateControllerInput`: `paxs` non-empty, `OfferID`, `OfferIdList`
      non-empty, `ShoppingResponseId`, `OwnerCode`.
- [ ] `processRequest`: `NdcxService.create(req.salesPoint)` →
      `travelOfferPrice(payload)` → `mapNdcxOfferPriceReply`. Stateless (rule 1),
      so no session lifecycle; still `close()` in a `finally` for symmetry (it
      no-ops when `isStateful` is false).
- [ ] Map `NdcxError` → 502, everything else → 500, as shopping does.
- [ ] Export `{ OfferController: { offerPriceRQ: (body) => c.handleRequest({ body }) }, setupRoute }`.

**No dispatcher change is needed.** `POST /offerPriceRQ` already exists
(`global.controller.js:780`) and `getControllerFiles()` already has the
`AMADEUS_NDCX` folder branch (`global.controller.js:193-194`), so a
correctly-shaped file in that folder is picked up automatically.

Credentials come for free: the factory resolves `req.salesPoint` from
`body.agenceInfo.id_sales_point` and validates `OfficeID`, `Amadeus-officeId`,
`Amadeus-url`, `Amadeus-password`, `Amadeus-userId`, `Amadeus-wasp`,
`Amadeus-bsp-region` (`amadeusControllerFactory.js:49-88`).

---

## 6. `front-reservation` implementation checklist

- [ ] `app/utils/adapters/AmadeusNdcxAdapter.ts`, extending `BaseAdapter`,
      overriding `getOffer()` to send — on top of the base fields (`oras`, `paxs`,
      `agenceInfo`, `TotalPrice`, `indexOffer`):

      OfferID                 <- offer.OfferID
      OfferIdList             <- offer.OfferIdList
      ShoppingResponseId      <- offer.ShoppingResponseId      // per-offer, ADR-1
      OwnerCode               <- offer.validatingCarrier        // the airline
      OfferExpirationDateTime <- offer.OfferExpirationDateTime  // ADR-5

- [ ] Keep `BaseAdapter`'s MET2-2345 anti-race token (`nextPricingRequest()` /
      `setSelectedOfferIfCurrent`) — call `super.getOffer()`-style or replicate it;
      dropping it reintroduces the stale-response bug.
- [ ] Register in `app/utils/useOra.ts`'s `ORAS` array: `{ oras: ["AMADEUS_NDCX"], Adapter: AmadeusNdcxAdapter }`.

> **Sequencing note.** `useOra()` throws `"Cant use adapter: ora not found"` for any
> unregistered ora, and there is no `AMADEUS_NDCX` entry today. So this
> registration is a prerequisite for driving *any* NDC[X] flow from the front —
> including the shopping call needed to produce an offer to price, and therefore
> including the capture in §7. Do the front adapter first, not last.
>
> Also, because `AIRLINE_TO_PROVIDER["AMADEUS_NDCX"] = "AMADEUS_NDCX"` has no
> per-carrier redirect, the front must send `oras: ["AMADEUS_NDCX"]` explicitly to
> opt in.

---

## 7. Capture-then-test procedure (ADR-4)

1. Ship §6 and §5 far enough that the call round-trips (a mapper that throws is
   fine at this point — the log is written either way).
2. Run `api-aerial` with `NODE_ENV=development` and drive shopping → select an
   offer → price it from the front, against the CDG↔JFK route our existing
   MasterPricer capture uses.
3. `writeNdcxCallLogs` drops
   `…-NDCX-<SalesPoint>-Travel_OfferPriceAsync-RQ.xml` / `-RS.xml` into
   `api-aerial/use cases/NDCX/` (`ndcxLogger.js:56-59`). Keep both — the RQ proves
   the builder, the RS feeds the fixture.
4. [ ] Add `src/utils/__tests__/fixtures/generate-ndcx-offerprice-fixture.js`,
   modeled on `generate-ndcx-fixture.js`, with two changes: point `WSDL_PATH` at
   `NDCX_PDT_Travel_Management_1.14_4.0.wsdl`, and unwrap
   `parsed?.Body?.AMA_TravelOfferPriceRS`. **Reuse `CLIENT_OPTIONS` verbatim**
   (`forceItemsEnumerable`, `attributesKey: "$attributes"`, `ignoredNamespaces`) —
   they change which nodes come back as arrays, so the fixture is only faithful if
   they match `NdcxClient.create`.
5. [ ] Add `src/utils/__tests__/ndcx-offerprice-reply.mapper.test.js`, mirroring
   `ndcx-shopping-reply.mapper.test.js`, asserting:
   - referential integrity — every `PaxRefID` / `BaggageAllowanceRefID` /
     segment ref in `OrderItems` resolves inside `DataLists`;
   - `PaxID`s match the `PAX{n}` set shopping issued;
   - amounts are decoded to major units (Trap 1) — a `BaseAmount` of `30000`
     must assert as `300.00`, not `30000`;
   - the Level 3 sum reconciles against Level 2's `OfferItem/Price/TotalAmount`.
     This holds on the AF capture (`30000 + 620 + 36854 = 67474`) and is a cheap
     way to catch a normalization gap. *Test-only assertion — ADR-2 keeps Level 3
     as the single production source; this does not add a runtime cross-check.*
   - the pricing `OfferID` / `ResponseID` / `OfferItemID`s are surfaced, since
     OrderCreate depends on them.

Until step 5 lands, the AF example
(`.agent/skills/ndcx/examples/prime-booking/AF-OIN-BLUEBIZ/2-Reply-Travel-OfferPrice.xml`)
is the working reference. Do not commit it as the fixture.

---

## 8. Open questions — resolve while building, don't assume

- **Does the NDC[X] sales point carry `Amadeus-bsp-region`?** The factory rejects
  the request outright if it's missing or blank
  (`amadeusControllerFactory.js:71`), and the office must additionally be
  NDC-activated. Worth confirming on the PDV used for testing *before* debugging a
  failing call — the error surfaces as a generic validation string.
- **Do the front's `paxs` carry infant `Birthdate` and `GenderCode` at pricing
  time?** OfferPrice requires both; shopping needed neither, so nothing has forced
  them to be populated yet. If they're absent the front change grows beyond
  `getOffer()`, so check this early.
- **What to do when `validatingCarrier` is `null`** (Trap 5): fail with a "cannot
  price — unknown validating carrier" error, or fall back to the first segment's
  marketing carrier? Failing is safer (a wrong `OwnerCode` risks a mispriced
  order); confirm against a real reply where the field is empty before choosing.
- **Is `Response.Payments` populated for AF?** It's absent from the BlueBiz
  capture. Affects whether `PaymentInfo` can be anything but `[]` before OrderPay
  is built.

---

## 9. Definition of done

- [ ] `POST /offerPriceRQ` with `oras: ["AMADEUS_NDCX"]` returns a populated
      `OfferPriceRs` for a real CDG↔JFK NDC offer.
- [ ] Prices displayed on the front match the airline's, to the cent (Trap 1).
- [ ] An expired offer returns the re-shop error without a host call (ADR-5).
- [ ] Own-office RQ/RS captured in `use cases/NDCX/` and committed as a fixture.
- [ ] `ndcx-offerprice-reply.mapper.test.js` green.
- [ ] The pricing `OfferID` / `ResponseID` / `OfferItemID`s are present in the
      response, so `Travel_OrderCreate` can be built on top without re-pricing.
- [ ] `NDCX-INTEGRATION.md` §2 checklist ticked, and its "Adapter wiring" item
      annotated to say only `offer.controller.js` was created.

---

## 10. Glossary

| Term | Meaning here |
|---|---|
| **NDC[X]** | Amadeus' productized NDC offering. A separate provider (`AMADEUS_NDCX`), not a mode of the classic `AMADEUS` SOAP provider. |
| **Offer** | A priceable, time-limited bundle from one airline. Identified by `OfferID`, owned by `OwnerCode`. Expires at its OTL. |
| **OfferItem** | A priceable line inside an Offer, scoped to one or more passengers. Granularity is carrier-dependent (ADR-3). |
| **ShoppingResponseID** | The airline's handle for the shopping session that produced an Offer. In MasterPricer it is `offersGroup/response/applicationDetails/internalId`, and it is **per offers-group**, not per reply. |
| **OwnerCode** | The **airline** code (`AF`, `IB`, `QF`) that owns the offer. Not the provider name — the internal shape's `OwnerCode` field holds the literal `"AMADEUS_NDCX"`, and the airline lives in `validatingCarrier`. |
| **OTL / Offer Time Limit** | Airline-set expiry, GMT, 15–30 min by carrier, in MasterPricer as an `OTL`-qualified date/time. Past it, re-shop; repricing is not allowed. |
| **PTC** | Passenger Type Code. `ADT`, `CNN` (child — never `CHD`), `INF`. Required at pricing. |
| **PaxID** | *Our* client-assigned passenger identifier (`PAX1`…). Must stay stable across shopping → OfferPrice → OrderCreate → OrderPay. |
| **Minor units** | Amount convention in the Travel Management services: an integer with the currency's decimals implied and no indicator (`67474` EUR = 674.74). MasterPricer does *not* use it (Trap 1). |
| **Level 1 / 2 / 3** | The three price granularities in an OfferPrice reply. L1 = `Offer/TotalPrice` (deprecating, unused); L2 = `OfferItem/Price/TotalAmount`; L3 = `OfferItem/FareDetail/Price` breakdown (our source, ADR-2). |
| **Altéa NDC / Accelya** | The two airline IT providers behind NDC content. They normalize differently — most visibly in `offerItemID` granularity. |
| **TST 1.0 vs Travel Management 1.14** | The two WSDLs behind `NdcxService`. Shopping runs on the legacy TST endpoint (`masterPricerSearch`); every NDC operation including `travelOfferPrice` runs on Travel Management, always stateless. |
| **Look-to-book** | Amadeus' 1000 offers : 1 order ceiling. Why no retry/re-shop loops are allowed (rule 10). |
