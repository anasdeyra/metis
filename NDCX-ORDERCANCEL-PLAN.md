# NDC[X] Next Step — Cancel / Void / Refund (`Travel_OrderCancel`) — MET2-2422

Companion to [`NDCX-INTEGRATION.md`](./NDCX-INTEGRATION.md) (standing source of truth for
the whole integration) and [`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md) (the
create/hold + retrieve step this one builds on). Sibling plan:
[`NDCX-ORDERPAY-PLAN.md`](./NDCX-ORDERPAY-PLAN.md).

This file plans `NDCX-INTEGRATION.md` §5 — **one endpoint, `orderCancelRQ`, branching
internally by order/ticket state** (a locked decision from the 2026-09-07 session).

Repos: `api-aerial` (branch `deyra-met2-2422`) **and** `front-reservation`.
Written 2026-09-23 from a fresh read of the actual code (`SABRE/order.controller.js`,
`dossier.utils.js`, `global.controller.js`, `passive-segment-sync.service.js`,
`cancelCard.vue`), the vendored WSDL type definitions
(`src/types/NDCX/ndcxpdttravelmanagement11440/definitions/`), and the own-office captures
in `api-aerial/use cases/NDCX/`.

**ADR numbering.** ADR-1…5 live in `NDCX-OFFERPRICE-PLAN.md` §2, ADR-6…14 in
`NDCX-ORDERCREATE-PLAN.md` §2, ADR-15…20 in `NDCX-ORDERPAY-PLAN.md` §2. This file is
allocated **ADR-21…30**. Do not renumber.

> 🔴 **2026-09-30 — two ADRs superseded. Read ADR-27 and ADR-28 before touching this flow.**
>
> - **ADR-22 → ADR-27.** `Travel_OrderReshop` **is** a cancel quote and is **mandatory**
>   between retrieve and cancel once an order is paid. ADR-22 concluded the opposite and
>   shipped a ticketed cancel with no quote, guessing the refund amount from
>   `pnr.totalPrice`.
> - **ADR-24 → ADR-28.** A cancelled order is **not retrievable** (Code 119 "UNABLE TO
>   RETRIEVE PNR"). ADR-24's follow-up `Travel_OrderRetrieve` returned an error payload for
>   cancels that had actually succeeded. No host call now follows the cancel.
>
> Both errors shared a shape: a conclusion drawn from the WSDL types or from assumption,
> without checking it against the captures in `.agents/skills/ndcx/examples/` or
> `use cases/NDCX/`. Check the captures.
>
> **ADR-29** then wires the quote into the agent's cancellation table and removes
> `AMADEUS_NDCX` from `ONE_STEP_VOID_CARRIERS` — the last piece of fallout from ADR-22.
>
> **ADR-30** fixes the two NULL columns the first live cancel then exposed
> (`ticketAerial.bookingID`, `segmentAerial.fareBasisCode`), both inside `AMADEUS_NDCX/` —
> read it before touching `orderViewReply.mapper.js` or `handleOrderRetrieve`.

> **Headline.** Two findings dominate this step and should be read before anything else:
> **ADR-21** — the cancel reply is *not* an OrderView, so ADR-6's one-mapper decision does
> not extend to it; and **ADR-23** — as shipped, cancelling any NDC[X] dossier will fire
> Amadeus **passive-PNR cancellation against the real airline record**. ADR-23 is a
> one-line guard, but it must land with this step.

---

## 1. Scope

**In scope**

- `createNdcxOrderCancelPayload(body)` — the `Travel_OrderCancel` request builder.
- `orderCancelReply.mapper.js` — a **new** mapper (ADR-21).
- `OrderController.orderCancelRQ` on the existing generic route
  (`global.controller.js:775` — no dispatcher change needed, ADR-26).
- The state branch: **CANCEL** (held) / **VOID** / **REFUND** (ticketed) — resolving
  `NDCX-INTEGRATION.md`'s standing "branching condition is not yet defined" open
  question (ADR-22), in two phases (§2, ADR-22).
- `updateCancel` wiring + the ADR-23 shared-code guard.
- `front-reservation`: `AmadeusNdcxAdapter.cancelOrder()`, and the `cancelCard.vue`
  branch that a ticketed NDC[X] dossier needs (ADR-26).
- Fixture-based tests: one for the request builder, one for the reply mapper.

**Explicitly not in scope**

- `orderChangeRQ` / `orderReshopRQ` (integration §6), `service.controller.js`,
  `seat.controller.js` (§7). No stub files, same reasoning as `NDCX-OFFERPRICE-PLAN.md` §1.
- `refundDelete()` / `splitCancel()` / `splitReshop()` — partial-cancel flows. NDC[X]
  `Travel_OrderCancel` cancels the whole order (`Request1` addresses `Order`, not
  `OrderItem`); per-item cancel belongs to `Travel_OrderChange`.
- The **refund estimate** shown before confirmation for a ticketed dossier — blocked, see
  ADR-22 Phase B and §9.
- `Request/ExpectedRefundAmount` (ADR-25).

---

## 2. Decisions taken this session (ADRs)

### ADR-21 — `Travel_OrderCancel` needs its own reply mapper; ADR-6 does not extend to it

**Context.** ADR-6 established one mapper for create/pay/retrieve because all three return
the *same* `AMA_TravelOrderViewRS`. Cancel is different. From the generated types:

```
AmaTravelOrderCancelRs = { PayloadAttributes, Response: Response1, Error: Error1[] }
Response1              = { OrderRefID, ChangeFees, OrderCancelProcessing, TicketDocInfo[], Warning[] }
OrderCancelProcessing  = { MarketingMessages, Notices, Remarks }
ChangeFees             = { PenaltyID, TypeCode, UpgradeFeeInd, PenaltyAmount, PenaltyPercent,
                           DescText[], AppCode, CancelFeeInd, ChangeFeeInd }
```

(`definitions/{AmaTravelOrderCancelRs,Response1,OrderCancelProcessing,ChangeFees}.d.ts`.)

**There is no `Order` and no `DataLists`.** `mapNdcxOrderViewReply` is structurally
inapplicable — it opens with `response?.Order ?? {}` and builds `DataLists` out of eight
lists that do not exist here (`orderViewReply.mapper.js:40-68`).

**Decision.** A new `src/utils/AMADEUS_NDCX/orderCancelReply.mapper.js`, emitting a small
provider-local shape (SABRE's ad-hoc-per-provider precedent, per `NDCX-INTEGRATION.md`'s
"no shared `Structure` for Order\* replies"):

```js
{
  OrderRefID,                       // echo, for the assertion in §5
  cancelOutcome: { isFullVoid, isPartialVoid, voidedTicketNumbers[], failedTicketNumbers[] },
  ChangeFees: [{ TypeCode, AppCode, PenaltyAmount, PenaltyPercent, CancelFeeInd, ChangeFeeInd, DescText }],
  Remarks: [], Notices: [],         // OrderCancelProcessing, for the dossier note
  Warning: [{ Code, DescText }],
  Errors:  [{ code, description }], // same shape orderViewReply.mapper.js:75-78 emits
}
```

**Consequences.**

- Reuse — don't duplicate — the amount and penalty helpers: `parseNdcxAmount` /
  `readCurrencyDecimals` (`amount.utils.js`, ADR-10) for `PenaltyAmount`, and
  `normalizePenaltyType` / `normalizePenaltyAppCode` / `normalizePenaltyDescText`
  (`penalty.utils.js`, ADR-11 + the `"NAV"` fix in `NDCX-ORDERCREATE-FINISH-PLAN.md` §2)
  for `ChangeFees.TypeCode` / `AppCode` / `DescText`. `ChangeFees` carries the *same*
  `TypeCode`/`AppCode`/`CancelFeeInd`/`ChangeFeeInd` vocabulary as the OrderView penalties,
  so the normalizers apply unchanged.
- ⚠️ The wrapping convention differs from `orderViewReply.mapper.js`. This mapper's output
  goes to `updateCancel`'s `json`/`additionalData` and to the front — **not** to
  `dossierCreate` — so it emits **plain values**, like `offerPriceReply.mapper.js` does,
  not `_text`-wrapped ones. Three mappers, two conventions, chosen per consumer (ADR-7's
  reasoning).
- `ChangeFees` is a **single object**, not an array, on `Response1`. Normalize with
  `ensureArray` anyway — every other cardinality in this WSDL has surprised us once.

### ADR-22 — The branch key is metis's own `pnr.status`; ship the held case first

**Context — this resolves `NDCX-INTEGRATION.md`'s "cancel/refund/void branching condition
is not yet defined".** The obvious model is SABRE's, so it was checked first:
`SABRE/order.controller.js:427-466` retrieves the order, then calls a dedicated **quote**
operation, `SabreService.checkFlightTickets`, and reads `cancelOffers[].offerType ∈
{VOID, REFUND}` (NDC path) or `tickets[].{isVoidable, isRefundable}` (GDS path).

> 🔴 **SUPERSEDED — 2026-09-30.** The "no equivalent quote operation" finding below is
> **wrong**, and so is the later revision that repeated it in `orderCancel.utils.js`.
> NDC[X] *does* have a cancel quote, and it is **mandatory after payment**:
> **`Travel_OrderReshop`**. The corrected decision is **ADR-27** at the end of this
> section; read that instead. Everything from here to the end of ADR-22 is kept only to
> record how the error was reached.

**NDC[X] has no equivalent quote operation.** Checked against the WSDL:

- `AMA_TravelOrderCancelRQ.Request` = `{ BookingRef[], OrderCancelParameters{ReasonCode,
  RefundPaymentMethodPreference}, Order, ExpectedRefundAmount }` — **no dry-run / quote
  flag** anywhere (`definitions/Request1.d.ts`, `OrderCancelParameters.d.ts`).
- `AMA_TravelOrderReshopRQ.Request.UpdateOrder` = `{ RepriceOrder, ReshopOrder,
  ReuseTickets }` (`definitions/{Request5,UpdateOrder}.d.ts`) — reprice/rebook, **not** a
  cancel quote. So AFKL's "`orderReshopRQ` → `DeleteOrder`" pattern
  (`AirFranceAdapter.ts:711-732`) has no NDC[X] counterpart either.
  ⛔ **This bullet is the error.** It stopped at `UpdateOrder`'s three children and never
  opened `ReshopOrder`. The cancel quote is
  `UpdateOrder/ReshopOrder/ServiceOrder/DeleteOrderItem[]` — a *deletion* quote. AFKL's
  `DeleteOrder` pattern has an NDC[X] counterpart after all.
- `Travel_OrderRetrieve`'s OrderView has no voidability field: the only status-ish
  elements in our captures are `Order/StatusCode` (`OPENED`) and `OrderItem/StatusCode`
  (`HK`, `NOT ENTITLED`).

**Decision — two phases.**

**Phase A (buildable today): `pnr.status === 1` → CANCEL.** A held, never-ticketed NDC[X]
order has no tickets, so void-vs-refund cannot arise. `Travel_OrderCancel` with the two
order keys, then `updateCancel({ Remark: "CANCELLED" }, …)` → `pnr.status = 3`
(`dossier.utils.js:9452-9457`). This needs no quote, no coupon vocabulary, and no capture
we don't have. It is also the case that actually occurs: NDC[X] bookings are held against
`Order/PaymentTimeLimitDateTime` and abandoned holds are the common cancel.

**Phase B (blocked): `pnr.status === 2` → VOID or REFUND.** The decision input does not
exist in any artifact we currently hold. Two candidate sources, both needing a **ticketed**
capture to settle:

1. *Post-hoc from the cancel reply.* `Response1.TicketDocInfo[]` is fully typed here
   (unlike the OrderView's empty `TicketDocInfo1` — see `NDCX-ORDERPAY-PLAN.md` §5) and
   metis already has the reader: `analyzeRetrieveCouponStatuses(ticketDocInfo, getTextValue)`
   (`utils/EK/orderCancelOutcome.utils.js`, used at `dossier.utils.js:3681`), where
   `CouponStatusCode === "V"` means voided. So: cancel, then classify from the coupons that
   come back — full V ⇒ VOID, mixed ⇒ partial void, none ⇒ REFUND. This is exactly the
   Farelogix/EK model (`updateCancel:9377-9405`), and it needs **no** pre-quote.
2. *Pre-hoc from `ChangeFees`.* `PenaltyAmount === 0 && CancelFeeInd` could stand in for
   "voidable", but that is an inference, not a documented signal.

Recommend (1), and recommend **not shipping Phase B until a real ticketed cancel has been
captured** — a wrong VOID/REFUND classification writes the wrong `pnr.status` (0 vs 4),
the wrong `refundedAmount`, and the wrong `MctoService` record, all of which are
accounting artefacts.

**Consequence.** `cancelCard.vue` already makes Phase A the cheap path: for
`pnr.status === 1`, `shouldFetchCancelDataOnOpen` returns `false`
(`cancelCard.logic.ts:42-47`), so `getCancelData()` is never called and no estimate is
needed. Phase A is genuinely end-to-end with no estimate work at all.

### ADR-27 — ✅ `Travel_OrderReshop` **is** the cancel quote, and it is mandatory after payment

**Supersedes ADR-22.** Added 2026-09-30, from
`.agents/skills/ndcx/references/08-cancel-refunds-and-profiles.md` §3 (WBS Implementation
Guide NDC[X] v1.5, "Cancel or Refunds") and five reference captures.

**The documented sequence:**

- **Before payment** (held, `pnr.status === 1`): `Travel_OrderRetrieve` →
  `Travel_OrderCancel`. Reshop not needed.
- **After payment** (ticketed, `pnr.status === 2`): `Travel_OrderRetrieve` →
  `Travel_OrderReshop` → `Travel_OrderCancel`. *"`Travel_OrderReshop` is **mandatory**
  before sending `Travel_OrderCancel`"*. The reshop "initiates the cancellation and returns
  the details regarding the cancel fare conditions"; the cancel then "validates and
  orchestrates the process triggered with `Travel_OrderReshop`".

**The three captures ADR-22 cited as proof that a bare cancel voids reliably all run a
reshop first** — `IB-Family-with-Void/7---OrderReshop-Req.xml`,
`AV-2-ADT-1-CHD-Fiscal-Code/9-OrderReshop--1.xml`,
`Split-PNR-with-Void/8-Query-Travel-OrderReshop.xml`. The bare cancel worked *because* the
quote had run. `VY-Family-DOCO-DOCA-DOCS` and `AF-Subscriber-Card` carry one too.

**Request shape** (`orderReshop.utils.js`): ⚠️ `Request/OrderItemRefID` carries an **Order
ID**, not an order-item id — the guide flags this explicitly ("!THIS IS AN ORDER ID!").
Real order-item ids go one-per-traveller in
`UpdateOrder/ReshopOrder/ServiceOrder/DeleteOrderItem/OrderItemRefID`, sourced from a
pre-cancel `Travel_OrderRetrieve`'s `Order/OrderItem[]`. Plus
`BookingRef/BookingEntity/Carrier/AirlineDesigCode` and
`ReshopParameters/Notices/PricingParameters/@AutoExchRequestInd="false"` (Farelogix reads
it; "no exchange" is correct for every carrier on a cancel, so it is sent unconditionally).

**What the quote gives us — and the trap it does not close.**

| Signal | Path | Verdict |
|---|---|---|
| Refund amount | `ReshopOffer/DeleteOrderItem/DifferentialAmountDue/Amount`, summed | ✅ **Authoritative.** Replaces the old `pnr.totalPrice − penalty` guess and finally satisfies §10's "to the cent". |
| VOID vs REFUND | `ReshopResults/@UseCase` | ⚠️ **A hint, not a verdict** — see below. |

🔴 **`@UseCase` is not always a verdict.** The guide says `VOID` or `REFUND`. Reality
across the five captures: `AV`, `AA`, `AF` → `VOID`; **`IB` and `VY` → the literal
`UNKNOWN`**. And `UNKNOWN` **cannot** be resolved from the amount's sign, which is the
obvious reading of the guide ("void → 0; refund → negative"): the **IB** capture quotes
`UNKNOWN` with a **negative** `-16758`/item, yet its `Travel_OrderCancel` returns **every
coupon in status `V`** — a full void. Classifying on the sign there would have written
`pnr.status = 4` plus a `MctoService` refund record against an order the airline voided.

**Decision — evidence order in `resolveNdcxCancelOutcome`:**

1. `pnr.status === 1` → `CANCEL` (no quote was run).
2. quote `UseCase ∈ {VOID, REFUND}` → use it.
3. otherwise (`UNKNOWN`/absent) → the cancel reply's coupons (`isFullVoid`). This was
   right on all five captures; the amount's sign was not.

So ADR-22's coupon classifier was *correct as a fallback* — it was only wrong as the
**only** input, and wrong to conclude no quote existed.

**Consequences.**

- A reshop that returns `Errors[]` (note: plural, unlike the cancel reply's `Error[]`)
  **aborts before the cancel**. An unquoted cancel on a ticketed order is what the guide
  forbids, and it is unrecoverable once the tickets move.
- Held cancels are unchanged: no reshop. (This bullet originally also said "and no
  pre-cancel retrieve either" — **ADR-28 reversed that**: the pre-cancel retrieve is now
  unconditional, because it is the only surviving source of the `Order` the front renders.)
- The response now carries `reshop` alongside `value` and `cancel`. This is the estimate
  source ADR-26 flagged as missing for `cancelCard.vue`'s ticketed branch; **ADR-29** wires
  it into the display.
- The reshop's `Response/Warning[]` joins the airline's cancel remarks in the internal
  dossier note: the IB capture's warning 486 ("services bought outside the NDC channel must
  be refunded via that channel") is exactly what an agent gets asked about.

### ADR-28 — 🔴 Nothing is retrieved after the cancel; the order's last readable state is the pre-cancel retrieve

**Supersedes ADR-24.** Added 2026-09-30, from a real failure.

**Context.** ADR-24 closed the cancel with a follow-up `Travel_OrderRetrieve`, reasoning
that `AMA_TravelOrderCancelRS` carries no `Order` (ADR-21) but the front's cancel card
wants one. The order does not survive its own cancellation. That retrieve returns:

```xml
<AMA_TravelOrderViewRS>
  <Errors><Error><Code>119</Code><DescText>UNABLE TO RETRIEVE PNR</DescText>
  <OwnerName>1A</OwnerName></Error></Errors>
</AMA_TravelOrderViewRS>
```

(own capture `use cases/NDCX/8209219850818-…-Travel_OrderRetrieveAsync-RS.xml`). Since
`collectErrors` correctly surfaces root-level `Errors/Error`, a **successful** cancel was
returning a `value` whose only content was an error — indistinguishable, to the front, from
a failed one.

**Decision.** `orderCancelRQ` issues **no host call after `Travel_OrderCancel`**.
Everything the response carries comes from before the cancel, or from the cancel itself:

| Needed | Source |
|---|---|
| `value` — the `Order` the front renders | the **pre-cancel** `Travel_OrderRetrieve` (now unconditional — it is no longer only the ticketed path's order-item source) |
| refund amount / penalty / `UseCase` | the `Travel_OrderReshop` quote (ADR-27) |
| outcome, coupons, `ChangeFees`, remarks | `AMA_TravelOrderCancelRS` |

**Consequences.**

- `value` is explicitly a **pre-cancel snapshot**, not post-cancel state. Post-cancel truth
  is metis's own dossier, written by `updateCancel` and re-read when the folder reloads.
  The front adapter's docblock says so.
- A pre-cancel retrieve that returns no usable order (`hasOrderData` false — e.g. it
  already answers 119 because the order expired) yields `value: null` rather than passing
  an error payload off as the order. The cancel still proceeds: metis has confirmed the
  order from its own `pnr` row.
- The held path gains that retrieve (it previously relied on the post-cancel one). Net host
  calls per cancel are unchanged for held (2) and ticketed (3).
- The early-return paths (quote errored, cancel errored) now return the real `value`: in
  both, the order is untouched and still current.
- Guarded by `__tests__/orderCancel.callSequence.test.js`, which asserts the exact host
  sequence and that **nothing** follows the cancel.

### ADR-29 — The cancellation table is filled by a quote-only `Travel_OrderReshop`, fetched on popup open

Added 2026-09-30. Closes the §7 item ADR-26 and ADR-27 both left open.

**Context.** `cancelCard.vue` shows the agent a per-passenger cancellation table — fare,
tax, TTC, refunded tax, penalty, total refund — before they confirm. NDC[X] showed nothing:
it was listed in `ONE_STEP_VOID_CARRIERS` (`front-reservation/app/utils/helpers/cancelVoidCarriers.ts`)
on ADR-22's claim that no dry-run existed, which makes `shouldFetchCancelDataOnOpen` skip
`getCancelData()` entirely. With ADR-27 that premise is gone.

**Decision, in three parts.**

1. **A quote-only route.** `POST /aerial/AMADEUS_NDCX/order/orderReshopRQ` runs
   `Travel_OrderRetrieve` → `Travel_OrderReshop` and stops, returning `{ value, reshop }`.
   Named to match AFKL's own quote route so the two carriers' tables are fed alike.

   Safe on popup open, and this is the substantive difference from AA: the reshop **prices**
   a deletion, it does not perform one. The guide's own sequence puts `Travel_OrderCancel`
   after it precisely because the reshop alone changes nothing — *"Travel_OrderCancel
   validates and orchestrates the process triggered with Travel_OrderReshop"*. Confirmed by
   the own-office SQ capture pair: the order was still fully retrievable between the two.

   It quotes twice per cancellation (open, then confirm), deliberately, as AFKL already
   does: the ReshopOffer carries an `OfferExpirationDateTime` and the agent may sit on the
   popup, so re-quoting is what keeps the persisted figure current.

2. **The rows are computed server-side** (`orderReshopReply.mapper.js#buildNdcxRefundItems`),
   one per `DeleteOrderItem`, in major units and in the table's own columns:

   | Column | Source |
   |---|---|
   | `price` | `OriginalOrderItemDifferential/Amount` |
   | `taxes` | `OriginalOrderItemDifferential/TaxSummary/TotalTaxAmount` |
   | `ttc` | `price + taxes` |
   | `refundTaxes` | `DifferentialAmountDue/TaxSummary/TotalTaxAmount` |
   | `penalty` | `PenaltyDifferential/Amount` |
   | `totalRefund` | `DifferentialAmountDue/Amount`, absolute |

   Row labels (`Billet: <n° billet> - MR NOM Prénom`) are joined out of the pre-cancel
   order view: `OrderItem/OrderItemID` → `FareDetail/PassengerRefs` (or `Service/PaxRefID`)
   → `PaxList` for the name, `TicketDocInfo/PassengerReference` for the ticket number.

   Two things this deliberately does **not** do:

   - **No division by a passenger count.** `getRefundPrice()` divides by the number of
     passengers of that PTC, because AFKL groups a PTC into one order item. Every NDC[X]
     capture keys `DeleteOrderItem` by a single passenger (`…_1APAX_PAX2`), VY down to one
     per segment per passenger. Dividing would quarter a family's refund.
   - **No ticket-keyed join.** `createRefundData()` rebuilds rows from
     `dossier_has_traveler[].ticket_aerial[]` and keeps only quoted items it can match to a
     metis ticket row. VY quotes 6 items for 3 travellers; that join would silently show
     half the money. Every quoted item gets a row; an unresolvable one falls back to its
     raw id rather than vanishing.

3. **`isPriced` decides whether a table is shown at all.** The AF void capture's
   `DeleteOrderItem` is a bare `OrderItemRefID` with no amounts anywhere. A table of zeroes
   reads as *"you get nothing back"* rather than *"the airline did not price this"*, so the
   front falls back to the existing VOID confirmation copy (`status = "VOID permitted"`).

**What is not inferred.** `refundTaxes` stays 0 when the airline gives
`DifferentialAmountDue` no `TaxSummary` — as on the SQ and AA voids, where the refunded
total plainly includes the tax. How a refund splits between fare and tax is the airline's
statement to make; back-computing it would be the same "reasoned it out instead of reading
the capture" mistake ADR-22 and ADR-24 both were. Likewise `UseCase` does **not** decide
what is displayed: IB and VY answer `UNKNOWN` with perfectly valid amounts. The presence of
amounts decides the display; the coupons decide void-vs-refund, after the fact (ADR-27).

**Consequences.**

- `AMADEUS_NDCX` is removed from `ONE_STEP_VOID_CARRIERS`. 🔴 Do not put it back — that
  entry is what was hiding the table.
- `AmadeusNdcxAdapter.getCancelData()` now exists (it previously inherited `BaseAdapter`'s
  throw, which the carrier list was keeping unreachable).
- `cancelCard.vue` gains one branch, `applyNdcxCancelQuote()`; the table markup is untouched
  and shared with the other carriers.
- Host calls on the ticketed path: 2 on popup open (retrieve + reshop, plus the card's own
  pre-existing `retrieveOrder`), 3 on confirm (retrieve + reshop + cancel).
- A quote that returns `Errors[]` closes the popup with the airline's message rather than
  letting the agent confirm into a cancel the backend will refuse anyway.
- Guarded by `orderCancel.callSequence.test.js` (the quote route issues **no** cancel, and
  a held order is not quoted at all) and by the `RefundItems`/`isPriced` cases in
  `ndcx-order-reshop-reply.mapper.test.js`, fixtured from the own-office SQ void, the IB
  refund and the AF unpriced void.

### ADR-30 — 🔴 Two NDC[X] columns reached the database NULL; each crashed a later step of the cancel

Added 2026-10-01, from the first live cancel after ADR-29. Two unrelated stacks, one shape:
a field that **is** on the wire was never mapped, so the column was NULL, and a consumer
that had only ever seen non-NULL blew up on it.

**Both fixes stay inside `src/utils/AMADEUS_NDCX/` and its controller.** The first attempt
patched `dossier.utils.js`, `ticket-aerial.service.js` and six `MCTO/*/transcontinent`
builders — a crash-guard sprayed across every provider for a defect only NDC[X] produces.
Reverted. 🔴 The rule: NDC[X] fills the hooks shared code already reads; it does not teach
shared code about NDC[X].

**1. `ticketAerial.bookingID` — `saveAfterRetreive` threw before the cancel even started.**

```
WHERE parameter "bookingID" has invalid "undefined" value
  at TicketAerialService.updateOrCreate (ticket-aerial.service.js:196)
  at saveAfterRetreive (dossier.utils.js:5704)
```

NDC[X] `TicketDocInfo` carries no `BookingRef` on the wire. `orderViewReply.mapper.js` left
it unmapped on the documented grounds that `updateIssuance` reads it as `|| null`. True for
issuance — **false for retrieval**, which puts the value in a Sequelize WHERE: `removeEmptyKeys`
drops the null key and Sequelize rejects the whole query rather than matching on NULL.

**Decision.** The mapper fills each `TicketDocInfo.BookingRef` from the order's own
`BookingRef` — the airline record locator, selected the same explicit ADR-9 way, never `[0]`.
Every ticket in an order belongs to that order's booking and the order states it exactly
once, so this is a restatement, not an inference. Issuance writes the same value, so a ticket
row and its later refresh now agree.

> ⚠️ **Rows issued before this hold `bookingID = NULL`.** Their next retrieve looks for the
> real locator, misses, and inserts a second ticket row. New bookings are consistent from
> issuance onward; backfill or delete the stale rows on dossiers created before this change.

**2. `segmentAerial.fareBasisCode` — `updateCancel` threw after the airline had already voided.**

```
TypeError: Cannot read properties of null (reading '0')
  at createVoidedFromTranscontinent (mctoVoidedTranscontinent.utils.js:349)
  at MctoService.createVoided → updateCancel (dossier.utils.js:9837)
```

`CLASS_CODE` is `fareBasisCode[0]`, the booking-class letter. `MctoService.createVoided` is
**not** wrapped in a try/catch in `updateCancel`, so this aborted everything after it —
`FacturationSegmentService.reCreate` and `CreditService.handleBookingStatusChange` never ran,
and the front got an error for a cancel the airline had already performed. `PnrService.update`
runs before it, so the dossier was left half-updated.

**Decision.** `saveAfterRetreive` **recreates** the segment rows and reads each segment's fare
basis from `body.dossierData.fareDetailsBySegment[<PaxSegmentID>].FareBasisCode` — a hook only
the front fills, and only at booking. So `handleOrderRetrieve` fills it itself, from the live
reply, via `buildNdcxFareDetailsBySegment` (`order.utils.js`). No shared code changes.

Source order per segment, most authoritative first:

| | Source |
|---|---|
| 1 | the reply — `OrderItem/FareDetail/FareComponent/FareBasis/FareBasisCode/Code`, tied to segments by `SegmentRefs`. **Is** given post-sale: own capture `8209219878436-…-Travel_OrderRetrieveAsync-RS.xml` gives SEG1 `K16SGRDP/DP`, SEG2 `N16SGRPO/DP`, each matching its own `RBD` |
| 2 | the value already stored on that segment, from booking — a retrieve recreates the rows, so a reply that omitted the fare basis would otherwise erase what we had |
| 3 | `"N/A"` — never NULL, which is what crashed the document |

🔴 It is **not** routed through `priceLookup`/`PriceClassList`, which is where `dossier.utils.js`
finds it for the other providers: on NDC[X] a `PriceClass` is the fare *family* (`FF51SGL`
"Economy Lite") and carries no `FareBasisCode` at all. Hijacking it would also corrupt the
fare-family data the shopping flow depends on.

**Consequences.**

- Covered by `buildNdcxFareDetailsBySegment`'s cases in `ndcx-order-retrieve.utils.test.js`
  (all three tiers, reply-wins-over-stale, first-component-wins), by the `BookingRef` cases in
  `ndcx-orderview-reply.mapper.test.js`, and end-to-end in
  `__tests__/orderRetrieve.errorReply.test.js`, which asserts what `saveAfterRetreive` is
  actually handed.
- `ndcx-order-pay.utils.test.js` asserted the old `ticket.BookingRef === undefined`. That
  assertion **was** the bug, written down; it now asserts the filled value and says why.
- Still latent, and left alone deliberately — all three are shared-code defects NDC[X] merely
  exposed, and fixing them belongs in their own change: `MctoService.createVoided`/
  `createRefunded` are unguarded inside `updateCancel`; `CLASS_CODE` renders the literal
  string `undefined` whenever the fare basis is empty (`""[0]`), which the "no segments" path
  already produced before NDC[X] existed; and `FLIGHT_CODE` renders `SQundefined` when a
  segment has no `flightNumberDeparture`.

### ADR-23 — 🔴 Guard `updateCancel` against firing Amadeus passive-PNR cancellation on NDC[X]

**Context.** Three shipped behaviours combine into a live host write on the wrong record:

1. ADR-9 deliberately puts the Amadeus record locator in `Order.pnrList` as
   `{ ownerIataCode: "1A", bookingReference: … }`.
2. `dossierCreate` fans that list into internal notes when it has more than one entry —
   `syncAmadeusPnrNotes({ dossierId, pnrList })` (`dossier.utils.js:1083-1089`) — and
   `buildPnrNoteText` renders the `1A` entry as the literal string
   **`PNR AMADEUS: <recloc>`** (`utils/AMADEUS/pnrNotes.utils.js:53`). NDC[X] always has
   two entries (carrier + `1A`), confirmed in the create fixture
   (`ndcx-orderview-reply.mapper.test.js:38-39`: `LO` + `1A`).
3. `updateCancel` (`dossier.utils.js:9531-9547`) then does:

   ```js
   const amadeusPassiveNote = notes.find((note) => note.text.includes("PNR AMADEUS"));
   if (amadeusPassiveNote && !NDCSabres.includes(dossier.pnr?.ownerCode)) {
     await cancelAmadeusPassiveSegments({ dossierId, salesPointId, sourcePnrCode: dossier.pnr?.pnr, status, … });
   }
   ```

   `pnr.ownerCode` is `"AMADEUS_NDCX"` (ADR-8), which is **not** in `NDC_SABRE_AIRLINES`
   (`utils/airline-constants.utils.js:43-48`). **The guard does not protect NDC[X].**

`cancelAmadeusPassiveSegments` (`services/AMADEUS/passive-segment-sync.service.js:431-520`)
re-extracts the recloc from the same note (`extractAmadeusPassivePnrFromNotes:44-55`,
which matches `"PNR AMADEUS"` *or* `"PNR 1A"`), opens a stateful Amadeus session,
`PNR_Retrieve`s it, removes any `RU` segments referencing the source PNR, and
**writes a metis status remark onto it** (`addMetisStatusRemarkOnPassivePnr`).

For a classic booking that recloc is a *passive* PNR metis itself created. For NDC[X] it
is **the airline order's own Amadeus record**. The RU removal will find nothing, but the
remark write and the session are real, against a live booking, on every cancel.

**Decision.** Widen the guard at `dossier.utils.js:9532` so `"AMADEUS_NDCX"` is excluded —
preferably via a named predicate rather than another inline array:

```js
// NDC[X]'s "PNR AMADEUS" note is the airline order's own 1A record (ADR-9), not a metis
// passive PNR — never run passive-segment cancellation against it.
if (amadeusPassiveNote && !isPassiveSegmentProvider(dossier.pnr?.ownerCode)) { … }
```

Keep the note itself: agents quote it, and `dossierCreate` writing it is the point of ADR-9.

**Consequences.**

- ⚠️ This is a **third** additive change to shared `dossier.utils.js`, alongside ADR-9's
  `pnr.pnrList` write and ADR-8's widened journeys gate. All three must be named
  explicitly in the PR description, per `NDCX-ORDERCREATE-FINISH-PLAN.md` §3's
  review-hygiene note — not buried as "a few additive lines".
- The sibling SABRE branch just above (`:9523-9529`, keyed on a `"PNR SABRE"` note) is
  harmless for NDC[X] — that note is never written — but check it again if NDC[X] ever
  starts importing PNRs.
- Audit the same note-based trigger elsewhere before merging: today
  `grep "PNR AMADEUS"` over `src/` finds exactly one production write
  (`AMADEUS/importPNR.controller.js:220`) and one production read
  (`dossier.utils.js:9531`). If `updateToDar`, `updateToDisrupted` or `forceRetrieve`
  grow one, the same guard applies.

### ADR-24 — ~~Post-cancel truth comes from a follow-up `Travel_OrderRetrieve`~~ (SUPERSEDED)

> 🔴 **SUPERSEDED — 2026-09-30, by ADR-28.** The premise below — that the order can be
> retrieved again after it is cancelled — is false. A cancelled/voided/refunded order is no
> longer readable: `Travel_OrderRetrieve` answers `AMA_TravelOrderViewRS/Errors/Error` Code
> **`119` "UNABLE TO RETRIEVE PNR"** (own capture
> `use cases/NDCX/8209219850818-NDCX-AdenisPDV-Travel_OrderRetrieveAsync-RS.xml`).
> `collectErrors` maps that faithfully, so the follow-up retrieve handed the front a `value`
> full of errors for a cancel that had **succeeded**. The rest of this ADR (the
> `saveAfterRetreive` warning, the ordering) is still correct and still applies.

**Context.** `AMA_TravelOrderCancelRS` carries no `Order` (ADR-21), but the front's cancel
card wants an order to render: `cancelCard.vue:49-57` calls `retrieveOrder(true)` on open
and reads `response?.Order`, and the confirm path returns to a folder page that re-reads
the dossier.

**Decision.** `orderCancelRQ` = `Travel_OrderCancel` → `Travel_OrderRetrieve` →
`mapNdcxOrderViewReply` for the returned `value`. Two host calls per cancel — the same
shape SABRE has (it retrieves *before* cancelling, `order.controller.js:402`).

⚠️ **Do not route that follow-up retrieve through `saveAfterRetreive`.** It runs
`analyzeRetrieveCouponStatuses` → `isFullVoid` → `pnr.status = 0`
(`dossier.utils.js:3675-3699`) and re-creates segments. Running it *before* `updateCancel`
means two writers racing for `pnr.status`, on an unverified coupon vocabulary (§9).

**Order of operations:**

```
1. Travel_OrderCancel          (host)
2. map the cancel reply        (ADR-21)  -> cancelOutcome, ChangeFees, Errors
3. if Errors -> respond, persist nothing
4. Travel_OrderRetrieve        (host)
5. mapNdcxOrderViewReply       (ADR-16, no persistence)      -> value
6. updateCancel(json, body, decodedToken, additionalData)    -> pnr.status, segments, notes
7. respond { value, cancel: <step 2 output> }
```

### ADR-25 — `ReasonCode` is optional and `ExpectedRefundAmount` is not sent

`OrderCancelParameters = { ReasonCode, RefundPaymentMethodPreference }`. The front already
sends a `ReasonCode` on cancel — `AirFranceAdapter.ts:743` puts `reshopData?.OfferID` in
it, an AFKL-specific abuse of the field. For NDC[X], send `ReasonCode` only if the host
demands one; the field is `CodeType|xs:token` with no enumeration in the generated type.

`RefundPaymentMethodPreference.OriginalPaymentMethodInd = true` for the Phase B refund
branch (refund to the original FOP is what metis assumes everywhere — `updateCancel`
records `refundedAmount` against the dossier, never an alternate instrument).

`Request/ExpectedRefundAmount` — **not sent**. It is a client-side assertion of the refund
we expect, and we have no quote to derive it from (ADR-22). Sending a wrong value risks a
host rejection that reads as a generic failure.

### ADR-26 — The generic route is enough; the front needs one adapter method and one UI branch

**Backend.** Unlike pay (`NDCX-ORDERPAY-PLAN.md` ADR-15), the generic route already exists:
`app.post("/orderCancelRQ", GlobalController.orderCancelRQ)` (`global.controller.js:775`),
dispatching to `controllers[Oras[ora]]?.OrderController.orderCancelRQ(req, res, next)`
(`:733`), and `getControllerFiles`'s `"AMADEUS_NDCX"` branch (`:181-183`) already merges
the module. **No dispatcher change is needed.**

⚠️ But note the optional chaining is on the **module**, not the **method**. Until
`OrderController` actually exports `orderCancelRQ`, that line throws `TypeError` into the
generic catch and returns a bare `{ error: "An error occurred while fetching data." }`
500 — which is what an NDC[X] cancel does *today*. Export the method before pointing the
front at it.

**Front.** `BaseAdapter.cancelOrder()` throws (`:992-994`), so there is no silent
mis-route here — contrast `issueOrder`, which does not throw and currently reaches AFKL
(`NDCX-ORDERPAY-PLAN.md` ADR-20). `AmadeusNdcxAdapter.cancelOrder()` posts to
`/aerial/global/orderCancelRQ` with `oras: ["AMADEUS_NDCX"]`, mirroring `bookFlight()` and
`retrieveOrder()`'s existing use of the generic routes (`AmadeusNdcxAdapter.ts:208,257`).

⚠️ **`getCancelData()` for a ticketed dossier has no home in the UI yet.**
`cancelCard.vue:90-124` branches the estimate display by `servicingFlow.ora`:
`["BA","IB","HV","TO","AMADEUS"]` → `{refund, amount}`; Kyte → `{amount, currency, …}`;
`SabreNDC` → same; **everything else** → the final `else`, which expects an AFKL-shaped
`response.DeleteOrder`. `"AMADEUS_NDCX"` lands in that `else`. Phase A never reaches it
(`shouldFetchCancelDataOnOpen` is false for `status === 1`), but Phase B must either emit
a `DeleteOrder`-shaped object or add an explicit branch. Named here so it is designed,
not discovered.

---

## 3. Domain model

```
dossier + pnr  (status 1 held  |  status 2 ticketed)
        │
        │  front: cancelCard.vue show()
        │           ├─ retrieve()  -> AmadeusNdcxAdapter.retrieveOrder(true)   [already shipped]
        │           └─ shouldFetchCancelDataOnOpen(pnr)  ->  false when status === 1
        │  front: confirm() -> AmadeusNdcxAdapter.cancelOrder()
        │           POST /aerial/global/orderCancelRQ   { oras:["AMADEUS_NDCX"], OrderID, ... }
        ▼
Travel_OrderCancel   (Travel Management 1.14, stateless)
  Request/Order/{OrderID (NDCX- stripped), OwnerCode (the airline)}
  Request/OrderCancelParameters/{ReasonCode?, RefundPaymentMethodPreference?}      [ADR-25]
        │
        ▼
AMA_TravelOrderCancelRS      ← NOT an OrderView                                    [ADR-21]
  Response/{OrderRefID, ChangeFees, OrderCancelProcessing, TicketDocInfo[], Warning[]}
  Error[]
        │  mapNdcxOrderCancelReply  ->  { OrderRefID, cancelOutcome, ChangeFees, Errors, ... }
        │
        ├─ Phase B only: classify VOID / REFUND from TicketDocInfo coupons          [ADR-22]
        ▼
Travel_OrderRetrieve  ->  AMA_TravelOrderViewRS  ->  mapNdcxOrderViewReply          [ADR-24]
        │   (mapped for the response; NOT run through saveAfterRetreive)
        ▼
updateCancel(json, body, decodedToken, additionalData)        dossier.utils.js:9245
        ├─ generic branch (:9445-9522) — NDC[X] lands here: not isKyte, and
        │  AirlineDesigCode is not A3/OA/EK
        ├─ status = json.Remark === "VOID" ? 0 : isRefundRemark(json.Remark) || body.isRefund ? 4 : 3
        ├─ SegmentAerialService.CancelSegmentByPnrToHx, ServiceAerialService.update,
        │  PnrService.update, FacturationSegmentService.reCreate, MctoService, CreditService,
        │  OrderHistoryService
        └─ 🔴 :9531 cancelAmadeusPassiveSegments(...)  ← must be guarded                [ADR-23]
```

**The two keys that identify the order** stay `Order/OrderID` + `Order/OwnerCode`
(`definitions/Order1.d.ts`). Same recovery as retrieve and pay: strip `NDCX-` via
`stripNdcxOrderIdPrefix` (`order.utils.js:306`), resolve the airline via
`resolveNdcxAirlineOwnerCode(pnr.pnrList)` (`order.utils.js:320`), which the controller
already does through `PnrService.getPnrListByOrderId` (`order.controller.js:131-137`).

---

## 4. Request mapping table — metis → `Travel_OrderCancel` RQ

Target paths relative to `AMA_TravelOrderCancelRQ`, confirmed against
`definitions/{AmaTravelOrderCancelRq,Request1,Order1,OrderCancelParameters,
RefundPaymentMethodPreference,ExpectedRefundAmount,BookingRef1}.d.ts`.

| Target | Source | Note |
|---|---|---|
| `Party.Sender.TravelAgency` | `{ AgencyID: "unused", PseudoCityID: "unused" }` | Mandatory on every `Travel_*` request — same literal as `order.utils.js:45,293`. |
| `Request.Order.OrderID` | `stripNdcxOrderIdPrefix(body.OrderID)` | ADR-9. Strip once, right before the wire call. |
| `Request.Order.OwnerCode` | `body.OwnerCode` ?? `resolveNdcxAirlineOwnerCode(pnr.pnrList)` | The **airline** (ADR-8). |
| `Request.OrderCancelParameters.ReasonCode` | `body.ReasonCode`, if present | ADR-25. Omit when empty — do not echo AFKL's `OfferID` abuse. |
| `Request.OrderCancelParameters.RefundPaymentMethodPreference.OriginalPaymentMethodInd` | `true` | **Phase B only** (ADR-22, ADR-25). Omit entirely in Phase A — a held order has nothing to refund. |
| `Request.BookingRef[]` | — | Omit. `BookingRef1 = {BookingID, TypeCode, BookingEntity}`; the order is already identified by the two keys. |
| `Request.ExpectedRefundAmount` | — | Not sent (ADR-25). |

**Reject before spending a host call** (same validate-then-build structure as
`createNdcxOrderRetrievePayload`, `order.utils.js:284-301`): missing `OrderID`; missing
`OwnerCode` after resolution; `pnr.status` already in `{0, 3, 4}` (already
cancelled/voided/refunded — a second cancel is a no-op at best); and, in Phase A only,
`pnr.status === 2` (ticketed — out of scope until Phase B, and the agent should be told so
rather than getting a half-applied cancel).

---

## 5. Reply → persistence table

| `AMA_TravelOrderCancelRS` | mapper output (ADR-21) | Consumer |
|---|---|---|
| `Error[]` (`Error1`: `Code, DescText, StatusText, TypeCode, …`) | `Errors: [{code, description}]` | Controller responds and **persists nothing**. Same shape `orderViewReply.mapper.js:75-78` emits, so the front's existing `responseValue?.Errors` handling works unchanged. |
| `Response/OrderRefID` | `OrderRefID` | Assert it equals the stripped `OrderID` we sent. A mismatch means we cancelled something else — cheap, and the only integrity check this reply offers. |
| `Response/ChangeFees` (single object) | `ChangeFees[]`, normalized through `penalty.utils.js` | Phase B: the cancellation penalty actually applied. Feeds the dossier note and, once trusted, `refundedAmount`. `PenaltyAmount` decimalises through `parseNdcxAmount` (ADR-10). |
| `Response/TicketDocInfo[]` (**fully typed here** — `TicketDocument`, `FareInfo`, `PricingInfo`, `Payments`, `OriginalIssueInfo`, `Commission`, …) | `cancelOutcome` via `analyzeRetrieveCouponStatuses` | Phase B's VOID-vs-REFUND classifier (ADR-22). Note the contrast: the *OrderView*'s `TicketDocInfo1` is an empty interface (`NDCX-ORDERPAY-PLAN.md` §5) — this one is not. |
| `Response/OrderCancelProcessing/{Remarks, Notices, MarketingMessages}` | `Remarks[]`, `Notices[]` | Write as an internal dossier note (`NoteService.create`, `noteType: "interne"`) — the airline's own explanation of what it did, which agents ask for. |
| `Response/Warning[]` | `Warning[]` | Return to the front; do not treat as failure (the ERR-05 advisory-vs-warning distinction `NDCX-ORDERCREATE-PLAN.md` §4.4 raised). |

### `updateCancel` inputs (generic branch, `dossier.utils.js:9445-9522`)

NDC[X] falls into the generic `else`: `body.isKyte` is false, and `body.AirlineDesigCode`
is not `A3`/`OA`/`EK`.

| Arg | Phase A (CANCEL) | Phase B (VOID) | Phase B (REFUND) |
|---|---|---|---|
| `json.Remark` | `"CANCELLED"` | `"VOID"` | `"refunded"` (`isRefundRemark` is `/refunded/i`, `utils/refund-amount.utils.js:20`) |
| `body.isRefund` | — | — | `true` |
| `additionalData.refundAmount` | — | — | from `ChangeFees` / `TicketDocInfo.PricingInfo` |
| resulting `pnr.status` | **3** | **0** | **4** |

`pnr.status` vocabulary, for reference: `0` void · `1` held · `2` ticketed · `3` cancelled ·
`4` refunded · `5` TTL expired · `-5` disrupted.

Side effects `updateCancel` performs for free in that branch, all of which we want:
segments to `HX` (`SegmentAerialService.CancelSegmentByPnrToHx`), `service_aerial` rows to
the same status, `FacturationSegmentService.reCreate`, `MctoService.createVoided` /
`createRefunded`, `CreditService.handleBookingStatusChange`, `OrderHistoryService.create`,
and approval-job cleanup + approver notification when the dossier was in an approval
circuit (`:9261-9316`).

---

## 6. `api-aerial` implementation checklist

### 6.1 `src/utils/dossier.utils.js` (one guarded line — ADR-23, **do this first**)

- [ ] Exclude `"AMADEUS_NDCX"` from the passive-segment trigger at `:9532`, via a named
      predicate. Additive, guarded, and it must be called out in the PR description
      alongside ADR-9's `pnr.pnrList` write and ADR-8's widened journeys gate.
- [ ] Unit-test it directly (`src/tests/unit/`), not only through the cancel flow: given a
      dossier with a `PNR AMADEUS: …` note and `pnr.ownerCode === "AMADEUS_NDCX"`,
      `cancelAmadeusPassiveSegments` is not called.
- [ ] Nothing else in `dossier.utils.js` is touched.

### 6.2 `src/utils/AMADEUS_NDCX/orderCancel.utils.js` (new)

- [ ] `createNdcxOrderCancelPayload(body)` — implement §4, validate-then-build.
- [ ] Reuse `stripNdcxOrderIdPrefix` / `resolveNdcxAirlineOwnerCode` from `order.utils.js`.
- [ ] `resolveNdcxCancelKind({ pnrStatus, cancelReply })` — Phase A returns `"CANCEL"`
      for `status === 1` and throws a clear, front-renderable error for `status === 2`;
      Phase B adds the coupon classification (ADR-22). Keep it a pure function so the
      branch is unit-testable without a host or a DB.

### 6.3 `src/utils/AMADEUS_NDCX/orderCancelReply.mapper.js` (new — ADR-21)

- [ ] `mapNdcxOrderCancelReply(reply)` → §5's shape. Import-light (no DB, no `$fetch`), so
      it runs under plain `node --test` like the other three NDC[X] mappers.
- [ ] Plain values, **not** `_text`-wrapped (ADR-21 consequences).
- [ ] Reuse `penalty.utils.js`'s `normalizePenaltyType` / `normalizePenaltyAppCode` /
      `normalizePenaltyDescText` for `ChangeFees`, and `amount.utils.js`'s
      `parseNdcxAmount` / `readCurrencyDecimals` for `PenaltyAmount`.
      ⚠️ `readCurrencyDecimals` reads `Response/Metadata/Other/OtherMetadata` — which
      `Response1` does **not** declare. Expect the ISO-4217 fallback to carry this reply,
      and make sure the array-shape fix from `NDCX-ORDERCREATE-FINISH-PLAN.md` §2 degrades
      cleanly when the metadata block is absent entirely.
- [ ] `ensureArray` every `ChangeFees` / `TicketDocInfo` / `Warning` / `Error` read.

### 6.4 `src/controllers/AMADEUS_NDCX/order.controller.js` (extend)

- [ ] `OrderController.orderCancelRQ` — mandatory before the front points at the generic
      route (ADR-26's TypeError note).
- [ ] `handleOrderCancel(req, res, ndcxService)` implementing ADR-24's seven steps in
      order. Reuse the existing `PnrService.getPnrListByOrderId` → `resolveNdcxAirlineOwnerCode`
      resolution (`:131-137`) rather than duplicating it.
- [ ] Phase A guard: `pnr.status !== 1` → 400 with a message the agent can act on
      ("cancelling a ticketed NDC[X] order is not supported yet"), **before** the host call.
- [ ] `NdcxError` → 502, everything else → 500 (existing pattern, `:63`).
- [ ] If `NDCX-ORDERPAY-PLAN.md` ADR-15's multi-route `setupRoute` refactor has landed,
      register `/orderCancelRQ` on the provider-local mount too, for symmetry. If it has
      not, the generic route alone is sufficient and this step needs **no** routing work.

### 6.5 Tests

- [ ] `src/utils/__tests__/ndcx-order-cancel.utils.test.js` — request builder: `NDCX-`
      stripped exactly once; airline `OwnerCode` (not `"AMADEUS_NDCX"`); Phase A sends no
      `RefundPaymentMethodPreference`; every §4 guard rejects before building.
- [ ] `src/utils/__tests__/ndcx-order-cancel-reply.mapper.test.js` — fixture-based, from a
      real capture (§8): `Errors` shape matches the OrderView mapper's; `ChangeFees`
      normalizes to `{TypeCode: "Cancellation", AppCode: "PDE"}` rather than
      `"Cancel"`/`"2"` (the ADR-11 normalizer); a `"Not Allowed"` instruction maps to the
      `"NAV"` sentinel (the `NDCX-ORDERCREATE-FINISH-PLAN.md` §2 fix); `PenaltyAmount`
      decimalises to major units.
- [ ] `resolveNdcxCancelKind` unit tests for every `pnr.status` input.
- [ ] The ADR-23 guard test (§6.1).

---

## 7. `front-reservation` implementation checklist

- [ ] `AmadeusNdcxAdapter.cancelOrder()`:

      initClaussData()
      const { isRefund, dar, reshopData, refundData } = useOrderServicingFlow().getData()
      POST /aerial/global/orderCancelRQ
        oras        <- ["AMADEUS_NDCX"]
        OrderID     <- folder.pnr.orderId          // still NDCX- prefixed; stripped server-side
        OwnerCode   <- folder.pnr.pnrList.find(p => p.ownerIataCode !== "1A")?.ownerIataCode
                                                    // best-effort; resolved server-side anyway
        agenceInfo  <- folder.agency
        ...claussDataSend

      Modelled on `AirFranceAdapter.ts:734-754`, minus its AFKL-specific `ReasonCode`
      (ADR-25) and `refundData`/`dar` (Phase B).
- [x] ~~**Do not** override `getCancelData()` in Phase A.~~ **Done in ADR-29.** The premise
      here was ADR-22's (no quote exists, so nothing to fetch). `getCancelData()` now posts
      to the quote-only `/aerial/AMADEUS_NDCX/order/orderReshopRQ` and returns
      `{ value, reshop }`.
- [x] Verify `cancelCard.vue`'s `retrieve()` works on an NDC[X] folder — it calls
      `retrieveOrder(true)`, implemented.
- [x] ~~Phase B: add an `AMADEUS_NDCX` branch to `cancelCard.vue`'s estimate display, or
      emit a `DeleteOrder`-shaped payload from `getCancelData()` (ADR-26).~~ **Done in
      ADR-29** — a branch, not a `DeleteOrder` shape: the AFKL payload goes through
      `getRefundPrice()`, whose per-PTC division and `NewOfferItemDifferential` reads are
      wrong for a cancel quote. The backend emits the table's rows directly instead.
- [x] ~~Phase A UX: a "not supported yet" message on a ticketed NDC[X] folder.~~ Moot —
      the ticketed path is supported and priced.

---

## 8. Capture-then-test procedure

Same shape and reason as `NDCX-ORDERCREATE-PLAN.md` §7 — never commit a vendored AF example
as a fixture.

1. Ship §6 far enough that the call round-trips. A throwing mapper is fine —
   `ndcxLogger` writes the XML either way (`ndcxLogger.js:56-59`).
2. Run with `NODE_ENV=development`, create a **held** NDC[X] order (shopping → offerPrice
   → orderCreate) on one of the routes our captures use, then cancel it. Keep both
   `…-Travel_OrderCancelAsync-RQ.xml` and `-RS.xml` in `use cases/NDCX/`.
3. [ ] Extend or clone `fixtures/generate-ndcx-orderview-fixture.js` for the cancel RS —
   unwrap `parsed?.Body?.AMA_TravelOrderCancelRS` and **reuse `CLIENT_OPTIONS` verbatim**
   (`forceItemsEnumerable`, `attributesKey: "$attributes"`, `ignoredNamespaces`): they
   decide which nodes come back as arrays, so the fixture is faithful only if they match
   `NdcxClient.create`.
4. [ ] Write §6.5's tests against it.
5. **Phase B blocker.** The ticketed branch needs a *ticketed* cancel capture, which needs
   `Travel_OrderPay` to work first. Sequence this step **after**
   [`NDCX-ORDERPAY-PLAN.md`](./NDCX-ORDERPAY-PLAN.md), and capture pay + ticketed-retrieve
   + ticketed-cancel in one session — those three discharge every remaining
   `TicketDocInfo` unknown across both plans at once.

---

## 9. Open questions — resolve while building, don't assume

- 🔴 **Phase B's VOID-vs-REFUND signal** (ADR-22). No quote operation exists on this
  interface. The recommended post-hoc coupon classification is plausible but unverified;
  a wrong classification writes the wrong `pnr.status` and the wrong accounting record.
  **Do not ship Phase B on inference.**
- **`CouponStatusCode` vocabulary.** `analyzeRetrieveCouponStatuses` reads `"V"` = voided
  (`utils/EK/orderCancelOutcome.utils.js`, EK/Farelogix vocabulary). Whether NDC[X] uses
  the same single letters, and what it emits for refunded (`"RF"`, per
  `SABRE/order.controller.js:518`), is unconfirmed.
- **`Order/StatusCode` after a cancel.** Our captures only ever show `OPENED` (order) and
  `HK` / `NOT ENTITLED` (order item). `dossier.utils.js:3756` treats
  `["XX","CAN","NX","HX","UN","UC","NO"]` as cancelled — none of which we have observed.
  This is the same open question `NDCX-ORDERCREATE-PLAN.md` §8 raised, and it now blocks
  the ADR-24 follow-up retrieve's interpretation as well.
- **Does a held-order cancel return `ChangeFees` at all?** A held order has no penalty to
  apply, so the block may be absent. The mapper must tolerate that (it should anyway), and
  Phase A must not depend on it.
- **Is a second cancel idempotent?** §4 rejects `pnr.status ∈ {0,3,4}` client-side, but a
  cancel racing a TTL expiry could still hit an already-cancelled order. Decide whether
  the host's error for that is distinguishable, and whether it should reconcile the
  dossier rather than surface an error.
- **Partial cancel.** `Travel_OrderCancel` addresses `Order`, not `OrderItem` — so
  per-passenger and per-segment cancel (metis's `splitCancel`, `refundDelete`) have no
  NDC[X] path here. Confirm whether `Travel_OrderChange` is the intended route before an
  agent asks for it.
- **Approval-circuit dossiers.** `updateCancel:9261-9316` deletes pg-boss approval jobs
  and emails the approvers. Untested on any NDC[X] dossier; worth one SBT smoke test since
  NDC[X] bookings can be SBT (`pnr.isSbt` is set from the token's group depth,
  `dossier.utils.js:1104-1109`).

---

## 10. Definition of done

**Phase A**

- [ ] `POST /aerial/global/orderCancelRQ` with `oras: ["AMADEUS_NDCX"]` on a **held**
      NDC[X] dossier cancels the order at the host and returns a mapped cancel reply plus
      a refreshed `value`.
- [ ] `pnr.status` goes `1 → 3`; segments are `HX`; `facturation_segment` rows are
      re-created; an `orderCancel` row exists in order history.
- [ ] 🔴 **No Amadeus session is opened against the `1A` record locator** (ADR-23) —
      verified from the Amadeus logs or by asserting the guard, not by hoping.
- [ ] The airline's `OrderCancelProcessing` remarks land as an internal dossier note.
- [ ] A second cancel on the same dossier is rejected client-side, before any host call.
- [ ] Own-office `Travel_OrderCancel` RQ/RS captured in `use cases/NDCX/` and committed
      as fixtures; `ndcx-order-cancel.utils.test.js` and
      `ndcx-order-cancel-reply.mapper.test.js` green.
- [ ] Cancelling a **ticketed** NDC[X] dossier fails cleanly with an actionable message,
      before the host call.
- [ ] PR description names the ADR-23 `dossier.utils.js` guard explicitly, alongside
      ADR-8's and ADR-9's existing shared-code changes.

**Phase B** (after a ticketed capture exists)

- [ ] A voidable ticketed order → `pnr.status = 0`, `MctoService.createVoided`.
- [ ] A non-voidable ticketed order → `pnr.status = 4`, `refundedAmount` matching the
      airline's figure **to the cent**, `MctoService.createRefunded`,
      `TicketAerialService.updateToRefund` rows.
- [ ] A partial void is not silently reported as a full one (the EK trap,
      `updateCancel:9377-9393`).
- [ ] `cancelCard.vue` renders the estimate for `"AMADEUS_NDCX"` rather than falling into
      the AFKL `DeleteOrder` `else` (ADR-26).
- [ ] `NDCX-INTEGRATION.md` §5 items ticked and its "branching condition" open question
      struck (ADR-22).

---

## 11. Glossary additions

Extends `NDCX-ORDERCREATE-PLAN.md` §10 and `NDCX-ORDERPAY-PLAN.md` §11.

| Term | Meaning here |
|---|---|
| **`AMA_TravelOrderCancelRS`** | `Travel_OrderCancel`'s reply — **not** an OrderView. `{OrderRefID, ChangeFees, OrderCancelProcessing, TicketDocInfo[], Warning[]}` + `Error[]`. The reason ADR-6's one-mapper decision stops here (ADR-21). |
| **`ChangeFees`** | The cancellation penalty the airline actually applied. Carries the same `TypeCode`/`AppCode`/`CancelFeeInd`/`ChangeFeeInd`/`DescText` vocabulary as the OrderView penalties, so `penalty.utils.js`'s normalizers apply unchanged. A single object on the wire, not an array. |
| **`cancelOutcome`** | metis's existing void-classification shape — `{isFullVoid, isPartialVoid, voidedTicketNumbers, failedTicketNumbers}` — produced by `analyzeRetrieveCouponStatuses` / `parseFarelogixOrderCancelOutcome` (`utils/EK/orderCancelOutcome.utils.js`) and read by `updateCancel:9380`. Phase B's classifier reuses it rather than inventing one. |
| **Passive-PNR landmine** | `updateCancel:9531` triggers Amadeus passive-segment cancellation off a `PNR AMADEUS: …` note. ADR-9 makes every NDC[X] dossier carry that note, and `pnr.ownerCode === "AMADEUS_NDCX"` slips the existing `NDCSabres` guard — so the cancel would write to the airline order's real `1A` record. ADR-23 closes it. |
| **Phase A / Phase B** | Held-order CANCEL (buildable today, needs no quote) vs ticketed VOID/REFUND (blocked on a ticketed capture and on the voidability signal). ADR-22. |
| **`pnr.status`** | `0` void · `1` held · `2` ticketed · `3` cancelled · `4` refunded · `5` TTL expired · `-5` disrupted. The branch key (ADR-22) and the thing every Definition-of-Done item above asserts. |
