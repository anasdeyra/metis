# NDC[X] Next Step — Order Pay / Ticketing (`Travel_OrderPay`) — MET2-2422

Companion to [`NDCX-INTEGRATION.md`](./NDCX-INTEGRATION.md) (standing source of truth for
the whole integration), [`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md) (the
create/hold half of booking, which this one consumes) and
[`NDCX-ORDERCREATE-FINISH-PLAN.md`](./NDCX-ORDERCREATE-FINISH-PLAN.md). Sibling plan:
[`NDCX-ORDERCANCEL-PLAN.md`](./NDCX-ORDERCANCEL-PLAN.md).

This file plans **only** the pay/ticket half of booking — the second of the two booking
steps locked in `NDCX-INTEGRATION.md` ("booking is two separate steps").

Repos: `api-aerial` (branch `deyra-met2-2422`) **and** `front-reservation`.
Written 2026-09-23 from a fresh read of the actual code (`order.controller.js`,
`order.utils.js`, `orderViewReply.mapper.js`, `dossier.utils.js`, `global.controller.js`,
`BaseAdapter.ts`, `AmadeusNdcxAdapter.ts`), the vendored WSDL type definitions
(`src/types/NDCX/ndcxpdttravelmanagement11440/definitions/`), and the ten own-office
captures in `api-aerial/use cases/NDCX/`. Element shapes below are read off the generated
types and real captures, never off prose (same discipline as `offer.utils.js` / Trap 4).

**ADR numbering.** `NDCX-OFFERPRICE-PLAN.md` §2 holds ADR-1…5, `NDCX-ORDERCREATE-PLAN.md`
§2 holds ADR-6…14. This file is allocated **ADR-15…20**;
`NDCX-ORDERCANCEL-PLAN.md` is allocated **ADR-21…26**. Do not renumber.

---

## 1. Scope

**In scope**

- Resolve `NDCX-INTEGRATION.md`'s standing "no generic `/orderPayRQ` route" open
  question (ADR-15), and restructure `order.controller.js` to serve more than one route.
- `createNdcxOrderPayPayload(body)` — the `Travel_OrderPay` request builder.
- **No new reply mapper** (ADR-16): `Travel_OrderPay` returns the same
  `AMA_TravelOrderViewRS` that create and retrieve return.
- `toUpdateIssuanceJson(value)` — the small `DossierCreate` → `updateIssuance`-`json`
  bridge (ADR-17), plus the `buildTicketDocInfo` extension it depends on.
- `updateIssuance` wiring + ticketing status (ADR-19).
- `front-reservation`: `AmadeusNdcxAdapter.bookFlight()` gains `payment` (ADR-18), and
  `issueOrder()` is overridden (ADR-20 — **it currently mis-routes to AFKL**).
- Fixture-based tests: one for the request builder, one for the bridge.

**Explicitly not in scope**

- `orderCancelRQ` — see [`NDCX-ORDERCANCEL-PLAN.md`](./NDCX-ORDERCANCEL-PLAN.md).
- `orderChangeRQ` / `orderReshopRQ`, `service.controller.js`, `seat.controller.js`.
  No stub files, same reasoning as `NDCX-OFFERPRICE-PLAN.md` §1.
- Ancillary issuance (`process: "issuanceAncilaries"` → `updateIssuanceAncilaries`,
  `dossier.utils.js:9019`). NDC[X] has no ancillaries yet (§7 of the integration doc).
- 3DS / `SecurePaymentAuthenticationVersion` beyond pass-through — §9 open question.
- `Request.Parameters.Invoice` (`Parameters2` → `Invoice1`): host-side invoice delivery,
  no metis consumer.

---

## 2. Decisions taken this session (ADRs)

### ADR-15 — A dedicated NDC[X] route, `POST /AMADEUS_NDCX/order/orderPayRQ`

**Context.** `NDCX-INTEGRATION.md` lists three options. Each was checked against the code:

| Option | Verdict |
|---|---|
| New generic `/orderPayRQ` + `GlobalController.orderPayRQ` | **Rejected.** The dispatcher pattern is `controllers[Oras[ora]]?.OrderController.orderPayRQ(req, res, next)` (`global.controller.js:705,719,733`) — the `?.` guards the *module*, not the *method*. Adding the route means every one of the ~11 providers whose `OrderController` has no `orderPayRQ` throws `TypeError` into the generic catch and returns a bare 500. Widening a shared contract for one provider. |
| NDC[X]-only route via the controller's own `setupRoute` | **Chosen.** `app.js:202-240` already walks `controllers/` recursively and mounts every `*.controller.js` that exports `setupRoute` at `/<folder>/<name>` — so `controllers/AMADEUS_NDCX/order.controller.js` is **already** mounted at `/AMADEUS_NDCX/order`, behind Keycloak + `afConfigMiddleware`. Self-contained, zero blast radius, same mechanism `AFKL/order.controller.js:1375-1378` uses. |
| Fold into `orderChangeRQ` with `process: "issuance"` | **Rejected as routing, kept as payload shape.** This *is* the house convention — `BaseAdapter.issueOrder` (`:956`) posts to `/aerial/<controller>/order/orderChangeRQ` with `process: "issuance"`, and AFKL branches on it (`AFKL/order.controller.js:418,525`). But for NDC[X] `Travel_OrderChange` is a genuinely distinct host operation (integration §6), and overloading one route means the change work later has to un-pick the branch. |

**Decision.** `POST /AMADEUS_NDCX/order/orderPayRQ` (i.e. `/aerial/AMADEUS_NDCX/order/orderPayRQ`
through the Nuxt proxy), registered by `order.controller.js`'s own `setupRoute`.
The front keeps sending `buildIssuancePayload`'s body shape (`process: "issuance"` and all)
so ADR-20's override is a URL swap, not a payload rewrite.

**Consequences.**

- ⚠️ **`BaseControllerFactory.setupRoute` registers exactly one endpoint**
  (`controller.utils.js:166-169`: `app.post(this.endpoint, …)`). `order.controller.js:163`
  currently re-exports it as-is. It must be replaced by an explicit multi-route
  `setupRoute(app)` registering `/orderCreateRQ`, `/orderRetrieveRQ` **and** `/orderPayRQ`.
- ⚠️ **The create/retrieve discriminator has to go.** `processRequest` today picks the
  operation by sniffing the body: `if (req.body?.OrderID) → retrieve, else → create`
  (`order.controller.js:58-61`), and `validateControllerInput` does the same (`:26-44`).
  `Travel_OrderPay` also carries an `OrderID`, so the sniff becomes ambiguous the moment
  pay exists. Replace it with explicit per-operation handlers before adding pay — this is
  a **refactor of shipped code**, not an addition, and it is the first commit of this step.
- The generic `/orderCreateRQ` and `/orderRetrieveRQ` routes keep working unchanged
  (`global.controller.js:773-774`); the provider-local routes are additive.

### ADR-16 — No new reply mapper; `Travel_OrderPay` reuses `mapNdcxOrderViewReply`

`ndcx.service.js:178-183` types `travelOrderPay`'s reply `AmaTravelOrderViewRs2` — the
same `AMA_TravelOrderViewRS` document create and retrieve return, which is exactly what
ADR-6 was decided on. Every branch in `orderViewReply.mapper.js` is already
presence-driven (`ticketDocInfoRaw.length > 0` → `Order.isTicketed`, mapper `:47,69,124`),
so a post-pay reply flows through it with no operation parameter and no new file.

**Consequence.** The only *new* mapping work in this step is (a) the request builder and
(b) extending `buildTicketDocInfo` (mapper `:256-273`), which ADR-6 deliberately shipped
under-built because create never exercises it. See §5 — that extension is the highest-risk
item here.

### ADR-17 — The `DossierCreate` → `updateIssuance` bridge is its own function

**Context.** `updateIssuance(json, body, decodedToken, jwtToken, jsonRS)`
(`dossier.utils.js:8741`) takes **two different shapes of the same reply**:

| Arg | Convention | Evidence |
|---|---|---|
| `json` | **plain values**, flat `{ newPNR, PaymentInfo[], ticketDocInfo[] }` | `:8824` iterates `json.ticketDocInfo`; `:8845` reads `ticket?.Ticket?.TicketNumber` with no `._text`; `:8848-8850` read `ticket?.FareDetail?.FarePriceType?.Price?.*?.Amount`. Reference implementation: `utils/TURKISHA/order/orderPay.utils.js:3` (`formatJsonForUpdateIssuance`). |
| `jsonRS` | `._text`-wrapped `DossierCreate` | `:8746` `JSON.parse(JSON.stringify(jsonRS))`, `:8752` `dataRS?.Order?.StatusCode?._text`. |

`mapNdcxOrderViewReply` emits the wrapped shape (ADR-7). It must keep emitting it —
`dossierCreate` and `saveAfterRetreive` depend on it.

**Decision.** A new `toUpdateIssuanceJson(value)` in
`src/utils/AMADEUS_NDCX/orderPay.utils.js` unwraps the mapper's output into the flat
shape. The controller then calls:

```js
await updateIssuance(toUpdateIssuanceJson(value), body, req.decodedToken, req.jwtToken, value);
```

— the same object twice, once unwrapped. Exactly the split AFKL uses
(`AFKL/order.controller.js:527`: `updateIssuance(value, body, …, jsonRS?.…?.Response)`).

**Consequence.** Do **not** "unify" the two conventions by changing the mapper. Two
consumers, two conventions — the same reasoning ADR-7 gave for keeping
`offerPriceReply.mapper.js` and `orderViewReply.mapper.js` apart.

### ADR-18 — Payment is captured at hold and read back at pay; there is no host FOP catalogue

**Context — this closes `NDCX-ORDERCREATE-PLAN.md` §8's open question.** That plan asked
"Is `Order/PaymentInfo` populated at create for our carriers?", noting AF-OIN returns a
10-entry catalogue and AF-Public returns none. Checked against our **own office's**
captures:

| Capture set | `<PaymentInfo>` | `<Payments>` |
|---|---|---|
| `use cases/NDCX/*Travel_OrderCreateAsync-RS.xml` (10 files, carriers **AC**, **LO**) | **0 occurrences** | — |
| `use cases/NDCX/*Travel_OfferPriceAsync-RS.xml` | — | **no `Payments` block**; the only payment-ish element present is `PaymentTimeLimitDateTime` |

So for our pilot carriers there is **no FOP catalogue anywhere** — not at pricing, not at
create. Nothing to select a `PaymentInfoID` from.

Meanwhile the metis convention is that the FOP is chosen on the order page and persisted
at booking: `SabreAdapter.ts:923-928` sends `payment: { paymentMethod, paymentInfoId,
paymentTypeCode, …}` in `bookFlight()`'s body, `dossierCreate` destructures it
(`dossier.utils.js:946` — `let { payment = null } = body;`) and writes
`pnr.{paymentMethod, paymentInfoId, paymentTypeCode, CardHolderName, CardBrandCode,
EncCardNumber, EncCvv, …}` (`:1189-1214`). `BaseAdapter.buildIssuancePayload` (`:779-904`)
reads exactly those columns back at issuance time.

`AmadeusNdcxAdapter.bookFlight()` (`AmadeusNdcxAdapter.ts:186-232`) sends **no `payment`
key at all**. The defaults therefore apply: `paymentMethod: "Cash"` (`:1189`),
`paymentTypeCode: "NAV"` (`:1191`), `paymentInfoId: null`, every card column null.

**Decision.**

1. `bookFlight()` sends `payment`, sourced the same way as SABRE's.
2. `PaymentInfoID` is **ours to mint** — there is no catalogue to match against. Use
   `"PAY1"`, consistent with the `PAX{n}` / `SEG{n}` conventions already in the builders.
3. The pay builder reads the persisted `pnr` columns, not `body.paymentInfo` alone, so a
   pay retried days later still works.

**Consequences.**

- Without step 1, **every** NDC[X] dossier reaches the pay step with `NAV`/`Cash` and no
  card — the pay request has nothing to send. This is a prerequisite, not a nicety.
- `pnr.EncCardNumber` / `EncCvv` are stored encrypted (`dossier.utils.js:1126-1137`) and
  need `decryptData` before the wire call.
- ⚠️ **Security review item.** The AF/KL host-public-key card encryption path
  (`getPaymentData`, `dossier.utils.js:586-623`) is gated on `OwnerCode === "AF" || "KL"`,
  and ADR-8 sets `Order.OwnerCode = "AMADEUS_NDCX"` — so it is bypassed by construction.
  NDC[X] therefore sends the raw PAN in the SOAP body over TLS, the same way classic
  AMADEUS does. That is a deliberate consequence of ADR-8, not an oversight, but it must
  be **named in the PR description** rather than discovered in review.

### ADR-19 — `updateIssuance` at pay; `saveAfterRetreive` stays on retrieve

**Context — this narrows a standing decision, deliberately.** `NDCX-INTEGRATION.md`'s
locked list says "`saveAfterRetreive` at pay and retrieve", and `NDCX-ORDERCREATE-PLAN.md`
ADR-12 says OrderPay "calls `saveAfterRetreive` + `updateIssuance`". Checked against every
other provider: the issuance branch calls **`updateIssuance` only** —
`AFKL:527`, `EK:596,786`, `ACCELYA:252`, `IBERIA:246,579`, `TURKISH_AIRLINES:570,695`,
`TRANSAVIA/order/orderChange.service.js:776`, `BA/orderChangeService.js:357`. None pairs it
with `saveAfterRetreive`.

And `saveAfterRetreive` is not inert: it archives and re-creates segments, and it runs
`analyzeRetrieveCouponStatuses(…)` → `isFullVoid` → `pnr.status = 0`
(`dossier.utils.js:3675-3699`). Running that on a reply whose coupons were issued
milliseconds ago is at best redundant and at worst a status flip driven by an
unverified coupon vocabulary (§5).

**Decision.** `orderPayRQ` calls `updateIssuance` only. `saveAfterRetreive` remains
`orderRetrieveRQ`'s job (already shipped, `order.controller.js:152`). `dossierCreate` is
never called here — ADR-12's "exactly once per booking" still holds.

**Consequence.** `NDCX-INTEGRATION.md`'s locked line and ADR-12's wording should be
amended when this merges. Flagged rather than silently diverged.

### ADR-20 — `issueOrder()` must be overridden: the default silently posts to **AFKL**

**Context.** Most unimplemented `BaseAdapter` methods throw
(`bookFlight:507`, `retrieveOrder:521`, `cancelOrder:992`, `getCancelData:999`). **`issueOrder`
does not** — it is concrete (`:956-989`) and posts to:

```
/aerial/${getControllerByOra(servicingFlow().ora)}/order/orderChangeRQ
```

`getControllerByOra` (`:114-116`) looks `ora` up in `CONTROLLERS` (`:30-78`) and
**falls back to `"AFKL"`** when it finds nothing. `CONTROLLERS` has no `AMADEUS_NDCX`
entry, and `servicingFlow().ora` for an NDC[X] dossier is `pnr.ownerCode` =
`"AMADEUS_NDCX"` (ADR-8).

So today, pressing *émettre* on an NDC[X] folder POSTs an issuance payload to
**`/aerial/AFKL/order/orderChangeRQ`**. Not a clean "not implemented" error — a live call
into another provider's controller.

**Decision.** `AmadeusNdcxAdapter` overrides `issueOrder()` to post to ADR-15's route.

**Consequences.**

- ⚠️ The same silent-AFKL-fallback applies to every other concrete `BaseAdapter` method
  that uses `getControllerByOra`: `validateIssuancePrice` (`:941`), `updateAPIS` (`:620`),
  `updatePax`/`infoChange`/`contactChange`/… (`:661`), `getSeats` (`:435`),
  `getServices` (`:490`), `split*` (`:693,1127`). **Out of scope for this step**, but they
  are the same class of latent bug and should be audited before NDC[X] goes near a real
  office. Cheapest global fix: add `{ name: "AMADEUS_NDCX", oras: ["AMADEUS_NDCX"] }` to
  `CONTROLLERS` so the fallback resolves to NDC[X]'s own (mounted, auto-discovered)
  controller folder instead of AFKL's — then unimplemented routes 404 instead of
  cross-provider-executing.
- `validateIssuancePrice()` (the reprice-before-issue pre-check) is **not** implemented for
  NDC[X] in this step; whoever wires the UI must not call it. Tracked in §9.

---

## 3. Domain model — where pay sits

```
Travel_OrderCreate  ──►  AMA_TravelOrderViewRS   (held: OrderItem/StatusCode HK,
        │                                          Order/StatusCode OPENED,
        │                                          no TicketDocInfos, no PaymentInfo)
        │  mapNdcxOrderViewReply  ->  DossierCreate
        │  dossierCreate(...)   -> dossier + pnr (status 1, isTicketed false)   [ADR-12]
        │  body.payment          -> pnr.{paymentMethod, paymentTypeCode, ...}   [ADR-18]
        ▼
   (agent confirms; possibly days later, before Order/PaymentTimeLimitDateTime)
        │
        │  front: buildIssuancePayload() reads those pnr columns back   [BaseAdapter:779]
        │         AmadeusNdcxAdapter.issueOrder() -> POST /AMADEUS_NDCX/order/orderPayRQ  [ADR-15, ADR-20]
        ▼
Travel_OrderPay   (Travel Management 1.14, stateless)
  Request/PaymentInfo[]/{PaymentInfoID, Amount, TypeCode, PayerContactInfo, PaymentMethod}
  Request/Order/{OrderID (NDCX- stripped), OwnerCode (the airline), OrderItem[]/OrderItemID}
        │
        ▼
AMA_TravelOrderViewRS   (ticketed: TicketDocInfos/TicketDocInfo[], Order/PaymentInfo = the
        │                 USED FOP with PaymentStatusCode, PaxSegment/SecureFlightInd)
        │
        │  mapNdcxOrderViewReply  ->  DossierCreate        (unchanged, ADR-16)
        │            │
        │            ├─ toUpdateIssuanceJson(value) ──┐    (ADR-17)
        │            └────────────── value ───────────┤
        │                                             ▼
        │                    updateIssuance(json, body, token, jwt, value)   [ADR-19]
        │                      -> pnr.status = 2, ticket_aerial rows, segments status 2
        └── returned to the front as `value`
```

**The two keys that identify the order** stay `Order/OrderID` + `Order/OwnerCode`
(`Order4.d.ts`). We rename the second (ADR-8), so the airline is recovered from
`pnr.pnrList` via `resolveNdcxAirlineOwnerCode` (`order.utils.js:320`) exactly as
`orderRetrieveRQ` already does (`order.controller.js:131-137`), and `OrderID` is stripped
of its `NDCX-` prefix by `stripNdcxOrderIdPrefix` (`order.utils.js:306`).

---

## 4. Request mapping table — metis → `Travel_OrderPay` RQ

Target paths are relative to `AMA_TravelOrderPayRQ`, confirmed against
`definitions/{AmaTravelOrderPayRq,Request4,PaymentInfo4,PaymentMethod4,PaymentCard6,
ContactInfo6,Individual6,PostalAddress6,Cash6,Voucher6,OtherPaymentMethod4,Order4,
OrderItem2}.d.ts`.

### 4.1 Envelope

| Target | Source | Note |
|---|---|---|
| `Party.Sender.TravelAgency` | `{ AgencyID: "unused", PseudoCityID: "unused" }` | Unused but mandatory on every `Travel_*` request — same literal as `order.utils.js:45,293`. |
| `Request.Order.OrderID` | `stripNdcxOrderIdPrefix(body.OrderID)` | ADR-9. Strip once, right before the wire call. |
| `Request.Order.OwnerCode` | `body.OwnerCode` ?? `resolveNdcxAirlineOwnerCode(pnr.pnrList)` | The **airline**, never `"AMADEUS_NDCX"` (ADR-8). Same resolution the retrieve handler already does. |
| `Request.Order.OrderItem[].OrderItemID` | `body.OfferIdList[]` | The `OrderItemID`s from the held OrderView, **not** the pricing `OfferItemID`s. `buildIssuancePayload:786-793` already collects them (from `service_aerial[].itemId`); `AirFranceAdapter.issueOrder:785-787` collects them from `retrieveResponse.Order.OrderItems[].OrderItemID` instead — prefer the latter for NDC[X], since NDC[X] has no `service_aerial` rows yet. |
| `Request.Order.OrderItem[].OwnerCode` | the airline | `OrderItem2.d.ts`. |
| `Request.BookingRef[]` | — | Omit in v1. Optional on `Request4`; no metis consumer, and we already identify the order by the two keys. |
| `Request.DataLists` | — | `DataLists5.d.ts` is an **empty interface**. Omit. |
| `Request.Parameters.Invoice` | — | Out of scope (§1). |

### 4.2 `Request.PaymentInfo[]` — one entry (ADR-18)

| Target | Source | Note |
|---|---|---|
| `PaymentInfoID` | `"PAY1"` (minted) | No host catalogue exists to select from (ADR-18). |
| `Amount` | `pnr.totalPrice` | ⚠️ **Units are the single highest-risk unknown in this step** — see §9. `xs:decimal` on the WSDL, but every amount on this interface is integer minor units *on the reply* (ADR-10). Send minor units, and assert the echoed `Order/PaymentInfo/Amount` against `pnr.totalPrice` on the first live call. |
| `TypeCode` | `pnr.paymentTypeCode` (`"CC"` / `"CA"` / …) | `PaymentMethodCodeType`. `buildIssuancePayload:855-859` already forces `"CC"` for `PaymentCard`/`Easy pay`. |
| `PayerContactInfo.Individual.{GivenName, Surname}` | `pnr.CardHolderName`, split | ⚠️ **`PaymentCard6` has no `CardHolderName` field** — checked; its only holder-ish field is `CardholderContactInfo`, which is a `PostalAddress6` (address only, no name). The name has to travel here. |
| `PayerContactInfo.PostalAddress[0].{StreetText, CityName, CountryCode}` | `body.paymentInfo.contactInfo.{street, city, countryCode}` | `buildIssuancePayload:804-808` already sends the hardcoded agency address; reuse it. |
| `PaymentMethod.PaymentCard.CardNumber` | `decryptData(pnr.EncCardNumber)` | Raw PAN — see ADR-18's security note. |
| `PaymentMethod.PaymentCard.SeriesCode` | `decryptData(pnr.EncCvv)` | CVV. Absent for UA/UATP by construction (`dossier.utils.js:1129-1137`). |
| `PaymentMethod.PaymentCard.ExpirationDate` | `pnr.ExpirationDate` | `PayCardDateSimpleType` — ⚠️ exact format unverified (§9). metis stores it via `extractYearAndMonth` (`dossier.utils.js:337`). |
| `PaymentMethod.PaymentCard.CreditCardVendorCode` | `pnr.CardBrandCode` | `CreditCardVendorCodeType`, pattern-constrained. |
| `PaymentMethod.PaymentCard.CardholderContactInfo` | same address as `PayerContactInfo` | `PostalAddress6`. Send only if the host rejects the `PayerContactInfo`-only form. |
| `PaymentMethod.Cash.CashInd = true` | `pnr.paymentMethod === "Cash"` | `Cash6.d.ts` — one boolean. |
| `PaymentMethod.Voucher.VoucherID` | `JSON.parse(pnr.voucherPayment).voucherCode` | `Voucher6.d.ts`. `buildIssuancePayload:873-898` already parses the stored blob. Only if a pilot carrier supports it; otherwise reject client-side. |
| `PaymentMethod.OtherPaymentMethod.Remark[]` | — | Last resort for a FOP with no typed slot. Avoid. |
| `SecurePaymentVersion1` / `SecurePaymentVersion2` / `SecurePaymentAuthenticationVersion[]` | — | 3DS, not populated in v1 (§9). |
| `OfferAssociation[]` | — | `{OfferRefID, OwnerCode, ResponseRefID, OfferItemRefID[]}` — used when paying against an *offer* rather than an order (e.g. an ancillary add). Not this step. |

**Reject before spending a host call** (mirroring `createNdcxOrderCreatePayload`'s
validate-then-build structure, `order.utils.js:22-41`): missing `OrderID`; missing
`OwnerCode` after resolution; empty `OfferIdList`; `paymentTypeCode === "NAV"` or
`paymentMethod === "Cash"` when the dossier was never given a real FOP (the ADR-18
default, which means the front skipped the payment step); a `PaymentCard` FOP with no
decryptable `EncCardNumber`.

---

## 5. Reply → persistence table, and the one big unknown

`mapNdcxOrderViewReply` is reused verbatim (ADR-16); what follows is what each branch
must feed.

| OrderView (post-pay) | mapper output | `updateIssuance` read | Status |
|---|---|---|---|
| `Order/PaymentInfo[]` (the **used** FOP, with `PaymentStatusCode`) | `value.PaymentInfo[]`, hoisted + wrapped (mapper `:72`) | `json.PaymentInfo` → `hasUnsuccessfulPaymentInfo` (`:8747`, impl `:866-887`): any entry whose `PaymentStatusCode` is not `SUCCESSFUL`/`ACCEPTED` throws `"erreur: unsuccesful payement"`. `PaymentInfo2.d.ts` confirms `PaymentStatusCode` exists on the OrderView. | ✅ mapper already emits it |
| `Order/StatusCode` | `value.Order.StatusCode._text` (mapper `:125`) | `:8752` — `"SB"` routes to the *disrupted* path: `pnr.status = -5`, a "PNR corrompu" email, and a notification row. | ⚠️ NDC[X] vocabulary seen so far is `OPENED` (order) and `HK` / **`NOT ENTITLED`** (order item), across all 5 successful own-office create captures. **No `SB` observed.** Confirm the post-pay value before trusting the branch. |
| `TicketDocInfos/TicketDocInfo[]` | `value.TicketDocInfo[]` (mapper `:74`, builder `:256-273`) | `json.ticketDocInfo[]` — **plain**, via the ADR-17 bridge. `:8826-8880` writes one `ticket_aerial` row per entry. | 🔴 **see the warning below** |
| `Order/BookingRef` | `value.Order.BookingRef` | `json.newPNR` (`:8801`) — only when the recloc changes at pay. | Leave `null` unless a capture shows otherwise. |
| — | `value.Order.isTicketed = true` (mapper `:69,124`) | not read here; `updateIssuance:8800` sets `pnr.status = 2` itself | ✅ |
| `PaxSegment/SecureFlightInd` | `value.DataLists.PaxSegmentList` (mapper `:58-65`) | read by `saveAfterRetreive`, not `updateIssuance` | ✅ (retrieve's concern) |

### 🔴 `TicketDocInfo` is the step's biggest unknown — and it is unverifiable from the schema

Two independent facts:

1. **The vendored WSDL types are empty here.** `definitions/TicketDocInfo1.d.ts` — the
   type `Response2.TicketDocInfos.TicketDocInfo[]` actually points at — is
   `export interface TicketDocInfo1 {}`. **No fields at all.** (Contrast
   `definitions/TicketDocInfo.d.ts`, the *OrderCancelRS* one, which is fully typed with
   `TicketDocument`, `FareInfo`, `PricingInfo`, `Payments`, `OriginalIssueInfo`, …) So the
   leaf names in `NDCX-ORDERCREATE-PLAN.md` §4.2's table — `TicketDocNbr`, `Type`,
   `ReportingType`, `NumberofBooklets`, `DateOfIssue`, `CouponInfo/Status`,
   `PassengerReference` — are **not schema-backed**; they were carried over from SABRE's
   `formatNDCResponse` output shape.
2. **No capture exercises them.** Create never produces `TicketDocInfos` (ADR-12), and
   there is no `Travel_OrderPay` or ticketed `Travel_OrderRetrieve` capture in
   `use cases/NDCX/`. `orderViewReply.mapper.js:249-254` says so in its own header comment.

Consequence: a wrong leaf name produces a `ticket_aerial` row of nulls — no ticket number
for the agent, no EMD amount, no coupon statuses — and **`updateIssuance` will not fail**;
it writes the row regardless (`:8826-8880`, guarded only by a duplicate check). Silent.

The bridge also needs fields the current `buildTicketDocInfo` does **not** emit:

| `updateIssuance` reads | current mapper | action |
|---|---|---|
| `ticket.BookingRef.BookingID` (`:8827`) | ✗ | add |
| `ticket.BookingRef.BookingEntity.Carrier.AirlineDesigCode` (`:8828-8830`) | ✗ | add |
| `ticket.PaymentInfoRefID` (`:8836`) | ✗ | add — links the ticket to `PaymentInfo/PaymentInfoID` |
| `ticket.RefdOrder.{OrderRefID, OrderItem, OwnerCode}` (`:8837-8839`) | ✗ | add — `orderItem` is the dedupe key (`:8856-8874`) |
| `ticket.Ticket.RemarkText` (`:8842,8851`) | ✗ | add |
| `ticket.Ticket.Coupon[].{CouponNumber, CouponStatusCode}` | partial (`CouponStatusCode` only, `:258-260`) | extend |
| `ticket.FareDetail.FarePriceType.Price.{BaseAmount,TaxSummary.Tax,TotalAmount}.Amount` (`:8847-8850`) | ✗ | add — also the Level-3 gap `NDCX-ORDERCREATE-PLAN.md` §5.4 left open |
| `ticket.BookletQty`, `ticket.OriginalIssueInfo.{IssueDate, IssuingAirlineDesigCode}`, `ticket.PaxRefID`, `ticket.Ticket.{TicketNumber, TicketDocTypeCode, ReportingTypeCode}` | ✓ (except `IssuingAirlineDesigCode`) | verify + add the one |

**Therefore: do not ship the bridge from guesswork.** Build the request side, get one
real `Travel_OrderPay` RS from our office (§8), then write `buildTicketDocInfo`'s
extension and the bridge against it. The request builder and the routing work are
independent of this and can land first.

---

## 6. `api-aerial` implementation checklist

### 6.1 `src/controllers/AMADEUS_NDCX/order.controller.js` (refactor, then extend — ADR-15)

Commit 1 — **refactor, zero behaviour change**:

- [ ] Replace the body-sniffing discriminator (`processRequest:58-61`,
      `validateControllerInput:26-44`) with explicit per-operation entry points.
      Simplest shape that keeps `AmadeusControllerFactory`'s credential validation
      (`amadeusControllerFactory.js:49-88`, which is what populates `req.salesPoint`):
      set `req._ndcxOp = "create" | "retrieve" | "pay"` in each route's thin wrapper and
      branch on it, instead of on `req.body.OrderID`.
- [ ] Replace `module.exports.setupRoute` (`:163,170`) with an explicit multi-route
      registration — `BaseControllerFactory.setupRoute` registers exactly one endpoint
      (`controller.utils.js:166-169`):
      ```js
      setupRoute: (app) => {
        app.post("/orderCreateRQ",   (req, res, next) => orderController.handleRequest(req, res, next));
        app.post("/orderRetrieveRQ", (req, res, next) => orderController.handleRequest(req, res, next));
        app.post("/orderPayRQ",      (req, res, next) => orderController.handleRequest(req, res, next));
        return app;
      }
      ```
- [ ] Verify the generic dispatcher still reaches create/retrieve unchanged
      (`global.controller.js:705,719`) and that `getControllerFiles`'s `"AMADEUS_NDCX"`
      branch (`:181-183`) still merges the module.
- [ ] Verify `app.js:231-232` mounts the new routes at `/AMADEUS_NDCX/order/*`
      (folder scan, `:202-240`) — a `curl` against the dev server is enough.

Commit 2 — **pay**:

- [ ] `handleOrderPay(req, res, ndcxService)`:
      `createNdcxOrderPayPayload(body)` → `ndcxService.travelOrderPay(payload)`
      (`ndcx.service.js:181`) → `mapNdcxOrderViewReply(reply, req.body)` →
      guard on `value.Errors?.length || !hasOrderData(value)` (reuse `:101-104`) →
      `updateIssuance(toUpdateIssuanceJson(value), req.body, req.decodedToken, req.jwtToken, value)`
      → `sendResponse(res, { value, dossierId })`.
- [ ] **Never** call `dossierCreate` or `saveAfterRetreive` here (ADR-19, ADR-12).
- [ ] `updateIssuance` **throws** on an unsuccessful payment (`:8749`) and on a missing
      dossier (`:8748`) — catch and surface as a 400 with the airline's own message, the
      way AFKL does (`AFKL/order.controller.js:528-533`), not as a 500.
- [ ] `NdcxError` → 502, everything else → 500 (existing pattern, `:63`).
- [ ] Export `OrderController.orderPayRQ` too, so a future generic route is a one-liner.

### 6.2 `src/utils/AMADEUS_NDCX/orderPay.utils.js` (new)

- [ ] `createNdcxOrderPayPayload(body)` — implement §4 in full, validate-then-build.
- [ ] `toUpdateIssuanceJson(value)` — §5's bridge. Import-light (no Pinia-equivalent, no
      DB, no `$fetch`) so it is testable with plain `node --test`, like the other three
      NDC[X] mappers.
- [ ] Reuse `stripNdcxOrderIdPrefix` / `resolveNdcxAirlineOwnerCode` from `order.utils.js`
      (`:306,320`) — do not re-implement.
- [ ] Card decryption (`decryptData`) lives here, not in the controller, and the plaintext
      PAN never enters a log line (`ndcxLogger.js` writes the full XML — §9).

### 6.3 `src/utils/AMADEUS_NDCX/orderViewReply.mapper.js` (extend — §5)

- [ ] Extend `buildTicketDocInfo` (`:256-273`) with the eight missing fields in §5's second
      table. **Gated on a live capture** — do not guess leaf names.
- [ ] Keep it presence-driven (ADR-6): no `mode` parameter, no operation branch.

### 6.4 `src/utils/dossier.utils.js`

- [ ] **No changes expected.** The two additive lines ADR-9 / ADR-8 took are already in.
      If a change turns out to be needed, it goes in the PR description explicitly —
      `NDCX-INTEGRATION.md`'s standing constraint (prefer NDC[X] call sites over shared
      function bodies) still applies.

### 6.5 Tests

- [ ] `src/utils/__tests__/ndcx-order-pay.utils.test.js` — request builder, fixture-based,
      mirroring `ndcx-order-create.utils.test.js`. Asserts: `NDCX-` stripped exactly once;
      airline `OwnerCode` (not `"AMADEUS_NDCX"`); one `PaymentInfo` with `PaymentInfoID
      "PAY1"`; card branch vs cash branch; every guard in §4 rejects before building.
- [ ] `src/utils/__tests__/ndcx-orderview-reply.mapper.test.js` — add a **ticketed** fixture
      (§8) and assert `Order.isTicketed === true`, `TicketDocInfo[]` populated, and that
      **the same function** maps the held and ticketed fixtures (the ADR-6 assertion the
      create step already makes for create-vs-retrieve).
- [ ] Bridge test: `toUpdateIssuanceJson(mapNdcxOrderViewReply(ticketedFixture))` produces
      exactly the fields `updateIssuance:8826-8854` reads, each non-null.

---

## 7. `front-reservation` implementation checklist

- [ ] `AmadeusNdcxAdapter.bookFlight()` (`:186-232`) sends `payment` (ADR-18):
      ```
      payment <- { paymentMethod, paymentInfoId, paymentTypeCode, CardHolderName,
                   CardBrandCode, CardNumber, CardCvv, ExpirationDate, state: "create", ... }
      ```
      sourced from `useBookingFlowStore().payment` — `SabreAdapter.ts:878,923-928` is the
      reference. Without it every NDC[X] dossier lands on `Cash`/`NAV` (ADR-18).
- [ ] `AmadeusNdcxAdapter.issueOrder()` override (ADR-20) — start from
      `this.buildIssuancePayload(false)` (`BaseAdapter:779`), swap `OfferIdList` for the
      retrieve response's `Order.OrderItem[].OrderItemID` (§4.1), add
      `oras: ["AMADEUS_NDCX"]` and `OwnerCode` (best-effort from
      `folder.pnr.pnrList`, resolved server-side either way), and POST to
      `/aerial/AMADEUS_NDCX/order/orderPayRQ`.
- [ ] Error normalisation stays simple (`responseValue?.Errors`), consistent with
      `bookFlight`'s existing handling (`:212-231`) — the NDC[X] controller only ever
      returns `{ Errors }` via `BaseControllerFactory.sendError`/`sendResponse`.
- [ ] **Do not** call `validateIssuancePrice()` on an NDC[X] folder — unimplemented, and
      the base implementation mis-routes to AFKL (ADR-20 consequences).
- [ ] Consider adding `{ name: "AMADEUS_NDCX", oras: ["AMADEUS_NDCX"] }` to `CONTROLLERS`
      (`BaseAdapter.ts:30-78`) so every *other* `getControllerByOra` consumer stops
      resolving to AFKL. Small, and it converts a class of silent mis-routes into 404s.
      Flag in the PR — it changes URL resolution for NDC[X] across ~8 call sites.

> **Sequencing.** ADR-18's `bookFlight()` change is a **prerequisite** of the pay step,
> not part of it: a dossier created before that change ships has `paymentMethod: "Cash"`,
> `paymentTypeCode: "NAV"` and no card, and can never be paid. Any NDC[X] dossier already
> held in a test office will need re-booking, or a manual `pnr` patch, after this lands.

---

## 8. Capture-then-test procedure

Same shape and reason as `NDCX-ORDERCREATE-PLAN.md` §7 — the AF vendored examples are from
another office with repeating elements trimmed to 3; never commit one as a fixture.

1. Ship §7's `bookFlight()` payment change and §6.1/§6.2's request side far enough that
   the call round-trips. A throwing bridge is fine at this stage — `ndcxLogger` writes the
   XML either way (`ndcxLogger.js:56-59`).
2. Run with `NODE_ENV=development`, drive shopping → offerPrice → orderCreate → **orderPay**
   from the front, on one of the routes our existing captures use (AC or LO).
3. Keep both `…-Travel_OrderPayAsync-RQ.xml` and `-RS.xml` into `use cases/NDCX/`.
   The RQ proves the builder (element order — Trap 3 — plus the `PaymentInfo` units
   question, §9); the RS is the **only** way to settle §5's `TicketDocInfo` shape.
   ⚠️ **Redact the PAN and CVV before committing the RQ.**
4. [ ] Extend `fixtures/generate-ndcx-orderview-fixture.js` (or clone it) for the pay RS —
   unwrap `parsed?.Body?.AMA_TravelOrderViewRS` and **reuse `CLIENT_OPTIONS` verbatim**
   (`forceItemsEnumerable`, `attributesKey: "$attributes"`, `ignoredNamespaces`): they
   change which nodes come back as arrays, so the fixture is only faithful if they match
   `NdcxClient.create`.
5. [ ] Write §6.5's three test groups against it.
6. [ ] While you have the session: capture a ticketed `Travel_OrderRetrieve` RS too. It
   discharges `NDCX-ORDERCREATE-PLAN.md` §5.4's "`TicketDocInfo` mapping is
   lower-confidence" caveat in the same pass, and `NDCX-ORDERCANCEL-PLAN.md` needs it for
   its VOID/REFUND branch.

---

## 9. Open questions — resolve while building, don't assume

- 🔴 **Is `Request/PaymentInfo/Amount` minor units or major units?** The reply side is
  integer minor units with a `Decimals` metadata block (ADR-10); the request side has no
  such metadata and no capture. `PaymentInfo4.Amount` is `xs:decimal`. Getting this wrong
  is a **100× payment error** — the same class of defect ADR-10 called "the single
  highest-risk defect" in the create step. Send minor units, and make the first live call
  a low-value one.
- 🔴 **`TicketDocInfo` leaf names** (§5). Unverifiable from the WSDL (`TicketDocInfo1` is
  an empty interface), unexercised by any capture. Blocks the bridge.
- **`PayCardDateSimpleType` format** for `ExpirationDate` — `MMYY`, `YYMM` or `YYYY-MM`?
  The WSDL names the simple type but the generated `.d.ts` flattens it to `string`.
  Check the XSD (`src/types/NDCX/wsdl/`) before the first call; a rejected card reads as
  a generic host error.
- **Does the pilot carrier require 3DS?** `PaymentInfo4` carries the full
  `SecurePaymentVersion1/2` + `SecurePaymentAuthenticationInstructions*` family. metis
  stores `EnrollmentStatusText` only for AF/KL/LCC/IB (`dossier.utils.js:1061`), and
  ADR-8 bypasses the AF/KL encryption path entirely — so NDC[X] has no 3DS data to send.
  If a carrier mandates it, this becomes its own step.
- **`Order/StatusCode` post-pay.** Only `OPENED` observed. `updateIssuance:8752` treats
  `"SB"` as *disrupted* (status -5 + operator email). Confirm the NDC[X] vocabulary before
  the branch fires on a healthy order — and note the same question blocks
  `NDCX-ORDERCANCEL-PLAN.md`'s state branching.
- **`ndcxLogger` and card data.** The logger writes the full request XML
  (`ndcxLogger.js:56-59`), which for `Travel_OrderPay` includes the PAN and CVV. Decide
  whether to redact at the logger or to suppress request logging for this one operation,
  **before** the first live call — not after.
- **Duplicate-pay guard.** `NDCX-ORDERCREATE-PLAN.md` §8's duplicate-booking guard (rule
  ERR-04) applies doubly here: a double-submitted issuance is a double charge. Decide
  whether the MET2-2345 anti-race token pattern (`bookingFlowStore.nextPricingRequest`,
  used in `getOffer`) is enough or whether this needs a server-side idempotency check on
  `pnr.status === 2`.
- **`validateIssuancePrice` / reprice-before-issue.** Every other provider re-prices
  through `orderChangeRQ` before issuing. NDC[X] has `Travel_OrderReshop`'s
  `UpdateOrder.RepriceOrder` for exactly this — but that is integration §6 scope. Decide
  whether pay ships without a reprice check, and what happens when the fare moved between
  hold and pay.

---

## 10. Definition of done

- [ ] `POST /aerial/AMADEUS_NDCX/order/orderPayRQ` on a held NDC[X] dossier returns a
      ticketed `DossierCreate` payload with a non-empty `TicketDocInfo[]`.
- [ ] `pnr.status` goes `1 → 2`; segments go to status 2
      (`updateIssuance:8800-8809`).
- [ ] One `ticket_aerial` row per passenger, with a **non-null `ticketNumber`** — the
      single field that proves §5's `TicketDocInfo` mapping is right.
- [ ] `pnr.totalPrice` is unchanged by the pay step, and the amount charged matches it
      to the cent (§9's units question).
- [ ] An unsuccessful payment surfaces as a 400 with the airline's message, not a 500,
      and leaves `pnr.status` at 1.
- [ ] Create and retrieve still work through both the generic dispatcher and the new
      provider-local routes (ADR-15's refactor is behaviour-neutral).
- [ ] `issueOrder()` on an NDC[X] folder no longer reaches `/aerial/AFKL/...` (ADR-20) —
      verified in the network tab, not just by reading the code.
- [ ] Own-office `Travel_OrderPay` RQ/RS captured in `use cases/NDCX/` (PAN/CVV redacted)
      and committed as fixtures.
- [ ] `ndcx-order-pay.utils.test.js` green; the OrderView mapper test asserts
      same-function-both-fixtures across held and ticketed.
- [ ] `NDCX-INTEGRATION.md` §3 "Pay" items ticked, its `/orderPayRQ` open question struck
      (ADR-15), and ADR-12 / the locked "saveAfterRetreive at pay" line amended per ADR-19.
- [ ] PR description names: the raw-PAN consequence of ADR-8, the
      `getControllerByOra`-fallback fix if taken, and the `order.controller.js` refactor.

---

## 11. Glossary additions

Extends `NDCX-ORDERCREATE-PLAN.md` §10.

| Term | Meaning here |
|---|---|
| **The bridge** | `toUpdateIssuanceJson(value)` — unwraps the `_text`-wrapped `DossierCreate` into the flat shape `updateIssuance`'s first argument needs (ADR-17). The same reply object reaches `updateIssuance` twice, once each way. |
| **`updateIssuance`** | `dossier.utils.js:8741`. The shared post-ticketing writer: `pnr.status = 2`, segments to 2, one `ticket_aerial` row per `json.ticketDocInfo` entry. Throws on an unsuccessful `PaymentInfo` or a missing dossier. |
| **FOP catalogue** | `Order/PaymentInfo[]` at create — the forms of payment the carrier *accepts*. **Absent for our pilot carriers** (ADR-18): zero occurrences across ten own-office create captures, and no `Payments` block at OfferPrice either. Distinct from the single **used** FOP that appears in the same element after pay. |
| **`PAY1`** | Our minted `PaymentInfoID`. There is no catalogue to select one from, so we choose it (ADR-18), matching the `PAX{n}` / `SEG{n}` conventions. |
| **Silent AFKL fallback** | `getControllerByOra` (`BaseAdapter.ts:114-116`) returns `"AFKL"` for any ora not in `CONTROLLERS`. Because `issueOrder` is concrete rather than throwing, an NDC[X] issuance currently POSTs into AFKL's controller (ADR-20). |
| **`NOT ENTITLED`** | An `OrderItem/StatusCode` value present in every successful own-office create capture, alongside `HK`. Not in `dossier.utils.js:3756`'s cancelled set — noted because `NDCX-ORDERCREATE-PLAN.md` §8 asked for the vocabulary beyond `HK`. |
