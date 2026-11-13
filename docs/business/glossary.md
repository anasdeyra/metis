# Business Glossary

One-liners only — depth lives in [concepts/](concepts/) and [workflows/](workflows/).
⚠️ = drafted by inference, needs domain-owner confirmation (see
[README](README.md#conventions)). Code anchors are relative to the workspace
root.

## Operating modes & actors

| Term | Definition | Aliases / FR | Don't confuse with | Code anchors |
|---|---|---|---|---|
| **TA mode** | Travel Agent mode: the agent books as the agency (`AGENT_OFF`). | agent mode, classic, OFF | SBT mode (client books, or agent impersonates the client) | `front-dashboard/`, `api-dashboard/` |
| **OBT mode** | Same client self-booking channel as SBT; "OBT" leans toward the client user. `getObtMode` resolves to `TRAVELER_OBT` / `AGENT_ON` / `AGENT_OFF`. | OBT, OBT voyageur, Online Booking Tool | booking status (it's a channel/mode, not a state) → [concept](concepts/obt-mode.md) | `front-reservation/app/stores/iata.ts:67` |
| **SBT mode** | Self Booking Tool: the agency's client books for itself, either the client user logged in (`TRAVELER_OBT`) or an agent **impersonating the client** via the SBT toggle at shopping (`AGENT_ON`, needs agency `sbtActivation`). Client rules apply: travel policy, credit, approbations. | SBT, ON, impersonation | TA mode (agent books as agency); canal | `utils/sbt.ts` (`isSbt`), `SelectPax.vue` (toggle), `iata.ts:54,65`, `api-dashboard/src/controllers/physical_person.controller.js` (`create/obt/reservation` = `createFromSbtReservation`) |
| **Traveler** | Platform role `TRAVELER` — the client's user who self-books in SBT mode (4-level Keycloak group). | voyageur | passenger / PAX (person flying on a booking) | `front-reservation/app/stores/auth.ts` |
| **Agent / consultant** | Agency staff in TA mode; only agents may perform accounting actions (e.g. PNR conversion is refused for OBT travelers). | agent, conseiller | traveler | `api-aerial/src/utils/pnrConversionAccess.utils.js:8` |
| **Agency** | IATA agency (Groupe Adenis context); carries sales points, options, and can carry multiple OBTs. | agence | sales point (an agency has several) | `api-aerial/src/models/agence.js`, `api-dashboard/src/controllers/legal_person.controller.js:853` |
| **Sales point** | Agency office (point of sale) a booking is made through; holds supplier credentials, currency, NDC routing and back-office settings as `attribut` rows. | point de vente, PDV | agency (an agency owns several) | → [concept](concepts/sales-point.md), `api-aerial/src/services/sales_points.service.js` |
| **ON / OFF** | Shorthand for SBT mode / TA mode. `dossier.fromSBT`/`isOn` is set at hold from the booking token's group depth (4 levels = client user) and triggers approbation. ⚠️ unclear whether agent impersonation sets it. | | the SBT toggle itself | `iata.ts:67`, `dossier.utils.js` (`fromSBT`) |
| **Compliance** | Whether a reservation respects the company travel policy; out-of-policy bookings carry justification `reasons` → `is_compliant = false`. | conformité, hors politique | `motifDeplacement` (trip purpose) | `front-reservation/app/stores/sbt/travelPolicy.ts`, `api-aerial/src/queue/queue.js` |
| **OBT visibility** | Per-dossier flag controlling what OBT users can see of a booking. | visibilité OBT | dossier status | `PATCH /dossier/dossiers/:id/obt-visibility` (`api-aerial/src/controllers/dossier.controller.js`) |
| **Credit limit** | Agency/company credit ceiling; approaching it raises notifications and gates booking. | plafond | approbation (separate control) | `api-aerial/src/services/credit-limit-notification.service.js`, `api-dashboard/src/controllers/credit_limit.controller.js` |
| **Approbation** | Approval workflow over reservations (all four verticals): first-response / each-must-approve / cascading flows. | approbation, approval | credit limit | → [workflow](workflows/approbation-flow.md), `api-aerial/src/utils/approbation.utils.js` |

## Booking core

| Term | Definition | Aliases / FR | Don't confuse with | Code anchors |
|---|---|---|---|---|
| **Dossier** | Metis' internal booking record — the hub entity holding travelers, tickets, prices, PNR links, remarks, billing. Created once at hold, updated on pay/retrieve. | dossier, folder (OBT UI) | PNR (airline-side), Order (NDC-side) → [concept](concepts/dossier.md) | `api-aerial/src/utils/dossier.utils.js`, `front-reservation/app/pages/folder/` |
| **Hold** | Booking created without payment (order create step); PNR `BOOKED` (1) until issued or `ttl` passes. TA back-office books hold-before-pay. | créer/tenir une réservation, réservé | option (agency feature flag) | [lifecycle](workflows/booking-lifecycle.md), `docs/archive/ndcx/NDCX-INTEGRATION.md` locked decisions |
| **PNR status** | Numeric `pnr.status`: `1` BOOKED, `2` TICKETED, `0` VOID, `3` CANCELLED, `4` REFUNDED, `5` EXPIRED, `9` RETAINED, `-5` DISRUPTED, `6` ACTION NEEDED, `7` DAR REQUIRED (front filter), `8` PAYMENT ERROR. | statut PNR, état PNR | ticket/price `status === 1` (= active row) → [table](workflows/booking-lifecycle.md#pnr-status-codes-pnrstatus) | `front-reservation/app/pages/journal/etat-pnr.vue`, `pnrTerminalStatus.utils.js` |
| **TTL** | Ticketing time limit (`pnr.ttl`): deadline to issue a held booking before it expires. | time limit, date limite d'émission | Offer Time Limit (NDC offer validity, minutes) | `pnr.ttl`, `etat-pnr.vue` (`ttlStatus`) |
| **Airline notification** | Airline-side change landed via queue scan or OCN; types `1` schedule change, `2` TTL expired, `3` DAR Required, `4` DUPE, `5` SEAT_CANCELLED. Open ones put the dossier in ACTION NEEDED. | notification | metis user notifications (`/notifications/read/obt/...`) | `api-aerial/src/services/notifications.service.js` |
| **DAR Required** | Intervention required from the airline or the API provider: the booking can't progress until the supplier side acts. Raised from the airline remark "DAR Required" as notification type 3; PNR filter status `7`. | DAR | ACTION NEEDED (broader: any open notification, agent-side) | `notifications.service.js`, `dossier.service.js` (status 7 filter) |
| **Two-step booking** | Create/hold and pay/issue are **separate calls**, never one chained call. | | one-call booking | `docs/archive/ndcx/NDCX-INTEGRATION.md` |
| **PNR** | Airline record locator + metis' PNR record; terminal statuses `0`=void, `3`=annulé, `4`=remboursé are never rewritten by resync. | record locator, recloc | Order, dossier, ticket → [concept](concepts/pnr-order-ticket.md) | `api-aerial/src/services/pnr.service.js`, `pnrTerminalStatus.utils.js` |
| **Order** | NDC-side booking (Travel_OrderCreate); `OrderID` is prefixed `NDCX-` by metis; `OwnerCode` is the provider, not the airline. | commande | PNR, dossier | `api-aerial/src/utils/AMADEUS_NDCX/order.utils.js` |
| **Ticket** | Issued flight document (`ticketDocTypeCode === "T"`, `status === 1` active). EMDs: `J` = EMD-A (associated), `Y` = EMD-S (standalone). | billet, émission | booking, coupon | `api-aerial/src/models/` (ticket_aerial), `issuanceTickets.utils.js` |
| **Coupon** | Per-segment flight coupon on a ticket; `CouponStatusCode === "V"` = voided. | coupon | ticket (a ticket has coupons) | `api-aerial/src/utils/cancelCouponStatuses.utils.js` |
| **PaxID** | Passenger id. Metis mints `PAX{n}`; the **host renumbers** (`P1`, `P1.1`) — post-booking calls must use the host id. | | traveler (platform user) | `dossier.utils.js` `paxFromDataList`, `resolveNdcxDossierTravelerIdByPax` |
| **PTC** | Passenger type code: `ADT`, `CNN` (**never `CHD`**), `INF` (bound to adult, excluded from PX count). Seaman PTCs are sanitized front-side. | passenger type | role | `countPassengersByType.utils.js`, ndcx skill rule 5 |
| **Split** | Separating traveler(s) from a dossier/PNR into a new one, with markup handling. | split, éclatement | exchange | `api-aerial/src/controllers/split.controller.js`, `splitTravelerCopy.utils.js` |
| **Seaman dossier** | Crew/seafarer booking carrying vessel info; guarded rules. | dossier marin, crew | regular dossier | `dossier_seaman.service.js`, `seaman-vessel-guard.utils.js` |
| **Passive segment** | Informational (non-bookable) segment added to a PNR to mirror a booking made elsewhere. | segment passif | active segment | `api-aerial/src/controllers/passive-segment.controller.js` |
| **Remark** | `remarque dossier` = internal note on the dossier; `remarque GDS` = written into the airline PNR. They are different audiences. | remarque | each other | `remarque_dossier.controller.js`, `remarque-gds-dossier.controller.js` |
| **OCN** | Order Change Notification — airline-pushed change message; one metis notification per OCN message, shared type enum. | | internal note | `ocnEmail.utils.js`, ADRs [0002](../adr/0002-notification-type-is-a-shared-enum.md)/[0003](../adr/0003-one-notification-per-ocn-message.md) |
| **Order warnings** | Persisted warnings that gate follow-up actions on an order. | | notifications | ADR [0004](../adr/0004-order-warnings-persisted-and-gate-actions.md) |
| **UETTR** ⚠️ | Agency sales/PNR-status journal; "refresh" re-runs `orderRetrieve` on each listed PNR. | journal UETTR | sales journal | `api-aerial/src/services/uettrRefresh.service.js`, `front-reservation/app/pages/journal/uettr.vue` |
| **Sales journal** | Journal of sales / documents status pages for agents. | journal de vente, journal | UETTR | `journal_voyage.service.js`, `pages/journal/` |
| **Option (agency)** ⚠️ | Agency-level feature flag with validity window (`optionHasAgence`: type, startDate, endDate). | option agence | booking hold (industry "option" = hold!) | `api-aerial/src/controllers/option.controller.js`, `iata.ts:73` |
| **Upsell** | Fare upgrade proposed at the pricing step of booking. | upsell | exchange (post-booking) | `api-aerial/src/utils/AMADEUS_NDCX/offerPriceUpsell.mapper.js` |
| **Exchange** | Post-booking flight/fare change; fare-driven (`Travel_OrderReshop`) vs schedule-driven; involuntary = airline-initiated. One exchange at a time per order (lock). | échange, reshop | refund, void | `orderExchangeReconcile.utils.js`, `exchangeInProgressAt` on PNR |
| **LCC** | Low-cost carrier — special badge, conditions, margin channel, APIS/TTL OBT rules. | low-cost | legacy carrier | `front-reservation/app/config/lccAirlines.config.ts` |
| **MCTO** ⚠️ | Accounting message metis sends to the agency back-office for each issuance, EMD, void and refund (formats per sales point `type_bo`: IGA, viaxoft, Gestour, Transcontinent SFTP…). Not sent automatically for EDIFACT or NDC-via-GDS bookings (LOC-124). Manual resend from the folder. | message comptable | GDS accounting message; provider | `api-aerial/src/utils/MCTO/`, `front-reservation/app/components/folder/MctoResend.vue` |

## Aerial / Amadeus NDC

| Term | Definition | Aliases / FR | Don't confuse with | Code anchors |
|---|---|---|---|---|
| **Ora** | Routing key in the request (`body.oras[]`): airline designator, metis pair (`AF/KL`) or provider pseudo-code (`AMADEUS_NDCX`). Shopping fans out over all oras; later steps use `oras[0]`. | compagnie | provider, `ownerCode` | → [concept](concepts/provider-ora.md), `global.controller.js` |
| **Provider** | Integration/controller folder an ora resolves to via `AIRLINE_TO_PROVIDER` (`AFKL`, `GOKYTE`, `SABRE`, `AMADEUS`, `AMADEUS_NDCX`, …). Unknown ora → 400 `ORA_NOT_SUPPORTED`. | fournisseur, pipe, GDS (loosely) | airline designator | `airline-constants.utils.js`, `oraDispatch.utils.js` |
| **Canal** | Distribution channel `LCC` / `GDS` / `NDC`, used by CRM remarks and billing. | canal | booking mode TA/OBT ("channel" too!) | `getCanalForOwnerCode` in `airline-constants.utils.js` |
| **NDC routing** | Per-sales-point opt-in (`NDC-routing-priority`, `NDC-routing-fallback`) that tries NDC[X] then Sabre NDC for carriers both serve, with per-carrier fallback. Inactive without the attribute. | routeur NDC | provider choice by the agent | `utils/ndc-routing.utils.js` |
| **TO / corporate codes** | Negotiated fare codes sent to Amadeus: agency network (GIE) codes, per-airline corporate codes, and per-sales-point × airline `TO` or `CORPORATE` codes. | code TO, code corporate, OSI OIN | promo codes | `utils/AMADEUS/network-code.utils.js`, `sales_point_amadeus_to_codes` |
| **Classic AMADEUS** | SOAP TPP provider: stateful session ops (`PNR_AddMultiElements`, `PNR_Retrieve`, `Queue_List`, `Ticket_DisplayTST`). | AMADEUS | AMADEUS_NDCX | `api-aerial/src/utils/AMADEUS/` |
| **AMADEUS_NDCX** | Separate NDC[X] provider, no auto-redirect (frontend must send `oras: ["AMADEUS_NDCX"]`); Travel ops always stateless. | NDC[X] | classic AMADEUS | `api-aerial/src/utils/AMADEUS_NDCX/`, `NdcxClient.js` |
| **MasterPricer** | Shopping search (`Fare_MasterPricerTravelBoardSearch`); amounts in **decimal major units**. | search, shopping | OfferPrice | `shopping.utils.js` |
| **XND** | Classic-search NDC qualifier sent by default; `AMADEUS_EXCLUDE_NDC="false"` disables it without redeploy. | | NDC[X] provider opt-in | `docs/archive/ndcx/NDCX-REPONSE-DEYRA-2026-10-18.md` |
| **OfferPrice** | Repricing step; carries `ShoppingResponseID` + `OfferID` + `OfferItemID(s)` + `OwnerCode` from shopping; amounts in **integer minor units**. | pricing | shopping | `offer.utils.js`, `penalty.utils.js` |
| **Offer Time Limit** | Offer expiry (GMT, 15–30 min by carrier). Expired offers must be **re-shopped, never repriced**. | OTL | ticket time limit | ndcx skill rule 8 |
| **Look-to-book** | Amadeus ratio limit ~1000 offers : 1 order; no re-shop retry loops. | | | ndcx skill rule 10 |
| **NDC-only search** | `typeOfUnit=NDC` with `numberOfUnits=100` — **exactly 100** or the criterion is silently ignored. | | | ndcx skill rule 4 |
| **TST / TSMP** | Transitional Stored Ticket — Amadeus pricing record; `Ticket_DisplayTST` is used, `Ticket_DisplayTSMP` is not called anywhere. | | ticket (issued doc) | `NdcxClient.js` TST ops |
| **Queue** | Amadeus office queue where PNRs land (e.g. after airline changes); metis scans queues via cron. | file Amadeus | metis notification queue | `amadeus_queue_event.js` model, `queueList` op |
| **WSAP** | Web Services Access Point — per-office endpoint suffix; metis value `1ASIWMETMDI` (attr `Amadeus-wasp`). | wasp | office ID | `amadeusServiceFactory.js`, `buildNdcxParty` |
| **PseudoCityCode** | Amadeus office id (`Amadeus-officeId` sales-point attribute; sent as `PseudoCityID`/`PseudoCityCode`). | office ID, NCEPF3273 (test) | WSAP, IATA number | `party.utils.js` |
| **Currency-unit trap** | MasterPricer = decimal major units; `Travel_*` = integer minor units. Read real `Decimals` metadata (it's an **array** on captures); 3-decimal currencies exist. | | | `amount.utils.js`, `docs/archive/ndcx/NDCX-CONTEXT.md` §3 |
| **NAV sentinel** | `"NAV"` marks "not available" in `TypeCode`/`DescText` (default payment type code, penalty availability) — must be translated, never passed through. | | empty string / null | `dossier.utils.js:807,1428` |
| **EMD** | Electronic Miscellaneous Document — ancillary equivalent of a ticket (`ticketDocTypeCode !== "T"`). | | ticket | `emdServiceLine.utils.js` |
| **Ancillary** | Non-bag services (meals, lounge, sports, fast track, assistance SSRs) via ServiceList; classified on ATPCO codes; free services bypass reprice. | annexe, extra | seat, bag | `serviceClassification.utils.js`, `docs/archive/ndcx/NDCX-ANCILLARIES-PLAN.md` |
| **Seat map** | `Travel_SeatAvailability` — seat selection per order. | seatmap | ancillary | `api-aerial/src/controllers/AMADEUS_NDCX/` |
| **Use cases** | Raw captured RQ/RS XML (Amadeus test host) — the wire-format authority. | captures | | `api-aerial/use cases/NDCX/`, `.agents/skills/ndcx/examples/` |

## Ticketing & servicing

| Term | Definition | Aliases / FR | Don't confuse with | Code anchors |
|---|---|---|---|---|
| **Issuance** | Ticket/EMD generation at the **pay** step: PNR → `2`, facturation `1`→`2`, credit debited, MCTO sent. | émission, ticketing, émis | booking creation (hold) → [concept](concepts/issuance.md) | `updateIssuance` in `dossier.utils.js` |
| **Pre-issuance** | Everything between hold and issuance: validation, pricing changes, ancillaries, cancels. | avant émission | post-issuance (different rules & fees) | [lifecycle](workflows/booking-lifecycle.md) |
| **Post-issuance** | Servicing after tickets exist: void, refund, exchange, EMDs. | après émission | pre-issuance | [workflow](workflows/cancellation-void-refund.md) |
| **Void** | Cancellation of an issued ticket inside the void window (provider-specific; Kyte: same day in the sales point's time zone, no fee). Coupons → `V`, PNR → `0`. | void, annulation à froid ⚠️ | refund | `cancelCouponStatuses.utils.js` |
| **Refund** | Money back after issuance, PNR → `4`; carrier-dependent (AI 100%, KQ/SQ taxes-only, AA errored in test). | remboursement | void, retain | `refund-amount.utils.js` |
| **Retain** | Cancel an issued ticket but keep its value for later use: PNR → `9`, no refund, no facturation, no MCTO. | billet conservé | refund | `dossier.utils.js` (`PNR_STATUS_RETAINED`), `GOKYTE/cancel.utils.js` |
| **Cancellation** | One route (`/orderCancelRQ`) branching by order/ticket state into cancel `3` / void `0` / refund `4` / retain `9`. Quote first: for NDC[X] it's `Travel_OrderReshop`, **mandatory** once paid (ADR-27). One-step-void carriers (AA via Kyte): the estimate *is* the cancel. | annulation | void, refund, exchange | [workflow](workflows/cancellation-void-refund.md) |
| **Duplicate booking** | Forbidden — the confirmation step must not be re-submittable. | doublon | | ndcx skill rule 11, `duplicateDetection.utils.js` |

## Payments, billing & finance

| Term | Definition | Aliases / FR | Don't confuse with | Code anchors |
|---|---|---|---|---|
| **Payment method** | `Cash` (default), card, `Voucher`, `Easy pay`; type code defaults to `NAV` when none. | mode de paiement | payment status | `dossier.utils.js:1495-1497` |
| **FOP / card handling** | NDC[X] sends raw PAN over TLS (AF/KL host-public-key encryption only fires for `OwnerCode` AF/KL — deliberate, name it in any payment PR). | FOP, CB | | `orderPay.utils.js`, `docs/archive/ndcx/NDCX-CONTEXT.md` §OrderPay |
| **BSP** | IATA Billing & Settlement Plan — cash payments settle via BSP (`withBSP`). | | direct settlement | `dossier.utils.js:1428` |
| **Facturation** | Billing/invoicing: segment billing, manual invoicing, v3 engine, rules/packages/volume discounts. | facturation, billing | payment | `facturation_*.service.js`, `billing*.service.js` |
| **Margin** | Agency margin on fares; split markup; LCC margin channel. | marge | tax, fee | `margin.controller.js` (api-dashboard), `splitMarkup.utils.js` |
| **Tarif** | Fare (negotiated/company fares attached to travelers). | tarif, fare | price (instance of a fare) | `tarifs.service.js`, `tarif-has-traveler.service.js` |
| **Taxes** | Tax amounts and per-currency handling. | taxes | fees, margin | `taxes.service.js`, `taxe.controller.js` |
| **Tripstax** ⚠️ | External tax-related integration (dashboard). | | | `api-dashboard/src/controllers/tripstax.controller.js` |
| **PNR conversion** ⚠️ | Accounting action on a PNR (agent-only; OBT travelers are refused). | conversion | PNR retrieve | `pnrConversionAccess.utils.js` |
| **Pending exchange payment** | Payment owed/pending on an exchange. | | refund | `pending_exchange_payment.service.js` |
