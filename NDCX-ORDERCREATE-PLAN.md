# NDC[X] Next Step — Order Booking (`Travel_OrderCreate`) + shared OrderView mapper — MET2-2422

Companion to [`NDCX-INTEGRATION.md`](./NDCX-INTEGRATION.md) (standing source of truth
for the whole integration) and [`NDCX-OFFERPRICE-PLAN.md`](./NDCX-OFFERPRICE-PLAN.md)
(the previous step, which this one consumes). This file plans **only** the
create/hold half of booking plus the reply mapper it shares with retrieve.

Repos: `api-aerial` (branch `deyra-met2-2422`) **and** `front-reservation`.
Written from code inspection + the vendored Amadeus knowledge base at
`.agent/skills/ndcx/` + a grilling session on 2026-09-07. Decisions below are
locked as of that date; update in place.

---

## 1. Scope

**In scope**

- `src/controllers/AMADEUS_NDCX/order.controller.js` exporting
  `OrderController.{orderCreateRQ, orderRetrieveRQ}` for the two generic routes
  that already exist.
- `Travel_OrderCreate` request builder.
- **One** reply mapper, `mapNdcxOrderViewReply`, into
  `src/types/DossierCreatePayload.d.ts`'s `DossierCreate` shape — consumed by
  `dossierCreate()` on create and by `saveAfterRetreive()` on retrieve, and
  returned to the front as `value` (ADR-6, ADR-7).
- `Travel_OrderRetrieve` request builder + dossier/PNR persistence (a locked
  decision in `NDCX-INTEGRATION.md`, and a prerequisite for the front's
  `retrieveOrder()`).
- A shared penalty normalizer, applied to **both** the offerPrice and OrderView
  mappers (ADR-11).
- `amount.utils.js` extension to read the reply's own currency-decimals metadata
  (ADR-10).
- `front-reservation`: `AmadeusNdcxAdapter.bookFlight()` + `.retrieveOrder()`
  (ADR-13).
- One fixture-based mapper test, from a **live capture** (§7).

**Explicitly not in scope** (stays in `NDCX-INTEGRATION.md`'s checklist)

- `Travel_OrderPay` and the `/orderPayRQ` routing open question. The mapper is
  designed to cover the OrderPay reply (it is the same document — §3), but the
  pay request builder, the route decision and `updateIssuance` wiring are the
  next step.
- `orderCancelRQ` / `orderChangeRQ` / `orderReshopRQ`, `service.controller.js`,
  `seat.controller.js`. No stub files, same reasoning as
  `NDCX-OFFERPRICE-PLAN.md` §1.
- Corporate/OSI persistence (ADR-14 defers it — §8).
- Carrier/office pilot scope — deliberately not tracked.

---

## 2. Decisions taken this session (ADRs)

Continues the numbering in `NDCX-OFFERPRICE-PLAN.md` §2 (ADR-1 … ADR-5).

### ADR-6 — One mapper for OrderCreate, OrderPay and OrderRetrieve

**Context.** `Travel_OrderCreate`, `Travel_OrderPay` and `Travel_OrderRetrieve`
all return the **same document**, `AMA_TravelOrderViewRS`
(`references/03-prime-booking-flow.md:142,669`). Verified structurally, not read
off prose — diffing the element paths of the three AF-Public-SAF-Bundle captures
gives only these deltas:

| Present at | Elements |
|---|---|
| create only | `Order/PaymentTimeLimitDateTime`, `Order/OrderItem/PaymentTimeLimitDateTime`, `Order/OrderItem/Disclosure`, `PaxSegment/DatedOperatingLeg/ChangeofGaugeInd` |
| pay + retrieve only | `TicketDocInfos/*`, `Warning/{Code,DescText}`, `Order/PaymentInfo` (the *used* FOP), `PaxSegment/SecureFlightInd`, `OperatingCarrierInfo/Disclosure` |

Every difference is additive or conditional. Nothing is *reshaped* between calls.

**Decision.** One function, `mapNdcxOrderViewReply(reply, body)`, in
`src/utils/AMADEUS_NDCX/orderViewReply.mapper.js`. Every branch is presence-driven
(`if (TicketDocInfos) …`), never operation-driven. No `mode: "create" | "retrieve"`
parameter.

**Consequences.**
- The mapper must already handle `TicketDocInfos` and `Warning` in this step even
  though only OrderPay/OrderRetrieve produce them — otherwise retrieve regresses
  the moment it ships.
- The OrderPay step (next) needs no new mapper, only a request builder.
- This matches the only two providers that got it right: **SABRE** uses
  `formatNDCResponse` (`SABRE/orderView.utils.js:159`) for create
  (`order/create.js:549`), retrieve (`order/retrieve.js:283,443`), orderChange
  (`order/change.ndc.js:358,389`) and OCN (`ocn.controller.js:119`); its GDS path
  reuses `createJsonRS` the same way (`orderRetrieve.utils.js:1` literally
  re-exports `orderCreation.utils`'s). **AFKL** passes
  `IATA_OrderViewRS.Response` raw to both (`AFKL/order.controller.js:392`),
  because its wire shape *is* the target.
  EK and ACCELYA keep separate `orderCreation` / `orderRetrieve` /
  `orderCancel` mappers and pay for it — EK ends up calling the *creation*
  mapper on a *retrieve* reply to feed `saveAfterRetreive`
  (`EK/order.controller.js:693`, comment: `// orderCreation format — for
  saveAfterRetreive`). Do not copy EK.

### ADR-7 — The mapper targets `DossierCreatePayload.DossierCreate`

**Context.** `dossierCreate(jsonRS, body, decodedToken, jwtToken)`
(`dossier.utils.js:852`) is typed `@param {import("../types/DossierCreateAF").Root}`
and reads **`._text`-wrapped leaves with `._attributes`** throughout —
`dataRS.Order.OwnerCode._text`, `dataRS.Order.TotalPrice.TotalAmount._attributes.CurCode`,
`paxRS.PaxID._text`. `node-soap` hands us plain values with
`attributesKey: "$attributes"` instead. The two conventions do not meet by accident.

**Decision.** `mapNdcxOrderViewReply` emits `src/types/DossierCreatePayload.d.ts`'s
`DossierCreate` — `{ DataLists, Order, Warning, PaymentInfo, TicketDocInfo }`,
`._text` / `_attributes` throughout. One object serves all three consumers, exactly
as SABRE's `value` does: `dossierCreate(value, …)` on create,
`saveAfterRetreive(null, {…body, OrderID}, value, …)` on retrieve, and the HTTP
`value` the front reads.

**Consequences.**
- The mapper is a *structure-preserving rewrap*, not a re-model — the NDC[X]
  OrderView is the same IATA schema AF/KL use (`Order`, `DataLists/PaxList`,
  `PaxSegmentList`, `BaggageAllowanceList`, `ContactInfoList`, `PaxJourneyList`,
  `OriginDestList`, `PriceClassList`, `ServiceDefinitionList` all present in the
  AF capture). The work is renames, wrapping, hoisting and decimalisation — §4
  enumerates every one.
- Deliberately **unlike** `offerPriceReply.mapper.js`, which emits plain values
  into `Structure/OfferPriceRs`. Two mappers, two conventions, because they have
  two different consumers. Do not "unify" them.
- Synthetic (non-IATA) fields are legitimate and expected — `dossierCreate`
  already reads `Order.isTicketed`, `Order.tstDeadline`, `Order.pnrList`,
  `Order.lmdDeadline`, `dataRS.remarks`. SABRE injects `Order.tstDeadline` this
  way (`order/create.js:551`).

### ADR-8 — `Order.OwnerCode` is `"AMADEUS_NDCX"`; the airline travels in `BookingRef` + `pnrList`

**Context.** `dossierCreate` branches on `Order.OwnerCode._text`: `["AF","KL","BA"]`
gates `buildJourneys()` (`:1124`), `AF`/`KL` gates the card-encryption path that
reads `PaymentInfo/…/SecureProgram/EnrollmentStatusText` (`:960`), and
`[...LCC_AIRLINES, ...IBERIA_AIRLINES, …]` gates another (`:985`). NDC[X] returns
the *real* airline (`AF`). Precedent is split: classic AMADEUS writes the literal
`"AMADEUS"` (`AMADEUS/order.utils.js:1957`) and keeps the carrier in
`BookingRef.BookingEntity.Carrier.AirlineDesigCode`; the NDC[X] shopping mapper
hardcodes `"AMADEUS_NDCX"` (`shoppingReply.mapper.js:24`).

**Decision.** `Order.OwnerCode = { _text: "AMADEUS_NDCX" }`, consistent with the
shopping mapper and with classic AMADEUS's provider-name convention. The airline
code lives in `Order.BookingRef.BookingEntity.Carrier.AirlineDesigCode` and in
`Order.pnrList[].ownerIataCode`.

**Consequences.**
- Every carrier-keyed branch in `dossier.utils.js` is bypassed — including the
  AF/KL card encryption, which is what we want at create (no card is sent) and
  what OrderPay must handle deliberately rather than inherit.
- `pnr.ownerCode` becomes `"AMADEUS_NDCX"`, so the airline is **not** on the pnr
  row by default. Resolved by ADR-9's `pnr.pnrList` persistence — `orderRetrieveRQ`
  needs the airline `OwnerCode` for `Request/Order/OwnerCode`.
- `buildJourneys()` would be skipped. **Widen the gate** at `dossier.utils.js:1124`
  to include `"AMADEUS_NDCX"` — NDC[X] returns a full `OriginDestList` +
  `PaxJourneyList`, so `pnr.journeys` should be populated. One-token change to a
  shared conditional, additive for a provider nothing else reaches.

### ADR-9 — `NDCX-` prefixed OrderID, carrier recloc as the PNR, all reclocs in `pnrList`

**Context.** OrderView returns one `Order/OrderID` (`AF057U24172D6`) and 2–3
`BookingRef/BookingID` — verified across three AF captures as carrier-first then
Amadeus (`Org@OrgID="1A"`), but the guide says expect ~3 (airline, airline IT
provider, Amadeus) so wire order is not a contract. `dossierCreate` collapses the
list with `Order.BookingRef = ensureArray(Order.BookingRef)[0]` (`:874`) and that
single ref becomes `pnr.pnr` (`:1085`). `pnr.orderId` is
`Order.OrderID._text` verbatim (`:1092`) — no prefix is applied for us, which is
why SABRE bakes `"SAB-" + order.id` into its mapper (`orderView.utils.js:240`).

**Decision.**
- `Order.OrderID = { _text: "NDCX-" + OrderID }`. Strip the prefix before every
  host call. Keeps NDC[X] orders from colliding with classic AMADEUS dossiers in
  the same office when `PnrService.getPnrAndDossierWithOrderid` looks up.
- `Order.BookingRef` is a **single object** (not an array): the ref whose
  `BookingEntity/Carrier` is present — selected explicitly, never by index. So
  `pnr.pnr` is the airline record locator, which is what an agent quotes.
- All reclocs go into the synthetic `Order.pnrList`, following
  `AMADEUS/order.utils.js:1938-1948` — **plain strings**, matching
  `PnrListItem` (`types/dossier.opti.ts:95`):

  ```js
  Order.pnrList = [
    { ownerIataCode: "AF", bookingReference: "V46F2R" },  // BookingEntity/Carrier/AirlineDesigCode
    { ownerIataCode: "1A", bookingReference: "5MDPTG" },  // BookingEntity/Org/@OrgID
  ]
  ```

  `dossier.utils.js:1009-1017` fans this out into internal notes, and the
  `@OrgID="1A"` attribute matches its `ownerIataCode === "1A"` check literally, so
  the Amadeus ref renders as `PNR AMADEUS: 5MDPTG` for free.
- Persist it: add one guarded line beside the existing `pnr.remarks` copy
  (`dossier.utils.js:~1134`):

  ```js
  if (dataRS?.Order?.pnrList?.length) pnr.pnrList = dataRS.Order.pnrList;
  ```

  The `pnr.pnrList` column already exists for exactly this
  (`models/pnr.js:251`, migration `20260113111606-add-amadeus-multiple-pnr`) and
  nothing writes it today. `orderRetrieveRQ` then recovers the airline as
  `pnr.pnrList.find(p => p.ownerIataCode !== "1A")?.ownerIataCode`.

**Consequences.**
- ⚠️ **Shared-code blast radius.** That one line also starts populating
  `pnr.pnrList` for classic AMADEUS retrieve, which already sets `Order.pnrList`
  (`formatRetrieve.utils.js:34`). Benign — it fills a column `readOpti` already
  types — but it *is* a behaviour change outside NDC[X]. Call it out in review.
- ⚠️ `formatRetrieve.utils.js:734` builds the same field **wrapped** as
  `{ _text: … }`, which interpolates as `PNR [object Object]: [object Object]` in
  that note. Pre-existing bug on the classic AMADEUS path, out of scope here —
  but do not copy that shape. Follow `order.utils.js:1946`.
- Anything reading `pnr.orderId` for an NDC[X] dossier must expect the prefix.

### ADR-10 — Decimalise from the reply's own `Decimals` metadata

**Context.** `NDCX-OFFERPRICE-PLAN.md` Trap 1 asserts Travel Management amounts
are "integer minor units, with **no decimal-places indicator anywhere** in the
payload", and `amount.utils.js` was built on that with a hardcoded ISO-4217
exponent table. **That premise is wrong.** Both the OrderView *and* every
OfferPrice capture carry:

```
Response/Metadata/Other/OtherMetadata/CurrencyMetadatas/CurrencyMetadata[@MetadataKey="EUR"]/Decimals = 2
```

and the guide names that exact path as the one to read
(`references/03-prime-booking-flow.md:388`, and again in the ID-chaining table at
`:690`: "Always divide by 10^`Decimals` from the currency metadata").
`dossierCreate` does a bare `parseFloat(…._text)` with no scaling anywhere, so an
un-decimalised `Order/TotalPrice/TotalAmount` of `67474` lands in
`pnr.totalPrice` as 67474 instead of 674.74 — a 100× error.

**Decision.** Extend `amount.utils.js` with `readCurrencyDecimals(response)` →
`{ EUR: 2 }`, thread it into `parseNdcxAmount(node, { decimals })`, and fall back
to the existing ISO table when a currency has no metadata entry. Correct Trap 1
in `NDCX-OFFERPRICE-PLAN.md` while there.

**Consequences.**
- Also fixes `sumNdcxAmounts`'s hardcoded `Math.round(total * 100) / 100`, which
  silently truncates 3-decimal currencies (BHD, JOD, KWD, OMR, TND, LYD) — round
  at `10 ** exponent` instead.
- `LoyaltyUnitAmount` is `2115.00 CurCode="MILES"` — **already decimal, and not a
  currency**. It must bypass `parseNdcxAmount` entirely; there is no `MILES`
  metadata entry and the ISO fallback would divide it by 100.

### ADR-11 — Penalty amounts ride in from the offerPrice reply, via the front

**Context.** metis's `conditions` rows are keyed
`title ∈ {NoShow, Cancellation, Change} × date ∈ {PDE, ADE}` with a `price*`
column per cell (`dossier.utils.js:1656-1710`), fed from
`orderItem.FareDetail.FareComponent[].FareRule.Penalty[]` (`:1382-1409`). The two
NDC[X] replies carry different halves of that:

```
OfferPrice   FareRules/Penalty @CancelFeeInd @ChangeFeeInd
               Details/Detail{ Type=Cancel, Application=2,
                               Amounts/Amount{ CurrencyAmountValue, AmountApplication=MIN|MAX } }
OrderView    FareRules/Penalty                     ← no attributes
               Details/Detail{ Type=Cancellation, Application=2, @refs=RULE122 }
                                ↳ RuleMetadata[RULE122].RuleID = "CancellationPDE"
                                                     .Instruction = "Not allowed"
```

The OrderView has **no amounts at all**. `offerPriceReply.mapper.js:246-266`
already emits `Fare[].FareRule.Penalty[]` with `CancelFeeInd`, `ChangeFeeInd` and
`PenaltyAmount` in exactly the shape `dossier.utils.js` reads.

**Decision.** The front echoes the priced `OrderItems[].Fare` array back in the
orderCreate body; the mapper merges `PenaltyAmount` / `CancelFeeInd` /
`ChangeFeeInd` onto the OrderView's `Type` + `Application` skeleton, matched on
`(TypeCode, AppCode, segment set)`. Same no-server-state trick ADR-1 used for the
four mandatory IDs.

**Also decided: a shared normalizer, applied to both mappers.** Two name
mismatches mean those conditions match *nothing* today on the offerPrice path as
shipped:

| mapper emits | `dossier.utils.js:1666-1710` matches | result |
|---|---|---|
| `AppCode: "1"` / `"2"` / `"3"` | `condRS.date === "PDE"` / `"ADE"` | never matches |
| `TypeCode: "Cancel"` (OfferPrice wording) | `condRS.title === "Cancellation"` | never matches |

`Application` is consistent across both calls — `1`=NoShow, `2`=prior to
departure, `3`=after departure — and agrees with the OrderView's `RuleID`
suffixes (`NoShowNOS`, `CancellationPDE`, `CancellationADE`, `ChangePDE`,
`ChangeADE`). So `{1:"NOS", 2:"PDE", 3:"ADE"}` plus `Cancel → Cancellation` fixes
both, and needs no `@refs`/`RuleMetadata` resolution for the keys.

**Consequences.**
- Fixing `offerPriceReply.mapper.js` is safe: ADR-4 deferred its test, so nothing
  asserts the broken values, and no consumer can be relying on conditions that
  never matched.
- Prices are **pricing-time**, not order-time. They go stale after an
  orderChange, which is orderChange's problem to solve (it re-quotes).
- `RuleMetadata[…].Instruction` (`"Not allowed"`) still feeds `DescText`, which
  drives `available` (`:1404`: `available = !(DescText === "NAV")` — note it
  tests the literal `"NAV"`, so `"Not allowed"` maps to `available: true`; see
  §8, this needs confirming against the front's rendering).

### ADR-12 — Dossier created at hold, updated at pay

Booking is two steps (locked in `NDCX-INTEGRATION.md`). `orderCreateRQ` calls
`dossierCreate(value, {...body, period: []}, req.decodedToken, req.jwtToken)` on
the unticketed OrderView (`OrderItem/StatusCode = HK`, no `TicketDocInfos`) so the
agent sees a held dossier immediately. `Order.isTicketed` is the synthetic flag
that drives `pnr.status = isTicketed ? 2 : 1` (`dossier.utils.js:1093`) — `false`
at create. OrderPay later re-maps the post-pay OrderView through the *same*
mapper and calls `saveAfterRetreive` + `updateIssuance`.

**Consequence.** `dossierCreate` calls `DossierService.create()` unconditionally,
so it must be called **exactly once** per booking. OrderPay and orderRetrieve use
`saveAfterRetreive`, never `dossierCreate`.

### ADR-13 — The front adapter ships with this step

Same reasoning as ADR-1: `AmadeusNdcxAdapter` currently overrides only
`getOffer()`; `bookFlight()` and `retrieveOrder()` fall through to
`BaseAdapter`'s throwing defaults (`BaseAdapter.ts:498,512`). Both override in
this step, so a held booking is visible end-to-end before OrderPay exists.

### ADR-14 — Corporate / OSI persistence deferred

NDC[X] returns `Pax/LoyaltyProgramAccount = { ProgramName: "CORPORATE_ID",
ProgramCode: "CLID", AccountNumber: "AMADEUS", Carrier/AirlineDesigCode }`.
`dossier.utils.js:1891` looks for `ProgramName._text === "CORPORATE"` and then
reads `checkOsion.SignInID._text` for `DossierService.addOsion` — a field NDC[X]
never sends. (`:1973` reads a *nested* `LoyaltyProgram.ProgramName` instead,
inconsistently with `:1891`'s flat read.) Map `LoyaltyProgramAccount` verbatim,
accept that `addOsion` will not fire for NDC[X] this pass, and track it in §8.

---

## 3. Domain model — one document, three moments

```
Travel_OfferPrice RS  (pricing IDs — see NDCX-OFFERPRICE-PLAN.md §3)
  Response/ShoppingResponse/ShoppingResponseID ──┐
  Response/PricedOffer/Offer/OfferID ────────────┤
  Response/PricedOffer/Offer/OwnerCode ──────────┤  the airline (AF)
  Response/.../Offer/OfferItem/OfferItemID ──────┘
  Response/.../FareRules/Penalty/.../Amounts ────── penalty amounts  [ADR-11]
        │
        │  mapNdcxOfferPriceReply -> OfferPriceRs { ResponseID, OfferID,
        │      OwnerCode, OrderItems[].{OfferItemID, PaxRefID, Fare, Price} }
        │
        │  [ADR-13] AmadeusNdcxAdapter.bookFlight() echoes the four pricing IDs
        │           + paxs/contact + Fare (for ADR-11)
        ▼
Travel_OrderCreate  (Travel Management 1.14, stateless)
  Request/CreateOrder/SelectedOffer/OfferID              <- pricing OfferID
                                   /OwnerCode            <- the airline
                                   /ShoppingResponseRefID<- pricing ResponseID
                                   /SelectedOfferItem[]/OfferItemID + PaxRefID (repeated!)
  Request/DataLists/PaxList/Pax[]  <- full pax: Birthdate, GenderCode, docs, contact
        │
        ▼
AMA_TravelOrderViewRS ──────────────────────────────┐
        │                                            │ the SAME document is
Travel_OrderPay      -> AMA_TravelOrderViewRS ───────┤ returned by all three
Travel_OrderRetrieve -> AMA_TravelOrderViewRS ───────┘ (ADR-6)
        │
        │  mapNdcxOrderViewReply  ->  DossierCreatePayload.DossierCreate
        │
        ├── create   : dossierCreate(value, {...body, period: []}, token, jwt) -> [dossier, pnr]
        ├── retrieve : saveAfterRetreive(null, {...body, OrderID}, value, jwt, token)
        └── both     : returned to the front as `value`
```

**The two keys that define the order** (`03-prime-booking-flow.md:369`):
`Order/OrderID` + `Order/OwnerCode`. Both are needed for OrderPay, OrderRetrieve
and OrderCancel. We rename the second (ADR-8), so **the airline must be recovered
from `pnr.pnrList`, not `pnr.ownerCode`** (ADR-9).

**`PaxID` continuity holds through booking.** The AF capture proves it:
`OrderItem/FareDetail/PassengerRefs = PAX1` and
`OrderItem/OrderItemID = fbf8a533-…-6539_1APAX_PAX1` — the host echoes our
`PAX{n}` IDs, and even embeds them in the OrderItemID (the `_1APAX_<PaxID>`
convention the guide relies on for AA installments, `:691`). So the chain
shopping → offerPrice → orderCreate → dossier keeps one identifier, and
`dossierCreate`'s name-based re-resolution (`:1914`) is a belt-and-braces
fallback rather than the primary path.

---

## 4. The mapping table — every delta, confirmed against captures

Source paths are relative to `AMA_TravelOrderViewRS/Response`, verified against
`.agent/skills/ndcx/examples/prime-booking/AF-OIN-BLUEBIZ/3-Reply-Travel-OrderCreate.xml`
and `AF-Public-SAF-Bundle/5-Reply-Travel-OrderRetrieve.xml`. Target paths are
`DossierCreatePayload.DossierCreate`.

### 4.1 Structural moves

| NDC[X] wire | Target | Why |
|---|---|---|
| `Order/PaymentInfo[]` | **root** `PaymentInfo[]` | `dossierCreate` reads `dataRS.PaymentInfo` (`:875`), not `Order.PaymentInfo`. Must be hoisted. |
| `TicketDocInfos/TicketDocInfo[]` | **root** `TicketDocInfo[]` | `dossierCreate` reads `ensureArray(dataRS.TicketDocInfo)` (`:3674`). Note the wire wraps in a plural container. |
| `Order/BookingRef[]` (2–3) | `Order.BookingRef` **single object** = the `BookingEntity/Carrier` one | ADR-9. `dossierCreate` does `ensureArray(…)[0]`. |
| — | `Order.pnrList[]` (synthetic, plain strings) | ADR-9. All reclocs, for notes + `pnr.pnrList`. |
| — | `Order.isTicketed` (synthetic bool) | Drives `pnr.status` (`:1093`). `false` at create; `true` once `TicketDocInfos` is present. |
| — | `Order.OwnerCode = "AMADEUS_NDCX"` | ADR-8. |

### 4.2 Renames (silent-null traps — each one is a field that reads `undefined` if missed)

| NDC[X] wire | Target | Evidence |
|---|---|---|
| `IATA_LocationCode` | `IATALocationCode` | `dossier.utils.js` uses `IATALocationCode` **35×**, `IATA_LocationCode` **0×**. The wire uses `IATA_LocationCode` 32× in the OfferPrice reply alone. `offerPriceReply.mapper.js:127` already normalizes this — reuse that helper. |
| `OrderItem/Price/TaxSummary/Tax/AdditionalTaxCode` | `AddlTaxCode` | `dossier.utils.js:1210` reads `tax?.AddlTaxCode?._text`. |
| `OrderItem/FareDetail/PassengerRefs` (space-separated) | `FareDetail.PaxRefID` | Split on whitespace, same as Trap 2's reply side. |
| `FareComponent/SegmentRefs` (repeated, plain) | `FareComponent.PaxSegmentRefID[{_text}]` | `dossier.utils.js:1391` does `FareItem.PaxSegmentRefID.map(seg => seg._text)` — **unguarded**, so a missing or non-array value throws. |
| `FareComponent/FareRules/Penalty` (plural `FareRules`) | `FareComponent.FareRule.Penalty[]` | `dossier.utils.js:1382` reads `FareItem?.FareRule?.Penalty`. |
| `Detail/Type` = `Cancellation`\|`Change`\|`NoShow` | `Penalty[].TypeCode` | ADR-11; OfferPrice says `Cancel`, normalize to `Cancellation`. |
| `Detail/Application` = `1`\|`2`\|`3` | `Penalty[].AppCode` = `NOS`\|`PDE`\|`ADE` | ADR-11. |
| `RuleMetadata[@MetadataKey=<refs>]/Values/Value/Instruction` | `Penalty[].DescText` | Resolve `Detail/@refs` into `Metadata/Other/OtherMetadata/RuleMetadatas`. |
| `TicketDocument/TicketDocNbr` | `Ticket.TicketNumber` | matches `formatNDCResponse`'s output (`orderView.utils.js:311`). |
| `TicketDocument/Type` | `Ticket.TicketDocTypeCode` | ibid `:311`. |
| `TicketDocument/ReportingType` | `Ticket.ReportingTypeCode` | ibid `:310`. |
| `TicketDocument/NumberofBooklets` | `BookletQty` | ibid `:250`. Note the wire's lowercase `of`. |
| `TicketDocument/DateOfIssue` | `OriginalIssueInfo.IssueDate` | ibid `:252`. |
| `TicketDocument/CouponInfo[]/Status` | `Ticket.Coupon[].CouponStatusCode` | ibid `:306`. |
| `TicketDocInfo/PassengerReference` | `PaxRefID` | ibid `:260`. |

### 4.3 Amounts (ADR-10) — every one of these is integer minor units on the wire

| NDC[X] wire | Value in capture | Target `_text` | Target `_attributes` |
|---|---|---|---|
| `Order/TotalPrice/TotalAmount` | `67474` `CurCode="EUR"` | `"674.74"` | `{ CurCode: "EUR" }` |
| `OrderItem/Price/TotalAmount` | `67474` `CurCode` | `"674.74"` | `{ CurCode }` |
| `OrderItem/Price/BaseAmount` | `30000` `CurCode` | `"300.00"` | `{ CurCode }` |
| `OrderItem/Price/TaxSummary/TotalTaxAmount` | `36854` `CurCode` | `"368.54"` | `{ CurCode }` |
| `OrderItem/Price/TaxSummary/Tax[]/Amount` | e.g. `22400` `CurCode` | `"224.00"` | `{ CurCode }` |
| `OrderItem/FareDetail/Price/BaseAmount` | `30000` **`Code`** | `"300.00"` | `{ CurCode }` |
| `OrderItem/FareDetail/Price/Taxes/Total` | `36854` **`Code`** | `"368.54"` | `{ CurCode }` |
| `…/Price/TotalAmount/DetailCurrencyPrice/Total` | `66854` **`Code`** | `"668.54"` | `{ CurCode }` |
| `…/DetailCurrencyPrice/Fees/Total` + `Fee[]/Amount` | `620` **`Code`**, `Description=AggregatorFee`, `Nature=T02` | `"6.20"` | `{ CurCode }` |
| `OrderItem/Price/LoyaltyUnitAmount` | `2115.00` `CurCode="MILES"` | **`"2115.00"` — pass through** | `{ CurCode: "MILES" }` |

Note the inconsistent attribute name on the wire — `Code` under `FareDetail/Price`,
`CurCode` under `Price` and `TotalPrice` — and that both land under
`$attributes`. Normalize to `_attributes.CurCode` everywhere, because that is what
`dossier.utils.js:1094,1168,1188,1211` reads.

**`Order.TotalPrice.TotalAmount` passes through the host's Level 1 value**
(decimalised), not our own sum. Deliberate, and a documented exception to ADR-2:
`dossierCreate` reads exactly that path for `pnr.totalPrice` (`:1097`), and
matching what the airline displays matters more here than avoiding a deprecating
field. Level-2 and Level-3 breakdowns are still mapped per item, and the test
asserts they reconcile (§7).

The levels do reconcile on this capture, but **not the way
`NDCX-OFFERPRICE-PLAN.md` ADR-2 describes for the Offer**: at Order level,
L3 `BaseAmount 30000 + Taxes/Total 36854 = 66854 = DetailCurrencyPrice/Total`,
and L2 `OrderItem/Price/TotalAmount = 67474 = 66854 + 620` — i.e. **L2 here
*includes* the fee that L3's `Total` excludes**. So do not carry the offer-level
"L2 excludes fees" assumption into the order-level mapper; sum
`DetailCurrencyPrice/Total + Fees/Total` when reconciling.

### 4.4 Presence-driven branches (ADR-6)

| Field | Create | Pay / Retrieve | Handling |
|---|---|---|---|
| `Order/PaymentTimeLimitDateTime` | ✅ | ✗ | `pnr.ttl` via `getRawPaymentTimeLimitDateTime(dataRS.Order)` (`:1106`). Emit when present. |
| `Order/OrderItem/Disclosure` | ✅ | ✗ | Maps to `OrderItem.Disclosure`. |
| `TicketDocInfos` | ✗ | ✅ | Sets `Order.isTicketed = true`; feeds `passengerTicketList`. |
| `Warning/{Code,DescText}` | ✗ | ✅ | Maps to `DossierCreate.Warning`. Distinguish advisory from warning (rule ERR-05) — a reprice warning at pay is not a failure. |
| `PaxSegment/SecureFlightInd` | ✗ | ✅ | `pnr.secureFlight` (`:1101`) tests `._text === true || === "true"`. |
| `Order/PaymentInfo` | carrier-dependent | ✅ | AF-OIN returns the **FOP catalogue** (10 entries, `Amount=0`, `TypeCode` NAV/CC/DC/VCR); AF-Public returns none at create and the **used** FOP after pay. Both hoist to root identically. |

### 4.5 Referential integrity the mapper must guarantee

`dossierCreate` walks these without guards. A dangling ref throws or silently
drops a segment:

- `DataLists/OriginDestList/OriginDest[]/PaxJourneyRefID` **must** resolve in
  `PaxJourneyList` — `:1497` does `paxJourneyLookup[…].PaxSegmentRefID = ensureArray(…)`,
  which throws `TypeError` on `undefined`.
- Every `PaxJourney/PaxSegmentRefID` must resolve in `PaxSegmentList`.
- `Order/OrderItem/Service[]/ServiceAssociations/PaxSegmentRefID` is read as a
  **single node** (`._text`, not an array) by `getStatusCode` (`:1483-1494`) to
  derive `segment.status`. NDC[X] matches for flight services
  (`Service/ServiceAssociations/PaxSegmentRefID = SEG116`, `StatusCode = HK`);
  ancillary services nest it under `ServiceDefinitionRef` instead — keep both
  forms, do not flatten.
- `ServiceDefinition/ServiceDefinitionAssociation/BaggageAllowanceRefID` must
  resolve in `BaggageAllowanceList`.
- `Pax/ContactInfoRefID` must resolve in `ContactInfoList`. ⚠️ The AF-OIN
  `ContactInfo` has **only** `EmailAddress/EmailAddressText` — no `Phone` —
  while `DossierCreatePayload.ContactInfo` declares `Phone.PhoneNumber`. Emit the
  node absent rather than an empty `Phone`.
- `Pax/Individual/{GivenName, Surname}` must be present: `dossierCreate:1914`
  re-resolves `pax.id` by case-insensitive surname+givenName match against
  `body.paxs`, and falls back to `pax._other.PaxID` / `pax.idDataPax` otherwise.

---

## 5. `api-aerial` implementation checklist

### 5.1 `src/utils/AMADEUS_NDCX/amount.utils.js` (extend — ADR-10)

- [x] `readCurrencyDecimals(response)` → `{ [CUR]: number }` from
      `Metadata/Other/OtherMetadata/CurrencyMetadatas/CurrencyMetadata[]`, reading
      `$attributes.MetadataKey` + `Decimals`.
- [x] `parseNdcxAmount(node, { decimals, fallbackCurrency } = {})` — prefer
      `decimals[cur]`, fall back to the ISO table.
- [x] Skip decimalisation when the currency is not a currency (`MILES`) — return
      the value verbatim.
- [x] `sumNdcxAmounts` rounds at `10 ** exponent`, not a hardcoded `100`.
- [x] Rewrite the file header comment — the "no decimal-places indicator anywhere"
      claim is wrong.
- [x] Correct Trap 1 in `NDCX-OFFERPRICE-PLAN.md` and thread `decimals` through
      `offerPriceReply.mapper.js`.

### 5.2 `src/utils/AMADEUS_NDCX/penalty.utils.js` (new — ADR-11)

- [x] `normalizePenaltyType(type)`: `Cancel` → `Cancellation`; pass `Change` /
      `NoShow` through.
- [x] `normalizePenaltyAppCode(application)`: `{1:"NOS", 2:"PDE", 3:"ADE"}`.
- [x] `buildPenalties(penalty, { ruleMetadataByKey, decimals })` — one
      implementation used by both mappers, resolving `Detail/@refs` into
      `RuleMetadata` for `DescText` when present, reading
      `Amounts/Amount[AmountApplication=MAX]` when present. Note: its *output
      shape* still differs per consumer (plain values for `OfferPriceRs`,
      `{_text}`-wrapped for `DossierCreate`) — the OrderView mapper wraps the
      shared function's output itself (`mergeAndWrapPenalties`), since
      `dossier.utils.js` reads `penaltyItem?.CancelFeeInd?._text` etc.
- [x] Move `offerPriceReply.mapper.js:246-266` onto it and delete the local copy.

### 5.3 `src/utils/AMADEUS_NDCX/order.utils.js` (new)

- [x] `createNdcxOrderCreatePayload(body)`, mirroring
      `createNdcxOfferPricePayload`'s validate-then-build structure.
- [x] `Party.Sender.TravelAgency = { AgencyID: "unused", PseudoCityID: "unused" }`
      — unused but mandatory on every `Travel_*` request.
- [x] `Request.CreateOrder.SelectedOffer`: `OfferID` ← `body.OfferID` (**note the
      element name change** — OfferPrice used `OfferRefID`), `OwnerCode` ←
      `body.OwnerCode` (the airline), `ShoppingResponseRefID` ←
      `body.ShoppingResponseId`. All three are the **pricing** IDs, never the
      shopping ones.
- [x] One `SelectedOfferItem` per `body.OfferIdList` entry with `OfferItemID`
      (not `OfferItemRefID`) and **repeated** `PaxRefID` elements — pass the JS
      array straight through; `node-soap` serialises it as repeated elements
      (Trap 2, inverted from OfferPrice).
- [x] `Request.DataLists.PaxList.Pax[]`: reuse the `PAX{n}` IDs, `PTC` via
      `getPaxCodeFromMetis` (`CNN` never `CHD`), `Birthdate` **and**
      `Individual.GenderCode` mandatory (TSA — missing values fail at
      **OrderPay**, not here), `Individual.{TitleName, GivenName, Surname}`,
      infant linkage as the adult's `PaxRefID` pointing at the infant's `PaxID`.
- [x] `ContactInfo`: `ContactRefusedInd`, and the **literal** `LabelText` values
      `MOBILE` / `EMAIL` — implemented per the vendored WSDL's `Phone`/`EmailAddress`
      types, which do carry a real `LabelText` field. ⚠️ Could not confirm `R`/`D`
      against any capture or generated type — omitted rather than guessed; if
      those gate real functionality, find their home before shipping.
- [x] `IdentityDoc` + nested `Visa` by `VisaTypeCode` (`K` = KTN, `V` = visa).
      ⚠️ **Correction from the WSDL's actual `Pax` shape**
      (`ndcxpdttravelmanagement11440/definitions/Pax.d.ts`): redress is **not**
      a `Visa` entry — `Pax.RedressProgram[]` is its own top-level element
      (`RedressID`, `ProgramName`, `CountryCode`), sibling to `IdentityDoc`.
      Implemented as such. Also: the request-side field is `IdentityDocNumber`,
      not the reply-side `IdentityDocID`. KTN and redress are not forwarded to
      the airline (Amadeus PNR only) but are still sent here.
- [x] `LoyaltyProgramAccount.{AccountNumber, ProgramCode}` for FF (flyingBlue /
      fidelityCard — `Carrier.AirlineDesigCode` not populated, no source field
      identified in `body.paxs` for a non-AF/KL loyalty card at this call).
- [ ] Element order per `.agent/skills/ndcx/examples/.../3-Query-Travel-OrderCreate.xml`
      (Trap 3) — **not verified**, no live capture available in this session.
      Object key insertion order in the JS above should be checked against a
      real `-Query-` capture before relying on it.
- [x] `createNdcxOrderRetrievePayload(body)`: just `Request.Order.{OrderID, OwnerCode}`.
      Strip the `NDCX-` prefix from `OrderID`; resolve the airline `OwnerCode`
      from `body.OwnerCode` or `pnr.pnrList.find(p => p.ownerIataCode !== "1A")`
      (the latter now server-side, via the new `PnrService.getPnrListByOrderId`).
- [x] Reject before spending a host call: empty `paxs`, missing `OfferID` /
      `OfferIdList` / `ShoppingResponseId` / `OwnerCode`, any pax missing
      `Birthdate` or `GenderCode`, any `OfferItemID` of `null`.

### 5.4 `src/utils/AMADEUS_NDCX/orderViewReply.mapper.js` (new — the core of this step)

`mapNdcxOrderViewReply(reply, body)` → `DossierCreatePayload.DossierCreate`.
Implement §4 in full. Import-light, like the other two mappers, so it is testable
with plain `node --test` and no DB dependency.

- [x] Presence-driven only — no operation parameter (ADR-6).
- [x] Shared `wrap()` helper doing the `$attributes`/`$value` → `_attributes`/`_text`
      conversion, so the rewrap is mechanical and auditable. (No separate
      `wrapAttrs()` — one function handles both leaf and element cases.)
- [x] `readCurrencyDecimals(response)` once at entry; threaded through every amount.
- [x] `mergeAndWrapPenalties(penalties, body.Fare)` (ADR-11). ⚠️ Matched on
      `(TypeCode, AppCode)` only, **not** the full `(TypeCode, AppCode, segList)`
      key — `OfferPriceRs.OrderItems[].Fare` entries carry no segment-ref list to
      key on (only Dep/Arrival IATA codes). Safe for the common one-fare-component
      itinerary; flagged in-code for verification against a live capture with a
      multi-segment fare component sharing a `(TypeCode, AppCode)` pair.
- [x] Extracted the `IATA_LocationCode` → `IATALocationCode` rename into
      `location.utils.js` (`renameIataLocationCode`), used by both this mapper
      and `offerPriceReply.mapper.js`.
- [x] Surface `reply.Response.Error[]` — the controller decides the status code.
- ⚠️ **Known gap, not implemented**: `OrderItem/FareDetail/FarePriceType/Price`
  (Level 3, §4.3's `DetailCurrencyPrice`/`Fees` breakdown) is not populated —
  its exact wire shape (is `Fees`/`Surcharge` under `TotalAmount.DetailCurrencyPrice`
  or elsewhere?) could not be confirmed without a live capture. `dossier.utils.js`
  does read `FareDetail.FarePriceType.Price.Surcharge.Breakdown.Amount` for a
  per-item surcharge figure, but only via `getAgfSurchargeAmount`/
  `isSabreNdcPricingScope`, which don't gate on `"AMADEUS_NDCX"` — so this
  should default to a safe `0`, not a crash. `pnr.totalPrice` (Level 1,
  the definition-of-done's highest-risk figure) and `pnr.totalBaseAmount`/
  `totalTaxPrice` (Level 2, `OrderItem.Price`) are both populated correctly and
  do not depend on this gap. Verify against §7 before relying on any per-item
  surcharge display.
- ⚠️ **`TicketDocInfo` mapping is lower-confidence** — OrderCreate never
  exercises it (ADR-12: `isTicketed` is false at create), so it wasn't
  exercised against a live capture in this step. Field paths follow §4.2's
  table as written; verify against a real `Travel_OrderPay`/
  `Travel_OrderRetrieve` RS before trusting it for a ticketed booking.

### 5.5 `src/controllers/AMADEUS_NDCX/order.controller.js` (new)

⚠️ **The dispatcher contract differs from offerPrice.** `GlobalController.orderCreateRQ`
and `orderRetrieveRQ` pass **real Express args** —
`controllers[Oras[ora]]?.OrderController.orderCreateRQ(req, res, next)`
(`global.controller.js:715,727`) — and do **not** wrap the return value, unlike
`OfferPriceRq` which calls `offerPriceRQ({ decodedToken, ...body })` and then does
`res.status(200).json({ message, value })` itself (`:649-655`). So this controller
**owns the response**: keep `BaseControllerFactory`'s `sendResponse` /
`sendError`, and do **not** copy `offer.controller.js`'s
`sendError`-returns-an-object override.

- [x] `new AmadeusControllerFactory("/orderCreateRQ")` — credentials come free
      (`OfficeID`, `Amadeus-officeId`, `-url`, `-password`, `-userId`, `-wasp`,
      `-bsp-region` validated from `body.agenceInfo.id_sales_point`,
      `amadeusControllerFactory.js:49-88`).
- [x] `handleRequest(req, res, next)` works unchanged with real Express args
      (`controller.utils.js:133`), so export
      `orderCreateRQ: (req, res, next) => c.handleRequest(req, res, next)`.
- [x] `req.decodedToken` and `req.jwtToken` are available here (unlike the
      offerPrice path) — passed both to `dossierCreate`/`saveAfterRetreive`.
- [x] `processRequest` (create): `NdcxService.create(req.salesPoint)` →
      `travelOrderCreate(payload)` → `mapNdcxOrderViewReply` →
      `dossierCreate(value, { ...req.body, period: [] }, req.decodedToken, req.jwtToken)`
      → respond with `{ value, dossierId }`. Stateless, so no session lifecycle;
      still `close()` in `finally` for symmetry.
- [x] `processRequest` (retrieve): resolves the airline `OwnerCode` via the new
      `PnrService.getPnrListByOrderId(body.OrderID)` (falls back to `body.OwnerCode`
      if the front sends it), calls `PnrService.getPnrAndDossierWithOrderid(body.OrderID)`
      — if the dossier exists, `saveAfterRetreive`; if not, `dossierCreate` (the
      import-PNR case, mirroring `SABRE/order.controller.js:74` and
      `order/retrieve.js:290`).
- [x] Never calls `dossierCreate` twice for one booking (ADR-12).
- [x] `NdcxError` → 502, everything else → 500, as shopping and offerPrice do.
- [x] Export `{ OrderController: { orderCreateRQ, orderRetrieveRQ }, setupRoute }`.

**No dispatcher change is needed.** Both routes already exist
(`global.controller.js:783,784`) and `getControllerFiles()` already has the
`AMADEUS_NDCX` folder branch (`:193-194`), so a file named `order.controller.js`
in that folder is picked up on the folder-name match for `"order"`.

### 5.6 `src/utils/dossier.utils.js` (two additive lines — shared code, review carefully)

- [x] Beside the existing `pnr.remarks` copy (`~:1134`):
      `if (dataRS?.Order?.pnrList?.length) pnr.pnrList = dataRS.Order.pnrList;`
      (ADR-9 — also affects classic AMADEUS retrieve, see its Consequences).
- [x] Widen the journeys gate at `:1123` (the `dossierCreate` one) to include
      `"AMADEUS_NDCX"` (ADR-8). ⚠️ **Deviation**: the retrieve-path gate at
      `~:3811` (`saveAfterRetreive`, `["AF","KL","SABRE","SABRENDC",...NDCSabres]`)
      was **not** widened — the plan only named the create-path gate. Since
      `pnr.journeys` isn't overwritten with `undefined` on an unmatched retrieve
      (the spread is conditional), the value set at create simply persists;
      only a fresh *retrieve-time* recompute is skipped. Revisit if that turns
      out to matter (e.g. after an orderChange re-quote changes the itinerary).

Nothing else in `dossier.utils.js` should be touched. Per `NDCX-INTEGRATION.md`'s
standing constraint, prefer adding NDC[X] call sites over modifying shared bodies —
these two are the deliberate, minimal exceptions, both additive and both guarded.

---

## 6. `front-reservation` implementation checklist (ADR-13)

- [x] `AmadeusNdcxAdapter.bookFlight()`, POSTing to the generic
      `/aerial/global/orderCreateRQ` (not a provider route — `useOra`'s NDC[X]
      entry already exists from ADR-1):

      oras                 <- ["AMADEUS_NDCX"]
      OfferID              <- pricing OfferID      (OfferPriceRs.OfferID)
      OfferIdList          <- pricing OfferItemIDs (OfferPriceRs.OrderItems[].OfferItemID)
      ShoppingResponseId   <- pricing ResponseID   (OfferPriceRs.ResponseID)
      OwnerCode            <- OfferPriceRs.OwnerCode   // the airline, not the provider
      paxs                 <- full pax incl. Birthdate + GenderCode + docs + contact
      Fare                 <- OfferPriceRs.OrderItems[].Fare   // ADR-11 penalty amounts
      agenceInfo           <- iataForOffer()

- [x] `AmadeusNdcxAdapter.retrieveOrder(saveAfterRetreive)` → POST
      `/aerial/global/orderRetrieveRQ` with `{ OrderID, OwnerCode }`. `OwnerCode`
      is read from `servicingFlow().folder.pnr.pnrList` if present (best-effort);
      the controller resolves it server-side either way (§5.5), so this is not
      load-bearing on the front.
- [x] Errors normalisation kept simple (`responseValue?.Errors`) rather than the
      full `Errors`/`errors`/`error` three-way fan-in `SabreAdapter.ts:984-1011`
      does — the NDC[X] controller only ever returns `{ Errors }` on failure
      (`sendError`/`sendResponse` from `BaseControllerFactory`, no lowercase or
      singular `error` variant), so the extra branches would be dead code. Revisit
      if that controller contract changes.
- [x] Does not use the MET2-2345 anti-race token — `bookFlight()` doesn't grow an
      await-then-mutate-store pattern here (unlike `getOffer()`'s repeated
      re-pricing), so nothing to race against.

> **Sequencing.** `paxs` must already carry `Birthdate` and `GenderCode` at this
> point — an open question from `NDCX-OFFERPRICE-PLAN.md` §8 that becomes
> **blocking** here: OrderCreate accepts their absence silently and
> `Travel_OrderPay` then fails (`03-prime-booking-flow.md:702`). **Still open** —
> not verified in this session; `order.utils.js`'s `createNdcxOrderCreatePayload`
> throws a clear error if either is missing rather than silently omitting them,
> so the failure (if any) will surface immediately as a 400 at OrderCreate
> instead of silently at the later OrderPay step, but whether the front's
> `body.paxs` actually carries these fields end-to-end still needs a live check.

---

## 7. Capture-then-test procedure

Same shape as ADR-4, and for the same reason: `use cases/NDCX/` holds only
MasterPricer captures from our office. The AF examples are from another office and
had repeating elements trimmed to 3 — **do not read record counts out of them**,
and do not commit one as a fixture.

1. Ship §6 and §5 far enough that the call round-trips (a mapper that throws is
   fine — `ndcxLogger` writes the XML either way, `ndcxLogger.js:56-59`).
2. Run with `NODE_ENV=development`, drive shopping → offerPrice → orderCreate from
   the front on the CDG↔JFK route our MasterPricer capture uses.
3. Keep both `…-Travel_OrderCreateAsync-RQ.xml` and `-RS.xml`. The RQ proves the
   builder (element order, repeated `PaxRefID`, TSA fields); the RS feeds the
   fixture. Then run retrieve and capture that RS too — **one fixture per
   operation, one mapper test asserting both go through the same function.**
4. [ ] `src/utils/__tests__/fixtures/generate-ndcx-orderview-fixture.js`, modeled
   on `generate-ndcx-fixture.js`: point `WSDL_PATH` at
   `NDCX_PDT_Travel_Management_1.14_4.0.wsdl`, unwrap
   `parsed?.Body?.AMA_TravelOrderViewRS`, and **reuse `CLIENT_OPTIONS` verbatim**
   (`forceItemsEnumerable`, `attributesKey: "$attributes"`, `ignoredNamespaces`) —
   they change which nodes come back as arrays, so the fixture is only faithful
   if they match `NdcxClient.create`.
5. [ ] `src/utils/__tests__/ndcx-orderview-reply.mapper.test.js`, asserting:
   - **the same function** maps the create fixture and the retrieve fixture
     (ADR-6) — the create output has no `TicketDocInfo` and `isTicketed: false`,
     the retrieve output has both;
   - referential integrity (§4.5): every `PaxJourneyRefID`, `PaxSegmentRefID`,
     `BaggageAllowanceRefID`, `ServiceDefinitionRefID`, `ContactInfoRefID`
     resolves inside `DataLists`;
   - `PaxID`s match the `PAX{n}` set shopping issued;
   - amounts are decimal major units — `Order.TotalPrice.TotalAmount._text` must
     assert as `"674.74"`, not `"67474"`, and `LoyaltyUnitAmount` must stay
     `"2115.00"`;
   - the levels reconcile: L3 `BaseAmount + Taxes/Total = DetailCurrencyPrice/Total`
     (`300.00 + 368.54 = 668.54`) and `+ Fees/Total = ` L2 `Price/TotalAmount`
     (`+ 6.20 = 674.74`) `= ` L1 `Order/TotalPrice/TotalAmount`;
   - `Order.OrderID._text` carries the `NDCX-` prefix; `Order.BookingRef` is the
     carrier ref; `Order.pnrList` has both reclocs with `ownerIataCode` `"AF"`
     and `"1A"`, as plain strings;
   - `Order.OwnerCode._text === "AMADEUS_NDCX"`;
   - penalties come out as `{TypeCode: "Cancellation", AppCode: "PDE"}` — not
     `"Cancel"` / `"2"` — so `dossier.utils.js`'s condition lookup matches;
   - `IATALocationCode` is populated (the rename actually happened).
6. [ ] Add the equivalent `AppCode`/`TypeCode` assertions to a new
   `ndcx-offerprice-reply.mapper.test.js` while fixing that mapper (ADR-11), which
   also discharges `NDCX-OFFERPRICE-PLAN.md` §7's deferred test.

---

## 8. Open questions — resolve while building, don't assume

- **Do the front's `paxs` carry `Birthdate` and `GenderCode`?** Carried over from
  `NDCX-OFFERPRICE-PLAN.md` §8 and now **blocking** — OrderCreate accepts their
  absence and OrderPay then fails, so a silent gap here surfaces one step later
  as an unexplained payment failure.
- **`available` semantics for penalties.** `dossier.utils.js:1404` computes
  `available = !(DescText === "NAV")`. NDC[X]'s `RuleMetadata.Instruction` is
  `"Not allowed"`, which under that test yields `available: true` — the opposite
  of the intent. Confirm what the front renders from `conditions.CancellationPDE`
  before choosing between mapping `"Not allowed"` → `"NAV"` in the mapper or
  reading `Penalty@CancelFeeInd`/`@ChangeFeeInd` instead. **Get this right or
  agents will be told a non-refundable fare is refundable.**
- **Corporate / OSI (ADR-14).** `addOsion` will not fire for NDC[X]. Decide
  whether to normalize `CORPORATE_ID` → `CORPORATE` + `AccountNumber` → `SignInID`
  in the mapper, or call `DossierService.addOsion` from the controller with the
  contract id we already sent. Also worth fixing the flat-vs-nested
  `LoyaltyProgramAccount.ProgramName` inconsistency between
  `dossier.utils.js:1891` and `:1973` — but not from this branch.
- **~~Is `Order/PaymentInfo` populated at create for our carriers?~~** AF-OIN returns
  the full 10-entry FOP catalogue; AF-Public returns none until after pay. The
  front's payment step needs the catalogue, so if our pilot carrier behaves like
  AF-Public we need it from `Travel_OfferPrice`'s `Response/Payments` instead —
  which is itself still an open question in `NDCX-OFFERPRICE-PLAN.md` §8.
  **Answered (2026-09-23): no, and neither is `Response/Payments`.** Across the ten
  own-office `Travel_OrderCreate` RS captures in `use cases/NDCX/` (carriers AC and
  LO) there are **zero** `<PaymentInfo>` elements, and no `Travel_OfferPrice` RS
  carries a `<Payments>` block — the only payment-ish element present anywhere is
  `PaymentTimeLimitDateTime`. There is no FOP catalogue to select from, so the FOP is
  captured on the order page and persisted at hold instead. See
  [`NDCX-ORDERPAY-PLAN.md`](./NDCX-ORDERPAY-PLAN.md) ADR-18.
- **`Order/OrderItem/StatusCode` values beyond `HK`.** Only `HK` appears in the
  captures. `getStatusCode` passes the value straight to
  `SegmentAerialService.updateStatusCode`, and `dossier.utils.js:3756` treats
  `["XX","CAN","NX","HX","UN","UC","NO"]` as cancelled. Confirm the NDC[X]
  vocabulary before cancel/change work.
- **Duplicate-booking guard (rule ERR-04).** A confirmation page must not be
  re-submittable, and look-to-book is capped at 1000 offers : 1 order (rule
  GEN-02/GEN-04). `bookFlight()` needs an in-flight guard; decide whether that's
  the MET2-2345 token pattern or something stronger.
- **SOAPAction version.** `NdcxClient.js` must declare `Travel_OrderCreate_1.7`
  and `Travel_OrderRetrieve_1.7` per the guide's service list. Verify the
  constants match before debugging a rejected message (Trap 6's failure mode).

---

## 9. Definition of done

> **Status as of implementation (2026-09-07):** §5 and §6's code checklists are
> done — every item below is implementation-ready but **none has been run
> against a real host**, so all stay unchecked until that happens. This needs
> a live Amadeus NDC[X] test-office session (§7) and a DB, neither available in
> the session that wrote this code.

- [ ] `POST /orderCreateRQ` with `oras: ["AMADEUS_NDCX"]` and a real priced NDC
      offer creates an order and returns a populated `DossierCreate` payload.
- [ ] A dossier + pnr row exist, with `pnr.orderId = "NDCX-<OrderID>"`,
      `pnr.pnr` = the airline recloc, `pnr.status = 1` (held),
      `pnr.ownerCode = "AMADEUS_NDCX"`, and `pnr.pnrList` holding both reclocs.
- [ ] Two internal notes on the dossier: `PNR AF: …` and `PNR AMADEUS: …`.
- [ ] `pnr.totalPrice` matches the airline's total **to the cent** (ADR-10) —
      the 100× trap is the single highest-risk defect in this step.
- [ ] `pnr.journeys` is populated (ADR-8's widened gate).
- [ ] Segment `conditions` rows are populated with non-null `PDE`/`ADE` values
      (ADR-11) — verifying the normalizer *and* the price carry-over.
- [ ] `POST /orderRetrieveRQ` on that dossier round-trips through **the same
      mapper** and updates it via `saveAfterRetreive` without creating a second
      dossier.
- [ ] Own-office RQ/RS captured in `use cases/NDCX/` for create **and** retrieve,
      committed as fixtures.
- [ ] `ndcx-orderview-reply.mapper.test.js` green, including the
      same-function-both-fixtures assertion.
- [ ] `offerPriceReply.mapper.js`'s `AppCode`/`TypeCode` fixed and covered.
- [ ] `NDCX-INTEGRATION.md` §3 create item and §4 retrieve items ticked; Trap 1
      corrected in `NDCX-OFFERPRICE-PLAN.md`.

---

## 10. Glossary additions

Extends `NDCX-OFFERPRICE-PLAN.md` §10.

| Term | Meaning here |
|---|---|
| **OrderView** | `AMA_TravelOrderViewRS` — the single reply document returned by `Travel_OrderCreate`, `Travel_OrderPay` **and** `Travel_OrderRetrieve`. The reason one mapper suffices (ADR-6). |
| **`DossierCreate`** | `src/types/DossierCreatePayload.d.ts`'s root type. metis's internal post-booking shape: `._text`-wrapped IATA OrderViewRS, originally modelled on AF/KL. The target of `mapNdcxOrderViewReply` (ADR-7), and simultaneously the argument to `dossierCreate()`, to `saveAfterRetreive()`, and the `value` the front receives. |
| **The two order keys** | `Order/OrderID` + `Order/OwnerCode`. Together they fully identify an order for Pay, Retrieve and Cancel. We rename the second to the provider (ADR-8), so the airline must be recovered from `pnr.pnrList`. |
| **`pnrList`** | Synthetic `Order` field, `[{ownerIataCode, bookingReference}]` as **plain strings** (`types/dossier.opti.ts:95`). `dossierCreate` fans it into internal notes; `ownerIataCode === "1A"` renders as `AMADEUS`. Convention set by `AMADEUS/order.utils.js:1938`. |
| **`isTicketed`** | Synthetic `Order` boolean the mapper sets from the presence of `TicketDocInfos`. Drives `pnr.status` — `1` held, `2` ticketed. |
| **PDE / ADE / NOS** | Prior to departure / after departure / no-show. metis's `conditions` keys, and the suffixes of NDC[X]'s `RuleMetadata.RuleID` (`CancellationPDE`). `Detail/Application` `2`/`3`/`1` respectively (ADR-11). |
| **`_1APAX_`** | The `OrderItemID` convention — `<uuid>_1APAX_<PaxID>`. Proof our `PAX{n}` IDs survive booking, and the form `Travel_OrderPay` needs for per-passenger installments. |
| **FOP catalogue** | `Order/PaymentInfo[]` at create: the forms of payment the carrier *accepts*, `Amount=0`, one entry per brand. Distinct from the single **used** FOP that appears in the same element after OrderPay. |
| **Decimals metadata** | `Response/Metadata/.../CurrencyMetadata[@MetadataKey=<CUR>]/Decimals`. The authoritative minor-unit exponent, present in both OfferPrice and OrderView replies — contra Trap 1 (ADR-10). |
