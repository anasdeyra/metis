# OBT / SBT mode

## Definition
Operating **channel/mode** of the platform: *who* is booking and on whose
behalf, not *what state* a booking is in.

**SBT** (Self Booking Tool) mode = **the agency's client books for itself**.
It happens in two ways:

1. the client's user logs in and self-books (`TRAVELER_OBT`), or
2. a travel agent **impersonates the client** by switching the SBT toggle on
   at shopping (`AGENT_ON`).

Everything else is classic **TA** mode: the agent books as the agency
(`AGENT_OFF`).

| `getObtMode` | Who books | On whose behalf | Resolved by |
|---|---|---|---|
| `TRAVELER_OBT` | Client user (corporate traveler) | themselves / their company | `authStore.getRole === "TRAVELER"` |
| `AGENT_ON` | Travel agent | impersonating the client | SBT toggle on (`isSbtMode`) **and** agency `sbtActivation` |
| `AGENT_OFF` | Travel agent | the agency (classic TA) | default |

Sources: `front-reservation/app/stores/iata.ts:67` (`getObtMode`);
`front-reservation/app/utils/sbt.ts` — `isSbt()` is true for **both**
`TRAVELER_OBT` and `AGENT_ON`.

In code, **OBT and SBT name the same client self-booking channel**
(`isObtUser`, "utilisateur OBT (SBT, groupFullPath à 4 niveaux)",
`pages/sbt/`, `fromSBT`). "OBT" leans toward the client user, "SBT" toward the
mode or toggle, but neither means a different product.

## Business context
- **TA mode** (back-office) is the agency flow: consultants create, hold,
  approve, issue and service bookings for clients. Hold-before-pay is the TA
  usage pattern.
- **SBT mode** applies the client's rules: company travel policy and
  compliance, credit limits, approbations. That holds whether the client books
  or an agent impersonates them.
- Shorthand in code comments: **ON** = SBT mode (`AGENT_ON`), **OFF** = TA mode
  (`AGENT_OFF`).

## Technical context
- **The toggle** lives in the shopping step and shows only when the agency
  has `sbtActivation`: flight passenger selection
  (`front-reservation/app/components/booking/flight/SelectPax/SelectPax.vue`,
  under the travel-policy section of the first passenger) and rail search
  (`components/booking/rail/SearchRail/index.vue`). It sets
  `iata.TOGGLE_SBT_MODE`. Requests carry `isSbt`.
- **Client users** belong to 4-level Keycloak groups (`groupFullPath` with 4
  slashes). An agency can carry several client companies —
  `api-dashboard/src/controllers/legal_person.controller.js:853`,
  `physical_person.controller.js:1737`.
- **`dossier.fromSBT` / `isOn`** are set at hold from the **booking token's**
  group depth (4 levels = client user), not from the toggle —
  `api-aerial/src/utils/dossier.utils.js` (`slashCount === 4`). Attaching to an
  ON dossier also checks `body.isSbt` (`dossierAttach.utils.js`).
- Pages for the client UI: `front-reservation/app/pages/sbt/`. Mode-dependent
  guards: `app/middleware/booking-access.global.ts`.
- Dossier exposure to client users: `PATCH /dossier/dossiers/:id/obt-visibility`
  (`api-aerial`); their notifications: `POST /notifications/read/obt/all/:offset`.
- Client-generated files land in a dedicated S3 bucket (`OBT_FILES`) —
  `api-aerial/src/utils/fileExport.utils.js`.
- Travel policy: `front-reservation/app/stores/sbt/travelPolicy.ts`.

## Business rules
- **Client users cannot perform agent accounting actions.** For example, PNR
  conversion is refused for a client (SBT) token —
  `api-aerial/src/utils/pnrConversionAccess.utils.js:8`.
- SBT dossiers trigger the [approbation flow](../workflows/approbation-flow.md).
  A flight added in OFF to an ON dossier does not (MET2-2980).
- Booking-access rules differ between TA and SBT paths. Check
  `booking-access.global.ts` before assuming a guard applies to both.
- LCC handling has SBT-specific APIS/TTL rules (`lccAirlines.config.ts`).

## Open question ⚠️
`fromSBT` comes from the token's group depth. An agent impersonating with the
toggle books with an agent token. Does that booking get `fromSBT`, and so
approvals? Not established. Ask before relying on it.

## Distinctions
- Booking mode (TA / SBT) ≠ PNR status ≠ approval state ≠ OBT visibility.
- `AGENT_ON` (agent impersonating the client) ≠ `TRAVELER_OBT` (client
  logged in). Same rules apply, different actor and token.
- Booking mode ≠ **canal** (LCC / GDS / NDC distribution channel).
- Client user (`TRAVELER` role) ≠ passenger (PAX on the booking).

## Synonyms
- SBT = Self Booking Tool; OBT = Online Booking Tool. Same channel in this
  codebase.
- ON = SBT mode, OFF = TA mode; "SBT token" = a client user's token.
- OBT voyageur (FR), corporate booking, impersonation (agent in ON).
