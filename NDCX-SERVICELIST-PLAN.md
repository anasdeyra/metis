# NDC[X] Ancillary Services (`Travel_ServiceList`) Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.
> Read [`NDCX-CONTEXT.md`](./NDCX-CONTEXT.md) **first** (two-minute guardrail doc), then
> [`NDCX-SEATMAP-PLAN.md`](./NDCX-SEATMAP-PLAN.md) — **this plan depends on it**.

**Goal:** Let an agent see and buy airline ancillary services — chargeable checked bags first
and foremost — on an NDC[X] booking at checkout, on a held order, and on a ticketed order, by
wiring `Travel_ServiceList` end-to-end into the existing luggage and ancillary UI.

**Architecture:** Mirrors the seat-map plan one layer up. A request builder, a reply mapper
into the **AFKL `createJsonRS` shape**, and a controller — no new transport (`travelServiceList`
already exists at `NdcxClient.js:101-104`). The genuinely new work over seats is **bag unit
semantics**: NDC[X] sells bags by the piece *or* by the kilogram, the discriminator is one XML
attribute, and getting it wrong prices the wrong thing silently.

**Tech Stack:** Node.js / Express / `soap` (api-aerial, CommonJS, `node --test`);
Nuxt 4 / Vue 3 / Pinia / Vuetify 4 (front-reservation).

**Spec:** this file. Protocol authority is
`.agents/skills/ndcx/references/13-ancillaries-and-seats.md` **plus the captures named per
task** — where they disagree, **the capture wins**.

---

## Dependency: build the seat-map plan first

[`NDCX-SEATMAP-PLAN.md`](./NDCX-SEATMAP-PLAN.md) builds the shared ancillary spine. This plan
**consumes it and does not rebuild it**:

| From the seat-map plan | Used here by |
|---|---|
| Task 1 — `resolveNdcxCarrierCapabilities()` | Tasks 1, 2, 5 |
| Task 6 — `createNdcxAncillaryOfferPricePayload()` (the 2nd OfferPrice, `services[].Qty`) | Task 4 |
| Task 7 — `POST /aerial/AMADEUS_NDCX/offer/ancillaryPriceRQ` | Task 6 |
| Task 8 — `AncillaryOfferIdList` on `Travel_OrderCreate` | Task 6 |
| Task 9 — `Travel_OrderChange` + `orderChangeRQ` route | Task 7 |
| Task 12 — `collectNdcxServiceSelection()` **stub** | Task 6 replaces it |
| Task 13 — `formatLuggage()` **stub** | Task 6 replaces it |

Starting here without that plan means re-deriving ADR-34, ADR-35 and ADR-36 from scratch.

## Global Constraints

All of [`NDCX-SEATMAP-PLAN.md`](./NDCX-SEATMAP-PLAN.md)'s Global Constraints apply unchanged —
stateless calls, `buildNdcxParty` only, integer minor units, schema-enforced element order,
`CNN` not `CHD`, the 18-carrier scope, no AF/KL behaviour, the `"NDCX-"` prefix rule, and the
test/lint commands. Three additions specific to services:

- **Bag unit is per-reply, never per-carrier.** The capability table's `bags.unit: "mixed"`
  means "this carrier does both, depending on route" (Amadeus notes A02/A03/A04). The only
  authority is `ServiceDefinition/BookingInstructions/AddlDataMeasure/@UnitCode` on the reply
  being read: `"n"` = pieces, `"kg"` = kilograms, absent = a plain a-la-carte service with no
  quantity. Branch on the attribute, never on the carrier.
- **`Qty` means different things.** For `@UnitCode="n"` it is a piece count; for
  `@UnitCode="kg"` it is a **kilogram count**, and the price the reprice returns is the
  **total for the whole weight**, not a unit price. Sending a piece count for a kg bag is
  certification rule Offer_07.
- **Blocking is mandatory, not cosmetic.** "If chargeable bags are not available for all
  segments, it is recommended to block the selection of these services"
  (`13-ancillaries-and-seats.md`, global rules). Partial-coverage bags must not be sellable.

## ADRs introduced by this plan

ADR-1…29 are taken by the existing plans; ADR-30…38 by
[`NDCX-SEATMAP-PLAN.md`](./NDCX-SEATMAP-PLAN.md). This plan owns **ADR-39…ADR-44**.

| ADR | Decision |
|---|---|
| **ADR-39** | `Travel_ServiceList` replies map to the **AFKL `createJsonRS` shape**, same as seats, so the existing luggage UI is reused rather than forked. |
| **ADR-40** | Services are classified into `bag` / `meal` / `lounge` / `sports` / `other` from `ReasonForIssuanceSubCode` + `BookingInstructions/SSRCode`. **Bags are modelled; everything else renders in a generic "other service" bucket** (decision #2). |
| **ADR-41** | Bag quantity unit comes from `AddlDataMeasure/@UnitCode` **on the reply**, never from the carrier table. `"kg"` enables the weight UI; `"n"` the piece UI; absent means a fixed service with no quantity. |
| **ADR-42** | A chargeable service not available on **every** segment of its journey is marked `blocked` by the backend and rendered disabled by the front. |
| **ADR-43** | The `Paxs` wrapper differs between timings — `Paxs/Pax` pre-booking, `Paxs/PaxList/Pax` post-booking. Capture-driven; both are emitted by the same builder off the `OrderID` discriminator. |
| **ADR-44** | Ancillary services are persisted as `service_aerial` rows **at cost** (no margin), consistent with ADR-38 and with what IBERIA/AFKL already do. |

---

## What the host actually sends (capture-verified)

Sources:
`.agents/skills/ndcx/examples/servicing/SQ-Family-Bag-in-Weight-PreBooking/3-Query-Travel-ServiceList.xml`
and `3-Reply-Travel-ServiceList.xml` (pre-booking, kg bags);
`.agents/skills/ndcx/examples/servicing/SQ-Family-Add-Seats-and-Bags-Post-Payment/5---Travel-ServiceList--1.xml`
(post-booking);
`.agents/skills/ndcx/examples/servicing/AF-Bag-Seat-After-Pricing-2nd-OfferPrice/44-Query-Travel-ServiceList.xml`
(pre-booking, single offer item).

**Request-side divergences the guide does not show:**

1. **`CoreRequest/Offer/OfferItem` repeats** — one per air offer item, i.e. one per PTC when
   the carrier prices per-PTC. The SQ capture carries three (`...CAESHVNQ...`, `...CAISHVNQ...`,
   `...CAMSHVNQ...`), each with its own `Service/ServiceID`. The guide's §1.2 shows one.
2. **`ServiceID` is `"1"` for SQ and `"SRV0"` for AF** — it is the air offer item's own service
   id, echoed back, not a constant. Read it from the OfferPrice reply.
3. **`OwnerCode` inside `OfferItem` is QF-only.** SQ and AF both omit it. Emitting it for every
   carrier is untested; omitting it for QF is a documented failure.
4. **ADR-43 — the `Paxs` wrapper differs by timing.** Pre-booking is `Paxs/Pax` (both SQ and AF
   captures). Post-booking is `Paxs/PaxList/Pax` — one level deeper. Same element name, two
   shapes.
5. Pre-booking `Pax` carries `PaxID`, `PTC` and, for the adult travelling with an infant, a
   `PaxRefID` pointing at the infant's `PaxID`. Post-booking additionally carries
   `Individual/GivenName` + `Surname`.
6. Post-booking `ShoppingResponse` carries an `OwnerCode` **before** `ShoppingResponseID`
   (SQ capture); pre-booking carries `ShoppingResponseID` alone.

**Reply-side divergences from the shape the front consumes:**

| Front expects (AFKL shape) | NDC[X] emits | Action |
|---|---|---|
| `Offer.OfferItem[]` | `Response.ALaCarteOffer.ALaCarteOfferItem[]` | lift |
| `DataLists.ServiceDefinition[]` | `Response.DataLists.ServiceDefinitionList.ServiceDefinition[]` | lift |
| `ServiceDefinition.Desc.DescText` | `Description[]` — and SQ's entries are **codes**, not prose (`"Chargeable"`, `"F"`, `"01"`, `"BG"`) | prefer `Name`, fall back to `Description[0]` |
| bag identified by `ServiceDefinitionRefID.startsWith("BAGSERVICE-")` (IBERIA) | no such convention — `SRV1`, `SRV2`, … | classify from `ReasonForIssuanceSubCode` + `SSRCode` (ADR-40) |
| price in major units | integer minor units | `parseNdcxAmount` + `readCurrencyDecimals` |
| `Dep.IATALocationCode` | `Dep.IATA_LocationCode` | `renameIataLocationCode()` |

**The kg discriminator**, from the SQ reply:

```xml
<ServiceDefinition>
  <ServiceDefinitionID>SRV1</ServiceDefinitionID>
  <Name>ONE KILOGRAM BAGGAGE</Name>
  <ReasonForIssuanceCode>C</ReasonForIssuanceCode>
  <ReasonForIssuanceSubCode>0AA</ReasonForIssuanceSubCode>
  <BookingInstructions>
    <SSRCode>XBAG</SSRCode>
    <AddlDataMeasure UnitCode="kg">1</AddlDataMeasure>   <!-- THE discriminator -->
  </BookingInstructions>
</ServiceDefinition>
```

The offer item's `UnitPrice.TotalAmount` is then the price of **one kilogram**
(`CAD 1640` minor units = 16.40), and the agent's chosen weight goes in `Qty` on the 2nd
`Travel_OfferPrice`, whose reply carries the **total**.

---

## File Structure

**Backend — `api-aerial/src/`**

| File | Responsibility |
|---|---|
| `utils/AMADEUS_NDCX/serviceList.utils.js` | **create** — `createNdcxServiceListPayload`, both keyings + ADR-43 |
| `utils/AMADEUS_NDCX/serviceClassification.js` | **create** — pure: `ServiceDefinition` → `{ type, unit, ssrCode }` (ADR-40/41) |
| `utils/AMADEUS_NDCX/serviceListReply.mapper.js` | **create** — reply → AFKL shape + classification + ADR-42 blocking |
| `controllers/AMADEUS_NDCX/service.controller.js` | **create** — `ServiceController.serviceListRQ` |

**Front — `front-reservation/app/`**

| File | Responsibility |
|---|---|
| `utils/adapters/ndcx/ndcxServiceSelection.ts` | **create** — pure: classification → luggage offers, selection → payload rows |
| `utils/adapters/AmadeusNdcxAdapter.ts` | **modify** — real `getServices()`, `formatLuggage()`, `collectNdcxServiceSelection()` |

No dispatcher edit: `app.js:206-250` auto-mounts `service.controller.js` at
`/aerial/AMADEUS_NDCX/service/serviceListRQ`, which is exactly what `BaseAdapter.getServices()`
builds (`BaseAdapter.ts:503`), and `global.controller.js:703-716` reaches the same method.

---

### Task 1: Service classification (pure)

**Files:**
- Create: `src/utils/AMADEUS_NDCX/serviceClassification.js`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-service-classification.test.js`

**Interfaces:**
- Produces: `classifyNdcxService(serviceDefinition) -> { type: "bag"|"meal"|"lounge"|"sports"|"other", unit: "piece"|"kg"|null, quantityStep: number|null, ssrCode: string|null, subCode: string|null, label: string }`.
  Task 3's mapper calls it per `ServiceDefinition`; the front reads the result off the reply.

**ADR-40.** IBERIA identifies bags with `ServiceDefinitionRefID.startsWith("BAGSERVICE-")`
(`IberiaAdapter.ts:283-285`). NDC[X] has no such convention — its ids are `SRV1`, `SRV2`.
The stable signals are the EMD reason sub-code and the SSR code, both of which are IATA
vocabulary rather than carrier invention.

**ADR-41.** `unit` comes from `AddlDataMeasure/@UnitCode`, and **only** from there.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-service-classification.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyNdcxService } = require("../serviceClassification");

test("a kilogram bag is type bag, unit kg, step from AddlDataMeasure", () => {
  const result = classifyNdcxService({
    ServiceDefinitionID: "SRV1",
    Name: "ONE KILOGRAM BAGGAGE",
    ReasonForIssuanceCode: "C",
    ReasonForIssuanceSubCode: "0AA",
    BookingInstructions: {
      SSRCode: "XBAG",
      AddlDataMeasure: { $attributes: { UnitCode: "kg" }, _text: "1" },
    },
  });
  assert.equal(result.type, "bag");
  assert.equal(result.unit, "kg");
  assert.equal(result.quantityStep, 1);
  assert.equal(result.ssrCode, "XBAG");
  assert.equal(result.label, "ONE KILOGRAM BAGGAGE");
});

test("a piece bag is unit piece", () => {
  const result = classifyNdcxService({
    Name: "EXCESS SIZE",
    ReasonForIssuanceSubCode: "0ID",
    BookingInstructions: {
      SSRCode: "BULK",
      AddlDataMeasure: { $attributes: { UnitCode: "n" }, _text: "1" },
    },
  });
  assert.equal(result.type, "bag");
  assert.equal(result.unit, "piece");
});

test("a bag with no AddlDataMeasure is a fixed service with no quantity", () => {
  const result = classifyNdcxService({
    Name: "LUGGAGE",
    ReasonForIssuanceSubCode: "OCC",
    BookingInstructions: { SSRCode: "ABAG" },
  });
  assert.equal(result.type, "bag");
  assert.equal(result.unit, null);
  assert.equal(result.quantityStep, null);
});

test("classifies meals, lounge and sports from their SSR codes", () => {
  assert.equal(classifyNdcxService({ BookingInstructions: { SSRCode: "VGML" } }).type, "meal");
  assert.equal(classifyNdcxService({ BookingInstructions: { SSRCode: "LOUN" } }).type, "lounge");
  assert.equal(classifyNdcxService({ BookingInstructions: { SSRCode: "SPEQ" } }).type, "sports");
});

test("anything unrecognised falls into the generic other bucket (decision #2)", () => {
  const result = classifyNdcxService({
    Name: "PRIORITY BOARDING",
    BookingInstructions: { SSRCode: "PRIO" },
  });
  assert.equal(result.type, "other");
  assert.equal(result.label, "PRIORITY BOARDING");
});

test("falls back to the first textual Description when Name is absent", () => {
  const result = classifyNdcxService({
    Description: [{ DescID: "1", DescText: "Chargeable" }, { DescID: "5", Media: { MediaID: "1" } }],
    BookingInstructions: { SSRCode: "XBAG" },
  });
  assert.equal(result.label, "Chargeable");
});

test("never throws on a malformed definition", () => {
  const result = classifyNdcxService(null);
  assert.equal(result.type, "other");
  assert.equal(result.unit, null);
  assert.equal(result.label, "Service");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-service-classification.test.js`
Expected: FAIL, `Cannot find module '../serviceClassification'`.

- [ ] **Step 3: Implement**

```js
// src/utils/AMADEUS_NDCX/serviceClassification.js
/**
 * Classifies one `ServiceDefinition` from a `Travel_ServiceList` reply (ADR-40/41).
 *
 * Why not copy IBERIA's approach: IberiaAdapter.ts:283-285 finds bags with
 * `ServiceDefinitionRefID.startsWith("BAGSERVICE-")`, a convention Iberia's own backend mints.
 * NDC[X] ids are opaque (`SRV1`, `SRV2`, ...), so the only stable signals are IATA vocabulary:
 * the EMD reason-for-issuance sub-code and the SSR code. Both come straight off the wire and
 * are carrier-independent.
 *
 * Decision #2: bags are modelled in detail (they drive the quantity UI and the mandatory kg
 * reprice); meals, lounge and sports are recognised so the UI can label them, but share the
 * generic "other service" rendering. Nothing is dropped — an unrecognised service still
 * reaches the agent as `type: "other"`.
 */

/**
 * EMD reason-for-issuance sub-codes seen on bag services in the captures and the guide:
 *   0AA  ONE KILOGRAM BAGGAGE     (SQ, weight concept)
 *   0ID  EXCESS SIZE              (SQ, piece concept)
 *   OCC  LUGGAGE / ABAG           (AF sample, no quantity)
 * The 0Cx/0Dx families are the IATA baggage ranges; matched by prefix so a sub-code the
 * captures did not happen to show still classifies as a bag rather than falling to "other".
 */
const BAG_SUBCODE_PREFIXES = ["0A", "0C", "0D", "0I", "OC"];
const BAG_SSR_CODES = new Set(["ABAG", "XBAG", "BULK", "BBAG", "PBAG", "EBAG"]);

/** Special-meal SSRs are a closed IATA list; these are the ones metis already recognises. */
const MEAL_SSR_CODES = new Set([
  "AVML", "BBML", "BLML", "CHML", "DBML", "FPML", "GFML", "HNML", "KSML",
  "LCML", "LFML", "LSML", "MOML", "NLML", "RVML", "SFML", "SPML", "VGML",
  "VJML", "VLML", "VOML", "ORML",
]);
const LOUNGE_SSR_CODES = new Set(["LOUN", "LNGE"]);
const SPORTS_SSR_CODES = new Set(["SPEQ", "BIKE", "SKIS", "SURF", "GOLF"]);

/**
 * @param {object|null|undefined} definition - one `DataLists/ServiceDefinitionList/ServiceDefinition`
 */
function classifyNdcxService(definition) {
  const ssrCode = textOf(definition?.BookingInstructions?.SSRCode) ?? null;
  const subCode = textOf(definition?.ReasonForIssuanceSubCode) ?? null;
  const { unit, quantityStep } = readQuantityUnit(definition);

  return {
    type: resolveType(ssrCode, subCode),
    unit,
    quantityStep,
    ssrCode,
    subCode,
    label: resolveLabel(definition),
  };
}

function resolveType(ssrCode, subCode) {
  if (ssrCode) {
    if (BAG_SSR_CODES.has(ssrCode)) return "bag";
    if (MEAL_SSR_CODES.has(ssrCode)) return "meal";
    if (LOUNGE_SSR_CODES.has(ssrCode)) return "lounge";
    if (SPORTS_SSR_CODES.has(ssrCode)) return "sports";
  }
  if (subCode && BAG_SUBCODE_PREFIXES.some((prefix) => subCode.startsWith(prefix))) {
    return "bag";
  }
  return "other";
}

/**
 * ADR-41 — the ONLY authority for how a bag is sold.
 *
 *   @UnitCode="n"   pieces; Qty is a piece count, price scales per piece
 *   @UnitCode="kg"  kilograms; Qty is a KILOGRAM count, and a 2nd Travel_OfferPrice is
 *                   MANDATORY because the reply's amount is per-kilogram, not the total
 *   absent          a plain a-la-carte service with no quantity at all (AF's ABAG/LUGGAGE)
 *
 * Certification rule Offer_07: sending a piece count where UnitCode is "kg" produces the
 * wrong total AND skips the mandatory reprice. Always branch on the attribute.
 *
 * The carrier capability table's `bags.unit` is NOT consulted here — "mixed" (Amadeus notes
 * A02/A03/A04, "piece and weight concepts, depends on routes") means the carrier does both,
 * so only the reply for THIS itinerary can say which applies.
 */
function readQuantityUnit(definition) {
  const measure = definition?.BookingInstructions?.AddlDataMeasure;
  if (measure == null) return { unit: null, quantityStep: null };

  const rawUnit = measure?.$attributes?.UnitCode ?? null;
  const step = Number(textOf(measure));

  if (rawUnit === "kg") return { unit: "kg", quantityStep: Number.isFinite(step) ? step : 1 };
  if (rawUnit === "n") return { unit: "piece", quantityStep: Number.isFinite(step) ? step : 1 };

  // An unknown UnitCode is NOT silently treated as pieces — that is exactly the Offer_07
  // failure. Treated as "no quantity", which makes the service a fixed, non-scalable add-on.
  return { unit: null, quantityStep: null };
}

/**
 * `Name` first: SQ's `Description[]` entries are codes, not prose ("Chargeable", "F", "01",
 * "BG"), so showing Description[0] to an agent would render "Chargeable" as the bag's name.
 * The AF sample's Description IS prose, hence the fallback.
 */
function resolveLabel(definition) {
  const name = textOf(definition?.Name);
  if (name) return name;
  const descriptions = Array.isArray(definition?.Description)
    ? definition.Description
    : [definition?.Description].filter(Boolean);
  const firstText = descriptions.map((d) => textOf(d?.DescText)).find(Boolean);
  return firstText ?? "Service";
}

function textOf(value) {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && typeof value._text !== "undefined") return String(value._text);
  return undefined;
}

module.exports = { classifyNdcxService, BAG_SSR_CODES, MEAL_SSR_CODES };
```

- [ ] **Step 4: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-service-classification.test.js`
Expected: PASS, 7/7.

- [ ] **Step 5: Commit**

```bash
git add src/utils/AMADEUS_NDCX/serviceClassification.js src/utils/AMADEUS_NDCX/__tests__/ndcx-service-classification.test.js
git commit -m "feat(ndcx): classify ancillary services and resolve bag units (ADR-40/41)"
```

---

### Task 2: `Travel_ServiceList` request builder

**Files:**
- Create: `src/utils/AMADEUS_NDCX/serviceList.utils.js`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-service-list.utils.test.js`

**Interfaces:**
- Consumes: `buildNdcxParty`, `getPaxCodeFromMetis`, `stripNdcxOrderIdPrefix`,
  `resolveNdcxCarrierCapabilities` (seat-map plan Task 1).
- Produces: `createNdcxServiceListPayload(body, salesPoint) -> { Party, Request }`.
  Task 4's controller calls it.

Four shape rules this builder exists to get right, all capture-derived and none of them in the
guide: repeating `OfferItem`, per-item `ServiceID`, QF-only `OwnerCode`, and ADR-43's two
`Paxs` shapes.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-service-list.utils.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createNdcxServiceListPayload } = require("../serviceList.utils");

const salesPoint = { "Amadeus-officeId": "NCE1A0950", iata: "20255373" };
const paxs = [{ ptc: "ADT" }, { ptc: "ENF" }, { ptc: "INF" }];

const preBooking = {
  OfferID: "TOlmCzsWVSRJ_1A_26d16a48_1A_1A_TPID_CiMS",
  OwnerCode: "SQ",
  ShoppingResponseId: "SP2F-12382921279997477441",
  OfferIdList: [
    { OfferItemID: "AIR-ITEM-1", ServiceID: "1" },
    { OfferItemID: "AIR-ITEM-2", ServiceID: "1" },
  ],
  paxs,
};

test("pre-booking repeats OfferItem, one per air offer item, each with its ServiceID", () => {
  const payload = createNdcxServiceListPayload(preBooking, salesPoint);
  const offer = payload.Request.CoreRequest.Offer;
  assert.equal(offer.OfferID, preBooking.OfferID);
  assert.equal(offer.OwnerCode, "SQ");
  assert.deepEqual(offer.OfferItem, [
    { OfferItemID: "AIR-ITEM-1", Service: { ServiceID: "1" } },
    { OfferItemID: "AIR-ITEM-2", Service: { ServiceID: "1" } },
  ]);
});

test("QF alone gets OwnerCode inside OfferItem", () => {
  const qf = createNdcxServiceListPayload({ ...preBooking, OwnerCode: "QF" }, salesPoint);
  assert.equal(qf.Request.CoreRequest.Offer.OfferItem[0].OwnerCode, "QF");
  // ...and the element order is OfferItemID, OwnerCode, Service.
  assert.deepEqual(Object.keys(qf.Request.CoreRequest.Offer.OfferItem[0]), [
    "OfferItemID", "OwnerCode", "Service",
  ]);
  const sq = createNdcxServiceListPayload(preBooking, salesPoint);
  assert.equal(sq.Request.CoreRequest.Offer.OfferItem[0].OwnerCode, undefined);
});

test("ADR-43: pre-booking uses Paxs/Pax, and links the infant to its adult", () => {
  const payload = createNdcxServiceListPayload(preBooking, salesPoint);
  assert.deepEqual(payload.Request.Paxs, {
    Pax: [
      { PaxID: "PAX1", PTC: "ADT", PaxRefID: "PAX3" },
      { PaxID: "PAX2", PTC: "CNN" },
      { PaxID: "PAX3", PTC: "INF" },
    ],
  });
  assert.deepEqual(Object.keys(payload.Request), ["CoreRequest", "Paxs", "ShoppingResponse"]);
});

test("ADR-43: post-booking uses Paxs/PaxList/Pax and keys on Order", () => {
  const payload = createNdcxServiceListPayload(
    { OrderID: "NDCX-SQ_6RUS54", OwnerCode: "SQ", paxs: [{ ptc: "ADT" }] },
    salesPoint,
  );
  assert.deepEqual(payload.Request.CoreRequest, {
    Order: { OrderID: "SQ_6RUS54", OwnerCode: "SQ" },
  });
  assert.deepEqual(payload.Request.Paxs, { PaxList: { Pax: [{ PaxID: "PAX1", PTC: "ADT" }] } });
  assert.equal(payload.Request.ShoppingResponse, undefined);
});

test("post-booking with a ShoppingResponseId puts OwnerCode before ShoppingResponseID", () => {
  const payload = createNdcxServiceListPayload(
    {
      OrderID: "NDCX-SQ_6RUS54", OwnerCode: "SQ", paxs: [{ ptc: "ADT" }],
      ShoppingResponseId: "SP1P-4036910776671929245",
    },
    salesPoint,
  );
  assert.deepEqual(Object.keys(payload.Request.ShoppingResponse), [
    "OwnerCode", "ShoppingResponseID",
  ]);
});

test("rejects a pre-booking call with no air offer items", () => {
  assert.throws(
    () => createNdcxServiceListPayload({ ...preBooking, OfferIdList: [] }, salesPoint),
    /At least one OfferIdList entry is required/,
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-service-list.utils.test.js`
Expected: FAIL, `Cannot find module '../serviceList.utils'`.

- [ ] **Step 3: Implement**

```js
// src/utils/AMADEUS_NDCX/serviceList.utils.js
const { getPaxCodeFromMetis } = require("../AMADEUS/global.utils");
const { isUnseatedInfantType } = require("../AMADEUS/amadeus.utils");
const { buildNdcxParty } = require("./party.utils");
const { stripNdcxOrderIdPrefix } = require("./order.utils");
const { resolveNdcxCarrierCapabilities } = require("./carrierCapabilities");

/**
 * `AMA_TravelServiceListRQ` builder, both keyings.
 *
 * Four shapes here are capture-derived and contradict or extend
 * 13-ancillaries-and-seats.md §1.2 / §2.2 — the guide shows a single truncated sample and the
 * real messages are richer:
 *
 *  1. `CoreRequest/Offer/OfferItem` REPEATS — one per air offer item (i.e. one per PTC when the
 *     carrier prices per-PTC). SQ-Family-Bag-in-Weight-PreBooking/3-Query sends three.
 *  2. `OfferItem/Service/ServiceID` is the air offer item's OWN service id echoed back, not a
 *     constant: "1" for SQ, "SRV0" for AF. Read it from the OfferPrice reply.
 *  3. `OfferItem/OwnerCode` is QF-ONLY (13-ancillaries-and-seats.md "Gotchas"). SQ and AF both
 *     omit it; emitting it everywhere is untested, omitting it for QF is a known failure.
 *  4. ADR-43: the `Paxs` wrapper differs by timing — `Paxs/Pax` pre-booking (SQ + AF captures),
 *     `Paxs/PaxList/Pax` post-booking (SQ-...-Post-Payment/5---Travel-ServiceList--1.xml).
 *     Same element name, one extra level.
 */
function createNdcxServiceListPayload(body, salesPoint) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required and must be an object");
  }
  if (!body.OwnerCode) {
    throw new Error("OwnerCode (the airline) is required to list services");
  }

  const Party = buildNdcxParty(salesPoint);
  const paxList = buildServiceListPaxList(body.paxs);

  // ── Post-booking / post-issuance: keyed on the order ──────────────────────
  if (body.OrderID) {
    const Request = {
      CoreRequest: {
        Order: { OrderID: stripNdcxOrderIdPrefix(body.OrderID), OwnerCode: body.OwnerCode },
      },
      // ADR-43: the nested PaxList wrapper, post-booking only.
      Paxs: { PaxList: { Pax: paxList } },
    };
    // The SQ post-booking capture carries a ShoppingResponse with OwnerCode FIRST; the guide's
    // §2.2 sample omits the block entirely. Send it only when the caller has one — an empty
    // ShoppingResponseID is a schema error, not a harmless blank.
    if (body.ShoppingResponseId) {
      Request.ShoppingResponse = {
        OwnerCode: body.OwnerCode,
        ShoppingResponseID: body.ShoppingResponseId,
      };
    }
    return { Party, Request };
  }

  // ── Pre-booking: keyed on the offer ───────────────────────────────────────
  if (!body.OfferID) {
    throw new Error("OfferID (pre-booking) or OrderID (post-booking) is required to list services");
  }
  if (!body.ShoppingResponseId) {
    throw new Error("ShoppingResponseId is required to list services pre-booking");
  }
  if (!Array.isArray(body.OfferIdList) || body.OfferIdList.length === 0) {
    throw new Error("At least one OfferIdList entry is required to list services");
  }

  const { serviceListRequiresOfferItemOwnerCode } = resolveNdcxCarrierCapabilities(body.OwnerCode);

  return {
    Party,
    Request: {
      CoreRequest: {
        Offer: {
          OfferID: body.OfferID,
          OwnerCode: body.OwnerCode,
          OfferItem: body.OfferIdList.map((item, index) =>
            buildOfferItem(item, index, body.OwnerCode, serviceListRequiresOfferItemOwnerCode),
          ),
        },
      },
      Paxs: { Pax: paxList },
      ShoppingResponse: { ShoppingResponseID: body.ShoppingResponseId },
    },
  };
}

function buildOfferItem(item, index, ownerCode, needsOwnerCode) {
  const id = item?.OfferItemID ?? item?.OfferItemRefID;
  if (!id) throw new Error(`OfferIdList[${index}] is missing OfferItemID`);

  // Element order is schema-enforced: OfferItemID, [OwnerCode], Service.
  return {
    OfferItemID: id,
    ...(needsOwnerCode ? { OwnerCode: ownerCode } : {}),
    // "1" is SQ's value and the commonest; AF sends "SRV0". The caller should pass the real
    // one off the OfferPrice reply — this default only keeps the element present, which the
    // schema requires.
    Service: { ServiceID: item?.ServiceID != null ? String(item.ServiceID) : "1" },
  };
}

/**
 * `PAX{n}` ids, same convention as every other NDC[X] builder.
 *
 * The infant link matters: both pre-booking captures attach the infant's PaxID to the
 * accompanying adult as `PaxRefID` (SQ: P1 -> I1; AF omits it, having no infant). Without it
 * the host cannot tell which adult an infant's services belong to.
 */
function buildServiceListPaxList(paxs) {
  if (!Array.isArray(paxs) || paxs.length === 0) {
    throw new Error("At least one passenger is required to list services");
  }

  const entries = paxs.map((pax, index) => {
    if (!pax || !pax.ptc) throw new Error(`Passenger at index ${index} must have a valid PTC`);
    const PTC = getPaxCodeFromMetis(pax.ptc);
    return {
      PaxID: `PAX${index + 1}`,
      PTC,
      isInfant: isUnseatedInfantType(PTC) || Boolean(pax?._other?.isInf),
    };
  });

  // Attach each infant to the next unlinked adult, in order — the same pairing rule
  // order.utils.js's linkInfants applies for Travel_OrderCreate, so the two messages agree.
  const infants = entries.filter((e) => e.isInfant);
  const adults = entries.filter((e) => !e.isInfant && e.PTC === "ADT");
  const linkedByAdult = new Map();
  infants.forEach((infant, index) => {
    const adult = adults[index];
    if (adult) linkedByAdult.set(adult.PaxID, infant.PaxID);
  });

  return entries.map(({ PaxID, PTC }) => {
    const linked = linkedByAdult.get(PaxID);
    return linked ? { PaxID, PTC, PaxRefID: linked } : { PaxID, PTC };
  });
}

module.exports = { createNdcxServiceListPayload };
```

- [ ] **Step 4: Confirm the infant-pairing helper agrees with OrderCreate**

Run: `cd api-aerial/src && grep -n "function linkInfants" -A 25 utils/AMADEUS_NDCX/order.utils.js`
Expected: the same "next unlinked adult, in order" rule. If `linkInfants` pairs differently
(e.g. by an explicit `pax._other.linkedAdultId`), **change this builder to match it** — the two
messages must agree on which adult owns which infant, or the host attaches services to the
wrong traveller.

- [ ] **Step 5: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-service-list.utils.test.js`
Expected: PASS, 6/6.

- [ ] **Step 6: Commit**

```bash
git add src/utils/AMADEUS_NDCX/serviceList.utils.js src/utils/AMADEUS_NDCX/__tests__/ndcx-service-list.utils.test.js
git commit -m "feat(ndcx): build Travel_ServiceList requests for both keyings (ADR-43)"
```

---

### Task 3: `Travel_ServiceList` reply mapper

**Files:**
- Create: `src/utils/AMADEUS_NDCX/serviceListReply.mapper.js`
- Create: `src/utils/AMADEUS_NDCX/__tests__/fixtures/ndcx-service-list-reply.json`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-service-list-reply.mapper.test.js`

**Interfaces:**
- Consumes: `classifyNdcxService` (Task 1), `resolveNdcxCarrierCapabilities`,
  `parseNdcxAmount` / `readCurrencyDecimals`, `renameIataLocationCode`.
- Produces: `mapNdcxServiceListReply(reply, body) -> ServiceListRs` in the AFKL shape (ADR-39),
  each `Offer.OfferItem[]` carrying `classification`, `blocked` and `blockedReason`.

**ADR-42 — segment-coverage blocking.** A chargeable service whose
`Eligibility/FlightAssociations/PaxSegmentRefID` does not cover every segment of the journey it
belongs to is marked blocked. The guide's rule: "If chargeable bags are not available for all
segments, it is recommended to block the selection of these services."

- [ ] **Step 1: Build the fixture from the real capture**

Run:
```bash
cd api-aerial/src && node -e '
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { parseStringPromise } = require("xml2js");
const src = "../../.agents/skills/ndcx/examples/servicing/SQ-Family-Bag-in-Weight-PreBooking/3-Reply-Travel-ServiceList.xml";
parseStringPromise(readFileSync(src, "utf8"), {
  explicitArray: false, tagNameProcessors: [(n) => n.replace(/^.*:/, "")],
  attrkey: "$attributes", charkey: "_text", explicitCharkey: false,
}).then((o) => {
  mkdirSync("utils/AMADEUS_NDCX/__tests__/fixtures", { recursive: true });
  writeFileSync(
    "utils/AMADEUS_NDCX/__tests__/fixtures/ndcx-service-list-reply.json",
    JSON.stringify(o.AMA_TravelServiceListRS, null, 2),
  );
  console.log("fixture written");
});'
```
Expected: `fixture written`. Confirm it contains
`Response.ALaCarteOffer.ALaCarteOfferItem`, `Response.DataLists.ServiceDefinitionList`, and
`Response.DataLists.PaxJourneyList`.

> ⚠️ This capture is `<!-- TRIMMED FOR SIZE -->` (180 offer items and 180 service definitions
> reduced to 3). **Assert on structure and named ids only, never on counts.**

- [ ] **Step 2: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-service-list-reply.mapper.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const reply = require("./fixtures/ndcx-service-list-reply.json");
const { mapNdcxServiceListReply } = require("../serviceListReply.mapper");

const body = { OwnerCode: "SQ" };

test("emits the AFKL createJsonRS top-level shape", () => {
  const value = mapNdcxServiceListReply(reply, body);
  assert.deepEqual(Object.keys(value).sort(), [
    "DataLists", "Errors", "Offer", "Warnings", "capabilities",
  ]);
  assert.deepEqual(Object.keys(value.DataLists).sort(), ["Pax", "PaxSegment", "ServiceDefinition"]);
});

test("converts per-unit minor-unit amounts to major units", () => {
  const { Offer } = mapNdcxServiceListReply(reply, body);
  const item = Offer.OfferItem.find((i) => i.OfferItemID === "SP2F-12382921279997477441-1-2");
  // Capture: CAD 1640 minor units for ONE kilogram.
  assert.equal(item.UnitPrice.TotalAmount, 16.4);
  assert.equal(item.UnitPrice.CurCode, "CAD");
});

test("attaches the classification to each offer item (ADR-40/41)", () => {
  const { Offer } = mapNdcxServiceListReply(reply, body);
  const item = Offer.OfferItem.find((i) => i.OfferItemID === "SP2F-12382921279997477441-1-2");
  assert.equal(item.classification.type, "bag");
  assert.equal(item.classification.unit, "kg");
  assert.equal(item.classification.ssrCode, "XBAG");
  assert.equal(item.classification.label, "ONE KILOGRAM BAGGAGE");
});

test("a kg bag is flagged as requiring the mandatory reprice", () => {
  const { Offer } = mapNdcxServiceListReply(reply, body);
  const item = Offer.OfferItem.find((i) => i.OfferItemID === "SP2F-12382921279997477441-1-2");
  assert.equal(item.requiresReprice, true);
});

test("ADR-42: a chargeable service missing a journey segment is blocked", () => {
  const mutated = JSON.parse(JSON.stringify(reply));
  const item = mutated.Response.ALaCarteOffer.ALaCarteOfferItem[0];
  // The capture covers SEG8 and SEG13; drop one so coverage is partial.
  item.Eligibility.FlightAssociations.PaxSegmentRefID = ["SEG8"];
  const { Offer } = mapNdcxServiceListReply(mutated, body);
  // The mapper flattens `_text`; the fixture may or may not have wrapped it, so compare on
  // position rather than on an id whose raw shape depends on the parse.
  const blocked = Offer.OfferItem[0];
  assert.equal(blocked.blocked, true);
  assert.match(blocked.blockedReason, /all segments/i);
});

test("a service with no resolvable amount is blocked", () => {
  const mutated = JSON.parse(JSON.stringify(reply));
  delete mutated.Response.ALaCarteOffer.ALaCarteOfferItem[0].UnitPrice;
  const { Offer } = mapNdcxServiceListReply(mutated, body);
  assert.equal(Offer.OfferItem[0].blocked, true);
  assert.match(Offer.OfferItem[0].blockedReason, /no price/i);
});

test("CX blocks every bag regardless of what the host returns", () => {
  const { Offer } = mapNdcxServiceListReply(reply, { OwnerCode: "CX" });
  const bags = Offer.OfferItem.filter((i) => i.classification.type === "bag");
  assert.ok(bags.length > 0);
  assert.ok(bags.every((b) => b.blocked));
  assert.match(bags[0].blockedReason, /does not sell bags/i);
});

test("an error-only reply returns the empty skeleton plus Errors, never throws", () => {
  const value = mapNdcxServiceListReply(
    { Response: { Error: { Code: "38661", DescText: "Technical Error" } } },
    body,
  );
  assert.deepEqual(value.Offer.OfferItem, []);
  assert.deepEqual(value.Errors, [{ code: "38661", description: "Technical Error" }]);
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-service-list-reply.mapper.test.js`
Expected: FAIL, `Cannot find module '../serviceListReply.mapper'`.

- [ ] **Step 4: Implement**

```js
// src/utils/AMADEUS_NDCX/serviceListReply.mapper.js
const { parseNdcxAmount, readCurrencyDecimals } = require("./amount.utils");
const { renameIataLocationCode } = require("./location.utils");
const { classifyNdcxService } = require("./serviceClassification");
const { resolveNdcxCarrierCapabilities } = require("./carrierCapabilities");

/**
 * `AMA_TravelServiceListRS` -> the AFKL `createJsonRS` shape (ADR-39), the same target the
 * seat-map mapper uses, so the existing ancillary UI consumes both without a fork.
 *
 * Three things this mapper adds that the seat mapper does not:
 *   - `classification` per offer item (ADR-40/41), because NDC[X] has no equivalent of
 *     IBERIA's "BAGSERVICE-" id convention and the front cannot bucket services without it.
 *   - `requiresReprice`, so the front knows a kg bag MUST go through the 2nd Travel_OfferPrice
 *     before it can be sold (the reply's amount is per-kilogram, not the total).
 *   - ADR-42 segment-coverage blocking.
 *
 * Import-light (no DB, no models) so it runs under plain `node --test`.
 */

function mapNdcxServiceListReply(reply, body = {}) {
  const response = reply?.Response ?? {};
  const decimals = readCurrencyDecimals(response);
  const aLaCarte = response?.ALaCarteOffer ?? {};
  const dataLists = response?.DataLists ?? {};
  const capabilities = resolveNdcxCarrierCapabilities(body?.OwnerCode);

  const definitionsById = indexServiceDefinitions(dataLists);
  const segmentsByJourney = indexJourneySegments(dataLists);

  return {
    DataLists: {
      Pax: ensureArray(dataLists?.PaxList?.Pax).map(clonePlain),
      PaxSegment: ensureArray(dataLists?.PaxSegmentList?.PaxSegment).map(buildPaxSegment),
      ServiceDefinition: ensureArray(
        dataLists?.ServiceDefinitionList?.ServiceDefinition,
      ).map(buildServiceDefinition),
    },
    Offer: {
      OfferItem: ensureArray(aLaCarte?.ALaCarteOfferItem).map((item) =>
        buildOfferItem(item, { decimals, definitionsById, segmentsByJourney, capabilities }),
      ),
      OfferExpirationDateTime: textOf(aLaCarte?.OfferExpirationDateTime) ?? null,
      OfferID: textOf(aLaCarte?.OfferID) ?? null,
      OwnerCode: textOf(aLaCarte?.OwnerCode) ?? null,
      ValidatingCarrierCode: textOf(aLaCarte?.ValidatingCarrierCode) ?? null,
    },
    Warnings: ensureArray(response?.Warning).map((w) => ({
      Code: textOf(w?.Code) ?? null,
      DescText: textOf(w?.DescText) ?? null,
    })),
    capabilities,
    Errors: ensureArray(response?.Error).map((err) => ({
      code: textOf(err?.Code) ?? null,
      description: textOf(err?.DescText) ?? textOf(err?.ShortText) ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// ALaCarteOfferItem
// ---------------------------------------------------------------------------

function buildOfferItem(item, ctx) {
  const { decimals, definitionsById, segmentsByJourney, capabilities } = ctx;

  const total = parseNdcxAmount(item?.UnitPrice?.TotalAmount, { decimals });
  const base = parseNdcxAmount(item?.UnitPrice?.BaseAmount, { decimals });
  const hasAmount = Number.isFinite(total);

  const definitionRef = textOf(item?.Service?.ServiceDefinitionRefID) ?? null;
  const classification = classifyNdcxService(definitionsById.get(definitionRef));

  const paxSegmentRefs = ensureArray(
    item?.Eligibility?.FlightAssociations?.PaxSegmentRefID,
  ).map(textOf).filter(Boolean);

  const { blocked, blockedReason } = resolveBlock({
    hasAmount,
    total,
    classification,
    paxSegmentRefs,
    segmentsByJourney,
    capabilities,
  });

  return {
    OfferItemID: textOf(item?.OfferItemID) ?? null,
    UnitPrice: {
      TotalAmount: hasAmount ? total : null,
      BaseAmount: Number.isFinite(base) ? base : null,
      CurCode: item?.UnitPrice?.TotalAmount?.$attributes?.CurCode ?? null,
    },
    Service: {
      ServiceID: textOf(item?.Service?.ServiceID) ?? null,
      ServiceDefinitionRefID: definitionRef,
    },
    Eligibility: {
      PaxRefID: ensureArray(item?.Eligibility?.PaxRefID).map(textOf).filter(Boolean),
      FlightAssociations: { PaxSegmentRefID: paxSegmentRefs },
    },
    classification,
    // ADR-41: a kg bag's amount above is the price of ONE kilogram. Selling it without the
    // second Travel_OfferPrice charges the wrong total — certification rule Offer_07.
    requiresReprice: classification.unit === "kg",
    blocked,
    blockedReason,
  };
}

/**
 * ADR-42 and the carrier table, in precedence order. The FIRST reason wins, so the agent sees
 * the most actionable explanation rather than a generic one.
 */
function resolveBlock({ hasAmount, total, classification, paxSegmentRefs, segmentsByJourney, capabilities }) {
  // 1. Carrier cannot sell this at all. CX is the live case: the matrix row
  //    "Create: Add Bag (After OfferPrice)" is 0, so even if the host lists bags they are not
  //    bookable through this channel.
  if (classification.type === "bag" && capabilities?.bags?.preBooking === false) {
    return { blocked: true, blockedReason: "This airline does not sell bags through NDC" };
  }

  // 2. No price. Guide rule, same as seats: a chargeable service with no amount must not be
  //    sellable. A genuine zero-cost service (total === 0) is fine and stays sellable.
  if (!hasAmount) {
    return { blocked: true, blockedReason: "Service returned no price and cannot be sold" };
  }

  // 3. ADR-42 — partial segment coverage. Only applies to CHARGEABLE services: a free service
  //    on one leg is a legitimate per-leg amenity, not a half-sold product.
  if (total > 0 && paxSegmentRefs.length > 0) {
    const journey = findCoveringJourney(paxSegmentRefs, segmentsByJourney);
    if (journey && paxSegmentRefs.length < journey.length) {
      return {
        blocked: true,
        blockedReason: "This service is not available on all segments of the journey",
      };
    }
  }

  return { blocked: false, blockedReason: null };
}

/**
 * The journey a service's segments belong to, so coverage can be judged against the right
 * denominator. Returns the segment list of the first journey that shares a segment with the
 * service — a service never spans two journeys.
 */
function findCoveringJourney(paxSegmentRefs, segmentsByJourney) {
  for (const segments of segmentsByJourney.values()) {
    if (paxSegmentRefs.some((ref) => segments.includes(ref))) return segments;
  }
  return null;
}

// ---------------------------------------------------------------------------
// DataLists
// ---------------------------------------------------------------------------

function indexServiceDefinitions(dataLists) {
  const index = new Map();
  for (const definition of ensureArray(dataLists?.ServiceDefinitionList?.ServiceDefinition)) {
    const id = textOf(definition?.ServiceDefinitionID);
    if (id) index.set(id, definition);
  }
  return index;
}

function indexJourneySegments(dataLists) {
  const index = new Map();
  for (const journey of ensureArray(dataLists?.PaxJourneyList?.PaxJourney)) {
    const id = textOf(journey?.PaxJourneyID);
    if (!id) continue;
    index.set(id, ensureArray(journey?.PaxSegmentRefID).map(textOf).filter(Boolean));
  }
  return index;
}

function buildPaxSegment(segment) {
  return {
    ...clonePlain(segment),
    Dep: renameIataLocationCode(segment?.Dep),
    Arrival: renameIataLocationCode(segment?.Arrival),
  };
}

/**
 * Same `Desc.DescText` synthesis as the seat mapper — the front reads `Desc`, NDC[X] sends
 * `Description[]`. `Name` is preferred over `Description[0]` because SQ's descriptions are
 * codes ("Chargeable", "F", "01", "BG"), not prose, so Description[0] would render as the
 * service's name. `classification` is attached here too, so a consumer holding only the
 * definition does not have to re-derive it.
 */
function buildServiceDefinition(definition) {
  const classification = classifyNdcxService(definition);
  return {
    ...clonePlain(definition),
    ServiceDefinitionID: textOf(definition?.ServiceDefinitionID) ?? null,
    Name: textOf(definition?.Name) ?? null,
    Desc: { DescText: classification.label },
    classification,
  };
}

// ---------------------------------------------------------------------------
// Shared helpers — identical contracts to the sibling NDC[X] mappers
// ---------------------------------------------------------------------------

function ensureArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value) {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && typeof value._text !== "undefined") return String(value._text);
  return undefined;
}

function clonePlain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

module.exports = { mapNdcxServiceListReply };
```

- [ ] **Step 5: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-service-list-reply.mapper.test.js`
Expected: PASS, 8/8.

If the CAD 16.40 assertion fails, print the currency metadata
(`node -e 'const r=require("./utils/AMADEUS_NDCX/__tests__/fixtures/ndcx-service-list-reply.json"); console.log(JSON.stringify(r.Response.Metadata, null, 2))'`).
`readCurrencyDecimals` must find `CurrencyMetadata/Decimals` inside the `OtherMetadata`
**array** — the array-vs-object trap from NDCX-CONTEXT.md §3. If the capture carries no
metadata at all, the ISO-4217 fallback gives CAD 2 decimals and the assertion still holds.

- [ ] **Step 6: Commit**

```bash
git add src/utils/AMADEUS_NDCX/serviceListReply.mapper.js src/utils/AMADEUS_NDCX/__tests__/
git commit -m "feat(ndcx): map Travel_ServiceList replies with classification and blocking (ADR-39/40/41/42)"
```

---

### Task 4: Service controller + route

**Files:**
- Create: `src/controllers/AMADEUS_NDCX/service.controller.js`
- Test: `src/controllers/AMADEUS_NDCX/__tests__/serviceList.controller.test.js`

**Interfaces:**
- Consumes: `createNdcxServiceListPayload` (Task 2), `mapNdcxServiceListReply` (Task 3).
- Produces: `module.exports = { ServiceController: { serviceListRQ }, setupRoute }`, mounted at
  `/aerial/AMADEUS_NDCX/service/serviceListRQ` and reachable through
  `global.controller.js:703-716`.

Structurally identical to the seat controller (seat-map plan Task 5) — same response-ownership
rule, same `OwnerCode` recovery, same "an errored list is a 200 with Errors" degradation.

- [ ] **Step 1: Write the failing test**

```js
// src/controllers/AMADEUS_NDCX/__tests__/serviceList.controller.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  res.type = () => res;
  res.send = (payload) => { res.body = payload; return res; };
  return res;
}

test("a pre-booking call with no ShoppingResponseId is rejected before any host call", async () => {
  const { ServiceController } = require("../service.controller");
  const res = makeRes();
  await ServiceController.serviceListRQ(
    { body: { OfferID: "O1", OwnerCode: "SQ", paxs: [{ ptc: "ADT" }] }, salesPoint: {} },
    res,
    () => {},
  );
  assert.equal(res.statusCode, 400);
});

test("setupRoute registers POST /serviceListRQ", () => {
  const { setupRoute } = require("../service.controller");
  const registered = [];
  setupRoute({ post: (path) => registered.push(path) });
  assert.deepEqual(registered, ["/serviceListRQ"]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test controllers/AMADEUS_NDCX/__tests__/serviceList.controller.test.js`
Expected: FAIL, `Cannot find module '../service.controller'`.

- [ ] **Step 3: Implement**

```js
// src/controllers/AMADEUS_NDCX/service.controller.js
const { createNdcxServiceListPayload } = require("../../utils/AMADEUS_NDCX/serviceList.utils");
const { mapNdcxServiceListReply } = require("../../utils/AMADEUS_NDCX/serviceListReply.mapper");
const { resolveNdcxAirlineOwnerCode } = require("../../utils/AMADEUS_NDCX/order.utils");
const { NdcxService } = require("../../services/AMADEUS_NDCX/ndcx.service");
const AmadeusControllerFactory = require("../../utils/AMADEUS/amadeusControllerFactory");
const PnrService = require("../../services/pnr.service");

/**
 * NDC[X] `Travel_ServiceList` (NDCX-SERVICELIST-PLAN.md Tasks 2/3/4).
 *
 * ⚠️ Same response-ownership rule as seat.controller.js and order.controller.js, and the
 * OPPOSITE of offer.controller.js: this route is dispatched with real Express args, both by
 * app.js's folder scan (/aerial/AMADEUS_NDCX/service/serviceListRQ) and by
 * global.controller.js:703-716 (/aerial/global/serviceListRQ). The controller owns the HTTP
 * response. Do not copy offer.controller.js's sendError-returns-an-object override.
 */
const serviceController = new AmadeusControllerFactory("/serviceListRQ");

serviceController.validateControllerInput = (req) => {
  const { body } = req;
  if (!body?.OrderID && !body?.OfferID) {
    return "OfferID (pre-booking) or OrderID (post-booking) is required";
  }
  if (!Array.isArray(body?.paxs) || body.paxs.length === 0) {
    return "At least one passenger is required";
  }
  if (!body?.OrderID) {
    if (!body?.ShoppingResponseId) return "ShoppingResponseId is required";
    if (!Array.isArray(body?.OfferIdList) || body.OfferIdList.length === 0) {
      return "At least one OfferIdList entry is required";
    }
  }
  return null;
};

serviceController.processRequest = async function (req, res) {
  let ndcxService;
  try {
    // ADR-9: pnr.ownerCode is "AMADEUS_NDCX", never the airline. Post-booking, recover the
    // real carrier from the persisted pnrList, as handleOrderRetrieve does.
    let ownerCode = req.body?.OwnerCode ?? null;
    if (!ownerCode && req.body?.OrderID) {
      const persisted = await PnrService.getPnrListByOrderId(req.body.OrderID);
      ownerCode = resolveNdcxAirlineOwnerCode(persisted?.dataValues?.pnrList) ?? null;
    }
    if (!ownerCode) {
      return this.sendError(
        res,
        new Error("OwnerCode (the airline) is required to list services"),
        400,
      );
    }

    const body = { ...req.body, OwnerCode: ownerCode };

    let payload;
    try {
      payload = createNdcxServiceListPayload(body, req.salesPoint);
    } catch (err) {
      return this.sendError(res, err, 400);
    }

    ndcxService = await NdcxService.create(req.salesPoint);
    const reply = await ndcxService.travelServiceList(payload);

    // An errored service list is not a failed checkout: the booking proceeds without
    // ancillaries. 200 + Errors lets the front show the airline's own reason.
    return this.sendResponse(res, mapNdcxServiceListReply(reply, body));
  } catch (err) {
    return this.sendError(res, err, err.name === "NdcxError" ? 502 : 500);
  } finally {
    if (ndcxService) await ndcxService.close();
  }
}.bind(serviceController);

serviceController.serviceListRQ = (req, res, next) =>
  serviceController.handleRequest(req, res, next);

serviceController.setupRoute = (app) => {
  app.post("/serviceListRQ", serviceController.serviceListRQ);
  return app;
};

module.exports = {
  ServiceController: { serviceListRQ: serviceController.serviceListRQ },
  setupRoute: serviceController.setupRoute,
};
```

- [ ] **Step 4: Run the whole backend suite**

Run: `cd api-aerial/src && npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/AMADEUS_NDCX/service.controller.js src/controllers/AMADEUS_NDCX/__tests__/serviceList.controller.test.js
git commit -m "feat(ndcx): expose Travel_ServiceList via ServiceController"
```

---

### Task 5: Reject a kg bag that was never repriced

**Files:**
- Modify: `src/utils/AMADEUS_NDCX/ancillaryOffer.utils.js` (seat-map plan Task 6)
- Modify: `src/utils/AMADEUS_NDCX/order.utils.js`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-kg-bag-guard.test.js`

**Interfaces:**
- Produces: `assertNdcxQuantitiesResolved(services)` — throws when a service declared
  `unit: "kg"` arrives without a positive integer `Qty`.

**Why this is its own task.** ADR-34 makes the reprice unconditional, which removes the
*routing* risk. It does not remove the *quantity* risk: a kg bag whose `Qty` is a piece count
(`1`) instead of a weight (`10`) reprices successfully and charges for 1 kg. The host cannot
detect it; nothing downstream can either. Certification rule Offer_07 names exactly this, and
the only place to catch it is at the boundary.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-kg-bag-guard.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { assertNdcxQuantitiesResolved } = require("../ancillaryOffer.utils");

test("a kg bag with a weight passes", () => {
  assert.doesNotThrow(() =>
    assertNdcxQuantitiesResolved([{ OfferItemID: "BAG-1", unit: "kg", Qty: 10 }]),
  );
});

test("a kg bag with no Qty is rejected (Offer_07)", () => {
  assert.throws(
    () => assertNdcxQuantitiesResolved([{ OfferItemID: "BAG-1", unit: "kg" }]),
    /weight in kilograms/i,
  );
});

test("a kg bag with a non-integer weight is rejected", () => {
  assert.throws(
    () => assertNdcxQuantitiesResolved([{ OfferItemID: "BAG-1", unit: "kg", Qty: 2.5 }]),
    /whole kilograms/i,
  );
});

test("a piece bag with no Qty defaults to one piece rather than failing", () => {
  assert.doesNotThrow(() =>
    assertNdcxQuantitiesResolved([{ OfferItemID: "BAG-1", unit: "piece" }]),
  );
});

test("a fixed service with no unit passes unquantified", () => {
  assert.doesNotThrow(() =>
    assertNdcxQuantitiesResolved([{ OfferItemID: "SRV-1", unit: null }]),
  );
});

test("tolerates an empty or absent list", () => {
  assert.doesNotThrow(() => assertNdcxQuantitiesResolved([]));
  assert.doesNotThrow(() => assertNdcxQuantitiesResolved(undefined));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-kg-bag-guard.test.js`
Expected: FAIL, `assertNdcxQuantitiesResolved` is not exported.

- [ ] **Step 3: Implement — append to `ancillaryOffer.utils.js`**

```js
/**
 * Certification rule Offer_07 guard (ADR-41).
 *
 * ADR-34 made the second Travel_OfferPrice unconditional, which removed the risk of SKIPPING
 * it. It did not remove the risk of sending the WRONG NUMBER: a weight-based bag whose `Qty`
 * is a piece count (1) rather than a weight (10) reprices cleanly and charges for one
 * kilogram. The host accepts it, the reply looks correct, and the passenger arrives with 23 kg
 * and one kilogram of allowance.
 *
 * Nothing downstream can detect this, so it is caught here, at the boundary, where the
 * `unit` the ServiceList mapper resolved is still attached to the selection.
 *
 * @param {Array<{OfferItemID?: string, unit?: string|null, Qty?: number}>} services
 */
function assertNdcxQuantitiesResolved(services) {
  for (const service of ensureArray(services)) {
    if (service?.unit !== "kg") continue;

    const qty = Number(service?.Qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(
        `Service ${service?.OfferItemID ?? "(unknown)"} is sold by weight and needs a weight in kilograms`,
      );
    }
    if (!Number.isInteger(qty)) {
      throw new Error(
        `Service ${service?.OfferItemID ?? "(unknown)"} must be ordered in whole kilograms, got ${qty}`,
      );
    }
  }
}
```

Call it at the top of `createNdcxAncillaryOfferPricePayload`, right after the `OfferIdList`
check:

```js
  // Offer_07 (ADR-41): a weight-based bag must carry kilograms, not a piece count.
  assertNdcxQuantitiesResolved(body.services);
```

and add it to that file's `module.exports`:

```js
module.exports = { createNdcxAncillaryOfferPricePayload, assertNdcxQuantitiesResolved };
```

- [ ] **Step 4: Guard the booking boundary too**

`buildServiceItem` already strips `unit` (it only reads `OfferItemID`, `PaxRefID`, `Qty`), so
the guard above protects the reprice. The booking call carries only ids and cannot re-check —
which is correct, because by then the host has already priced the right quantity. **No change
needed in `order.utils.js`;** this step exists to confirm that and prevent a redundant guard
being added. Verify:

Run: `cd api-aerial/src && grep -n "AncillaryOfferIdList" -A 8 utils/AMADEUS_NDCX/order.utils.js`
Expected: the ancillary items carry `OfferItemID` + `PaxRefID` only, no quantity.

- [ ] **Step 5: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-kg-bag-guard.test.js && node --test utils/AMADEUS_NDCX/__tests__/ndcx-ancillary-offer.utils.test.js`
Expected: PASS both — the seat-map plan's existing ancillary tests must be unaffected, since
seats never carry `unit: "kg"`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/AMADEUS_NDCX/ancillaryOffer.utils.js src/utils/AMADEUS_NDCX/__tests__/ndcx-kg-bag-guard.test.js
git commit -m "feat(ndcx): reject weight-based bags priced as pieces (Offer_07, ADR-41)"
```

---

### Task 6: Front — `getServices()` and real `formatLuggage()`

**Files:**
- Create: `front-reservation/app/utils/adapters/ndcx/ndcxServiceSelection.ts`
- Modify: `front-reservation/app/utils/adapters/AmadeusNdcxAdapter.ts`
- Test: `front-reservation/tests/unit/adapters/ndcxServiceSelection.test.ts`

**Interfaces:**
- Consumes: `/aerial/AMADEUS_NDCX/service/serviceListRQ` (Task 4).
- Produces: `formatNdcxLuggageOffers(serviceResponse) -> LuggageOffer[]`,
  `collectNdcxServiceSelection() -> Array<{ OfferItemID, PaxRefID, Qty?, unit }>`.
  The latter **replaces the stub** added by seat-map plan Task 12.

`LuggageOffer` (`bookingFlowStore.ts:48-58`) is the existing contract:
`{ additionalBags, price, paxRef, segRef, offerId, offerItemId, journey, ...rest }`.

- [ ] **Step 1: Write the failing test**

```ts
// front-reservation/tests/unit/adapters/ndcxServiceSelection.test.ts
import { describe, expect, it } from "vitest";

import {
  buildNdcxServicePayload,
  formatNdcxLuggageOffers,
} from "@/utils/adapters/ndcx/ndcxServiceSelection";

const serviceResponse = {
  Offer: {
    OfferID: "OFFER-1",
    OfferItem: [
      {
        OfferItemID: "BAG-KG-1",
        UnitPrice: { TotalAmount: 16.4, CurCode: "CAD" },
        Service: { ServiceDefinitionRefID: "SRV1" },
        Eligibility: { PaxRefID: ["PAX1"], FlightAssociations: { PaxSegmentRefID: ["SEG8", "SEG13"] } },
        classification: { type: "bag", unit: "kg", quantityStep: 1, label: "ONE KILOGRAM BAGGAGE" },
        requiresReprice: true,
        blocked: false,
        blockedReason: null,
      },
      {
        OfferItemID: "MEAL-1",
        UnitPrice: { TotalAmount: 12, CurCode: "CAD" },
        Service: { ServiceDefinitionRefID: "SRV9" },
        Eligibility: { PaxRefID: ["PAX1"], FlightAssociations: { PaxSegmentRefID: ["SEG8"] } },
        classification: { type: "meal", unit: null, quantityStep: null, label: "VEGETARIAN" },
        requiresReprice: false,
        blocked: false,
        blockedReason: null,
      },
      {
        OfferItemID: "BAG-BLOCKED",
        UnitPrice: { TotalAmount: 30, CurCode: "CAD" },
        Service: { ServiceDefinitionRefID: "SRV2" },
        Eligibility: { PaxRefID: ["PAX2"], FlightAssociations: { PaxSegmentRefID: ["SEG8"] } },
        classification: { type: "bag", unit: "piece", quantityStep: 1, label: "EXTRA BAG" },
        requiresReprice: false,
        blocked: true,
        blockedReason: "This service is not available on all segments of the journey",
      },
    ],
  },
  DataLists: {
    PaxSegment: [
      { PaxSegmentID: "SEG8", Dep: { IATALocationCode: "BKK" }, Arrival: { IATALocationCode: "SIN" } },
      { PaxSegmentID: "SEG13", Dep: { IATALocationCode: "SIN" }, Arrival: { IATALocationCode: "BKK" } },
    ],
  },
};

describe("formatNdcxLuggageOffers", () => {
  it("keeps bags, drops non-bags, and drops blocked offers", () => {
    const offers = formatNdcxLuggageOffers(serviceResponse);
    expect(offers.map((o) => o.offerItemId)).toEqual(["BAG-KG-1", "BAG-KG-1"]);
  });

  it("emits one offer per eligible segment with a readable journey label", () => {
    const offers = formatNdcxLuggageOffers(serviceResponse);
    expect(offers[0]).toMatchObject({
      offerItemId: "BAG-KG-1",
      offerId: "OFFER-1",
      paxRef: "PAX1",
      segRef: "SEG8",
      journey: "BKK-SIN",
      price: 16.4,
      unit: "kg",
    });
    expect(offers[1]!.segRef).toBe("SEG13");
  });

  it("returns an empty list for an errored or empty reply", () => {
    expect(formatNdcxLuggageOffers(null)).toEqual([]);
    expect(formatNdcxLuggageOffers({ Offer: { OfferItem: [] } })).toEqual([]);
  });
});

describe("buildNdcxServicePayload", () => {
  it("sends Qty as kilograms for a kg bag and carries the unit for the backend guard", () => {
    const rows = buildNdcxServicePayload([
      { offerItemId: "BAG-KG-1", paxRef: "PAX1", unit: "kg", additionalBags: 10 },
    ]);
    expect(rows).toEqual([{ OfferItemID: "BAG-KG-1", PaxRefID: "PAX1", Qty: 10, unit: "kg" }]);
  });

  it("sends Qty as a piece count for a piece bag", () => {
    const rows = buildNdcxServicePayload([
      { offerItemId: "BAG-P", paxRef: "PAX1", unit: "piece", additionalBags: 2 },
    ]);
    expect(rows[0]).toMatchObject({ Qty: 2, unit: "piece" });
  });

  it("omits Qty entirely for an unquantified service", () => {
    const rows = buildNdcxServicePayload([{ offerItemId: "SRV-1", paxRef: "PAX1", unit: null }]);
    expect(rows[0]).toEqual({ OfferItemID: "SRV-1", PaxRefID: "PAX1", unit: null });
  });

  it("merges duplicate selections of the same item for the same pax", () => {
    const rows = buildNdcxServicePayload([
      { offerItemId: "BAG-KG-1", paxRef: "PAX1", unit: "kg", additionalBags: 5 },
      { offerItemId: "BAG-KG-1", paxRef: "PAX1", unit: "kg", additionalBags: 5 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.Qty).toBe(10);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ndcxServiceSelection.test.ts`
Expected: FAIL, cannot resolve `@/utils/adapters/ndcx/ndcxServiceSelection`.

- [ ] **Step 3: Implement the pure helpers**

```ts
// front-reservation/app/utils/adapters/ndcx/ndcxServiceSelection.ts

import type { LuggageOffer } from "@/stores/bookingFlowStore";

/**
 * Pure helpers for the NDC[X] ancillary-service flow. No Pinia, no reactivity, no HTTP — the
 * adapter owns all three (the sibling-purity rule in front-reservation/CLAUDE.md).
 */

export interface NdcxServiceRow {
  OfferItemID: string;
  PaxRefID: string;
  Qty?: number;
  /**
   * Carried through to the backend so `assertNdcxQuantitiesResolved` can enforce Offer_07
   * (NDCX-SERVICELIST-PLAN.md Task 5). The payload builder strips it before the wire.
   */
  unit: string | null;
}

/**
 * `Offer.OfferItem[]` -> the `LuggageOffer[]` shape `bookingFlowStore` and the luggage UI
 * already speak (bookingFlowStore.ts:48-58), so NDC[X] reuses the existing interface rather
 * than forking it (ADR-39).
 *
 * Differences from IberiaAdapter.formatLuggage(), which this is modelled on:
 *   - bags are identified by `classification.type === "bag"` (ADR-40), not by an
 *     `"BAGSERVICE-"` id prefix — NDC[X] ids are opaque (SRV1, SRV2, ...).
 *   - blocked offers are DROPPED here rather than rendered disabled. Unlike a seat, a bag has
 *     no position in a grid: an absent row is the honest rendering, and the reason surfaces as
 *     an ancillary remark instead (see getServices below).
 *   - `unit` and `quantityStep` ride along so the UI can switch between a kg field and a piece
 *     stepper (ADR-41).
 */
export function formatNdcxLuggageOffers(
  serviceResponse: Record<string, any> | null | undefined,
): LuggageOffer[] {
  const items = serviceResponse?.Offer?.OfferItem ?? [];
  if (!Array.isArray(items) || items.length === 0) return [];

  const segmentsById = new Map<string, any>();
  for (const segment of serviceResponse?.DataLists?.PaxSegment ?? []) {
    if (segment?.PaxSegmentID) segmentsById.set(segment.PaxSegmentID, segment);
  }

  const offers: LuggageOffer[] = [];

  for (const item of items) {
    if (item?.classification?.type !== "bag") continue;
    if (item?.blocked) continue;

    const paxRefs: string[] = item?.Eligibility?.PaxRefID ?? [];
    const segRefs: string[] = item?.Eligibility?.FlightAssociations?.PaxSegmentRefID ?? [];
    const price = Number(item?.UnitPrice?.TotalAmount) || 0;

    for (const segRef of segRefs) {
      const segment = segmentsById.get(segRef);
      const journey = segment
        ? `${segment?.Dep?.IATALocationCode ?? "?"}-${segment?.Arrival?.IATALocationCode ?? "?"}`
        : segRef;

      for (const paxRef of paxRefs) {
        offers.push({
          additionalBags: item?.classification?.quantityStep ?? 1,
          price,
          paxRef,
          segRef,
          offerId: serviceResponse?.Offer?.OfferID ?? "",
          offerItemId: item.OfferItemID,
          journey,
          // NDC[X] extras the generic LuggageOffer index signature carries through.
          unit: item?.classification?.unit ?? null,
          quantityStep: item?.classification?.quantityStep ?? null,
          label: item?.classification?.label ?? "Bag",
          currency: item?.UnitPrice?.CurCode ?? null,
          requiresReprice: Boolean(item?.requiresReprice),
        });
      }
    }
  }

  return offers;
}

/**
 * Selected luggage -> the `services[]` rows `/ancillaryPriceRQ` expects
 * (ancillaryOffer.utils.js's `buildServiceItem`).
 *
 * ADR-41 — `Qty` is a PIECE COUNT for `unit: "piece"` and a KILOGRAM COUNT for `unit: "kg"`.
 * The UI collects both into `additionalBags`, which is the existing store field; the unit
 * decides what the number means. Sending kilograms as pieces is certification rule Offer_07
 * and the backend rejects it — this function is the place that must get it right, not the
 * place that detects it.
 *
 * Duplicate selections of the same item for the same pax are merged by summing quantities:
 * the luggage UI can add the same bag twice (once per leg) and the host wants one line.
 */
export function buildNdcxServicePayload(
  selected: Array<Record<string, any>>,
): NdcxServiceRow[] {
  const merged = new Map<string, NdcxServiceRow>();

  for (const entry of selected ?? []) {
    const offerItemId = entry?.offerItemId;
    const paxRef = entry?.paxRef;
    if (!offerItemId || !paxRef) continue;

    const key = `${offerItemId}::${paxRef}`;
    const unit = entry?.unit ?? null;
    const quantity = Number(entry?.additionalBags);

    const existing = merged.get(key);
    if (existing) {
      if (unit && Number.isFinite(quantity)) {
        existing.Qty = (existing.Qty ?? 0) + quantity;
      }
      continue;
    }

    const row: NdcxServiceRow = { OfferItemID: offerItemId, PaxRefID: paxRef, unit };
    // An unquantified service carries no Qty at all — sending Qty 1 on a fixed service is
    // accepted by some carriers and rejected by others, and it means nothing either way.
    if (unit && Number.isFinite(quantity) && quantity > 0) row.Qty = quantity;
    merged.set(key, row);
  }

  return [...merged.values()];
}
```

- [ ] **Step 4: Run the helper tests — green**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ndcxServiceSelection.test.ts`
Expected: PASS, 7/7.

- [ ] **Step 5: Wire the adapter**

Replace the `formatLuggage()` stub added by seat-map plan Task 13, and replace the
`collectNdcxServiceSelection()` stub added by its Task 12:

```ts
  /**
   * `Travel_ServiceList` (NDCX-SERVICELIST-PLAN.md Task 6).
   *
   * Overrides BaseAdapter.getServices() for the same three reasons getSeats() does: it sends
   * `responseId` where the backend reads `ShoppingResponseId`, it never sends `OwnerCode`, and
   * it calls `this.formatLuggage()` unguarded — which threw before this task.
   */
  override async getServices() {
    initClaussData();
    const offer = bookingFlow().getSelectedOffer();
    const pnr = servicingFlow().folder?.pnr;
    const paxs = this.isServicing ? servicingFlow().getPaxs() : bookingFlow().getPaxs();
    const _iata = iataForOffer();

    const ownerCode =
      pnr?.pnrList?.find((p: any) => p?.ownerIataCode && p.ownerIataCode !== "1A")
        ?.ownerIataCode ?? offer?.OwnerCode ?? null;

    const data: Record<string, any> = {
      ...claussDataSend,
      oras: ["AMADEUS_NDCX"],
      OwnerCode: ownerCode,
      paxs,
      ...(_iata ? { agenceInfo: _iata } : {}),
    };

    if (this.isServicing) {
      data.OrderID = pnr?.orderId;
    } else {
      data.OfferID = offer?.OfferID;
      data.ShoppingResponseId = offer?.ResponseID;
      // ServiceID is the air offer item's OWN service id echoed back — "1" for SQ, "SRV0" for
      // AF — not a constant. It comes off the OfferPrice reply.
      data.OfferIdList = (offer?.OrderItems ?? []).map((item: any) => ({
        OfferItemID: item.OfferItemID,
        ServiceID: item.ServiceID ?? item.Service?.ServiceID ?? "1",
      }));
    }

    try {
      const { data: responseData } = await axios({
        method: "post",
        url: "/aerial/AMADEUS_NDCX/service/serviceListRQ",
        data,
      });
      const response = responseData?.value ?? responseData ?? {};

      response.Errors?.forEach(({ code, description }: any) => {
        bookingFlow().ancillariesRemarks.push({
          type: "warning",
          text: `ServiceList ${code}: ${description}`,
        });
      });

      // ADR-42: a blocked bag is dropped from the sellable list, so tell the agent WHY rather
      // than silently showing fewer options. Deduplicated — one reason can apply to dozens of
      // per-pax-per-segment offer items.
      const blockedReasons = new Set<string>(
        (response?.Offer?.OfferItem ?? [])
          .filter((item: any) => item?.blocked && item?.blockedReason)
          .map((item: any) => item.blockedReason),
      );
      blockedReasons.forEach((text) => {
        bookingFlow().ancillariesRemarks.push({ type: "info", text });
      });

      bookingFlow().setServiceResponse(response);
      bookingFlow().setData({ ndcxCapabilities: response?.capabilities ?? null });
      await this.formatLuggage();
      return response;
    } catch (e) {
      console.error(e);
      bookingFlow().ancillariesRemarks.push({
        type: "error",
        text: "Travel options unavailable for this flight",
      });
      return {};
    }
  }

  /**
   * Real implementation, replacing the stub NDCX-SEATMAP-PLAN.md Task 13 added to stop
   * BaseAdapter.formatLuggage() throwing.
   *
   * ADR-41: `setIsUsingWeightSystem` drives the kg-vs-piece UI. It is resolved from the REPLY
   * (any bag with `unit === "kg"`), never from the carrier table — the matrix's "mixed" means
   * the carrier does both depending on route, so only this itinerary's reply can say.
   */
  override async formatLuggage() {
    const serviceResponse = bookingFlow().getServiceResponse();
    const offers = formatNdcxLuggageOffers(serviceResponse);

    bookingFlow().setAdditionnalLuggageOffers(offers);
    bookingFlow().setIsUsingWeightSystem(offers.some((offer: any) => offer.unit === "kg"));
    return offers;
  }
```

Replace the stub function with the real one:

```ts
/**
 * Selected bags/services -> the rows `/ancillaryPriceRQ` expects. Replaces the stub
 * NDCX-SEATMAP-PLAN.md Task 12 introduced so that plan could ship standalone.
 */
function collectNdcxServiceSelection(): Array<Record<string, any>> {
  return buildNdcxServicePayload(useBookingFlowStore().selectedLuggage ?? []);
}
```

Add the imports:
```ts
import {
  buildNdcxServicePayload,
  formatNdcxLuggageOffers,
} from "./ndcx/ndcxServiceSelection";
```

- [ ] **Step 6: Lint and type-check**

Run: `cd front-reservation && npm run lint:changed -- --staged`
Expected: zero oxlint errors, zero vue-tsc errors. If `LuggageOffer`'s index signature rejects
`unit`/`quantityStep`/`label`/`currency`/`requiresReprice`, confirm it still ends with
`[key: string]: any` (bookingFlowStore.ts:57) — it does, so no store change is needed.

- [ ] **Step 7: Commit**

```bash
git add app/utils/adapters/ndcx/ndcxServiceSelection.ts app/utils/adapters/AmadeusNdcxAdapter.ts tests/unit/adapters/ndcxServiceSelection.test.ts
git commit -m "feat(ndcx): fetch and format NDC[X] ancillary services (ADR-39/40/41/42)"
```

---

### Task 7: Front — the kg quantity UI

**Files:**
- Modify: `front-reservation/app/utils/adapters/AmadeusNdcxAdapter.ts` (constructor)
- Test: extend `front-reservation/tests/unit/adapters/ndcxServiceSelection.test.ts`

**Interfaces:**
- Consumes: `formatLuggage()`'s `setIsUsingWeightSystem` (Task 6).
- Produces: `uiPrefrences.usesNewLuggageInterface` / `displayBagsInKg` / `useBagsQuantity` set
  so the existing weight UI renders.

Decision #11: enable the existing path rather than defer kg. Deferring drops SQ and NP, and SQ
is one of the two carriers the capture set covers end-to-end.

- [ ] **Step 1: Write the failing test — append to `ndcxServiceSelection.test.ts`**

```ts
describe("kg vs piece UI selection", () => {
  it("a reply containing any kg bag switches the UI to the weight system", () => {
    const offers = formatNdcxLuggageOffers(serviceResponse);
    expect(offers.some((o: any) => o.unit === "kg")).toBe(true);
  });

  it("a piece-only reply stays on the piece system", () => {
    const pieceOnly = {
      ...serviceResponse,
      Offer: {
        ...serviceResponse.Offer,
        OfferItem: [
          {
            ...serviceResponse.Offer.OfferItem[0],
            classification: { type: "bag", unit: "piece", quantityStep: 1, label: "EXTRA BAG" },
            requiresReprice: false,
          },
        ],
      },
    };
    const offers = formatNdcxLuggageOffers(pieceOnly);
    expect(offers.every((o: any) => o.unit === "piece")).toBe(true);
  });

  it("carries quantityStep so the stepper knows its increment", () => {
    const offers = formatNdcxLuggageOffers(serviceResponse);
    expect((offers[0] as any).quantityStep).toBe(1);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ndcxServiceSelection.test.ts`
Expected: PASS — these assert Task 6's contract and are the regression guard for ADR-41.

- [ ] **Step 3: Declare the UI preferences**

In `AmadeusNdcxAdapter`'s constructor, after the capability flags added by seat-map plan
Task 11:

```ts
    // ADR-41: weight-based bags need a kilogram field, not a piece stepper. The per-reply
    // switch is formatLuggage()'s setIsUsingWeightSystem(); these are the coarse opt-ins that
    // make the quantity UI available at all.
    this.uiPrefrences.usesNewLuggageInterface = true;
    this.uiPrefrences.useBagsQuantity = true;
    // Not hardcoded true: a carrier selling bags by the piece must keep the piece UI, and the
    // matrix's "mixed" means the SAME carrier does both depending on route. The live value is
    // set per reply by formatLuggage(); this is only the default before the first call.
    this.uiPrefrences.displayBagsInKg = false;

    // ADR-40 / decision #2: bags are modelled; meals, lounge and sports render in the generic
    // "other service" bucket. Declaring them false hides dedicated panels that would be empty.
    this.capabilities.ancillaries.checkedLuggage = true;
    this.capabilities.ancillaries.meals = false;
    this.capabilities.ancillaries.lounge = false;
    this.capabilities.ancillaries.sports = false;
    this.capabilities.ancillaries.carryOnLuggage = false;
```

- [ ] **Step 4: Confirm the weight UI reads the store flag**

Run: `cd front-reservation && grep -rn "isUsingWeightSystem\|displayBagsInKg" app/components app/stores --include=*.vue --include=*.ts | head -20`
Expected: at least one component branching on it. If `isUsingWeightSystem` turns out to be
read **only** by a component NDC[X] does not render, note which component owns the kg field
and wire `displayBagsInKg` there instead — do not add a second flag.

- [ ] **Step 5: Lint and type-check**

Run: `cd front-reservation && npm run lint:changed -- --staged`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add app/utils/adapters/AmadeusNdcxAdapter.ts tests/unit/adapters/ndcxServiceSelection.test.ts
git commit -m "feat(ndcx): enable the weight-based luggage UI for kg bags (ADR-41)"
```

---

### Task 8: Backend — persist purchased services on the dossier

**Files:**
- Modify: `src/controllers/AMADEUS_NDCX/order.controller.js` (`handleOrderChange`, seat-map
  plan Task 9)
- Test: `src/controllers/AMADEUS_NDCX/__tests__/orderChange.persistence.test.js`

**Interfaces:**
- Consumes: `ServiceAerialService` (`src/services/service-aerial.service.js`),
  `mapNdcxOrderViewReply`'s `Order.OrderItem[]`.
- Produces: one `service_aerial` row per purchased ancillary, at cost (ADR-44).

**ADR-44 / decision #13.** Ancillaries are persisted at cost, no margin — the same thing
IBERIA and AFKL already do (`IberiaAdapter.getReshopAncillaries()` reads
`service_aerial.totalprice` straight back). Routing them through the margin engine is a pricing
change, not an integration one, and is out of scope here.

- [ ] **Step 1: Read the existing service-aerial contract**

Run: `cd api-aerial/src && grep -n "create\|bulkCreate" -B 3 -A 20 services/service-aerial.service.js | head -60`
Record the required columns (expected: `name`, `quantity`, `totalprice`, `segmentId`,
`dossierHasTravelerId`, `status`). **Use the real column names below**, not these.

- [ ] **Step 2: Write the failing test**

```js
// src/controllers/AMADEUS_NDCX/__tests__/orderChange.persistence.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildNdcxServiceRows } = require("../../../utils/AMADEUS_NDCX/orderChange.utils");

test("one row per purchased ancillary, priced at cost (ADR-44)", () => {
  const orderView = {
    Order: {
      OrderItem: [
        { OrderItemID: { _text: "OI-AIR" }, Service: [] },
        {
          OrderItemID: { _text: "OI-BAG" },
          Price: { TotalAmount: { _text: "164" }, CurCode: "CAD" },
          Service: [{ ServiceID: "1", PaxRefID: "PAX1", PaxSegmentRefID: "SEG8" }],
        },
      ],
    },
  };
  const rows = buildNdcxServiceRows(orderView, {
    AncillaryOfferIdList: [{ OfferItemID: "BAG-KG-1", PaxRefID: ["PAX1"] }],
    serviceLabels: { "BAG-KG-1": "ONE KILOGRAM BAGGAGE" },
  });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    name: "ONE KILOGRAM BAGGAGE",
    quantity: 1,
    totalprice: 164,
    currency: "CAD",
    paxRef: "PAX1",
    segmentRef: "SEG8",
    orderItemId: "OI-BAG",
  });
});

test("an air-only order view yields no service rows", () => {
  const rows = buildNdcxServiceRows(
    { Order: { OrderItem: [{ OrderItemID: { _text: "OI-AIR" } }] } },
    { AncillaryOfferIdList: [] },
  );
  assert.deepEqual(rows, []);
});

test("never throws on a malformed order view", () => {
  assert.deepEqual(buildNdcxServiceRows(null, {}), []);
  assert.deepEqual(buildNdcxServiceRows({}, { AncillaryOfferIdList: [] }), []);
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd api-aerial/src && node --test controllers/AMADEUS_NDCX/__tests__/orderChange.persistence.test.js`
Expected: FAIL, `buildNdcxServiceRows` is not exported from `orderChange.utils`.

- [ ] **Step 4: Implement — append to `orderChange.utils.js`**

```js
/**
 * Purchased ancillaries, read back off the `AMA_TravelOrderViewRS` the change/create returned,
 * in the row shape `ServiceAerialService` persists (ADR-44).
 *
 * Read from the REPLY, not from what we asked for: the host decides what it actually sold, and
 * an OrderItem that came back is the only proof a service exists. The request's
 * `AncillaryOfferIdList` is used solely to tell ancillary OrderItems from the air one and to
 * recover display labels, which the reply does not carry.
 *
 * ADR-44: `totalprice` is the host's amount, at cost — no margin. Same as IBERIA and AFKL,
 * whose `getReshopAncillaries()` reads `service_aerial.totalprice` straight back.
 */
function buildNdcxServiceRows(orderView, body = {}) {
  const orderItems = ensureArray(orderView?.Order?.OrderItem);
  if (orderItems.length === 0) return [];

  const labels = body?.serviceLabels ?? {};
  const requested = ensureArray(body?.AncillaryOfferIdList);
  if (requested.length === 0) return [];

  const rows = [];
  for (const orderItem of orderItems) {
    // The air OrderItem carries no Service block; an ancillary one always does.
    const services = ensureArray(orderItem?.Service);
    if (services.length === 0) continue;

    const amount = Number(textOf(orderItem?.Price?.TotalAmount));
    for (const service of services) {
      const paxRef = textOf(service?.PaxRefID) ?? null;
      const match =
        requested.find((item) => ensureArray(item.PaxRefID).includes(paxRef)) ?? requested[0];

      rows.push({
        name: labels[match?.OfferItemID] ?? "Service",
        quantity: 1,
        totalprice: Number.isFinite(amount) ? amount : 0,
        currency: orderItem?.Price?.CurCode ?? null,
        paxRef,
        segmentRef: textOf(service?.PaxSegmentRefID) ?? null,
        orderItemId: textOf(orderItem?.OrderItemID) ?? null,
      });
    }
  }
  return rows;
}
```

Add `buildNdcxServiceRows` to that file's `module.exports`.

- [ ] **Step 5: Call it from `handleOrderChange`**

In `order.controller.js`'s `handleOrderChange`, after the `hasOrderData` guard and before the
final `sendResponse`:

```js
  // ADR-44: persist what the host actually sold, at cost. Best-effort — a persistence failure
  // must not make a SUCCEEDED host change look failed to the agent, who would retry it and
  // buy the bag twice (NDC[X] rule 11: no duplicate bookings).
  try {
    const rows = buildNdcxServiceRows(value, req.body);
    if (rows.length) {
      await ServiceAerialService.createNdcxServices(rows, pnr.dossierId);
    }
  } catch (err) {
    this.logger.error(
      `[${this.providerName}] Travel_OrderChange succeeded but persisting services failed: ${err.message}`,
    );
  }
```

Add the imports:
```js
const {
  createNdcxOrderChangePayload,
  buildNdcxServiceRows,
} = require("../../utils/AMADEUS_NDCX/orderChange.utils");
const ServiceAerialService = require("../../services/service-aerial.service");
```

If `service-aerial.service.js` has no `createNdcxServices`, add a thin one that maps these rows
onto the real columns found in Step 1 and bulk-creates them. **Do not change existing methods**
— `service_aerial` is shared across every provider (NDCX-CONTEXT.md §3, "Shared code").

- [ ] **Step 6: Run the whole backend suite**

Run: `cd api-aerial/src && npm run test:unit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/AMADEUS_NDCX/orderChange.utils.js src/controllers/AMADEUS_NDCX/order.controller.js src/services/service-aerial.service.js src/controllers/AMADEUS_NDCX/__tests__/orderChange.persistence.test.js
git commit -m "feat(ndcx): persist purchased ancillaries as service_aerial rows at cost (ADR-44)"
```

---

## Verification before merge

Same posture as the seat-map plan: **no `Travel_ServiceList` capture exists in
`api-aerial/use cases/NDCX/`**, so every fixture is vendored. Decision #15 — ship on vendored
fixtures, close this list against a live capture before merge.

- [ ] Pre-booking service list against the AdenisPDV test office for **SQ or QF** (Altéa,
      weight-capable) and **UA or LH** (Accelya). The two IT providers normalize differently.
- [ ] **Confirm the repeating `OfferItem`** — does the host accept one per air offer item, and
      does it reject a single one when the offer prices per-PTC?
- [ ] **Confirm QF's `OwnerCode`** inside `CoreRequest/Offer/OfferItem` is genuinely required,
      and that sending it to a non-QF carrier is genuinely rejected. If it turns out to be
      harmless everywhere, simplify `buildOfferItem` and drop the capability flag.
- [ ] **Confirm ADR-43** — `Paxs/Pax` pre-booking vs `Paxs/PaxList/Pax` post-booking. This is
      two shapes for one element name and is the likeliest schema rejection.
- [ ] **Confirm the kg path end to end:** list a kg bag, reprice 10 kg, verify the reprice
      amount is the total for 10 kg (not 10× a per-kg amount already multiplied), book it, and
      confirm the EMD on `Travel_OrderRetrieve` shows 10 kg.
- [ ] Confirm the piece path on a `Piece` carrier (BR, KQ, LO, SK, TP, TU) — `Qty` is a count
      and the price scales per piece.
- [ ] Confirm **CX** genuinely refuses bags, so ADR-42's hard block matches reality rather than
      hiding a sellable product.
- [ ] Verify a post-issuance bag charges the stored card **once**, and that a retry does not
      double-charge (NDC[X] rule 11).
- [ ] Confirm `service_aerial` rows carry the host amount at cost and appear on the folder page.
- [ ] Re-run `npm run test:unit` (api-aerial/src) and
      `npm run lint:changed -- --base origin/development` (front-reservation).

## PR description must name

- **Shared-file touches:** `services/service-aerial.service.js` (new method on a table every
  provider writes to), `controllers/AMADEUS_NDCX/order.controller.js`,
  `utils/AMADEUS_NDCX/ancillaryOffer.utils.js` (new guard called on a path the seat flow also
  uses — seats never carry `unit: "kg"`, so they are unaffected, but say so).
- **Certification:** rule **Offer_07** (weight-vs-piece) is enforced by
  `assertNdcxQuantitiesResolved`, and the enforcement is client-side only — the host accepts a
  wrong quantity silently.
- **ADR-43 is unverified against a live host** and is the likeliest cause of a schema rejection
  on the first post-booking service list.
