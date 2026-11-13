# Provider, ora, canal

## Definition
Three routing words that agents mix up:

| Word | What it is | Example values | Where |
|---|---|---|---|
| **ora** | Routing key a request carries (`body.ora`, `body.oras[]`). An airline designator, a metis pair, or a provider pseudo-code. | `EK`, `AF/KL`, `A3/OA`, `AMADEUS`, `SABRENDC`, `AMADEUS_NDCX` | request body |
| **provider** | The integration (controller folder) an ora resolves to via `AIRLINE_TO_PROVIDER`. | `AFKL`, `GOKYTE`, `SABRE`, `AMADEUS`, `AMADEUS_NDCX`, `TURKISH_AIRLINES` | `api-aerial/src/controllers/<PROVIDER>/` |
| **canal** | Distribution channel used by CRM remarks and billing. | `LCC`, `GDS`, `NDC` | `getCanalForOwnerCode` |

Source: `api-aerial/src/utils/airline-constants.utils.js`.

## Business context
Metis sells flights through many pipes at once: GDS (Amadeus and Sabre), NDC
(Sabre NDC, Amadeus NDC[X], airline-direct NDC like AF/KL, EK, IB, VY, SQ) and
LCC aggregators (GoKyte, Transavia, Nouvelair). One airline can be reachable
through more than one pipe, so the **ora picks the pipe, not only the airline**.

| Provider key | Oras routed to it |
|---|---|
| `GOKYTE` | LCC `U2 FR 6E V7 W6 LS` and full-service `AY QR AA` |
| `TRANSAVIA` | `TO HV` |
| `AC` | `AC` (own `/aerial/AC/*` pipeline, overrides GOKYTE) |
| `AFKL` | `AF`, `KL`, `AF/KL` |
| `A3OA` | `A3`, `OA`, `A3/OA` |
| `IBERIA` / `VY` / `EK` / `TURKISH_AIRLINES` / `SINGAPORE_AIRLINES` / `NOUVELAIR` | `IB` / `VY` / `EK` / `TK` / `SQ` / `BJ` |
| `SABRE` | `SABRE`, `SABRENDC` (Sabre NDC carriers are rewritten to `SABRENDC`) |
| `AMADEUS` | `AMADEUS` (classic GDS) |
| `AMADEUS_NDCX` | `AMADEUS_NDCX` (pseudo-ora: the frontend must ask for it by name) |

`BA` is special-cased in `global.controller.js` (`offerPriceService`).

## Technical context
- Dispatch: `api-aerial/src/controllers/global.controller.js` resolves
  `Oras[ora]` and calls `dispatchToOraController` (`utils/oraDispatch.utils.js`)
  → `controllers[provider][Controller][method]`. An ora with no controller
  gets a **400 `ORA_NOT_SUPPORTED`**, never a hanging request (LOC-089 M3).
- **Shopping fans out** over every ora in `body.oras`
  (`isGlobalMultiProviderShopping`); **every later step uses `oras[0]`**
  (offerPrice, serviceList, seatAvailability, orderCreate/Retrieve/Cancel/
  Change/Reshop).
- **NDC routing (MET2-2422)**: carriers served by *both* NDC[X] and Sabre NDC
  (`ROUTABLE_NDC_AIRLINES`) can be routed by priority with per-carrier
  fallback (empty, error or timeout). Opt-in per sales point via the
  `NDC-routing-priority` attribute (`"NDCX,SABRE"`) and `NDC-routing-fallback`.
  Without the attribute the router is inactive. Internal ora `NDC_ROUTE`;
  NDC[X] step budget 12 s inside the 52 s shopping budget —
  `utils/ndc-routing.utils.js`, `ndc-routing.executor.js`.
- `NDCX_AIRLINES` is a static list (NDC[X] capability lives on the Amadeus
  office, not on per-sales-point configuration) mirrored by hand in
  `front-reservation/app/utils/flight/ndcxAirlines.ts`. **Change both or
  neither.**
- `pnr.ownerCode` can hold a provider pseudo-code (`SABRE`, `AMADEUS`,
  `AMADEUS_NDCX`) or `"unknown"`, not only an airline. Test with
  `isMarketingAirlineCode` before treating it as a carrier. `EK` is both a
  provider key and a real airline.

## Business rules
- Never infer the provider from the airline alone: the same carrier can sit
  in several pipes (`LH` via Sabre NDC or NDC[X]; `AA` via GoKyte or NDC[X]).
- Classic `AMADEUS` and `AMADEUS_NDCX` are separate providers with no
  auto-redirect between them.
- Provider-specific behavior goes in that provider's folder. Shared code
  (`dossier.utils.js`, `global.controller.js`) affects every provider: name
  every shared-file touch in the MR description.

## Distinctions
- ora ≠ provider ≠ `ownerCode` ≠ marketing airline.
- **canal** (LCC / GDS / NDC distribution channel) ≠ **booking mode**
  (TA / OBT / SBT, see [obt-mode.md](obt-mode.md)). Both get called "channel".
- GDS ≠ NDC: `SABRENDC` and `AMADEUS_NDCX` are NDC pipes run by GDS vendors.

## Synonyms
ora, compagnie (FR, in error messages), provider, pipe, fournisseur.
