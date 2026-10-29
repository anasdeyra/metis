# NDC[X] — Upsell at pricing (`Travel_OfferPrice` + `OtherOffers`)

Ticket MET2-2422, branch `deyra-met2-2422`. Companion to
[`NDCX-INTEGRATION.md`](./NDCX-INTEGRATION.md) (source of truth),
[`NDCX-CONTEXT.md`](./NDCX-CONTEXT.md) (the two-minute guardrail read) and
[`NDCX-CHECKLIST-AMADEUS.md`](./NDCX-CHECKLIST-AMADEUS.md) §"Deux points bloquants" point 2,
which is why this exists at all.

Scope: the agent is on the checkout page with a priced NDC[X] offer, presses a button, sees
the alternative (richer) fare families the airline will sell for the same itinerary, picks
one, and books it. This is the `/booking/flight/order` → *"Afficher les Bundles"* flow that
AF/KL, U2, IB and W6 already run, which `AmadeusNdcxAdapter` does not implement at all.

**Deadline-driven.** The Amadeus NDC[X] Prime certification checklist is due **2026-11-08**.
Test case 2 (*2 ADT + 1 CHD + 1 INF / international / round trip / direct / **upsell at
pricing** / CB / booking and ticketing*) cannot be ticked today, and two **Mandatory**
criteria — **Offer_06** and **Create_05** — depend on it
(`references/10-certification-and-testing.md:154,169`).

**ADR numbering.** The highest ADR currently allocated across the `NDCX-*-PLAN.md` family is
**ADR-59** (`NDCX-FLIGHTCHANGE-PLAN.md`, verified by a grep over all plan docs). This file is
allocated **ADR-60…67**. Do not renumber.

---

## 1. Scope

**In scope**

- `ShoppingCriteria/FarePreferences@PreferencesContext="Upsell"` on `Travel_OfferPrice`
  (ADR-60) — the thing Offer_06 asks to see on the wire.
- Reading `Response/OtherOffers/Offer[]` and turning it into the **bundle card** contract the
  checkout modal already consumes (ADR-62, ADR-63).
- Carrying the selected upsell's `OfferID` / `OfferItemID`s / updated `ShoppingResponseID`
  into `Travel_OrderCreate` (ADR-61) — Create_05.
- A per-carrier gate (ADR-64) and the Offer-Time-Limit behaviour (ADR-66).
- `front-reservation`: `AmadeusNdcxAdapter.getBundles()` + the two `order.vue` edits (ADR-65).
- One fixture-based mapper test per the house convention, backed by a real capture.

**Explicitly not in scope** (named so nobody assumes otherwise)

- **Upsell at shopping.** `AMADEUS_NDCX/shopping.utils.js:111` already requests fare-family
  info (`feeIdDescription.feeId[{ feeType: "FFI", feeIdNumber: "3" }]`), and
  `shoppingReply.mapper.js:299-312` already indexes `DataLists.fareFamily` /
  `isFareFamily` / `fareFamilyRef` per offer. That is a *different* feature, it already
  works, and Amadeus does not call it "upsell at pricing". Nothing here touches it. Adding
  the `UPH` feeId / SAF-bundle path (`references/05-shopping-options-and-fares.md:24,622`)
  is AF/KL-only and therefore out of NDC[X] scope entirely.
- **SAF bundles.** `ancillaryOffer.utils.js:13` already scopes them out; AF/KL are
  directly integrated (`carrierCapabilities.js:22-28` `DIRECTLY_INTEGRATED`).
- **Upsell on reshop/exchange.** `Reshop Output: Upsell proposals` is **0 for all 26
  carriers on both channels** (`references/airline-matrix.csv:9560-9613`). There is nothing
  to build.
- **The `XND` priceType fix** in classic `AMADEUS/shopping.utils.js:501` — the other
  blocking point of the checklist. Separate, one-line, different ticket.

---

## 2. Decisions taken this session (ADRs)

### ADR-60 — The upsell flag goes on a **second, dedicated** `Travel_OfferPrice`, fired by the button — not on the primary pricing call

**Context.** Two shapes were considered.

| Option | Verdict |
|---|---|
| Always send `ShoppingCriteria/FarePreferences@PreferencesContext="Upsell"` on the primary `Travel_OfferPrice` (`offer.utils.js:42-49`), so `OtherOffers` rides along for free | **Rejected.** Zero extra host calls and it is tempting — two vendored captures (`examples/prime-booking/BA-Redress-Passport-CC-Pymt/2-Reply-Travel-OfferPrice.xml:305` and `examples/prime-booking/Contact-Refused-for-Multiple-Pax/11-Reply-Travel-OfferPrice.xml:368`) return `OtherOffers` **with no `ShoppingCriteria` in the request at all**, so some carriers volunteer it. But it puts a new, carrier-dependent element on the single most load-bearing host call in the whole flow. `Upsells (Pricing)` is `0` for EK, QF, 6E and VY (`references/airline-matrix.csv:3730,3734,3778,3780`); if one of them rejects the element, **pricing breaks for every booking on that carrier**, not just upsell. |
| A second, flagged `Travel_OfferPrice`, triggered only when the agent presses the button | **Chosen.** Blast radius is exactly the new feature. It is also an exact mirror of AFKL: `AirFranceAdapter.getBundles()` (`front-reservation/app/utils/adapters/AirFranceAdapter.ts:1570-1622`) POSTs `{ upSell: true, … }` to the same `/aerial/global/offerPriceRQ` route the normal pricing uses, and `AFKL/offer.utils.js:162-168` turns that boolean into the AF-specific `ShoppingCriteria/PricingMethodCriteria/BestPricingOptionText = "C"`. Same route, same boolean, different element. And a dedicated message is far easier to capture as certification evidence for Offer_06. |

**Decision.** `AMADEUS_NDCX/offer.controller.js`'s existing `offerPriceRQ` handler branches on
`body.upSell === true`. No new route: `/aerial/global/offerPriceRQ` already dispatches to
`controllers["AMADEUS_NDCX"].OfferController.offerPriceRQ({ decodedToken, ...body })`
(`global.controller.js:673`, `Oras` ← `airline-constants.utils.js:91`
`"AMADEUS_NDCX": "AMADEUS_NDCX"`), and `AmadeusNdcxAdapter.getOffer()` already uses it
(`AmadeusNdcxAdapter.ts:108-115`).

**Consequences.**

- Cost: exactly one extra `Travel_OfferPrice` per upsell click, on a carrier the matrix says
  supports it. `Travel_OfferPrice` is a post-search call and is not counted in the 1000:1
  look-to-book ratio, which is a *search*:book ratio.
- Name the flag `body.upSell` (camel-cased exactly as AFKL spells it,
  `AFKL/offer.utils.js:162`), **not** `body.option.upSell`. The codebase has both: AFKL's
  shopping path (`AFKL/shopping.utils.js:739`), IBERIA (`IBERIA/offer.utils.js:47,78`) and TK
  read the nested one. Pick the one the checkout-page adapter method already sends, so the
  front code is a copy of `getBundles()`.

### ADR-61 — The selected upsell offer goes **straight to `Travel_OrderCreate`**; it is never re-priced

**Context.** This is the decision that most changes the amount of code, and the one where
AFKL and IBERIA — the two providers with a working checkout upsell — disagree.

- **AFKL re-prices.** `order.vue:1372` reads
  `if (!["AMADEUS", "IB"].includes(_ora?.ora)) await init();`, and `init()`
  (`order.vue:1300-1335`) re-runs `initOfferPrice()` → `AirFranceAdapter.getOffer()`, which
  sends `OfferID: bundle?.offerId ?? offer.OfferID` and
  `OfferIdList: bundle?.OfferIdList ?? offer.OfferIdList`
  (`AirFranceAdapter.ts:1832-1842`). Three host calls per upsell.
- **IBERIA does not.** It is excluded from that line and instead patches
  `item.offertList[0].TotalPrice.TotalAmount = bundle.price` in the front
  (`order.vue:1392-1398`). Two host calls, and a cart whose breakdown is stale.

For NDC[X] the deciding evidence is the only real wire trace of this exact flow,
`examples/servicing/Reuse-Credit---Zero-Balance-Due/`:

| File | What it shows |
|---|---|
| `2-OfferPrice-req.xml:38-40` | `<ShoppingCriteria><FarePreferences PreferencesContext="Upsell"/></ShoppingCriteria>` |
| `2-OfferPrice-res.xml:322-1295` | `OtherOffers` with **two** `Offer` entries (`…njs0yhot36rq-2`, `…a2hmvoveugj6p-3`) |
| `2-OfferPrice-res.xml:1296-1298` | `PricedOffer/Offer/OfferID` = `…gvqz7mjik14g9-1` |
| `2-OfferPrice-res.xml:1918-1920` | `ShoppingResponse/ShoppingResponseID` = `P81071294-AE91-4066-824B` (the request sent `X1805BED6-BA15-4F5F-9D69` — it **changed**) |
| `4-Travel-OrderCreate-req.xml:13-15` | `OfferID` = `…a2hmvoveugj6p-3` (**the second upsell offer**), `ShoppingResponseRefID` = `P81071294-AE91-4066-824B` |

There is **no third `Travel_OfferPrice`** in that capture. The agent picked an upsell and
went straight to create — which is exactly what the guide says:
*"One of the offers returned under `OtherOffers` can be selected and used to create the order
the same way as if it was the priced offer"* (`references/06-payment-and-features.md:30`).

The counter-argument — "metis already chains OfferPrice→OfferPrice for ancillaries, so
re-pricing an upsell OfferID is proven" — **is false, and was checked.** Across our own
office's captures, every `Travel_OfferPrice` request (including the second, ancillary one)
re-sends the **shopping** `ShoppingResponseRefID`, never a previous OfferPrice reply's:

```
8209925207861-…-OfferPriceAsync-RQ  ShoppingResponseRefID = X3BF4509-1E1E-4EDB-957E  → RS gives P676E9DA-D1DA-4F82-8F7
8209925388421-…-OfferPriceAsync-RQ  ShoppingResponseRefID = X3BF4509-1E1E-4EDB-957E  → RS gives P80DD32E5-4AF-41B4-AB38
8209925396538-…-OfferPriceAsync-RQ  ShoppingResponseRefID = X3BF4509-1E1E-4EDB-957E  → RS gives PAE672F96-C588-477A-9194
```
(`api-aerial/use cases/NDCX/`). So pricing an OfferPrice-born `OfferID` would be a **first**
for metis, with no capture behind it. Going straight to create has one.

**Decision.** No re-price. The chosen `OtherOffers/Offer` is mapped locally (ADR-63) and its
ids are carried into `Travel_OrderCreate` as-is.

**Consequences.**

- **Create_05 falls out of already-shipped code.** `AmadeusNdcxAdapter.bookFlight()` already
  builds `OfferID` / `OfferIdList` / `ShoppingResponseId` from the stored `OfferPriceRs`
  (`AmadeusNdcxAdapter.ts:273-277`:
  `ShoppingResponseId: repriced?.ResponseID ?? selectedOffer.ResponseID`), and
  `order.utils.js:50-62` maps them onto
  `CreateOrder/SelectedOffer/{OfferID, OwnerCode, ShoppingResponseRefID, SelectedOfferItem[]}`.
  Swap `selectedOffer` for the upsell's `OfferPriceRs` (ADR-63) and **`bookFlight()` and
  `order.utils.js` need no change at all**.
- `order.vue:1372`'s exclusion list gains `"AMADEUS_NDCX"` (ADR-65).
- If the host ever refuses a create built on an `OtherOffers` offer, the fallback is the AFKL
  re-price path — but it is *also* unproven, so it would need its own capture first. Carried
  in §10.

### ADR-62 — Upsell offers ride **alongside** `OfferPriceRs`, as `bundles[]`; `Structure/OfferPriceRs.js` is **not** extended

**Context.** `src/utils/Structure/OfferPriceRs.js` (14 lines, read in full) is spread into
every NDC[X] offer-price response — including the error path
(`AMADEUS_NDCX/offer.controller.js:20-23`, `{ ...OfferPriceRs, Errors: [...] }`).

Three options:

| Option | Verdict |
|---|---|
| Append upsell offers to `OrderItems[]` | **Rejected.** `OrderItems` is "the items of *the* priced offer" and is summed as money by several consumers (`ndcxAncillarySubtotal`, `AmadeusNdcxAdapter.ts:260` `airOfferItemIds`, `orderChange.utils.js`'s amount guard). Folding alternative offers in double-counts the fare. |
| Add `bundles: []` to `Structure/OfferPriceRs.js` so every provider gets a safe default | **Rejected, and this one is a trap.** `[]` is **truthy**. AFKL's front guard is `if (!offerPriceResponse.bundles) throw new Error("Error bundles")` (`AirFranceAdapter.ts:1614-1620`); with a default `[]` present on the NDC[X] error shell, an airline error would sail through the guard and render an empty "Aucun pack disponible" modal instead of surfacing the message. (This is the mirror image of the MET2-2691 incident, where the *absence* of the key was the bug — see `api-aerial/src/tests/unit/afklBundleFareType.test.js:8-13`.) |
| Emit `bundles` only from the upsell branch of the mapper | **Chosen.** Present exactly when `upSell: true` was asked and the call succeeded; absent on the error path; `undefined` (not `[]`) when the carrier returned no `OtherOffers`, so the front's `!bundles` guard behaves. |

**Decision.** `mapNdcxOfferPriceUpsellReply(reply, body)` returns the normal `OfferPriceRs`
(unchanged, for the still-priced original offer) **plus**:

```
bundles: [ …bundle cards, see §5… ]        // only on the upsell branch
```

`Structure/OfferPriceRs.js` is untouched. This is the same "add an NDC[X]-specific call site
rather than widen a shared contract" rule `NDCX-CONTEXT.md` §3 states, and it also matches
what the mapper already does for `descriptions` (`offerPriceReply.mapper.js:56`) — a field
that is not in the Structure either.

**Consequence.** The NDC[X] `getBundles()` must check `Errors` explicitly rather than copying
AFKL's `!bundles` test verbatim. Named in §7.

### ADR-63 — Each bundle carries a nested, `DataLists`-free `offerPrice` — the checkout **swaps**, it does not patch

**Context.** ADR-61 means there is no second host reply to rebuild the cart from. The
checkout needs, for the chosen upsell: `OrderItems[].Price` (cart lines), `TotalPrice`,
`BaggageAllowance` + penalties (`OrderItems[].Fare[].FareRule.Penalty`), `descriptions`,
`OfferID`, `ResponseID`, `OfferExpirationDateTime`, `PaymentTimeLimitDateTime`, `OwnerCode` —
i.e. essentially a whole `OfferPriceRs`.

The good news is that `OtherOffers/Offer` is **schema-identical to `PricedOffer/Offer`**. The
AA capture's upsell offer carries `OfferID`, `OwnerCode`, `ValidatingCarrierCode`,
`OfferExpirationDateTime`, `PaymentTimeLimitDateTime`, `JourneyOverview/JourneyPriceClass[]`,
`PTC_OfferParameters[]`, `OfferItem[]/{OfferItemID, FareDetail/{PassengerRefs, Price,
FareComponent[]/{FareBasis, FareRules, PriceClassRef, SegmentRefs}}, Service[], Price}` and
`TotalPrice/TotalAmount` (`2-OfferPrice-res.xml:323-690`). `mapNdcxOfferPriceReply` already
reads every one of those paths off `PricedOffer/Offer`.

**Decision.** Refactor `offerPriceReply.mapper.js` so its offer-reading half takes the offer
node as a parameter, then call it once per `OtherOffers/Offer`. Each bundle gets:

```
bundle.offerPrice = <full OfferPriceRs for that offer, MINUS DataLists>
```

`DataLists` (`BaggageAllowanceList`, `PaxList`, `PaxSegmentList`) is identical for every offer
in one reply and is already at the top level — duplicating it per bundle would multiply the
payload by the offer count for nothing. The front merges the top-level `DataLists` on swap.

**Consequences.**

- On confirm the front calls `bookingFlow.setSelectedOffer({ ...bundle.offerPrice, DataLists })`
  and the rest of checkout — cart, conditions, `bookFlight()` — works unchanged.
- Payload size is bounded by the carrier's upsell count. AF/KL cap at **20**
  (`references/18-airline-capability-matrix.md:399`); the AA capture returns 2. Cap our own
  output at 20, sorted ascending by `TotalPrice` (IBERIA sorts the same way,
  `IBERIA/offer.utils.js:649-653`), and say so in the response.
- This is a **refactor of a shipped mapper**. It must be behaviour-neutral for the non-upsell
  path, and the existing `ndcx-offer-price-reply.mapper.test.js` must stay green untouched —
  that test is the regression gate for the refactor.

### ADR-64 — Gate on the capability matrix before spending a host call

A fourth table in `AMADEUS_NDCX/carrierCapabilities.js`, alongside `CAPABILITIES`,
`PAX_UPDATE` and `FLIGHT_CHANGE`, transcribed from `references/airline-matrix.csv`
**WBS rows only** (`3728-3781`), with `resolveNdcxUpsellSupport(ownerCode)`:

- `upsellAtPricing === 0` → refuse, named: **EK, QF, 6E, VY**.
- `note === "S14"` → supported **but with no baggage allowance on the upsell offers**
  (`references/18-airline-capability-matrix.md:1182`): **UA**.
- `"Same cabin only"` → **BA**; `"Max 20 upsell"` → **AF/KL** (both directly integrated,
  so informational only).
- Unknown carriers stay permissive-but-unverified, exactly as the three existing tables do
  (`carrierCapabilities.js:11-18` header) — "let the host decide" rather than a locked button.

Gating here saves the agent an opaque host rejection and saves a transaction. See §3 for the
full table and what it means for *our* carriers.

### ADR-65 — Reuse the AFKL front contract verbatim; replace `order.vue`'s hardcoded ora list with the capability flag that already exists

The checkout upsell UI is entirely provider-agnostic already:
`SelectBundle.vue` (the dialog) → `OfferCard.vue` (one card per bundle) →
`BundleDetails.vue` (the detail table with the *Valider* button). All three read a plain
`bundles[]` of cards. Four providers already feed it (AFKL, AMADEUS, GOKYTE, IBERIA) with
three slightly different object shapes. NDC[X] produces the **AFKL** shape (§5), because it
is the only one with per-bound detail and the only one whose `OfferIdList` entries carry
`PaxRefID` — which `order.utils.js:97-101` requires.

Two edits in `order.vue`, both small, both in a shared file (name them in the PR):

1. `order.vue:1511-1515` — the button's `v-if` hardcodes
   `['AF', 'KL', 'U2', 'AMADEUS', 'IB', 'W6'].includes(bookingFlow.ora)`. Note `'AMADEUS'` in
   that literal is **dead code**: `AmadeusAdapter.ts:44-45` sets both `capabilities.bundles`
   and `uiPrefrences.bundlesButton` to `false`. The dialog three lines below
   (`order.vue:1930-1934`) is already gated on `_ora?.capabilities?.bundles` alone.
   **Replace the literal with `_ora?.capabilities?.bundles`.** It is strictly equivalent for
   every provider today (each one in the list sets the flag true, and `AMADEUS` sets it
   false so it loses a button it never rendered), and it stops the next provider having to
   edit a page template.
2. `order.vue:1372` — add `"AMADEUS_NDCX"` to the no-re-price list (ADR-61), and add an
   `AMADEUS_NDCX` case to the `switch` at `order.vue:1376-1399` that performs ADR-63's swap
   and re-fetches ancillaries.

On the adapter: `AmadeusNdcxAdapter`'s constructor sets `this.capabilities.bundles` from the
front-side mirror of ADR-64's table, keyed on
`bookingFlow().getShoppingOffer()?.validatingCarrier`, defaulting to `true` for an unknown
carrier (same permissive default as the backend). The backend remains the authority.

### ADR-66 — The Offer Time Limit is per-offer, and an expired upsell is re-shopped, never retried

`OfferExpirationDateTime` sits on **each** offer, including each `OtherOffers/Offer`
(`2-OfferPrice-res.xml:327` and `:695` — both `2024-09-09T19:26:52Z` on that capture, i.e.
the upsells inherit the priced offer's clock, but do not assume that holds everywhere).

`offer.utils.js:52-64` (`assertOfferNotExpired`) + `OfferExpiredError` + the controller's
dedicated **409** (`offer.controller.js:59-61`) already implement NDC[X] rules 8 and 10 for
the pricing call. Extend, do not duplicate:

- The upsell request runs the same `assertOfferNotExpired(body)` on the *original* offer. No
  change.
- On confirm, the front checks `bundle.offerPrice.OfferExpirationDateTime` **before** calling
  `bookFlight()`. If it has passed, the agent is sent back to shopping — the offer cannot be
  repriced, only re-shopped (`NDCX-CONTEXT.md`, rule 8/10), and there is **no retry loop**.
- Practical window: offers expire in 15–30 minutes. The upsell modal adds a human decision
  in the middle of that window. Surface the remaining time in the modal header rather than
  letting the agent discover it at booking. This is a UI nicety, not a correctness
  requirement — cut it first if time is short (§9).

### ADR-67 — No name-based filtering of upsell offers

AFKL silently drops every bundle whose fare-family name does not contain `plus`, `saf` or
`extra` (`AFKL/offer.utils.js:6` `BUNDLE_KEYWORDS`, applied at `:253`, filtered at `:433`).
That is an AF/KL-specific product rule about *which* AF families are sellable as bundles.
It must **not** be copied: NDC[X] spans 18 carriers whose `PriceClass/Name` values are
airline free-text (`"Flagship Business"` on the AA capture,
`2-OfferPrice-res.xml:243`). Return every `OtherOffers/Offer` the host sends, capped at 20
and sorted ascending by `TotalPrice` (ADR-63).

---

## 3. Carrier support — read before building anything

`Upsells (Pricing)` output, **WBS channel**, for the 18 carriers in NDC[X] scope
(`carrierCapabilities.js:38-57`'s `CAPABILITIES` keys), from
`references/airline-matrix.csv:3728-3781`:

| AI | BR | CX | EY | KQ | LH | LO | MH | NP | QF | SK | SM | SQ | SV | TP | TU | UA | VY |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | **0** | 1 | 1 | 1 | 1 | 1 | 1 | **S14** | **0** |

Out-of-scope / directly-integrated carriers, for reference: AA `1`, EK `0`, 6E `0`, IB `1`,
BA `Same cabin only`, AF/KL `Max 20 upsell`, AC `1`.
S14 = *"Upsells are available but without displaying the baggage allowance (airline
limitation)"* (`references/18-airline-capability-matrix.md:1182`).

Four things fall out of this and shape the plan:

1. **16 of 18 in-scope carriers support it.** This is not a niche feature.
2. **QF and VY cannot upsell at pricing.** Hard refusal, named, in ADR-64's table.
3. **LO is the interesting one.** `Upsells (Shopping)` is **0** for LO
   (`airline-matrix.csv:1972`) but `Upsells (Pricing)` is **1**. For LO, upsell at pricing is
   the *only* way to surface a better fare family. Our existing shopping-time FFI path does
   nothing for it.
4. **Our pilot carriers are covered.** The own-office captures in `api-aerial/use cases/NDCX/`
   are SQ, AA, LO and AC — all `1`. (Note the inconsistency: AC and AA appear in
   `carrierCapabilities.js:22-28`'s `DIRECTLY_INTEGRATED` set and have no `CAPABILITIES`
   entry, yet our own NDC[X] office prices them. Flagged in §10, not fixed here.)

### 🔴 …but the carrier that can actually *prove* Create_05 is AA

`Travel_OfferPrice` replies carry an **updated** `ShoppingResponseID` that Create_05 wants
echoed into `Travel_OrderCreate`. Across all ~110 own-office `Travel_OfferPriceAsync-RS.xml`
files:

| Carrier | `Response/ShoppingResponse/ShoppingResponseID` |
|---|---|
| **AA** | a real, new id per call — `P676E9DA-D1DA-4F82-8F7`, `P80DD32E5-4AF-41B4-AB38`, … |
| **SQ**, **LO**, **AC** | the literal string **`NOT_USED`** (lower-cased `not_used` on five files) |

So on SQ/LO/AC there is no "updated shopping response" to include — the host declines to
mint one. `OfferPriceRs.ResponseID` is `"NOT_USED"` and
`AmadeusNdcxAdapter.ts:277` faithfully forwards it.

**Recommendation: run the certification test case on AA.** It is the only carrier where our
own office has demonstrated chained, real `ShoppingResponseID`s, it is `1` for
`Upsells (Pricing)`, and the one end-to-end upsell capture Amadeus ships
(`examples/servicing/Reuse-Credit---Zero-Balance-Due/`) is also AA. Booking the case on
SQ/LO/AC would leave Create_05 formally unprovable.

### 🔴 And: no own-office reply has **ever** contained `OtherOffers`

A scan of every `*Travel_OfferPriceAsync-RS.xml` in `api-aerial/use cases/NDCX/` finds zero
occurrences of `OtherOffers`. Every request we have sent omitted `ShoppingCriteria`
(zero occurrences there too). So this entire plan rests on three **vendored** captures
(AA, BA, UA) and no own-office evidence. §8's capture step is not optional.

---

## 4. Shape

```
agent is on /booking/flight/order with a priced NDC[X] offer
        │
        │  presses "Afficher les Bundles"   [order.vue:1510-1523]
        ▼
AmadeusNdcxAdapter.getBundles()                                      [new, ADR-65]
   POST /aerial/global/offerPriceRQ   { upSell: true, OfferID, OwnerCode,
                                        ShoppingResponseId, OfferIdList, paxs, … }
        │
        ▼
AMADEUS_NDCX/offer.controller.js  → branch on body.upSell             [ADR-60]
   createNdcxOfferPricePayload(body, salesPoint, { upsell: true })
        │
        ▼
Travel_OfferPrice_1.3   (stateless)
  Request/DataLists/PaxList/Pax[]          ← unchanged
  Request/PricedOffer/SelectedOffer        ← unchanged
  Request/ShoppingCriteria/FarePreferences @PreferencesContext="Upsell"   ← NEW, LAST
        │
        ▼
AMA_TravelOfferPriceRS
  Response/DataLists           (PriceClassList, BaggageAllowanceList, PaxSegmentList, …)
  Response/Metadata/Other/OtherMetadata[]   (CurrencyMetadatas ⇒ Decimals)
  Response/OtherOffers/Offer[]              ← the upsells                [ADR-62]
  Response/PricedOffer/Offer                ← the original, re-priced
  Response/ShoppingResponse/ShoppingResponseID  ← the UPDATED one        [Create_05]
        │
        │  mapNdcxOfferPriceUpsellReply
        ▼
{ ...OfferPriceRs (the PricedOffer, as today),
  bundles: [ { offerId, fareName, cabinType, price, bagsCount, description[],
               flightsDataToChange[], OfferIdList[{OfferItemRefID, PaxRefID[]}],
               priceBreakdown, offerPrice: <OfferPriceRs minus DataLists> } ] }   [ADR-63]
        │
        │  SelectBundle.vue → OfferCard.vue → BundleDetails.vue → "Valider"
        │  → bookingFlow.setData({ gokyteSelectedBundleId: offerId })
        │  → order.vue watcher [:1349-1404] : AMADEUS_NDCX branch swaps selectedOffer
        ▼
AmadeusNdcxAdapter.bookFlight()                                      [UNCHANGED]
   OfferID            ← bundle.offerPrice.OfferID
   OfferIdList        ← bundle.offerPrice.OrderItems
   ShoppingResponseId ← bundle.offerPrice.ResponseID    ← the updated shopping response
        ▼
Travel_OrderCreate/Request/CreateOrder/SelectedOffer                  [Create_05 ✅]
```

---

## 5. Request and reply mapping

### 5.1 The request delta — three lines, and the element order matters

`createNdcxOfferPricePayload` (`offer.utils.js:32-49`) today returns:

```js
Request: {
  DataLists: { PaxList: { Pax: [...] } },
  PricedOffer: { SelectedOffer: {...} },
}
```

The upsell branch appends **one key, last**:

```js
Request.ShoppingCriteria = { FarePreferences: { $attributes: { PreferencesContext: "Upsell" } } };
```

**Element order is schema-enforced and JS key insertion order *is* XML element order**
(`NDCX-CONTEXT.md` §3). `ShoppingCriteria` is the **last** child of `Request`, after
`DataLists` and `PricedOffer`. Verified on four independent captures:

| Capture | Order |
|---|---|
| `examples/servicing/Reuse-Credit---Zero-Balance-Due/2-OfferPrice-req.xml:12-41` | `DataLists` → `PricedOffer` → `ShoppingCriteria/FarePreferences@PreferencesContext="Upsell"` |
| `examples/prime-booking/AF-Public-SAF-Bundle/2-Query-Travel-OfferPrice.xml:32-73` | `DataLists` → `PricedOffer` → `<ShoppingCriteria />` (empty) |
| `examples/prime-booking/VY-Family-DOCO-DOCA-DOCS/2---OfferPrice-req.xml:51-53` | same |
| `examples/servicing/AFKL-Seat-Bundle-Travel-API-samples/03---TravelOfferPriceRQ.xml:33-34` | same |

And metis already emits a `ShoppingCriteria` in exactly that position, for a different
purpose: `ancillaryOffer.utils.js:68-75` appends
`Request.ShoppingCriteria = { ExistingOrderCriteria: {...} }` after `PricedOffer`. **Reuse
that placement; do not invent a new one.**

> ⚠️ `FarePreferences` carries the value in an **attribute**, not as element text —
> `PreferencesContext="Upsell"`, written through `node-soap`'s `$attributes` key
> (`NdcxClient.js` `CLIENT_OPTIONS`, `attributesKey: "$attributes"`, the same convention
> `amount.utils.js:95` and `offerPriceReply.mapper.js:137-141` read on the way back).
> Emitting it as a child element produces a schema-valid-looking message that the host
> ignores, and you get no `OtherOffers` with no error.

> ⚠️ **Do not collide two `ShoppingCriteria` keys.** AFKL has this latent bug:
> `AFKL/offer.utils.js:94-100` spreads `jsonPricedOffer()` (which emits `ShoppingCriteria`
> when `body.upSell`) next to `jsonShoppingCriteria()` (which emits one when `body.OrderID`),
> last-write-wins. For NDC[X] the post-booking ancillary path
> (`ancillaryOffer.utils.js:68`) also writes `Request.ShoppingCriteria`. The two are never
> requested together today, but the upsell builder must **merge into** the existing key, not
> assign over it.

Everything else on the request is unchanged — which is what Offer_06 requires:
*"UPSELL element is sent correctly **along with the proper elements as addressed in ID
Offer_01 through Offer_06**"* (`references/10-certification-and-testing.md:154`). So the
upsell request must still carry Offer_01's `OfferID`/`OfferItemID`/`OwnerCode` per PTC
(`offer.utils.js:82-108`), Offer_03's PTC match, Offer_04's `ShoppingResponseRefID`
(`offer.utils.js:85`) and Offer_05's infant→adult `PaxRefID` link
(`offer.utils.js:204-220`). All already implemented. Nothing may be dropped on the upsell
path — hence "append one key", not "build a second, leaner payload".

### 5.2 The reply — `OtherOffers/Offer[]` → bundle card

Target shape is AFKL's bundle object (`AFKL/offer.utils.js:414-432`), which is what
`OfferCard.vue` / `BundleDetails.vue` / `order.vue`'s watcher read.

| Bundle field | NDC[X] source | Notes |
|---|---|---|
| `offerId` | `OtherOffers/Offer/OfferID` | the watcher's match key (`order.vue:1358-1360`) |
| `OfferIdList[]` | `Offer/OfferItem[]` → `{ OfferItemRefID: OfferItemID, PaxRefID: splitRefs(FareDetail/PassengerRefs) }` | **Trap 2**: `PassengerRefs` is space-separated in one element; reuse `offerPriceReply.mapper.js:462-466`'s `splitRefs`. Ancillary items with no `FareDetail` read `Service[]/PaxRefID` instead (`:296-306`). |
| `price` | `Offer/TotalPrice/TotalAmount` | `1650460` `CurCode="USD"` on the capture (`2-OfferPrice-res.xml:687-689`) = **16504.60**. Integer minor units — §6. |
| `priceBreakdown.{base,tax}` | `OfferItem/FareDetail/Price/{BaseAmount, Taxes/Total}` summed over items | same arithmetic `buildLevel3Price` (`:309-349`) already does |
| `fareName` | `DataLists/PriceClassList/PriceClass[PriceClassID == Offer/JourneyOverview/JourneyPriceClass/PriceClassRefID]/Name` | `"Flagship Business"` (`:243`). Per-component `FareComponent/PriceClassRef` (`:672`) is the finer-grained join IBERIA uses (`IBERIA/offer.utils.js:656-661`). |
| `cabinType` | `OfferItem/FareDetail/FareComponent/FareBasis/CabinType/CabinTypeName` | `"BUSINESS"` (`:650`) |
| `fareType` | `FareComponent/FareBasis/FareBasisCode/Code` + `FareIndicatorCode` | ⚠️ NDC[X] has no `FareTypeCode` equivalent of AFKL's `70G/70J/758` mapping (`AFKL/offer.utils.js:316-329`). Emit `"Public"` and say so, rather than inventing a classification. |
| `description[]` | `PriceClass/Desc[]/DescText` | `"Check 2 bags free"`, `"Choose a lie-flat seat"` (`:247,251`). **Reuse `buildDescriptions` verbatim** (`offerPriceReply.mapper.js:180-204`) — it already scopes PriceClasses to the offer's `JourneyOverview`; just pass the other offer. (Note AFKL's own `description` is dead code — declared at `AFKL/offer.utils.js:264`, never filled.) |
| `bagsCount`, `baggages[]` | `Offer/BaggageAllowance[]` → `DataLists/BaggageAllowanceList` | 🔴 **the AA capture's `OtherOffers` offers carry NO `BaggageAllowance` block at all** (the `PricedOffer` one has four, `:1303-1322`), and UA's S14 note says the same for its carrier. Fall back to parsing `PriceClass/Desc` text, and when neither resolves, emit `bagsCount: null` and let the card hide the badge — **never 0**, which reads as "no bags included". |
| `seatIncluded`, `seatType`, `fastBoarding` | — | No NDC[X] source. IBERIA derives them from `PriceClass` description regexes (`IBERIA/offer.utils.js:723-734`); that is IB-specific text matching and must not be ported. Emit `false` / `""` and let the icons stay off. |
| `isDetailed`, `flightsDataToChange[]` | one entry per `JourneyOverview/JourneyPriceClass`, each `{ fareDetails: { Name, CabinType, CabinTypeCode, FareBasisCode }, bagages: [...], conditions: [...] }` | this is what makes `BundleDetails.vue:74-108` render the per-bound table instead of the flat one. Conditions come from `FareComponent/FareRules/Penalty` via the existing `penalty.utils.js#buildPenalties`. **Cuttable** — see §9. |
| `isCheapest` | computed: the lowest `TotalPrice` across `PricedOffer` + `OtherOffers` | AFKL hardcodes `false`; we can do better for free since both are in the same reply |
| `color` | `"info"` | matches AFKL |
| `PassengerTaxs` | `[]` | AFKL always emits `[]` (`AFKL/offer.utils.js:430`); the watcher writes it into `shoppingOffer.OfferIdList` (`order.vue:1366-1369`) and nothing reads it back on our path |
| **`offerPrice`** | the full re-rooted `OfferPriceRs` for this offer, minus `DataLists` | **ADR-63** — the field no other provider has, and the one that makes `bookFlight()` work unchanged |

### 5.3 Where it lives

A new `src/utils/AMADEUS_NDCX/offerPriceUpsell.mapper.js`, not an expansion of
`offerPriceReply.mapper.js`. The existing mapper exports one function and has one job; the
upsell mapper imports its (newly parameterised) offer-reading half and adds the card
projection. Same split as `orderReshopReply.mapper.js` vs `orderExchangeReply.mapper.js`
(`NDCX-FLIGHTCHANGE-PLAN.md` §1).

The closest existing model to copy is **not** AFKL's `formatBundles` — it is
`IBERIA/offer.utils.js:637-748`'s `upSellResponse`, which reads `OtherOffers.Offer[]` and
joins `PriceClassList` / `BaggageAllowanceList` / `FareList` the same way we need to. Its
`offerItemIds: string[]` output shape (flat strings, no `PaxRefID`) is the one part **not**
to copy — `order.utils.js:97-101` needs `PaxRefID`.

---

## 6. Money

Everything in `OtherOffers` obeys the same rule as the rest of the reply, and getting it
wrong is the 100× class of defect `NDCX-CONTEXT.md` §3 opens with:

- Amounts are **integer minor units**, currency on the `@CurCode` / `@Code` attribute.
  Capture: `<TotalAmount CurCode="USD">1650460</TotalAmount>` = `16504.60`
  (`2-OfferPrice-res.xml:688`).
- The scale comes from
  `Response/Metadata/Other/**OtherMetadata[]**/CurrencyMetadatas/CurrencyMetadata@MetadataKey/Decimals`
  — and `OtherMetadata` is an **array** on real captures: `:296-320` of the same file holds
  `[{CurrencyMetadatas}, {RuleMetadatas}]`, exactly the shape `amount.utils.js:59-63`'s
  `findOtherMetadata` iterates.
- Therefore: **`readCurrencyDecimals(response)` once, threaded into every
  `parseNdcxAmount(node, { decimals })` call**, exactly as
  `offerPriceReply.mapper.js:32,62,279,314` already does. Never a fixed `* 100` — BHD, IQD,
  JOD, KWD, OMR, TND and LYD are 3-decimal (`amount.utils.js:35`), and
  `LoyaltyUnitAmount`/`MILES` is not a currency and passes through unscaled.
- Because ADR-63 reuses the shipped mapper's offer-reading half, **all of this comes for
  free** — provided the refactor passes `decimals` through rather than recomputing it per
  offer. One `readCurrencyDecimals` call for the whole reply.
- `RuleMetadata.Instruction` (`"Not Allowed"`) must still be translated to the `"NAV"`
  sentinel `dossier.utils.js` checks (`NDCX-CONTEXT.md` §3) — `penalty.utils.js` already
  does it and is reused unchanged.
- There is **no price delta** anywhere in the reply. AFKL's card shows an absolute price
  (`OfferCard.vue:86-87`), and we mirror that. A delta against
  `PricedOffer/Offer/TotalPrice` is a two-line computation in the mapper and both totals are
  in the same reply — worth adding as `priceDelta`, but it is a UI improvement over AFKL,
  not parity, so it goes in the "nice" column of §9.

---

## 7. `front-reservation` implementation checklist

- [ ] `AmadeusNdcxAdapter` constructor (`AmadeusNdcxAdapter.ts:44-80`): set
      `this.capabilities.bundles` from the front mirror of ADR-64's table, keyed on
      `bookingFlow().getShoppingOffer()?.validatingCarrier`; permissive default `true`.
      Leave `uiPrefrences.bundlesButton` at its inherited `true` (`BaseAdapter.ts:290`).
- [ ] `AmadeusNdcxAdapter.getBundles()` — a copy of `AirFranceAdapter.ts:1570-1622` with the
      NDC[X] id fields of `getOffer()` (`AmadeusNdcxAdapter.ts:87-101`):
      ```
      { upSell: true, OfferID, AirlineDesigCode, OfferIdList,
        ShoppingResponseId: offer.ShoppingResponseId,   // NOT `responseId` — ADR-1
        OwnerCode: offer.validatingCarrier,
        OfferExpirationDateTime, oras: ["AMADEUS_NDCX"], paxs, agenceInfo? }
      ```
      POST `/aerial/global/offerPriceRQ`.
      ⚠️ **Do not copy AFKL's `if (!offerPriceResponse.bundles) throw` guard** — check
      `response.Errors?.length` first and surface the airline message, then treat an
      absent/empty `bundles` as "no upsell available" (ADR-62). Also keep AFKL's
      `window.location.pathname` gate out of it; the component already only exists on the
      checkout page.
- [ ] Reuse `BaseAdapter.getControllerByOra` nowhere here — the route is hardcoded, like
      every other `AmadeusNdcxAdapter` call. (`CONTROLLERS` *does* now carry an
      `AMADEUS_NDCX` entry, `BaseAdapter.ts:83-86`, added as an ADR-20 consequence; the
      `?? "AFKL"` fallback at `:123-125` no longer bites NDC[X]. `NDCX-CONTEXT.md`'s
      "🔴 Live, currently-shipped hazard" note on `issueOrder` is stale on this point.)
- [ ] `order.vue:1511-1515` — replace the hardcoded ora array with
      `_ora?.capabilities?.bundles` (ADR-65). Shared-file touch, name it in the PR.
- [ ] `order.vue:1372` — `if (!["AMADEUS", "IB", "AMADEUS_NDCX"].includes(_ora?.ora)) await init();`
- [ ] `order.vue:1376-1399` — new `case "AMADEUS_NDCX":` that
      (a) `bookingFlow.setSelectedOffer({ ...bundle.offerPrice, DataLists: <top-level> })`,
      (b) clears luggage / sports / other-extras / seat selections the way `init()` does
          (`order.vue:1301-1304`) — the old selections were priced against the old offer,
      (c) re-runs `getSeatData()` then `getServiceData()` **sequentially** with the new
          `OfferID`,
      (d) rebuilds `items.value` from `bundle.offerPrice.OrderItems`.
- [ ] 🔴 **Do not rely on the watcher's `setShoppingOffer` write** at `order.vue:1362-1370`.
      It sets `OfferIdList: [{ OfferItemRefID: <the bundle's **offerId**>, PassengerTaxs }]` —
      an *Offer* id in an *OfferItem* field, with **no `PaxRefID` at all**. For AFKL this is
      harmless because `AirFranceAdapter.getOffer()` overwrites it from
      `bundle.OfferIdList` two steps later (`:1832-1842`). On the NDC[X] path there is no
      such overwrite, and `offer.utils.js:94-100` / `order.utils.js:97-101` reject the
      payload with *"is missing PaxRefID"*. The `AMADEUS_NDCX` branch must take its ids from
      `bundle.offerPrice`, never from `shoppingOffer`.
- [ ] `needToSelectSeats` (`order.vue:1337-1347`) is gated on `["AF","KL"]`. An NDC[X] upsell
      that changes cabin invalidates any seat already chosen. Either widen the gate or rely
      on (b) above clearing the selection — decide, do not leave both.
- [ ] No new component, no new i18n key. `pages-booking-flight-order.showBundles`
      (`locales/fr.json:2611` *"Afficher les Bundles"*, `locales/en.json:3399` *"Show
      Bundles"*) and the `components-booking-flight-order-widgets-SelectBundle` /
      `…-BundleDetails` blocks are reused as-is.

---

## 8. `api-aerial` implementation checklist

### 8.1 `src/utils/AMADEUS_NDCX/carrierCapabilities.js`

- [ ] `UPSELL_PRICING` table (§3) + `resolveNdcxUpsellSupport(ownerCode)` returning
      `{ ownerCode, supported, sameCabinOnly, maxUpsells, baggageOnUpsell, verified,
      matrixRefreshed }`. Pure, no host, testable first.

### 8.2 `src/utils/AMADEUS_NDCX/offer.utils.js`

- [ ] `createNdcxOfferPricePayload(body, salesPoint)` grows an upsell branch on
      `body.upSell === true`: append `Request.ShoppingCriteria.FarePreferences` **last**,
      **merging** into any existing `ShoppingCriteria` (§5.1).
- [ ] Reject before the host call: `upSell` on a carrier `resolveNdcxUpsellSupport` says is
      unsupported → a named error, not a host round-trip (ADR-64).
- [ ] `assertOfferNotExpired` unchanged (ADR-66).

### 8.3 `src/utils/AMADEUS_NDCX/offerPriceReply.mapper.js` (refactor, behaviour-neutral)

- [ ] Extract the offer-reading half into `buildOfferPriceView(offerNode, ctx)` where `ctx`
      carries `{ dataLists, decimals, paxSegmentsById, paxSegmentRefsByJourneyId }`.
      `mapNdcxOfferPriceReply` becomes `buildOfferPriceView(response.PricedOffer.Offer, ctx)`
      plus the `DataLists`/`Errors`/`ResponseID` envelope.
- [ ] `readCurrencyDecimals(response)` stays a **single** call for the whole reply (§6).
- [ ] The existing `ndcx-offer-price-reply.mapper.test.js` must pass **unmodified**. That is
      the gate on this refactor.

### 8.4 `src/utils/AMADEUS_NDCX/offerPriceUpsell.mapper.js` (new)

- [ ] `mapNdcxOfferPriceUpsellReply(reply, body)` → `{ ...mapNdcxOfferPriceReply(...), bundles }`.
- [ ] One bundle per `Response/OtherOffers/Offer`, §5.2's table, sorted ascending on
      `TotalPrice`, capped at `maxUpsells` (default 20).
- [ ] `bundle.offerPrice = buildOfferPriceView(offer, ctx)` with `DataLists` stripped (ADR-63).
- [ ] Import-light (no DB, no models) so it runs under plain `node --test`, like the other
      NDC[X] mappers.

### 8.5 `src/controllers/AMADEUS_NDCX/offer.controller.js`

- [ ] `offerController.processRequest` (`:51-66`) branches: `req.body.upSell` →
      `mapNdcxOfferPriceUpsellReply`, else `mapNdcxOfferPriceReply`. One line each.
- [ ] `validateControllerInput` (`:25-42`) unchanged — the upsell request carries exactly the
      same mandatory fields.
- [ ] Keep the `sendError`-returns-an-object override (`:20-23`) as is: `/offerPriceRQ` is
      dispatched by `global.controller.js:673` with no real `res` (`NDCX-CONTEXT.md` §3).
      The error shell therefore has **no `bundles` key**, which is what ADR-62 wants.
- [ ] The `OfferExpiredError` → 409 branch (`:59-61`) applies unchanged.

### 8.6 No shared-file edits

`dossier.utils.js`, `pnr.service.js`, `global.controller.js`, `Structure/OfferPriceRs.js`,
`order.utils.js` and `AmadeusNdcxAdapter.bookFlight()` are all **untouched** — that is the
point of ADR-61 + ADR-63. If that turns out false, say so in the PR description
(`NDCX-CONTEXT.md` §3 standing constraint).

### 8.7 Capture-then-test procedure

Same discipline as `NDCX-ORDERPAY-PLAN.md` §8 — vendored examples are from another office
and are **trimmed** (`2-OfferPrice-res.xml:1` says so in its own first line: repeating
elements reduced to 3). Never commit one as a fixture, and never read counts out of one.

1. Ship §8.2's request side far enough to round-trip. A throwing mapper is fine at this
   stage — `ndcxLogger` writes the XML either way.
2. `NODE_ENV=development`, drive shopping → offerPrice(upsell) from the front **on AA** (§3),
   with the certification itinerary: 2 ADT + 1 CHD + 1 INF, international, round trip,
   direct. CHD is **`CNN`**, never `CHD` (`NDCX-CONTEXT.md` §3, Shopping_06).
3. Keep `…-Travel_OfferPriceAsync-RQ.xml` **and** `-RS.xml` in `api-aerial/use cases/NDCX/`.
   The RQ is the Offer_06 evidence; the RS is the only way to settle whether
   `OtherOffers/Offer` carries `BaggageAllowance` for the carriers we fly.
4. Repeat on **LO** — the carrier for which upsell-at-pricing is the only upsell path (§3).
5. Generate the fixture with the existing fixture script, **reusing `CLIENT_OPTIONS`
   verbatim** (`forceItemsEnumerable`, `attributesKey: "$attributes"`, `ignoredNamespaces`):
   they change which nodes come back as arrays, so the fixture is only faithful if it matches
   `NdcxClient.create`.
6. Then write §8.8's tests against it.

### 8.8 Tests

House convention: one fixture-based mapper test per operation, backed by a real capture
(`src/utils/AMADEUS_NDCX/__tests__/`, fixtures in `__tests__/fixtures/*.json`).

- [ ] `__tests__/ndcx-offer-price-upsell.utils.test.js` — the **request** builder:
      `ShoppingCriteria` is the last key of `Request`; `FarePreferences` carries
      `PreferencesContext` as an **attribute**; the non-upsell payload is byte-identical to
      today's; an existing `ExistingOrderCriteria` is merged, not overwritten; an unsupported
      carrier is rejected before any host call.
- [ ] `__tests__/ndcx-offer-price-upsell.mapper.test.js` + a new
      `__tests__/fixtures/ndcx-offer-price-upsell-reply.json` built from §8.7's own-office
      capture. Asserts:
      - one bundle per `OtherOffers/Offer`, sorted ascending by price, capped at 20;
      - `bundle.price` is **major units** decoded through the per-currency `Decimals`
        metadata — include one 3-decimal-currency case (the 100×/1000× regression);
      - `bundle.OfferIdList[].PaxRefID` is a **split array**, not the space-joined string;
      - `bundle.offerPrice.{OfferID, ResponseID, OrderItems, TotalPrice}` are populated and
        `bundle.offerPrice.DataLists` is **absent**;
      - `bundle.offerPrice.ResponseID` equals the reply's
        `ShoppingResponse/ShoppingResponseID` — **the Create_05 assertion**;
      - a reply with no `OtherOffers` yields no `bundles` key (not `[]`) — the ADR-62 guard;
      - `bagsCount` is `null`, not `0`, when the offer has no `BaggageAllowance`.
- [ ] Extend `__tests__/ndcx-carrier-capabilities.test.js` with the `UPSELL_PRICING` table:
      QF and VY refused, UA flagged `baggageOnUpsell: false`, unknown carrier permissive.
- [ ] `ndcx-offer-price-reply.mapper.test.js` — **unchanged**, as the refactor gate (§8.3).

---

## 9. Effort, against 2026-11-08

Today is **2026-10-13**. The checklist is due **2026-11-08**; technical questions to Amadeus
close **2026-10-28**. That is roughly **18 working days**, shared with the XND fix, the
checklist assembly and whatever else lands.

| Workstream | Estimate |
|---|---|
| `UPSELL_PRICING` table + gate + its test | 0.5 d |
| Request flag + builder test (§8.2, §8.8) | 0.5 d |
| `offerPriceReply.mapper.js` refactor, behaviour-neutral (§8.3) | 1.0 d |
| `offerPriceUpsell.mapper.js` + bundle projection (§8.4) | 2.0 d |
| Controller branch (§8.5) | 0.5 d |
| Live capture on AA + LO, fixture generation (§8.7) | 1.0 d |
| Fixture-based mapper test (§8.8) | 1.0 d |
| Front: adapter `getBundles()` + capability flag (§7) | 1.0 d |
| Front: the three `order.vue` edits + the swap branch (§7) | 1.5 d |
| End-to-end QA on the certification itinerary (2 ADT + 1 CHD + 1 INF, RT, CB, book + ticket) | 1.0 d |
| Buffer for host surprises | 2.0 d |
| **Total** | **≈ 12 working days, one developer** |

**Honest reading: it fits, but only just, and only if the live capture works the first
time.** The single biggest schedule risk is not code — it is that no own-office reply has
ever contained `OtherOffers` (§3). If AA returns none, step 6 of §8.7 becomes a support
ticket to Amadeus, and the 10/28 question deadline is 11 working days away.

**What can be cut, in the order to cut it:**

1. **`flightsDataToChange[]` / `isDetailed`** (§5.2). Set `isDetailed: false` and let
   `BundleDetails.vue:109-148`'s flat branch render name + price + `description[]`. Saves
   ~1 day. The modal is less rich; certification does not look at it.
2. **The carrier gate** (ADR-64). Ship permissive, let the host refuse. Saves 0.5 day. Only
   QF and VY are affected and neither is a pilot carrier.
3. **`priceDelta`, the expiry countdown in the modal, `isCheapest`.** Saves ~0.5 day. Pure
   polish; AFKL has none of them either.
4. **🔴 The whole front, as an emergency measure.** Offer_06 and Create_05 are judged on the
   **wire messages**, not on the UI. A debug-only query flag that forces `upSell: true` on
   the pricing call and auto-selects the first `OtherOffers` entry would produce a compliant
   `Travel_OfferPrice` RQ, a compliant `Travel_OrderCreate` RQ and a real booking — the
   complete certification evidence — for about **4 days of backend work**. The agent-facing
   button then ships after 11/08. This is the fallback to name out loud now, not to discover
   on 11/05.

**What cannot be cut:** the request flag, the `OtherOffers` read, the amount decoding, the
`ShoppingResponseID` chaining, and the live capture. Those five *are* the test case.

---

## 10. Open questions — resolve while building, do not assume

- 🔴 **Will our carriers actually return `OtherOffers`?** Zero own-office evidence (§3). The
  matrix says yes for 16 of 18, but the matrix also says `Upsells (Shopping)` is supported
  for SQ and we have never seen a fare-family upsell from them either. Settle this with one
  live call before writing the mapper.
- 🔴 **`ShoppingResponseID = NOT_USED` on SQ / LO / AC.** If the certification booking must
  be on one of those, Create_05's "updated shopping response" is literally the string
  `NOT_USED`. Ask Amadeus before 10/28 whether that satisfies the criterion, or book on AA.
- 🔴 **Does `Travel_OrderCreate` accept an `OtherOffers` `OfferID` from our office?** The AA
  vendored capture says yes (§ADR-61). Our office has never done it. This is the one step
  that commits a real booking, so it is also the one that cannot be dry-run.
- **No `BaggageAllowance` on `OtherOffers` offers** in the only capture we have, plus UA's
  S14 note. If that generalises, the bundle cards lose their most useful column and the
  agent is choosing on price and fare-family name alone. Verify on the live capture and, if
  confirmed, decide whether `PriceClass/Desc` text parsing is worth it (it is carrier
  free-text — probably not).
- **`FarePreferences` attribute vs element.** Written from the capture
  (`2-OfferPrice-req.xml:39`) and the guide (`references/06-payment-and-features.md:24,41`),
  which agree. But the vendored `.d.ts` under `src/types/NDCX/` is not authoritative for
  shape (`NDCX-CONTEXT.md` §3), so a silent no-upsell reply means checking this first.
- **Is the original `PricedOffer` still bookable after an upsell call?** The upsell reply
  mints a **new** `ShoppingResponseID` (`X1805BED6…` → `P81071294…`). If the agent opens the
  modal and closes it, the stored `OfferPriceRs` still holds the *previous* call's
  `ResponseID`. Unknown whether the host invalidates it. **Mitigation to build in regardless:
  always adopt the upsell reply's `PricedOffer` as the canonical stored offer**, even when
  the agent declines — it is a fresh pricing of the same thing and costs nothing.
- **Does the flag change the `PricedOffer`?** On the AA capture both are present and the
  priced one looks normal. Assert it in QA: the pre-upsell and post-upsell prices of the
  *same* offer must match to the cent.
- **AA and AC are in `DIRECTLY_INTEGRATED`** (`carrierCapabilities.js:22-28`) and have no
  `CAPABILITIES` entry, so `resolveNdcxCarrierCapabilities` returns `inScope: false` for
  them — yet our own NDC[X] office prices and books both. Either the set or the pilot scope
  is wrong. Not this ticket's to fix, but it decides which carrier §3's recommendation can
  actually use.
- **`offerPriceCache`.** AFKL caches offer-price replies keyed on the generated request
  (`AFKL/offer.controller.js:27-38`), which is why its upsell and non-upsell calls do not
  collide. NDC[X] has no such cache, so there is nothing to invalidate — but if one is ever
  added, the key must include the `ShoppingCriteria` block.

---

## 11. Definition of done

- [ ] A `Travel_OfferPrice` RQ from our own office, committed under
      `api-aerial/use cases/NDCX/`, containing
      `Request/ShoppingCriteria/FarePreferences@PreferencesContext="Upsell"` as the last child
      of `Request`, with every Offer_01–Offer_05 element still present. **This file is the
      Offer_06 evidence.**
- [ ] The matching RS, containing `Response/OtherOffers/Offer[]`, committed as a fixture.
- [ ] A `Travel_OrderCreate` RQ whose `SelectedOffer/OfferID` is one of that reply's
      `OtherOffers` ids and whose `ShoppingResponseRefID` is that reply's
      `ShoppingResponse/ShoppingResponseID`. **This file is the Create_05 evidence.**
- [ ] The certification itinerary booked **and ticketed** end to end: 2 ADT + 1 CHD (`CNN`)
      + 1 INF, international, round trip, direct, upsell at pricing, credit card.
- [ ] *"Afficher les Bundles"* appears on `/booking/flight/order` for an NDC[X] offer on a
      supported carrier, and does **not** appear for QF or VY.
- [ ] Picking a bundle changes the displayed total to the upsell's price, to the cent, and
      the booked amount matches what was on screen.
- [ ] `ndcx-offer-price-reply.mapper.test.js` green **unmodified** (the refactor gate);
      the two new test files green.
- [ ] `NDCX-CHECKLIST-AMADEUS.md`'s test case 2 ticked, and its "point 2" section struck.
- [ ] PR description names: the two `order.vue` shared-file edits, the
      `offerPriceReply.mapper.js` refactor, and the decision in ADR-61 (no re-price) with its
      capture reference.

---

## 12. Glossary additions

Extends `NDCX-ORDERPAY-PLAN.md` §11.

| Term | Meaning here |
|---|---|
| **Upsell at pricing** | Amadeus's name for `ShoppingCriteria/FarePreferences@PreferencesContext="Upsell"` on `Travel_OfferPrice`, answered with `Response/OtherOffers`. Distinct from **upsell at shopping** (`FFI`/`UPH` feeIds on MasterPricer, which metis already does) and from **fare-family filtering** on the results page. |
| **Bundle** | The front's word for an upsell offer. The card object AFKL, AMADEUS, GOKYTE and IBERIA all produce and `OfferCard.vue` renders. There is no file enforcing its shape — `src/utils/Structure/` has only `OfferPriceRs.js` and `AirShoppingRs.js`. |
| **`bundle.offerPrice`** | ADR-63. A complete `OfferPriceRs` for one upsell offer, minus the shared `DataLists`. The field that lets `bookFlight()` stay unchanged. |
| **Updated shopping response** | Create_05's wording for `Response/ShoppingResponse/ShoppingResponseID` on the `Travel_OfferPrice` reply — which differs from the one sent in the request. `NOT_USED` on SQ/LO/AC (§3). |
| **S14** | Matrix note: *"Upsells are available but without displaying the baggage allowance (airline limitation)"*. Applies to UA, and to AA on the WBS `Upsells (Shopping)` row. |
| **`BUNDLE_KEYWORDS`** | AFKL's `["plus", "saf", "extra"]` name filter (`AFKL/offer.utils.js:6`). AF/KL product rule. Deliberately **not** ported (ADR-67). |
