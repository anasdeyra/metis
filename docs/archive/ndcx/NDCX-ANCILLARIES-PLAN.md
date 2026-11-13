# NDC[X] Non-Bag Ancillaries — meals, sports, lounge, fast track / priority, assistance

> **For agentic workers:** implement task-by-task; steps use checkbox (`- [ ]`) syntax.
> Read [`NDCX-CONTEXT.md`](./NDCX-CONTEXT.md) first, then [`NDCX-SERVICELIST-PLAN.md`](./NDCX-SERVICELIST-PLAN.md).
> **This plan extends that one.** Its Tasks 1–8 are implemented on `deyra-met2-2422` in both
> `api-aerial` and `front-reservation` (verified 2026-10-21). Ticket MET2-2422.

> **Implementation status (2026-10-21).** Tasks 0–11b are done on `deyra-met2-2422`, not
> pushed. **Task 12 (manual UI verification) is open.**
>
> | Repo | Commits | Content |
> |---|---|---|
> | `api-aerial` | `8c91289b9` `675ac1b86` `4b1ad129a` `b2bdad952` `6047ba115` `a2e54744e` | Tasks 1–6 |
> | `api-aerial` | `69e25a7a4` | live KQ fixture; ADR-82 H1 verified |
> | `api-aerial` | `632d7ec90` `2ceb1b09f` | `hostPaxs` on the OrderChange and on the servicing reprice |
> | `api-aerial` | `aab2b7ed3` | post-booking rows keyed on the stored host `paxId` |
> | `api-aerial` | `bb750d6cd` | no-op NDC[X] `requestAccessibility`, so the accessibility route can persist |
> | `front-reservation` | `ea7a07f57` `8e7654f5d` `48ca518dd` `04cb6066f` `58556925f` `e7b21dc78` | Tasks 7–11b |
> | `front-reservation` | `9ab0074da` | accessibility record saved after the airline accepts it; controller pinned to `AMADEUS_NDCX` |
>
> - The Task 0 runner subcommands live in the meta-repo, uncommitted.
> - **Earlier follow-ups, now closed:** the accessibility record save and the `PAX{n}`
>   persistence assumption.
> - **Nothing known open besides Task 12.**

**Goal.** Sell and display the non-bag ancillaries NDC[X] actually returns: special meals,
sports equipment, lounge access, fast track / priority, and passenger-assistance SSRs. Cover
checkout, held orders and ticketed orders. Reuse the existing front widgets (`MealService`,
`OtherExtras`, `LoungeService`, pax-details accessibility) rather than building new UI.

**Why the ServiceList plan's ADR-40 is no longer enough.** ADR-40 parked everything that is
not a bag in a generic "other" bucket, based on three trimmed captures. A live survey on
2026-10-21 (§0) found four things that change the design:

1. The host returns **20–83 service definitions per itinerary**.
2. On Altéa carriers, `Description[]` is **machine-readable ATPCO data**, not prose.
3. The second `Travel_OfferPrice` **silently drops free services**.
4. The generic bucket was never rendered. Non-bag items are fetched today and then discarded
   (§0.3).

**Architecture.** Three layers, each covered by pure unit tests:

| Layer | Where | What |
|---|---|---|
| Classification v2 + exposure + variant collapsing | `api-aerial` ServiceList mapper | One authority decides *what a service is* and *whether metis sells it* |
| Free / chargeable booking split | `api-aerial` OfferPrice / OrderCreate / OrderChange builders | Chargeable services go through the existing 2nd OfferPrice. Free services skip it and are booked straight from the ServiceList ids, never with `PaymentInfo` |
| Rendering | `front-reservation` | One pure helper module feeds the **existing** store contracts, plus small gate fixes in 4 widgets. Persistence tags the rows so the folder page shows them |

**Stack / commands.** Same as the ServiceList plan. Backend: `cd api-aerial/src && node --test <file>`
and `npm run test:unit`. Front: `cd front-reservation && npx vitest run <file>` and
`npm run lint:changed -- --staged`.

**Authority.** Where this plan disagrees with `.agents/skills/ndcx/references/13-ancillaries-and-seats.md`,
the **live captures named in §0** win, because the guide never shows a non-bag service.

---

## 0. Evidence

### 0.1 Live survey: 2026-10-21, test office NCEPF3273, 1 ADT, round trip 07/14 Dec 2026

Each carrier ran `shop → price → Travel_ServiceList` through the app's own builders and
mappers. The calls were read-only; no order was created. Raw RS XML is in
`api-aerial/use cases/NDCX/` (gitignored), named by the prefix below.

| Carrier | Route | ServiceList RS | Defs / items | Families seen |
|---|---|---|---|---|
| LO | PAR-WAW | `8207422974936` | 19 / 34 | bags · lounge `BLNY` · chargeable F&B `CLML` `TMML` · fast track `FAST` · firearms/ammo `WEAP` `AMMO` · assistance (WCHR/WCHS/WCHC/WCMP/BLND/DEAF) |
| QF | SYD-MEL | `8207422954021` | 3 / 3 | extra bag (`ASVC`) · domestic name change (no flight association → already blocked) |
| EY | PAR-AUH | `8207422935068` | 38 / 76 | kg bags `XWBG` · lounge `LBZA` · priority `PRIO` · 20 special meals incl. `AVCH` `CVML` · assistance · `BSCT` `INFT` |
| AI | PAR-DEL | `8207422914814` | 39 / 85 | bags · carry-on `COPL` · excess weight/size `HPBG` `OVBG` · sports `SPEQ` · name change · fare lock `TIME` · insurance `TRIN` · meals · assistance |
| KQ | PAR-NBO | `8207422894628` | 83 / 169 | bags · sports `BIKE` `SNWB` `SURF` `BFSH` · ammo · lounge `LOUN` · upgrades · UMNR · oxygen · carbon offset · stopover hotel · ticket immunity · meals · ~25 info SSRs |
| SV | PAR-RUH | `8207422871748` | 32 / 74 | bags · fast track `FSTK` (one item per **journey**) · name change · fare lock · meals · assistance · `FSFA` `MAAS` |
| AC | PAR-YMQ | `8207422826024` | 21 / 42 | meals · assistance only |
| SQ | SIN-LHR | `8208801402177` (+21 earlier) | 26 / 56 | kg bags · `PIEC` `BULK` `HEAV` · 18 meals · `BSCT` · WCHR/BLND/DEAF |

- **No NDC offer on this office:** LH, UA, TP, SK, TU, VY, MH, BR.
- **Never observed anywhere:** pets (`PETC`/`AVIH`, ATPCO group `PT`) and wifi/IFE (group `IE`).
- **Skill captures used:** `servicing/AF-Bag-Seat-After-Pricing-2nd-OfferPrice/44-Reply-Travel-ServiceList.xml`
  (AF meals and assistance), `servicing/SQ-Family-Add-Seats-and-Bags-Post-Payment/8---*` (free
  post-payment add), `servicing/SQ-Family-Bag-in-Weight-PreBooking/5-Query-Travel-OrderCreate.xml`.

### 0.2 Wire facts (cite these by number in code comments)

**F1. On Altéa carriers, the `Description[]` of a chargeable service is ATPCO data, by `DescID`:**

| DescID | Meaning | Values seen |
|---|---|---|
| 1 | chargeability | `Chargeable` / `Free` |
| 2 | ATPCO S5 service type | `F` flight-related · `P` prepaid baggage · `C` baggage charge · `M` merchandise |
| 3 | (unused here) | `01` / `02` |
| 4 | **ATPCO group** | `BG` baggage · `ML` meal · `LG` lounge · `TS` travel services · `UP` upgrade · `UN` unaccompanied minor · `MD` medical · `GT` ground transport · `CO` carbon · `RO` rule override · `SA` seat |
| 5+ | **subgroups** | `SP` sporting equipment (+ `BI` bike, `SW` snowboard, `WS` windsurf, `FI` fishing, `AM` ammunition, `FA` firearm) · `CY` carry-on · `X0`…`X9` excess · `B1`…`B4` additional piece · `FT` fast track · `PO` priority · `NC` name change · `FG` fare guarantee · `TI` insurance |

Examples: LO lounge `Chargeable|F|01|LG|WT` · LO fast track `…|TS|FT` · EY priority
`…|TS|PO` · KQ bike `Chargeable|F|01|BG|SP|BI` · LO ammunition `Chargeable|C|01|BG|SP|AM|05`.

**F2. Free SSRs are `Description = ["Free", "<CATEGORY[,CATEGORY]>"]`.**
- Categories seen: `MEAL`, `MEDICAL`, `PAX ASSISTANCE`, `PASSENGER ASSISTANCE`, `PAXINFO`,
  `PAXINFO,MEDICAL`, `SEAT`, `GROUP`, `BAGGAGE`.
- Carriers file wheelchairs inconsistently: KQ/SV/AC under `PAXINFO`, EY/LO under `MEDICAL`,
  AI/SQ under `* ASSISTANCE`.
- Every free item is `0`, priced **per pax per segment**, and still carries
  `AddlDataMeasure UnitCode="n"` = `1`.

**F3. Non-Altéa shapes.**
- **QF:** every service has SSR `ASVC`. The group and subgroup live **inside
  `ServiceDefinitionID`** (`C-OC-0CC-L891DD127-BG-B1-QF`). It also adds
  `BookingInstructions/Method` (`SSR`/`API`) and `Detail/ServiceItemQuantityRules/MaximumQuantity`.
- **AF capture:** every meal has `Name` `"MEAL"`; the meal code sits only in
  `Description`/`SSRCode`.
- **SQ OrderView:** carries `ServiceCode` instead of `BookingInstructions/SSRCode`
  (`AVML_1`, `WCHR_1`).

**F4. One product appears as several definitions and several coverages.**
- AI "SPORT EQUIPMENT" exists as `SRV13` (type F), `SRV29` (C) and `SRV42` (P).
- `SRV13` alone is offered on SEG3 at 40.18, on SEG15 at 40.18, and on SEG3+SEG15 at 80.36.
- KQ `BIKE`, `AMMO` and `WEAP` follow the same pattern.

**F5. Coverage depends on the family.**
- Meals, assistance SSRs and lounges are **per segment**. A lounge is often outbound only
  (LO, KQ: 1 item).
- SV fast track is **one item for a 2-segment journey**.

**F6. 🔴 The 2nd `Travel_OfferPrice` silently drops free services.** No `Error` and no
`Warning` is returned:

| Capture (RQ/RS) | Sent | Returned |
|---|---|---|
| AI `8207422706221` | AVML, WCHR without `Qty`; SPEQ with `Qty 1` | air + SPEQ 40.18 |
| AI `8207422667432` | same, `Qty 1` on the free items too | air + SPEQ 40.18 |
| KQ `8207422686136` | VGML, WCHR, BIKE, LOUN | air + BIKE 110.00 + LOUN 35.66 |

Today `toAncillaryOfferIdList(repriced, …)` books from that reply, so any free service that
went through the reprice **would vanish at OrderCreate**.

**F7. A free service is added after payment without reprice and without payment.**
`SQ-…-Post-Payment/8---Travel-OrderChange-free-Ancillaries--1.xml` has:
- `SelectedOffer/OfferID` = the **ServiceList** `ALaCarteOffer/OfferID` (`SP1P-…-1`);
- `ShoppingResponseRefID` = the ServiceList `ShoppingResponseID`;
- **no `PaymentInfo`**, even though the order was paid at step 4. Each meal and wheelchair is
  a `SelectedOfferItem` per pax per segment.

**F8. Pre-booking OrderCreate merges ServiceList item ids into the air `SelectedOffer`.**
`SQ-…-PreBooking/5-Query-Travel-OrderCreate.xml` sends the air items and `SP2F-…-1-2..5`
under one `OfferID`.

**F9. Chargeable non-bag services already price correctly through the existing 2nd
OfferPrice.** SPEQ 40.18, BIKE 110.00 and LOUN 35.66 come back as `OrderItems` under their
own `OfferItemID` (F6 captures).

**F10. The current classifier is wrong on live data** (`serviceClassification.js:24-34,54`):

| Live item | Today | Should be | Why |
|---|---|---|---|
| KQ "TICKET IMMUNITY" `A/0A2` `RESA` 89.16 € | **bag** ❌ | financial (hidden) | RFISC prefix `0A` matched without checking RFIC (A = air transportation) |
| KQ "EXCESS BAGGAGE REQUEST" `Free/BAGGAGE` `XBAG` 0 € | **bag** ❌ | info SSR (hidden) | free request, not a sellable bag |
| EY `LBZA`, LO `BLNY` lounges | other | lounge | only `LOUN`/`LNGE` are known |
| EY `AVCH`, `CVML` | other | meal | missing from the meal list |
| KQ `SNWB`, `BFSH` | other | sports | missing from the sports list |
| LO `FAST`, SV `FSTK`, EY `PRIO` | other | fast track / priority | no such family |
| WCHR/WCHS/BLND/DEAF/… | other | accessibility | no such family |

The two ❌ rows are **live bugs today**: both items pass `formatNdcxLuggageOptions` and show
up in the luggage UI.

**F11. Task 0 spike, live on KQ PAR-NBO, 2026-10-21.** Held order `KQ706ZDY7VP00`
(PNR ZDY7VP / 1A ZDYOW7), **cancelled the same session** (post-cancel retrieve: `119`).
- **Create (H1 ✅).** VGML ×2 and WCHR ×2 were sent as `FreeServiceOfferIdList` in the merged
  `SelectedOffer`, next to the air item and a repriced BIKE (110.00). On `Travel_OrderRetrieve`
  each came back as its own OrderItem (`…_FSSR8..11`), HK, price 0, with
  `ServiceDefinitionRef/PaxSegmentRefID`. The BIKE came back as `…_SRV14`, 110.00.
- **Free-only change (ADR-83 ✅).** BLND on both segments, sent with no `PaymentInfo`, came
  back as `…_FSSR39/40`. The `Service/ServiceID`s are identical on the change reply and the
  retrieve, so the `updateOrCreate` key holds.
- **🔴 Host pax renumbering, live.** Our `PAX1` became the host's `PAX2` after create. The
  order-keyed ServiceList returns items for `PAX2` only, and `ShoppingResponseID` is
  `NOT_USED` even post-booking on KQ. The change only went through with host ids in
  `DataLists/PaxList`.
  - Backend fixed: commit `632d7ec90` adds `body.hostPaxs`.
  - Front: servicing maps pax → host id through `pax.idDataPax` (Tasks 8/11b).
- **OrderView definitions** carry the SSR code but no `Chargeable`/`Free` head. The mapper
  still tags them `MEAL`, `ACCESSIBILITY` and `SPORT-BI CYCLE`.
  - The retrieve is vendored as `__tests__/fixtures/servicelist-live/kq-orderview-live.json`
    (commit `69e25a7a4`).
- Captures are under `api-aerial/use cases/NDCX/` (gitignored). The spike outputs are in the
  session scratchpad (`spike/out*`).

### 0.3 Current state: what exists and what is missing

**Backend** (`api-aerial`, `deyra-met2-2422`):
- `serviceListReply.mapper.js:212` adds `Desc: ["LOUNGE", label]` only for `type === "lounge"`.
  `resolveBlock` (`:137`) blocks only chargeable partial coverage.
- `ancillaryOffer.utils.js:159` `buildServiceItem` sends **every** service row to the 2nd
  OfferPrice. Because of F6, that loses free items.
- `orderChange.utils.js:98` attaches `PaymentInfo` whenever `pnr.status === 2`. Then `:178`
  throws when `Amount <= 0`, so **adding a free meal to a ticketed order fails** with "Amount
  is required to change a ticketed order".
- `orderChange.utils.js:300` `buildNdcxServiceRows` writes `name: "Service"`,
  `serviceType: null` and no `serviceDefinitionIdPax`. As a result:
  - the rows are **invisible** on the folder page (`TablePnr.vue:802-807` keeps only rows
    with a `serviceType`, except SABRE);
  - they are **duplicated** by the next retrieve sync, because
    `service-aerial.service.js updateOrCreate` keys on
    `dossierTravelerId + serviceDefinitionIdPax`.
- `dossier.utils.js` sets `serviceType` from `Name` text alone (tags `MEAL`, `SPORT`,
  `LOUNGE`, `WCHR`…), at `:2431` in `dossierCreateInner` and `:6049` in `saveAfterRetreive`.
  "BICYCLE", "FAST TRACK" and "BUSINESS LOUNGE UP TO 4 HOURS" all come out as `null`, so they
  are hidden.
- The create path `bulkCreate` (`service-aerial.service.js:22`) **drops** rows that have no
  `segmentId`, unless they are SAF or LOUNGE.
- `orderViewReply.mapper.js:163` `buildServiceDefinition` deletes `Description` once it has
  read `Desc`, so the ATPCO data (F1) is gone before `dossier.utils.js` runs.
- `carrierCapabilities.js:38` has one `other` boolean per carrier. It does not distinguish
  free from chargeable, and it ignores the post-payment matrix row.

**Front** (`front-reservation`, `deyra-met2-2422`):
- `AmadeusNdcxAdapter.ts:94-98` sets `meals`, `lounge` and `sports` to `false`. The comment
  there promises a generic bucket that does not exist.
- `getServices()` (`:653`) stores the whole reply. `formatLuggage()` (`:745`) maps bags only;
  **nothing maps the other items into the store.**
- `collectNdcxServiceSelection()` (`:24`) returns `selectedLuggage` only. `bookFlight()`
  (`:320`) and `AddServices()` (`:588`) therefore book bags and seats only.
- Widget gaps:
  - `OrderServices.vue:167-190` `hasLoungeData` calls `.toUpperCase()` on NDC[X]'s `Desc`
    **array**, so it is always false.
  - `OrderServices.vue:854-885` and `OtherExtras.vue:48-53` hardcode the LCC ora list.
  - `LoungeService.vue:29-62` takes the **first** lounge definition only and compares a
    scalar `segRef` with NDC[X]'s **array**.
  - `MealService.vue:159-205` recognises a meal only when `Name` contains "MEAL", which misses
    SQ "FRUIT PLATTER". It uses `Desc` joined as `title`, so `data/meals.json` (keyed by SSR
    code) never matches and the detail card never renders.
- `OrderRecap.vue:222` `getPaxServicePrice` never sums `selectedOtherExtras`. A meal whose
  `offer` is `null` makes the total `NaN`.

---

## 1. Scope decisions

| Tier | Families | Rationale |
|---|---|---|
| **1: sell in this plan** | special meals, **free and paid** (free SSR category `MEAL`; paid ATPCO group `ML`, e.g. LO cake/prosecco); sports equipment **including firearms and ammunition** (`BG/SP` with any subgroup; `WEAP`, `AMMO`); lounge (`LG`); fast track (`TS/FT`, `FAST`, `FSTK`); priority (`TS/PO`, `PRIO`); assistance SSRs (`WCHR` `WCHS` `WCHC` `WCMP` `WCOB` `WCBD` `WCBW` `WCLB` `BLND` `DEAF` `DPNA` `MAAS`) | Observed on several carriers. Each has an existing front widget **and** an existing folder-page rendering (`ServiceDetail.vue`: MEAL, `SPORT-*`, LOUNGE, ACCESSIBILITY, FAST_TRACK, PRIORITY_BOARDING). **Decision 2026-10-21:** firearms/ammo are regular sporting-equipment ancillaries; paid meals extend the meal feature (ADR-89) |
| **2: classified, hidden, listed in `hiddenSummary`** | carry-on (`BG/CY`); excess weight/size (`BG/X*`); pets (`PT`, `PETC`/`AVIH`); bassinet `BSCT`; UMNR (`UN`); upgrades (`UP`); wifi (`IE`) | **Pets:** never observed. **BSCT:** depends on the seat map. **UMNR:** has its own workflow. **Upgrade:** reprices the fare. **Carry-on / excess:** the luggage UI has no slot for them (`carryOnLuggage = false`). `hiddenSummary` is **logged backend-side only** (decision 5) |
| **Never** | RFIC `D` (name change, fare lock, insurance, carbon offset); `RO` ticket immunity; `GT` stopover/hotel; `MD` oxygen (MEDIF); info SSRs (`DEPA` `DEPU` `INAD` `TWOV` `GRPF` `GPST` `FRAV` `RQST` `EXST` `SEMN` `ESAN` `STCR` `INFT` `FSFA`, free `BAGGAGE` requests); anything `blocked` | These are not ancillaries the agent sells: fare/ticket mechanics, host workflows, or seat-map features |

Open product questions are listed in §8. The Tier-2 list is a whitelist flip, not a redesign.

## 2. Front rendering map

| Family | Widget (reused) | Opened by | Store contract (existing) | Fed by (new, pure) | Booking row |
|---|---|---|---|---|---|
| meal (free and paid) | `widgets/MealService.vue` | `capabilities.ancillaries.meals && hasMealData` (`OrderServices.vue:762-792`) | `pax.meal[segIndex] = { item, offer, pj }` (`MealService.vue:277-315`) | raw `serviceResponse` plus the NDC[X] option branch (`ndcxMealOption`, title = SSR code so `data/meals.json` and i18n `meals.<CODE>` resolve; paid meals show their price) | free → `{ OfferItemID, PaxRefID, free, freeToken }`; paid → `{ OfferItemID, PaxRefID, Qty: 1 }` (ADR-89) |
| sports (incl. firearms/ammo) | `widgets/OtherExtras.vue`, "equipment" section (always rendered, `:290-370`) | the "Extras & Services" button (`OrderServices.vue:854-885`), opened by the new `capabilities.ancillaries.otherExtras` | `SportsEquipmentsOffers` / `selectedSportsEquipments` (`bookingFlowStore.ts:64-71`, one per pax+segment) | `formatNdcxSportsOffers` | **chargeable** → `{ OfferItemID, PaxRefID, Qty: 1 }` |
| fast track / priority | `widgets/OtherExtras.vue`, "other services" section (`:372+`) | same button, plus a new `showOtherServices` prop | `otherExtrasOffers` / `selectedOtherExtras`, `type: "fast-track" \| "priority-boarding"` (`bookingFlowStore.ts:82-92`) | `formatNdcxOtherExtras` | **chargeable** |
| lounge | `LoungeService/LoungeService.vue` | `capabilities.ancillaries.lounge && hasLoungeData` (`OrderServices.vue:830-852`) | `selectedLoungeOffers` (`bookingFlowStore.ts:418-442`) | raw `serviceResponse`; the widget is patched to take every lounge definition and array `segRef` | **chargeable** |
| assistance (checkout) | `AccessibilityComponent.vue` in pax details (`paxDetail.vue:840-842`) | always | `pax.accessibility { assistanceNeeded, wheelchairNeeded, wheelchairType: manual\|electric\|foldable, visualAssistance, audioAssistance }` | `mapNdcxAccessibility` (`manual→WCHR`, `electric→WCHS`, `foldable→WCHC`, `visual→BLND`, `audio→DEAF`; one row per segment) | **free** |
| assistance (held / ticketed order) | the **passenger modification dialog** (`ModificationVoyageurs.vue`, gated by `capabilities.accessibility.change` at `:793`; decision 3) | `accessibility.change` | same `accessibility` form shape | ServiceList keyed on the order, then `mapNdcxAccessibility` | **free** → `FreeOnly` OrderChange (Task 11b) |

- **Sports go through `OtherExtras`, not `SportsEquipments.vue`.** `OtherExtras` already
  renders an equipment section next to "other services", which is what LCC oras use. Turning
  on both buttons would show sports twice, so `capabilities.ancillaries.sports` stays `false`.
- **Recap and folder already exist:**
  - `OrderServices.vue` "Vos options supplémentaires" (`getMealForFlight`,
    `getSportsForFlight`, `getOtherExtrasForFlight`, `getLoungeForFlight`) matches on
    `journey === "DEP-ARR"`, which the formatters emit.
  - The folder page uses `ServiceDetail.vue` through `serviceType` (Task 6).
- **Servicing** (`folder/addService/addService.vue`) re-uses the same widgets and stores, so
  the same formatters cover held and ticketed orders.

## 3. ADRs introduced by this plan (ADR-78 … ADR-90)

ADR-1…59 and 60…77 are taken (see the sibling plans). **ADR-68/69 stay free**, as
`NDCX-PAYMENT-PLAN.md` reserved them.

| ADR | Decision |
|---|---|
| **ADR-78** | **Classification v2 is ATPCO-first**, in this order: free-SSR category (F2) → **legacy bag rule minus the RFIC false positive** → ATPCO group/subgroup (F1, plus the QF id tokens of F3) → SSR tables → RFIC → name keywords → `other`. **Bag invariant:** every live item typed `bag` today stays `bag`, except the two F10 false positives. ADR-41 unit semantics are untouched. |
| **ADR-79** | **Exposure is a closed whitelist** (§1 Tier 1), computed by the backend from family × carrier capability × timing. The front only renders `exposure.sell === true`. Everything else is counted in `hiddenSummary`, never silently dropped. |
| **ADR-80** | **Variant collapsing** (F4): for non-bag items, among items with the same `type + SSR/label + pax + segment set`, keep the cheapest (tie-break: ATPCO type `P` < `F` < `C` < `M` < none). A multi-segment item whose segments are all covered by kept single-segment items is redundant. Result: `item.preferred`. Bags are never touched (`preferred: null`). |
| **ADR-81** | **Free services never go to the 2nd `Travel_OfferPrice`** (F6). `createNdcxAncillaryOfferPricePayload` rejects a `free: true` row loudly. If the selection is free only, no reprice is sent at all. |
| **ADR-82** | **Pre-booking: free items are appended to the merged `SelectedOffer` of `Travel_OrderCreate`** (F8) as `FreeServiceOfferIdList`, after the repriced ancillaries. ✅ **Verified live, H1** (KQ, 2026-10-21, see F11). Fallbacks remain documented for a carrier that ever refuses: H2 (a second `SelectedOffer` on the ServiceList offer id), then H3 (a post-create free `OrderChange`). |
| **ADR-83** | **Post-booking and post-issuance: free items get their own `Travel_OrderChange`.** It is built from the **ServiceList** `OfferID`/`ShoppingResponseID`, with **no `PaymentInfo` at any status** (F7). A mixed selection becomes two changes, chargeable first. The front re-retrieves the order before it offers a retry (rule 11). Every item in a `FreeOnly` change must carry a valid ADR-90 token. |
| **ADR-84** | Capabilities gain `freeServices.{preBooking,postBooking,postIssuance}` and a post-payment-aware `otherServices`, transcribed from the four matrix rows quoted in Task 3. The backend applies them inside exposure (ADR-79); the front never re-derives them. |
| **ADR-85** | **Persistence:** `orderViewReply.mapper.js` classifies each definition **before** deleting `Description`, and attaches `ndcxServiceType`. `dossier.utils.js` reads it through **one additive `case` at the top** of each name-based `switch(true)` on an NDC[X] path; the field is inert for other oras. `buildNdcxServiceRows` writes the same `serviceDefinitionIdPax` key and taxonomy, through `updateOrCreate`. |
| **ADR-86** | **Front reuses widgets.** A new capability flag `ancillaries.otherExtras` (default `false`) replaces the hardcoded ora lists as the gate. All NDC[X] logic lives in one pure module, `ndcx/ndcxExtrasSelection.ts`. |
| **ADR-87** | Assistance SSRs are collected from **pax details at checkout** and from the **passenger modification dialog on an existing order** (decision 3), never from an ancillary dialog. They are booked free, one row per segment. A missing item yields a per-pax warning, never a silent drop. |
| **ADR-88** | Labels: for meals and assistance the **SSR code is the display key** (`data/meals.json`, i18n `meals.<CODE>`), because AF names every meal "MEAL" (F3). Other families use `Name`. |
| **ADR-89** | **Paid meals** (decision 2) use the same meal family and `MealService` as free meals. The only difference is the booking path: amount `> 0` means chargeable (2nd OfferPrice, `Qty: 1`, `PaymentInfo` when ticketed). The persisted row keeps its host price: `orderViewReply.mapper.js` sets `srv.ndcxChargeable = true`, and the NDC[X]-only branch in `dossier.utils.js` bypasses the "MEAL ⇒ `totalprice "0"`, `status 2`" rule for those rows only. |
| **ADR-90** | **Decision on Q4: free items are signed server-side.** The ServiceList mapper adds `freeToken = HMAC-SHA256(key, OfferID \| OfferItemID \| PaxRefID \| "0")` to every item it priced at exactly `0`. The key is derived from `process.env.ENCRYPTION_KEY` with the domain label `"ndcx-free-service"`. `createNdcxOrderChangePayload` (`FreeOnly`) and `createNdcxOrderCreatePayload` (`FreeServiceOfferIdList`) verify each token with `crypto.timingSafeEqual` and refuse the call when one is missing or wrong. If `ENCRYPTION_KEY` is unset, fail closed. Why: a front bug that routes a chargeable item down the no-payment path would add an unpaid EMD to a ticketed order, which means an ADM for the agency. The token makes that impossible without depending on host behaviour, stays stateless, and costs no extra host call. It replaces Task 0's old "does the host refuse?" probe. |

## 4. File structure

**Backend (`api-aerial/src/`)**

| File | Change |
|---|---|
| `utils/AMADEUS_NDCX/serviceClassification.js` | **rewrite internals** (ADR-78). Same export; the output shape is extended, never narrowed |
| `utils/AMADEUS_NDCX/serviceListReply.mapper.js` | add `exposure`, `preferred`, `hiddenSummary`, `freeToken`, and `Desc` tags for every family |
| `utils/AMADEUS_NDCX/freeServiceToken.js` | **create**: ADR-90 mint/verify (`node:crypto` HMAC) |
| `utils/AMADEUS_NDCX/carrierCapabilities.js` | add `freeServices` and post-payment `otherServices` (ADR-84) |
| `controllers/AMADEUS_NDCX/service.controller.js` | resolve timing (pre / held / ticketed) and pass it to the mapper |
| `utils/AMADEUS_NDCX/ancillaryOffer.utils.js` | reject `free` rows (ADR-81) |
| `utils/AMADEUS_NDCX/order.utils.js` | `FreeServiceOfferIdList` appended in `buildAllSelectedOfferItems` (`:89`) (ADR-82) |
| `utils/AMADEUS_NDCX/orderChange.utils.js` | `FreeOnly` path: no `PaymentInfo`, no Amount guard; `buildNdcxServiceRows` taxonomy and key (ADR-83/85) |
| `controllers/AMADEUS_NDCX/order.controller.js` | `handleOrderChange` (`:847`): `FreeOnly` gate and `updateOrCreate` |
| `utils/AMADEUS_NDCX/orderViewReply.mapper.js` | `ndcxServiceType` in `buildServiceDefinition` (`:163`) |
| `utils/dossier.utils.js` | **shared:** one `case` at `:2431` and at `:6049` (and `forceRetrieve` `:11483` if an NDC[X] path reaches it, see Task 6) |
| `../.agents/skills/ndcx/scripts/ndcx_cert_runner.js` (meta-repo) | `services`, `ancprice` subcommands and `create --services` (Task 0) |

**Front (`front-reservation/app/`)**

| File | Change |
|---|---|
| `utils/adapters/ndcx/ndcxExtrasSelection.ts` | **create**: pure formatters and collectors (Task 7) |
| `utils/adapters/AmadeusNdcxAdapter.ts` | capabilities, `formatExtras()`, `getFormatedAccessibility()`, `bookFlight`/`AddServices` split |
| `utils/adapters/BaseAdapter.ts` | `capabilities.ancillaries.otherExtras = false` (new key, default off) |
| `components/booking/flight/order/OrderServices/OrderServices.vue` | `hasLoungeData` handles arrays; extras gate uses the capability |
| `components/booking/flight/order/widgets/OtherExtras.vue` | `showOtherServices` prop |
| `components/booking/flight/order/LoungeService/LoungeService.vue` | all lounge definitions, array `segRef`, `preferred` filter |
| `components/booking/flight/order/widgets/MealService.vue` | NDC[X] option branch, `preferred`/`blocked` filter, description fallback |
| `components/booking/flight/order/OrderRecap/OrderRecap.vue` | sum `selectedOtherExtras`; guard a null meal offer |
| `components/folder/**/ModificationVoyageurs.vue` | NDC[X] assistance add on an existing order (Task 11b) |
| `locales/*.json` | meal codes 12 → 30; NDC[X] extras labels |

---

## 5. Tasks

### Task 0: Live spike (blocks ADR-82, ADR-83 and Task 6's persistence assumptions)

Nothing here ships. This task adds the runner commands and produces captures and fixtures.
**It creates and cancels held test orders**, on the TEST host only; the runner already
refuses anything else.

- [ ] **Step 1: add `services` to `ndcx_cert_runner.js`.** Model it on the session probe
  `svc_probe.js` (see the appendix). It takes `st.offer`, sends `Travel_ServiceList` with
  `OfferIdList[].ServiceID = item.service.ServiceID`, and does three things:
  - writes `st.serviceList = mapped`;
  - prints one line per definition (`id | name | rfic/rfisc | ssr | type | exposure | n | price`);
  - with `--dump <dir>`, writes the **node-soap-parsed** reply JSON. That is exactly what the
    mapper sees in production, so use it for fixtures.
- [ ] **Step 2: add `ancprice --services AVML,SPEQ,…`.** It picks preferred single-segment
  items on the first segment and sends the 2nd OfferPrice. Re-run F6 on SQ, the carrier the
  existing pre-booking captures cover. **Expected:** free items dropped.
- [ ] **Step 3: add `create --services <SSR,…>`.**
  - Chargeable items: as `bookFlight` does (reprice, then `AncillaryOfferIdList`).
  - Free items: as `FreeServiceOfferIdList` (H1).
  - Then run `create → retrieve → cancel` on **KQ** (meals, wheelchair and BIKE on one
    order) and on **SQ** (AVML + WCHR).
- [ ] **Step 4: decide ADR-82 from the retrieve.**

| Observation on `Travel_OrderRetrieve` | Decision |
|---|---|
| Free items present as `OrderItem/Service` | **H1**: ADR-82 as written |
| OrderCreate rejects the free ids, or they are absent from the retrieve | **H2**: retry with a 2nd `SelectedOffer` whose `OfferID` = ServiceList `Offer.OfferID` (it differs from the air offer: AI `TOiEH…` vs `TOO67…`), `ShoppingResponseRefID` = ServiceList `ResponseID` |
| H2 also fails | **H3**: after OrderCreate, run post-booking ServiceList, then a free `OrderChange` (Task 5 path). Allowed only where the matrix row "Voluntary change : Add free services (Before payment)" = 1, which **excludes** QF, UA, LH, CX, EK, IB, 6E, VY |

- [ ] **Step 5: post-booking free add (F7 on our builder).** On a held KQ order:
  ServiceList keyed on the order, then `OrderChange` with WCHR + VGML through the Task 5
  builder (`FreeOnly`). Retrieve, then cancel.
- [ ] **Step 6: (removed).** ADR-90 signs free items server-side, so the host's behaviour on
  an unpaid chargeable item no longer matters. **Do not issue tickets in this spike.** Only
  create held orders and cancel each one before the step ends.
- [ ] **Step 7: record what persistence needs** from the retrieves of steps 3–5:
  - the `Service/ServiceID` shape of a free SSR (expected SQ-style `AVML_1_PAX2`, which
    `dossier.utils.js` already splits on `_PAX`);
  - whether `ServiceAssociations…PaxSegmentRefID` is present. If not, Task 6 Step 4 extends
    the existing SEAT hoist (commit `69291fd0d`).
- [ ] **Step 8: vendor fixtures (JSON, node-soap shape)** into
  `api-aerial/src/utils/AMADEUS_NDCX/__tests__/fixtures/servicelist-live/`:
  - `{lo,qf,ey,ai,kq,sv,ac,sq}.reply.json` from `services --dump`;
  - `ai-anc-offerprice.reply.json` and `kq-anc-offerprice.reply.json` from `ancprice`;
  - the Step 3/5 OrderView replies as `kq-orderview-free-ssr.json` and
    `sq-orderview-free-ssr.json`.
  - Strip nothing structural. Keep the PNR names fictitious (the runner's `CERTTEST` family).
- [ ] **Step 9:** add the runs to `scripts/README.md`'s worked-example table. Do not commit
  captures, since `use cases/NDCX` is gitignored.

### Task 1: Classification v2 (ADR-78)

**Files:** `src/utils/AMADEUS_NDCX/serviceClassification.js`, test
`src/utils/AMADEUS_NDCX/__tests__/ndcx-service-classification.test.js` (extend).

**Interface.** `classifyNdcxService(definition) -> { type, unit, quantityStep, ssrCode,
subCode, label, rfic, chargeable, atpco: { serviceType, group, subgroups }, ssrCategories,
dossierServiceType }`.
- The first six fields keep their exact current semantics.
- `type` ∈ `bag | meal | sports | lounge | fastTrack | priority | accessibility |
  pet | carryOn | excessBag | infoSsr | upgrade | financial | other`.
- Firearms and ammunition are `sports` (decision 1). `atpco.subgroups` still carries
  `AM`/`FA`, so a label or report can tell them apart.

- [ ] **Step 1: write the failing tests.**
  - **Table-driven over every live fixture from Task 0.** One assertion per row of the F10
    table, plus:
    - AF `SRV13` (`Name "MEAL"`, `SSRCode AVML`) → `meal`, label key `AVML`;
    - AF `WCHR` → `accessibility`;
    - QF `C-OC-0CC-…-BG-B1-QF` → `bag`; QF `D-NC-0L7-QF` → `financial`;
    - SQ OrderView `{ ServiceDefinitionID: "AVML_1", ServiceCode: "AVML" }` → `meal`;
    - LO `CLML` `ML` → `meal` with `chargeable: true`;
    - LO `WEAP`, LO/KQ `AMMO` → `sports` (decision 1); AI `COPL` → `carryOn`;
      AI `HPBG` → `excessBag`;
    - EY `LBZA` → `lounge`; SV `FSTK` → `fastTrack`; EY `PRIO` → `priority`;
    - KQ `UPGR` → `upgrade`; KQ `OXYG` → `infoSsr`.
  - **The bag invariant test (the most important one):**

```js
test("ADR-78 bag invariant: every live item typed bag by v1 stays bag, except the two F10 false positives", () => {
  const { classifyNdcxServiceV1 } = require("./fixtures/serviceClassification.v1"); // frozen copy of today's file
  const KNOWN_V1_FALSE_POSITIVES = new Set(["KQ:TICKET IMMUNITY", "KQ:EXCESS BAGGAGE REQUEST"]);
  for (const [carrier, defs] of allLiveDefinitions()) {
    for (const def of defs) {
      if (classifyNdcxServiceV1(def).type !== "bag") continue;
      const key = `${carrier}:${def.Name}`;
      const expected = KNOWN_V1_FALSE_POSITIVES.has(key) ? false : true;
      assert.equal(classifyNdcxService(def).type === "bag", expected, key);
    }
  }
});
```

  Freeze today's file as `__tests__/fixtures/serviceClassification.v1.js`. It is a test
  oracle, not production code. Delete it once this plan has shipped and the fixtures have
  been re-baselined.
  - Every definition must still keep `unit`/`quantityStep` identical to v1 (the ADR-41
    regression guard).

- [ ] **Step 2: implement.** Replace `resolveType` and add the helpers. Keep
  `readQuantityUnit` and `resolveLabel` unchanged, but make `textOf` read `$value` as well,
  because node-soap gives `{ $attributes, $value }` (see the QF/LO fixtures):

```js
const NON_BAG_RFIC = new Set(["A", "B", "D", "E", "F", "G", "I"]); // C = baggage; AF sends a stray "0"
const ACCESSIBILITY_SSR_CODES = new Set(["WCHR","WCHS","WCHC","WCMP","WCOB","WCBD","WCBW","WCLB","BLND","DEAF","DPNA","MAAS"]);
// existing 22 + every code data/meals.json knows + live-only AVCH/CVML
const MEAL_SSR_CODES = new Set([ /* existing list */ "ALML","APML","INML","ITAL","JNML","PLML","PRML","AVCH","CVML" ]);
// WEAP/AMMO are sporting firearms — regular sports ancillaries (decision 1, 2026-10-21)
const SPORTS_SSR_CODES = new Set(["SPEQ","BIKE","SKIS","SURF","GOLF","SNWB","BFSH","WEAP","AMMO"]);
const LOUNGE_SSR_CODES = new Set(["LOUN","LNGE","LBZA","BLNY"]);
const FAST_TRACK_SSR_CODES = new Set(["FAST","FSTK"]);
const PRIORITY_SSR_CODES = new Set(["PRIO"]);
const PET_SSR_CODES = new Set(["PETC","AVIH"]);
const TS_SUBGROUP_TYPES = { FT: "fastTrack", PO: "priority", PR: "priority", NC: "financial", FG: "financial", TI: "financial" };

function classifyNdcxService(definition) {
  const ssrCode = textOf(definition?.BookingInstructions?.SSRCode) ?? textOf(definition?.ServiceCode) ?? null;
  const subCode = textOf(definition?.ReasonForIssuanceSubCode) ?? null;
  const rfic = textOf(definition?.ReasonForIssuanceCode) ?? null;
  const atpco = readAtpco(definition);
  const { unit, quantityStep } = readQuantityUnit(definition);
  const label = resolveLabel(definition);
  const type = resolveType({ ssrCode, subCode, rfic, atpco, name: label });
  return {
    type, unit, quantityStep, ssrCode, subCode, label, rfic,
    chargeable: atpco.chargeable, atpco: { serviceType: atpco.serviceType, group: atpco.group, subgroups: atpco.subgroups },
    ssrCategories: atpco.ssrCategories,
    dossierServiceType: toDossierServiceType(type, label),
  };
}

/** F1/F2 (Altéa Description codes) and F3 (QF id tokens). Never throws. */
function readAtpco(definition) {
  const texts = ensureArray(definition?.Description).map((d) => textOf(d?.DescText)).filter(Boolean);
  const head = texts[0]?.toUpperCase();
  if (head === "FREE") {
    return { chargeable: false, serviceType: null, group: null, subgroups: [],
      ssrCategories: (texts[1] ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) };
  }
  if (head === "CHARGEABLE" && /^[A-Z]$/.test(texts[1] ?? "") && /^[A-Z0-9]{2}$/.test(texts[3] ?? "")) {
    return { chargeable: true, serviceType: texts[1], group: texts[3], subgroups: texts.slice(4), ssrCategories: [] };
  }
  const id = textOf(definition?.ServiceDefinitionID) ?? "";
  const qf = id.match(/^[A-Z]-[A-Z]{2}-[0-9A-Z]{3}-[^-]+-([A-Z]{2})-([A-Z0-9]{2})-[A-Z0-9]{2}$/);
  if (qf) return { chargeable: null, serviceType: null, group: qf[1], subgroups: [qf[2]], ssrCategories: [] };
  return { chargeable: null, serviceType: null, group: null, subgroups: [], ssrCategories: [] };
}

function resolveType({ ssrCode, subCode, rfic, atpco, name }) {
  // 1. F2 — a free item is never a sellable bag (KQ "EXCESS BAGGAGE REQUEST").
  if (atpco.chargeable === false) {
    if (atpco.ssrCategories.includes("MEAL") || MEAL_SSR_CODES.has(ssrCode)) return "meal";
    if (ACCESSIBILITY_SSR_CODES.has(ssrCode)) return "accessibility"; // carriers file these under 4 different categories
    return "infoSsr";
  }
  // 2. ADR-78 bag invariant — v1's rule, minus the RFIC false positive (KQ "TICKET IMMUNITY" A/0A2).
  if (isLegacyBag(ssrCode, subCode, rfic)) return "bag";
  // 3. ATPCO group, 4. SSR tables, 5. RFIC, 6. name.
  return typeFromGroup(atpco, ssrCode) ?? typeFromSsr(ssrCode) ?? typeFromRfic(rfic) ?? typeFromName(name) ?? "other";
}

function isLegacyBag(ssrCode, subCode, rfic) {
  if (BAG_SSR_CODES.has(ssrCode)) return true;
  if (rfic && NON_BAG_RFIC.has(rfic)) return false;
  return Boolean(subCode) && BAG_SUBCODE_PREFIXES.some((p) => subCode.startsWith(p));
}

function typeFromGroup({ group, subgroups }, ssrCode) {
  switch (group) {
    case "BG":
      if (subgroups.includes("SP")) return "sports"; // incl. AM/FA firearms & ammunition (decision 1)
      if (subgroups.includes("CY")) return "carryOn";
      if (subgroups.includes("PT")) return "pet";
      return "excessBag"; // a BG item the legacy bag rule did not claim (AI HPBG/OVBG, KQ HBGS)
    case "ML": return "meal";
    case "LG": return "lounge";
    case "TS": return subgroups.map((s) => TS_SUBGROUP_TYPES[s]).find(Boolean) ?? null; // SV FSTK has no subgroup → SSR table
    case "PT": return "pet";
    case "UP": return "upgrade";
    case "MD": return "infoSsr";
    case "RO": case "CO": return "financial";
    case "UN": case "GT": case "IE": case "SA": return "other";
    default: return null;
  }
}

function typeFromSsr(ssr) {
  if (!ssr) return null;
  if (MEAL_SSR_CODES.has(ssr)) return "meal";
  if (ACCESSIBILITY_SSR_CODES.has(ssr)) return "accessibility";
  if (SPORTS_SSR_CODES.has(ssr)) return "sports";
  if (LOUNGE_SSR_CODES.has(ssr)) return "lounge";
  if (FAST_TRACK_SSR_CODES.has(ssr)) return "fastTrack";
  if (PRIORITY_SSR_CODES.has(ssr)) return "priority";
  if (PET_SSR_CODES.has(ssr)) return "pet";
  return null;
}

const typeFromRfic = (rfic) => (rfic === "D" ? "financial" : rfic === "A" ? "upgrade" : null);

function typeFromName(name = "") {
  const n = name.toUpperCase();
  if (n.includes("LOUNGE")) return "lounge";
  if (n.includes("MEAL")) return "meal";
  if (n.includes("SPORT")) return "sports";
  if (/FAST ?TRACK/.test(n)) return "fastTrack";
  if (n.includes("PRIORITY")) return "priority";
  if (n.includes("WHEELCHAIR")) return "accessibility";
  return null;
}

/** ADR-85 — the `service_aerial.serviceType` the folder page renders (ServiceDetail.vue). `undefined` = leave dossier.utils' own logic in charge (bags). */
function toDossierServiceType(type, label) {
  switch (type) {
    case "meal": return "MEAL";
    case "sports": return `SPORT-${label}`;
    case "lounge": return "LOUNGE";
    case "accessibility": return "ACCESSIBILITY";
    case "fastTrack": return "FAST_TRACK";        // getKyteServiceCategory: "FAST"
    case "priority": return "PRIORITY_BOARDING"; // getKyteServiceCategory: "PRIORITY"
    default: return undefined;
  }
}
```

- [ ] **Step 3: run.** `node --test utils/AMADEUS_NDCX/__tests__/ndcx-service-classification.test.js`
  must be green. The existing 7 v1 tests must stay green: `SPEQ` is still `sports` and
  `PRIO` (as "PRIORITY BOARDING") is now `priority`. **Update that one v1 test's expectation
  and say so in the commit.**
- [ ] **Step 4: commit:** `feat(ndcx): ATPCO-driven service classification v2 (ADR-78, MET2-2422)`.

### Task 2: Mapper: exposure, variants, `Desc` tags (ADR-79, ADR-80)

**Files:** `serviceListReply.mapper.js`, `service.controller.js`, test
`ndcx-service-list-reply.mapper.test.js` (extend, using the Task 0 fixtures).

**Interface.** `mapNdcxServiceListReply(reply, body, { timing })`, where `timing` ∈
`"preBooking" | "postBooking" | "postIssuance"`. Each `Offer.OfferItem[]` gains
`exposure: { sell: boolean, channel: "meal"|"extras"|"lounge"|"assistance"|"luggage"|null, reason: string|null }`
and `preferred: boolean|null`. The top level gains
`hiddenSummary: Array<{ type, count, reason }>`.

- [ ] **Step 1: failing tests.**
  - KQ fixture: the "BICYCLE" items for PAX1 keep only one preferred item per segment, and
    the whole-itinerary item is `preferred: false` (ADR-80).
  - AI "SPORT EQUIPMENT": out of `SRV13`, `SRV29` and `SRV42` at equal price, the preferred
    winner is the ATPCO `P` definition (`SRV42`).
  - SV fast track (journey item, 2 segments, no single-segment twin) stays `preferred: true`
    with both `PaxSegmentRefID`s.
  - Exposure:
    - LO `WEAP`, `AMMO` → `sell: true, channel: "extras"` (decision 1);
    - LO `CLML` → `sell: true, channel: "meal"` (paid meal, ADR-89);
    - KQ `RESA` → `sell: false`;
    - EY `AVML` → `sell: true, channel: "meal"`; EY `PRIO` → `channel: "extras"`;
    - KQ `LOUN` → `channel: "lounge"`; `WCHR` → `channel: "assistance"`.
  - Capability (Task 3): for QF with `timing: "postBooking"`, every free item has
    `sell: false, reason: /does not accept free services on a held order/`.
  - `Desc` carries a family tag for each type (`["LOUNGE", label]`, `["MEAL", label]`…).
    The lounge test from the ServiceList plan must stay green.
  - **Bags:** `preferred === null`, and `exposure.channel === "luggage"` exactly when
    v1's `blocked` was false (no behaviour change for `formatNdcxLuggageOptions`).
  - ADR-90: every item with `UnitPrice.TotalAmount === 0` carries a `freeToken`, and
    chargeable items carry none. `verifyNdcxFreeToken({ OfferID, OfferItemID, PaxRefID }, token)`
    returns true for a token the mapper minted and false for a tampered `OfferItemID`. With
    `ENCRYPTION_KEY` unset, minting yields `null` and verification returns `false`.
- [ ] **Step 2: implement.**
  - Compute `exposure` in `buildOfferItem` from `classification`, `capabilities` and
    `timing`. The whitelist is §1 Tier 1 (free and paid meals, sports incl. firearms).
  - Put the ADR-90 helpers in a new `utils/AMADEUS_NDCX/freeServiceToken.js`:
    `mintNdcxFreeToken`, `verifyNdcxFreeToken`, `node:crypto` only, the key derived as
    `createHmac("sha256", process.env.ENCRYPTION_KEY).update("ndcx-free-service").digest()`.
    It has its own test file.
  - Run `markPreferredVariants(items)` after all items are built, on items with
    `type !== "bag" && !blocked && exposure.sell`.
  - Build `hiddenSummary` by grouping `!exposure.sell` items by `type` and `reason`.
    **Decision 5:** the controller **logs** it (`this.logger.info`, one line per call:
    carrier, timing, `type×count`) and strips it from the HTTP response. The front never
    sees it.
- [ ] **Step 3: controller timing.** In `service.controller.js`, timing is `"preBooking"`
  when there is no `OrderID`. Otherwise read `PnrService.getPnrWithOrderid(OrderID)`:
  `status === 2` → `"postIssuance"`, else `"postBooking"`. The same lookup already serves
  `OwnerCode` recovery, so do it once.
- [ ] **Step 4: commit:** `feat(ndcx): expose sellable non-bag services and collapse variants (ADR-79/80)`.

### Task 3: Capabilities (ADR-84)

**File:** `carrierCapabilities.js`; test `ndcx-carrier-capabilities.test.js`.

Transcribe the four WBS rows. The values below were checked against `airline-matrix.csv`
on 2026-10-21. Keep **in-scope carriers only**, i.e. the keys of `CAPABILITIES` (`:38`).

| Row | Not supported (in-scope) | Unverified |
|---|---|---|
| "Create: Add other ancillary services than bag and seat (After OfferPrice)" | CX | LH (note A1, no text in `airline-notes.csv`) |
| "Voluntary change : Add free services" (before payment) | QF, UA, LH, CX, VY | none |
| "Voluntary change : Add other chargeable ancillary services" (before payment) | none | none |
| "Voluntary change : Add new other ancillary services than bag and seat" (post payment) | UA, CX | LH, QF ("to be clarified") |

- [ ] Add `freeServices: { preBooking, postBooking, postIssuance, verified }` and split
  `otherServices.postIssuance` per the last row. **Post-issuance free adds use the
  post-payment row** (the SQ F7 capture is the only evidence).
- [ ] Tests: QF `freeServices.postBooking === false`, UA `otherServices.postIssuance === false`,
  LH `verified === false`, and an unknown carrier stays permissive.
- [ ] Commit: `feat(ndcx): free vs chargeable ancillary capabilities per timing (ADR-84)`.

### Task 4: Pre-booking booking split (ADR-81, ADR-82)

**Files:** `ancillaryOffer.utils.js`, `order.utils.js`, tests `ndcx-ancillary-offer.utils.test.js`
and `ndcx-order-create.utils.test.js` (extend).

- [ ] **Step 1: tests.**
  - `createNdcxAncillaryOfferPricePayload` throws
    `/free services must not be repriced \(F6\)/` when any `services[]` row has `free: true`.
  - `createNdcxOrderCreatePayload` with
    `FreeServiceOfferIdList: [{ OfferItemID: "KQ-221", PaxRefID: ["PAX1"], freeToken, serviceOfferId }]`
    emits it **inside the same `SelectedOffer`**, after air and repriced ancillaries, with no
    `SelectedSeat`. `freeToken` and `serviceOfferId` never reach the wire.
  - A free entry with a missing or invalid `freeToken` throws `/not a verified free service/`
    (ADR-90). The token is verified against the **ServiceList** `OfferID` the item came
    from (`serviceOfferId`), not the air one.
  - An entry missing `PaxRefID` throws.
  - Absent or empty `FreeServiceOfferIdList` → payload byte-identical to today (snapshot of
    the current SQ fixture).
- [ ] **Step 2: implement.** `buildAllSelectedOfferItems` (`:89`) appends
  `ensureArray(body.FreeServiceOfferIdList).map(buildSelectedOfferItem)`. The guard goes in
  `createNdcxAncillaryOfferPricePayload` (`:31`), next to `assertNdcxQuantitiesResolved`.
- [ ] **Step 3: H2/H3 follow-up.** If Task 0 chose **H2**, emit a second `SelectedOffer`
  from `body.FreeServiceOffer = { OfferID, ShoppingResponseId }` instead. If it chose
  **H3**, delete Steps 1–2 and move the free rows to Task 5, called right after
  OrderCreate succeeds.
- [ ] **Step 4: commit:** `feat(ndcx): book free services outside the ancillary reprice (ADR-81/82)`.

### Task 5: Post-booking and post-issuance free changes (ADR-83)

**Files:** `orderChange.utils.js`, `order.controller.js`; test `ndcx-order-change.utils.test.js`.

- [ ] **Step 1: tests.**
  - `createNdcxOrderChangePayload(pnr{status:2}, { FreeOnly: true, … })` has **no
    `PaymentInfo`** and does **not** throw on a missing `Amount`.
  - Element order stays `ChangeOrder → DataLists → Order` (the F7 capture).
  - With `FreeOnly` absent and status 2: unchanged behaviour (still throws without
    `Amount`).
  - `FreeOnly: true` with any entry whose `freeToken` does not verify against
    `(body.OfferID, OfferItemID, PaxRefID[0])` throws `/FreeOnly change carries an unverified item/`
    (ADR-90).
- [ ] **Step 2: implement.** Branch at `:98`:
  `if (pnr.status === 2 && body.FreeOnly !== true) Request.PaymentInfo = …`. When
  `FreeOnly`, verify every `AncillaryOfferIdList[i].freeToken`. `free` and `freeToken` are
  stripped before the wire, because `SelectedOfferItem` only takes
  `OfferItemRefID`/`PaxRefID`.
- [ ] **Step 3: controller.** In `handleOrderChange` (`:847`), when `FreeOnly`, reject with
  400 if `resolveNdcxCarrierCapabilities(owner).freeServices[timing] === false`, quoting the
  matrix row. This keeps the backend authoritative even if a stale front sends it.
- [ ] **Step 4: commit:** `feat(ndcx): add free services to held and ticketed orders without payment (ADR-83)`.

### Task 6: Persistence: rows the folder page renders (ADR-85)

**Files:** `orderViewReply.mapper.js`, `orderChange.utils.js`, `order.controller.js`,
`utils/dossier.utils.js` (**shared**); tests `ndcx-orderview-*.test.js` and
`ndcx-order-change.utils.test.js`.

- [ ] **Step 1: tests.**
  - The mapped `kq-orderview-free-ssr.json` definition for VGML has
    `ndcxServiceType === "MEAL"`. WCHR → `"ACCESSIBILITY"`, BIKE → `"SPORT-BICYCLE"`,
    LOUN → `"LOUNGE"`.
  - A bag allowance definition has **no** `ndcxServiceType`: the existing "Included" path
    must stay untouched.
  - ADR-89: a paid meal definition (LO `CLML`) has `ndcxServiceType === "MEAL"` **and**
    `ndcxChargeable === true`. A free meal has `ndcxChargeable === false`.
- [ ] **Step 2:** in `buildServiceDefinition` (`:163`), call `classifyNdcxService(def)` on
  the **raw** `def` (before `delete wrapped.Description`). When `dossierServiceType` is
  defined, set `wrapped.ndcxServiceType = …` as a plain string and
  `wrapped.ndcxChargeable = classification.chargeable === true`.
  - OrderView definitions may lack the `Chargeable`/`Free` head (SQ `ServiceCode` shape, F3).
    In that case fall back to the `OrderItem` price at persistence time (Step 3). Do not guess
    here.
- [ ] **Step 3 (shared file, name it in the PR).** In `dossier.utils.js`, add the first
  `case` to the `switch (true)` at `:2431` (`dossierCreateInner`) and at `:6049`
  (`saveAfterRetreive`):

```js
              // MET2-2422 (NDCX-ANCILLARIES-PLAN.md ADR-85): NDC[X] classifies on ATPCO codes
              // upstream (orderViewReply.mapper.js); every other ORA never sets this field.
              case Boolean(srv?.ndcxServiceType):
                serviceType = srv.ndcxServiceType;
                break;
```

  **ADR-89, same two functions:** in the `totalprice` expression right after each switch
  (`:2537-2546` and its `saveAfterRetreive` twin), the `serviceType === "MEAL"` ⇒ `"0"` and
  `status = 2` rule must **not** apply when
  `srv?.ndcxChargeable === true || (srv?.ndcxServiceType && Number(item?.Price?.TotalAmount ?? item?.Price?.BaseAmount) > 0)`.
  Use the item's price instead. Gate it on `srv?.ndcxServiceType` so other oras are
  untouched.
  - Test: an AF-shaped MEAL row is still 0, and an NDC[X] paid-meal row keeps its amount.

  Then `grep -n 'case hasServiceTag(serviceData.name, "LOUNGE")' utils/dossier.utils.js`.
  If `forceRetrieve` (`:11483`) has the same switch and is reachable from an NDC[X] retrieve
  (check `controllers/AMADEUS_NDCX/order.controller.js` for `forceRetrieve`), patch it too.
  Otherwise note in the PR that it is left alone.
- [ ] **Step 4: `segmentId` at create.** `bulkCreate` (`service-aerial.service.js:22`)
  drops rows without one. If Task 0 Step 7 showed no `ServiceAssociations…PaxSegmentRefID`
  on free SSRs, extend the existing SEAT hoist (commit `69291fd0d`) to every service whose
  definition has an `ndcxServiceType`. Test: a meal row on the KQ fixture resolves a
  `segRef`.
- [ ] **Step 5: align `buildNdcxServiceRows` (`orderChange.utils.js:300`).**
  - Look up the definition: `ServiceDefinitionRefID` → `orderView.DataLists…` (now carrying
    `ndcxServiceType`).
  - Emit `name: def.Name`, `serviceType: def.ndcxServiceType ?? null`,
    `serviceDefinitionIdPax: service.ServiceID`, and `descText: def.Desc.DescText`.
  - In `order.controller.js`, replace `ServiceAerialService.create(row)` with
    `ServiceAerialService.updateOrCreate(row)`. The subsequent `retrieveOrder(true)` then
    updates the row instead of duplicating it.
  - Test: two calls with the same row create one record (mock the service).
- [ ] **Step 6:** run `npm run test:unit`, then commit
  `feat(ndcx): persist meals, sports, lounge, fast track and assistance with a renderable serviceType (ADR-85)`.

### Task 7: Front pure helpers

**Files:** create `app/utils/adapters/ndcx/ndcxExtrasSelection.ts`; test
`tests/unit/utils/adapters/ndcxExtrasSelection.test.ts`. Fixtures are the front-shaped
`mapped` replies of AI, KQ and EY from Task 0, saved under `tests/unit/fixtures/ndcx/`.

Purity rule (`front-reservation/CLAUDE.md`): no Pinia, no reactivity, no HTTP.

```ts
export interface NdcxExtraRow { OfferItemID: string; PaxRefID: string[]; Qty?: number; free: boolean; freeToken?: string; serviceOfferId?: string }

/** Every sellable item of `channel`, preferred variants only (ADR-79/80). */
export function sellableNdcxItems(resp: any, channel: "meal" | "extras" | "lounge" | "assistance"): any[];

/** MealService option for an NDC[X] meal definition (ADR-88): title = SSR code → data/meals.json + i18n `meals.<CODE>`. */
export function ndcxMealOption(def: any): { title: string; titleToDisplay: string; value: string; fallbackDescription: string };
export function isNdcxMealDefinition(def: any, resp: any): boolean; // def.classification?.type === "meal" && some resp item of def is sellable + preferred

/** → bookingFlow.SportsEquipmentsOffers (bookingFlowStore.ts:64-71). One offer per (item × pax); segRef = first covered segment, segRefs = all. */
export function formatNdcxSportsOffers(resp: any): Array<{ id: string; offerItemId: string; offerId: string; paxRef: string; segRef: string; segRefs: string[]; journey: string; price: number; currency: string | null; name: string; description: string; free: boolean }>;

/** → bookingFlow.otherExtrasOffers (bookingFlowStore.ts:82-92); type "fast-track" | "priority-boarding". */
export function formatNdcxOtherExtras(resp: any): Array</* same fields */ any & { type: "fast-track" | "priority-boarding" }>;

/** pax.accessibility → free rows, one per segment; `missing` lists pax/SSR with no sellable item (ADR-87). */
export function mapNdcxAccessibility(paxs: any[], resp: any): { rows: NdcxExtraRow[]; missing: Array<{ paxId: string; ssr: string }> };

/** Everything the agent picked (meals on pax.meal, sports, extras, lounge, assistance) → split for ADR-81/83. */
export function collectNdcxExtrasSelection(input: {
  paxs: any[]; selectedSports: any[]; selectedOtherExtras: any[]; selectedLounges: any[]; accessibilityRows: NdcxExtraRow[];
}): { chargeable: NdcxExtraRow[]; free: NdcxExtraRow[] };
```

**Rules the tests pin down:**
- **`journey`** is `"DEP-ARR"` of the first..last covered segment. This is what
  `OrderServices.vue` `getSportsForFlight` / `getOtherExtrasForFlight` match on.
- **Multi-segment items:** an SV fast-track journey item shows on the tab of its **first**
  segment and carries `segRefs` for both. It is priced once and booked once.
- **`free`** is `price === 0`. It applies to meals too: a paid meal (ADR-89) lands in
  `chargeable`.
  - Chargeable rows carry `Qty: 1` (AF/KL rule; harmless elsewhere, see F9).
  - Free rows carry **no** `Qty`. They carry the item's `freeToken` and the reply's
    `Offer.OfferID` as `serviceOfferId` (ADR-90).
  - A free row whose item has no `freeToken` is dropped and reported in `missing` rather
    than sent.
- **Meals:** `collectNdcxExtrasSelection` skips `pax.meal[i].offer == null`. These are meals
  rebuilt from the folder in servicing (`addService.vue:124-226`), the same rule as
  `collectTkMealOfferItems` (`tkSpecialMeals.ts:31-38`). INF paxs are skipped.
- **Dedupe** by `OfferItemID + PaxRefID`.
- **Accessibility mapping:** `manual→WCHR`, `electric→WCHS`, `foldable→WCHC`,
  `visualAssistance→BLND`, `audioAssistance→DEAF`, on **every** segment. AF's version takes
  one segment only (`AirFranceAdapter.ts:437`); do not copy that.
- Lounge rows come from `selectedLoungeOffers` (`offerItemId`, `paxRef`).

- [ ] Write the tests first, using the AI/KQ/EY fixtures; implement; run vitest; commit
  `feat(ndcx): pure formatters and collectors for non-bag ancillaries`.

### Task 8: Adapter wiring

**File:** `AmadeusNdcxAdapter.ts` (and the `BaseAdapter.ts` key).

- [ ] **Step 1: capabilities.**
  - `BaseAdapter.ts:275-286`: add `otherExtras: false`.
  - NDC[X] constructor (`:94-98`): `meals = true`, `lounge = true`, `otherExtras = true`,
    `accessibility.add = true`.
  - Keep `sports = false` (sports render inside `OtherExtras`, see §2) and
    `carryOnLuggage = false`.
  - Rewrite the ADR-40 comment to point at this plan.
- [ ] **Step 2: `formatExtras()`.** Call it from `getServices()` right after
  `formatLuggage()`:
  - `bookingFlow().setSportsEquipmentsOffers(formatNdcxSportsOffers(resp))`;
  - `setOtherExtrasOffers(formatNdcxOtherExtras(resp))`.
  - Nothing about hidden services reaches the front (decision 5: logs only, Task 2).
- [ ] **Step 3: `getFormatedAccessibility()` override.** Returns
  `mapNdcxAccessibility(bookingFlow().paxs, bookingFlow().getServiceResponse())`. Each
  `missing` entry gives a `$stoast.warning` naming the pax and SSR.
- [ ] **Step 4: `bookFlight()` (`:320`).**

```ts
const extras = collectNdcxExtrasSelection({ paxs, selectedSports, selectedOtherExtras, selectedLounges, accessibilityRows });
const services = [...collectNdcxServiceSelection(), ...extras.chargeable];   // bags first: buildNdcxServicePayload order unchanged
const repriced = await this.priceNdcxAncillaries({ seats, services });       // null when seats+services are empty → free-only booking skips the reprice (ADR-81)
// … existing AncillaryOfferIdList via toAncillaryOfferIdList(repriced, airOfferItemIds, seats) — seats stay at the tail, so the zip is unaffected
data.FreeServiceOfferIdList = extras.free;                                    // ADR-82 (or H2/H3 per Task 0)
```

- [ ] **Step 5: `AddServices()` (`:588`).**
  1. If seats + bags + chargeable extras are non-empty, run the existing reprice and change.
  2. If `extras.free` is non-empty, POST `/aerial/AMADEUS_NDCX/order/orderChangeRQ` with
     `FreeOnly: true`, `OfferID: servicingFlow().serviceOfferID`,
     `ShoppingResponseId: servicingFlow().serviceResponseID`, and
     `AncillaryOfferIdList: extras.free`.
  3. If step 2 fails after step 1 succeeded, throw an error **naming the partial success**.
     `addService.vue confirm()` then runs `retrieveOrder(true)` **before** the dialog
     re-opens, so the agent sees what is already on the order (rule 11).
- [ ] **Step 6:** run `npm run lint:changed -- --staged`, then commit
  `feat(ndcx): sell meals, sports, lounge, fast track and assistance (front wiring)`.

### Task 9: Widget patches (generic, safe for every ora)

- [ ] **`OrderServices.vue:167-190` `hasLoungeData`:** replace `item?.Desc?.toUpperCase?.()`
  with
  `[].concat(item?.Desc ?? []).some((d: any) => String(d?.DescText ?? d ?? "").toUpperCase().includes("LOUNGE"))`.
  AF/KL still get `true`, since their `Desc` is a string or an object.
- [ ] **`OrderServices.vue:854-885` extras gate:**
  `(LCC_ORAS.includes(ora?.ora) || ora?.capabilities?.ancillaries?.otherExtras) && (otherExtrasOffers.length || SportsEquipmentsOffers.length)`.
  Pass `:show-other-services="LCC_ORAS_WITH_SERVICES.includes(ora?.ora) || ora?.capabilities?.ancillaries?.otherExtras"`
  to `<OtherExtras>`. Then check the "Vos options supplémentaires" table (`:931-1037`) for
  the same hardcoded list and widen it identically.
- [ ] **`OtherExtras.vue:48-53`:** `showOtherServices` becomes
  `props.showOtherServices ?? <current ora list>`, so LCC behaviour is unchanged when the
  prop is absent.
- [ ] **`LoungeService.vue:29-62`:**
  - `find` → `filter` over every lounge definition;
  - `const segs = [].concat(o.Eligibility.FlightAssociations.PaxSegmentRefID)`, keep when
    `segs.includes(currentSeg)`, and store `segRef: currentSeg`;
  - skip `o.preferred === false || o.blocked || o.exposure?.sell === false`;
  - `description` comes from each item's own definition.
- [ ] **`MealService.vue`:**
  - `:159-205`: add `|| isNdcxMealDefinition(item, serviceData)` to the filter, and map
    NDC[X] definitions through `ndcxMealOption`. Branch on the presence of
    `item.classification`, which only the NDC[X] mapper emits, **not** on `ora`.
    `MealService` reads `servicingFlow.ora` even at checkout, so an ora test would be wrong
    during booking.
  - `:124-143`: skip items with `preferred === false || blocked || exposure?.sell === false`
    when building `offerLookup`.
  - `:250-258`: add `?? (mealSelected.value.fallbackDescription ? { description: mealSelected.value.fallbackDescription } : undefined)`
    after the `tkDescription` fallback, so a meal code `meals.json` does not know (AVCH, CVML)
    still renders its card.
  - **ADR-89, paid meals:**
    - the option's `titleToDisplay` gets a price suffix when the offer amount is above 0
      (`"Chocolate layer cake — 12,00 EUR"`, currency from `UnitPrice.CurCode`, not the
      hardcoded `€` at `:518`);
    - the detail card shows "Gratuit/Free" (existing `free` i18n key) at 0;
    - the "duplicate to all passengers" toggle still applies, because each pax's price comes
      from its own offer.
    - A paid meal LO sells without a `meals.json` entry still renders through
      `fallbackDescription`.
- [ ] Manual check per widget on an AF and an LCC (U2) booking: both must be unchanged.
  Then commit `fix(ancillaries): array-safe lounge data, capability-gated extras panel`.

### Task 10: Recap and totals

- [ ] **`OrderRecap.vue:222-266` `getPaxServicePrice`:**
  - add `selectedOtherExtras.filter(e => e.paxRef === pax.id).reduce(…price)`;
  - make the meal term `Number(meal?.offer?.UnitPrice?.TotalAmount) || 0`, which stops the
    NaN on folder-rebuilt meals.
  - Unit test the extracted pure sum (`orderRecap.logic.ts` if one exists, else
    co-locate it).
- [ ] **`OrderServices.vue:541-543` `ndcxInstantPaymentCheckoutWarning`:** extend the text
  from "bags and seats" to every chargeable service. Add an explicit line saying free
  meals and assistance are never charged.
- [ ] Commit `fix(recap): include extras in the services total; NaN-safe meal price`.

### Task 11: Labels and i18n (ADR-88)

- [ ] `locales/{fr,en,es,it,ua}.json` under `components-booking-flight-order-widgets-MealServices.meals`:
  add the 16 codes `data/meals.json` already knows but i18n does not (`ALML` `APML` `FPML`
  `INML` `ITAL` `JNML` `LCML` `LFML` `NLML` `ORML` `PLML` `PRML` `RVML` `SFML` `VJML` `VOML`),
  plus `AVCH` and `CVML`.
- [ ] Add `AVCH` and `CVML` to `data/meals.json` (FR description).
- [ ] Replace the hardcoded FR strings `OrderServices.vue:1003,1007,1023` ("Repas:",
  "Equipment:", "Lounge Access") with i18n keys. They are touched anyway when NDC[X]
  starts populating these rows.
- [ ] Commit `i18n: special-meal codes and ancillary row labels`.

### Task 11b: Assistance on an existing order, in the passenger modification dialog (decision 3)

**Files:** `components/folder/**/ModificationVoyageurs.vue` (find it with
`grep -rn "accessibility?.change" app/components`), `AmadeusNdcxAdapter.ts`, and its tests.

- [ ] **Step 1: read before writing.** Read how `ModificationVoyageurs.vue` (`:793`, gated by
  `capabilities.accessibility.change`) saves an accessibility change today. Look at its
  call into the adapter (or the
  `BaseAdapter.ts:724-735` `PUT /aerial/accessibility/update/:id`) and at which other
  providers (AF/IB/TK) push it to the airline. Record the hook the NDC[X] adapter must
  implement. Do not invent a new dialog.
- [ ] **Step 2: adapter method** (name it after the hook found in Step 1, e.g.
  `updateAccessibility(pax, form)`). It runs:
  1. `getServices()` keyed on the order (servicing);
  2. `mapNdcxAccessibility([pax with the new form], resp)`;
  3. if there are rows, POST `/aerial/AMADEUS_NDCX/order/orderChangeRQ` with
     `FreeOnly: true`, `OfferID`/`ShoppingResponseId` from that ServiceList, and the rows
     (each with its `freeToken`);
  4. `retrieveOrder(true)`.
  - Any `missing` entry is shown as a warning naming the pax and SSR.
  - Keep the existing metis-side persistence call, so the dossier stays in sync even if the
    airline refuses.
- [ ] **Step 3: capability.** Set `capabilities.accessibility.change = true` for NDC[X]. The
  backend still refuses a `FreeOnly` change for carriers whose
  `freeServices.postBooking`/`postIssuance` is false (Task 5 Step 3). Show its message
  verbatim.
- [ ] **Step 4: tests** (vitest, the adapter with axios mocked):
  - `wheelchairType: "electric"` on a 2-segment order sends 2 WCHS rows with tokens and
    `FreeOnly`;
  - a carrier with no WCHS item sends nothing and warns;
  - removing assistance sends nothing to the host. Removing an SSR is out of scope; say so
    in a code comment, because NDC[X] has no free-service delete flow in this plan.
- [ ] Commit `feat(ndcx): request passenger assistance on an existing order from the modification dialog`.

### Task 12: End-to-end verification (live, TEST host)

Run through the app, not the runner, with `NODE_ENV=development` so the logger keeps the
XML. **The ticketed-order checks are run by a human** through the UI. An implementing agent
does only the held-order checks it can drive with the runner, and must cancel every order it
creates.

- [ ] **KQ PAR-NBO, checkout:** VGML on both segments, WCHR from pax details, BIKE outbound,
  LOUN, then book (hold). **Expect:**
  - one 2nd OfferPrice with BIKE + LOUN only;
  - OrderCreate carries VGML ×2 and WCHR ×2 per Task 0's decision;
  - the folder shows MEAL, ACCESSIBILITY, `SPORT-BICYCLE` and LOUNGE rows, with the bike and
    lounge at host price and the meal at 0.
- [ ] **Same order, held:** add a meal for the return through "Ajouter service". **Expect:**
  one `OrderChange`, no `PaymentInfo`, then a retrieve, and no duplicate `service_aerial`
  row.
- [ ] **SV:** fast track (journey item) at checkout shows **once**, on the first segment's
  tab, and is priced once.
- [ ] **EY:** priority (`PRIO`) and lounge (`LBZA`) at checkout. **AI:** `SPEQ` shows one
  option per segment, never three.
- [ ] **Ticketed SQ or KQ order:**
  - add a meal → `OrderChange` without `PaymentInfo` (F7);
  - add a bike → `OrderChange` **with** `PaymentInfo` and the right amount;
  - add both in one confirm → two changes, chargeable first.
- [ ] **QF held order:** free services are hidden (capability), and the backend refuses a
  forced `FreeOnly` with the matrix row in the message.
- [ ] **AF and U2 regression smoke:** meals, lounge and extras dialogs behave exactly as
  before.
- [ ] Re-run `npm run test:unit` (api-aerial/src) and `npx vitest run` plus
  `npm run lint:changed -- --base origin/development` (front-reservation).

---

## 6. Dependencies and known risks carried in

- **Host pax renumbering post-booking** (`NDCX-CONTEXT.md` §3, unfixed):
  `resolveNdcxDossierTravelerIdByPax` assumes `PAX{n}`. Task 6's rows are dropped on a
  renumbering carrier exactly as bag rows are today. This plan does not fix it; it must not
  hide it either. Name it in the PR.
- **Front `ServiceID` sent to ServiceList:** `AmadeusNdcxAdapter.ts:682` reads
  `item.ServiceID ?? item.Service?.ServiceID ?? "1"`, but the OfferPrice mapper puts it at
  `item.service.ServiceID` (lowercase). Real values are `SER1` on LO/EY/AI/KQ/SV/AC and
  `Psvc…` on QF and AA.
  - The front therefore always sends `"1"`. SQ accepted that (app capture
    `8208801402178-…-RQ`).
  - The 2026-10-21 probe sent the **real** ids, and all 7 carriers accepted them.
  - Fix it to `item.service?.ServiceID ?? …` in Task 8 (one line, with a test). The
    carriers' tolerance of `"1"` is unproven beyond SQ.
- **`ancillaryOffer.utils.js` ADR-37** (repeated `PaxRefID`): F6/F9 show that AI and KQ accept
  it.

## 7. PR description must name

- **Shared files:**
  - `utils/dossier.utils.js` (one inert-for-other-oras `case` in 2–3 switches);
  - `services/service-aerial.service.js` (no change, but `updateOrCreate` is now called
    from an NDC[X] path);
  - `BaseAdapter.ts` (new default-off capability);
  - `OrderServices.vue`, `OtherExtras.vue`, `LoungeService.vue`, `MealService.vue` and
    `OrderRecap.vue` (generic fixes; AF and U2 smoke-tested).
- **Live finding F6** (free services dropped by OfferPrice) and the fact that it changes the
  booking flow (ADR-81/82/83).
- **The two F10 false positives**: until Task 1 ships they are sellable "bags" in production
  NDC[X] checkouts.
- **🔒 Payment.** The `FreeOnly` change carries no `PaymentInfo` by design. Its safety
  rests on ADR-90's server-side HMAC on every free item (key derived from `ENCRYPTION_KEY`),
  not on host behaviour.
- **Shared-file touch for ADR-89:** the MEAL ⇒ 0 € rule in `dossier.utils.js` is bypassed
  only for NDC[X] rows marked `ndcxChargeable`.

## 8. Decisions (recorded 2026-10-21)

1. **Firearms and ammunition** are regular sports ancillaries and are sold (ADR-78/79, Tier 1).
2. **Paid meals** extend the meal feature (ADR-89).
3. **Assistance on an existing order** goes through the passenger modification dialog
   (Task 11b).
4. **Free/paid trust boundary:** server-side HMAC token on free items (ADR-90). The host is
   not relied on.
5. **`hiddenSummary`** is backend logs only.

## Appendix: reproducing the survey

The probes were two scratch scripts (`svc_probe.js`: ServiceList on a runner-priced offer;
`anc_price_probe.js`: ServiceList, then the 2nd OfferPrice for chosen SSR codes) driven by
`ndcx_cert_runner.js shop/price`. Task 0 Steps 1–2 make them permanent runner subcommands.
Until then the equivalent is:

```bash
cd .agents/skills/ndcx/scripts
node ndcx_cert_runner.js shop  --route PAR-NBO --dates 2026-12-07,2026-12-14 --pax 1ADT --carrier KQ --state kq.json
node ndcx_cert_runner.js price --journey <first KQ index> --state kq.json   # within the OTL (~30 min)
# then: services / ancprice (Task 0)
```

Offers expire roughly 30 minutes after shopping. LO refused combined `CNN`+`INF` pricing on
this office (`39457 INVALID OR EXPIRED OFFER`), so the survey used 1 ADT. Infant- and
child-specific services (`BBML`, `CHML`, `BSCT`) still appear in single-adult replies.
