---
name: amadeus-ndcx
description: Implement, debug or review Amadeus NDC[X] Travel API integrations — the SOAP web services for booking NDC airline content through the Amadeus Travel Platform. Covers connectivity to the test/production WSAP endpoint and the SOAP Header 4.0 security block; shopping with Fare_MasterPricerTravelBoardSearch; the prime booking chain Travel_OfferPrice → Travel_OrderCreate → Travel_OrderPay → Travel_OrderRetrieve; ancillaries and seats via Travel_ServiceList and Travel_SeatAvailability; voluntary and involuntary exchanges via Travel_OrderReshop and Travel_OrderChange; voids, refunds, split PNR, retain/reuse credit; per-airline capability differences across 27 carrier groups; and the Amadeus certification checklist. Use when the user mentions NDC, NDCX, NDC[X], Amadeus Travel API, MasterPricer, OfferPrice, OrderCreate, OrderPay, OrderReshop, OrderChange, ServiceList, SeatAvailability, OfferID/OfferItemID/ShoppingResponseID, WSAP, or is working on airline booking flows against Amadeus.
---

# Amadeus NDC[X] Travel API

Knowledge base distilled from the Amadeus **WBS Implementation Guide NDC[X] v1.5**
(Prime Booking, Refunds and Voids), the **Ancillaries, Seats and Servicing v1.2** guide,
the June 2026 per-airline difference table, and ~330 captured request/response messages.

## How to use this skill

Read this file, then open **only** the reference file(s) for the task. Each is
self-contained. Do not read them all — `references/` totals ~9,000 lines.

| If the task is about...                                                                      | Read                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint, credentials, Office ID, prerequisites, service versions, out-of-scope              | `references/01-setup-and-connectivity.md`                                                                                                                                                         |
| Shopping / search, time limits, reading NDC offers out of the reply                          | `references/02-shopping-masterpricer.md`                                                                                                                                                          |
| The booking chain: OfferPrice → OrderCreate → OrderPay → OrderRetrieve                       | `references/03-prime-booking-flow.md`                                                                                                                                                             |
| Per-bound (VY), per-bound-per-PTC (QF), corporate repricing                                  | `references/04-carrier-specific-pricing.md`                                                                                                                                                       |
| Search options: frequent flyer, NDC-only, fare types, SAF bundles, PTCs, amenities           | `references/05-shopping-options-and-fares.md`                                                                                                                                                     |
| Payment: 3DS, cash, fraud checks, manual approval, implicit FOP, OB fees, commissions        | `references/06-payment-and-features.md`                                                                                                                                                           |
| Retrieving orders, identifying NDC bookings in `PNR_Reply`, contacts, AIAN, CUIL/CUIT        | `references/07-order-retrieve-and-pnr.md`                                                                                                                                                         |
| Voids, refunds, cancellation, fare families, Amadeus Profiles + stateful sessions            | `references/08-cancel-refunds-and-profiles.md`                                                                                                                                                    |
| Queues, Amadeus↔airline sync, error messages, coupon codes, **test cards & loyalty numbers** | `references/09-queues-sync-errors-testdata.md`                                                                                                                                                    |
| Certification requirements, acceptance criteria, required test cases                         | `references/10-certification-and-testing.md`                                                                                                                                                      |
| Servicing-guide setup deltas and servicing process flows                                     | `references/11-servicing-overview.md`                                                                                                                                                             |
| Deferred vs instant payment, contact/FF updates, retain & reuse credit, split PNR            | `references/12-post-booking-modifications.md`                                                                                                                                                     |
| Ancillaries and seats (pre-booking / post-booking / post-issuance), bags, family seating     | `references/13-ancillaries-and-seats.md`                                                                                                                                                          |
| Voluntary **fare driven** exchange                                                           | `references/14-exchange-fare-driven.md`                                                                                                                                                           |
| Voluntary **schedule driven** exchange, exchange with netting                                | `references/15-exchange-schedule-driven.md`                                                                                                                                                       |
| Involuntary: disruption detection, acceptance, cancellation, exchange, waiver codes          | `references/16-involuntary-changes.md`                                                                                                                                                            |
| Servicing-guide deltas on queues/errors/test data                                            | `references/17-servicing-queues-errors-faq.md`                                                                                                                                                    |
| "Does carrier X support feature Y?"                                                          | `references/18-airline-capability-matrix.md`, or grep `references/airline-matrix.csv` (tidy: one row per feature × carrier × channel) and `references/airline-notes.csv` (the `Note (Dnn)` texts) |
| A real message on the wire for any flow                                                      | `examples/INDEX.md`, then the scenario folder                                                                                                                                                     |

`scripts/ndcx_search.py` is a working, dependency-light client: it builds the
WS-Security header, sends a MasterPricer search, and extracts the NDC OfferIDs.
Use it as the reference implementation and as a smoke test (`--dry-run` needs no
credentials).

## Non-negotiables

These cause silent failures or certification rejection. Apply them without being asked.

1. **All NDC calls are stateless.** A stateful session (`TransactionStatusCode`
   `Start`/`InSeries`/`End`) is required _only_ when mixing in legacy APIs such as
   `PNR_AddMultiElements`. In a stateful session, commit any order/PNR update before the
   next call (rule SEM-03).
2. **SOAP Header 4.0 is mandatory.** Every request carries `wsa:MessageID`, `wsa:Action`,
   `wsa:To`, `TransactionFlowLink`, the WS-Security `UsernameToken` with a
   `PasswordDigest`, and `AMA_SecurityHostedUser/UserID@PseudoCityCode`.
3. **`PasswordDigest` = `base64(sha1(rawNonceBytes + createdString + sha1(password)))`** —
   hash the raw nonce bytes and the exact `Created` string you send; Base64 the nonce
   separately.
4. **NDC-only means exactly `100`.** `numberOfUnit/unitNumberDetail` with
   `typeOfUnit=NDC` and `numberOfUnits=100`. Any other value is silently ignored and you
   get mixed NDC + Edifact content.
5. **Children are `CNN`, never `CHD`** (rule Shopping_06). Infants are a separate `INF`
   `paxReference` attached to an adult's `ref` with `infantIndicator=1`, and are **not**
   counted in the `PX` unit.
6. **Every NDC recommendation is flagged** `recommendation/itemNumber/priceTicketing/priceType = "N"`
   and carries a `segmentFlightRef/referencingDetail` with `refQualifier = OI` pointing into
   `offersGroup`. No `OI` means it is Edifact content, not NDC.
7. **Carry all four IDs forward**: ShoppingResponseID (`offersGroup/response/applicationDetails/internalId`),
   OfferID (`offerDetails/uniqueOfferReference`), OfferItemID(s)
   (`offerItems/offerItemDetails/offerItemId`) and **OwnerCode**. `Travel_OfferPrice`
   requires all of them, and MasterPricer is a mandatory prior step (Offer_01, Offer_02, Offer_04).
8. **Respect the Offer Time Limit.** `OTL` in the MasterPricer reply is GMT and runs
   15–30 min depending on carrier. Once it expires you must re-shop — offers cannot be
   repriced. Dates in MasterPricer are `DDMMYY`, times `HHMM`.
9. **Search with city codes** (`LON`, `NYC`, `PAR`) when a carrier returns
   `QUERY NOT PROCESSABLE: NO ELIGIBLE NDC PROVIDER` — several NDC profiles do not
   recognise secondary airport-to-airport pairs.
10. **Look-to-book 1000:1** (offers:orders) across all carriers, or carriers may restrict
    the content. Never build retry or polling loops that re-shop (rule GEN-02, GEN-04).
11. **Never create duplicate bookings** (rule ERR-04) — a confirmation page must not be
    re-submittable.
12. **Check the airline matrix before promising a feature.** Support varies per carrier
    _and_ per channel (WBS vs SECO — web services integrations are **WBS**). Baseline
    out of scope everywhere: Edifact bookings, split/multiple forms of payment, groups
    (9+ pax), adding commission, adding flights to an order with issued documents.

## Endpoints

| Environment                       | URL                                                |
| --------------------------------- | -------------------------------------------------- |
| Test (as captured in the samples) | `https://noded5.test.webservices.amadeus.com/WSAP` |
| Test (other node seen)            | `https://nodeD1.test.webservices.amadeus.com/WSAP` |
| Production                        | supplied by Amadeus with your access               |

One URL serves every service; the message is routed by `SOAPAction` / `wsa:Action`
(e.g. `http://webservices.amadeus.com/FMPTBQ_23_4_1A`,
`http://webservices.amadeus.com/Travel_OfferPrice_1`). **Use the exact node Amadeus
issued you** — the node letter and number are tied to your access. Development must run
against your _Dedicated Test Access_, not the POC access (rule GEN-06).

HTTP: `POST`, `Content-Type: text/xml; charset=utf-8`, `SOAPAction: <the Action value>`.

## Service versions

`Fare_MasterPricerTravelBoardSearch` **23.4** (min 18.1 live in production first) ·
`Travel_Management Interface` **v1.14** · `Travel_OfferPrice` 1.3 ·
`Travel_OrderCreate` 1.7 · `Travel_OrderPay` 1.7 · `Travel_OrderRetrieve` 1.7 ·
`Travel_OrderCancel` 1.0 · `Travel_OrderChange` 1.9 · `Travel_OrderReshop` 1.6 ·
`Travel_SeatAvailability` 1.0 · `Travel_ServiceList` 1.1 · `Security_SignOut`.
Optional: `PNR_Retrieve` / `PNR_AddMultiElements` / `PNR_Cancel` 17.1+,
`Queue_List` 11.1, `SalesReports_Display*` 22.2, `Ticket_DisplayTST` 15.1,
`Ticket_DisplayTSMP` 13.1, `Ticket_GetDocumentReceipt` 20.1.

## Flow cheat sheet

```
Prime booking     MasterPricer → OfferPrice → OrderCreate → OrderPay → OrderRetrieve
Void / refund     OrderReshop (quote) → OrderCancel
Ancillaries pre   ServiceList / SeatAvailability → [OfferPrice] → OrderCreate
Ancillaries post  ServiceList / SeatAvailability → [OfferPrice] → OrderChange
Exchange (fare)   OrderReshop (shop) → OrderReshop (price) → OrderChange
Exchange (sched)  Air_MultiAvailability → OrderReshop → OrderChange [→ OrderPay]
Involuntary       detect via queue/notification → OrderRetrieve → accept | cancel | exchange
```

`Travel_OfferPrice` is **conditional** in the ancillary flows — see
`references/13-ancillaries-and-seats.md` for exactly when it is required.

## Working style for this domain

- **Prefer the captured examples over your own reconstruction.** Several request bodies
  appear in the source guides only as screenshots; where a reference file says
  `(diagram in source: ...)`, the real XML is in `examples/`. Match the sample's element
  order and namespaces.
- **Namespaces and element order matter.** These are schema-validated SOAP services;
  the Amadeus host rejects reordered or misnamespaced children.
- **Amounts**: some contexts express a plain integer, others an integer plus a decimal
  place indicator. Never assume — check the reference file for the specific service.
- **Validate before sending** (rules ERR-02, ERR-03): reject invalid data, bad or
  out-of-sequence dates, and malformed values client-side rather than round-tripping them.
- **Distinguish advisory from warning** error messages (rule ERR-05); a warning at
  `Travel_OrderPay` (e.g. a reprice warning) is not necessarily a failure.
- When the user asks whether something is possible, answer from
  `references/18-airline-capability-matrix.md` for their specific carrier rather than
  generalising — carrier behaviour differs substantially, and the two IT providers
  (Accelya vs Altéa NDC) diverge in normalization.

## Provenance and limits

- Guides: Prime Booking **v1.5**, Servicing **v1.2**. Matrix dated **2026-06-15**.
- The guides themselves are not exhaustive; they point to the per-service user guides on
  developers.amadeus.com and to the quarterly "Normalization Differences per Provider"
  document. `references/01-setup-and-connectivity.md` has the links.
- Credentials, nonces, password digests and Office IDs in `examples/` are replaced with
  placeholders. Oversized captures had repeating elements trimmed to 3 and say so on
  line 1 — **do not read record counts out of those files**.
- Test credit cards and loyalty numbers in `references/09-queues-sync-errors-testdata.md`
  are for the **test
  environment only**. In production: real cards only, cancel test bookings immediately,
  avoid high season, no fictitious names.
