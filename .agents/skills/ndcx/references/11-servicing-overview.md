# Servicing, Ancillaries and Seats — Scope, Setup Deltas and Process Flows

> Source: WBS Implementation Guide NDC[X] Ancillaries, Seats and Servicing v1.2, sections: Introduction, NDC flow scope, Baseline NDC Out of Scope, Pre-requisites, Training Videos, Delegation, Office ID Settings, Limitation, List of web services, Features per Airline, Post Implementation, Normalization Differences per Provider, Product Release Notes, NDC Product Interoperability, Travel API End-to-End Examples, Process Flows

This guide covers **ancillaries, seats, and servicing** only. The Prime Booking Flown guide (shop, price, order, pay, retrieve, voids/refunds) is a separate document — see sibling reference `01-setup-and-connectivity.md`.

Servicing scope = Voluntary Changes, Involuntary Acceptance, Involuntary Exchanges, Involuntary Cancellations. Availability of each flow is per-carrier; check the Features per Carrier spreadsheet.

NDC content distributed is under the responsibility of the NDC provider. It is made of shopping travel solutions aggregating Flight, Price and Services called Offers, referenced under a unique Offer Id.

## Deltas vs the Prime Booking guide

Only differences/additions relative to the Prime Booking setup material are listed here.

### Pre-requisites (additional)

| Item | Requirement |
|---|---|
| NDC content | Activated |
| Dedicated NDC verbs | Must be activated to *service* NDC content (see service table below) |
| Involuntary Acceptance + Involuntary Exchange in scope | **Minimum version Travel_Management v1.10 required** |
| SOAP Header | 4.0 |

### Web service versions for this guide

`Travel_Management` Interface **v1.14** (vs the v1.10 floor required specifically for involuntary flows).

| Service | Version |
|---|---|
| Travel_OfferPrice | 1.3 |
| Travel_OrderCreate | 1.7 |
| Travel_OrderRetrieve | 1.7 |
| Travel_OrderCancel | 1.0 |
| Travel_OrderPay | 1.7 |
| Travel_SeatAvailability | 1.0 |
| Travel_OrderChange | 1.9 |
| Travel_OrderReshop | 1.6 |
| Travel_ServiceList | 1.1 |

Non-Travel_* services required/optional:

| Service | Version | Notes |
|---|---|---|
| Air_MultiAvailability | 19.1 | required |
| PNR_Cancel | 17.1 or higher | optional — removes Amadeus local PNR elements |
| PNR_AddMultiElements | 17.1 or higher | optional |
| PNR_Retrieve | 17.1 or higher | optional |
| Queue_List | 11.1 | optional |
| Security_SignOut | 4.1 | optional |
| SalesReports_DisplayQueryReport | 22.2 | optional |
| SalesReports_DisplayTransactionReport | 22.2 | optional |
| Ticket_DisplayTST | 15.1 | optional |
| Ticket_DisplayTSMP | 13.1 | optional |

### Out of scope (servicing-specific baseline)

Out of scope for servicing NDC orders, possibly addressed in later phases:

- Edifact bookings
- Split Payments (a.k.a. Multiple forms of Payment)
- Servicing for groups (9+ passengers)
- Addition of flights to an Order including issued documents
- Any feature listed on the Features per Airline spreadsheet that is not supported by the carrier

### Limitation (servicing-specific)

- Avoid the **`"FROM_PNR"`** option for Exchanges. Exception path to be aware of: if the first exchange is a **Revalidation** and the second exchange is an **AddCollect** using `"FROM_PNR"`, the FOP is removed during the first revalidation. Consequently `"FROM_PNR"` cannot be used — credit card details must be included in the `Travel_OrderChange` for the second exchange.

### Office ID settings (unchanged from Prime Booking, restated essentials)

- Office ID must have a valid IATA number associated (check with account manager).
- OID configuration must allow ticket issuance (**AVN must not be None**).
- OID office profile must have a TA e-mail address.
- OID office profile must have a TA valid phone number.
- Sales Report requires office ID activation (requested by account manager).
- Data Profile Activation — account manager must request **MPT** and **ORC**:
  - **FAMILY UPSELL 3** — returns AF/KL SAF + Seat Bundles.
  - **FARE FAMILY INFO** — returns the brand fare name. Brand *code* returned only for **AA, LH, UA**.

### Delegation

Amadeus PNR security control (RP, EOS) is unchanged, but the airline sees the travel agency (Office ID and IATA number) performing each transaction. If delegation spans multiple Office IDs / IATA numbers for one NDC Order (e.g. booking in Office A / IATA 1, payment by Office B / IATA 2), contact the airlines to enable cross Office/IATA transactions and load fares accordingly. Features per Airline spreadsheet has additional detail.

### Carrier-specific note in this guide

| Carrier | Rule |
|---|---|
| **EK** (Emirates) | Supports Seats and Bags **after issuance only**, with **deferred payment** after validation of the service. Retrieve the record to update status; while status is **HN**, keep repeating the retrieve until **HK** is returned, then pay for the ancillary service. |
| **AA** | Following activation of Corporate Codes in the exchange flow, the **Airline Designator Code must be provided as input in Travel_OrderReshop**. |
| **UA** | Corporate account code from the prime booking flow is **not retained** for subsequent exchanges — it must be re-entered during exchanges. |

Amadeus does **not** validate whether the corporate code used during an exchange matches the one applied at original booking; only the airline verifies it.

### Reference URLs

| Resource | URL |
|---|---|
| Features per Airline spreadsheet | https://servicehub.amadeus.com/c/portal/view-solution/976155818 |
| NDC Aggregator Program Release Notes | https://servicehub.amadeus.com/c/portal/view-solution/988978314/new-distribution-capability-ndc-ndc-x-aggregator-program-release-notes |
| NDC Product Interoperability | https://servicehub.amadeus.com/c/portal/view-solution/970709152/ndc-product-interoperability |
| Normalization Differences per Provider (quarterly) | published within each NDC API at https://developers.amadeus.com/ |
| End-to-end examples (Ancillaries, Seats, Servicing) | https://developers.amadeus.com/enterprise/implementation-guides?page=1&count=10&filter=title,NDC%20WBS%20End%20to%20End%20Examples&sorting=title,asc |
| Training: Amadeus Learning Universe — Travel APIs for NDC | https://learning-universe.amadeus.com/group/lms-central-learning/learning-paths (learning_path_id=10001406) — topics: Prime Booking, Voids and Refunds, Ancillaries and Seats, Voluntary Fare Driven and Schedule Driven Exchanges, Involuntary Acceptance |

Per-service user guides (Servicing, Seats, Ancillaries):

| Guide | URL |
|---|---|
| Travel Order Cancel | https://developers.amadeus.com/functional-doc/2808 |
| Travel Order Change | https://developers.amadeus.com/functional-doc/2809 |
| Travel Order Reshop | https://developers.amadeus.com/functional-doc/2821 |
| Travel Seat Availability | https://developers.amadeus.com/functional-doc/2820 |
| Travel Service List | https://developers.amadeus.com/functional-doc/2802 |

Prime Booking guides (for cross-reference): MasterPricer TravelBoard Search https://developers.amadeus.com/functional-doc/581 · Travel Offer Price https://developers.amadeus.com/functional-doc/2783 · Travel Order Create https://developers.amadeus.com/functional-doc/2785 · Travel Order Pay https://developers.amadeus.com/functional-doc/2784 · Travel Order Retrieve https://developers.amadeus.com/functional-doc/2782

### Post-implementation / production testing rules

During the implementation project Amadeus certifies 1 or 2 carriers from different providers; validation of additional carriers is done by the agency and its dev team in production before launch.

Ancillary, Seats and Voluntary Exchanges — production test guidelines:
1. Cancel any bookings immediately.
2. Avoid booking seats during high season travel (varies per country).
3. Do not use fictitious names (adult last name, movie/TV character names, etc.).
4. If paying by credit card, only valid real credit cards may be used; funds may be held until the financial institution releases them.

Involuntary Acceptance / Cancellations / Exchanges: requesting flight disruptions in production for testing purposes is **prohibited**. Choose one carrier supporting the **fare driven** flow and a different carrier supporting the **schedule driven** flow for implementation-project testing (per Features per Airline spreadsheet). New carrier content after the project is requested via the Account Manager for both production and test.

Before going live with any carrier:
1. Run different standard scenarios (can reuse the web services certification test cases).
2. Validate the end-to-end flow with the new provider; provider-specific adaptations may be needed (see Normalization Differences per Provider).
3. On validation failure, adapt the flow yourself or request API team consultancy via the Account Manager.

## Process Flows

Global rules that apply to every flow below:

- **All flows are sent as stateless sessions.**
- The three seats/ancillaries flows (pre-booking, post-booking, post-issuance) are **generic**.
- `Travel_SeatAvailability` does **not** have to be sent before `Travel_ServiceList`.
- It is **not mandatory to send both** `Travel_SeatAvailability` and `Travel_ServiceList` to create an order, change an order, or add to the order post-ticketing. The two APIs are **independent of each other**.

In this guide each flow is rendered only as a diagram image; the notes below capture the textual facts and state what each diagram depicts. Do not treat unlabelled steps as authoritative.

### Ancillaries and Seats — Pre-Booking

1. Shopping/pricing produces the Offer (Prime Booking flow — see `01-setup-and-connectivity.md` / prime booking reference).
2. `Travel_SeatAvailability` — optional, returns seat map / seat offers for the Offer. Independent of step 3.
3. `Travel_ServiceList` — optional, returns ancillary service offers for the Offer. Independent of step 2.
4. `Travel_OrderCreate` — creates the Order including the selected seat and/or ancillary offer items.
5. `Travel_OrderPay` — pays for the Order (see Payment Failure flow for the retry path).

(diagram in source: full pre-booking sequence for seats and ancillaries, image12 — individual arrow labels are not legible in the converted source.)

### Ancillaries and Seats — Post Booking

Order already created and **not yet issued**; seats/ancillaries are added to the existing Order.

1. `Travel_OrderRetrieve` — retrieve the existing Order.
2. `Travel_SeatAvailability` and/or `Travel_ServiceList` — optional and independent; get seat/ancillary offers for the Order.
3. `Travel_OrderChange` — add the selected seat and/or ancillary offer items to the Order.
4. `Travel_OrderPay` — pay for the Order.

(diagram in source: post-booking add-to-order sequence, image13.)

### Ancillaries and Seats — Post Issuance

Explicit rule from the text: **`Travel_OrderChange` will require payment details for any chargeable seats or ancillary services selected.**

1. `Travel_OrderRetrieve` — retrieve the issued Order.
2. `Travel_SeatAvailability` and/or `Travel_ServiceList` — optional and independent.
3. `Travel_OrderChange` — add the seat/ancillary items **with payment details inline** (chargeable items).
4. For **EK** only: re-`Travel_OrderRetrieve` until service status flips **HN → HK**, then pay for the ancillary service (deferred payment).

(diagram in source: post-issuance add sequence, image14.)

### Exchange of Free Seats for Family Seating

(diagram in source: software-process diagram, image15 — exchanging previously assigned free seats for family-seating seats. No accompanying text in this section; step labels are not legible in the converted source.)

### Ancillary or Seats Payment Failure

Applies to **all carriers**. **If payment is re-submitted, the customer will not be double charged.**

Pre-Booking or Post Booking variant:
1. Payment call fails (`Travel_OrderPay`).
2. (diagram in source: image16 — decision/retry branch after the failed payment.)
3. Re-submit the payment; no double charge occurs.

Post Order Issuance variant:
1. `Travel_OrderChange` with payment details fails for the chargeable seat/ancillary.
2. (diagram in source: flowchart image17 — post-issuance retry branch.)
3. Re-submit; no double charge occurs.

### Split PNR

(diagram in source: image18 — Split PNR handling sequence. No accompanying text in this section; step labels are not legible in the converted source.)

### Involuntary Acceptance

Requires **Travel_Management v1.10 minimum**.

(diagram in source: image19 — involuntary acceptance sequence, i.e. accepting the airline-proposed reaccommodation on a disrupted Order. Step labels are not legible in the converted source; `Travel_OrderRetrieve` / `Travel_OrderChange` are the verbs enabled for this flow per the service list.)

### Involuntary Cancellation

(diagram in source: image20 — involuntary cancellation of a Travel Order. Step labels are not legible in the converted source; `Travel_OrderCancel_1.0` is the verb for cancellation.)

### Exchanges (Voluntary and Involuntary)

Text-level facts:

- The process flow is **identical** to the fare driven or schedule driven **voluntary** exchange, with two exceptions for involuntary:
  1. A **waiver code** may be required, depending on the carrier, to waive fees for the involuntary exchange.
  2. The **form of payment is needed** to proceed with the exchange — **including for zero amount exchanges**.
- **AA**: with Corporate Codes activated in the exchange flow, the **Airline Designator Code must be provided as input in `Travel_OrderReshop`**.
- **Fare preferences are not mandatory.**
- **UA**: the corporate account code from prime booking is not retained; re-enter the corporate code during exchanges.
- Amadeus does not validate the exchange corporate code against the booking corporate code; only the airline verifies it.
- Requires **Travel_Management v1.10 minimum** when involuntary exchanges are in scope.

Verb set involved: `Travel_OrderRetrieve` → `Travel_OrderReshop` (1.6) → `Travel_OrderChange` (1.9), with `Travel_OrderPay` / inline FOP as applicable.

Fare Driven: (diagram in source: image23 — fare driven exchange sequence.)

Schedule Driven: (diagram in source: image24 — schedule driven exchange sequence.)

Additional diagrams in this section: image21 (code screenshot showing `Travel_OrderReshop` corporate/Airline Designator Code input for AA) and image22 (UA corporate code re-entry).

## Gotchas

- `Travel_Management` **v1.14** is the interface version listed for this guide, but the hard floor for Involuntary Acceptance and Involuntary Exchange is **v1.10** — do not conflate the two numbers.
- Post-issuance seat/ancillary additions must carry payment details **inside `Travel_OrderChange`**; there is no separate pay step for chargeable items in that flow.
- `"FROM_PNR"` for exchanges: unusable in the Revalidation-then-AddCollect sequence because the first revalidation removes the FOP. Always send explicit credit card details in the second `Travel_OrderChange`.
- Payment retries after an ancillary/seat payment failure are safe on all carriers — no double charge — so implement retry rather than manual reconciliation.
- **EK** requires HN→HK polling via `Travel_OrderRetrieve` before paying, and supports seats/bags **only** after issuance.
- `Travel_SeatAvailability` and `Travel_ServiceList` are independent and both optional — never hard-code SeatAvailability-before-ServiceList ordering or require both.
- All servicing flows are **stateless** sessions; do not build stateful session assumptions.
- Split Payments (Multiple forms of Payment), 9+ passenger groups, adding flights to an issued Order, and Edifact bookings are all out of scope — no servicing support to code against.
- Never trigger flight disruptions in production to test involuntary flows; it is prohibited.
