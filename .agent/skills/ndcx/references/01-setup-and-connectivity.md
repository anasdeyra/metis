# NDC[X] Setup and Connectivity

> Source: WBS Implementation Guide NDC[X] v1.5, sections: Introduction, NDC flow scope, Offer to Order Recommendation, Baseline NDC Out of Scope, Pre-requisites, Delegation, Office ID Settings, List of web services, Features per Airline, Airline Code Normalization, Post Implementation, Normalization Differences per Provider, Product Release Notes, Limitations, NDC Product Interoperability, Process Flows

## Scope

- Covers NDC Prime Booking Flow (shop, price, order, pay) plus Refunds and Voids via Amadeus Web Services.
- Ancillaries, seats and servicing orders are in a **separate** implementation guide.
- NDC content is under the responsibility of the NDC provider. It consists of shopping travel solutions aggregating Flight, Price and Services, called **Offers**, referenced by a unique **Offer Id**.
- NDC flow targets shopping + purchasing on **dedicated routes** between Travel Agent and NDC provider. Only origin/destination pairs agreed with the provider are in baseline NDC flow.
- All flows described are sent as **stateless sessions**.

## Offer-to-Order (Look-to-Book) Recommendation

- Maintain L2B ratio within **1000 offers to 1 order (1000:1)** across all carriers. Exceeding it leads carriers to restrict NDC content.

## Travel API User Guides (Amadeus for Developers)

| API | URL |
|---|---|
| MasterPricer TravelBoard Search | https://developers.amadeus.com/functional-doc/581 |
| Travel Offer Price | https://developers.amadeus.com/functional-doc/2783 |
| Travel Order Create | https://developers.amadeus.com/functional-doc/2785 |
| Travel Order Pay | https://developers.amadeus.com/functional-doc/2784 |
| Travel Order Retrieve | https://developers.amadeus.com/functional-doc/2782 |
| Travel Order Cancel | https://developers.amadeus.com/functional-doc/2808 |
| Travel Order Change | https://developers.amadeus.com/functional-doc/2809 |
| Travel Order Reshop | https://developers.amadeus.com/functional-doc/2821 |
| Travel Seat Availability | https://developers.amadeus.com/functional-doc/2820 |
| Travel Service List | https://developers.amadeus.com/functional-doc/2802 |

This guide does not include all possible features and flows; consult the individual user guides for examples and additional features.

## Baseline NDC — Out of Scope

Out of scope for servicing NDC orders (may be addressed in later phases):

- Edifact bookings.
- Split Payments (a.k.a. Multiple forms of Payment).
- Servicing for groups (9+ passengers).
- Commissions — adding commission (i.e. `FM10` in Edifact) is **not supported**. For carriers supporting commissions, a percentage is returned at shopping, pricing, and stored in the PNR at booking and post-booking.
- Addition of flights to an Order including issued documents.
- **American Airlines (AA) does not allow infants (INF).** If an infant is included in the MasterPricerTravelBoard input and AA is the only eligible airline, the response returns: `QUERY NOT PROCESSABLE: NO ELIGIBLE NDC PROVIDER`.
- **Air France / KLM, OTAs only** — private fares (`RU`) restricted at shopping time.
- Any feature listed on the Features per Airline spreadsheet that is not supported by the carrier.

## Pre-requisites

| Requirement | Detail |
|---|---|
| MasterPricer TravelBoard minimum version | **18.1 must already be live in production** before starting implementation. A lower version makes it impossible to include this API upgrade in the implementation project. |
| MPT upgrade redirection | Upgrading to a higher MasterPricer TravelBoard version requires an **additional internal configuration to be redirected**. Without this redirection NDC content is **not returned**. Contact Amadeus Account Manager. |
| NDC agreements | Established, if applicable. |
| SOAP Header | **Soap Header 4.0 — Mandatory for NDC.** |

## Delegation

- Security control on Amadeus PNR (`RP`, `EOS`) is unchanged, but the airline has full visibility of the travel agency (Office ID and IATA number) performing a transaction.
- If using delegation with multiple Office IDs / IATA numbers on a single NDC Order (e.g. booking in Office A / IATA 1, payment by Office B / IATA 2), **contact the airlines** to enable these cross Office/IATA transactions and to load fares accordingly.
- See the Features per Airline spreadsheet for additional information.

## Office ID Settings

- Office ID must have a valid **IATA number** associated (verify with Account Manager).
- OID configuration must allow ticket issuance (**AVN must not be None**).
- OID office profile must have a TA e-mail address.
- OID office profile must have a valid TA phone number.
- Sales Report requires Office ID activation — requested by the Account Manager.

### Data Profile Activation

Account Manager must request activation for **MPT** and **ORC**.

| Data profile | Effect | Chargeable |
|---|---|---|
| APPLY AMENITIES | Return amenities in MasterPricer TravelBoard response | **Chargeable** |
| ADD COMMISSION | Display commissions from carriers supporting the feature in MasterPricer TravelBoard response; activated by Office ID | No |
| FAMILY UPSELL 3 | Return AF/KL SAF Bundles; also usable to upsell at shopping time | No |
| FARE FAMILY INFO | Returns the brand fare name. Brand **code** is returned only for **AA, LH, UA** | No |
| GENERATE MINI RULES | Return minirules in MasterPricer TravelBoard response | **Chargeable** |

## List of Web Services and Versions

**Mandatory / core:**

| Web service | Version | Notes |
|---|---|---|
| Fare_MasterPricerTravelBoardSearch | 23.4 | |
| Travel_Management Interface | v1.14 | |
| Security_SignOut | (no version stated) | |
| Travel_OfferPrice | 1.3 | |
| Travel_OrderCreate | 1.7 | |
| Travel_OrderRetrieve | 1.7 | |
| Travel_OrderCancel | 1.0 | |
| Travel_OrderPay | 1.7 | |
| Travel_OrderChange | 1.9 | |
| Travel_OrderReshop | 1.6 | |
| Travel_SeatAvailability | 1.0 | |
| Travel_ServiceList | 1.1 | |
| SOAP Header | **4.0** | **Mandatory for NDC** |

**Optional:**

| Web service | Version | Purpose |
|---|---|---|
| PNR_Cancel | 17.1 or higher | Remove Amadeus local PNR elements |
| PNR_AddMultiElements | 17.1 or higher | |
| PNR_Retrieve | 17.1 or higher | |
| Queue_List | 11.1 | |
| SalesReports_DisplayQueryReport | 22.2 | |
| SalesReports_DisplayTransactionReport | 22.2 | |
| Ticket_DisplayTST | 15.1 | |
| Ticket_DisplayTSMP | 13.1 | |
| Ticket_GetDocumentReceipt | 20.1 | Copy of the itinerary |

## Features per Airline

### Emirates (EK) — Payment Time Limit (PTL)

- At **pricing**, EK does **not** return a Payment Time Limit (a.k.a. Ticketing Time Limit in NDC terminology). Not included in the response — impacts downstream processes relying on time limit data.
- At **order creation**, the `OrderViewRS` response from EK includes a PTL, but this is a **default value, not the actual PTL**.
- The real PTL is updated by EK **within 30 seconds to 5 minutes** after order creation.
- Once updated, EK sends an **OrderChangeNotification** message reflecting the correct PTL.
- Simultaneously, the element in the corresponding Amadeus PNR is updated with the accurate PTL value.
- The Amadeus PNR is **queued**, so the Travel Seller can get the updated PTL either by processing the queue, or by manually retrieving the Order a few minutes later (typically within 30s to 5m).

### Features per Airline document

Service Hub maintains a document listing key features for NDC-enabled content in Amadeus Travel Platform Travel API; it reflects critical booking and servicing capabilities as more carriers reach production.

URL: https://servicehub.amadeus.com/c/portal/view-solution/976155818

## Airline Code Normalization

Purpose: work with a single consistent IATA airline code format. Some airlines use 2-letter and others 3-letter codes in their NDC APIs (e.g. UA sends `UAD` as OwnerCode). The feature converts all airline codes to the **2-letter format**.

Scope of this release: **United Airlines (UA)**, **Brussels Airlines (SN)**, **Swiss International Airlines (LX)**.

| Code before change | Code after change |
|---|---|
| UAD | UA |
| SNA | SN |
| LXA | LX |

- Changes apply to **all flows (requests and responses)**.
- Codes replaced in the fields **OwnerCode**, **OwnerName** and **AirlineDesigCode** in all web services.
- Affected web services: Fare_MasterPricerTravelBoardSearch, Travel_OfferPrice, Travel_OrderCreate, Travel_OrderRetrieve, Travel_OrderCancel, Travel_OrderPay, Travel_OrderChange, Travel_SeatAvailability, Travel_ServiceList.

## Post Implementation

During the web services implementation project, Amadeus certifies 1 or 2 carriers from different providers. To receive content from new airlines (subject to availability in Amadeus Travel Platform and any required private airline agreement), contact the Account Manager to enable content in both production and test environments.

Recommended steps before going live with additional carriers:

1. Run different standard scenarios (e.g. the test cases used for web services certification).
2. Validate the end-to-end flow with the new provider. Provider-specific adaptations may be needed — see "Normalization Differences per Provider".
3. On validation failure, adapt the flow yourself or request support from the API consulting team (via Account Manager).

Guidelines when testing in production:

1. Cancel any bookings immediately.
2. Avoid booking during high season travel (varies per country).
3. Do not use fictitious names (e.g. "Adult" last name, movie/TV character names).
4. If paying by credit card, only **valid real credit cards** can be used; funds may be held, release timing depends on the financial institution.

## Normalization Differences per Provider

- Document detailing differences between NDC providers is published on the Amadeus for Developers Portal, **quarterly**, within each NDC API: https://developers.amadeus.com/

## Product Release Notes

- Published on Amadeus Service Hub: NDC Aggregator Program Release Notes — https://servicehub.amadeus.com/c/portal/view-solution/988978314/new-distribution-capability-ndc-ndc-x-aggregator-program-release-notes
- Subscribe to the page to be notified of new release notes.

## Limitations

- **Known limitation on airline profile:** some airline profiles do not support specific **airport-to-airport** routes, producing the error `QUERY NOT PROCESSABLE: NO ELIGIBLE NDC PROVIDER`. Occurs when the airline's NDC configuration does not recognize certain point-to-point airport codes. **Workaround: perform searches using city codes instead of airport codes.**
- Most commonly observed with carriers having restricted NDC coverage for regional or secondary airports. Affected routes/airlines vary by the airline's NDC implementation and commercial agreements.

## NDC Product Interoperability

- For interoperability with Amadeus products, discuss with the Account Manager.
- URL: https://servicehub.amadeus.com/c/portal/view-solution/970709152/ndc-product-interoperability
- (diagram in source: travel seller interoperability overview.)

## Training

- Customers with Amadeus Service Hub access can enroll in Web Developer Technical Deep Dive videos covering: Prime Booking, Voids and Refunds, Ancillaries and Seats, Voluntary Fare Driven and Schedule Driven Exchanges, Involuntary Acceptance flows.
- Amadeus Learning Universe — Travel APIs for NDC: https://learning-universe.amadeus.com/group/lms-central-learning/learning-paths?p_p_id=com_arcusys_valamis_learningpath_portlets_LearningPathsPortlet&p_p_lifecycle=0&p_p_state=maximized&p_p_mode=view&p_p_auth=Fmm8FZAT&_com_arcusys_valamis_learningpath_portlets_LearningPathsPortlet_learning_path_id=10001406

## Process Flows

All flows are sent as **stateless sessions**.

- **Prime Booking Flow** — (diagram in source: end-to-end shop → price → order → pay sequence; step detail in the "Prime Booking Detailed Example / NDCX prime booking Flow – How to Shop, Price, Book and Pay" section, outside this range.)
- **Void and Refunds** — (diagram in source: void/refund process flow.)
- **Payment Failure** — applies to **all carriers**, with or without addition of ancillary/seats. **If payment is re-submitted, the customer will not be double charged.** (diagram in source: payment failure process flow.)

## Gotchas

- MPT 18.1 in production is a hard gate; and upgrading MPT version silently returns **no NDC content** unless the internal redirection configuration is also done by Amadeus.
- SOAP Header 4.0 is mandatory — older headers will not work for NDC.
- Emirates PTL at pricing is absent and at OrderCreate is a **placeholder default**; do not trust `OrderViewRS` PTL. Wait 30s–5m for the OrderChangeNotification / re-retrieve the Order or process the queue.
- UA/SN/LX send 3-letter codes (UAD/SNA/LXA) natively; only OwnerCode, OwnerName and AirlineDesigCode are normalized to 2 letters — do not hardcode 3-letter handling.
- `QUERY NOT PROCESSABLE: NO ELIGIBLE NDC PROVIDER` has at least two distinct causes: AA + infant in the request, and airport-code routes unsupported by the airline profile (retry with city codes).
- Commission cannot be added (no FM10 equivalent); commission is read-only, returned by carriers that support it.
- Delegation across Office IDs / IATA numbers requires prior airline enablement and fare loading, otherwise cross-office transactions fail.
- APPLY AMENITIES and GENERATE MINI RULES are **chargeable** data profiles; FARE FAMILY INFO returns brand codes only for AA, LH, UA (name only for others).
- Exceeding the 1000:1 look-to-book ratio can get NDC content restricted by carriers.
- Production testing rules: real credit cards only, no fictitious names, cancel test bookings immediately.
