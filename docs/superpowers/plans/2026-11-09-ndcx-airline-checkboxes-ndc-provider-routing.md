# NDC[X] Airline Checkboxes & NDC Provider Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the GDS-style NDC[X] search row (On/Off switch + Inclure/Exclure comboboxes) with an airline-checkbox grid, and add a dashboard-configurable NDC provider routing system in api-aerial (NDC[X] priority over Sabre NDC, per-airline fallback to Sabre NDC on empty/error/timeout).

**Architecture:** The wire format does not change — the grid produces the same `oras: ["AMADEUS_NDCX"]` + `selectedAirline` entries the include-combobox produces today, and the legacy airline chips keep sending plain airline codes. A new pure routing layer in `api-aerial` (config resolver + body rewriter + sequential executor) intercepts *overlap* airlines (served by both NDC[X] and Sabre NDC) inside the existing `/aerial/global/airShoppingRQ` fan-out, runs one timeboxed NDC[X] MasterPricer call scoped to them, then one SABRENDC batch call for the airlines that got no offers. Routing is opt-in per PDV via two new sales-point attributes edited in front-dashboard.

**Tech Stack:** api-aerial — Node.js/Express, CommonJS (plain JS), Sequelize (MySQL), `node:test`; front-reservation — Nuxt 4/Vue 3/Vuetify 4, Pinia, oxlint/oxfmt, vitest + Playwright; front-dashboard — Nuxt/Vue 3, vitest. **api-dashboard: NO CODE CHANGES** (its `attribut` CRUD is generic — Joi shape validation only, see `api-dashboard/src/services/attribut.service.js`).

**Spec:** The decision record below (from the planning session, 2026-11-09) is the spec — the plan argues from it. Domain rules come from the amadeus-ndcx skill (`.agents/skills/ndcx/`): NDC-only means exactly `numberOfUnits=100/typeOfUnit=NDC`; all NDC calls stateless; look-to-book 1000:1 (never auto-trigger NDC[X] searches, no re-shop loops); OTL 15–30 min GMT.

## Decision record (the spec)

| # | Decision |
|---|---|
| 1 | Routing executes in the **backend** (api-aerial global controller); the front only selects airlines |
| 2 | Checkbox list = **static capability list in code** (mirrored front-reservation + api-aerial), gated by the existing `Amadeus-ndcx-enable` PDV attribute |
| 3 | Priority + fallback apply **only to airlines served by both providers** (the overlap set); airlines with their own pipes (IB, BA, AF/KL, EK, SQ…) keep their current routing; their NDC[X] checkbox means NDC[X] only |
| 4 | "Sabre" in the chain = **Sabre NDC (SABRENDC pipe)**, not Sabre GDS |
| 5 | Fallback is **per-airline** (only the missing airlines go to Sabre) |
| 6 | "No offers from ndcx" = **empty response, provider error, or timeout** |
| 7 | Execution is **sequential with the ndcx step timeboxed** (default 12 s, env-tunable) |
| 8 | Params stored as **PDV attributes** (`attribut` table), edited in the PDV page under a new **NDC** category |
| 9 | UI scope: **classic agent search + SBT search + OFF "add flight" modal** |
| 10 | The old GDS-style NDC[X] row is **removed** (no Exclure field kept) |
| 11 | The router **owns overlap airlines everywhere** — legacy Sabre-NDC chips (LH…) also go through the chain when routing is active; without routing config, legacy behavior is preserved byte-for-byte |
| 12 | Sabre fallback serves **any overlap airline as long as the PDV has Sabre credentials** (`Sabre-iPCC`); the per-airline `XX-SB-NDC`/`LH` attributes keep gating only the legacy chips |
| 13 | Airline lists: grid = 30 NDC[X] production carriers (matrix 2026-06-15, LH group expanded, EN/4Y excluded pending Amadeus confirmation, VY/6E excluded because Metis treats them as LCC pipes); routable overlap = LH, LX, OS, SN, AZ, UA, QF, BR, LO, SK — **confirm both lists against the office's actual Amadeus activation before rollout** |
| 14 | Ticket: **MET2-2422** (continues the NDC[X] integration ticket) |
| 15 | Branches: continue `deyra-met2-2422` in api-aerial & front-reservation; create `deyra-met2-2422` off `development` in front-dashboard; api-dashboard untouched |

## Global Constraints

- **Ticket tag MET2-2422** in every code comment, test header and commit subject (house style; comments in these repos are French — keep that style).
- **Never modify `front-reservation/app/utils/bookingUtils.ts`** — the wire format (`POST /aerial/global/airShoppingRQ` with `oras` + `selectedAirline`) is unchanged by design.
- **Routing is opt-in per PDV**: no `NDC-routing-priority` attribute → routing inactive → **exact current behavior** (LH chip → SABRENDC; NDC[X] toggle → unscoped/scoped MasterPricer). Every task must preserve this.
- **NDC[X] non-negotiables** (from the skill): NDC-only = exactly `100/NDC` (already enforced in `buildNumberOfUnit` — do not touch); stateless calls; **never auto-check the NDC[X] grid** (look-to-book, rule GEN-02/04 — SBT already carries this rule for the pseudo-checkbox, keep it); no retry/re-shop loops in the fallback (one NDC[X] step + one SABRENDC step, max).
- **Latency budget** (api-aerial `global.controller.js`): `SHOPPING_RESPONSE_BUDGET_MS` 52 000, `SHOPPING_POST_RESERVE_MS` 3 000, front axios ~59 s, Sabre NDC shops measured 25–45 s (MET2-2352). The chain must fit: ndcx step ≤ 12 s (env `NDC_ROUTING_NDCX_STEP_TIMEOUT_MS`) leaves ≥ ~34 s for the SABRENDC fallback, clamped to the remaining deadline. Accepted risk: occasional Sabre tail clamping; all knobs env-tunable.
- **api-aerial**: plain JS/CommonJS, tests via `node --test <file>` (pattern of `src/controllers/__tests__/*.test.js`), no TS. Pure-utils tests run fine from the repo root; any test whose module graph reaches `src/models/index` must run with **cwd = `api-aerial/src`** (dotenv-flow resolves `.environment` relative to cwd — found during A3).
- **front-reservation**: Nuxt 4 auto-imports (never `import { ref } from "vue"`), `<script setup lang="ts">`, explicit relative import for sibling components (as `GdsProviderRow` does), `data-test-id` discipline, gate `npm run lint:changed -- --staged` (zero oxlint + zero vue-tsc errors on touched files) before every commit.
- **front-dashboard**: vitest (`npx vitest run <file>`); mirror-test culture (`categoryMappingNdcx.met2-2422.test.ts` is the model).
- **No API-key/credential values in code or tests.** New PDV attribute *types* only.
- Each part (A, B, C) is independently shippable: A works with the current front (wire format unchanged), C works with the current api-aerial (pseudo-ora + selectedAirline already flow end-to-end), B is pure config plumbing.

## Current-state map (verified 2026-11-09)

| Concern | File | Fact |
|---|---|---|
| Selector UI | `front-reservation/app/components/booking/flight/SelectCompanies/SelectCompanies.vue` | Classic (canonical) mode template at lines ~2001–2177: NDC checkbox column, GDS column (`GdsProviderRow.vue` for SABRE + AMADEUS), **NDC[X] block at lines 2105–2117** (`GdsProviderRow` label "AMADEUS NDC", `test-id="amadeus-ndcx"`, `v-model:included="includedCompaniesAmadeusNdcx"`), LCC column. SBT mode template at ~1635–1998: NDC/GDS/LCC checkbox sections. |
| Row component | `.../SelectCompanies/GdsProviderRow.vue` | On/Off switch + Inclure/Exclure comboboxes — the "GDS style" to remove for NDC[X] only (SABRE/AMADEUS rows stay). |
| Types | `.../SelectCompanies/selectCompanies.types.ts` | `CanonicalGdsProvider = "SABRE" \| "AMADEUS" \| "AMADEUS_NDCX"`; `PersistedGdsUiFilters` carries `included/excludedCompaniesAmadeusNdcx`. |
| Store | `front-reservation/app/stores/flightSearchStore.ts` | `oras`, `selectedAirline`, `selectedAirlineFilters`, `gdsSelectedCompanies`, `gdsProviders` — persisted (localStorage). |
| PDV catalog | `front-reservation/app/utils/flight/pdvCompanies.ts` | `buildPdvCompanyCatalog` → `{ndc, lcc, hasSabre, hasAmadeus, hasAmadeusNdcx}`; `hasAmadeusNdcxAttribute` checks `Amadeus-ndcx-enable`. |
| Sabre NDC mirror | `front-reservation/app/utils/flight/sabreNdcAirlines.ts` | `SABRE_NDC_AIRLINES`, `XX-SB-NDC` attribute pattern, `normalizeNdcOwnerCode` (UAD→UA, SNA→SN, LXA→LX). |
| OFF modal | `front-reservation/app/components/folder/flight/addCard.vue` | `loadCompanies()` (~line 223) builds the catalog; company selection via a child component exposed as `companiesRef`. |
| Search dispatch | `api-aerial/src/controllers/global.controller.js` | `/aerial/global/airShoppingRQ`: per-ora fan-out via `AIRLINE_TO_PROVIDER`, `resolveAirlineProfileEntries` (AF/KL, A3/OA special cases; `NDCSabres.includes(ora)` → single SABRENDC profile with `ndcFound`), `fetchSingleAirlineShoppingResponse`, `collectAirlineShoppingResponses` (deadline), `ValueReformater` merge, per-ora `NonResultStructureWithCode`. |
| Airline constants | `api-aerial/src/utils/airline-constants.utils.js` | `AIRLINE_TO_PROVIDER`, `NDC_SABRE_AIRLINES` (LH, UA, UAD, SN, LX, LXA, OS, QF, F1, AV, BR, HA, LO, NH, RJ, SK, AZ), LCC lists. |
| NDC[X] shopping | `api-aerial/src/controllers/AMADEUS_NDCX/shopping.controller.js` + `src/utils/AMADEUS_NDCX/shopping.utils.js` | `collectAirlinePreferences(body.selectedAirline)` filters `gds === "AMADEUS_NDCX"` entries → `travelFlightInfo.companyIdentity` (Preferred → qualifier `M`, Unacceptable → `W`/`X`). Scoped NDC[X] search already works end-to-end. |
| NDC[X] gate | `api-aerial/src/utils/AMADEUS_NDCX/ndcxControllerFactory.js` | 400 unless `req.salesPoint` has `Amadeus-ndcx-enable` (presence, value unread). |
| Sales point load | `api-aerial/src/services/AMADEUS/amadeusServiceFactory.js` `getSalesPoint()` | DB query with **whitelisted attribute types**, 10-min cache, **400s for PDVs without an Amadeus OfficeID** — that is why the router gets its own lightweight service instead of extending this whitelist. |
| Attr CRUD | `api-dashboard/src/services/attribut.service.js` + `sales_points.controller.js` | Generic create/update by `attributData` array (delete-missing + upsert). **No changes needed.** |
| Dashboard form | `front-dashboard/src/components/dashboards/admin/agence/[id]/point-de-vente/CreatePointDVente.vue` | Generic attribute editor: Catégorie `AppSelect :items="categories"` → Type `AppSelect :items="typeItems"` → Valeur (special-cased selects exist, e.g. `WEBBEDS_PAYMENT_TYPE` at ~line 1886) → Ajouter. Save: POST `/api/sales_points/create` / PUT `/api/sales_points/update/:id` with `attributData`. |
| Dashboard mapping | `front-dashboard/src/data/CategoryMapping.ts` | Categories drive the form; `Amadeus-ndcx-enable` sits in the Amadeus category (MET2-2422). |

---

# Part A — api-aerial routing system

Repo: `/home/anas/Desktop/metis/api-aerial`, branch `deyra-met2-2422` (already checked out, clean). Run all commands from the repo root.

### Task A1: NDC[X] airline constants + routable overlap

**Files:**
- Modify: `src/utils/airline-constants.utils.js`
- Test: `src/utils/airline-constants.ndc-routing.test.js` (new)

**Interfaces:**
- Produces: `NDCX_AIRLINES: string[]` (30 codes), `ROUTABLE_NDC_AIRLINES: string[]` (10 codes), `isNdcxAirline(code)`, `isRoutableNdcAirline(code)` — consumed by A2, A5, A6.

- [ ] **Step 1: Write the failing test**

Create `src/utils/airline-constants.ndc-routing.test.js`:

```js
// MET2-2422 : constantes NDC[X] + routables — invariants des listes miroirs.
// Lancer avec : node --test src/utils/airline-constants.ndc-routing.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const {
  NDCX_AIRLINES,
  ROUTABLE_NDC_AIRLINES,
  NDC_SABRE_AIRLINES,
  LCC_AIRLINES,
} = require("./airline-constants.utils");

test("MET2-2422 : chaque routable est NDC[X] ET Sabre NDC", () => {
  for (const code of ROUTABLE_NDC_AIRLINES) {
    assert.ok(NDCX_AIRLINES.includes(code), `${code} doit etre dans NDCX_AIRLINES`);
    assert.ok(NDC_SABRE_AIRLINES.includes(code), `${code} doit etre dans NDC_SABRE_AIRLINES`);
  }
});

test("MET2-2422 : aucune LCC dans la grille NDC[X]", () => {
  for (const code of NDCX_AIRLINES) {
    assert.ok(!LCC_AIRLINES.includes(code), `${code} est une LCC (canal Metis dedie)`);
  }
});

test("MET2-2422 : codes uniques, designateurs IATA 2 caracteres", () => {
  assert.equal(new Set(NDCX_AIRLINES).size, NDCX_AIRLINES.length);
  assert.equal(new Set(ROUTABLE_NDC_AIRLINES).size, ROUTABLE_NDC_AIRLINES.length);
  for (const code of [...NDCX_AIRLINES, ...ROUTABLE_NDC_AIRLINES]) {
    assert.match(code, /^[A-Z0-9]{2}$/);
  }
});

test("MET2-2422 : volumes attendus (30 NDC[X], 10 routables)", () => {
  assert.equal(NDCX_AIRLINES.length, 30);
  assert.equal(ROUTABLE_NDC_AIRLINES.length, 10);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/utils/airline-constants.ndc-routing.test.js`
Expected: FAIL — `NDCX_AIRLINES` is not exported (TypeError on destructuring `undefined`).

- [ ] **Step 3: Add the constants**

In `src/utils/airline-constants.utils.js`, after the `NDC_SABRE_AIRLINES` block (after line 62) and before the "Other NDC airlines" section:

```js
// ─── NDC[X] airlines (Amadeus NDC[X] pipe) ────────────────────────────
/**
 * MET2-2422 : compagnies servables par l'office Amadeus NDC[X] (matrice de
 * capacites 26_06_15, statut production). Liste STATIQUE : la capacite NDC[X]
 * est cote office Amadeus, pas configurable par PDV — la grille de coches du
 * front n'est visible qu'avec l'attribut Amadeus-ndcx-enable.
 * VY et 6E (Navitaire chez Amadeus) sont exclus : canal LCC Metis (pipes
 * VY/GOKYTE). EN/4Y exclus en attendant confirmation Amadeus.
 * MIROIR : front-reservation app/utils/flight/ndcxAirlines.ts — garder les
 * deux listes synchronisees a la main, comme sabreNdcAirlines.ts.
 */
const NDCX_AIRLINES = [
  "AA", "AC", "AF", "AI", "AY", "AZ", "BA", "BR", "CX", "EK",
  "EY", "IB", "KL", "KQ", "LH", "LO", "LX", "MH", "NP", "OS",
  "QR", "QF", "SK", "SM", "SN", "SQ", "SV", "TP", "TU", "UA",
];

/**
 * MET2-2422 : compagnies servies A LA FOIS par NDC[X] et par Sabre NDC —
 * seules celles-ci passent par le routeur (priorite + repli). Derive de
 * NDCX_AIRLINES ∩ NDC_SABRE_AIRLINES (invariant teste) ; maintenir a la main.
 */
const ROUTABLE_NDC_AIRLINES = [
  "LH", "LX", "OS", "SN", "AZ", "UA", "QF", "BR", "LO", "SK",
];

/** Vrai si le code est servable par NDC[X] (grille de coches du front). */
const isNdcxAirline = (code) => NDCX_AIRLINES.includes(normalizeAirlineCode(code));

/** Vrai si le code passe par le routeur NDC (NDC[X] vs Sabre NDC). */
const isRoutableNdcAirline = (code) =>
  ROUTABLE_NDC_AIRLINES.includes(normalizeAirlineCode(code));
```

And in the `module.exports` block, add to the "Airline lists — canal mapping" group:

```js
  NDCX_AIRLINES,
  ROUTABLE_NDC_AIRLINES,
```

and to the "Helpers" group:

```js
  isNdcxAirline,
  isRoutableNdcAirline,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/utils/airline-constants.ndc-routing.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/airline-constants.utils.js src/utils/airline-constants.ndc-routing.test.js
git commit -m "MET2-2422 ndc routing: constantes NDCX_AIRLINES + ROUTABLE_NDC_AIRLINES (miroirs, invariants testes)"
```

### Task A2: NDC routing config utils (pure)

**Files:**
- Create: `src/utils/ndc-routing.utils.js`
- Test: `src/utils/ndc-routing.utils.test.js`

**Interfaces:**
- Consumes: `isRoutableNdcAirline` from A1.
- Produces (consumed by A5/A6 and the tests):
  - `NDC_ROUTING_PRIORITY_ATTRIBUTE = "NDC-routing-priority"`, `NDC_ROUTING_FALLBACK_ATTRIBUTE = "NDC-routing-fallback"`, `NDC_ROUTE_ORA = "NDC_ROUTE"`, `PROVIDER_TOKENS`
  - `parseRoutingPriority(raw: string) -> string[]` — provider keys in order (`"AMADEUS_NDCX"`, `"SABRE"`), invalid/duplicate tokens dropped
  - `resolveNdcRoutingConfig(attributes: object|null) -> {providers: string[], fallback: boolean}|null` — `null` = router inactive
  - `applyNdcRoutingToBody(body, routing) -> {routedAirlines: string[], oras: string[], ndcxScope: {mode, entries}|null, profile: object|null}`

- [ ] **Step 1: Write the failing test**

Create `src/utils/ndc-routing.utils.test.js`:

```js
// MET2-2422 : resolution de config + reecriture du body de shopping (purs).
// Lancer avec : node --test src/utils/ndc-routing.utils.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const {
  parseRoutingPriority,
  resolveNdcRoutingConfig,
  applyNdcRoutingToBody,
  NDC_ROUTE_ORA,
  NDC_ROUTING_PRIORITY_ATTRIBUTE,
  NDC_ROUTING_FALLBACK_ATTRIBUTE,
} = require("./ndc-routing.utils");

const ATTRS = {
  [NDC_ROUTING_PRIORITY_ATTRIBUTE]: "NDCX,SABRE",
  "Amadeus-ndcx-enable": "true",
  "Sabre-iPCC": "XXXXXXX",
};

test("parseRoutingPriority : ordre preserve, tokens invalides/doublons ignores", () => {
  assert.deepEqual(parseRoutingPriority("NDCX,SABRE"), ["AMADEUS_NDCX", "SABRE"]);
  assert.deepEqual(parseRoutingPriority(" sabre , ndcx "), ["SABRE", "AMADEUS_NDCX"]);
  assert.deepEqual(parseRoutingPriority("NDCX,FOO,NDCX"), ["AMADEUS_NDCX"]);
  assert.deepEqual(parseRoutingPriority(""), []);
  assert.deepEqual(parseRoutingPriority(undefined), []);
});

test("resolveNdcRoutingConfig : sans attribut priorite => null (legacy)", () => {
  assert.equal(resolveNdcRoutingConfig(null), null);
  assert.equal(resolveNdcRoutingConfig({ "Sabre-iPCC": "X" }), null);
});

test("resolveNdcRoutingConfig : capacite — sans Amadeus-ndcx-enable le NDCX saute", () => {
  const config = resolveNdcRoutingConfig({
    [NDC_ROUTING_PRIORITY_ATTRIBUTE]: "NDCX,SABRE",
    "Sabre-iPCC": "X",
  });
  assert.deepEqual(config.providers, ["SABRE"]);
});

test("resolveNdcRoutingConfig : sans Sabre-iPCC le SABRE saute", () => {
  const config = resolveNdcRoutingConfig({
    [NDC_ROUTING_PRIORITY_ATTRIBUTE]: "NDCX,SABRE",
    "Amadeus-ndcx-enable": "true",
  });
  assert.deepEqual(config.providers, ["AMADEUS_NDCX"]);
});

test("resolveNdcRoutingConfig : repli actif par defaut, desactive par 'false'", () => {
  assert.equal(resolveNdcRoutingConfig(ATTRS).fallback, true);
  assert.equal(
    resolveNdcRoutingConfig({ ...ATTRS, [NDC_ROUTING_FALLBACK_ATTRIBUTE]: "false" }).fallback,
    false,
  );
});

test("applyNdcRoutingToBody : sans routables => body intact, pas de profil", () => {
  const body = { oras: ["IB", "AMADEUS_NDCX"], selectedAirline: [
    { code: "IB", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" },
  ] };
  const applied = applyNdcRoutingToBody(body, resolveNdcRoutingConfig(ATTRS));
  // IB n'est pas routable : tout reste en place, pas de chaine.
  assert.equal(applied.routedAirlines.length, 0);
  assert.deepEqual(applied.oras, body.oras);
  assert.equal(applied.profile, null);
  assert.equal(applied.ndcxScope, null);
});

test("applyNdcRoutingToBody : chip LH (legacy Sabre NDC) => profil NDC_ROUTE, LH retire des oras", () => {
  const body = { oras: ["LH", "IB"], selectedAirline: [] };
  const applied = applyNdcRoutingToBody(body, resolveNdcRoutingConfig(ATTRS));
  assert.deepEqual(applied.routedAirlines, ["LH"]);
  assert.deepEqual(applied.oras, ["IB"]);
  assert.equal(applied.profile.ora, NDC_ROUTE_ORA);
  assert.deepEqual(applied.profile.bodyOras, ["LH"]);
  assert.equal(applied.profile.isNdcRoute, true);
  assert.equal(applied.profile.noVerif, true);
});

test("applyNdcRoutingToBody : grille NDC[X] avec LH+IB => LH route, IB reste scope NDC[X]", () => {
  const body = {
    oras: ["AMADEUS_NDCX"],
    selectedAirline: [
      { code: "LH", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" },
      { code: "IB", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" },
    ],
  };
  const applied = applyNdcRoutingToBody(body, resolveNdcRoutingConfig(ATTRS));
  assert.deepEqual(applied.routedAirlines, ["LH"]);
  assert.deepEqual(applied.oras, ["AMADEUS_NDCX"]);
  assert.equal(applied.ndcxScope.mode, "scoped");
  assert.deepEqual(
    applied.ndcxScope.entries.map((e) => e.code),
    ["IB"],
  );
});

test("applyNdcRoutingToBody : grille NDC[X] 100% routable => pseudo-ora supprime", () => {
  const body = {
    oras: ["AMADEUS_NDCX"],
    selectedAirline: [{ code: "LH", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" }],
  };
  const applied = applyNdcRoutingToBody(body, resolveNdcRoutingConfig(ATTRS));
  assert.deepEqual(applied.oras, []);
  assert.equal(applied.ndcxScope.mode, "none");
});

test("applyNdcRoutingToBody : NDC[X] sans bornage => routables exclus de l'appel brut", () => {
  const body = { oras: ["AMADEUS_NDCX", "AF"], selectedAirline: [] };
  const applied = applyNdcRoutingToBody(body, resolveNdcRoutingConfig(ATTRS));
  assert.deepEqual(applied.routedAirlines, []);
  // Aucun routable demande => rien a router, comportement inchange.
  assert.deepEqual(applied.oras, body.oras);
  assert.equal(applied.profile, null);
});

test("applyNdcRoutingToBody : chip + grille sur la meme compagnie => dedoublonne", () => {
  const body = {
    oras: ["LH"],
    selectedAirline: [{ code: "LH", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" }],
  };
  const applied = applyNdcRoutingToBody(body, resolveNdcRoutingConfig(ATTRS));
  assert.deepEqual(applied.routedAirlines, ["LH"]);
});
```

Note: the "NDC[X] sans bornage" test asserts the no-routables case. The unscoped-with-routables case (toggle ON, empty include, **plus** an LH chip) is:

```js
test("applyNdcRoutingToBody : NDC[X] non borne + chip LH => LH exclus de l'appel NDC[X] brut", () => {
  const body = { oras: ["AMADEUS_NDCX", "LH"], selectedAirline: [] };
  const applied = applyNdcRoutingToBody(body, resolveNdcRoutingConfig(ATTRS));
  assert.deepEqual(applied.routedAirlines, ["LH"]);
  assert.deepEqual(applied.oras, ["AMADEUS_NDCX"]);
  assert.equal(applied.ndcxScope.mode, "unscoped");
  assert.deepEqual(
    applied.ndcxScope.entries,
    [{ code: "LH", PreferLevel: "Unacceptable", gds: "AMADEUS_NDCX" }],
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/utils/ndc-routing.utils.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/ndc-routing.utils.js`**

```js
/**
 * MET2-2422 — routeur de recherche NDC : NDC[X] prioritaire sur Sabre NDC,
 * repli par compagnie (vide/erreur/timeout). Opt-in par attributs PDV :
 *   NDC-routing-priority = "NDCX,SABRE" (CSV ordonne, tokens NDCX|SABRE)
 *   NDC-routing-fallback = "true"|"false" (absent = actif)
 * Sans attribut priorite, le routeur est INACTIF et le comportement actuel
 * (chips -> pipes historiques, pseudo-ora AMADEUS_NDCX -> MasterPricer) est
 * conserve tel quel.
 */
const { isRoutableNdcAirline } = require("./airline-constants.utils");

const NDC_ROUTING_PRIORITY_ATTRIBUTE = "NDC-routing-priority";
const NDC_ROUTING_FALLBACK_ATTRIBUTE = "NDC-routing-fallback";
const NDCX_ENABLE_ATTRIBUTE = "Amadeus-ndcx-enable";
const SABRE_IPCC_ATTRIBUTE = "Sabre-iPCC";

/** Tokens du dashboard -> cles provider (dossiers de contrôleurs). */
const PROVIDER_TOKENS = Object.freeze({ NDCX: "AMADEUS_NDCX", SABRE: "SABRE" });

/** Ora interne du profil route (jamais un code compagnie). */
const NDC_ROUTE_ORA = "NDC_ROUTE";

/**
 * Budget de l'etape NDC[X] de la chaine (defaut 12 s) : laisse >= ~34 s au
 * repli SABRENDC dans le budget global de 52 s (SHOPPING_RESPONSE_BUDGET_MS).
 * Env : NDC_ROUTING_NDCX_STEP_TIMEOUT_MS.
 */
const DEFAULT_NDCX_STEP_TIMEOUT_MS = Number(
  process.env.NDC_ROUTING_NDCX_STEP_TIMEOUT_MS || 12000
);

function parseRoutingPriority(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const seen = new Set();
  const providers = [];
  for (const token of raw.split(",")) {
    const key = PROVIDER_TOKENS[String(token).trim().toUpperCase()];
    if (key && !seen.has(key)) {
      seen.add(key);
      providers.push(key);
    }
  }
  return providers;
}

/**
 * Resout la config de routage d'un PDV (map type attribut -> valeur).
 * Filtre de capacite : NDCX exige Amadeus-ndcx-enable, SABRE exige Sabre-iPCC
 * (le repli ne cherche jamais chez un PDV sans identifiants Sabre).
 * @param {object|null} salesPointAttributes
 * @returns {{providers: string[], fallback: boolean}|null} null = inactif.
 */
function resolveNdcRoutingConfig(salesPointAttributes) {
  const attrs = salesPointAttributes || {};
  const has = (type) => Object.prototype.hasOwnProperty.call(attrs, type);
  if (!has(NDC_ROUTING_PRIORITY_ATTRIBUTE)) return null;

  let providers = parseRoutingPriority(attrs[NDC_ROUTING_PRIORITY_ATTRIBUTE]);
  if (!has(NDCX_ENABLE_ATTRIBUTE)) {
    providers = providers.filter((p) => p !== PROVIDER_TOKENS.NDCX);
  }
  if (!has(SABRE_IPCC_ATTRIBUTE)) {
    providers = providers.filter((p) => p !== PROVIDER_TOKENS.SABRE);
  }
  if (providers.length === 0) return null;

  const fallbackRaw = String(attrs[NDC_ROUTING_FALLBACK_ATTRIBUTE] ?? "")
    .trim()
    .toLowerCase();
  return { providers, fallback: fallbackRaw !== "false" };
}

/**
 * Reecrit le body de /global/airShoppingRQ pour le routage (pur, testable) :
 * - les oras routables quittent le fan-out classique et deviennent UN profil
 *   NDC_ROUTE (une seule execution : 1 MasterPricer NDC[X] borne aux routables,
 *   puis 1 SABRENDC batch pour les manquantes — cf ndc-routing.executor.js) ;
 * - le pseudo-ora AMADEUS_NDCX est rescopé aux compagnies non routables ;
 *   une recherche NDC[X] non bornee reçoit les routables en EXCLUSION pour ne
 *   pas les chercher deux fois ;
 * - si la grille NDC[X] ne contient plus que des routables, le pseudo-ora
 *   disparait (la chaine les couvre).
 *
 * @param {object} body body canonique ({oras, selectedAirline, ...})
 * @param {{providers: string[], fallback: boolean}} routing config active
 * @returns {{
 *   routedAirlines: string[],
 *   oras: string[],
 *   ndcxScope: {mode: "scoped"|"unscoped"|"none", entries: Array<{code: string, PreferLevel: string, gds: string}>}|null,
 *   profile: object|null
 * }}
 */
function applyNdcRoutingToBody(body, routing) {
  const oras = Array.isArray(body?.oras) ? [...body.oras] : [];
  const selectedAirline = Array.isArray(body?.selectedAirline) ? body.selectedAirline : [];
  const isNdcxPreferred = (e) =>
    e && String(e.gds ?? "").toUpperCase() === "AMADEUS_NDCX" && e.PreferLevel === "Preferred";

  const routedFromOras = oras.filter((ora) => isRoutableNdcAirline(ora));
  const routedFromScope = selectedAirline
    .filter(isNdcxPreferred)
    .flatMap((e) => String(e.code ?? "").split("/"))
    .map((c) => c.trim().toUpperCase())
    .filter((c) => isRoutableNdcAirline(c));
  const routedAirlines = [...new Set([...routedFromOras, ...routedFromScope])];
  if (routedAirlines.length === 0) {
    return { routedAirlines, oras, ndcxScope: null, profile: null };
  }

  const routedSet = new Set(routedAirlines);
  const nextOras = oras.filter((ora) => !isRoutableNdcAirline(ora));
  const profile = {
    ora: NDC_ROUTE_ORA,
    verif: { result: true, message: null },
    noVerif: true,
    bodyOras: [...routedAirlines],
    isNdcRoute: true,
  };

  if (!nextOras.includes("AMADEUS_NDCX")) {
    return { routedAirlines, oras: nextOras, ndcxScope: null, profile };
  }

  const ndcxPreferred = selectedAirline.filter(isNdcxPreferred);
  if (ndcxPreferred.length === 0) {
    // Recherche NDC[X] non bornee : on y exclut les routables (W/X qualifier
    // dans buildTravelFlightInfo), servies par la chaine.
    const entries = routedAirlines.map((code) => ({
      code,
      PreferLevel: "Unacceptable",
      gds: "AMADEUS_NDCX",
    }));
    return { routedAirlines, oras: nextOras, ndcxScope: { mode: "unscoped", entries }, profile };
  }

  const entries = ndcxPreferred
    .map((e) => ({
      ...e,
      code: String(e.code ?? "")
        .split("/")
        .filter((c) => !routedSet.has(c.trim().toUpperCase()))
        .join("/"),
    }))
    .filter((e) => e.code !== "");

  if (entries.length === 0) {
    const withoutPseudoOra = nextOras.filter((ora) => ora !== "AMADEUS_NDCX");
    return {
      routedAirlines,
      oras: withoutPseudoOra,
      ndcxScope: { mode: "none", entries: [] },
      profile,
    };
  }
  return { routedAirlines, oras: nextOras, ndcxScope: { mode: "scoped", entries }, profile };
}

module.exports = {
  NDC_ROUTING_PRIORITY_ATTRIBUTE,
  NDC_ROUTING_FALLBACK_ATTRIBUTE,
  NDCX_ENABLE_ATTRIBUTE,
  SABRE_IPCC_ATTRIBUTE,
  PROVIDER_TOKENS,
  NDC_ROUTE_ORA,
  DEFAULT_NDCX_STEP_TIMEOUT_MS,
  parseRoutingPriority,
  resolveNdcRoutingConfig,
  applyNdcRoutingToBody,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/utils/ndc-routing.utils.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/ndc-routing.utils.js src/utils/ndc-routing.utils.test.js
git commit -m "MET2-2422 ndc routing: config par attributs PDV + reecriture du body (pur, teste)"
```

### Task A3: Extract `NonResultStructure` to a shared module

The executor (A5) must shape per-step errors exactly like `global.controller.js` does. Both files will import the same helpers.

**Files:**
- Create: `src/utils/Structure/nonResultStructure.js`
- Modify: `src/controllers/global.controller.js` (lines 53–86: delete the two local functions, require the new module)

**Interfaces:**
- Produces: `NonResultStructure(ora, message)`, `NonResultStructureWithCode(ora, message, code = "404")` — consumed by global.controller (unchanged call sites) and A5.

- [ ] **Step 1: Create the module** — copy the two functions **verbatim** from `global.controller.js` lines 53–86 (bodies unchanged, `module.exports = { NonResultStructure, NonResultStructureWithCode };` added). File header comment: `// MET2-2422 : structures d'erreur par ora, extraites de global.controller.js pour le routeur NDC (zero changement de comportement).`

- [ ] **Step 2: Rewire global.controller.js** — delete the local definitions (lines 53–86) and add with the other requires at the top:

```js
const { NonResultStructure, NonResultStructureWithCode } = require("../utils/Structure/nonResultStructure");
```

- [ ] **Step 3: Verify nothing broke**

Run: `node --test src/controllers/AMADEUS_NDCX/__tests__/ndcxEnableAttribute.met2-2422.test.js` and `node --test src/controllers/__tests__/sabre.offerPrice.passengers.test.js`
Expected: PASS (both suites are independent of global.controller but prove the require graph is intact). Also run `node -e "require('./src/controllers/global.controller.js')"` — expected: no exception.

- [ ] **Step 4: Commit**

```bash
git add src/utils/Structure/nonResultStructure.js src/controllers/global.controller.js
git commit -m "MET2-2422 ndc routing: extraction NonResultStructure vers utils/Structure (partage routeur)"
```

### Task A4: Sales-point routing attributes service

`getSalesPoint()` (amadeusServiceFactory) cannot be reused: it whitelists Amadeus attribute types and 400s for PDVs without an Amadeus OfficeID. The router needs its own light query with the same cache discipline.

**Files:**
- Create: `src/services/ndcRouting.service.js`
- Test: `src/services/ndcRouting.service.test.js`

**Interfaces:**
- Produces: `getSalesPointNdcRouting(salesPointId, { queryFn }?) -> Promise<{id, name, attributes: Record<string,string>}|null>` — consumed by A6. `queryFn` injection exists for tests.

- [ ] **Step 1: Write the failing test**

```js
// MET2-2422 : service d'attributs de routage NDC — cache 10 min + injection.
// Lancer avec : node --test src/services/ndcRouting.service.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { getSalesPointNdcRouting, __resetNdcRoutingCache } = require("./ndcRouting.service");

const fakeSalesPoint = {
  id: 7,
  name: "PDV TEST",
  attribut: [
    { type: "NDC-routing-priority", value: "NDCX,SABRE" },
    { type: "Amadeus-ndcx-enable", value: "true" },
  ],
};

test("MET2-2422 : attributs aplatisses en map type -> valeur", async () => {
  __resetNdcRoutingCache();
  let calls = 0;
  const data = await getSalesPointNdcRouting(7, {
    queryFn: async () => {
      calls++;
      return fakeSalesPoint;
    },
  });
  assert.equal(data.attributes["NDC-routing-priority"], "NDCX,SABRE");
  assert.equal(data.attributes["Amadeus-ndcx-enable"], "true");
  assert.equal(calls, 1);
});

test("MET2-2422 : cache — deuxieme appel sans relecture", async () => {
  __resetNdcRoutingCache();
  let calls = 0;
  const queryFn = async () => {
    calls++;
    return fakeSalesPoint;
  };
  await getSalesPointNdcRouting(7, { queryFn });
  await getSalesPointNdcRouting(7, { queryFn });
  assert.equal(calls, 1);
});

test("MET2-2422 : PDV introuvable (aucun attribut requete) => null", async () => {
  __resetNdcRoutingCache();
  const data = await getSalesPointNdcRouting(999, { queryFn: async () => null });
  assert.equal(data, null);
});
```

- [ ] **Step 2: Run it to verify it fails** — Run: `node --test src/services/ndcRouting.service.test.js` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/services/ndcRouting.service.js`**

```js
/**
 * MET2-2422 : attributs de routage NDC d'un PDV (priorite, repli, activation
 * NDC[X], identifiants Sabre). Requete dediee — getSalesPoint() (Amadeus) ne
 * charge que sa whitelist et refuse les PDV sans OfficeID Amadeus, ce qui
 * casserait le routage des PDV Sabre-only. Cache 10 min comme lui : une modif
 * dashboard peut mettre ~10 min a etre vue par le routeur.
 */
const Models = require("../models/index");
const SalesPoints = Models["SalesPoints"];
const Attribut = Models["Attribut"];
const { Op } = require("sequelize");

const CACHE_TTL_MS = 10 * 60 * 1000;
const ndcRoutingCache = new Map();

const NDC_ROUTING_ATTRIBUTE_TYPES = [
  "NDC-routing-priority",
  "NDC-routing-fallback",
  "Amadeus-ndcx-enable",
  "Sabre-iPCC",
];

async function defaultQuery(salesPointId) {
  return SalesPoints.findOne({
    where: { id: salesPointId },
    attributes: ["name", "id"],
    include: [
      {
        model: Attribut,
        required: true,
        as: "attribut",
        attributes: ["value", "type"],
        where: { type: { [Op.in]: NDC_ROUTING_ATTRIBUTE_TYPES } },
      },
    ],
  });
}

/**
 * @param {number|string} salesPointId
 * @param {{queryFn?: (id) => Promise<object|null>}} [options] queryFn injecte pour les tests
 * @returns {Promise<{id: number, name: string, attributes: Record<string,string>}|null>}
 */
async function getSalesPointNdcRouting(salesPointId, options = {}) {
  const key = String(salesPointId);
  const cached = ndcRoutingCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const query = options.queryFn || defaultQuery;
  const salesPoint = await query(salesPointId);
  if (!salesPoint) return null;
  const attributes = {};
  for (const attr of salesPoint.attribut ?? []) {
    attributes[attr.type] = attr.value;
  }
  const data = { id: salesPoint.id, name: salesPoint.name, attributes };
  ndcRoutingCache.set(key, { timestamp: Date.now(), data });
  return data;
}

/** Tests uniquement. */
function __resetNdcRoutingCache() {
  ndcRoutingCache.clear();
}

module.exports = { getSalesPointNdcRouting, __resetNdcRoutingCache };
```

Before writing, **verify the association alias**: open `src/models/sales_points.js` and confirm the `hasMany(Attribut)` alias is `attribut` (it must match `amadeusServiceFactory.js` line 97 `as: "attribut"`). If the alias differs, use the one from the model.

- [ ] **Step 4: Run the test to verify it passes** — Run: `node --test src/services/ndcRouting.service.test.js` — Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/ndcRouting.service.js src/services/ndcRouting.service.test.js
git commit -m "MET2-2422 ndc routing: service attributs PDV dedie (cache 10 min, queryFn injectable)"
```

### Task A5: Sequential routing executor

**Files:**
- Create: `src/utils/ndc-routing.executor.js`
- Test: `src/utils/ndc-routing.executor.test.js`

**Interfaces:**
- Consumes: `NDC_ROUTE_ORA`, `DEFAULT_NDCX_STEP_TIMEOUT_MS` (A2); `NonResultStructureWithCode` (A3); `withTimeout` from `src/helpers/withTimeout.js`; `ValueReformater` from `src/utils/global-shopping.js`.
- Produces: `runNdcRoutedShopping({airlines, body, routing, deadlineAt, callProvider, ndcxStepTimeoutMs?}) -> Promise<{merged: object, fallbackUsed: boolean, missing: string[]}>` — consumed by A6. `callProvider(ora, body) -> Promise<object>` is injected (in prod it wraps `controllerReturn`).

- [ ] **Step 0: Read `src/utils/global-shopping.js`** and confirm how `ValueReformater(results, devise, flights)` merges an array of per-ora shopping results (it is the exact function `global.controller.js` line 654 calls over all provider results) and that `stripInternalShoppingFields` is idempotent. The executor feeds it the same shape: NDC[X] mapped replies (Oras "AMADEUS_NDCX", set by `shoppingReply.mapper.js` line 77) and SABRENDC replies. If reading reveals a required field the steps lack, wrap steps through `NonResultStructureWithCode`-shaped objects first — do not invent a second merge format.

- [ ] **Step 1: Write the failing test**

```js
// MET2-2422 : executeur de chaine NDC — NDC[X] timeboxe puis repli SABRENDC
// par compagnie manquante (vide/erreur/timeout). callProvider injecte.
// Lancer avec : node --test src/utils/ndc-routing.executor.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { runNdcRoutedShopping } = require("./ndc-routing.executor");

const ROUTING = { providers: ["AMADEUS_NDCX", "SABRE"], fallback: true };
const BODY = { agenceInfo: { devise: "EUR" }, flights: [] };
const deadlineAt = () => Date.now() + 50_000;

const ndcxReplyWith = (...carriers) => ({
  Oras: "AMADEUS_NDCX",
  OriginListFlights: [
    {
      OriginCode: "PAR",
      DestCode: "TYO",
      flights: carriers.map((marketingCarrier) => ({
        MarketingCarrierInfo: { CarrierDesigCode: marketingCarrier },
      })),
    },
  ],
  DataLists: { BaggageAllowance: [], OriginDest: [], PaxJourney: [], Pax: [], PaxSegment: [], PriceClass: [], ServiceDefinition: [] },
  ResponseID: "ndcx-1",
  Errors: [],
});
const emptyNdcx = { Oras: "AMADEUS_NDCX", OriginListFlights: [], DataLists: {}, ResponseID: null, Errors: [] };
const sabreReply = { Oras: "SABRENDC", OriginListFlights: [{ flights: [{ MarketingCarrierInfo: { CarrierDesigCode: "LH" } }] }], DataLists: {}, ResponseID: "sabre-1", Errors: [] };

test("NDC[X] sert tout => un seul appel, pas de repli", async () => {
  const calls = [];
  const { merged, fallbackUsed } = await runNdcRoutedShopping({
    airlines: ["LH", "AZ"],
    body: BODY,
    routing: ROUTING,
    deadlineAt: deadlineAt(),
    ndcxStepTimeoutMs: 1000,
    callProvider: async (ora, body) => {
      calls.push({ ora, body });
      return ndcxReplyWith("LH", "AZ");
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ora, "AMADEUS_NDCX");
  assert.deepEqual(
    calls[0].body.selectedAirline,
    [
      { code: "LH", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" },
      { code: "AZ", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" },
    ],
  );
  assert.equal(fallbackUsed, false);
  assert.ok(merged.OriginListFlights.length > 0);
});

test("NDC[X] ne sert que LH => repli SABRENDC avec ndcFound=[AZ] uniquement", async () => {
  const calls = [];
  const { fallbackUsed, missing } = await runNdcRoutedShopping({
    airlines: ["LH", "AZ"],
    body: BODY,
    routing: ROUTING,
    deadlineAt: deadlineAt(),
    ndcxStepTimeoutMs: 1000,
    callProvider: async (ora, body) => {
      calls.push({ ora, body });
      return ora === "AMADEUS_NDCX" ? ndcxReplyWith("LH") : sabreReply;
    },
  });
  assert.equal(fallbackUsed, true);
  assert.deepEqual(missing, ["AZ"]);
  assert.equal(calls[1].ora, "SABRENDC");
  assert.deepEqual(calls[1].body.ndcFound, ["AZ"]);
  assert.deepEqual(calls[1].body.oras, ["AZ"]);
});

test("NDC[X] vide => repli sur toutes les compagnies", async () => {
  const calls = [];
  const { fallbackUsed, missing } = await runNdcRoutedShopping({
    airlines: ["LH", "SK"],
    body: BODY,
    routing: ROUTING,
    deadlineAt: deadlineAt(),
    ndcxStepTimeoutMs: 1000,
    callProvider: async (ora, body) => {
      calls.push({ ora, body });
      return ora === "AMADEUS_NDCX" ? emptyNdcx : sabreReply;
    },
  });
  assert.equal(fallbackUsed, true);
  assert.deepEqual(missing, ["LH", "SK"]);
});

test("NDC[X] en erreur => repli (decision 6 : erreur = sans offre)", async () => {
  const calls = [];
  const { fallbackUsed } = await runNdcRoutedShopping({
    airlines: ["LH"],
    body: BODY,
    routing: ROUTING,
    deadlineAt: deadlineAt(),
    ndcxStepTimeoutMs: 1000,
    callProvider: async (ora) => {
      calls.push(ora);
      if (ora === "AMADEUS_NDCX") throw new Error("NdcxError: host refused");
      return sabreReply;
    },
  });
  assert.equal(fallbackUsed, true);
  assert.deepEqual(calls, ["AMADEUS_NDCX", "SABRENDC"]);
});

test("NDC[X] timeout (timebox) => repli", async () => {
  const calls = [];
  const { fallbackUsed } = await runNdcRoutedShopping({
    airlines: ["LH"],
    body: BODY,
    routing: ROUTING,
    deadlineAt: deadlineAt(),
    ndcxStepTimeoutMs: 40,
    callProvider: async (ora) => {
      calls.push(ora);
      if (ora === "AMADEUS_NDCX") return new Promise(() => {}); // jamais resolu
      return sabreReply;
    },
  });
  assert.equal(fallbackUsed, true);
  assert.deepEqual(calls, ["AMADEUS_NDCX", "SABRENDC"]);
});

test("repli desactive => un seul pas meme vide", async () => {
  const calls = [];
  const { fallbackUsed } = await runNdcRoutedShopping({
    airlines: ["LH"],
    body: BODY,
    routing: { providers: ["AMADEUS_NDCX", "SABRE"], fallback: false },
    deadlineAt: deadlineAt(),
    ndcxStepTimeoutMs: 1000,
    callProvider: async (ora) => {
      calls.push(ora);
      return emptyNdcx;
    },
  });
  assert.equal(fallbackUsed, false);
  assert.deepEqual(calls, ["AMADEUS_NDCX"]);
});

test("priorite SABRE d'abord : SABRENDC initial, repli NDC[X] borne aux manquantes", async () => {
  const calls = [];
  const { fallbackUsed, missing } = await runNdcRoutedShopping({
    airlines: ["LH", "QF"],
    body: BODY,
    routing: { providers: ["SABRE", "AMADEUS_NDCX"], fallback: true },
    deadlineAt: deadlineAt(),
    ndcxStepTimeoutMs: 1000,
    callProvider: async (ora, body) => {
      calls.push({ ora, body });
      if (ora === "SABRENDC") return { Oras: "SABRENDC", OriginListFlights: [{ flights: [{ MarketingCarrierInfo: { CarrierDesigCode: "LH" } }] }], DataLists: {}, ResponseID: "s", Errors: [] };
      return ndcxReplyWith("QF");
    },
  });
  assert.equal(fallbackUsed, true);
  assert.deepEqual(missing, ["QF"]);
  assert.equal(calls[0].ora, "SABRENDC");
  assert.deepEqual(calls[0].body.ndcFound, ["LH", "QF"]);
  assert.equal(calls[1].ora, "AMADEUS_NDCX");
  assert.deepEqual(calls[1].body.selectedAirline, [
    { code: "QF", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" },
  ]);
});

test("budget epuise => pas de second pas", async () => {
  const calls = [];
  const { fallbackUsed } = await runNdcRoutedShopping({
    airlines: ["LH"],
    body: BODY,
    routing: ROUTING,
    deadlineAt: Date.now() + 100, // deja presque expire
    ndcxStepTimeoutMs: 1000,
    callProvider: async (ora) => {
      calls.push(ora);
      return emptyNdcx;
    },
  });
  assert.equal(fallbackUsed, false);
  assert.deepEqual(calls, ["AMADEUS_NDCX"]);
});
```

- [ ] **Step 2: Run it to verify it fails** — Run: `node --test src/utils/ndc-routing.executor.test.js` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/utils/ndc-routing.executor.js`**

```js
/**
 * MET2-2422 — execution de la chaine NDC routee. Une execution par recherche :
 * 1 appel MasterPricer NDC[X] borne aux compagnies routees (timebox
 * NDC_ROUTING_NDCX_STEP_TIMEOUT_MS), puis 1 appel BargainFinderMax NDC
 * (SABRENDC, batch ndcFound) pour les compagnies sans offre — vide, erreur OU
 * timeout comptent comme "sans offre" (decision 6). Jamais de boucle de
 * re-shopping (regle GEN-02) : deux pas, max.
 */
const { withTimeout } = require("../helpers/withTimeout");
const { NonResultStructureWithCode } = require("./Structure/nonResultStructure");
const ValueReformater = require("./global-shopping");
const { NDC_ROUTE_ORA, DEFAULT_NDCX_STEP_TIMEOUT_MS } = require("./ndc-routing.utils");

// Lire l'env soi-meme : le routeur ne doit pas dependre des constantes de
// global.controller.js. Defaut identique a SHOPPING_SABRE_TIMEOUT_MS.
const SABRE_STEP_TIMEOUT_MS = Number(process.env.SHOPPING_SABRE_TIMEOUT_MS || 45000);

function carriersWithOffers(response) {
  const carriers = new Set();
  for (const od of response?.OriginListFlights ?? []) {
    for (const flight of od?.flights ?? []) {
      const code = flight?.MarketingCarrierInfo?.CarrierDesigCode;
      if (typeof code === "string" && code.trim()) carriers.add(code.trim().toUpperCase());
    }
  }
  return carriers;
}

function hasAnyOffer(response) {
  return (response?.OriginListFlights ?? []).some(
    (od) => Array.isArray(od?.flights) && od.flights.length > 0
  );
}

/** Reponse en echec (absente, vide, ou erreur sans offre) => toutes manquantes. */
function isFailedResult(response) {
  return !response || !hasAnyOffer(response);
}

function missingAirlines(response, airlines) {
  if (isFailedResult(response)) return [...airlines];
  const present = carriersWithOffers(response);
  return airlines.filter((a) => !present.has(a));
}

function toNonResult(ora, err) {
  const message = err?.message || `NDC routing step failed for ${ora}.`;
  const code = String(message).toLowerCase().includes("timeout") ? "408" : "500";
  return NonResultStructureWithCode(ora, message, code);
}

function ndcxScopedBody(body, airlines) {
  return {
    ...body,
    oras: ["AMADEUS_NDCX"],
    selectedAirline: airlines.map((code) => ({
      code,
      PreferLevel: "Preferred",
      gds: "AMADEUS_NDCX",
    })),
  };
}

function sabrendcBatchBody(body, airlines) {
  return { ...body, oras: [...airlines], ndcFound: [...airlines] };
}

function mergeRoutingSteps(steps, devise, flights) {
  const shaped = steps.map((step) => (step?.Oras ? step : { ...step, Oras: NDC_ROUTE_ORA }));
  // Meme chemin de fusion que le multi-provider du global.controller.
  return ValueReformater.stripInternalShoppingFields(
    ValueReformater(shaped, devise, flights)
  );
}

/**
 * @param {{
 *   airlines: string[],
 *   body: object,
 *   routing: {providers: string[], fallback: boolean},
 *   deadlineAt: number,
 *   callProvider: (ora: string, body: object) => Promise<object>,
 *   ndcxStepTimeoutMs?: number,
 * }} params
 * @returns {Promise<{merged: object, fallbackUsed: boolean, missing: string[]}>}
 */
async function runNdcRoutedShopping(params) {
  const { airlines, body, routing, deadlineAt, callProvider } = params;
  const ndcxStepTimeoutMs = params.ndcxStepTimeoutMs ?? DEFAULT_NDCX_STEP_TIMEOUT_MS;
  const devise = body?.agenceInfo?.devise;
  const steps = [];

  const primary = routing.providers[0];
  let primaryResponse;
  try {
    if (primary === "AMADEUS_NDCX") {
      primaryResponse = await withTimeout(
        callProvider("AMADEUS_NDCX", ndcxScopedBody(body, airlines)),
        ndcxStepTimeoutMs,
        `NDC routing NDC[X] step timeout (${airlines.join(",")}).`
      );
    } else {
      primaryResponse = await withTimeout(
        callProvider("SABRENDC", sabrendcBatchBody(body, airlines)),
        Math.min(SABRE_STEP_TIMEOUT_MS, Math.max(1, deadlineAt - Date.now())),
        `NDC routing SABRENDC step timeout (${airlines.join(",")}).`
      );
    }
  } catch (err) {
    primaryResponse = toNonResult(primary === "AMADEUS_NDCX" ? "AMADEUS_NDCX" : "SABRENDC", err);
  }
  steps.push(primaryResponse ?? toNonResult(primary, { message: "No response from primary step." }));

  let missing = missingAirlines(steps[0], airlines);
  let fallbackUsed = false;
  const secondary = routing.providers[1];
  const remainingMs = deadlineAt - Date.now();
  if (routing.fallback && secondary && missing.length > 0 && remainingMs > 1000) {
    let secondaryResponse;
    const secondaryOra = secondary === "SABRE" ? "SABRENDC" : "AMADEUS_NDCX";
    try {
      if (secondaryOra === "SABRENDC") {
        secondaryResponse = await withTimeout(
          callProvider("SABRENDC", sabrendcBatchBody(body, missing)),
          Math.min(SABRE_STEP_TIMEOUT_MS, remainingMs),
          `NDC routing SABRENDC fallback timeout (${missing.join(",")}).`
        );
      } else {
        secondaryResponse = await withTimeout(
          callProvider("AMADEUS_NDCX", ndcxScopedBody(body, missing)),
          Math.min(ndcxStepTimeoutMs, remainingMs),
          `NDC routing NDC[X] fallback timeout (${missing.join(",")}).`
        );
      }
      fallbackUsed = true;
    } catch (err) {
      secondaryResponse = toNonResult(secondaryOra, err);
      fallbackUsed = true;
    }
    steps.push(
      secondaryResponse ?? toNonResult(secondaryOra, { message: "No response from fallback step." })
    );
  }

  const merged = mergeRoutingSteps(steps, devise, body?.flights);
  return { merged, fallbackUsed, missing };
}

module.exports = { runNdcRoutedShopping, carriersWithOffers, missingAirlines };
```

Note on the "budget epuise" test: with `deadlineAt = now + 100 ms`, `remainingMs > 1000` is false → no second step, `fallbackUsed` false, single call. The primary NDC[X] step still runs (timebox 1000 ms) — the deadline only gates the *fallback*, matching the semantics that the fan-out deadline (`finalizePendingShoppingResults`) guards the whole task anyway.

- [ ] **Step 4: Run the test to verify it passes** — Run: `node --test src/utils/ndc-routing.executor.test.js` — Expected: PASS (8 tests). If `ValueReformater` rejects the step shapes, fix `mergeRoutingSteps` per Step 0 findings — the call contract (`ValueReformater(perOraResults[], devise, flights)`) is the same one `global.controller.js` uses.

- [ ] **Step 5: Commit**

```bash
git add src/utils/ndc-routing.executor.js src/utils/ndc-routing.executor.test.js
git commit -m "MET2-2422 ndc routing: executeur sequentiel NDC[X] timeboxe + repli SABRENDC par compagnie"
```

### Task A6: Wire the router into `global.controller.js`

**Files:**
- Modify: `src/controllers/global.controller.js`
- Test: none new (A2/A5 cover the logic; this task is thin wiring — the gate is the full existing suite + the require smoke)

**Interfaces:**
- Consumes: `getSalesPointNdcRouting` (A4), `resolveNdcRoutingConfig`, `applyNdcRoutingToBody`, `NDC_ROUTE_ORA` (A2), `runNdcRoutedShopping` (A5).

- [ ] **Step 1: Add the requires** (top of `global.controller.js`, with the other `require("../utils/...")` lines):

```js
const { getSalesPointNdcRouting } = require("../services/ndcRouting.service");
const {
  NDC_ROUTE_ORA,
  resolveNdcRoutingConfig,
  applyNdcRoutingToBody,
} = require("../utils/ndc-routing.utils");
const { runNdcRoutedShopping } = require("../utils/ndc-routing.executor");
```

- [ ] **Step 2: Routing block in `GlobalController.airShoppingRQ`** — insert after the `if (!Array.isArray(body.oras)) { ... }` normalization (line ~595–597) and **before** `const flights = ...`:

```js
// MET2-2422 : routage NDC — NDC[X] prioritaire sur Sabre NDC, repli par
// compagnie (vide/erreur/timeout). Opt-in PDV (attribut NDC-routing-priority) ;
// sans lui, comportement actuel strictement inchangé.
const routingSalesPointId = body?.agenceInfo?.id_sales_point || body?.salesPointId;
let routing = null;
let ndcxScope = null;
let routingProfile = null;
if (routingSalesPointId) {
  const routingSalesPoint = await getSalesPointNdcRouting(routingSalesPointId);
  routing = resolveNdcRoutingConfig(routingSalesPoint?.attributes);
  if (routing) {
    const applied = applyNdcRoutingToBody(body, routing);
    body.oras = applied.oras;
    ndcxScope = applied.ndcxScope;
    routingProfile = applied.profile;
  }
}
```

- [ ] **Step 3: Push the routing profile** — after `airlinesProfilesResult = processAirlinesResults(airlinesProfilesResult)` (line ~616):

```js
if (routingProfile) {
  // La chaine routee est UNE tache du fan-out : les autres providers partent
  // en parallele pendant que NDC[X] puis le repli s'enchainent.
  airlinesProfilesResult.push(routingProfile);
}
```

- [ ] **Step 4: Thread context** — in the `collectAirlineShoppingResponses` call inside `airShoppingRQ` (line ~636), extend the context object:

```js
const collectPromise = collectAirlineShoppingResponses(
  airlinesProfilesResult,
  { body, req, ndcFound, isSbtRequest, routing, ndcxScope },
  { results: sharedResults, deadlineMs: collectDeadlineMs }
)
```

and inside `collectAirlineShoppingResponses` (function at line ~505), set the deadline on the context right after `const collectStartedAt = Date.now();`:

```js
context.deadlineAt = collectStartedAt + collectDeadlineMs;
```

- [ ] **Step 5: NDC_ROUTE branch in `fetchSingleAirlineShoppingResponse`** — insert after the `paxCapError` check (line ~418) and before `const isAfklProvider = ...`:

```js
// MET2-2422 : compagnies routées NDC — une exécution séquentielle bornée
// (NDC[X] timeboxé puis repli SABRENDC pour les manquantes), les autres
// providers tournant en parallèle dans le fan-out.
if (airlineResult.isNdcRoute) {
  const routeStartedAt = Date.now();
  const outcome = await runNdcRoutedShopping({
    airlines: airlineResult.bodyOras,
    body,
    routing: context.routing,
    deadlineAt: context.deadlineAt,
    callProvider: (ora, providerBody) =>
      controllerReturn(ora, {
        ...providerBody,
        id_user: req.decodedToken.sub,
        decodedToken: req.decodedToken,
        isGlobalMultiProviderShopping: true,
      }),
  });
  recordMetric((m) => {
    m.searchResults.add(1, attrs({
      provider: "NDC_ROUTE",
      airline: airlineResult.bodyOras.join("|"),
      result: outcome.fallbackUsed
        ? "fallback"
        : outcome.merged?.OriginListFlights?.[0]?.flights?.length
          ? "offers"
          : "no_result",
      sales_point_id: snapshotProviderCallContext().salesPointId,
    }));
  });
  console.log(
    `[PROVIDER-TIMING] ora=NDC_ROUTE airlines=${airlineResult.bodyOras.join("|")} ` +
      `took=${Date.now() - routeStartedAt}ms fallback=${outcome.fallbackUsed ? 1 : 0}`
  );
  if (!outcome.merged.Oras) outcome.merged.Oras = NDC_ROUTE_ORA;
  return outcome.merged;
}
```

- [ ] **Step 6: Rescope the plain NDC[X] pseudo-ora** — in the same function, right after `const clonedBody = isAfklProvider ? deepClone(body) : withoutAfklOnlyPrograms(deepClone(body));` (line ~421):

```js
// MET2-2422 : le pseudo-ora NDC[X] est rescopé aux compagnies non routées
// (les routables partent dans le profil NDC_ROUTE) ; une recherche NDC[X]
// non bornée reçoit les routables en exclusion (mode "unscoped").
if (airlineResult.ora === "AMADEUS_NDCX" && context.ndcxScope) {
  clonedBody.selectedAirline = context.ndcxScope.entries;
}
```

- [ ] **Step 7: Verify**

```bash
node -e "require('./src/controllers/global.controller.js')"
node --test src/controllers/AMADEUS_NDCX/__tests__/ndcxEnableAttribute.met2-2422.test.js
node --test src/utils/ndc-routing.utils.test.js src/utils/ndc-routing.executor.test.js
```

Expected: no exception; all PASS. Then start the dev API (`./metis restart aerial` from the meta-repo) and POST one search with `oras: ["LH"]` from a PDV **without** routing attributes — the logs must show `oras=["LH"]` going to SABRENDC exactly as before (regression proof of the opt-in contract).

- [ ] **Step 8: Commit**

```bash
git add src/controllers/global.controller.js
git commit -m "MET2-2422 ndc routing: cablage du routeur dans le fan-out global (opt-in PDV)"
```

---

# Part B — front-dashboard configuration UI

Repo: `/home/anas/Desktop/metis/front-dashboard`. First: `git checkout -b deyra-met2-2422 development` (it currently sits on `development`, clean).

### Task B1: NDC category in CategoryMapping + mirror test

**Files:**
- Modify: `src/data/CategoryMapping.ts`
- Test: `src/tests/unit/categoryMappingNdcRouting.met2-2422.test.ts` (new — model: `categoryMappingNdcx.met2-2422.test.ts`)

**Interfaces:**
- Produces: category `NDC` with types `NDC-routing-priority`, `NDC-routing-fallback` — the exact strings consumed by api-aerial (`ndc-routing.utils.js`) and stored in the `attribut` table.

- [ ] **Step 1: Write the failing test**

```ts
// MET2-2422 : paramètres de routage NDC — catégorie NDC du CategoryMapping
// (mêmes noms de types que api-aerial ndc-routing.utils.js).
import { describe, expect, it } from "vitest";
import { categoryMapping } from "@/data/CategoryMapping";

describe("CategoryMapping : routage NDC (MET2-2422)", () => {
  it("a une catégorie NDC avec les deux types de routage", () => {
    const ndc = categoryMapping.find((m) => m.category === "NDC");
    expect(ndc).toBeDefined();
    expect(ndc?.types).toContain("NDC-routing-priority");
    expect(ndc?.types).toContain("NDC-routing-fallback");
    expect(ndc?.types).toHaveLength(2);
  });

  it("n'utilise ces types nulle part ailleurs (pas de doublon)", () => {
    const owners = categoryMapping.filter((m) =>
      m.types.includes("NDC-routing-priority") || m.types.includes("NDC-routing-fallback"),
    );
    expect(owners).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — Run: `npx vitest run src/tests/unit/categoryMappingNdcRouting.met2-2422.test.ts` — Expected: FAIL (no NDC category).

- [ ] **Step 3: Add the category** — in `src/data/CategoryMapping.ts`, after the `Amadeus` category block (lines ~79–90):

```ts
  {
    // MET2-2422 : routage de recherche NDC — NDC[X] prioritaire sur Sabre NDC
    // avec repli par compagnie (lu par api-aerial ndcRouting.service / ndc-routing.utils.js).
    category: "NDC",
    types: ["NDC-routing-priority", "NDC-routing-fallback"],
  },
```

- [ ] **Step 4: Run the test to verify it passes** — Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/CategoryMapping.ts src/tests/unit/categoryMappingNdcRouting.met2-2422.test.ts
git commit -m "MET2-2422 ndc routing: catégorie NDC (priorité + repli) dans le CategoryMapping"
```

### Task B2: Structured value fields in the PDV form

**Files:**
- Modify: `src/components/dashboards/admin/agence/[id]/point-de-vente/CreatePointDVente.vue`

**Interfaces:**
- Consumes: the `NDC` category from B1 (drives the Catégorie/Type selects).
- Produces: stored attribute rows `{category: "NDC", type: "NDC-routing-priority"|"NDC-routing-fallback", value: ...}` via the existing generic save (`attributData`) — no API change.

- [ ] **Step 1: Verify the selects derive from CategoryMapping** — in `CreatePointDVente.vue`, locate the `categories` and `typeItems` computeds (search `const categories` / `typeItems`). Confirmed during execution (B2): `typeItems` (`handleSelectCategory`, case `"aerial"`) flatMaps the imported `categoryMapping` — the NDC group flows in automatically — but `categories` (~line 1351) is a **local literal list** (the Catégorie section selector whose value lands in `attributDataObj.category`), so it got `{ title: "NDC", value: "NDC" }` plus a `case "NDC"` in `handleSelectCategory` that derives the two types from `categoryMapping`'s NDC group (B1 stays the single source of truth; no literal type list). Without it, rows would store `category: "aerial"`. The manual dev-server check is deferred to D2.

- [ ] **Step 2: Add the constants** near the existing `WEBBEDS_PAYMENT_TYPE` definition (search it):

```ts
// MET2-2422 : routage NDC — valeurs guidées (pas de saisie libre).
const NDC_ROUTING_PRIORITY_TYPE = "NDC-routing-priority";
const NDC_ROUTING_FALLBACK_TYPE = "NDC-routing-fallback";
const ndcRoutingPriorityOptions = [
  { title: "NDC[X] puis Sabre NDC (avec repli)", value: "NDCX,SABRE" },
  { title: "Sabre NDC puis NDC[X] (avec repli)", value: "SABRE,NDCX" },
  { title: "NDC[X] uniquement (sans repli)", value: "NDCX" },
  { title: "Sabre NDC uniquement (sans repli)", value: "SABRE" },
];
const ndcRoutingFallbackOptions = [
  { title: "Actif", value: "true" },
  { title: "Inactif", value: "false" },
];
```

- [ ] **Step 3: Add the two selects** in the "Attributs" `UiChildCard`, in the Valeur column — change the existing chain (lines ~1886–1905) so the special selects come first:

```vue
<AppSelect
  v-if="attributDataObj.type === NDC_ROUTING_PRIORITY_TYPE"
  v-model="attributDataObj.value"
  :items="ndcRoutingPriorityOptions"
  item-title="title"
  item-value="value"
  color="primary"
  variant="outlined"
  hide-details="auto"
/>
<AppSelect
  v-else-if="attributDataObj.type === NDC_ROUTING_FALLBACK_TYPE"
  v-model="attributDataObj.value"
  :items="ndcRoutingFallbackOptions"
  item-title="title"
  item-value="value"
  color="primary"
  variant="outlined"
  hide-details="auto"
/>
<AppSelect
  v-else-if="attributDataObj.type === WEBBEDS_PAYMENT_TYPE"
  ... (existing WebBeds select, unchanged)
/>
<v-text-field v-else ... (existing, unchanged) />
```

- [ ] **Step 4: Manual round-trip verification** (dev server + local DB):
  1. Open Agence → point de vente → edit a test PDV.
  2. Catégorie **NDC** → Type **NDC-routing-priority** → value dropdown shows the 4 ordered options; pick "NDCX,SABRE"; **Ajouter**.
  3. Add **NDC-routing-fallback** = "Actif" the same way.
  4. Save (update). Reload the page — both rows persist in the attributes list.
  5. `curl <dashboard>/api/attribut/read/salesPoint/uncrypted/<idPDV>` (with a valid token) shows both rows with the exact types `NDC-routing-priority` / `NDC-routing-fallback`.

- [ ] **Step 5: Commit**

```bash
git add "src/components/dashboards/admin/agence/[id]/point-de-vente/CreatePointDVente.vue"
git commit -m "MET2-2422 ndc routing: valeurs guidées priorité/repli dans le formulaire PDV"
```

---

# Part C — front-reservation checkbox UI

Repo: `/home/anas/Desktop/metis/front-reservation`, branch `deyra-met2-2422` (already checked out, clean). Gate before **every** commit: `npm run lint:changed -- --staged` → zero oxlint and zero vue-tsc errors on touched files.

### Task C1: `ndcxAirlines.ts` mirror + unit tests

**Files:**
- Create: `app/utils/flight/ndcxAirlines.ts`
- Test: `tests/unit/ndcxAirlines.test.ts` (check `vitest.config.ts` include pattern first; if it differs, place accordingly)

**Interfaces:**
- Produces: `NDCX_AIRLINES` (`{code,label}[]`, 30), `NDCX_CODES`, `NDCX_LABELS` (`"Air France - AF"` style), `NDCX_ROUTABLE_CODES` (10), `isNdcxAirlineCode` — consumed by C2/C3/C4.
- Mirror contract: `NDCX_CODES` and `NDCX_ROUTABLE_CODES` must equal api-aerial `NDCX_AIRLINES` / `ROUTABLE_NDC_AIRLINES` (A1) — kept in sync by hand, like `sabreNdcAirlines.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// MET2-2422 : miroir front des listes NDC[X] api-aerial (airline-constants.utils.js).
import { describe, expect, it } from "vitest";
import { isLccAirline } from "@/config/lccAirlines.config";
import { LH_GROUP_AIRLINES, SABRE_NDC_CODES } from "@/utils/flight/sabreNdcAirlines";
import {
  NDCX_CODES,
  NDCX_LABELS,
  NDCX_ROUTABLE_CODES,
  isNdcxAirlineCode,
} from "@/utils/flight/ndcxAirlines";

describe("ndcxAirlines (MET2-2422)", () => {
  it("30 compagnies, libellés uniques, aucun LCC", () => {
    expect(NDCX_CODES).toHaveLength(30);
    expect(new Set(Object.values(NDCX_LABELS)).size).toBe(30);
    for (const code of NDCX_CODES) expect(isLccAirline(code)).toBe(false);
  });

  it("les routables sont NDC[X] ET Sabre NDC (mêmes 10 que api-aerial)", () => {
    expect(NDCX_ROUTABLE_CODES).toHaveLength(10);
    // Instantané partagé avec api-aerial ROUTABLE_NDC_AIRLINES (même pattern que
    // lccAirlines.config.test.ts) : le front ne peut pas dériver l'appartenance
    // Sabre NDC depuis ses seules listes, on épingle donc les 10 codes exacts.
    expect([...NDCX_ROUTABLE_CODES]).toEqual([
      "LH", "LX", "OS", "SN", "AZ", "UA", "QF", "BR", "LO", "SK",
    ]);
    // Sabre NDC côté front = SABRE_NDC_CODES (« hors groupe LH ») + LH_GROUP_AIRLINES
    // (ouvertes par le type d'attribut LH) + UA/QF (servies Sabre NDC selon
    // NDC_SABRE_AIRLINES api-aerial, sans attribut XX-SB-NDC dédié côté front).
    const sabreNdcCodes = new Set([...SABRE_NDC_CODES, ...LH_GROUP_AIRLINES, "UA", "QF"]);
    for (const code of NDCX_ROUTABLE_CODES) {
      expect(NDCX_CODES).toContain(code);
      expect(sabreNdcCodes.has(code), code).toBe(true);
    }
  });

  it("isNdcxAirlineCode : insensible à la casse, faux hors liste", () => {
    expect(isNdcxAirlineCode("lh")).toBe(true);
    expect(isNdcxAirlineCode("TK")).toBe(false); // Turkish n'est pas NDC[X]
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — Run: `npx vitest run tests/unit/ndcxAirlines.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Create `app/utils/flight/ndcxAirlines.ts`**

```ts
// Source unique des compagnies NDC[X] (MET2-2422) : la grille de coches du
// sélecteur de compagnies. MIROIR de NDCX_AIRLINES côté api-aerial
// (src/utils/airline-constants.utils.js) — garder les deux listes synchronisées
// à la main, exactement comme sabreNdcAirlines.ts.
// Matrice de capacités Amadeus 26_06_15 (production) ; VY et 6E exclus (canal
// LCC Metis), EN/4Y en attente de confirmation Amadeus.
// La grille n'est proposée que si le PDV porte Amadeus-ndcx-enable (pdvCompanies.ts).
export const NDCX_AIRLINES = [
  { code: "AA", label: "American Airlines" },
  { code: "AC", label: "Air Canada" },
  { code: "AF", label: "Air France" },
  { code: "AI", label: "Air India" },
  { code: "AY", label: "Finnair" },
  { code: "AZ", label: "ITA Airways" },
  { code: "BA", label: "British Airways" },
  { code: "BR", label: "EVA Air" },
  { code: "CX", label: "Cathay Pacific" },
  { code: "EK", label: "Emirates" },
  { code: "EY", label: "Etihad Airways" },
  { code: "IB", label: "Iberia" },
  { code: "KL", label: "KLM" },
  { code: "KQ", label: "Kenya Airways" },
  { code: "LH", label: "Lufthansa" },
  { code: "LO", label: "LOT Polish Airlines" },
  { code: "LX", label: "SWISS" },
  { code: "MH", label: "Malaysia Airlines" },
  { code: "NP", label: "Nile Air" },
  { code: "OS", label: "Austrian Airlines" },
  { code: "QR", label: "Qatar Airways" },
  { code: "QF", label: "Qantas Airways" },
  { code: "SK", label: "Scandinavian Airlines" },
  { code: "SM", label: "Air Cairo" },
  { code: "SN", label: "Brussels Airlines" },
  { code: "SQ", label: "Singapore Airlines" },
  { code: "SV", label: "Saudia" },
  { code: "TP", label: "TAP Air Portugal" },
  { code: "TU", label: "Tunisair" },
  { code: "UA", label: "United Airlines" },
] as const;

export type NdcxCode = (typeof NDCX_AIRLINES)[number]["code"];

export const NDCX_CODES: NdcxCode[] = NDCX_AIRLINES.map(({ code }) => code);

/** Libellés affichés (« Air France - AF »), même format que SABRE_NDC_LABELS. */
export const NDCX_LABELS = Object.fromEntries(
  NDCX_AIRLINES.map(({ code, label }) => [code, `${label} - ${code}`]),
) as Record<NdcxCode, string>;

/**
 * Compagnies routables NDC[X] ↔ Sabre NDC : seules celles-ci passent par la
 * chaîne du routeur api-aerial (priorité + repli). Miroir de
 * ROUTABLE_NDC_AIRLINES (api-aerial) — 10 codes.
 */
export const NDCX_ROUTABLE_CODES = [
  "LH", "LX", "OS", "SN", "AZ", "UA", "QF", "BR", "LO", "SK",
] as const;

export const isNdcxAirlineCode = (code: string) =>
  NDCX_CODES.includes(code.trim().toUpperCase() as NdcxCode);
```

- [ ] **Step 4: Run the test to verify it passes** — Expected: PASS (3 tests). Lint gate + commit:

```bash
git add app/utils/flight/ndcxAirlines.ts tests/unit/ndcxAirlines.test.ts
git commit -m "MET2-2422 ndcx grid: miroir front des compagnies NDC[X] + routables"
```

### Task C2: `NdcxAirlineGrid` component

**Files:**
- Create: `app/components/booking/flight/SelectCompanies/NdcxAirlineGrid.vue`
- Modify: `locales/en.json`, `locales/fr.json`, `locales/es.json`, `locales/it.json`, `locales/ua.json` — the real translation dictionaries (loaded via `locales/messages.ts`); all five must stay key-aligned per `scripts/check-i18n.mjs`

**Interfaces:**
- Consumes: `NDCX_CODES`, `NDCX_LABELS` (C1).
- Produces: `<NdcxAirlineGrid v-model="string[]" :airlines?="string[]" :testIdPrefix?="string" />` — checkbox grid + select-all, `data-test-id` `companies-ndcx-checkbox-<CODE>` / `companies-ndcx-select-all` (overridable prefix). Used by C3 (classic), C4 (SBT), C5 (OFF modal).

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { NDCX_CODES, NDCX_LABELS } from "@/utils/flight/ndcxAirlines";

/**
 * MET2-2422 : grille de coches des compagnies Amadeus NDC[X] — remplace la
 * ligne GDS (interrupteur + Inclure/Exclure) du sélecteur. Une coche = une
 * entrée selectedAirline Preferred gds AMADEUS_NDCX ; le pseudo-ora
 * "AMADEUS_NDCX" est émis dès qu'au moins une compagnie est cochée.
 */
const props = withDefaults(
  defineProps<{
    /** Codes proposés (filtrés par politique voyage côté SBT le cas échéant). */
    airlines?: string[];
    /** Préfixe des data-test-id. */
    testIdPrefix?: string;
  }>(),
  { airlines: () => [...NDCX_CODES], testIdPrefix: "companies-ndcx" },
);

const selected = defineModel<string[]>({ required: true });

const { t } = useI18n();

const sorted = computed(() =>
  [...props.airlines].sort((a, b) =>
    (NDCX_LABELS[a as keyof typeof NDCX_LABELS] ?? a).localeCompare(
      NDCX_LABELS[b as keyof typeof NDCX_LABELS] ?? b,
      undefined,
      { sensitivity: "base" },
    ),
  ),
);

const allSelected = computed(
  () => sorted.value.length > 0 && sorted.value.every((code) => selected.value.includes(code)),
);

function toggleAll() {
  selected.value = allSelected.value
    ? selected.value.filter((code) => !sorted.value.includes(code))
    : [...new Set([...selected.value, ...sorted.value])];
}

function toggle(code: string, value: boolean | null) {
  selected.value = value
    ? [...new Set([...selected.value, code])]
    : selected.value.filter((c) => c !== code);
}

const sanitizeId = (code: string) => code.replace(/\//g, "-").replace(/\s+/g, "");
</script>

<template>
  <div class="ndcx-grid">
    <div class="d-flex justify-space-between align-center mb-2 section-header">
      <span class="text-subtitle-2 font-weight-medium">
        {{ t("components-booking-flight-SearchFlight.ndcx-section-title") }}
      </span>
      <v-btn
        variant="text"
        density="compact"
        color="primary"
        class="text-caption"
        :data-test-id="`${testIdPrefix}-select-all`"
        @click="toggleAll"
      >
        {{ t(`components-booking-flight-SearchFlight.${allSelected ? "unselect-all" : "select-all"}`) }}
      </v-btn>
    </div>
    <v-list density="compact">
      <v-list-item
        v-for="code in sorted"
        :key="code"
        class="pa-0"
        style="height: 32px"
      >
        <v-checkbox
          :model-value="selected.includes(code)"
          density="compact"
          hide-details
          :data-test-id="`${testIdPrefix}-checkbox-${sanitizeId(code)}`"
          @update:model-value="(value: boolean | null) => toggle(code, value)"
        >
          <template #label>
            <v-tooltip location="top">
              <template #activator="{ props: tooltipProps }">
                <span v-bind="tooltipProps" class="company-label-ellipsis">
                  {{ NDCX_LABELS[code as keyof typeof NDCX_LABELS] ?? code }}
                </span>
              </template>
              <span>{{ NDCX_LABELS[code as keyof typeof NDCX_LABELS] ?? code }}</span>
            </v-tooltip>
          </template>
        </v-checkbox>
      </v-list-item>
    </v-list>
  </div>
</template>
```

- [ ] **Step 2: i18n keys** — in the root `locales/*.json` dictionaries (en, fr, es, it, ua — all five carry the namespace and must stay key-aligned), inside the `components-booking-flight-SearchFlight` namespace (locate the existing `select-all` key and add next to it):

```json
"ndcx-section-title": "Amadeus NDC[X]"
```

(same string in all locales — brand name; `unselect-all`/`select-all` already exist).

- [ ] **Step 3: Verify** — `npm run lint:changed -- --staged`; then dev server: render check happens in C3.

- [ ] **Step 4: Commit**

```bash
git add app/components/booking/flight/SelectCompanies/NdcxAirlineGrid.vue app/utils/locales/messages.ts
git commit -m "MET2-2422 ndcx grid: composant grille de coches NDC[X] (classique/SBT/OFF)"
```

### Task C3: Classic mode — replace the GDS-style NDC[X] row

**Files:**
- Modify: `app/components/booking/flight/SelectCompanies/SelectCompanies.vue`
- Modify: `app/components/booking/flight/SelectCompanies/selectCompanies.types.ts`
- Modify: `app/utils/flight/pdvCompanies.ts` (hydrate helper)
- Modify: `app/utils/flight/folderAttach.ts` + `tests/unit/utils/flight/folderAttach.test.ts` (found during execution: `buildAttachCompanySelection` returns a `PersistedGdsUiFilters` literal that still set the two removed keys — drop the empty-array keys, behavior-identical)
- Test: `tests/unit/ndcxSelectionHydration.test.ts`

**Interfaces:**
- Consumes: `NdcxAirlineGrid` (C2), `buildGdsSelectedAirlinePayload` (existing, unchanged — it takes included/excluded lists per provider).
- Produces: `ndcxSelectedAirlines: Ref<string[]>` (shared state also used by C4/C5); payload entries `{code, PreferLevel: "Preferred", gds: "AMADEUS_NDCX"}` via the existing `buildSelectedAirlinePayload`; `hydrateNdcxSelection(savedUiFilters, savedAirlines): string[]` in pdvCompanies.ts.

- [ ] **Step 1: Types** — in `selectCompanies.types.ts`: remove `includedCompaniesAmadeusNdcx` / `excludedCompaniesAmadeusNdcx` from `PersistedGdsUiFilters` (keep `CanonicalGdsProvider` and `CanonicalGdsFilterSelection` unchanged — the payload builder still uses the AMADEUS_NDCX key):

```ts
export type PersistedGdsUiFilters = {
  includedCompaniesSabre: string[];
  excludedCompaniesSabre: string[];
  includedCompaniesAmadeus: string[];
  excludedCompaniesAmadeus: string[];
};
```

- [ ] **Step 2: Hydration helper (pure, testable)** — in `app/utils/flight/pdvCompanies.ts` add:

```ts
/**
 * MET2-2422 : migration de la sélection NDC[X] persistée. Ancien format :
 * listes Inclure/Exclure de la ligne GDS (combobox libres). Nouveau format :
 * compagnies cochées de la grille. L'Exclure NDC[X] disparaît (décision 10) —
 * les codes exclus ne sont pas reportés.
 */
export function hydrateNdcxSelection(
  legacyUiFilters: { includedCompaniesAmadeusNdcx?: unknown } | null | undefined,
  savedAirlines: Array<{ code?: string; PreferLevel?: string; gds?: string }> | null | undefined,
): string[] {
  const fromUi = Array.isArray(legacyUiFilters?.includedCompaniesAmadeusNdcx)
    ? (legacyUiFilters.includedCompaniesAmadeusNdcx as unknown[])
    : [];
  const fromPayload = (savedAirlines ?? [])
    .filter(
      (e) =>
        e?.gds === "AMADEUS_NDCX" && e?.PreferLevel === "Preferred" && typeof e.code === "string",
    )
    .flatMap((e) => normalizeFilterCodes([e as CanonicalGdsFilterItem]));
  return [...new Set([...fromUi.flatMap((item) => splitAirlineCodes(extractFilterCode(item as CanonicalGdsFilterItem))), ...fromPayload])];
}
```

(uses the module's existing `normalizeFilterCodes` / `splitAirlineCodes` / `extractFilterCode`.)

- [ ] **Step 3: Write the hydration test** — `tests/unit/ndcxSelectionHydration.test.ts`:

```ts
// MET2-2422 : migration Inclure/Exclure (ligne GDS) -> coches de la grille.
import { describe, expect, it } from "vitest";
import { hydrateNdcxSelection } from "@/utils/flight/pdvCompanies";

describe("hydrateNdcxSelection (MET2-2422)", () => {
  it("lit l'ancienne liste Inclure NDC[X] et le payload persisté, dédoublonne", () => {
    const selection = hydrateNdcxSelection(
      { includedCompaniesAmadeusNdcx: ["LH", { code: "IB" }] },
      [
        { code: "LH", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" },
        { code: "BA", PreferLevel: "Preferred", gds: "AMADEUS_NDCX" },
        { code: "AF", PreferLevel: "Unacceptable", gds: "AMADEUS_NDCX" }, // exclus : ignoré
        { code: "AF", PreferLevel: "Preferred", gds: "SABRE" }, // autre provider : ignoré
      ],
    );
    expect(selection.sort()).toEqual(["BA", "IB", "LH"]);
  });

  it("rien de persisté => vide", () => {
    expect(hydrateNdcxSelection(null, null)).toEqual([]);
  });
});
```

Run: `npx vitest run tests/unit/ndcxSelectionHydration.test.ts` → PASS (write it first, watch it fail against the missing export, then add the helper — TDD).

- [ ] **Step 4: Script changes in `SelectCompanies.vue`** (classic branch — the `isSbtActive === false` paths):

1. Import the grid and the list: `import NdcxAirlineGrid from "./NdcxAirlineGrid.vue";` (next to the `GdsProviderRow` import) and `import { NDCX_CODES } from "@/utils/flight/ndcxAirlines";` plus `hydrateNdcxSelection` in the existing `@/utils/flight/pdvCompanies` import list.
2. Replace the three refs (lines ~97, ~105–106):

```ts
// MET2-2422 : la ligne GDS NDC[X] (interrupteur + Inclure/Exclure) devient une
// grille de coches ; l'état est partagé avec le mode SBT et la modale OFF.
const ndcxSelectedAirlines = ref<string[]>([]);
const gdsAmadeusNdcxEnabled = computed(() => ndcxSelectedAirlines.value.length > 0);
```

(delete `const gdsAmadeusNdcxEnabled = ref(false);`, `includedCompaniesAmadeusNdcx`, `excludedCompaniesAmadeusNdcx`.)

3. `buildCurrentGdsFilterSelection()` — the AMADEUS_NDCX arm becomes:

```ts
  AMADEUS_NDCX: {
    included: ndcxSelectedAirlines.value as CanonicalGdsFilterItem[],
    excluded: [],
  },
```

4. `buildPersistedGdsUiFilters()` — drop the two NDCX lines (type no longer has them).
5. `getPersistedGdsUiFilters` — drop the two NDCX keys from the returned object **but keep reading the legacy raw value for migration**: capture `const legacyNdcxIncluded = source.includedCompaniesAmadeusNdcx;` before building the result and return it alongside (extend the function's return type with `legacyNdcxIncluded?: unknown`), OR simpler: in `onMounted`, read the legacy value directly from `getShoppingQuerySnapshot().selectedAirlineFilters` and call `hydrateNdcxSelection(rawSnapshot, savedAirlines)`.
6. Remove `toggleGDS`'s `AMADEUS_NDCX` branch and `handleGdsToggle`'s NDCX arm (no switch anymore). `toggleOnAllGDS` is untouched (GDS section only, per its docstring).
7. Add the selection watcher (replaces the switch logic for the pseudo-ora):

```ts
// MET2-2422 : le pseudo-ora NDC[X] suit la grille — coché dès qu'une compagnie
// l'est, retiré sinon (jamais auto-coché : look-to-book, règle GEN-02).
watch(ndcxSelectedAirlines, (selection) => {
  if (isSbtActive.value) return; // le mode SBT gère son émission (C4)
  const hasNdcx = selectedCompany.value.includes("AMADEUS_NDCX");
  if (selection.length > 0 && !hasNdcx) {
    selectedCompany.value = [...selectedCompany.value, "AMADEUS_NDCX"];
  } else if (selection.length === 0 && hasNdcx) {
    selectedCompany.value = selectedCompany.value.filter((company) => company !== "AMADEUS_NDCX");
  }
});
```

8. The big deep watcher (lines ~455–530): remove the `includedCompaniesAmadeusNdcx` / `excludedCompaniesAmadeusNdcx` sources and the two `validateGdsCompanies(..., "AMADEUS_NDCX", ...)` arms; keep SABRE/AMADEUS arms. Add `ndcxSelectedAirlines` as a watcher source and pass `included: ndcxSelectedAirlines.value, excluded: []` in the watcher's inline `buildSelectedAirlinePayload` call (without the source, checking a second airline never rebuilds the payload — found during execution). `buildSelectedAirlinePayload`'s `activeProviders` condition (`asGDSAmadeusNdcx.value && gdsAmadeusNdcxEnabled.value`) works unchanged off the computed. Also drop the persisted-oras branch's `gdsAmadeusNdcxEnabled.value = true` assignment in onMounted — the ref is now a readonly computed.
9. `onMounted` hydration (classic branch, lines ~548–615): replace the `// amadeus ndc[x]` block with:

```ts
  // MET2-2422 : migration — l'ancienne liste Inclure devient les coches.
  if (asGDSAmadeusNdcx.value) {
    const rawSnapshotFilters = getShoppingQuerySnapshot().selectedAirlineFilters as
      | { includedCompaniesAmadeusNdcx?: unknown }
      | undefined;
    ndcxSelectedAirlines.value = hydrateNdcxSelection(rawSnapshotFilters, savedAirlines);
    if (ndcxSelectedAirlines.value.length > 0 && !orasValue.includes("AMADEUS_NDCX")) {
      orasValue.push("AMADEUS_NDCX");
    }
  }
```

(the `savedAirlines` variable already exists at that point; the `orasValue` filtering of persisted `AMADEUS_NDCX` when the PDV lacks the attribute — lines ~550–553 — stays).

- [ ] **Step 5: Template change** — replace the NDC[X] block (lines 2105–2117) with:

```vue
            <!-- Amadeus NDC[X] : grille de coches (MET2-2422), provider distinct du GDS classique. -->
            <template v-if="asGDSAmadeusNdcx">
              <v-divider v-if="showCanonicalGdsSection" class="my-4" />
              <NdcxAirlineGrid v-model="ndcxSelectedAirlines" />
            </template>
```

(The grid's template uses `section-header` / `company-label-ellipsis` layout classes whose definitions live in `SelectCompanies.vue`'s **scoped** styles and do not reach the child component — in this task, add a small scoped `<style>` block to `NdcxAirlineGrid.vue` mirroring those two rules: `.ndcx-grid .section-header { display: flex; justify-content: space-between; align-items: center; min-height: 40px; gap: 8px; margin-bottom: 8px; }` and `.company-label-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; display: inline-block; }`.)

- [ ] **Step 6: Verify** — `npm run lint:changed -- --staged` (zero errors); `npx vitest run tests/unit/ndcxSelectionHydration.test.ts tests/unit/ndcxAirlines.test.ts`; dev-server smoke: open `/booking/flight`, open the companies dialog on a PDV with `Amadeus-ndcx-enable` → grid renders (30 checkboxes), check LH + IB → validate → search → Network tab: `POST /aerial/global/airShoppingRQ` payload contains `oras: [..., "AMADEUS_NDCX"]` and `selectedAirline` entries `{code:"LH",PreferLevel:"Preferred",gds:"AMADEUS_NDCX"}` + same for IB.

- [ ] **Step 7: Commit**

```bash
git add app/components/booking/flight/SelectCompanies/SelectCompanies.vue app/components/booking/flight/SelectCompanies/selectCompanies.types.ts app/utils/flight/pdvCompanies.ts tests/unit/ndcxSelectionHydration.test.ts
git commit -m "MET2-2422 ndcx grid: la ligne GDS NDC[X] devient une grille de coches (mode classique)"
```

### Task C4: SBT mode — NDC[X] airlines in the NDC channel

**Files:**
- Modify: `app/components/booking/flight/SelectCompanies/SelectCompanies.vue` (SBT branch)
- Modify: `app/components/booking/flight/SelectCompanies/selectCompanies.types.ts`

**Interfaces:**
- Consumes: `ndcxSelectedAirlines` (C3), `NdcxAirlineGrid` (C2), `NDCX_CODES` (C1), existing `isOraAvailable` / `collectForcedChannelsFromPreferences` / `filterNdcCompaniesFromForcedChannels`.
- Produces: SBT payload entries `{code, PreferLevel: "Preferred", gds: "AMADEUS_NDCX"}` appended by `sbtBuildSelectedAirlinePayload`; pseudo-ora `AMADEUS_NDCX` in the emitted `oras` when the selection is non-empty.

- [ ] **Step 1: Types** — extend `SelectedAirlineGds`:

```ts
export type SelectedAirlineGds = "SABRE" | "AMADEUS" | "AMADEUS_NDCX";
```

- [ ] **Step 2: Script changes** (SBT branch):

1. New ref + policy-filtered list:

```ts
// MET2-2422 : la case pseudo-compagnie « AMADEUS_NDCX » du canal NDC devient
// la grille de coches des compagnies NDC[X] (filtre politique + canaux forcés).
const hasNdcxGrid = ref(false);
const sbtNdcxAirlines = computed(() => {
  const forced = collectForcedChannelsFromPreferences(airlinePreferences.value?.permissions);
  return filterNdcCompaniesFromForcedChannels(
    NDCX_CODES.filter((code) => isOraAvailable(code)),
    forced,
  );
});
```

2. In `applyPointDeVenteResult()` (line ~866) and in the `aerienPolicy` watcher's `case "Amadeus":` (line ~1432), replace `if (hasAmadeusNdcxAttribute(value) && processAirline("AMADEUS_NDCX")) ndcCompany.value.push("AMADEUS_NDCX");` with:

```ts
  // MET2-2422 : plus de pseudo-compagnie — la grille NDC[X] a sa propre sous-section.
  if (hasAmadeusNdcxAttribute(value)) hasNdcxGrid.value = true;
```

3. `defaultNdcSelection` (line ~1253): the `"AMADEUS_NDCX"` exclusion can go (the pseudo-code is no longer in `ndcCompany`), but **keep the rule** — never auto-check the grid. Add after `applyDefaultCompanySelectionIfNeeded`'s default selection assembly:

```ts
  // MET2-2422 : la grille NDC[X] n'est JAMAIS auto-cochée (look-to-book, règle GEN-02) —
  // ndcxSelectedAirlines n'entre pas dans la sélection par défaut.
```

(and make sure nothing adds to `ndcxSelectedAirlines` outside user toggles).

4. Pseudo-ora emission — wrap the SBT emit paths. Add:

```ts
// MET2-2422 : en mode SBT, le pseudo-ora NDC[X] accompagne les oras émises
// dès qu'une compagnie NDC[X] est cochée (même mécanique que le mode classique).
function emitOrasChangeWithNdcx(data: string[]) {
  const withPseudo =
    ndcxSelectedAirlines.value.length > 0
      ? data.includes("AMADEUS_NDCX")
        ? data
        : [...data, "AMADEUS_NDCX"]
      : data.filter((company) => company !== "AMADEUS_NDCX");
  emitOrasChange(withPseudo);
}

watch(ndcxSelectedAirlines, () => {
  if (!isSbtActive.value) return;
  emitOrasChangeWithNdcx(
    selectedCompanies.value.filter((company) => company !== "ALL_NDC" && company !== "ALL_LCC"),
  );
});
```

Then, in the SBT toggle functions (`sbtManageCompanies`, `sbtToggleAllNDC`, `sbtToggleAllLCC`, `sbtToggleAllGDS`, `removeGdsCompany`, the `hasAerienPolicy` / `aerienPolicy` / `airlinePreferences` watchers' emit tails), replace each `emitOrasChange(data)` call with `emitOrasChangeWithNdcx(data)` — mechanical sed-like pass, one call site at a time, keeping the classic-mode call sites untouched. **Found during execution:** `applyDefaultCompanySelectionIfNeeded`'s tail also calls `emitOrasChange(...)` but multi-line (so a literal `emitOrasChange(data)` grep misses it) — that is the **9th** SBT path and must be converted too, or the pseudo-ora silently drops from oras when defaults re-assemble while the grid holds a selection. After C4, the remaining bare `emitOrasChange` call sites (6) are exactly the classic ones (`manageCompanies`, `toggleAllNDC`, `toggleAllLCC`, `toggleGDS`, `toggleOnAllGDS`, classic onMounted dedup). Also expected during execution: widen `explicitIncludesByProvider`'s `Record<SelectedAirlineGds, Set<string>>` literal with `AMADEUS_NDCX: new Set()` (type completion, stays empty, semantics unchanged) and add the `NDCX_CODES` import.

5. Payload — in `sbtBuildSelectedAirlinePayload()`, after the `gdsSelectedCompanies` loop, append:

```ts
  // MET2-2422 : compagnies NDC[X] cochées -> entrées Preferred AMADEUS_NDCX
  // (la grille remplace l'ancienne case pseudo-compagnie).
  ndcxSelectedAirlines.value.forEach((code) => {
    preferenceByCarrierAndProvider.set(`${code}:AMADEUS_NDCX`, "Preferred");
  });
```

- [ ] **Step 3: Template change** — inside the SBT NDC section `v-col` (after the `companies-scroll` `v-row`, before the section's closing `</v-col>` ~line 1723), add the sub-section:

```vue
            <!-- MET2-2422 : compagnies Amadeus NDC[X] (sous-section du canal NDC). -->
            <template v-if="hasNdcxGrid">
              <v-divider class="my-2" />
              <NdcxAirlineGrid v-model="ndcxSelectedAirlines" :airlines="sbtNdcxAirlines" />
            </template>
```

- [ ] **Step 4: Verify** — lint gate; dev smoke on `/sbt/booking/flight` with a policy + NDC[X]-enabled PDV: grid appears under the NDC channel, filtered by policy; check TU + LH → the emitted `oras` include `AMADEUS_NDCX`, `selectedAirline` carries both entries; NDC-channel LH chip **and** grid LH checked together still emit one `LH`-intent each (backend dedupes via `applyNdcRoutingToBody` — expected, documented behavior).

- [ ] **Step 5: Commit**

```bash
git add app/components/booking/flight/SelectCompanies/SelectCompanies.vue app/components/booking/flight/SelectCompanies/selectCompanies.types.ts
git commit -m "MET2-2422 ndcx grid: canal NDC SBT — grille de coches NDC[X] + pseudo-ora émis"
```

### Task C5: OFF "add flight" modal

**Files:**
- Modify: `app/components/folder/flight/addCard.vue`
- Modify: `app/components/folder/flight/addFlight/AddFlightCompanies.vue` (located in Step 1: this is the `companiesRef` child — a trigger + panel wrapper owning `defineModel<string[]>` for codes; the checkbox listing is its grandchild `AddFlightCompaniesList.vue`, untouched)

**Interfaces:**
- Consumes: `NdcxAirlineGrid` (C2), `catalog.hasAmadeusNdcx` from `buildPdvCompanyCatalog` (existing), `NDCX_CODES` (C1).
- Produces: the modal's search payload gains `oras: [..., "AMADEUS_NDCX"]` + `selectedAirline` NDC[X] entries when NDC[X] airlines are checked (same contract as the main search — the OFF flow reuses `/aerial/global/airShoppingRQ`).

> **Found during execution (C5, commit `d7b276032d`):** the child emits **no** `{oras, selectedAirline}` — the real contract is the `v-model` codes + parent-side `buildAttachCompanySelection` inside `addCard.vue`'s `companySelection` computed (→ `attachFormIssues`, summary, `startAddFlight`). So: the grid renders inside `AddFlightCompanies.vue` (both panel variants: desktop `v-menu` card + mobile fullscreen dialog) receiving a second named model `v-model:ndcxSelectedAirlines`; the ref lives in `addCard.vue` (payload owner), cleared in `show()` **and** in the child's `reset()`; the merge happens in `companySelection` — oras append `"AMADEUS_NDCX"` when the grid is non-empty / filter it out when empty (exact mirror of `emitOrasChangeWithNdcx`), + `Preferred AMADEUS_NDCX` entries. Display semantics fold the grid in: `totalCount` +1 on `hasAmadeusNdcx`, `selectionCount = selected.length + ndcxSelectedAirlines.length` (summary/chip/count/error), and `isDirty` counts a grid-only selection so the confirm-close dialog triggers.

- [ ] **Step 1: Locate the selector child** — in `addCard.vue`, find the template node carrying `ref="companiesRef"` (search `companiesRef`) and the component it resolves to (imported or auto-imported; it receives the `catalog` built at line ~230 and owns `companySelection`). Open it.

- [ ] **Step 2: Add the grid to that child** — where the child lists `catalog.ndc` / `catalog.lcc` checkboxes, add (inside its NDC block or as a fourth column, following the child's own layout):

```vue
      <!-- MET2-2422 : compagnies Amadeus NDC[X] — mêmes coches que la recherche. -->
      <NdcxAirlineGrid
        v-if="catalog.hasAmadeusNdcx"
        v-model="ndcxSelectedAirlines"
        :test-id-prefix="'addflight-ndcx'"
      />
```

with `const ndcxSelectedAirlines = ref<string[]>([]);` in the child's script (import `NdcxAirlineGrid` explicitly, as in C3; `catalog` prop already exists).

- [ ] **Step 3: Wire the payload** — where the child emits its selection up to `addCard.vue` (the `companySelection` / `oras` contract — read how it emits today), extend it:

```ts
const emitSelection = () => {
  // MET2-2422 : le pseudo-ora NDC[X] + les entrées selectedAirline suivent la grille.
  const oras = ndcxSelectedAirlines.value.length > 0
    ? [...baseOras, "AMADEUS_NDCX"]
    : baseOras;
  const selectedAirline = [
    ...baseSelectedAirline,
    ...ndcxSelectedAirlines.value.map((code) => ({
      code,
      PreferLevel: "Preferred",
      gds: "AMADEUS_NDCX",
    })),
  ];
  emit("update", { oras, selectedAirline });
};
```

adapting `baseOras` / `baseSelectedAirline` / the emit name to the child's real contract (they are whatever the child currently computes/emits — keep those computations untouched, only add the NDC[X] merge). `reset()` (called by `addCard.show()` via `companiesRef.value?.reset()`) must clear `ndcxSelectedAirlines`.

- [ ] **Step 4: Verify** — lint gate; dev smoke: open a dossier → "Ajouter un vol" → grid present (on an NDC[X]-enabled PDV) → check TU + IB → search → the OFF search request carries `AMADEUS_NDCX` + both `selectedAirline` entries.

- [ ] **Step 5: Commit**

```bash
git add app/components/folder/flight/addCard.vue <chemin-du-composant-enfant>
git commit -m "MET2-2422 ndcx grid: modale OFF « Ajouter un vol » — coches NDC[X]"
```

### Task C6: Playwright smoke + regression sweep

**Files:**
- Create: `tests/components/ndcxCompanyGrid.spec.ts`
- Modify (only if hits): any spec referencing removed testids. (Executed, commit `2bc01c88c`: `tests/page-objects/booking/flight/FlightSearchPage.ts` — `GdsProvider` narrowed to `"SABRE" | "AMADEUS"`, `AMADEUS_NDCX: "amadeus-ndcx"` dropped, new `selectNdcxAirline(code)` mirroring the LCC selector, and `selectCompanies()`'s `gds.amadeusNdcx` arm rewired to it with exclusions dropped.)

- [ ] **Step 1: Sweep removed testids** — `grep -rn "companies-gds-amadeus-ndcx" tests/ app/` — currently zero hits (verified 2026-11-09); if any appear after C3/C4, update them to the new `companies-ndcx-*` ids. Also clean `tests/page-objects/booking/flight/FlightSearchPage.ts`: it still maps `AMADEUS_NDCX: "amadeus-ndcx"` from the old GDS row (flagged during C3 — compile-clean but dead for the classic selector) — remove or remap to the grid's `companies-ndcx-*` ids.

- [ ] **Step 2: Write the spec** (follows `tests/fixtures.ts` + `tests/company.ts` patterns; self-skips when the PDV lacks the NDC[X] attribute so it is env-portable):

```ts
// MET2-2422 : grille NDC[X] — visible sur un PDV activé, payload oras +
// selectedAirline corrects. SKIP si le PDV de l'environnement n'a pas
// l'attribut Amadeus-ndcx-enable.
import { expect, test } from "../fixtures";
import { setCompany } from "../company";

test.describe("grille de compagnies NDC[X] (MET2-2422)", () => {
  test.beforeEach(async ({ page }) => {
    await setCompany(page);
    await page.goto("/booking/flight");
  });

  test("la grille remplace la ligne GDS NDC[X] et alimente le payload", async ({ page }) => {
    await page.getByTestId("companies-selector-button").click(); // ajuster : data-test-id d'ouverture du sélecteur (cf. SearchFlight.vue)
    const grid = page.getByTestId("companies-ndcx-checkbox-LH");
    const visible = await grid.isVisible().catch(() => false);
    test.skip(!visible, "PDV sans attribut Amadeus-ndcx-enable");

    await expect(page.getByTestId("companies-gds-amadeus-ndcx-switch")).toHaveCount(0); // ligne GDS retirée

    let shoppingBody: any = null;
    page.route("**/aerial/global/airShoppingRQ", async (route) => {
      shoppingBody = route.request().postDataJSON();
      await route.abort(); // pas besoin de vraies offres pour ce smoke
    });

    await grid.check();
    await page.getByTestId("companies-ndcx-checkbox-IB").check();
    await page.getByTestId("companies-dialog-validate").click();
    // lancer la recherche (bouton du formulaire — data-test-id du SearchFlight)
    await page.getByTestId("search-flight-submit").click(); // ajuster au data-test-id réel

    await expect
      .poll(() => shoppingBody)
      .toBeTruthy();
    expect(shoppingBody.oras).toContain("AMADEUS_NDCX");
    const ndcxEntries = shoppingBody.selectedAirline.filter(
      (e: any) => e.gds === "AMADEUS_NDCX" && e.PreferLevel === "Preferred",
    );
    expect(ndcxEntries.map((e: any) => e.code).sort()).toEqual(["IB", "LH"]);
  });
});
```

Before finalizing: grep the real `data-test-id`s for the selector-open button and the search submit button in `app/components/booking/flight/SearchFlight/` and substitute them (do not leave the placeholder comments in the committed spec).

- [ ] **Step 3: Run it** — `npx playwright test tests/components/ndcxCompanyGrid.spec.ts` (skips cleanly on non-NDC[X] environments, runs against local dev).

- [ ] **Step 4: Full gate + commit**

```bash
npm run lint:changed -- --staged
git add tests/components/ndcxCompanyGrid.spec.ts
git commit -m "MET2-2422 ndcx grid: smoke Playwright (grille + payload oras/selectedAirline)"
```

---

# Part D — Cross-repo verification & rollout

### Task D1: Full test matrix (no code changes) — **EXECUTED 2026-11-10, all green**

- [x] api-aerial: `node --test` (cwd `src/`) — routing suites **27/27 PASS** + pre-existing suites `node --test controllers/AMADEUS_NDCX/__tests__/ controllers/__tests__/sabre.offerPrice.passengers.test.js` → **155/155 PASS** (182 total).
- [x] front-dashboard: targeted `npx vitest run` → **4/4 PASS** (NDC Routing + NDCX), full suite re-run → **224/224 PASS**.
- [x] front-reservation: targeted vitest → **5/5 PASS** (ndcxAirlines 3 + ndcxSelectionHydration 2) + branch-wide `npm run lint:changed -- --base origin/development` → **"Checking 25 changed file(s): lint + vue-tsc... Changed files are clean."** (grep sweep `companies-gds-amadeus-ndcx` → 0 hits).
- [x] Lint/type gates — see replaced row below (api-aerial/eslint N/A, meta-note kept).
- [ ] Lint/type gates: ~~api-aerial eslint~~ — **not applicable: api-aerial has no ESLint config/dependency/script** (checked `package.json` during D1); its gates are the node:test suites above + the `node -e "require(...)"` smoke checks from A3/A6. front-dashboard: no lint script either — its gate is the full vitest suite (224/224, hooks + D1 rerun). front-reservation: `npm run lint:changed` (see below).

### Task D2: Staging end-to-end checklist (manual, preprod PDV)

> **Deferred-to-staging round-up (every dev-server smoke skipped during execution, per scoping):** B2 Step 4 (browser round-trip of the guided NDC category fields), C4 Step 4 (SBT `/sbt/booking/flight` smoke incl. the dual-intent case), C5 Step 4 (OFF "add flight" modal smoke), C6 Step 3 (live Playwright run — the spec is `--list`-validated only; needs a dev server + the `setup` project's `playwright/.auth/user.json`), A6 Step 7's live `POST /aerial/global/airShoppingRQ` against the dev API, and the plan's C2 Step 6 dev render check. All are covered by the items below.

- [ ] 1. In front-dashboard, set on a **test** PDV: `NDC-routing-priority = "NDCX,SABRE"`, `NDC-routing-fallback = "Actif"` (category NDC). Wait ≤ 10 min (router cache) or restart api-aerial.
- [ ] 2. **Legacy regression (opt-in contract)**: on a PDV *without* routing attributes, search LH via the chip → logs show the SABRENDC path only, no `NDC_ROUTE` line — byte-identical legacy behavior.
- [ ] 3. **Chip rerouted**: on the routing PDV, search LH via the chip → logs show `ora=NDC_ROUTE airlines=LH` with `fallback=0|1`; offers appear; an NDC[X] offer carries `OwnerCode "AMADEUS_NDCX"`, a Sabre fallback offer carries the Sabre ownerCode (UAD/SNA/LXA normalized upstream).
- [ ] 4. **Grid scoped**: on the routing PDV, grid-check LH + IB → one MasterPricer call scoped `M:LH,IB` (or `LH|IB` in companyIdentity) + fallback SABRENDC `ndcFound` limited to the airlines with no NDC[X] offers.
- [ ] 5. **Fallback booking**: book an offer that came from the fallback (Sabre ownerCode) end-to-end through OrderCreate — the existing per-ora adapters already key off the offer `OwnerCode`; no front change expected.
- [ ] 6. **Timing**: watch `[PROVIDER-TIMING] ora=NDC_ROUTE` lines — ndcx step ≤ 12 s, sabre step ≤ remaining budget; no 408 `NDC_ROUTE` entries in normal cases. If the Sabre tail clamps too often, raise `NDC_ROUTING_NDCX_STEP_TIMEOUT_MS` down or `SHOPPING_SABRE_TIMEOUT_MS`/budget up (all env).
- [ ] 7. **Look-to-book**: confirm the grid is never auto-checked on load in classic, SBT, and OFF modal.
- [ ] 7b. **Exercise each SBT emit path** (found in C4): grid toggle, `sbtManageCompanies`, toggle-all NDC/LCC/GDS, remove a GDS company, policy watcher, preferences watcher, defaults re-assembly while the grid holds a selection (e.g. passenger change) → `oras` always carry exactly one `AMADEUS_NDCX` iff selection non-empty. (Deviation note from C4: `hasNdcxGrid` is set-only per the plan — if a session's PDV attributes swap mid-session to a PDV *without* `Amadeus-ndcx-enable`, the grid would remain visible; accepted unless D2 shows a real path, otherwise add a reset in the PDV-watchers.)
- [ ] 8. Remove the routing attributes from the test PDV → behavior returns to legacy within 10 min.

### Task D3: Rollout notes

- Confirm the two lists (grid 30, routable 10) against the office's actual Amadeus NDC[X] activation — adjust `NDCX_AIRLINES`/`ndcxAirlines.ts` and `ROUTABLE_NDC_AIRLINES`/`NDCX_ROUTABLE_CODES` **in the same commit on both repos** (mirror discipline), plus EN/4Y if Amadeus confirms them.
- Rollout order is free (parts are independent), but enabling `NDC-routing-priority` on production PDVs should follow a full preprod pass of D2.
- Known risks, accepted: Sabre NDC 25–45 s tail occasionally clamped by the deadline (partial 408 per ora, front already tolerates); routing config cache staleness ≤ 10 min (same as all sales-point config); fallback doubles provider calls **only** when NDC[X] actually misses (look-to-book impact bounded by decision 7's sequential design).

---

## Self-review (done during planning)

- **Spec coverage:** every decision 1–15 maps to a task (1→A5/A6, 2→A1/C1, 3→A2 `isRoutableNdcAirline`, 4→executor SABRENDC, 5→`missingAirlines`, 6→`isFailedResult`+timeout catch, 7→timebox+deadline, 8→B1/B2+A4, 9→C3/C4/C5, 10→C3 template/types, 11→A2 `applyNdcRoutingToBody` (oras ∩ routable), 12→`resolveNdcRoutingConfig` capability filter, 13→A1/C1 lists + D3 confirmation, 14→tags everywhere, 15→branch notes in Part headers). The NDC[X] skill's non-negotiables are preserved (no payload change, no auto-check, no re-shop loop, NDC=100 untouched).
- **Type consistency:** `SelectedAirlineEntry` `{code, PreferLevel, gds}` flows front→back unchanged; `applyNdcRoutingToBody`'s `profile` matches the `airlinesProfilesResult` entry shape used by `processAirlinesResults`/`fetchSingleAirlineShoppingResponse` (`ora`, `verif`, `noVerif`, `bodyOras`, plus the new `isNdcRoute` flag); `runNdcRoutedShopping` consumes `resolveNdcRoutingConfig`'s `{providers, fallback}` verbatim.
- **No placeholders:** the two `// ajuster` notes in the C6 spec are intentional pre-commit instructions to substitute real `data-test-id`s found by grep (the spec must not ship with them); C5 Step 3's `baseOras`/`baseSelectedAirline` are defined as "whatever the child currently computes" because the child's contract is read in Step 1 — both are read-then-adapt steps with concrete anchors, not deferred design.
