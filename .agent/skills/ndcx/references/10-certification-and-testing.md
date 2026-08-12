# Certification and Testing

> Source: WBS Implementation Guide NDC[X] v1.5 + Ancillaries/Seats/Servicing v1.2, Certification Checklist sections

## Requirement levels

- **Mandatory**: Your application must implement this item to move to Production.
- **Recommended**: It is strongly recommended that the item be implemented. Not doing so could put your application at risk. Your application may move to Production even if the item is not implemented.
- **Comment**: Item to be taken into consideration. Your application may move to Production even if the item is not implemented.

If one of the mandatory elements is not implemented or corrected, the application will not be permitted in the Amadeus production environment.

## Test Case Scenarios

Rules (identical in both guides):

- Test cases should include **2 Pax + 1 Child + 1 Infant Search** (*exception: AA does not allow infants*). If the agency does not support children or infants they can be excluded from the test case.
- Individual test cases listed below are **not needed for each functionality** — one "complex" test case may cover several features.

What counts as a complex test case (worked examples from the two guides):

- Prime Booking guide: if the application will include Upsell, Chargeable Seats Post Booking, Paid Bags Post Booking and Voids / Refunds, then **2 complex test cases** will meet this certification requirement.
- Ancillaries/Seats/Servicing guide: if the application will include Chargeable Seats Post Booking, Paid Bags Post Booking and will also support voluntary exchanges as well as involuntary disruptions, then **3 complex test cases** will meet this certification requirement.

### Complex test case templates — Refunds / Voids (Prime Booking guide)

| Refunds | Voids |
| --- | --- |
| 2 adults + 1 child + 1 infant | 2 adults + 1 child + 1 infant |
| USA to any country with connecting flight (*this will meet the TSA requirement*) | Any city |
| Roundtrip | Roundtrip |
| Upsell to 1st class | Pay for the order |
| Add Chargeable Seats | Proceed with the void |
| Add Chargeable Bags | |
| Pay for the order | |
| **Wait 2 days** after void period to proceed with the refund | |

### Complex test case templates — Ancillaries / Exchanges / Involuntary (Servicing guide)

| Add Ancilaries / Seats / Exchange Flights | Involuntary Disruptions — Accept | Involuntary Disruptions Exchanges |
| --- | --- | --- |
| 2 adults + 1 child + 1 infant | 2 adults + 1 child + 1 infant | 2 adults + 1 child + 1 infant |
| USA to any country with a connecting flight (*this will meet the TSA requirement*) | Any city | Any city |
| Roundtrip | Roundtrip | Roundtrip |
| Add Chargeable Seats | Pay for the order | Pay for the order |
| Add Chargeable Bags | PNR Disrupted | PNR Disrupted |
| Pay for the order | Accept | Exchange for new flights |
| Exchange the Flight (*Note ancillary and seats may not be rebooked*) | | |

### Example Test Case Scenarios — Prime Booking guide

- Domestic Booking with UPSELL
- International Booking with Connecting Flight
- Vueling (VY) — 2 Adults + 1 Child + 1 Infant — Roundtrip
- Cancel and Refund a Paid Order
- Retain Credit for future use
- Full Voluntary Cancellation of a Paid Order During the Void Period
- Create Booking with OB Fee Surcharges
- AF/KL — 2 Adults — Roundtrip — SAF bundle

### Example Test Case Scenarios — Ancillaries/Seats/Servicing guide

These scenarios vary depending on the customer requirements.

- Schedule Driven Voluntary Exchange with Price Difference
- Fare Driven Voluntary Exchange
- Add Chargeable Seat(s) During Shopping Flow
- Add Chargeable Seat(s) Post Booking — Deferred Payment
- Add Chargeable Seat(s) Post Booking — Instant Payment
- Add Chargeable Seat(s) for Air France with 2nd Offer Price - Post Booking — Instant Payment
- Add Paid Bag(s) During Shopping Flow
- Add Paid Bag(s) Post Booking — Deferred Payment
- Add Paid Bag(s) Post Booking — Instant Payment
- Add Paid Bag(s) for Air France with 2nd Offer Price - Post Booking — Instant Payment
- Add Paid Bag(s) for Singapore Airlines where bag is in "KG". A 2nd Offer Price - Post Booking — Instant Payment
- Involuntary Schedule Change — Acceptance Flow. Please refer to Features per Airline on who supports this feature. Disruptions will be performed on the test environment. *Minimum version is Travel_Management Interface v1.10 to perform this flow.*
  - Maximum 2 PNRs for AA — **Waiver Code = SKCHG**
  - Maximum 2 PNRS for QF
  - Maximum 2 PNR for Altea
  - Maximum 2 PNR for BA/IB
  - Maximum 2 PNR for AF/KL
- Involuntary Exchanges — Disruptions will be performed on the test environment. *Minimum version is Travel_Management Interface v1.10 to perform this flow.*
  - AA — **Waiver Code = SKCHG**
  - QF — **Waiver code to use = QFSKEDCHG**
- Involuntary Cancellations — not required if already certified with voids (paid orders) / refunds.

# Certification Checklist

## American Airlines Flights

Cities to test: <https://servicehub.amadeus.com/c/portal/view-solution/310378586/en_US/american-airlines-aa-flight-list-for-use-in-test-for-ndc>
(Prime Booking guide only.)

## General

Identical in both guides.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| GEN-01 | ALL | The NDC Services implemented should not be flagged as deprecated. | **Mandatory** |
| GEN-02 | ALL | The application must not create infinite loop(s) in the Amadeus host. | **Mandatory** |
| GEN-03 | ALL | Application should properly read the NDC response | **Mandatory** |
| GEN-04 | ALL | Unnecessary or redundant transactions must be avoided. | **Recommended** |
| GEN-05 | ALL | Structured messages must be used when available. | **Recommended** |
| GEN-06 | ALL | Development of the application must only be performed against your Dedicated Test Access. It should not be performed against the POC Test Access. | **Mandatory** |

## Session Management

Merged. SEM-01 and SEM-02 identical in both guides; SEM-03 appears **only in the Prime Booking guide** (discrepancy: the Ancillaries/Seats/Servicing guide's table stops at SEM-02).

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| SEM-01 | ALL | For session header 4.0, use a stateless session to send if not using legacy API | **Mandatory** |
| SEM-02 | ALL | For session header 4.0, when using legacy APIS (PNR_AddMultiElements) stateful session is required | **Mandatory** |
| SEM-03 | ALL | If working in a stateful session, any updates to an order or Amadeus PNR must be committed prior to sending the subsequent calls. (Prime Booking guide only) | **Mandatory** |

## Error Management

Identical in both guides.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| ERR-01 | ALL | Error Handling must be properly implemented | **Mandatory** |
| ERR-02 | ALL | Data formats and values must be checked and validated before sending the request. The application must detect invalid data and return an error to the end-user without sending the request. | **Mandatory** |
| ERR-03 | ALL | Date handling must be correct: the application must detect invalid or out of sequence dates and return an error to the end-user without sending the request. | **Mandatory** |
| ERR-04 | ALL | Duplicate bookings must not be created. On Web-based applications, it must be impossible to go back from the booking confirmation page and book the same itinerary again. | **Mandatory** |
| ERR-05 | ALL | The application must be able to recognize the difference between Advisory error messages and Warning error messages. | **Mandatory** |
| ERR-06 | ALL | Common errors messages returned from Amadeus should be able to be interpreted by the application. | **Mandatory** |

## Shopping

Prime Booking guide only.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Shopping_01 | Fare_MasterPricerTravelBoardSearch 18.1 or higher | Each recommendation from Fare_MasterPricerTravelBoardSearch is single source (GDS or NDC) and flagged | **Mandatory** |
| Shopping_02 | Fare_MasterPricerTravelBoardSearch 18.1 or higher | For session header 4.0, use a stateless session to send the Fare_MasterPricerTravelBoardSearch | **Mandatory** |
| Shopping_03 | Fare_MasterPricerTravelBoardSearch | If **NDC Only** tag is in the input. Ensure the correct value "100" is included. | **Mandatory** |
| Shopping_04 | Fare_MasterPricerTravelBoardSearch | If Corporate Fares are requested, the corporate code must be included in the request. Corporate code is not mandatory for corporate fare search for NDC content, as explained in section 4.2.1.7 CLID (corporate fare can be triggered by CLID for some NDC airlines). | **Mandatory** |
| Shopping_05 | Fare_MasterPricerTravelBoardSearch | Air France/KLM specific for OTAs only — priceType "RU" should not be sent in the shopping request. | **Mandatory** |
| Shopping_06 | Fare_MasterPricerTravelBoardSearch | For Child Pax, CNN must be used over CHD | **Mandatory** |

## Price

Prime Booking guide only.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Offer_01 | Travel_OfferPrice | TravelOfferPriceRQ sent to Amadeus Aggregator with OfferID, OfferItemID and Owner Code details for each passenger type | **Mandatory** |
| Offer_02 | Travel_OfferPrice | Fare_MasterpricerTravelBoard Search is a mandatory step before Travel_OfferPrice | **Mandatory** |
| Offer_03 | Travel_OfferPrice | Correct number of PTCs should match as requested in the Fare_MasterPricer TravelBoard Search. For example, if an IIT fare is returned at shopping time, then this PTC type should be used at OfferPrice. (diagram in source: screenshot of a program showing the PTC types matched between shopping and OfferPrice) | **Mandatory** |
| Offer_04 | Travel_OfferPrice | Shopping Response needs to be included in the request | **Mandatory** |
| Offer_05 | Travel_OfferPrice | Infant reference ID is associated to an adult | **Mandatory** |
| Offer_06 | Travel_OfferPrice | UPSELL element is sent correctly along with the proper elements as addressesed in ID Offer_01 through Offer_06 | **Mandatory** |
| Offer_07 | Travel_OfferPrice | Ensure correct value is included when the selected offer for bags is in weight ("kg"). This is returned in the Travel_Servicelist response. | **Mandatory** |
| Offer_08 | Travel_OfferPrice | For **Vueling**, Travel_OfferPrice request sent to Amadeus Aggregator with OfferID, OfferItemID and Owner Code. For round-trip use cases, include other OfferItemID for each PTC type and PER BOUND. | **Mandatory** |
| Offer_09 | Travel_OfferPrice | For SAF bundles, all offerItemIDs per pax and per bound must be included in the request | **Mandatory** |

## Create

Merged. Create_01 to Create_09 present in both guides; Create_10 appears **only in the Prime Booking guide**. Discrepancy on Create_02 wording: Prime Booking guide says "TravelOfferPrice is a mandatory step before TravelOrderCreate"; Servicing guide says "Travel_OfferPrice is a mandatory step before Travel_OrderCreate" (same requirement, different spelling).

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Create_01 | Travel_OrderCreate | Correct number of PTCs are included | **Mandatory** |
| Create_02 | Travel_OrderCreate | TravelOfferPrice is a mandatory step before TravelOrderCreate / Travel_OfferPrice is a mandatory step before Travel_OrderCreate | **Mandatory** |
| Create_03 | Travel_OrderCreate | Infant age or Date of Birth must be specified in the name of the INF for correct automatic creation of the SSR INFT. | **Mandatory** |
| Create_04 | Travel_OrderCreate | In Travel_OfferPrice response, under *AMA_TravelOfferPriceRS/Response/DataLists/PaxSegmentList/PaxSegment/SecureFlightInd* — If the value is **True**, passenger gender and date of birth information are mandatory in Travel_OrderCreate. If missing, the booking cannot be completed, and the process must be restarted all over again from shopping. | **Mandatory** |
| Create_05 | Travel_OrderCreate | If UPSELLING is selected, the updated shopping response, OfferID, OfferItemIDs are included in the request | **Mandatory** |
| Create_06 | Travel_OrderCreate | Contact e-mail address is included | **Mandatory** |
| Create_07 | Travel_OrderCreate | Correct airline is included in the selected offer | **Mandatory** |
| Create_08 | Travel_OrderCreate | Duplicate names must include a Title or Middle Initial. This applies to FLX carriers. | **Mandatory** |
| Create_09 | Travel_OrderCreate | For **Vueling** - Correct number of PTCs are included along with each offerItemID per bound. | **Mandatory** |
| Create_10 | Travel_OrderCreate | For SAF bundles, all offerItemIDs per pax and per bound must be included in the request (Prime Booking guide only) | **Mandatory** |

## Payment

Identical in both guides.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Payment_01 | Travel_OrderPay | Payment must be the full value of the trip total amount | **Mandatory** |
| Payment_02 | Travel_OrderPay | Travel_OrderCreate is a mandatory step before Travel_OrderPay (*only for booking creation) | **Mandatory** |
| Payment_03 | Travel_OrderPay | Valid currency code | **Mandatory** |
| Payment_04 | Travel_OrderPay | Cash Indicator is included for cash payments | **Mandatory** |
| Payment_05 | Travel_OrderPay | Valid Payment Type Code is sent (i.e. Cash for a CC payment is incorrect) | **Mandatory** |
| Payment_06 | Travel_OrderPay | OrderID and Owner Code is referenced to the passenger for which issuance is requested | **Mandatory** |
| Payment_07 | Travel_OrderPay | No multiple forms of payment are sent | **Mandatory** |
| Payment_08 | Travel_OrderPay | Decimal points must be sent for the full amount. For example, 768.52 | **Mandatory** |
| Payment_09 | Travel_OrderPay | For **Vueling**, credit card payment is required. | **Mandatory** |

## Travel Order Retrieve

Identical in both guides.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Retrieve_01 | Travel_OrderRetrieve | OrderID and Owner Code must be included in the request | **Mandatory** |

## OB Fees

Prime Booking guide only.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| OB Fees_01 | Travel_OfferPrice | Credit card bin number must be sent in the pricing call to get the airline OB Fees surcharges | **Mandatory** |

## Full Voluntary Cancellation of a Paid Order

Prime Booking guide only.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Cancel_01 | Travel_OrderRetrieve | Valid order ID must be retrieved | **Recommended** |
| Cancel_02 | Travel_OrderReshop | Query sent to review the fare conditions. Fare conditions are only returned on this step. DeleteOrderItem is sent for each traveler | **Mandatory** |
| Cancel_03 | Travel_OrderCancel | Order ID and Owner Code is required | **Mandatory** |
| Cancel_04 | Travel_OrderReshop | For FLX carriers only — ReshopParameters section is labeled as AutoExchRequestInd="false" | **Mandatory** |
| Cancel_05 | Travel_OrderCancel | Include CarrierCreditInd to ensure the credit is retained. This applies to the Retain Credit Feature | **Mandatory** |

## Schedule Driven Voluntary Exchange

Ancillaries/Seats/Servicing guide only. (Note: the source table has no Schedule Driven_06; IDs 09 and 10 are written without an underscore.)

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Schedule Driven_01 | Travel_OrderRetrieve | Travel_OrderRetrieve must be sent prior to Air_MultiAvailability or other shopping request | **Recommended** |
| Schedule Driven_02 | Air_MultiAvailability or other search shopping request | Air_MultiAvailability or other search shopping request must be sent to find alternative flight schedule, classes, flight number prior to Travel_OrderReshop | **Recommended** |
| Schedule Driven_03 | Travel_OrderReshop | Travel_OrderReshop must be sent prior to Travel_OrderChange. For QF only — ReshopParameters section is labeled as AutoExchRequestInd="true" | **Mandatory** |
| Schedule Driven_04 | Travel_OrderReshop | Ensure the services retained are included for the unchanged flights. | **Mandatory** |
| Schedule Driven_05 | Travel_OrderRetrieve, Travel_OrderReshop, Travel_OrderPay | Order ID and Owner Code is required | **Mandatory** |
| Schedule Driven_07 | Travel_OrderReshop | Order Item Reference to delete must be sent | **Mandatory** |
| Schedule Driven_08 | Travel_OrderChange | OfferID, Owner Code, Shopping Response, Offer Item Reference sent for each PTC code as returned in the Travel_OrderReshop | **Mandatory** |
| Schedule Driven 09 | Travel_OrderPay | Travel_OrderPay must be sent to finalize the Voluntary Change | **Mandatory** |
| Schedule Driven 10 | Travel_OrderPay | Ensure mandatory criteria are met under the Payment checklist | **Mandatory** |

## Fare Driven Voluntary Exchange

Ancillaries/Seats/Servicing guide only.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Fare Driven_01 | Travel_OrderRetrieve | Travel_OrderRetrieve must be sent prior to Travel_OrderReshop | **Recommended** |
| Fare Driven_02 | Travel_OrderReshop | Travel_OrderReshop must be sent to find alternative flights offers prior to the 2nd Travel_OrderReshop. This section is required for -- Accelya (FareLogix) only — ReshopParameters section is labeled as AutoExchRequestInd="true" | **Mandatory** |
| Fare Driven_03 | Travel_OrderReshop | 1st OrderReshop - Ensure the services retained are included for the unchanged flights. | **Mandatory** |
| Fare Driven_04 | Travel_OrderReshop | 2nd Travel_OrderReshop price the selected offer as returned in the 1st Travel_OrderReshop | **Mandatory** |
| Fare Driven_05 | Travel_OrderReshop | Travel_OrderReshop must be sent prior to Travel_OrderChange | **Mandatory** |
| Fare Driven_06 | Travel_OrderRetrieve, Travel_OrderReshop, Travel_OrderChange | Order ID and Owner Code is required | **Mandatory** |
| Fare Driven_07 | Travel_OrderReshop | Order Item Reference to delete must be sent | **Mandatory** |
| Fare Driven_08 | Travel_OrderChange | OfferID, Owner Code, Shopping Response, Offer Item Reference sent for each PTC code as returned in the Travel_OrderReshop | **Mandatory** |
| Fare Driven_09 | Travel_OrderChange | Payment Info must be included in the request along with the selected offer | **Mandatory** |

## Chargeable Seats

Ancillaries/Seats/Servicing guide only.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Seat_01 | Travel_SeatAvailability | Searching for seats during the shopping flow should be sent after the Travel_OfferPrice. | **Recommended** |
| Seat 02 | Travel_OrderChange | Adding seats after Travel_OrderCreate requires Travel_OrderChange to be sent after Travel_OrderCreate | **Mandatory** |
| Seat_03 | Travel_SeatAvailability | Adding seats post booking requires an Order ID, Owner Code and PTC information. | **Mandatory** |
| Seat 04 | Travel_SeatAvailability | If "OFP" value is returned, a 2nd Travel_OfferPrice is required before Travel_OrderCreate or Travel_OrderChange | **Mandatory** |

## Chargeable Ancillaries

Ancillaries/Seats/Servicing guide only.

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Ancillary_01 | Travel_ServiceList | Searching for ancillary during the shopping flow should be sent after the Travel_OfferPrice. | **Recommended** |
| Ancillary_02 | Travel_OrderChange | Adding ancillaries after Travel_OrderCreate requires Travel_OrderChange to be sent after Travel_OrderCreate | **Mandatory** |
| Ancillary_03 | Travel_ServiceList | Adding ancillaries post booking requires an Order ID, Owner Code and PTC information. | **Mandatory** |
| Ancillary_04 | Travel_ServiceList | Order ID and Owner Code is required | **Mandatory** |
| Ancillary_05 | Travel_ServiceList | If "kg" value is returned, a 2nd Travel_OfferPrice is required before Travel_OrderCreate or Travel_OrderChange | **Mandatory** |
| Ancillary_06 | Travel_ServiceList | If "OFP" value is returned, a 2nd Travel_OfferPrice is required before Travel_OrderCreate or Travel_OrderChange | **Mandatory** |

## Involuntary Acceptance

Ancillaries/Seats/Servicing guide only. Please refer to the features per airline spreadsheet to see which carriers support this flow. *Minimum version is Travel_Management Interface v1.10 to perform this flow.* (Note: the source uses the ID `Invol_Acceptance_04` twice — for the waiver code row and the PNR_Retrieve row.)

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Invol_Acceptance_01 | Travel_OrderChange | OrderItemRefID must be included for each PAX | **Mandatory** |
| Invol_Acceptance_02 | Travel_OrderChange | OrderID and Owner code required | **Mandatory** |
| Invol_Acceptance_03 | Travel_OrderChange | Pax details required (PaxID, PTC, Pax name) | **Mandatory** |
| Invol_Acceptance_04 | Travel_OrderChange | Include Fare Waiver Code (if required by carrier). See example test case scenarios section for waiver code. | **Mandatory** |
| Invol_Acceptance_04 | PNR_Retrieve | Retrieve NDC order by PNR Record Locator | **Recommended** |

## Involuntary Exchange

Ancillaries/Seats/Servicing guide only. Flight disruptions are subject to Altea NDC carriers and QF. Please refer to the features per airline spreadsheet to see which carriers support this flow. *Minimum version is Travel_Management Interface v1.10 to perform this flow.*

| ID | Service(s) | Criteria | Level |
| --- | --- | --- | --- |
| Invol_Exchange_01 | Travel_OrderRetrieve | Travel_OrderRetrieve must be sent prior to Air_MultiAvailability or other shopping request | **Recommended** |
| Invol_Exchange_02 | Air_MultiAvailability or other search shopping request | Air_MultiAvailability or other search shopping request must be sent to find alternative flight schedule, classes, flight number prior to Travel_OrderReshop | **Recommended** |
| Invol_Exchange_03 | Travel_OrderReshop | Travel_OrderReshop must be sent prior to Travel_OrderChange. For FLX only — ReshopParameters section is labeled as AutoExchRequestInd="true" | **Mandatory** |
| Invol_Exchange_04 | Travel_OrderRetrieve, Travel_OrderReshop, Travel_OrderChange | Order ID and Owner Code is required | **Mandatory** |
| Invol_Exchange_05 | Travel_OrderReshop | Order Item Reference to delete must be sent. RetainServiceID (if applicable) is included | **Mandatory** |
| Invol_Exchange_06 | Travel_OrderReshop | Include Fare Waiver Code (if required by carrier). See example test case scenarios section for waiver code. | **Mandatory** |
| Invol_Exchange_07 | Travel_OrderChange | OfferID, Owner Code, Shopping Response, Offer Item Reference sent for each PTC code as returned in the Travel_OrderReshop. | **Mandatory** |

## Pre-submission checklist

Every Mandatory item, phrased for verification. Items only apply where the corresponding flow is in scope.

General / session / errors
- [ ] GEN-01: No implemented NDC service is flagged as deprecated.
- [ ] GEN-02: No code path can loop indefinitely against the Amadeus host.
- [ ] GEN-03: NDC responses are parsed correctly (all consumed fields read from the right paths).
- [ ] GEN-06: All development and testing ran against the Dedicated Test Access, not the POC Test Access.
- [ ] SEM-01: Stateless session used with session header 4.0 when no legacy API is involved.
- [ ] SEM-02: Stateful session used with session header 4.0 when calling legacy APIs (PNR_AddMultiElements).
- [ ] SEM-03: In a stateful session, order/PNR updates are committed before subsequent calls.
- [ ] ERR-01: Error handling implemented on every service call.
- [ ] ERR-02: Data formats/values validated client-side; invalid data returns an error to the end user without sending the request.
- [ ] ERR-03: Invalid or out-of-sequence dates are rejected client-side without sending the request.
- [ ] ERR-04: Duplicate bookings prevented; browser back from confirmation cannot rebook the same itinerary.
- [ ] ERR-05: Application distinguishes Advisory from Warning error messages.
- [ ] ERR-06: Common Amadeus error messages are interpreted by the application.

Shopping
- [ ] Shopping_01: Each Fare_MasterPricerTravelBoardSearch recommendation (18.1 or higher) is single-source (GDS or NDC) and flagged.
- [ ] Shopping_02: Fare_MasterPricerTravelBoardSearch is sent in a stateless session with session header 4.0.
- [ ] Shopping_03: When the NDC Only tag is sent, its value is "100".
- [ ] Shopping_04: Corporate code sent when corporate fares are requested (not mandatory for NDC content — CLID per section 4.2.1.7 can trigger it).
- [ ] Shopping_05: For AF/KL OTAs, priceType "RU" is never sent in the shopping request.
- [ ] Shopping_06: Child PTC sent as CNN, not CHD.

Price
- [ ] Offer_01: TravelOfferPriceRQ carries OfferID, OfferItemID and Owner Code for each passenger type.
- [ ] Offer_02: Fare_MasterPricerTravelBoardSearch always precedes Travel_OfferPrice.
- [ ] Offer_03: PTC count/types at OfferPrice match those requested at shopping (e.g. IIT fare returned → IIT PTC used).
- [ ] Offer_04: Shopping Response is included in the Travel_OfferPrice request.
- [ ] Offer_05: Infant reference ID is associated to an adult.
- [ ] Offer_06: UPSELL element sent with all elements required by Offer_01 through Offer_06.
- [ ] Offer_07: Correct value sent when the selected bag offer is in weight ("kg") as returned in Travel_ServiceList.
- [ ] Offer_08: Vueling — OfferID, OfferItemID, Owner Code sent; round-trip includes an OfferItemID per PTC type and per bound.
- [ ] Offer_09: SAF bundles — all offerItemIDs per pax and per bound included.

Create
- [ ] Create_01: Correct number of PTCs included.
- [ ] Create_02: Travel_OfferPrice always precedes Travel_OrderCreate.
- [ ] Create_03: Infant age or DOB specified in the INF name so SSR INFT is created automatically.
- [ ] Create_04: When SecureFlightInd is True in the Travel_OfferPrice response, gender and DOB are sent in Travel_OrderCreate.
- [ ] Create_05: On upsell, updated shopping response, OfferID and OfferItemIDs are included.
- [ ] Create_06: Contact e-mail address included.
- [ ] Create_07: Correct airline included in the selected offer.
- [ ] Create_08: Duplicate names include a Title or Middle Initial (FLX carriers).
- [ ] Create_09: Vueling — correct PTC count plus each offerItemID per bound.
- [ ] Create_10: SAF bundles — all offerItemIDs per pax and per bound included.

Payment / retrieve / OB fees
- [ ] Payment_01: Payment equals the full trip total amount.
- [ ] Payment_02: Travel_OrderCreate precedes Travel_OrderPay (booking creation only).
- [ ] Payment_03: Valid currency code sent.
- [ ] Payment_04: Cash Indicator included for cash payments.
- [ ] Payment_05: Payment Type Code matches the actual instrument (no Cash for a credit card payment).
- [ ] Payment_06: OrderID and Owner Code reference the passenger for whom issuance is requested.
- [ ] Payment_07: Only one form of payment sent.
- [ ] Payment_08: Amount sent with decimal points (e.g. 768.52).
- [ ] Payment_09: Vueling — credit card payment used.
- [ ] Retrieve_01: OrderID and Owner Code included in Travel_OrderRetrieve.
- [ ] OB Fees_01: Credit card BIN sent in the pricing call to obtain airline OB Fee surcharges.

Full voluntary cancellation of a paid order
- [ ] Cancel_02: Travel_OrderReshop sent to review fare conditions (only returned at this step) with DeleteOrderItem per traveler.
- [ ] Cancel_03: Order ID and Owner Code sent in Travel_OrderCancel.
- [ ] Cancel_04: FLX carriers — ReshopParameters uses AutoExchRequestInd="false".
- [ ] Cancel_05: CarrierCreditInd included when retaining credit (Retain Credit feature).

Schedule driven voluntary exchange
- [ ] Schedule Driven_03: Travel_OrderReshop precedes Travel_OrderChange; QF only uses AutoExchRequestInd="true".
- [ ] Schedule Driven_04: Retained services included for unchanged flights.
- [ ] Schedule Driven_05: Order ID and Owner Code sent on Travel_OrderRetrieve, Travel_OrderReshop and Travel_OrderPay.
- [ ] Schedule Driven_07: Order Item Reference to delete is sent.
- [ ] Schedule Driven_08: Travel_OrderChange sends OfferID, Owner Code, Shopping Response and Offer Item Reference per PTC as returned by Travel_OrderReshop.
- [ ] Schedule Driven 09: Travel_OrderPay sent to finalize the voluntary change.
- [ ] Schedule Driven 10: Payment checklist mandatory criteria met.

Fare driven voluntary exchange
- [ ] Fare Driven_02: 1st Travel_OrderReshop finds alternative flight offers before the 2nd; Accelya (FareLogix) only uses AutoExchRequestInd="true".
- [ ] Fare Driven_03: 1st OrderReshop includes retained services for unchanged flights.
- [ ] Fare Driven_04: 2nd Travel_OrderReshop prices the offer selected from the 1st.
- [ ] Fare Driven_05: Travel_OrderReshop precedes Travel_OrderChange.
- [ ] Fare Driven_06: Order ID and Owner Code sent on Travel_OrderRetrieve, Travel_OrderReshop and Travel_OrderChange.
- [ ] Fare Driven_07: Order Item Reference to delete is sent.
- [ ] Fare Driven_08: Travel_OrderChange sends OfferID, Owner Code, Shopping Response and Offer Item Reference per PTC as returned by Travel_OrderReshop.
- [ ] Fare Driven_09: Payment Info included in Travel_OrderChange along with the selected offer.

Chargeable seats and ancillaries
- [ ] Seat 02: Travel_OrderChange sent after Travel_OrderCreate when adding seats post-create.
- [ ] Seat_03: Post-booking seat search sends Order ID, Owner Code and PTC information.
- [ ] Seat 04: On "OFP" value, a 2nd Travel_OfferPrice runs before Travel_OrderCreate/Travel_OrderChange.
- [ ] Ancillary_02: Travel_OrderChange sent after Travel_OrderCreate when adding ancillaries post-create.
- [ ] Ancillary_03: Post-booking ancillary search sends Order ID, Owner Code and PTC information.
- [ ] Ancillary_04: Order ID and Owner Code sent on Travel_ServiceList.
- [ ] Ancillary_05: On "kg" value, a 2nd Travel_OfferPrice runs before Travel_OrderCreate/Travel_OrderChange.
- [ ] Ancillary_06: On "OFP" value, a 2nd Travel_OfferPrice runs before Travel_OrderCreate/Travel_OrderChange.

Involuntary acceptance and exchange (Travel_Management Interface v1.10 minimum)
- [ ] Invol_Acceptance_01: OrderItemRefID included for each PAX in Travel_OrderChange.
- [ ] Invol_Acceptance_02: OrderID and Owner Code sent.
- [ ] Invol_Acceptance_03: Pax details sent (PaxID, PTC, Pax name).
- [ ] Invol_Acceptance_04: Fare Waiver Code included where the carrier requires it (AA = SKCHG).
- [ ] Invol_Exchange_03: Travel_OrderReshop precedes Travel_OrderChange; FLX only uses AutoExchRequestInd="true".
- [ ] Invol_Exchange_04: Order ID and Owner Code sent on Travel_OrderRetrieve, Travel_OrderReshop and Travel_OrderChange.
- [ ] Invol_Exchange_05: Order Item Reference to delete sent, with RetainServiceID where applicable.
- [ ] Invol_Exchange_06: Fare Waiver Code included where required (AA = SKCHG, QF = QFSKEDCHG).
- [ ] Invol_Exchange_07: Travel_OrderChange sends OfferID, Owner Code, Shopping Response and Offer Item Reference per PTC as returned by Travel_OrderReshop.
