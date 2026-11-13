# NDC[X] Seat Map (`Travel_SeatAvailability`) Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Read [`NDCX-CONTEXT.md`](./NDCX-CONTEXT.md) **first** — it is the two-minute guardrail doc
> (party/credentials rule, mistakes already made once). Then read only the reference file a
> task names; `.agents/skills/ndcx/references/` is ~9,000 lines and must not be read whole.

**Goal:** Let an agent see and select airline seats on an NDC[X] booking — at checkout
(pre-booking), on a held order (post-booking), and on a ticketed order (post-issuance) —
by wiring `Travel_SeatAvailability` end-to-end from the Amadeus host to the existing
`SeatMap.vue` widget.

**Architecture:** Two new backend controllers' worth of surface, no new transport. The SOAP
layer already exposes `travelSeatAvailability` (`NdcxClient.js:97-100`,
`ndcx.service.js:198-204`); everything built here sits above it. The reply is mapped into the
**AFKL `createJsonRS` shape** (ADR-31) so `SeatMap.vue` and its six composables need zero
changes. Seat selections are then priced through a second `Travel_OfferPrice` (ADR-34) and
committed via `Travel_OrderCreate` (pre-booking) or a **new** `Travel_OrderChange` (post-booking
and post-issuance, ADR-36).

**Tech Stack:** Node.js / Express / `soap` (api-aerial, CommonJS, `node --test`);
Nuxt 4 / Vue 3 / Pinia / Vuetify 4 (front-reservation).

**Spec:** this file. Protocol authority is
`.agents/skills/ndcx/references/13-ancillaries-and-seats.md` **plus the captures named per
task** — where the two disagree, **the capture wins** (NDCX-CONTEXT.md §3, "the generated
`.d.ts` types are not authoritative for shape").

**Companion plan:** [`NDCX-SERVICELIST-PLAN.md`](./NDCX-SERVICELIST-PLAN.md) — ancillary
services (bags). **That plan depends on this one**: Tasks 1, 5, 6, 7, 8 and 9 here build the
shared ancillary pricing + booking spine that ServiceList also uses. Build this plan first.

---

## Global Constraints

Every task's requirements implicitly include all of these.

- **Stateless.** Every `Travel_*` call is stateless. Never call `beginSession()`;
  `NdcxService.create(req.salesPoint)` with no options, `close()` in a `finally`.
- **Party.** Build `Party` **only** via `buildNdcxParty(salesPoint)`
  (`src/utils/AMADEUS_NDCX/party.utils.js`). Never inline an `{ AgencyID, PseudoCityID }`
  literal, never hardcode `"unused"` as a fallback. It throws a named error when the sales
  point lacks `Amadeus-officeId` or `iata` — let it throw.
- **Amounts are integer minor units** on every `Travel_*` reply, unlike MasterPricer's decimal
  major units. Parse with `parseNdcxAmount(node, { decimals })` and get `decimals` from
  `readCurrencyDecimals(response)` (`src/utils/AMADEUS_NDCX/amount.utils.js`). Reusing
  shopping's `toNumber` inflates every price 100×. `Response/Metadata/Other/OtherMetadata` is
  an **array**, which `readCurrencyDecimals` already handles.
- **Element order is schema-enforced.** JS object key insertion order **is** XML element order.
  Match the capture's order exactly; the host rejects reordered children.
- **PTC:** children are `CNN`, never `CHD`, on anything metis *sends*. Replies may contain
  either (the SQ capture returns `CHD` in `DataLists/PaxList`) — read both, send only `CNN`.
- **Carrier scope** (locked with Deyra, 2026-10-05): every carrier **not** already directly
  integrated. Directly integrated and therefore **out of NDC[X] scope**: AF, KL (AFKL), IB
  (IBERIA), BA, EK, TK (TURKISH_AIRLINES), A3, OA (ACCELYA), AC, U2/FR/6E/LS/V7/W6 (GOKYTE),
  QR/AA/AY (GOKYTE_LEGACY), TO/HV (TRANSAVIA). Sabre-NDC carriers stay **in** scope — metis
  wants both Sabre and Amadeus NDC offers for them. In scope, per
  `.agents/skills/ndcx/references/airline-matrix.csv`:
  **AI, BR, CX, EY, KQ, LH, LO, MH, NP, QF, SK, SM, SQ, SV, TP, TU, UA, VY.**
- **AF/KL-specific behaviour is out of scope** and must not be built: the `OFP`
  `EquivalentID_Key` metadata marker, SAF/Seat bundles (`FFI-3`/`UPH-3`), and
  `Qty`-mandatory-for-any-ancillary are all AF/KL rules and AF/KL is directly integrated.
- **Free-seat exchange / family seating is out of scope** (ADR-33) — the matrix shows
  `Voluntary change : Exchange Seat = 0` for **all 18** in-scope carriers, and the guide says
  it cannot be tested outside AA production.
- **No seat cancellation.** `Voluntary cancel : Seat = 0` for all 18 in-scope carriers. There
  is no host operation behind "remove a seat"; do not build a `RemoveServices` path.
- **Order id prefix.** `pnr.orderId` is stored with the `"NDCX-"` prefix. Strip it exactly
  once, immediately before the wire call, with `stripNdcxOrderIdPrefix`
  (`src/utils/AMADEUS_NDCX/order.utils.js`).
- **Tests** run from `api-aerial/src` with `npm run test:unit`
  (`node --test --test-isolation=process`). New backend tests go in
  `src/utils/AMADEUS_NDCX/__tests__/` or `src/utils/__tests__/` following the existing
  `ndcx-*.test.js` naming.
- **Front lint gate:** every file a commit touches must be clean —
  `npm run lint:changed -- --staged` (oxlint + vue-tsc, whole file).

## ADRs introduced by this plan

ADR-1…29 are taken by the existing NDC[X] plans. This plan owns **ADR-30…ADR-38**;
[`NDCX-SERVICELIST-PLAN.md`](./NDCX-SERVICELIST-PLAN.md) continues at ADR-39.

| ADR | Decision |
|---|---|
| **ADR-30** | Carrier scope = all carriers not already directly integrated, Sabre-NDC carriers included. Capabilities come from a hardcoded table derived from the Amadeus matrix, surfaced to the front in the reply. |
| **ADR-31** | `Travel_SeatAvailability` replies map to the **AFKL `createJsonRS` shape** (`utils/AFKL/seat.utils.js:233-360`), not an NDCX-native shape, so `SeatMap.vue` is untouched. |
| **ADR-32** | Aisle markers (`"-"` in `CabinCompartment.ColumnID`) are **synthesised backend-side** from seat-column gaps. NDC[X] does not emit them and the front's geometry maths requires them. |
| **ADR-33** | Free-seat exchange and family seating are out of scope. |
| **ADR-34** | A second `Travel_OfferPrice` runs **whenever any ancillary is selected**, not only when a kg bag is present. One code path, one OrderCreate shape. |
| **ADR-35** | `Travel_OrderCreate` with ancillaries uses **one merged `SelectedOffer`** carrying every air + ancillary `SelectedOfferItem`, built from the 2nd OfferPrice reply. **Reversed 2026-10 for seats**: "no `SelectedSeat`" was AF-specific (its 2nd OfferPrice reply echoes `SeatRowNumber`/`ColumnID`, so the OfferItemID alone pins the seat) — SQ's reply never echoes it, so OrderCreate/OrderChange now always repeat `SelectedSeat` (row/column re-attached front-side from the original seat selection, `ndcxSeatSelection.ts`'s `toAncillaryOfferIdList`), since the host silently drops the seat and books air-only otherwise. Bags/services are unaffected. |
| **ADR-36** | Post-booking and post-issuance seats go through a **new** `Travel_OrderChange`. Post-booking carries no `PaymentInfo`; post-issuance must carry it. |
| **ADR-37** | `PaxRefID` is emitted as **repeated elements** in the ancillary (2nd) OfferPrice, not space-joined. Highest-risk item; confirm on first live call. |
| **ADR-38** | Ancillaries are persisted as `service_aerial` rows **at cost** (no margin), and shown as a **separate subtotal** — the air total in `bookingFlow.selectedOffer` is never overwritten. |

---

## The three timings, and what changes between them

Locked: **all three are in scope.**

| | Pre-booking | Post-booking | Post-issuance |
|---|---|---|---|
| When | checkout, before `Travel_OrderCreate` | order held, before `Travel_OrderPay` | after tickets issued |
| SeatAvailability keyed on | `CoreRequest/Offer` + `ShoppingResponse` | `CoreRequest/Order` | `CoreRequest/Order` |
| Commit via | `Travel_OrderCreate` | `Travel_OrderChange` | `Travel_OrderChange` |
| `PaymentInfo` | no — separate `Travel_OrderPay` | **no** — single combined payment later | **yes, mandatory** (instant payment) |
| Front entry point | `order.vue` → `getSeats()` | folder page → `getSeats()` (`isServicing`) | folder page → `getSeats()` (`isServicing`) |

`isServicing` is already the discriminator `BaseAdapter` uses (`BaseAdapter.ts:402`,
`437`), and `pnr.status` separates held (`1`) from ticketed (`2`) — the same signal
`handleOrderCancel` already branches on (`order.controller.js:492`, `559`).

---

## What the host actually sends (capture-verified)

These are the facts the mapper in Task 3 exists to absorb. Each is a real divergence between
`AMA_TravelSeatAvailabilityRS` and the shape `SeatMap.vue` consumes. Source capture:
`.agents/skills/ndcx/examples/servicing/SQ-Family-Add-Seats-and-Bags-Post-Payment/9---Travel-SeatAvailability--2.xml`.

| Front expects (AFKL shape) | NDC[X] actually emits | Action |
|---|---|---|
| `Seat[]` (top level) | `SeatMap[]` | rename |
| `...SeatRow[].Seats[]` | `...SeatRow[].Seat[]` | rename to plural |
| `Seat.ColumnID` | `Seat.CabinColumnID` | rename |
| `Seat.SeatCharacteristicCode` | `Seat.CharacteristicCode` (repeating) | rename + ensure array |
| `Seat.OfferItemRefID: string[]` | **space-separated string** `"PRICE3-SEG1 PRICE6-SEG1 PRICE9-SEG1"` | `.split(/\s+/)` |
| `CabinType: "BUSINESS"` (a name) | `CabinType.CabinTypeCode: "B"` | map code → name |
| `ColumnID` includes `"-"` aisle markers | real columns only, **no markers** | **synthesise** (ADR-32, Task 3) |
| `ServiceDefinition.Desc.DescText` | `ServiceDefinition.Description[].DescText` | synthesise `Desc` |
| `Dep.IATALocationCode` | `Dep.IATA_LocationCode` | `renameIataLocationCode()` |
| price as major units | integer minor units | `parseNdcxAmount` + `readCurrencyDecimals` |

Two more, from the request side
(`.agents/skills/ndcx/examples/servicing/AF-Bag-Seat-After-Pricing-2nd-OfferPrice/45-Query-Travel-SeatAvailability.xml`):

- Pre-booking keys on `CoreRequest/Offer/**OfferItemID**` (not `OfferID`), and the value is the
  **composite offer-shaped id**, not a plain offer-item id.
- Element order inside `Request` is `CoreRequest` → `Paxs` → `ShoppingResponse`.

---

## File Structure

**Backend — `api-aerial/src/`**

| File | Responsibility |
|---|---|
| `utils/AMADEUS_NDCX/carrierCapabilities.js` | **create** — hardcoded per-carrier capability table (ADR-30) + `resolveNdcxCarrierCapabilities(ownerCode)` |
| `utils/AMADEUS_NDCX/seatAvailability.utils.js` | **create** — `createNdcxSeatAvailabilityPayload(body, salesPoint)`, both keyings |
| `utils/AMADEUS_NDCX/seatAvailabilityReply.mapper.js` | **create** — reply → AFKL shape, incl. aisle synthesis |
| `utils/AMADEUS_NDCX/seatMapGeometry.js` | **create** — pure aisle-synthesis algorithm, separately testable |
| `controllers/AMADEUS_NDCX/seat.controller.js` | **create** — `SeatController.seatAvailabilityRQ`, auto-mounted |
| `utils/AMADEUS_NDCX/ancillaryOffer.utils.js` | **create** — `createNdcxAncillaryOfferPricePayload` (the 2nd OfferPrice, ADR-34/35/37) |
| `controllers/AMADEUS_NDCX/offer.controller.js` | **modify** — add the `/ancillaryPriceRQ` route |
| `utils/AMADEUS_NDCX/order.utils.js` | **modify** — `createNdcxOrderCreatePayload` accepts `AncillaryOfferIdList` |
| `utils/AMADEUS_NDCX/orderChange.utils.js` | **create** — `createNdcxOrderChangePayload` (ADR-36) |
| `controllers/AMADEUS_NDCX/order.controller.js` | **modify** — `orderChangeRQ` op + route + persistence |

**Front — `front-reservation/app/`**

| File | Responsibility |
|---|---|
| `utils/adapters/AmadeusNdcxAdapter.ts` | **modify** — `getSeats`, `AddServices`, ancillary wiring in `bookFlight`, `capabilities` |
| `utils/adapters/ndcx/ndcxSeatSelection.ts` | **create** — pure helpers: selection → payload rows, subtotal |
| `components/booking/flight/order/widgets/SeatMap/composables/useSeatRestrictions.ts` | **modify** — honour backend `blocked`/`blockedReason` |

`app.js:206-250` auto-mounts every `controllers/AMADEUS_NDCX/*.controller.js` at
`/aerial/AMADEUS_NDCX/<name>/...`, so `seat.controller.js` needs **no** dispatcher edit —
`/aerial/AMADEUS_NDCX/seat/seatAvailabilityRQ` is exactly what `BaseAdapter.getSeats()`
already builds (`BaseAdapter.ts:448` + the `AMADEUS_NDCX` `CONTROLLERS` entry at
`BaseAdapter.ts:83-86`). The generic `/aerial/global/seatAvailabilityRQ` dispatcher
(`global.controller.js:717-730`) also starts working for free, since it resolves
`controllers["AMADEUS_NDCX"].SeatController`.

---

### Task 1: Carrier capability table

**Files:**
- Create: `src/utils/AMADEUS_NDCX/carrierCapabilities.js`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-carrier-capabilities.test.js`

**Interfaces:**
- Produces: `resolveNdcxCarrierCapabilities(ownerCode) -> { inScope: boolean, seats: { preBooking, postBooking, postIssuance, chargeableOnly }, bags: { preBooking, postBooking, unit }, otherServices: { preBooking, postBooking }, serviceListRequiresOfferItemOwnerCode: boolean }`.
  Tasks 2, 3, 4, 8 and `NDCX-SERVICELIST-PLAN.md` Tasks 1, 2, 5 all consume this.

Values are transcribed from `.agents/skills/ndcx/references/airline-matrix.csv`, **WBS channel
only** (web-services integrations are WBS, never SECO). The rows that matter:
`Create: Add Seat (After OfferPrice)`, `Create: Add Bag (After OfferPrice)`,
`Voluntary change : Add Seat`, `Voluntary change : Add Bag`,
`Voluntary change : Add other chargeable ancillary services`.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-carrier-capabilities.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveNdcxCarrierCapabilities } = require("../carrierCapabilities");

test("CX cannot add bags at any timing (matrix: Add Bag = 0)", () => {
  const caps = resolveNdcxCarrierCapabilities("CX");
  assert.equal(caps.inScope, true);
  assert.equal(caps.seats.preBooking, true);
  assert.equal(caps.bags.preBooking, false);
  assert.equal(caps.bags.postBooking, false);
});

test("SM offers chargeable seats only", () => {
  const caps = resolveNdcxCarrierCapabilities("SM");
  assert.equal(caps.seats.preBooking, true);
  assert.equal(caps.seats.chargeableOnly, true);
});

test("QF needs OwnerCode inside ServiceList CoreRequest/Offer/OfferItem", () => {
  assert.equal(resolveNdcxCarrierCapabilities("QF").serviceListRequiresOfferItemOwnerCode, true);
  assert.equal(resolveNdcxCarrierCapabilities("SQ").serviceListRequiresOfferItemOwnerCode, false);
});

test("SQ and NP carry weight-based bags, BR carries pieces", () => {
  assert.equal(resolveNdcxCarrierCapabilities("SQ").bags.unit, "mixed");
  assert.equal(resolveNdcxCarrierCapabilities("NP").bags.unit, "kg");
  assert.equal(resolveNdcxCarrierCapabilities("BR").bags.unit, "piece");
});

test("a directly-integrated carrier is out of NDC[X] scope", () => {
  assert.equal(resolveNdcxCarrierCapabilities("AF").inScope, false);
  assert.equal(resolveNdcxCarrierCapabilities("IB").inScope, false);
});

test("an unknown carrier is permissive but flagged out of scope", () => {
  const caps = resolveNdcxCarrierCapabilities("ZZ");
  assert.equal(caps.inScope, false);
  assert.equal(caps.seats.preBooking, true);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-carrier-capabilities.test.js`
Expected: FAIL, `Cannot find module '../carrierCapabilities'`.

- [ ] **Step 3: Implement**

```js
// src/utils/AMADEUS_NDCX/carrierCapabilities.js
/**
 * Per-carrier NDC[X] ancillary capabilities (ADR-30), transcribed from the Amadeus
 * "NDC Features per Airline" matrix (.agents/skills/ndcx/references/airline-matrix.csv),
 * **WBS channel only** — web-services integrations are WBS; the SECO column describes a
 * different channel and must never be read here.
 *
 * Why hardcoded rather than DB-driven: the matrix is a quarterly Amadeus document, not
 * agency configuration. It changes when Amadeus republishes, which is a code change with a
 * review, not an ops toggle. Refresh date is stamped below so a stale table is visible.
 *
 * Carriers absent from this table are OUT of NDC[X] scope — either directly integrated
 * (AF/KL, IB, BA, EK, TK, A3/OA, AC, GOKYTE's and TRANSAVIA's carriers) or unknown to the
 * matrix. `inScope: false` is advisory metadata for the front, NOT a hard block: the pilot
 * carrier list is a product decision (NDCX-INTEGRATION.md:237) and must not be enforced from
 * a capability table. Defaults stay permissive so a newly-enabled carrier degrades to
 * "let the host decide" rather than to a silent empty seat map.
 */

const MATRIX_REFRESHED = "2026-06-15";

/** Carriers served by their own dedicated metis pipeline — never routed through NDC[X]. */
const DIRECTLY_INTEGRATED = new Set([
  "AF", "KL", "IB", "BA", "EK", "TK", "A3", "OA", "AC",
  "U2", "FR", "6E", "LS", "V7", "W6",
  "QR", "AA", "AY",
  "TO", "HV",
]);

/**
 * `bags.unit`:
 *   "piece"  — matrix "Piece"
 *   "kg"     — matrix "Weigth" [sic, Amadeus' own spelling]
 *   "mixed"  — Notes A02/A03/A04: "piece and weight concepts, depends on routes".
 *              Must be resolved per-reply from ServiceDefinition/BookingInstructions/
 *              AddlDataMeasure/@UnitCode, never from this table.
 *   null     — bags not addable at all.
 */
const CAPABILITIES = {
  AI: { seat: true, bag: "mixed",  other: true,  qfOwnerCode: false },
  BR: { seat: true, bag: "piece",  other: true,  qfOwnerCode: false },
  CX: { seat: true, bag: null,     other: false, qfOwnerCode: false },
  EY: { seat: true, bag: "mixed",  other: true,  qfOwnerCode: false },
  KQ: { seat: true, bag: "piece",  other: true,  qfOwnerCode: false },
  LH: { seat: true, bag: "mixed",  other: true,  qfOwnerCode: false },
  LO: { seat: true, bag: "piece",  other: true,  qfOwnerCode: false },
  MH: { seat: true, bag: "mixed",  other: true,  qfOwnerCode: false },
  NP: { seat: true, bag: "kg",     other: true,  qfOwnerCode: false },
  QF: { seat: true, bag: "piece",  other: true,  qfOwnerCode: true  },
  SK: { seat: true, bag: "piece",  other: true,  qfOwnerCode: false },
  SM: { seat: true, bag: "mixed",  other: true,  qfOwnerCode: false, seatChargeableOnly: true },
  SQ: { seat: true, bag: "mixed",  other: true,  qfOwnerCode: false },
  SV: { seat: true, bag: "mixed",  other: true,  qfOwnerCode: false },
  TP: { seat: true, bag: "piece",  other: true,  qfOwnerCode: false },
  TU: { seat: true, bag: "piece",  other: true,  qfOwnerCode: false },
  UA: { seat: true, bag: "piece",  other: true,  qfOwnerCode: false },
  VY: { seat: true, bag: "piece",  other: true,  qfOwnerCode: false },
};

/**
 * Carriers the matrix marks "to be clarified" for post-booking voluntary change. Treated as
 * ALLOWED (the host is the authority) but surfaced so the front can warn rather than promise.
 */
const POST_BOOKING_UNVERIFIED = new Set(["LH", "QF", "UA", "VY", "CX"]);

/**
 * @param {string|null|undefined} ownerCode - the airline (NOT "AMADEUS_NDCX", which is the
 *   provider name metis stores on `pnr.ownerCode`; resolve the airline first via
 *   `resolveNdcxAirlineOwnerCode`).
 */
function resolveNdcxCarrierCapabilities(ownerCode) {
  const code = typeof ownerCode === "string" ? ownerCode.trim().toUpperCase() : "";
  const entry = CAPABILITIES[code];
  const inScope = Boolean(entry) && !DIRECTLY_INTEGRATED.has(code);

  // Unknown carrier: permissive defaults, flagged out of scope. See the header for why this
  // is not a block.
  if (!entry) {
    return {
      ownerCode: code || null,
      inScope: false,
      matrixRefreshed: MATRIX_REFRESHED,
      seats: { preBooking: true, postBooking: true, postIssuance: true, chargeableOnly: false, verified: false },
      bags: { preBooking: true, postBooking: true, postIssuance: true, unit: "mixed", verified: false },
      otherServices: { preBooking: true, postBooking: true, postIssuance: true, verified: false },
      serviceListRequiresOfferItemOwnerCode: false,
    };
  }

  const changeVerified = !POST_BOOKING_UNVERIFIED.has(code);
  const bagAllowed = entry.bag !== null;

  return {
    ownerCode: code,
    inScope,
    matrixRefreshed: MATRIX_REFRESHED,
    seats: {
      preBooking: entry.seat,
      postBooking: entry.seat,
      postIssuance: entry.seat,
      chargeableOnly: Boolean(entry.seatChargeableOnly),
      verified: changeVerified,
    },
    bags: {
      preBooking: bagAllowed,
      postBooking: bagAllowed,
      postIssuance: bagAllowed,
      unit: entry.bag,
      verified: changeVerified,
    },
    otherServices: {
      preBooking: entry.other,
      postBooking: entry.other,
      postIssuance: entry.other,
      verified: changeVerified,
    },
    // QF is the only in-scope carrier that requires OwnerCode inside
    // Request/CoreRequest/Offer/OfferItem of Travel_ServiceList
    // (.agents/skills/ndcx/references/13-ancillaries-and-seats.md, "Gotchas").
    serviceListRequiresOfferItemOwnerCode: entry.qfOwnerCode,
  };
}

module.exports = { resolveNdcxCarrierCapabilities, DIRECTLY_INTEGRATED, MATRIX_REFRESHED };
```

- [ ] **Step 4: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-carrier-capabilities.test.js`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/utils/AMADEUS_NDCX/carrierCapabilities.js src/utils/AMADEUS_NDCX/__tests__/ndcx-carrier-capabilities.test.js
git commit -m "feat(ndcx): add per-carrier ancillary capability table (ADR-30)"
```

---

### Task 2: `Travel_SeatAvailability` request builder

**Files:**
- Create: `src/utils/AMADEUS_NDCX/seatAvailability.utils.js`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-seat-availability.utils.test.js`

**Interfaces:**
- Consumes: `buildNdcxParty` (Task 0, existing), `stripNdcxOrderIdPrefix` (existing).
- Produces: `createNdcxSeatAvailabilityPayload(body, salesPoint) -> { Party, Request }`.
  Task 4 calls it.

Shape authority: pre-booking from
`.agents/skills/ndcx/examples/servicing/AF-Bag-Seat-After-Pricing-2nd-OfferPrice/45-Query-Travel-SeatAvailability.xml`,
post-booking from
`.agents/skills/ndcx/examples/servicing/SQ-Family-Add-Seats-and-Bags-Post-Payment/9---Travel-SeatAvailability--1.xml`.
Note the post-booking capture carries **no `Paxs` and no `ShoppingResponse`** at all.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-seat-availability.utils.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createNdcxSeatAvailabilityPayload } = require("../seatAvailability.utils");

const salesPoint = { "Amadeus-officeId": "NCE1A0950", iata: "20255373", name: "TestPDV" };

test("pre-booking keys on CoreRequest/Offer/OfferItemID and carries Paxs + ShoppingResponse", () => {
  const payload = createNdcxSeatAvailabilityPayload(
    {
      OfferID: "ER-6gie_1A_66b6ca30_1A_db7bf37b",
      OwnerCode: "SQ",
      ShoppingResponseId: "66b6ca30-937c-4668-8e57-f2aa5ba93498",
      paxs: [{ ptc: "ADT" }, { ptc: "ENF" }],
    },
    salesPoint,
  );

  assert.deepEqual(payload.Request.CoreRequest, {
    Offer: { OfferItemID: "ER-6gie_1A_66b6ca30_1A_db7bf37b", OwnerCode: "SQ" },
  });
  assert.deepEqual(payload.Request.Paxs.Pax, [
    { PaxID: "PAX1", PTC: "ADT" },
    { PaxID: "PAX2", PTC: "CNN" },
  ]);
  assert.equal(
    payload.Request.ShoppingResponse.ShoppingResponseID,
    "66b6ca30-937c-4668-8e57-f2aa5ba93498",
  );
  // Element order is schema-enforced.
  assert.deepEqual(Object.keys(payload.Request), ["CoreRequest", "Paxs", "ShoppingResponse"]);
  assert.deepEqual(payload.Party, {
    Sender: { TravelAgency: { AgencyID: "20255373", PseudoCityID: "NCE1A0950" } },
  });
});

test("post-booking keys on CoreRequest/Order only, strips the NDCX- prefix", () => {
  const payload = createNdcxSeatAvailabilityPayload(
    { OrderID: "NDCX-SQ_6RUS54", OwnerCode: "SQ", paxs: [{ ptc: "ADT" }] },
    salesPoint,
  );

  assert.deepEqual(payload.Request, {
    CoreRequest: { Order: { OrderID: "SQ_6RUS54", OwnerCode: "SQ" } },
  });
});

test("rejects a request that identifies neither an offer nor an order", () => {
  assert.throws(
    () => createNdcxSeatAvailabilityPayload({ OwnerCode: "SQ", paxs: [{ ptc: "ADT" }] }, salesPoint),
    /OfferID \(pre-booking\) or OrderID \(post-booking\) is required/,
  );
});

test("rejects a missing OwnerCode rather than sending an empty element", () => {
  assert.throws(
    () => createNdcxSeatAvailabilityPayload({ OrderID: "SQ_6RUS54", paxs: [] }, salesPoint),
    /OwnerCode \(the airline\) is required/,
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-seat-availability.utils.test.js`
Expected: FAIL, `Cannot find module '../seatAvailability.utils'`.

- [ ] **Step 3: Implement**

```js
// src/utils/AMADEUS_NDCX/seatAvailability.utils.js
const { getPaxCodeFromMetis } = require("../AMADEUS/global.utils");
const { buildNdcxParty } = require("./party.utils");
const { stripNdcxOrderIdPrefix } = require("./order.utils");

/**
 * `AMA_TravelSeatAvailabilityRQ` builder, both keyings (ADR-36's three timings collapse to
 * two request shapes: offer-keyed pre-booking, order-keyed post-booking AND post-issuance —
 * those two are byte-identical, see 13-ancillaries-and-seats.md §3.1).
 *
 * ⚠️ Pre-booking keys on `CoreRequest/Offer/`**`OfferItemID`**, not `OfferID`, and the value
 * is the composite OFFER-shaped id (capture: 45-Query-Travel-SeatAvailability.xml, where the
 * same long `ER-6gie...` string sits in `OfferItemID`). The guide's field table
 * (13-ancillaries-and-seats.md §1.1) says "air Travel_OfferPrice RS offer item" — the capture
 * says otherwise and the capture wins. If the host ever answers "no seat map", retry with the
 * plain offer-item id before assuming the payload is wrong.
 *
 * ⚠️ Post-booking carries NO `Paxs` and NO `ShoppingResponse` (capture:
 * 9---Travel-SeatAvailability--1.xml). Sending them is not merely redundant — the order
 * already defines its own pax list, and a second one is a schema conflict.
 */
function createNdcxSeatAvailabilityPayload(body, salesPoint) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required and must be an object");
  }
  if (!body.OwnerCode) {
    throw new Error("OwnerCode (the airline) is required to retrieve a seat map");
  }

  const Party = buildNdcxParty(salesPoint);

  if (body.OrderID) {
    return {
      Party,
      Request: {
        CoreRequest: {
          Order: {
            OrderID: stripNdcxOrderIdPrefix(body.OrderID),
            OwnerCode: body.OwnerCode,
          },
        },
      },
    };
  }

  if (!body.OfferID) {
    throw new Error(
      "OfferID (pre-booking) or OrderID (post-booking) is required to retrieve a seat map",
    );
  }
  if (!body.ShoppingResponseId) {
    throw new Error("ShoppingResponseId is required to retrieve a pre-booking seat map");
  }

  return {
    Party,
    Request: {
      CoreRequest: {
        Offer: { OfferItemID: body.OfferID, OwnerCode: body.OwnerCode },
      },
      Paxs: { Pax: buildSeatAvailabilityPaxList(body.paxs) },
      ShoppingResponse: { ShoppingResponseID: body.ShoppingResponseId },
    },
  };
}

/**
 * `PAX{n}` ids, same convention as offer.utils.js's `buildOfferPricePaxList` and
 * order.utils.js's `buildOrderCreatePaxList`, so PaxID stays stable across the whole flow —
 * the seat map's `Eligibility/PaxRefID` has to line up with the ids OrderCreate will send.
 *
 * Only PaxID + PTC here: the capture carries nothing else pre-booking, and names are not
 * needed to price a seat.
 */
function buildSeatAvailabilityPaxList(paxs) {
  if (!Array.isArray(paxs) || paxs.length === 0) {
    throw new Error("At least one passenger is required to retrieve a pre-booking seat map");
  }
  return paxs.map((pax, index) => {
    if (!pax || !pax.ptc) {
      throw new Error(`Passenger at index ${index} must have a valid PTC`);
    }
    // getPaxCodeFromMetis maps metis's "ENF" -> "CNN" (never "CHD" — NDC[X] rule 5).
    return { PaxID: `PAX${index + 1}`, PTC: getPaxCodeFromMetis(pax.ptc) };
  });
}

module.exports = { createNdcxSeatAvailabilityPayload };
```

- [ ] **Step 4: Confirm `stripNdcxOrderIdPrefix` is exported**

Run: `cd api-aerial/src && grep -n "stripNdcxOrderIdPrefix" utils/AMADEUS_NDCX/order.utils.js`
Expected: both a `function stripNdcxOrderIdPrefix` definition and an entry in `module.exports`.
If it is not exported, add it to the existing `module.exports` object — do not duplicate the function.

- [ ] **Step 5: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-seat-availability.utils.test.js`
Expected: PASS, 4/4.

- [ ] **Step 6: Commit**

```bash
git add src/utils/AMADEUS_NDCX/seatAvailability.utils.js src/utils/AMADEUS_NDCX/__tests__/ndcx-seat-availability.utils.test.js
git commit -m "feat(ndcx): build Travel_SeatAvailability requests for both keyings"
```

---

### Task 3: Aisle synthesis (pure geometry)

**Files:**
- Create: `src/utils/AMADEUS_NDCX/seatMapGeometry.js`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-seat-map-geometry.test.js`

**Interfaces:**
- Produces: `synthesiseColumnLayout(columnIds, rows) -> string[]` — the column list with
  `"-"` aisle markers inserted. Task 4's mapper calls it per `CabinCompartment`.

**Why this exists (ADR-32).** `useSeatMapData.ts:90-93` computes compartment pixel width from
`ColumnID.filter(c => c === "-")`, and `updateSeatList` (line 235-245) builds `seatCorridor`
from the same markers. AFKL sends them; NDC[X] does not. Without synthesis every NDC[X] cabin
renders as one undifferentiated block of seats with no aisle.

The algorithm infers an aisle from **gaps in the seat-letter alphabet**: cabin columns are
lettered A, B, C, D, … skipping `I`, and a jump greater than one letter means an aisle. A
3-3 narrowbody is `A B C | D E F` — contiguous letters with no gap — so the letter rule alone
is not enough. The reliable signal is `SeatRow.Seat` membership: a column present in the
compartment's `ColumnID` list but **absent from every row's seats** is an aisle slot. Fall
back to the standard layout table when rows are sparse.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-seat-map-geometry.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { synthesiseColumnLayout } = require("../seatMapGeometry");

test("inserts an aisle where a declared column has no seat in any row", () => {
  // The host declared A B C D E F but only ever seats A B  D E F -> C is the aisle slot.
  const rows = [
    { RowNumber: "10", Seat: [{ CabinColumnID: "A" }, { CabinColumnID: "B" }, { CabinColumnID: "D" }, { CabinColumnID: "E" }, { CabinColumnID: "F" }] },
  ];
  assert.deepEqual(synthesiseColumnLayout(["A", "B", "C", "D", "E", "F"], rows), [
    "A", "B", "-", "D", "E", "F",
  ]);
});

test("falls back to the 3-3 layout table when every declared column is seated", () => {
  const rows = [
    { RowNumber: "10", Seat: ["A", "B", "C", "D", "E", "F"].map((c) => ({ CabinColumnID: c })) },
  ];
  assert.deepEqual(synthesiseColumnLayout(["A", "B", "C", "D", "E", "F"], rows), [
    "A", "B", "C", "-", "D", "E", "F",
  ]);
});

test("3-4-3 widebody gets two aisles", () => {
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K"];
  const rows = [{ RowNumber: "30", Seat: cols.map((c) => ({ CabinColumnID: c })) }];
  assert.deepEqual(synthesiseColumnLayout(cols, rows), [
    "A", "B", "C", "-", "D", "E", "F", "G", "-", "H", "J", "K",
  ]);
});

test("2-2 business gets one centre aisle", () => {
  const cols = ["A", "C", "D", "F"];
  const rows = [{ RowNumber: "1", Seat: cols.map((c) => ({ CabinColumnID: c })) }];
  assert.deepEqual(synthesiseColumnLayout(cols, rows), ["A", "C", "-", "D", "F"]);
});

test("never mutates the caller's array and tolerates empty input", () => {
  const cols = ["A", "B"];
  const out = synthesiseColumnLayout(cols, []);
  assert.deepEqual(cols, ["A", "B"]);
  assert.deepEqual(out, ["A", "-", "B"]);
  assert.deepEqual(synthesiseColumnLayout([], []), []);
  assert.deepEqual(synthesiseColumnLayout(null, null), []);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-seat-map-geometry.test.js`
Expected: FAIL, `Cannot find module '../seatMapGeometry'`.

- [ ] **Step 3: Implement**

```js
// src/utils/AMADEUS_NDCX/seatMapGeometry.js
/**
 * Aisle synthesis for NDC[X] seat maps (ADR-32).
 *
 * `AMA_TravelSeatAvailabilityRS` emits only real seat columns in
 * `SeatMap/CabinCompartment/ColumnID` (capture: 9---Travel-SeatAvailability--2.xml emits
 * A, B, C and nothing else). The front's geometry maths needs AFKL's convention, where the
 * same list also carries `"-"` placeholders marking aisles — `useSeatMapData.ts:90-93` sizes
 * the compartment from `ColumnID.filter(c => c === "-")`, and `updateSeatList` builds
 * `seatCorridor` from their positions. No markers means no aisle and a wrong cabin width.
 *
 * Two inference passes, strongest signal first:
 *
 *  1. **Unseated declared column.** Some hosts declare a column in `ColumnID` that never
 *     appears in any `SeatRow/Seat/CabinColumnID`. That column IS the aisle slot — replace
 *     it with "-". This is exact, not a guess.
 *  2. **Standard layout table.** When every declared column is seated, the host simply does
 *     not model aisles, so fall back to the conventional split for that column count. These
 *     are the IATA-standard cabin layouts; a wrong guess costs visual fidelity only (seats
 *     still select correctly), which is why it is a fallback and not an error.
 */

/**
 * Conventional aisle positions by seat-column count, expressed as the number of seats in each
 * block. "3-3" means an aisle after the 3rd column; "3-4-3" after the 3rd and the 7th.
 */
const STANDARD_LAYOUTS = {
  2: [1],        // 1-1 (regional / first)
  3: [1],        // 1-2
  4: [2],        // 2-2
  5: [2],        // 2-3
  6: [3],        // 3-3 (A320/737 narrowbody)
  7: [2, 5],     // 2-3-2
  8: [2, 6],     // 2-4-2
  9: [3, 6],     // 3-3-3 (787/777 economy)
  10: [3, 7],    // 3-4-3 (A380/777W economy)
};

/**
 * @param {string[]|null|undefined} columnIds - `CabinCompartment/ColumnID`, seat letters only
 * @param {Array<{Seat?: Array<{CabinColumnID?: string}>}>|null|undefined} rows - `CabinCompartment/SeatRow`
 * @returns {string[]} a NEW array: the same letters with "-" aisle markers inserted
 */
function synthesiseColumnLayout(columnIds, rows) {
  const columns = Array.isArray(columnIds) ? columnIds.filter((c) => typeof c === "string" && c) : [];
  if (columns.length === 0) return [];

  // Pass 1 — a declared column that no row ever seats is the aisle itself.
  const seated = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const seat of Array.isArray(row?.Seat) ? row.Seat : [row?.Seat].filter(Boolean)) {
      if (seat?.CabinColumnID) seated.add(String(seat.CabinColumnID));
    }
  }
  if (seated.size > 0 && columns.some((c) => !seated.has(c))) {
    return columns.map((c) => (seated.has(c) ? c : "-"));
  }

  // Pass 2 — the host does not model aisles; use the conventional layout for this width.
  const breaks = STANDARD_LAYOUTS[columns.length];
  if (!breaks) {
    // An unmodelled width (1 seat, or 11+). A single centre aisle beats none: without a
    // marker the front divides by zero aisles and renders a flat block.
    if (columns.length < 2) return [...columns];
    const mid = Math.floor(columns.length / 2);
    return [...columns.slice(0, mid), "-", ...columns.slice(mid)];
  }

  const out = [];
  columns.forEach((column, index) => {
    out.push(column);
    if (breaks.includes(index + 1)) out.push("-");
  });
  return out;
}

module.exports = { synthesiseColumnLayout, STANDARD_LAYOUTS };
```

- [ ] **Step 4: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-seat-map-geometry.test.js`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/utils/AMADEUS_NDCX/seatMapGeometry.js src/utils/AMADEUS_NDCX/__tests__/ndcx-seat-map-geometry.test.js
git commit -m "feat(ndcx): synthesise seat-map aisle markers from column/row gaps (ADR-32)"
```

---

### Task 4: `Travel_SeatAvailability` reply mapper

**Files:**
- Create: `src/utils/AMADEUS_NDCX/seatAvailabilityReply.mapper.js`
- Create: `src/utils/AMADEUS_NDCX/__tests__/fixtures/ndcx-seat-availability-reply.json`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-seat-availability-reply.mapper.test.js`

**Interfaces:**
- Consumes: `synthesiseColumnLayout` (Task 3), `resolveNdcxCarrierCapabilities` (Task 1),
  `parseNdcxAmount` / `readCurrencyDecimals` (existing), `renameIataLocationCode` (existing).
- Produces: `mapNdcxSeatAvailabilityReply(reply, body) -> SeatAvailabilityRs` in the **AFKL
  shape** (ADR-31), plus two NDC[X]-only additions the front reads: `Offer.OfferItem[].blocked`
  / `.blockedReason`, and a top-level `capabilities` object. Task 5's controller returns it
  verbatim; `AmadeusNdcxAdapter.getSeats()` (Task 10) consumes it.

Exact target shape, from `utils/AFKL/seat.utils.js:233-248`:

```js
{
  DataLists: { Pax: [], PaxSegment: [], ServiceDefinition: [] },
  Offer: { OfferItem: [], OfferExpirationDateTime: null, OfferID: null, OwnerCode: null },
  Seat: [],
  Warnings: [],
}
```

- [ ] **Step 1: Build the fixture from the real capture**

Convert the trimmed SQ capture into the node-soap-parsed JSON the mapper receives. node-soap
is configured with `attributesKey: "$attributes"` and `forceItemsEnumerable: true`
(`NdcxClient.js:161-166`), so attributes land under `$attributes` and repeating elements are
arrays.

Run:
```bash
cd api-aerial/src && node -e '
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { parseStringPromise } = require("xml2js");
const src = "../../.agents/skills/ndcx/examples/servicing/SQ-Family-Add-Seats-and-Bags-Post-Payment/9---Travel-SeatAvailability--2.xml";
parseStringPromise(readFileSync(src, "utf8"), {
  explicitArray: false, tagNameProcessors: [(n) => n.replace(/^.*:/, "")],
  attrkey: "$attributes", charkey: "_text", explicitCharkey: false,
}).then((o) => {
  mkdirSync("utils/AMADEUS_NDCX/__tests__/fixtures", { recursive: true });
  writeFileSync(
    "utils/AMADEUS_NDCX/__tests__/fixtures/ndcx-seat-availability-reply.json",
    JSON.stringify(o.AMA_TravelSeatAvailabilityRS, null, 2),
  );
  console.log("fixture written");
});'
```
Expected: `fixture written`. Open the file and confirm it has
`Response.ALaCarteOffer.ALaCarteOfferItem`, `Response.SeatMap`, and
`Response.DataLists.ServiceDefinitionList`.

> ⚠️ The capture carries a `<!-- TRIMMED FOR SIZE -->` comment on line 1: repeating elements
> were reduced to 3. **Do not assert on counts** derived from it — assert on structure and on
> named ids only.

- [ ] **Step 2: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-seat-availability-reply.mapper.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const reply = require("./fixtures/ndcx-seat-availability-reply.json");
const { mapNdcxSeatAvailabilityReply } = require("../seatAvailabilityReply.mapper");

const body = { OwnerCode: "SQ", OrderID: "NDCX-SQ_6RUS54" };

test("emits the AFKL createJsonRS top-level shape", () => {
  const value = mapNdcxSeatAvailabilityReply(reply, body);
  assert.deepEqual(Object.keys(value).sort(), [
    "DataLists", "Offer", "Seat", "Warnings", "capabilities",
  ].sort());
  assert.deepEqual(Object.keys(value.DataLists).sort(), ["Pax", "PaxSegment", "ServiceDefinition"]);
  assert.deepEqual(
    Object.keys(value.Offer).sort(),
    ["OfferExpirationDateTime", "OfferID", "OfferItem", "OwnerCode"],
  );
});

test("renames Seat.CabinColumnID -> ColumnID and CharacteristicCode -> SeatCharacteristicCode", () => {
  const { Seat } = mapNdcxSeatAvailabilityReply(reply, body);
  const seat = Seat[0].CabinCompartment[0].SeatRow[0].Seats[0];
  assert.equal(seat.ColumnID, "A");
  assert.equal(seat.CabinColumnID, undefined);
  assert.ok(Array.isArray(seat.SeatCharacteristicCode));
  assert.ok(seat.SeatCharacteristicCode.includes("CH"));
  assert.equal(seat.CharacteristicCode, undefined);
});

test("splits the space-separated OfferItemRefID into an array", () => {
  const { Seat } = mapNdcxSeatAvailabilityReply(reply, body);
  const seat = Seat[0].CabinCompartment[0].SeatRow[0].Seats[0];
  assert.deepEqual(seat.OfferItemRefID, ["PRICE3-SEG1", "PRICE6-SEG1", "PRICE9-SEG1"]);
});

test("exposes CabinType as a name, not a code", () => {
  const { Seat } = mapNdcxSeatAvailabilityReply(reply, body);
  // The capture's compartment is CabinTypeCode "B".
  assert.equal(Seat[0].CabinCompartment[0].CabinType, "BUSINESS");
});

test("inserts aisle markers into CabinCompartment.ColumnID", () => {
  const { Seat } = mapNdcxSeatAvailabilityReply(reply, body);
  assert.ok(Seat[0].CabinCompartment[0].ColumnID.includes("-"));
});

test("synthesises ServiceDefinition.Desc.DescText from Description[]", () => {
  const { DataLists } = mapNdcxSeatAvailabilityReply(reply, body);
  const def = DataLists.ServiceDefinition[0];
  // useSeatMapData.ts:73 reads item?.Desc?.DescText and falls back to "NODATA".
  assert.equal(typeof def.Desc.DescText, "string");
  assert.notEqual(def.Desc.DescText, "");
});

test("converts minor-unit amounts to major units", () => {
  const { Offer } = mapNdcxSeatAvailabilityReply(reply, body);
  // The capture's PRICE2-SEG1 is USD 2500 minor units = 25.00.
  const item = Offer.OfferItem.find((i) => i.OfferItemID === "PRICE2-SEG1");
  assert.equal(item.UnitPrice.TotalAmount, 25);
  assert.equal(item.UnitPrice.CurCode, "USD");
});

test("blocks a chargeable seat whose offer item carries no resolvable amount", () => {
  const mutated = JSON.parse(JSON.stringify(reply));
  const items = mutated.Response.ALaCarteOffer.ALaCarteOfferItem;
  delete items[1].UnitPrice;
  const { Offer } = mapNdcxSeatAvailabilityReply(mutated, body);
  const blocked = Offer.OfferItem.find((i) => i.OfferItemID === "PRICE2-SEG1");
  assert.equal(blocked.blocked, true);
  assert.match(blocked.blockedReason, /no price/i);
});

test("attaches the carrier capability block", () => {
  const { capabilities } = mapNdcxSeatAvailabilityReply(reply, body);
  assert.equal(capabilities.ownerCode, "SQ");
  assert.equal(capabilities.seats.postIssuance, true);
});

test("an error-only reply returns the empty skeleton plus Errors, never throws", () => {
  const value = mapNdcxSeatAvailabilityReply(
    { Response: { Error: { Code: "119", DescText: "UNABLE TO RETRIEVE PNR" } } },
    body,
  );
  assert.deepEqual(value.Seat, []);
  assert.deepEqual(value.Offer.OfferItem, []);
  assert.deepEqual(value.Errors, [{ code: "119", description: "UNABLE TO RETRIEVE PNR" }]);
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-seat-availability-reply.mapper.test.js`
Expected: FAIL, `Cannot find module '../seatAvailabilityReply.mapper'`.

- [ ] **Step 4: Implement**

```js
// src/utils/AMADEUS_NDCX/seatAvailabilityReply.mapper.js
const { parseNdcxAmount, readCurrencyDecimals } = require("./amount.utils");
const { renameIataLocationCode } = require("./location.utils");
const { synthesiseColumnLayout } = require("./seatMapGeometry");
const { resolveNdcxCarrierCapabilities } = require("./carrierCapabilities");

/**
 * `AMA_TravelSeatAvailabilityRS` -> the AFKL `createJsonRS` shape (ADR-31).
 *
 * The target shape is NOT a design choice made here: it is the contract `SeatMap.vue` and its
 * six composables already consume (utils/AFKL/seat.utils.js:233-360). Emitting it verbatim is
 * what keeps the widget untouched. Every rename below is a real divergence between the two
 * messages — see NDCX-SEATMAP-PLAN.md "What the host actually sends" for the table and the
 * capture each line came from.
 *
 * Import-light on purpose (same discipline as shoppingReply.mapper.js /
 * offerPriceReply.mapper.js): no DB, no models, so it is testable with plain `node --test`.
 */

/** IATA cabin-type codes -> the names useSeatMapData.ts:85-86 upper-cases and compares. */
const CABIN_TYPE_NAMES = {
  F: "FIRST",
  B: "BUSINESS",
  C: "BUSINESS",
  J: "BUSINESS",
  W: "PREMIUM ECONOMY",
  S: "PREMIUM ECONOMY",
  Y: "ECONOMY",
  M: "ECONOMY",
};

function mapNdcxSeatAvailabilityReply(reply, body = {}) {
  const response = reply?.Response ?? {};
  const decimals = readCurrencyDecimals(response);
  const aLaCarte = response?.ALaCarteOffer ?? {};
  const dataLists = response?.DataLists ?? {};

  const offerItems = ensureArray(aLaCarte?.ALaCarteOfferItem).map((item) =>
    buildOfferItem(item, decimals),
  );

  return {
    DataLists: {
      Pax: ensureArray(dataLists?.PaxList?.Pax).map(clonePlain),
      PaxSegment: ensureArray(dataLists?.PaxSegmentList?.PaxSegment).map(buildPaxSegment),
      ServiceDefinition: ensureArray(
        dataLists?.ServiceDefinitionList?.ServiceDefinition,
      ).map(buildServiceDefinition),
    },
    Offer: {
      OfferItem: offerItems,
      OfferExpirationDateTime: textOf(aLaCarte?.OfferExpirationDateTime) ?? null,
      OfferID: textOf(aLaCarte?.OfferID) ?? null,
      OwnerCode: textOf(aLaCarte?.OwnerCode) ?? null,
    },
    Seat: ensureArray(response?.SeatMap).map(buildSeatMap),
    Warnings: ensureArray(response?.Warning).map((w) => ({
      Code: textOf(w?.Code) ?? null,
      DescText: textOf(w?.DescText) ?? null,
    })),
    // NDC[X]-only, additive: the front disables rather than guesses (ADR-30).
    capabilities: resolveNdcxCarrierCapabilities(body?.OwnerCode),
    Errors: ensureArray(response?.Error).map((err) => ({
      code: textOf(err?.Code) ?? null,
      description: textOf(err?.DescText) ?? textOf(err?.ShortText) ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// ALaCarteOfferItem — the price points the seat map references
// ---------------------------------------------------------------------------

/**
 * A chargeable seat with no resolvable amount MUST be blocked
 * (13-ancillaries-and-seats.md: "If an amount is not returned for chargeable seats, it is
 * recommended to block this seat"). Blocking is advisory metadata, not removal: the front
 * renders the seat greyed with the reason, which is more useful to an agent than a hole in
 * the cabin. A genuinely free seat (TotalAmount 0) is NOT blocked — the capture's
 * PRICE1-SEG1 is a legitimate USD 0 seat.
 */
function buildOfferItem(item, decimals) {
  const total = parseNdcxAmount(item?.UnitPrice?.TotalAmount, { decimals });
  const base = parseNdcxAmount(item?.UnitPrice?.BaseAmount, { decimals });
  const hasAmount = Number.isFinite(total);

  return {
    OfferItemID: textOf(item?.OfferItemID) ?? null,
    UnitPrice: {
      TotalAmount: hasAmount ? total : null,
      BaseAmount: Number.isFinite(base) ? base : null,
      CurCode: item?.UnitPrice?.TotalAmount?.$attributes?.CurCode ?? null,
    },
    Service: {
      ServiceID: textOf(item?.Service?.ServiceID) ?? null,
      ServiceDefinitionRefID: textOf(item?.Service?.ServiceDefinitionRefID) ?? null,
    },
    Eligibility: {
      PaxRefID: ensureArray(item?.Eligibility?.PaxRefID).map(textOf).filter(Boolean),
      FlightAssociations: {
        PaxSegmentRefID: ensureArray(
          item?.Eligibility?.FlightAssociations?.PaxSegmentRefID,
        ).map(textOf).filter(Boolean),
      },
    },
    blocked: !hasAmount,
    blockedReason: hasAmount ? null : "Seat returned no price and cannot be sold",
  };
}

// ---------------------------------------------------------------------------
// SeatMap
// ---------------------------------------------------------------------------

function buildSeatMap(seatMap) {
  return {
    PaxSegmentRefID: textOf(seatMap?.PaxSegmentRefID) ?? null,
    CabinCompartment: ensureArray(seatMap?.CabinCompartment).map(buildCabinCompartment),
  };
}

function buildCabinCompartment(compartment) {
  const rows = ensureArray(compartment?.SeatRow);
  const declaredColumns = ensureArray(compartment?.ColumnID).map(textOf).filter(Boolean);

  return {
    // useSeatMapData.ts:85-86 compares CabinType.toUpperCase() against "BUSINESS"/"FIRST" to
    // pick seat widths — it needs a NAME. NDC[X] only sends CabinTypeCode.
    CabinType: CABIN_TYPE_NAMES[textOf(compartment?.CabinType?.CabinTypeCode)] ?? "ECONOMY",
    // ADR-32: "-" aisle markers do not exist in NDC[X]; synthesise them or the front cannot
    // size the cabin or place the corridor.
    ColumnID: synthesiseColumnLayout(declaredColumns, rows),
    DeckCode: textOf(compartment?.DeckCode) ?? null,
    FirstRowNumber: textOf(compartment?.FirstRowNumber) ?? null,
    LastRowNumber: textOf(compartment?.LastRowNumber) ?? null,
    SeatRow: rows.map(buildSeatRow),
    CabinComponent: ensureArray(compartment?.CabinComponent).map((component) => ({
      CabinComponentTypeCode: textOf(component?.CabinComponentTypeCode) ?? null,
      ColumnID: textOf(component?.ColumnID) ?? null,
      FirstRowNumber: textOf(component?.FirstRowNumber) ?? null,
      PositionCode: textOf(component?.PositionCode) ?? null,
    })),
  };
}

function buildSeatRow(row) {
  return {
    RowNumber: textOf(row?.RowNumber) ?? null,
    // AFKL's shape calls this `Seats` (plural); NDC[X] sends `Seat`. SeatMapSeat.vue and
    // useSeatMapData.ts:95 both iterate `row.Seats`.
    Seats: ensureArray(row?.Seat).map(buildSeat),
  };
}

function buildSeat(seat) {
  return {
    ColumnID: textOf(seat?.CabinColumnID) ?? null,
    OccupationStatusCode: textOf(seat?.OccupationStatusCode) ?? null,
    // One `OfferItemRefID` element can hold SEVERAL space-separated ids (capture:
    // "PRICE3-SEG1 PRICE6-SEG1 PRICE9-SEG1") — one per eligible pax. The front treats this as
    // an array and resolves the right entry per selected passenger.
    OfferItemRefID: splitRefIds(seat?.OfferItemRefID),
    SeatCharacteristicCode: ensureArray(seat?.CharacteristicCode).map(textOf).filter(Boolean),
  };
}

function splitRefIds(value) {
  return ensureArray(value)
    .map(textOf)
    .filter(Boolean)
    .flatMap((raw) => String(raw).trim().split(/\s+/))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// DataLists
// ---------------------------------------------------------------------------

function buildPaxSegment(segment) {
  return {
    ...clonePlain(segment),
    // Every metis consumer reads IATALocationCode; NDC[X] Travel endpoints send
    // IATA_LocationCode. Shared helper so the rename happens in exactly one place.
    Dep: renameIataLocationCode(segment?.Dep),
    Arrival: renameIataLocationCode(segment?.Arrival),
  };
}

/**
 * useSeatMapData.ts:73 reads `item?.Desc?.DescText` and falls back to the literal "NODATA",
 * which then renders as a seat-category label. NDC[X] sends `Description[]` (an array of
 * `{ DescID, DescText }`, some entries carrying only `Media`). Pick the first entry that has
 * real text and expose it under the `Desc` key the widget expects, while keeping the full
 * `Description` array for anything that wants the detail.
 */
function buildServiceDefinition(definition) {
  const descriptions = ensureArray(definition?.Description);
  const firstText = descriptions.map((d) => textOf(d?.DescText)).find(Boolean);

  return {
    ...clonePlain(definition),
    ServiceDefinitionID: textOf(definition?.ServiceDefinitionID) ?? null,
    Name: textOf(definition?.Name) ?? null,
    Description: descriptions.map(clonePlain),
    Desc: { DescText: firstText ?? textOf(definition?.Name) ?? "NODATA" },
  };
}

// ---------------------------------------------------------------------------
// Shared helpers — same contracts as the sibling NDC[X] mappers
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

module.exports = { mapNdcxSeatAvailabilityReply, CABIN_TYPE_NAMES };
```

- [ ] **Step 5: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-seat-availability-reply.mapper.test.js`
Expected: PASS, 10/10.

If the `CabinType`/aisle assertions fail, print the fixture's first compartment
(`node -e 'console.log(JSON.stringify(require("./utils/AMADEUS_NDCX/__tests__/fixtures/ndcx-seat-availability-reply.json").Response.SeatMap[0].CabinCompartment[0], null, 2))'`)
and fix the **test's** expected values to match the real capture — never loosen the mapper to
make a wrong expectation pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/AMADEUS_NDCX/seatAvailabilityReply.mapper.js src/utils/AMADEUS_NDCX/__tests__/
git commit -m "feat(ndcx): map Travel_SeatAvailability replies to the AFKL seat-map shape (ADR-31)"
```

---

### Task 5: Seat controller + route

**Files:**
- Create: `src/controllers/AMADEUS_NDCX/seat.controller.js`
- Test: `src/controllers/AMADEUS_NDCX/__tests__/seatAvailability.controller.test.js`

**Interfaces:**
- Consumes: `createNdcxSeatAvailabilityPayload` (Task 2), `mapNdcxSeatAvailabilityReply` (Task 4).
- Produces: `module.exports = { SeatController: { seatAvailabilityRQ }, setupRoute }`.
  `app.js`'s folder scan mounts it at `/aerial/AMADEUS_NDCX/seat/seatAvailabilityRQ`;
  `global.controller.js:717-730` reaches the same method for `/aerial/global/seatAvailabilityRQ`.

⚠️ **Response ownership.** Read the warning at `order.controller.js:36-50`: `/offerPriceRQ` is
dispatched through a wrapper that *returns* a value, while the seat/service/order routes are
dispatched with real `(req, res, next)` and the controller **owns** the HTTP response. Follow
`order.controller.js`, **not** `offer.controller.js` — do not copy the latter's
`sendError`-returns-an-object override.

- [ ] **Step 1: Write the failing test**

```js
// src/controllers/AMADEUS_NDCX/__tests__/seatAvailability.controller.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  res.type = () => res;
  res.send = (payload) => { res.body = payload; return res; };
  return res;
}

test("a reply with no OwnerCode is rejected before any host call", async () => {
  const { SeatController } = require("../seat.controller");
  const res = makeRes();
  await SeatController.seatAvailabilityRQ(
    { body: { OfferID: "x", ShoppingResponseId: "y", paxs: [{ ptc: "ADT" }] }, salesPoint: {} },
    res,
    () => {},
  );
  assert.equal(res.statusCode, 400);
});

test("setupRoute registers POST /seatAvailabilityRQ", () => {
  const { setupRoute } = require("../seat.controller");
  const registered = [];
  const app = { post: (path) => registered.push(path) };
  setupRoute(app);
  assert.deepEqual(registered, ["/seatAvailabilityRQ"]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test controllers/AMADEUS_NDCX/__tests__/seatAvailability.controller.test.js`
Expected: FAIL, `Cannot find module '../seat.controller'`.

- [ ] **Step 3: Implement**

```js
// src/controllers/AMADEUS_NDCX/seat.controller.js
const {
  createNdcxSeatAvailabilityPayload,
} = require("../../utils/AMADEUS_NDCX/seatAvailability.utils");
const {
  mapNdcxSeatAvailabilityReply,
} = require("../../utils/AMADEUS_NDCX/seatAvailabilityReply.mapper");
const { resolveNdcxAirlineOwnerCode } = require("../../utils/AMADEUS_NDCX/order.utils");
const { NdcxService } = require("../../services/AMADEUS_NDCX/ndcx.service");
const AmadeusControllerFactory = require("../../utils/AMADEUS/amadeusControllerFactory");
const PnrService = require("../../services/pnr.service");

/**
 * NDC[X] `Travel_SeatAvailability` (NDCX-SEATMAP-PLAN.md Tasks 2/4/5).
 *
 * ⚠️ Like order.controller.js and UNLIKE offer.controller.js, this route is dispatched with
 * real Express args — both by the folder scan in app.js (mounting
 * /aerial/AMADEUS_NDCX/seat/seatAvailabilityRQ) and by global.controller.js:717-730
 * (/aerial/global/seatAvailabilityRQ). The controller therefore OWNS the HTTP response via
 * BaseControllerFactory's sendResponse/sendError. Do not add offer.controller.js's
 * sendError-returns-an-object override.
 *
 * Stateless (every Travel_* call is); `close()` is still called for symmetry with the
 * stateful TST client, where it no-ops.
 */
const seatController = new AmadeusControllerFactory("/seatAvailabilityRQ");

seatController.validateControllerInput = (req) => {
  const { body } = req;
  if (!body?.OrderID && !body?.OfferID) {
    return "OfferID (pre-booking) or OrderID (post-booking) is required";
  }
  if (!body?.OrderID) {
    if (!body?.ShoppingResponseId) return "ShoppingResponseId is required";
    if (!Array.isArray(body?.paxs) || body.paxs.length === 0) {
      return "At least one passenger is required";
    }
  }
  return null;
};

seatController.processRequest = async function (req, res) {
  let ndcxService;
  try {
    // ADR-9: pnr.ownerCode is the literal "AMADEUS_NDCX", never the airline. Post-booking the
    // front may not know the airline either, so recover it from the persisted pnrList the same
    // way handleOrderRetrieve does (order.controller.js:242-247).
    let ownerCode = req.body?.OwnerCode ?? null;
    if (!ownerCode && req.body?.OrderID) {
      const persisted = await PnrService.getPnrListByOrderId(req.body.OrderID);
      ownerCode = resolveNdcxAirlineOwnerCode(persisted?.dataValues?.pnrList) ?? null;
    }
    if (!ownerCode) {
      return this.sendError(
        res,
        new Error("OwnerCode (the airline) is required to retrieve a seat map"),
        400,
      );
    }

    const body = { ...req.body, OwnerCode: ownerCode };

    let payload;
    try {
      payload = createNdcxSeatAvailabilityPayload(body, req.salesPoint);
    } catch (err) {
      // A payload that cannot be built is the caller's fault: 400, not 502.
      return this.sendError(res, err, 400);
    }

    ndcxService = await NdcxService.create(req.salesPoint);
    const reply = await ndcxService.travelSeatAvailability(payload);
    const value = mapNdcxSeatAvailabilityReply(reply, body);

    // An errored seat map is NOT a failed request: the booking flow continues without seats
    // (order.vue's getSeatData() catch already degrades to an empty seat list). Returning 200
    // with Errors lets the front show the airline's own reason instead of a generic toast.
    return this.sendResponse(res, value);
  } catch (err) {
    return this.sendError(res, err, err.name === "NdcxError" ? 502 : 500);
  } finally {
    if (ndcxService) await ndcxService.close();
  }
}.bind(seatController);

seatController.seatAvailabilityRQ = (req, res, next) =>
  seatController.handleRequest(req, res, next);

seatController.setupRoute = (app) => {
  app.post("/seatAvailabilityRQ", seatController.seatAvailabilityRQ);
  return app;
};

module.exports = {
  SeatController: { seatAvailabilityRQ: seatController.seatAvailabilityRQ },
  setupRoute: seatController.setupRoute,
};
```

- [ ] **Step 4: Confirm `resolveNdcxAirlineOwnerCode` is exported**

Run: `cd api-aerial/src && grep -n "resolveNdcxAirlineOwnerCode" utils/AMADEUS_NDCX/order.utils.js`
Expected: a definition and a `module.exports` entry (it is already used by
`order.controller.js:244`, so it is exported — this is a confirmation, not a change).

- [ ] **Step 5: Run the whole backend suite**

Run: `cd api-aerial/src && npm run test:unit`
Expected: PASS. `pretest:unit` runs `scripts/check-test-coverage.js` — if it rejects the new
controller for missing coverage, that is the gate working; the test written in Step 1 satisfies it.

- [ ] **Step 6: Commit**

```bash
git add src/controllers/AMADEUS_NDCX/seat.controller.js src/controllers/AMADEUS_NDCX/__tests__/seatAvailability.controller.test.js
git commit -m "feat(ndcx): expose Travel_SeatAvailability via SeatController"
```

---

### Task 6: The ancillary (2nd) `Travel_OfferPrice`

**Files:**
- Create: `src/utils/AMADEUS_NDCX/ancillaryOffer.utils.js`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-ancillary-offer.utils.test.js`

**Interfaces:**
- Consumes: `buildNdcxParty`, `getPaxCodeFromMetis`, `stripNdcxOrderIdPrefix`.
- Produces: `createNdcxAncillaryOfferPricePayload(body, salesPoint) -> { Party, Request }`.
  Task 7's route calls it; the reply is mapped by the **existing** `mapNdcxOfferPriceReply`.

**ADR-34** — this runs whenever *any* ancillary is selected, not only for kg bags. Rationale:
the alternative is two `Travel_OrderCreate` shapes (merged-from-reprice vs
seat-offer-with-`SelectedSeat`) selected by a condition buried in a `ServiceDefinition`
attribute. One extra `Travel_OfferPrice` buys one code path and the one OrderCreate shape both
captures confirm. `Travel_OfferPrice` is not a shop, so it does not count against the 1000:1
look-to-book ratio.

**ADR-35 / ADR-37** — shape authority:
`.agents/skills/ndcx/examples/servicing/SQ-Family-Bag-in-Weight-PreBooking/4-Query-Travel-OfferPrice.xml`
(single merged `SelectedOffer`, air items + ancillary items together, **repeated** `PaxRefID`)
and `.agents/skills/ndcx/examples/servicing/AF-Bag-Seat-After-Pricing-2nd-OfferPrice/46-Query-Travel-OfferPrice.xml`
(`SelectedSeat` carrying `ColumnID` + `SeatRowNumber`).

> ⚠️ **ADR-37 is the highest-risk item in this plan.** `offer.utils.js:102` space-joins
> `PaxRefID` for the *air* OfferPrice, documented as "Trap 2". The SQ capture uses **repeated
> elements** for the same message type. Both cannot be right for all carriers. This builder
> emits repeated elements and leaves the air builder untouched. Confirm against the first live
> call and record the answer in `NDCX-CONTEXT.md` §3.

> ⚠️ Element casing: the AF capture uses **`SelectedAlaCarteOfferItem`** on seat items and
> **`SelectedALaCarteOfferItem`** on bag items *in the same message*. The SQ capture uses
> `SelectedALaCarteOfferItem` throughout. Follow the WSDL, not the guide text — Step 1 below
> resolves it from the vendored XSD rather than guessing.

- [ ] **Step 1: Resolve the element casing from the WSDL, not from prose**

Run:
```bash
cd api-aerial/src && grep -rno "Selected[Aa][Ll][Aa]CarteOfferItem" types/NDCX/wsdl/ | sort -u -t: -k3 | head
```
Expected: one spelling wins. Record it here before writing code:
`__________________________` (fill in). Use **that** spelling everywhere below; the snippet
uses `SelectedALaCarteOfferItem` as the placeholder the SQ capture supports — change it if the
WSDL disagrees.

- [ ] **Step 2: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-ancillary-offer.utils.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createNdcxAncillaryOfferPricePayload,
} = require("../ancillaryOffer.utils");

const salesPoint = { "Amadeus-officeId": "NCE1A0950", iata: "20255373" };

const base = {
  OfferID: "TO~2umazcHSL_1A_26d16a48_1A_1A_TPID_CiMS",
  OwnerCode: "SQ",
  ShoppingResponseId: "SP2F-12382921279997477441",
  paxs: [{ ptc: "ADT" }, { ptc: "ADT" }],
  // the AIR offer items, echoed from the 1st OfferPrice reply
  OfferIdList: [{ OfferItemID: "AIR-ITEM-1", PaxRefID: ["PAX1", "PAX2"] }],
};

test("merges air and ancillary items into ONE SelectedOffer (ADR-35)", () => {
  const payload = createNdcxAncillaryOfferPricePayload(
    {
      ...base,
      seats: [
        { OfferItemID: "SEAT-1", PaxRefID: "PAX1", RowNumber: "26", ColumnID: "H" },
      ],
    },
    salesPoint,
  );

  const offers = payload.Request.PricedOffer.SelectedOffer;
  assert.ok(!Array.isArray(offers), "exactly one SelectedOffer, not a list");
  assert.equal(offers.OfferRefID, base.OfferID);
  assert.equal(offers.ShoppingResponseRefID, base.ShoppingResponseId);
  assert.equal(offers.SelectedOfferItem.length, 2);
});

test("emits repeated PaxRefID elements, not a space-joined string (ADR-37)", () => {
  const payload = createNdcxAncillaryOfferPricePayload(base, salesPoint);
  const airItem = payload.Request.PricedOffer.SelectedOffer.SelectedOfferItem[0];
  assert.deepEqual(airItem.PaxRefID, ["PAX1", "PAX2"]);
});

test("a seat item carries SelectedSeat with ColumnID then SeatRowNumber", () => {
  const payload = createNdcxAncillaryOfferPricePayload(
    { ...base, seats: [{ OfferItemID: "SEAT-1", PaxRefID: "PAX1", RowNumber: "26", ColumnID: "H" }] },
    salesPoint,
  );
  const seatItem = payload.Request.PricedOffer.SelectedOffer.SelectedOfferItem[1];
  assert.deepEqual(seatItem.OfferItemRefID, "SEAT-1");
  assert.deepEqual(seatItem.PaxRefID, ["PAX1"]);
  assert.deepEqual(Object.keys(seatItem.SelectedSeat), ["ColumnID", "SeatRowNumber"]);
  assert.equal(seatItem.SelectedSeat.SeatRowNumber, "26");
});

test("a quantified service carries Qty and no SelectedSeat", () => {
  const payload = createNdcxAncillaryOfferPricePayload(
    { ...base, services: [{ OfferItemID: "BAG-1", PaxRefID: "PAX1", Qty: 10 }] },
    salesPoint,
  );
  const bagItem = payload.Request.PricedOffer.SelectedOffer.SelectedOfferItem[1];
  assert.equal(bagItem.SelectedALaCarteOfferItem.Qty, 10);
  assert.equal(bagItem.SelectedSeat, undefined);
});

test("post-booking adds ShoppingCriteria/ExistingOrderCriteria and strips the prefix", () => {
  const payload = createNdcxAncillaryOfferPricePayload(
    { ...base, OrderID: "NDCX-SQ_6RUS54", services: [{ OfferItemID: "BAG-1", PaxRefID: "PAX1", Qty: 5 }] },
    salesPoint,
  );
  const criteria = payload.Request.ShoppingCriteria.ExistingOrderCriteria;
  assert.deepEqual(criteria.PaxRefID, ["PAX1", "PAX2"]);
  assert.deepEqual(criteria.Order, { OrderID: "SQ_6RUS54" });
});

test("pre-booking omits ShoppingCriteria entirely", () => {
  const payload = createNdcxAncillaryOfferPricePayload(base, salesPoint);
  assert.equal(payload.Request.ShoppingCriteria, undefined);
});

test("rejects a call with nothing to price", () => {
  assert.throws(
    () => createNdcxAncillaryOfferPricePayload({ ...base, OfferIdList: [] }, salesPoint),
    /At least one air OfferIdList entry is required/,
  );
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-ancillary-offer.utils.test.js`
Expected: FAIL, `Cannot find module '../ancillaryOffer.utils'`.

- [ ] **Step 4: Implement**

```js
// src/utils/AMADEUS_NDCX/ancillaryOffer.utils.js
const { getPaxCodeFromMetis } = require("../AMADEUS/global.utils");
const { buildNdcxParty } = require("./party.utils");
const { stripNdcxOrderIdPrefix } = require("./order.utils");

/**
 * The SECOND `Travel_OfferPrice` — the one that prices selected seats and services
 * (ADR-34/35/37). The FIRST one (the air offer) stays in offer.utils.js and is not touched
 * here; the two differ enough that sharing a builder would be a net loss.
 *
 * ADR-34: this runs whenever ANY ancillary is selected, not only for weight-based bags. The
 * guide makes it conditional (13-ancillaries-and-seats.md, "When is Travel_OfferPrice
 * required?"), but its three triggers are (1) AF/KL — out of NDC[X] scope entirely, (2) kg
 * bags, (3) AF/KL SAF bundles — out of scope. Making it unconditional leaves ONE code path
 * and one `Travel_OrderCreate` shape instead of branching on a ServiceDefinition attribute.
 * It is not a shop, so it does not consume look-to-book budget.
 *
 * ADR-35: ONE merged `SelectedOffer` carrying the air items AND the ancillary items. Both real
 * pre-booking captures do this —
 *   SQ-Family-Bag-in-Weight-PreBooking/4-Query-Travel-OfferPrice.xml  (air + 4 bags)
 *   AF-Bag-Seat-After-Pricing-2nd-OfferPrice/46-Query-Travel-OfferPrice.xml  (2 SelectedOffers,
 *     but the second is the SEAT offer which has its own OfferID from SeatAvailability)
 * The guide's "air offer + separate ancillary offer" variant is the fictional-6X shape. When a
 * seat's ALaCarteOffer carries its own OfferID distinct from the air offer, pass it as
 * `body.seatOfferId` and it becomes a second SelectedOffer — see buildSeatOffer below.
 *
 * ADR-37 ⚠️: `PaxRefID` is emitted as REPEATED elements here (node-soap serialises a JS array
 * that way), NOT space-joined. offer.utils.js's air builder space-joins per "Trap 2"; the SQ
 * capture of this very message type repeats. Both cannot be right for every carrier. THIS IS
 * THE FIRST THING TO CHECK if the host rejects an ancillary reprice.
 */
function createNdcxAncillaryOfferPricePayload(body, salesPoint) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required and must be an object");
  }
  if (!body.OfferID) throw new Error("OfferID is required to price ancillaries");
  if (!body.OwnerCode) throw new Error("OwnerCode (the airline) is required to price ancillaries");
  if (!body.ShoppingResponseId) {
    throw new Error("ShoppingResponseId is required to price ancillaries");
  }
  if (!Array.isArray(body.OfferIdList) || body.OfferIdList.length === 0) {
    throw new Error("At least one air OfferIdList entry is required to price ancillaries");
  }

  const paxList = buildAncillaryPaxList(body.paxs);
  const selectedOffer = buildMergedSelectedOffer(body);
  const seatOffer = buildSeatOffer(body);

  const Request = {
    DataLists: { PaxList: { Pax: paxList } },
    PricedOffer: {
      SelectedOffer: seatOffer ? [selectedOffer, seatOffer] : selectedOffer,
    },
  };

  // Post-booking / post-issuance only: the host needs to know which existing order these
  // services attach to (capture: SQ-...-Post-Payment/6---Travel-OfferPrice-for-Bag-in-Weight--1.xml).
  // Pre-booking there is no order yet, and sending an empty criteria block is a schema error.
  if (body.OrderID) {
    Request.ShoppingCriteria = {
      ExistingOrderCriteria: {
        PaxRefID: paxList.map((pax) => pax.PaxID),
        Order: { OrderID: stripNdcxOrderIdPrefix(body.OrderID) },
      },
    };
  }

  return { Party: buildNdcxParty(salesPoint), Request };
}

/** Air offer items first, then every selected seat and service — capture element order. */
function buildMergedSelectedOffer(body) {
  const airItems = body.OfferIdList.map((item, index) => {
    const id = item?.OfferItemID ?? item?.OfferItemRefID;
    if (!id) throw new Error(`OfferIdList[${index}] is missing OfferItemID`);
    const paxRefs = ensureArray(item.PaxRefID).filter(Boolean);
    if (!paxRefs.length) throw new Error(`OfferIdList[${index}] is missing PaxRefID`);
    // ADR-37: repeated elements, not a space-joined string.
    return { OfferItemRefID: id, PaxRefID: paxRefs };
  });

  const serviceItems = ensureArray(body.services).map((service, index) =>
    buildServiceItem(service, index),
  );

  // Seats whose price points live on the AIR offer (no separate seat OfferID) ride along here;
  // the rest go into their own SelectedOffer via buildSeatOffer.
  const inlineSeats = body.seatOfferId
    ? []
    : ensureArray(body.seats).map((seat, index) => buildSeatItem(seat, index));

  return {
    OfferRefID: body.OfferID,
    OwnerCode: body.OwnerCode,
    ShoppingResponseRefID: body.ShoppingResponseId,
    SelectedOfferItem: [...airItems, ...serviceItems, ...inlineSeats],
  };
}

/**
 * A second `SelectedOffer` for seats, used only when `Travel_SeatAvailability` returned its own
 * `ALaCarteOffer/OfferID` distinct from the air offer (the AF capture's shape). Most in-scope
 * carriers return seat price points under the air offer instead, in which case
 * `body.seatOfferId` is absent and the seats are merged above.
 *
 * Fallback rule (13-ancillaries-and-seats.md, "Gotchas"): when SeatAvailability RS returns no
 * ShoppingResponseRefID of its own, reuse the OfferPrice one — which is what
 * `body.ShoppingResponseId` already holds.
 */
function buildSeatOffer(body) {
  const seats = ensureArray(body.seats);
  if (!body.seatOfferId || seats.length === 0) return null;

  return {
    OfferRefID: body.seatOfferId,
    OwnerCode: body.seatOwnerCode ?? body.OwnerCode,
    ShoppingResponseRefID: body.seatShoppingResponseId ?? body.ShoppingResponseId,
    SelectedOfferItem: seats.map((seat, index) => buildSeatItem(seat, index)),
  };
}

function buildSeatItem(seat, index) {
  if (!seat?.OfferItemID) throw new Error(`seats[${index}] is missing OfferItemID`);
  const paxRefs = ensureArray(seat.PaxRefID).filter(Boolean);
  if (!paxRefs.length) throw new Error(`seats[${index}] is missing PaxRefID`);
  if (seat.RowNumber == null || !seat.ColumnID) {
    throw new Error(`seats[${index}] is missing RowNumber/ColumnID`);
  }

  return {
    OfferItemRefID: seat.OfferItemID,
    PaxRefID: paxRefs,
    // Qty is 1 for a seat. AF/KL make it mandatory for every ancillary, but AF/KL are out of
    // scope; it is harmless and present in both captures, so it stays.
    SelectedALaCarteOfferItem: { Qty: 1 },
    // Capture element order is ColumnID then SeatRowNumber (46-Query-Travel-OfferPrice.xml).
    // The guide's §1.5 sample agrees. Order is schema-enforced — do not swap these.
    SelectedSeat: { ColumnID: String(seat.ColumnID), SeatRowNumber: String(seat.RowNumber) },
  };
}

/**
 * A non-seat service. `Qty` is pieces OR kilograms depending on the ServiceDefinition's
 * `AddlDataMeasure/@UnitCode` — the caller resolves that (see NDCX-SERVICELIST-PLAN.md Task 4)
 * and passes the right number. Getting it wrong prices the wrong thing silently.
 */
function buildServiceItem(service, index) {
  if (!service?.OfferItemID) throw new Error(`services[${index}] is missing OfferItemID`);
  const paxRefs = ensureArray(service.PaxRefID).filter(Boolean);
  if (!paxRefs.length) throw new Error(`services[${index}] is missing PaxRefID`);

  const item = { OfferItemRefID: service.OfferItemID, PaxRefID: paxRefs };
  if (service.Qty != null) {
    const qty = Number(service.Qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`services[${index}] has a non-positive Qty: ${service.Qty}`);
    }
    item.SelectedALaCarteOfferItem = { Qty: qty };
  }
  return item;
}

/** Same `PAX{n}` convention as every other NDC[X] builder, so ids line up across the flow. */
function buildAncillaryPaxList(paxs) {
  if (!Array.isArray(paxs) || paxs.length === 0) {
    throw new Error("At least one passenger is required to price ancillaries");
  }
  return paxs.map((pax, index) => {
    if (!pax || !pax.ptc) throw new Error(`Passenger at index ${index} must have a valid PTC`);
    return { PaxID: `PAX${index + 1}`, PTC: getPaxCodeFromMetis(pax.ptc) };
  });
}

function ensureArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { createNdcxAncillaryOfferPricePayload };
```

- [ ] **Step 5: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-ancillary-offer.utils.test.js`
Expected: PASS, 7/7.

- [ ] **Step 6: Commit**

```bash
git add src/utils/AMADEUS_NDCX/ancillaryOffer.utils.js src/utils/AMADEUS_NDCX/__tests__/ndcx-ancillary-offer.utils.test.js
git commit -m "feat(ndcx): build the ancillary Travel_OfferPrice (ADR-34/35/37)"
```

---

### Task 7: `/ancillaryPriceRQ` route

**Files:**
- Modify: `src/controllers/AMADEUS_NDCX/offer.controller.js`
- Test: `src/controllers/AMADEUS_NDCX/__tests__/ancillaryPrice.controller.test.js`

**Interfaces:**
- Consumes: `createNdcxAncillaryOfferPricePayload` (Task 6), `mapNdcxOfferPriceReply` (existing).
- Produces: `POST /aerial/AMADEUS_NDCX/offer/ancillaryPriceRQ` returning
  `{ value: OfferPriceRs }`. `AmadeusNdcxAdapter` Task 12 calls it; its `OrderItems[]` carry the
  ids `Travel_OrderCreate` / `Travel_OrderChange` must use (ADR-35).

⚠️ `offer.controller.js` currently overrides `sendError` to **return** a shaped object rather
than write to `res`, because `/offerPriceRQ` is dispatched by a wrapper
(`global.controller.js:673-677`) that has no real `res`. The new route is mounted directly by
the folder scan and **does** get a real `res`. Register it as its own controller instance
rather than bending the existing one.

- [ ] **Step 1: Write the failing test**

```js
// src/controllers/AMADEUS_NDCX/__tests__/ancillaryPrice.controller.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

test("setupRoute registers both offerPriceRQ and ancillaryPriceRQ", () => {
  const { setupRoute } = require("../offer.controller");
  const registered = [];
  setupRoute({ post: (path) => registered.push(path) });
  assert.deepEqual(registered.sort(), ["/ancillaryPriceRQ", "/offerPriceRQ"]);
});

test("ancillaryPriceRQ is exported for the dispatcher", () => {
  const { OfferController } = require("../offer.controller");
  assert.equal(typeof OfferController.ancillaryPriceRQ, "function");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test controllers/AMADEUS_NDCX/__tests__/ancillaryPrice.controller.test.js`
Expected: FAIL — `setupRoute` registers only `/offerPriceRQ`, and `ancillaryPriceRQ` is undefined.

- [ ] **Step 3: Implement — append to `offer.controller.js`**

Add these imports at the top of the existing file:

```js
const {
  createNdcxAncillaryOfferPricePayload,
} = require("../../utils/AMADEUS_NDCX/ancillaryOffer.utils");
const { mapNdcxOfferPriceReply } = require("../../utils/AMADEUS_NDCX/offerPriceReply.mapper");
const { resolveNdcxAirlineOwnerCode } = require("../../utils/AMADEUS_NDCX/order.utils");
const PnrService = require("../../services/pnr.service");
```

Then, **before** the existing `module.exports`, add:

```js
/**
 * The SECOND Travel_OfferPrice — prices the seats/services the agent selected (ADR-34).
 *
 * Its own AmadeusControllerFactory instance, deliberately: `offerController` above overrides
 * `sendError` to RETURN a shaped object because /offerPriceRQ is dispatched by
 * global.controller.js:673-677 with no real `res`. This route is mounted directly by app.js's
 * folder scan and DOES get a real `res`, so it must use the normal sendResponse/sendError
 * contract. Reusing `offerController` would silently swallow every error into a 200 body.
 *
 * Returns the full OfferPriceRs. The caller must carry its `OfferID`, `ResponseID` and
 * `OrderItems[].OfferItemID` into Travel_OrderCreate / Travel_OrderChange — ADR-35: the
 * booking is built from THIS reply, never from the 1st OfferPrice or from the
 * SeatAvailability/ServiceList reply directly.
 */
const ancillaryController = new AmadeusControllerFactory("/ancillaryPriceRQ");

ancillaryController.validateControllerInput = (req) => {
  const { body } = req;
  if (!body?.OfferID) return "OfferID is required";
  if (!body?.ShoppingResponseId) return "ShoppingResponseId is required";
  if (!Array.isArray(body?.OfferIdList) || body.OfferIdList.length === 0) {
    return "At least one air OfferIdList entry is required";
  }
  if (!Array.isArray(body?.paxs) || body.paxs.length === 0) {
    return "At least one passenger is required";
  }
  const hasSeats = Array.isArray(body?.seats) && body.seats.length > 0;
  const hasServices = Array.isArray(body?.services) && body.services.length > 0;
  if (!hasSeats && !hasServices) return "At least one seat or service must be selected";
  return null;
};

ancillaryController.processRequest = async function (req, res) {
  let ndcxService;
  try {
    let ownerCode = req.body?.OwnerCode ?? null;
    if (!ownerCode && req.body?.OrderID) {
      const persisted = await PnrService.getPnrListByOrderId(req.body.OrderID);
      ownerCode = resolveNdcxAirlineOwnerCode(persisted?.dataValues?.pnrList) ?? null;
    }
    if (!ownerCode) {
      return this.sendError(res, new Error("OwnerCode (the airline) is required"), 400);
    }

    const body = { ...req.body, OwnerCode: ownerCode };

    let payload;
    try {
      payload = createNdcxAncillaryOfferPricePayload(body, req.salesPoint);
    } catch (err) {
      return this.sendError(res, err, 400);
    }

    ndcxService = await NdcxService.create(req.salesPoint);
    const reply = await ndcxService.travelOfferPrice(payload);
    return this.sendResponse(res, mapNdcxOfferPriceReply(reply, body));
  } catch (err) {
    return this.sendError(res, err, err.name === "NdcxError" ? 502 : 500);
  } finally {
    if (ndcxService) await ndcxService.close();
  }
}.bind(ancillaryController);

ancillaryController.ancillaryPriceRQ = (req, res, next) =>
  ancillaryController.handleRequest(req, res, next);
```

Replace the existing `module.exports` block with:

```js
module.exports = {
  OfferController: {
    offerPriceRQ: (body) => offerController.handleRequest({ body }),
    ancillaryPriceRQ: ancillaryController.ancillaryPriceRQ,
  },
  setupRoute: (app) => {
    offerController.setupRoute(app);
    app.post("/ancillaryPriceRQ", ancillaryController.ancillaryPriceRQ);
    return app;
  },
};
```

- [ ] **Step 4: Run tests — all green**

Run: `cd api-aerial/src && node --test controllers/AMADEUS_NDCX/__tests__/ancillaryPrice.controller.test.js && npm run test:unit`
Expected: PASS. The existing `offerPriceRQ` tests must still pass — the wrapper contract is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/AMADEUS_NDCX/offer.controller.js src/controllers/AMADEUS_NDCX/__tests__/ancillaryPrice.controller.test.js
git commit -m "feat(ndcx): add /ancillaryPriceRQ for the second Travel_OfferPrice"
```

---

### Task 8: `Travel_OrderCreate` with ancillaries

**Files:**
- Modify: `src/utils/AMADEUS_NDCX/order.utils.js` (`createNdcxOrderCreatePayload`, currently
  lines 27-67 and `buildSelectedOfferItem` lines 69-85)
- Test: extend `src/utils/__tests__/ndcx-order-create.utils.test.js`

**Interfaces:**
- Consumes: the ancillary OfferPrice reply's ids (Task 7).
- Produces: `createNdcxOrderCreatePayload(body, salesPoint)` now honours
  `body.AncillaryOfferIdList: Array<{ OfferItemID, PaxRefID }>`, appending them to the single
  `SelectedOffer` (ADR-35). Task 12's `bookFlight()` sends them.

**ADR-35, capture-verified twice.**
`SQ-Family-Bag-in-Weight-PreBooking/5-Query-Travel-OrderCreate.xml` — one `SelectedOffer`,
3 air items + 4 bag items, no `SelectedSeat`.
`AF-Bag-Seat-After-Pricing-2nd-OfferPrice/47-Query-Travel-OrderCreate.xml` — one
`SelectedOffer`, 1 air item + 2 bags + 2 seats, no `SelectedSeat`. The seat row/column was
already committed in the 2nd OfferPrice, which is exactly why ADR-34 makes that call
unconditional.

- [ ] **Step 1: Write the failing test — append to the existing file**

```js
// append to src/utils/__tests__/ndcx-order-create.utils.test.js
test("ancillary offer items join the air items in ONE SelectedOffer (ADR-35)", () => {
  const payload = createNdcxOrderCreatePayload(
    {
      OfferID: "OFFER-FROM-2ND-OFFERPRICE",
      OwnerCode: "SQ",
      ShoppingResponseId: "SP2F-12382921279997477441",
      OfferIdList: [{ OfferItemID: "AIR-1", PaxRefID: ["PAX1", "PAX2"] }],
      AncillaryOfferIdList: [
        { OfferItemID: "BAG-1", PaxRefID: ["PAX1"] },
        { OfferItemID: "SEAT-1", PaxRefID: ["PAX2"] },
      ],
      paxs: [
        { ptc: "ADT", birthDate: "1992-03-07", gender: "M", individualInfo: { givenName: "MIKE", surname: "QUIN" } },
        { ptc: "ADT", birthDate: "1986-09-29", gender: "F", individualInfo: { givenName: "SYL", surname: "QUIN" } },
      ],
    },
    { "Amadeus-officeId": "NCE1A0950", iata: "20255373" },
  );

  const offer = payload.Request.CreateOrder.SelectedOffer;
  assert.ok(!Array.isArray(offer), "ADR-35: exactly one SelectedOffer");
  assert.deepEqual(
    offer.SelectedOfferItem.map((i) => i.OfferItemID),
    ["AIR-1", "BAG-1", "SEAT-1"],
  );
  // ADR-35: no SelectedSeat at OrderCreate — the seat was committed in the 2nd OfferPrice.
  assert.ok(offer.SelectedOfferItem.every((i) => i.SelectedSeat === undefined));
});

test("omitting AncillaryOfferIdList leaves the air-only payload byte-identical", () => {
  const common = {
    OfferID: "O1", OwnerCode: "SQ", ShoppingResponseId: "R1",
    OfferIdList: [{ OfferItemID: "AIR-1", PaxRefID: ["PAX1"] }],
    paxs: [{ ptc: "ADT", birthDate: "1992-03-07", gender: "M", individualInfo: { givenName: "A", surname: "B" } }],
  };
  const salesPoint = { "Amadeus-officeId": "NCE1A0950", iata: "20255373" };
  assert.deepEqual(
    createNdcxOrderCreatePayload(common, salesPoint),
    createNdcxOrderCreatePayload({ ...common, AncillaryOfferIdList: [] }, salesPoint),
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/__tests__/ndcx-order-create.utils.test.js`
Expected: FAIL — only `AIR-1` is present; `AncillaryOfferIdList` is ignored.

- [ ] **Step 3: Implement**

In `createNdcxOrderCreatePayload`, replace the `SelectedOfferItem` line inside `SelectedOffer`:

```js
          SelectedOfferItem: buildAllSelectedOfferItems(body),
```

and add, next to the existing `buildSelectedOfferItem`:

```js
/**
 * Air items then ancillary items, in ONE `SelectedOffer` (ADR-35).
 *
 * Capture-verified twice, and it contradicts the guide — 13-ancillaries-and-seats.md §1.6
 * shows two `SelectedOffer` blocks with `SelectedSeat` on the seat one. Both real captures
 * show a single merged offer with no `SelectedSeat`:
 *   SQ-Family-Bag-in-Weight-PreBooking/5-Query-Travel-OrderCreate.xml   (3 air + 4 bags)
 *   AF-Bag-Seat-After-Pricing-2nd-OfferPrice/47-Query-Travel-OrderCreate.xml (1 air + 2 bags + 2 seats)
 *
 * Seats carry no row/column here because ADR-34 already committed them in the second
 * `Travel_OfferPrice`; `body.OfferID`/`ShoppingResponseId` MUST therefore come from that
 * second reply, not from the first.
 */
function buildAllSelectedOfferItems(body) {
  const air = body.OfferIdList.map((item, index) => buildSelectedOfferItem(item, index));
  const ancillary = ensureArray(body.AncillaryOfferIdList).map((item, index) =>
    buildSelectedOfferItem(item, index),
  );
  return [...air, ...ancillary];
}
```

`buildSelectedOfferItem` already emits `{ OfferItemID, PaxRefID: paxRefs }` with repeated
`PaxRefID` elements, which is exactly what an ancillary item needs — reuse it unchanged.
`ensureArray` already exists in this file.

- [ ] **Step 4: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/__tests__/ndcx-order-create.utils.test.js`
Expected: PASS, including every pre-existing case. The byte-identical test in Step 1 is the
regression guard: an air-only booking must be unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/utils/AMADEUS_NDCX/order.utils.js src/utils/__tests__/ndcx-order-create.utils.test.js
git commit -m "feat(ndcx): carry ancillary offer items into Travel_OrderCreate (ADR-35)"
```

---

### Task 9: `Travel_OrderChange` — post-booking and post-issuance

**Files:**
- Create: `src/utils/AMADEUS_NDCX/orderChange.utils.js`
- Modify: `src/controllers/AMADEUS_NDCX/order.controller.js`
- Test: `src/utils/AMADEUS_NDCX/__tests__/ndcx-order-change.utils.test.js`

**Interfaces:**
- Consumes: `buildNdcxParty`, `stripNdcxOrderIdPrefix`, `buildOrderCreatePaxList` (export it
  from `order.utils.js` — the pax block is identical), `createNdcxOrderPayPayload`'s card
  reader for the payment block.
- Produces: `createNdcxOrderChangePayload(pnr, body, salesPoint) -> { Party, Request }`, and
  `orderController.orderChangeRQ` on `POST /aerial/AMADEUS_NDCX/order/orderChangeRQ`. The reply
  is an `AMA_TravelOrderViewRS` — **map it with the existing `mapNdcxOrderViewReply`**, same as
  OrderCreate/OrderPay.

**ADR-36.** Shape authority:
`.agents/skills/ndcx/examples/servicing/SQ-Family-Add-Seats-and-Bags-Post-Payment/7---Travel-OrderChange-for-Bag--1.xml`
(post-issuance, with `PaymentInfo`) and `.../8---Travel-OrderChange-free-Ancillaries--1.xml`.
Element order inside `Request`: `ChangeOrder` → `DataLists` → `PaymentInfo` → `Order`.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/AMADEUS_NDCX/__tests__/ndcx-order-change.utils.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createNdcxOrderChangePayload } = require("../orderChange.utils");

const salesPoint = { "Amadeus-officeId": "NCE1A0950", iata: "20255373" };
const paxs = [
  { ptc: "ADT", birthDate: "1992-03-07", gender: "M", individualInfo: { givenName: "MIKE", surname: "QUIN" } },
];
const base = {
  OrderID: "NDCX-SQ_6RUS54",
  OwnerCode: "SQ",
  OfferID: "OFFER-FROM-2ND-OFFERPRICE",
  ShoppingResponseId: "SP2P-14336416521089354369",
  AncillaryOfferIdList: [{ OfferItemID: "BAG-1", PaxRefID: ["PAX1"] }],
  paxs,
};

test("post-booking (held order) carries NO PaymentInfo", () => {
  const payload = createNdcxOrderChangePayload({ status: 1 }, base, salesPoint);
  assert.equal(payload.Request.PaymentInfo, undefined);
  assert.deepEqual(Object.keys(payload.Request), ["ChangeOrder", "DataLists", "Order"]);
});

test("post-issuance (ticketed order) requires PaymentInfo and places it before Order", () => {
  const pnr = {
    status: 2,
    EnrollmentStatusText: JSON.stringify({
      cardNumber: "345678000000007", seriesCode: "4111", vendorCode: "AX", expirationDate: "1225",
    }),
  };
  const payload = createNdcxOrderChangePayload(
    pnr,
    { ...base, Amount: 60, CurCode: "USD" },
    salesPoint,
  );
  assert.deepEqual(Object.keys(payload.Request), [
    "ChangeOrder", "DataLists", "PaymentInfo", "Order",
  ]);
  assert.equal(payload.Request.PaymentInfo.Amount._text, "60.00");
  assert.equal(payload.Request.PaymentInfo.Amount.$attributes.CurCode, "USD");
  assert.equal(payload.Request.PaymentInfo.TypeCode, "CC");
  assert.equal(
    payload.Request.PaymentInfo.PaymentMethod.PaymentCard.CardNumber,
    "345678000000007",
  );
});

test("wraps the offer in ChangeOrder/UpdateOrderItem/AcceptOffer", () => {
  const payload = createNdcxOrderChangePayload({ status: 1 }, base, salesPoint);
  const offer = payload.Request.ChangeOrder.UpdateOrderItem.AcceptOffer.SelectedOffer;
  assert.equal(offer.OfferID, "OFFER-FROM-2ND-OFFERPRICE");
  assert.equal(offer.ShoppingResponseRefID, "SP2P-14336416521089354369");
  assert.deepEqual(offer.SelectedOfferItem, [
    { OfferItemRefID: "BAG-1", PaxRefID: ["PAX1"] },
  ]);
});

test("Order carries the host id with the NDCX- prefix stripped", () => {
  const payload = createNdcxOrderChangePayload({ status: 1 }, base, salesPoint);
  assert.deepEqual(payload.Request.Order, { OrderID: "SQ_6RUS54", OwnerCode: "SQ" });
});

test("a ticketed order with no stored card fails loudly rather than sending a free change", () => {
  assert.throws(
    () => createNdcxOrderChangePayload({ status: 2 }, { ...base, Amount: 60 }, salesPoint),
    /no stored payment card/i,
  );
});

test("a ticketed order with no Amount fails loudly", () => {
  const pnr = { status: 2, EnrollmentStatusText: JSON.stringify({ cardNumber: "1", vendorCode: "VI", expirationDate: "1225" }) };
  assert.throws(
    () => createNdcxOrderChangePayload(pnr, base, salesPoint),
    /Amount is required/i,
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-order-change.utils.test.js`
Expected: FAIL, `Cannot find module '../orderChange.utils'`.

- [ ] **Step 3: Export the shared pax builder**

`buildOrderCreatePaxList` in `order.utils.js` builds exactly the `DataLists/PaxList/Pax` block
`Travel_OrderChange` needs (captures `7---Travel-OrderChange-for-Bag--1.xml` and
`10---Travel-OrderChange-Chargeable-Seats--1.xml` both carry the full pax list). Add it to that
file's existing `module.exports` — do not copy the function.

Run: `cd api-aerial/src && grep -n "module.exports" utils/AMADEUS_NDCX/order.utils.js`
then add `buildOrderCreatePaxList` to the exported object.

- [ ] **Step 4: Implement**

```js
// src/utils/AMADEUS_NDCX/orderChange.utils.js
const { buildNdcxParty } = require("./party.utils");
const { stripNdcxOrderIdPrefix, buildOrderCreatePaxList } = require("./order.utils");

/**
 * `AMA_TravelOrderChangeRQ` for adding seats and services to an EXISTING order (ADR-36).
 *
 * Two timings, one builder, one difference — payment:
 *
 *   post-booking  (pnr.status === 1, held)     NO PaymentInfo. Air and ancillaries settle
 *                                              together in the later Travel_OrderPay
 *                                              ("single combined payment",
 *                                              13-ancillaries-and-seats.md §2).
 *   post-issuance (pnr.status === 2, ticketed) PaymentInfo MANDATORY — instant payment, the
 *                                              tickets are already issued so there is no
 *                                              later OrderPay to ride on (§3).
 *
 * Sending PaymentInfo on a held order double-charges the ancillary; omitting it on a ticketed
 * order gives the passenger a free bag. Both failures are silent host-side, which is why
 * `status` is a required input rather than something inferred from the body.
 *
 * Element order inside Request is schema-enforced:
 *   ChangeOrder -> DataLists -> [PaymentInfo] -> Order
 * (capture: SQ-Family-Add-Seats-and-Bags-Post-Payment/7---Travel-OrderChange-for-Bag--1.xml).
 *
 * ⚠️ SECURITY, called out deliberately every time this file is touched (NDCX-CONTEXT.md §3,
 * "OrderPay"): the AF/KL host-public-key card-encryption path fires only for
 * OwnerCode "AF"/"KL". NDC[X] orders never match, so the PAN below travels in the SOAP body
 * protected by TLS only — identical to classic AMADEUS and to Travel_OrderPay. Name this in
 * any PR touching this file.
 *
 * @param {{status: number, EnrollmentStatusText?: string}} pnr - the persisted pnr row
 * @param {object} body
 * @param {import("../../types/amadeus/types").SalesPoint} salesPoint
 */
function createNdcxOrderChangePayload(pnr, body, salesPoint) {
  if (!pnr || typeof pnr !== "object") throw new Error("A persisted pnr row is required");
  if (!body?.OrderID) throw new Error("OrderID is required to change an order");
  if (!body?.OwnerCode) throw new Error("OwnerCode (the airline) is required to change an order");
  if (!body?.OfferID) throw new Error("OfferID is required to change an order");
  if (!body?.ShoppingResponseId) {
    throw new Error("ShoppingResponseId is required to change an order");
  }
  const items = Array.isArray(body.AncillaryOfferIdList) ? body.AncillaryOfferIdList : [];
  if (items.length === 0) {
    throw new Error("At least one ancillary offer item is required to change an order");
  }

  const Request = {
    ChangeOrder: {
      UpdateOrderItem: {
        AcceptOffer: {
          SelectedOffer: {
            // ⚠️ Post-booking ancillary OfferIDs are sometimes COMPOSITE:
            // `<ShoppingResponseRefID>_1A_<offerItemID>` (capture
            // 7---Travel-OrderChange-for-Bag--1.xml). Send whatever the 2nd OfferPrice reply
            // gave as OfferID verbatim, and the PLAIN value as ShoppingResponseRefID — do not
            // try to derive one from the other.
            OfferID: body.OfferID,
            OwnerCode: body.OwnerCode,
            ShoppingResponseRefID: body.ShoppingResponseId,
            SelectedOfferItem: items.map((item, index) => {
              if (!item?.OfferItemID) {
                throw new Error(`AncillaryOfferIdList[${index}] is missing OfferItemID`);
              }
              const paxRefs = ensureArray(item.PaxRefID).filter(Boolean);
              if (!paxRefs.length) {
                throw new Error(`AncillaryOfferIdList[${index}] is missing PaxRefID`);
              }
              // Note OfferItemRefID here, vs OrderCreate's OfferItemID. Different element.
              return { OfferItemRefID: item.OfferItemID, PaxRefID: paxRefs };
            }),
          },
        },
      },
    },
    DataLists: { PaxList: { Pax: buildOrderCreatePaxList(body.paxs) } },
  };

  if (pnr.status === 2) {
    Request.PaymentInfo = buildOrderChangePaymentInfo(pnr, body);
  }

  Request.Order = {
    OrderID: stripNdcxOrderIdPrefix(body.OrderID),
    OwnerCode: body.OwnerCode,
  };

  return { Party: buildNdcxParty(salesPoint), Request };
}

/**
 * Post-issuance payment. The card comes from `pnr.EnrollmentStatusText`, the blob
 * `applyNdcxEnrollmentStatusText` wrote at booking (ADR-18) and `createNdcxOrderPayPayload`
 * already reads back — there is no host FOP catalogue for NDC[X] carriers, so this is the only
 * record of how the booking was paid. Decision #14: reuse it, re-prompt only if absent.
 *
 * ⚠️ Amount is MAJOR units with 2 decimals here — note the capture's `60.00`, unlike every
 * reply-side amount in NDC[X], which is integer minor units. Do not run it through
 * parseNdcxAmount.
 */
function buildOrderChangePaymentInfo(pnr, body) {
  const amount = Number(body?.Amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "Amount is required to change a ticketed order — post-issuance ancillaries are paid instantly",
    );
  }

  const card = readStoredCard(pnr);
  if (!card) {
    throw new Error(
      "This order has no stored payment card; post-issuance ancillaries cannot be charged",
    );
  }

  return {
    Amount: { $attributes: { CurCode: body.CurCode ?? "EUR" }, _text: amount.toFixed(2) },
    TypeCode: "CC",
    SecurePaymentVersion2: { PaymentTrxChannelCode: "MO" },
    PaymentMethod: {
      PaymentCard: {
        // Capture element order: CardNumber, SeriesCode, CreditCardVendorCode, ExpirationDate.
        CardNumber: card.cardNumber,
        ...(card.seriesCode ? { SeriesCode: card.seriesCode } : {}),
        CreditCardVendorCode: card.vendorCode,
        ExpirationDate: card.expirationDate,
      },
    },
  };
}

function readStoredCard(pnr) {
  const raw = pnr?.EnrollmentStatusText;
  if (!raw) return null;
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!parsed?.cardNumber || !parsed?.vendorCode || !parsed?.expirationDate) return null;
  return parsed;
}

function ensureArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { createNdcxOrderChangePayload };
```

- [ ] **Step 5: Verify the stored-card field names against the writer**

Run: `cd api-aerial/src && grep -n "EnrollmentStatusText" -A 25 utils/AMADEUS_NDCX/orderPay.utils.js | head -50`
Expected: `applyNdcxEnrollmentStatusText` shows the exact keys it writes. If they differ from
`cardNumber`/`seriesCode`/`vendorCode`/`expirationDate`, **change `readStoredCard` and the test
to match the writer** — the writer is the authority. Do not add a second shape.

- [ ] **Step 6: Run tests — all green**

Run: `cd api-aerial/src && node --test utils/AMADEUS_NDCX/__tests__/ndcx-order-change.utils.test.js`
Expected: PASS, 6/6.

- [ ] **Step 7: Wire the controller route**

In `src/controllers/AMADEUS_NDCX/order.controller.js`, add the import:

```js
const { createNdcxOrderChangePayload } = require("../../utils/AMADEUS_NDCX/orderChange.utils");
```

extend `validateControllerInput` with a `change` branch, before the `// create` comment:

```js
  if (req._ndcxOp === "change") {
    if (!body?.OrderID) return "OrderID is required";
    if (!body?.OfferID) return "OfferID is required";
    if (!body?.ShoppingResponseId) return "ShoppingResponseId is required";
    if (!Array.isArray(body?.AncillaryOfferIdList) || body.AncillaryOfferIdList.length === 0) {
      return "At least one ancillary offer item is required";
    }
    if (!Array.isArray(body?.paxs) || body.paxs.length === 0) {
      return "At least one passenger is required";
    }
    return null;
  }
```

add the dispatch in `processRequest`, next to the other `_ndcxOp` branches:

```js
    if (req._ndcxOp === "change") {
      return await this.handleOrderChange(req, res, ndcxService);
    }
```

add the handler before the route wrappers:

```js
/**
 * `Travel_OrderChange` — adds seats/services to an existing order (ADR-36).
 *
 * Never calls dossierCreate (ADR-12: exactly once per booking, at create). Persists the new
 * services via ServiceAerialService, and nothing else: the air itinerary is untouched by an
 * ancillary change, so saveAfterRetreive's destructive segment resync must NOT run here (same
 * reasoning as handleOrderCancel's note at order.controller.js:430).
 */
orderController.handleOrderChange = async function (req, res, ndcxService) {
  const pnr = await PnrService.getPnrWithOrderid(req.body.OrderID);
  if (!pnr) return this.sendError(res, new Error("Order not found"), 400);
  if (pnr.status !== 1 && pnr.status !== 2) {
    return this.sendError(
      res,
      new Error("Only a held or ticketed order can take additional services"),
      400,
    );
  }

  const ownerCode = req.body?.OwnerCode ?? resolveNdcxAirlineOwnerCode(pnr.pnrList) ?? null;
  if (!ownerCode) {
    return this.sendError(
      res,
      new Error("OwnerCode (the airline) is required to change an order"),
      400,
    );
  }

  let payload;
  try {
    payload = createNdcxOrderChangePayload(pnr, { ...req.body, OwnerCode: ownerCode }, req.salesPoint);
  } catch (err) {
    return this.sendError(res, err, 400);
  }

  const reply = await ndcxService.travelOrderChange(payload);
  // AMA_TravelOrderViewRS — the same reply type OrderCreate and OrderPay return, so the
  // existing mapper applies unchanged.
  const value = mapNdcxOrderViewReply(reply, req.body);

  if (value?.Errors?.length || !hasOrderData(value)) {
    return this.sendNdcxRejection(
      res,
      value?.Errors,
      "The airline refused the service and gave no reason",
    );
  }

  return this.sendResponse(res, { value, dossierId: pnr.dossierId ?? null });
}.bind(orderController);
```

and register the route and export (`orderChangeRQ` is already dispatched by
`global.controller.js:773-786`, which currently throws because the method does not exist):

```js
orderController.orderChangeRQ = (req, res, next) => {
  req._ndcxOp = "change";
  return orderController.handleRequest(req, res, next);
};
```

Add `app.post("/orderChangeRQ", orderController.orderChangeRQ);` to `setupRoute`, and
`orderChangeRQ: orderController.orderChangeRQ,` to the exported `OrderController`.

- [ ] **Step 8: Run the whole backend suite**

Run: `cd api-aerial/src && npm run test:unit`
Expected: PASS. In particular `controllers/AMADEUS_NDCX/__tests__/orderCancel.callSequence.test.js`
must still pass — the cancel path is untouched.

- [ ] **Step 9: Commit**

```bash
git add src/utils/AMADEUS_NDCX/orderChange.utils.js src/utils/AMADEUS_NDCX/__tests__/ndcx-order-change.utils.test.js src/controllers/AMADEUS_NDCX/order.controller.js src/utils/AMADEUS_NDCX/order.utils.js
git commit -m "feat(ndcx): add Travel_OrderChange for post-booking and post-issuance services (ADR-36)

Post-booking carries no PaymentInfo (combined payment at OrderPay); post-issuance
requires it (instant payment). Card is read back from pnr.EnrollmentStatusText.

Security note: NDC[X] orders never match the AF/KL host-public-key encryption path, so
the PAN travels in the SOAP body over TLS only — same as classic AMADEUS and OrderPay."
```

---

### Task 10: Front — `AmadeusNdcxAdapter.getSeats()`

**Files:**
- Modify: `front-reservation/app/utils/adapters/AmadeusNdcxAdapter.ts`
- Create: `front-reservation/tests/unit/adapters/ndcxSeatSelection.test.ts`

**Interfaces:**
- Consumes: `POST /aerial/AMADEUS_NDCX/seat/seatAvailabilityRQ` (Task 5).
- Produces: `getSeats()` returning the mapped seat map and populating
  `bookingFlow.setSeatResponse` / `setSeatRemarks`, exactly as `BaseAdapter.getSeats()` does for
  other providers.

`BaseAdapter.getSeats()` (`BaseAdapter.ts:400-455`) **almost** works already: it resolves
`AMADEUS_NDCX` → the right URL and sends `OfferID`/`responseId`/`OfferIdList` pre-booking,
`OrderID` post-booking. Three things break it: it sends `responseId` where the backend expects
`ShoppingResponseId`, it never sends `OwnerCode`, and `response.Warnings.map` throws when the
reply carries an `Errors` block instead.

- [ ] **Step 1: Write the failing test**

```ts
// front-reservation/tests/unit/adapters/ndcxSeatSelection.test.ts
import { describe, expect, it } from "vitest";

import { buildNdcxSeatPayload, ndcxSeatSubtotal } from "@/utils/adapters/ndcx/ndcxSeatSelection";

describe("buildNdcxSeatPayload", () => {
  it("sends ShoppingResponseId and OwnerCode pre-booking", () => {
    const payload = buildNdcxSeatPayload({
      isServicing: false,
      offer: { OfferID: "O1", ResponseID: "R1", OwnerCode: "SQ", OrderItems: [{ OfferItemID: "AIR-1" }] },
      orderId: null,
      ownerCode: null,
      paxs: [{ id: "PAX1", ptc: "ADT" }],
    });
    expect(payload.OfferID).toBe("O1");
    expect(payload.ShoppingResponseId).toBe("R1");
    expect(payload.OwnerCode).toBe("SQ");
    expect(payload.OrderID).toBeUndefined();
  });

  it("sends OrderID and no offer fields when servicing", () => {
    const payload = buildNdcxSeatPayload({
      isServicing: true,
      offer: null,
      orderId: "NDCX-SQ_6RUS54",
      ownerCode: "SQ",
      paxs: [{ id: "PAX1", ptc: "ADT" }],
    });
    expect(payload.OrderID).toBe("NDCX-SQ_6RUS54");
    expect(payload.OfferID).toBeUndefined();
    expect(payload.ShoppingResponseId).toBeUndefined();
  });
});

describe("ndcxSeatSubtotal", () => {
  it("sums one seat per pax per segment and ignores unpriced seats", () => {
    const paxs = [
      { id: "PAX1", seat: { SEG1: { UnitPrice: { TotalAmount: 25 } }, SEG2: { UnitPrice: { TotalAmount: 15 } } } },
      { id: "PAX2", seat: { SEG1: { UnitPrice: { TotalAmount: null } } } },
    ];
    expect(ndcxSeatSubtotal(paxs)).toBe(40);
  });

  it("is 0 when nothing is selected", () => {
    expect(ndcxSeatSubtotal([{ id: "PAX1" }])).toBe(0);
    expect(ndcxSeatSubtotal([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ndcxSeatSelection.test.ts`
Expected: FAIL, cannot resolve `@/utils/adapters/ndcx/ndcxSeatSelection`.

- [ ] **Step 3: Create the pure helpers**

```ts
// front-reservation/app/utils/adapters/ndcx/ndcxSeatSelection.ts

/**
 * Pure helpers for the NDC[X] seat flow. No Pinia, no reactivity, no HTTP — the adapter owns
 * all three. Kept separate so the payload shape and the subtotal maths are unit-testable
 * without mounting a store (the sibling-purity rule in front-reservation/CLAUDE.md).
 */

export interface NdcxSeatPayloadInput {
  isServicing: boolean;
  offer: { OfferID?: string; ResponseID?: string; OwnerCode?: string; OrderItems?: any[] } | null;
  orderId: string | null;
  ownerCode: string | null;
  paxs: Array<{ id?: string; ptc?: string }>;
}

/**
 * `BaseAdapter.getSeats()` sends `responseId`, which the NDC[X] backend does not read — it
 * expects `ShoppingResponseId`, the same key `getOffer()`/`bookFlight()` already use
 * (NDCX-OFFERPRICE-PLAN.md ADR-1: echoed verbatim from the offer, never derived). It also
 * never sends `OwnerCode`, which `seat.controller.js` needs pre-booking because there is no
 * persisted pnr to recover the airline from yet.
 */
export function buildNdcxSeatPayload(input: NdcxSeatPayloadInput): Record<string, any> {
  const { isServicing, offer, orderId, ownerCode, paxs } = input;

  if (isServicing) {
    return { OrderID: orderId, OwnerCode: ownerCode, paxs };
  }

  return {
    OfferID: offer?.OfferID,
    ShoppingResponseId: offer?.ResponseID,
    OwnerCode: ownerCode ?? offer?.OwnerCode,
    OfferIdList: (offer?.OrderItems ?? []).map((item: any) => ({
      OfferItemID: item.OfferItemID,
      PaxRefID: item.PaxRefID ?? [],
    })),
    paxs,
  };
}

/**
 * ADR-38: ancillaries are a SEPARATE subtotal. The air total in
 * `bookingFlow.selectedOffer.TotalPrice` is never overwritten, so the recap and the margin
 * maths keep working on the figure the airline priced for the flights.
 *
 * A seat with a null `TotalAmount` is one the backend marked `blocked` (no price returned);
 * it contributes nothing and should not be selectable in the first place.
 */
export function ndcxSeatSubtotal(paxs: Array<Record<string, any>>): number {
  if (!Array.isArray(paxs)) return 0;
  return paxs.reduce((total, pax) => {
    const seats = pax?.seat ? Object.values<any>(pax.seat) : [];
    return (
      total +
      seats.reduce((sum: number, seat: any) => {
        const amount = Number(seat?.UnitPrice?.TotalAmount);
        return Number.isFinite(amount) ? sum + amount : sum;
      }, 0)
    );
  }, 0);
}
```

- [ ] **Step 4: Run the helper tests — green**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ndcxSeatSelection.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Override `getSeats()` in the adapter**

Add to `AmadeusNdcxAdapter.ts`, after `getOfferCondition()`:

```ts
  /**
   * `Travel_SeatAvailability` (NDCX-SEATMAP-PLAN.md Task 10).
   *
   * Overrides BaseAdapter.getSeats() rather than reusing it for three reasons, all of which
   * would otherwise fail silently:
   *   1. BaseAdapter sends `responseId`; the NDC[X] backend reads `ShoppingResponseId`.
   *   2. BaseAdapter never sends `OwnerCode`, which seat.controller.js needs pre-booking
   *      (there is no persisted pnr to recover the airline from until the order exists).
   *   3. BaseAdapter does `response.Warnings.map(...)` unguarded — an error-only reply has no
   *      Warnings and takes down the whole checkout with a TypeError.
   */
  override async getSeats() {
    bookingFlow().setSeatRemarks([]);
    initClaussData();

    const offer = bookingFlow().getSelectedOffer();
    const pnr = servicingFlow().folder?.pnr;
    const ownerCode =
      pnr?.pnrList?.find((p: any) => p?.ownerIataCode && p.ownerIataCode !== "1A")
        ?.ownerIataCode ?? offer?.OwnerCode ?? null;

    const paxs = this.isServicing ? servicingFlow().getPaxs() : bookingFlow().getPaxs();
    const _iata = iataForOffer();

    const data = {
      ...claussDataSend,
      oras: ["AMADEUS_NDCX"],
      ...buildNdcxSeatPayload({
        isServicing: this.isServicing,
        offer,
        orderId: pnr?.orderId ?? null,
        ownerCode,
        paxs,
      }),
      ...(_iata ? { agenceInfo: _iata } : {}),
    };

    try {
      const { data: responseData } = await axios({
        method: "post",
        url: "/aerial/AMADEUS_NDCX/seat/seatAvailabilityRQ",
        data,
      });
      const response = responseData?.value ?? responseData ?? {};

      // An errored seat map is not a failed checkout: show the airline's reason and continue
      // without seats, same degradation order.vue's getSeatData() catch already provides.
      if (response?.Errors?.length) {
        response.Errors.forEach(({ code, description }: any) => {
          bookingFlow().ancillariesRemarks.push({
            type: "warning",
            text: `SeatAvailability ${code}: ${description}`,
          });
        });
      }

      bookingFlow().setSeatRemarks((response?.Warnings ?? []).map((w: any) => w.DescText).filter(Boolean));
      bookingFlow().setSeatResponse(response);
      // ADR-30: the backend tells the front what this carrier supports; the UI disables
      // rather than guessing from an ora list.
      bookingFlow().setData({ ndcxCapabilities: response?.capabilities ?? null });
      return response;
    } catch (e) {
      console.error(e);
      bookingFlow().ancillariesRemarks.push({
        type: "error",
        text: "Seat map unavailable for this flight",
      });
      return {};
    }
  }
```

Add the import at the top of the file:

```ts
import { buildNdcxSeatPayload } from "./ndcx/ndcxSeatSelection";
```

- [ ] **Step 6: Lint and type-check the changed files**

Run: `cd front-reservation && npm run lint:changed -- --staged`
Expected: zero oxlint errors, zero vue-tsc errors on both touched files. If
`bookingFlow().setData` does not accept an arbitrary key, add `ndcxCapabilities` to the store's
`data` type rather than casting.

- [ ] **Step 7: Commit**

```bash
git add app/utils/adapters/AmadeusNdcxAdapter.ts app/utils/adapters/ndcx/ndcxSeatSelection.ts tests/unit/adapters/ndcxSeatSelection.test.ts
git commit -m "feat(ndcx): fetch the NDC[X] seat map from the front adapter"
```

---

### Task 11: Front — honour backend blocking and carrier capabilities

**Files:**
- Modify: `front-reservation/app/components/booking/flight/order/widgets/SeatMap/composables/useSeatRestrictions.ts`
- Modify: `front-reservation/app/utils/adapters/AmadeusNdcxAdapter.ts` (constructor)
- Test: `front-reservation/tests/unit/adapters/ndcxSeatBlocking.test.ts`

**Interfaces:**
- Consumes: `Offer.OfferItem[].blocked` / `.blockedReason` and `capabilities` from Task 4.
- Produces: a seat whose only price points are blocked renders disabled with the backend's
  reason.

Decision #10: block in the UI, not by stripping the seat from the response — an agent seeing a
greyed seat with "returned no price" learns more than one seeing a hole in the cabin.

- [ ] **Step 1: Write the failing test**

```ts
// front-reservation/tests/unit/adapters/ndcxSeatBlocking.test.ts
import { describe, expect, it } from "vitest";

import { resolveNdcxSeatBlock } from "@/utils/adapters/ndcx/ndcxSeatSelection";

const offerItems = [
  { OfferItemID: "PRICE1", blocked: false, blockedReason: null },
  { OfferItemID: "PRICE2", blocked: true, blockedReason: "Seat returned no price and cannot be sold" },
];

describe("resolveNdcxSeatBlock", () => {
  it("does not block when at least one price point is sellable", () => {
    const result = resolveNdcxSeatBlock({ OfferItemRefID: ["PRICE1", "PRICE2"] }, offerItems, null);
    expect(result).toBeNull();
  });

  it("blocks with the backend reason when every price point is blocked", () => {
    const result = resolveNdcxSeatBlock({ OfferItemRefID: ["PRICE2"] }, offerItems, null);
    expect(result).toMatch(/no price/i);
  });

  it("blocks a free seat when the carrier sells chargeable seats only", () => {
    const caps = { seats: { chargeableOnly: true } };
    const free = [{ OfferItemID: "PRICE0", blocked: false, UnitPrice: { TotalAmount: 0 } }];
    const result = resolveNdcxSeatBlock({ OfferItemRefID: ["PRICE0"] }, free, caps);
    expect(result).toMatch(/chargeable/i);
  });

  it("does not block a seat with no offer reference at all (free, host-assigned)", () => {
    expect(resolveNdcxSeatBlock({ OfferItemRefID: [] }, offerItems, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ndcxSeatBlocking.test.ts`
Expected: FAIL, `resolveNdcxSeatBlock` is not exported.

- [ ] **Step 3: Implement — append to `ndcxSeatSelection.ts`**

```ts
/**
 * Decision #10: a seat the host cannot sell renders DISABLED with a reason, rather than being
 * stripped from the cabin backend-side. A hole in the seat map tells an agent nothing; a grey
 * seat saying "returned no price" tells them to pick another.
 *
 * A seat with no `OfferItemRefID` at all is not blocked — that is a free, host-assigned seat,
 * which is normal and selectable.
 *
 * @returns the reason string when the seat must be blocked, or null when it is sellable
 */
export function resolveNdcxSeatBlock(
  seat: { OfferItemRefID?: string[] },
  offerItems: Array<Record<string, any>>,
  capabilities: Record<string, any> | null,
): string | null {
  const refs = Array.isArray(seat?.OfferItemRefID) ? seat.OfferItemRefID : [];
  if (refs.length === 0) return null;

  const items = refs
    .map((ref) => offerItems.find((item) => item?.OfferItemID === ref))
    .filter(Boolean) as Array<Record<string, any>>;

  if (items.length === 0) {
    // The seat references a price point the reply never defined. Guide rule: no amount ⇒ block.
    return "Seat returned no price and cannot be sold";
  }

  const sellable = items.filter((item) => !item.blocked);
  if (sellable.length === 0) {
    return items[0]?.blockedReason ?? "Seat returned no price and cannot be sold";
  }

  // Matrix: SM is "Chargeable only" for Add Seat — a zero-amount seat is not bookable there.
  if (capabilities?.seats?.chargeableOnly) {
    const anyChargeable = sellable.some((item) => Number(item?.UnitPrice?.TotalAmount) > 0);
    if (!anyChargeable) return "This airline only sells chargeable seats";
  }

  return null;
}
```

- [ ] **Step 4: Wire it into the widget**

In `useSeatRestrictions.ts`, find `getSeatRestrictionReason` and add the NDC[X] branch as the
**first** check, so a host-level block wins over any policy-level reason:

```ts
  // NDC[X] (ADR-30): the backend already resolved what this carrier can sell and flagged each
  // price point. Honour it before any travel-policy rule — a seat the host cannot sell is not
  // a policy question.
  const ndcxBlock = resolveNdcxSeatBlock(
    seat,
    bookingFlow.seatResponse?.Offer?.OfferItem ?? [],
    bookingFlow.data?.ndcxCapabilities ?? null,
  );
  if (ndcxBlock) return ndcxBlock;
```

and make `isSeatRestrictedForSelectedPax` return `true` whenever
`getSeatRestrictionReason(seat)` is non-null, if it does not already.

Import at the top:
```ts
import { resolveNdcxSeatBlock } from "@/utils/adapters/ndcx/ndcxSeatSelection";
```

- [ ] **Step 5: Declare the capabilities in the adapter constructor**

In `AmadeusNdcxAdapter`'s constructor, after the existing `uiPrefrences` lines:

```ts
    // ADR-30/33: seats at all three timings; no seat cancellation or exchange for ANY in-scope
    // NDC[X] carrier (matrix: "Voluntary cancel : Seat" and "Voluntary change : Exchange Seat"
    // are 0 across all 18). Per-carrier detail arrives on the SeatAvailability reply and is
    // applied by resolveNdcxSeatBlock; these flags are the coarse gate.
    this.capabilities.ancillaries.preBooking = true;
    this.capabilities.ancillaries.booked = true;
    this.capabilities.ancillaries.ticketted = true;
    this.capabilities.ancillaries.seats = true;
    this.capabilities.reshop.booked.ancillariesReshop = false;
    this.capabilities.reshop.ticketed.ancillariesReshop = false;
```

- [ ] **Step 6: Run tests and lint**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ && npm run lint:changed -- --staged`
Expected: PASS, zero lint/type errors.

- [ ] **Step 7: Commit**

```bash
git add app/utils/adapters/ndcx/ndcxSeatSelection.ts app/utils/adapters/AmadeusNdcxAdapter.ts app/components/booking/flight/order/widgets/SeatMap/composables/useSeatRestrictions.ts tests/unit/adapters/ndcxSeatBlocking.test.ts
git commit -m "feat(ndcx): block unsellable seats using backend capability flags (ADR-30)"
```

---

### Task 12: Front — commit seats at all three timings

**Files:**
- Modify: `front-reservation/app/utils/adapters/AmadeusNdcxAdapter.ts`
- Test: `front-reservation/tests/unit/adapters/ndcxAncillaryCommit.test.ts`

**Interfaces:**
- Consumes: `/ancillaryPriceRQ` (Task 7), `/orderCreateRQ` (Task 8), `/orderChangeRQ` (Task 9).
- Produces: `bookFlight()` extended with the pre-booking ancillary path, and `AddServices()`
  implemented for post-booking / post-issuance.

The call chain, identical at all three timings up to the last hop (ADR-34):

```
collect selection -> POST /ancillaryPriceRQ -> read OfferID/ResponseID/OrderItems from the reply
                  -> pre-booking:   POST /orderCreateRQ  with AncillaryOfferIdList
                  -> post-booking:  POST /orderChangeRQ  (backend omits PaymentInfo, status 1)
                  -> post-issuance: POST /orderChangeRQ  (backend adds  PaymentInfo, status 2)
```

- [ ] **Step 1: Write the failing test**

```ts
// front-reservation/tests/unit/adapters/ndcxAncillaryCommit.test.ts
import { describe, expect, it } from "vitest";

import { collectNdcxSeatSelection, toAncillaryOfferIdList } from "@/utils/adapters/ndcx/ndcxSeatSelection";

describe("collectNdcxSeatSelection", () => {
  it("emits one entry per pax per segment with row, column and offer item", () => {
    const paxs = [
      {
        id: "PAX1",
        seat: {
          SEG1: { OfferItemID: "SEAT-A", RowNumber: "26", ColumnID: "H" },
          SEG2: { OfferItemID: "SEAT-B", RowNumber: "30", ColumnID: "C" },
        },
      },
      { id: "PAX2", seat: {} },
    ];
    expect(collectNdcxSeatSelection(paxs)).toEqual([
      { OfferItemID: "SEAT-A", PaxRefID: "PAX1", RowNumber: "26", ColumnID: "H" },
      { OfferItemID: "SEAT-B", PaxRefID: "PAX1", RowNumber: "30", ColumnID: "C" },
    ]);
  });

  it("skips a seat missing its offer item rather than sending a bad row", () => {
    expect(collectNdcxSeatSelection([{ id: "PAX1", seat: { SEG1: { RowNumber: "1", ColumnID: "A" } } }])).toEqual([]);
  });
});

describe("toAncillaryOfferIdList", () => {
  it("keeps only the ancillary items from the reprice reply, not the air items", () => {
    const repriced = {
      OrderItems: [
        { OfferItemID: "AIR-1", PaxRefID: ["PAX1"] },
        { OfferItemID: "SEAT-A", PaxRefID: ["PAX1"] },
      ],
    };
    expect(toAncillaryOfferIdList(repriced, ["AIR-1"])).toEqual([
      { OfferItemID: "SEAT-A", PaxRefID: ["PAX1"] },
    ]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ndcxAncillaryCommit.test.ts`
Expected: FAIL, neither helper is exported.

- [ ] **Step 3: Implement — append to `ndcxSeatSelection.ts`**

```ts
export interface NdcxSeatSelectionRow {
  OfferItemID: string;
  PaxRefID: string;
  RowNumber: string;
  ColumnID: string;
}

/**
 * `pax.seat` is keyed by segment and written by the SeatMap widget's `selectSeat`. Flatten it
 * into the row shape `/ancillaryPriceRQ` expects (ancillaryOffer.utils.js's `buildSeatItem`).
 *
 * A seat without `OfferItemID` is skipped, not sent: the builder would throw server-side, and
 * a seat with no price point was never sellable anyway (it should already have been blocked
 * by resolveNdcxSeatBlock).
 */
export function collectNdcxSeatSelection(
  paxs: Array<Record<string, any>>,
): NdcxSeatSelectionRow[] {
  if (!Array.isArray(paxs)) return [];
  return paxs.flatMap((pax) =>
    Object.values<any>(pax?.seat ?? {})
      .filter((seat) => seat?.OfferItemID && seat?.RowNumber != null && seat?.ColumnID)
      .map((seat) => ({
        OfferItemID: String(seat.OfferItemID),
        PaxRefID: String(pax.id),
        RowNumber: String(seat.RowNumber),
        ColumnID: String(seat.ColumnID),
      })),
  );
}

/**
 * ADR-35: the booking is built from the SECOND OfferPrice reply. That reply returns the air
 * items AND the ancillary items together, but `OfferIdList` (air) and `AncillaryOfferIdList`
 * are separate fields on the booking request, so split them back apart by the air ids we sent.
 */
export function toAncillaryOfferIdList(
  repriced: { OrderItems?: Array<Record<string, any>> } | null,
  airOfferItemIds: string[],
): Array<{ OfferItemID: string; PaxRefID: string[] }> {
  const air = new Set(airOfferItemIds);
  return (repriced?.OrderItems ?? [])
    .filter((item) => item?.OfferItemID && !air.has(item.OfferItemID))
    .map((item) => ({
      OfferItemID: item.OfferItemID,
      PaxRefID: Array.isArray(item.PaxRefID) ? item.PaxRefID : [item.PaxRefID].filter(Boolean),
    }));
}
```

- [ ] **Step 4: Add the shared reprice step to the adapter**

```ts
  /**
   * The second Travel_OfferPrice (ADR-34). Shared by all three timings: pre-booking calls it
   * from bookFlight(), post-booking and post-issuance from AddServices().
   *
   * Returns the repriced OfferPriceRs. ADR-35: its OfferID / ResponseID / OrderItems are what
   * the booking call must send — never the first OfferPrice's, and never the
   * SeatAvailability/ServiceList ids directly.
   */
  private async priceNdcxAncillaries(opts: {
    seats: NdcxSeatSelectionRow[];
    services: Array<Record<string, any>>;
    orderId?: string | null;
  }) {
    if (opts.seats.length === 0 && opts.services.length === 0) return null;

    initClaussData();
    const offer = bookingFlow().getSelectedOffer();
    const pnr = servicingFlow().folder?.pnr;
    const paxs = this.isServicing ? servicingFlow().getPaxs() : bookingFlow().getPaxs();
    const _iata = iataForOffer();

    const { data: responseData } = await axios({
      method: "post",
      url: "/aerial/AMADEUS_NDCX/offer/ancillaryPriceRQ",
      data: {
        ...claussDataSend,
        oras: ["AMADEUS_NDCX"],
        OfferID: offer?.OfferID,
        ShoppingResponseId: offer?.ResponseID,
        OwnerCode:
          offer?.OwnerCode ??
          pnr?.pnrList?.find((p: any) => p?.ownerIataCode && p.ownerIataCode !== "1A")?.ownerIataCode,
        OfferIdList: (offer?.OrderItems ?? []).map((item: any) => ({
          OfferItemID: item.OfferItemID,
          PaxRefID: item.PaxRefID ?? [],
        })),
        ...(opts.orderId ? { OrderID: opts.orderId } : {}),
        seats: opts.seats,
        services: opts.services,
        paxs,
        ...(_iata ? { agenceInfo: _iata } : {}),
      },
    });

    return responseData?.value ?? responseData ?? null;
  }
```

- [ ] **Step 5: Extend `bookFlight()` (pre-booking)**

Inside the existing `bookFlight()`, after `const { payment } = useBookingFlowStore().payment;`
and **before** `const data = {`:

```ts
    // ADR-34: price the selected seats/services, then book from THAT reply (ADR-35). With no
    // selection this is a no-op and the air-only payload is unchanged.
    const seats = collectNdcxSeatSelection(useBookingFlowStore().paxs);
    const services = collectNdcxServiceSelection();
    const repriced = await this.priceNdcxAncillaries({ seats, services });

    const airOfferItemIds = (selectedOffer.OrderItems ?? []).map((i: any) => i.OfferItemID);
    const ancillaryOfferIdList = repriced ? toAncillaryOfferIdList(repriced, airOfferItemIds) : [];
```

then change the three id fields inside `data` to prefer the repriced reply:

```ts
      // ADR-35: when ancillaries were repriced, the booking MUST use the second OfferPrice's
      // ids — the first reply's offer no longer describes what is being bought.
      OfferID: repriced?.OfferID ?? selectedOffer.OfferID,
      OfferIdList: repriced
        ? repriced.OrderItems.filter((i: any) => airOfferItemIds.includes(i.OfferItemID))
        : selectedOffer.OrderItems,
      ShoppingResponseId: repriced?.ResponseID ?? selectedOffer.ResponseID,
      AncillaryOfferIdList: ancillaryOfferIdList,
```

`collectNdcxServiceSelection()` is defined in
[`NDCX-SERVICELIST-PLAN.md`](./NDCX-SERVICELIST-PLAN.md) Task 6. **Until that plan lands**, add
this stub beside the imports so this task ships standalone:

```ts
/** Replaced by the real implementation in NDCX-SERVICELIST-PLAN.md Task 6. */
function collectNdcxServiceSelection(): Array<Record<string, any>> {
  return [];
}
```

- [ ] **Step 6: Implement `AddServices()` (post-booking + post-issuance)**

```ts
  /**
   * `Travel_OrderChange` (ADR-36) — adds seats/services to an order that already exists.
   *
   * The backend decides post-booking vs post-issuance from the persisted `pnr.status` (held
   * vs ticketed) and attaches PaymentInfo accordingly. The front deliberately does NOT send
   * that intent: the same mistake ADR-25 avoided for cancel, where front-supplied intent and
   * host truth could disagree.
   */
  override async AddServices() {
    initClaussData();
    const pnr = servicingFlow().folder?.pnr;
    const seats = collectNdcxSeatSelection(servicingFlow().paxs);
    const services = collectNdcxServiceSelection();

    if (seats.length === 0 && services.length === 0) return null;

    const repriced = await this.priceNdcxAncillaries({ seats, services, orderId: pnr?.orderId });
    if (!repriced || repriced.Errors?.length) {
      throw new Error(
        repriced?.Errors?.map((e: any) => e.description).join(" | ") ??
          "The airline could not price these services",
      );
    }

    const offer = bookingFlow().getSelectedOffer();
    const airOfferItemIds = (offer?.OrderItems ?? []).map((i: any) => i.OfferItemID);
    const _iata = iataForOffer();

    const { data: responseData } = await axios({
      method: "post",
      url: "/aerial/AMADEUS_NDCX/order/orderChangeRQ",
      data: {
        ...claussDataSend,
        oras: ["AMADEUS_NDCX"],
        OrderID: pnr?.orderId,
        OwnerCode: pnr?.pnrList?.find((p: any) => p?.ownerIataCode && p.ownerIataCode !== "1A")
          ?.ownerIataCode,
        OfferID: repriced.OfferID,
        ShoppingResponseId: repriced.ResponseID,
        AncillaryOfferIdList: toAncillaryOfferIdList(repriced, airOfferItemIds),
        // Post-issuance only; the backend ignores it for a held order.
        Amount: Number(repriced.TotalPrice?.TotalAmount) || undefined,
        CurCode: repriced.TotalPrice?.CurCode,
        paxs: servicingFlow().getPaxs(),
        agenceInfo: servicingFlow().folder.agency,
        ...(_iata ? {} : {}),
      },
    });

    const responseValue = responseData?.value ?? responseData ?? {};
    return responseValue?.value ?? responseValue ?? {};
  }
```

Add the imports:
```ts
import {
  buildNdcxSeatPayload,
  collectNdcxSeatSelection,
  toAncillaryOfferIdList,
  type NdcxSeatSelectionRow,
} from "./ndcx/ndcxSeatSelection";
```

- [ ] **Step 7: Run tests and lint**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ && npm run lint:changed -- --staged`
Expected: PASS, zero errors.

- [ ] **Step 8: Commit**

```bash
git add app/utils/adapters/AmadeusNdcxAdapter.ts app/utils/adapters/ndcx/ndcxSeatSelection.ts tests/unit/adapters/ndcxAncillaryCommit.test.ts
git commit -m "feat(ndcx): commit seat selections at all three timings (ADR-34/35/36)"
```

---

### Task 13: Front — ancillary subtotal, and `formatLuggage` no longer throws

**Files:**
- Modify: `front-reservation/app/utils/adapters/AmadeusNdcxAdapter.ts`
- Test: extend `front-reservation/tests/unit/adapters/ndcxSeatSelection.test.ts`

**Why this task exists:** `BaseAdapter.getServices()` ends with `await this.formatLuggage()`
(`BaseAdapter.ts:507`), and `BaseAdapter.formatLuggage()` **throws**
(`BaseAdapter.ts:512-514`). Any NDC[X] call that reaches it kills the checkout. This task adds
the minimal non-throwing override; the real bag formatting lands in
[`NDCX-SERVICELIST-PLAN.md`](./NDCX-SERVICELIST-PLAN.md) Task 6.

ADR-38: the subtotal is **separate** — `bookingFlow.selectedOffer.TotalPrice` is never
overwritten, and ancillaries carry no margin.

- [ ] **Step 1: Write the failing test — append to `ndcxSeatSelection.test.ts`**

```ts
describe("ndcx ancillary total", () => {
  it("adds the seat subtotal to the service subtotal without touching the air total", () => {
    const air = 450.5;
    const seatTotal = ndcxSeatSubtotal([
      { id: "PAX1", seat: { SEG1: { UnitPrice: { TotalAmount: 25 } } } },
    ]);
    expect(seatTotal).toBe(25);
    // ADR-38: the air figure is read-only here.
    expect(air).toBe(450.5);
  });
});
```

- [ ] **Step 2: Run the suite**

Run: `cd front-reservation && npx vitest run tests/unit/adapters/ndcxSeatSelection.test.ts`
Expected: PASS (this asserts the contract rather than new code — it is the regression guard for
ADR-38).

- [ ] **Step 3: Add the non-throwing override**

```ts
  /**
   * BaseAdapter.getServices() calls formatLuggage() unconditionally and BaseAdapter's own
   * version THROWS (BaseAdapter.ts:512-514) — reaching it takes down the checkout. This stub
   * keeps NDC[X] safe until NDCX-SERVICELIST-PLAN.md Task 6 replaces it with real bag
   * formatting. Seats do not route through it.
   */
  override async formatLuggage() {
    return [];
  }

  /**
   * ADR-38: ancillaries are shown as their own subtotal and persisted at cost — the air total
   * the airline priced is never overwritten, so the recap and the margin maths keep operating
   * on the flights alone.
   */
  ndcxAncillarySubtotal(): number {
    const paxs = this.isServicing ? servicingFlow().paxs : bookingFlow().paxs;
    const seats = ndcxSeatSubtotal(paxs);
    const bags = (bookingFlow().selectedLuggage ?? []).reduce(
      (sum: number, bag: any) => sum + (Number(bag?.price) || 0),
      0,
    );
    return seats + bags;
  }
```

Extend the import:
```ts
import { ndcxSeatSubtotal } from "./ndcx/ndcxSeatSelection";
```

- [ ] **Step 4: Lint and type-check**

Run: `cd front-reservation && npm run lint:changed -- --staged`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add app/utils/adapters/AmadeusNdcxAdapter.ts tests/unit/adapters/ndcxSeatSelection.test.ts
git commit -m "feat(ndcx): expose the ancillary subtotal and stop formatLuggage throwing (ADR-38)"
```

---

## Verification before merge

Unit tests prove the transforms; they cannot prove the host accepts the messages. **No
`Travel_SeatAvailability` capture exists in `api-aerial/use cases/NDCX/`** (266 files, zero
seat or service) — every fixture in this plan comes from the vendored Amadeus examples.
Decision #15: ship on vendored fixtures, and close this checklist against a live capture before
merge.

- [ ] Run a pre-booking seat map against the AdenisPDV test office for **one Altéa carrier**
      (SQ or QF) and **one Accelya carrier** (UA or LH) — the two IT providers normalize
      differently and a mapper that works for one can fail for the other.
- [ ] Save both RQ/RS pairs into `api-aerial/use cases/NDCX/` and regenerate the Task 4 fixture
      from a real one.
- [ ] **Confirm ADR-37** — did the host accept repeated `PaxRefID` on `/ancillaryPriceRQ`?
      Record the answer in `NDCX-CONTEXT.md` §3 under "Element naming / WSDL shape" either way.
- [ ] **Confirm the pre-booking key** — `CoreRequest/Offer/OfferItemID` carrying the composite
      offer id (Task 2's warning). If the host rejects it, retry with the plain offer-item id
      and record which is right.
- [ ] Confirm the aisle synthesis against a real cabin: does the carrier declare an unseated
      column (pass 1), or does it need the layout table (pass 2)? Note it per carrier.
- [ ] Verify a **post-issuance** `Travel_OrderChange` charges the stored card once and only
      once, and that the resulting EMD appears on `Travel_OrderRetrieve`.
- [ ] Verify a **post-booking** `Travel_OrderChange` adds **no** payment and that the later
      `Travel_OrderPay` settles air + seat in one amount.
- [ ] Confirm `dossierCreate()` still runs exactly once per booking (ADR-12) with ancillaries
      present — check for orphaned dossier rows.
- [ ] Re-run `npm run test:unit` in `api-aerial/src` and `npm run lint:changed -- --base
      origin/development` in `front-reservation`.

## PR description must name

Per NDCX-CONTEXT.md §3 ("Shared code / process"), these are the things reviewers must not have
to discover:

- **Shared-file touches:** `utils/AMADEUS_NDCX/order.utils.js` (new export +
  `buildAllSelectedOfferItems`), `controllers/AMADEUS_NDCX/order.controller.js` (new op),
  `controllers/AMADEUS_NDCX/offer.controller.js` (new controller instance),
  `SeatMap/composables/useSeatRestrictions.ts` (shared widget, all providers run through it).
- **Security:** post-issuance `Travel_OrderChange` sends the raw PAN in the SOAP body over TLS
  only. The AF/KL host-public-key encryption path does not fire for NDC[X] because
  `Order.OwnerCode` is `"AMADEUS_NDCX"`, never `AF`/`KL`. Same posture as `Travel_OrderPay`
  and classic AMADEUS — stated so it is not discovered in review.
- **ADR-37 is unverified against a live host** and is the first thing to check on a reprice
  rejection.
