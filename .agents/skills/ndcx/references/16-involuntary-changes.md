# Involuntary Changes

> Source: WBS Implementation Guide NDC[X] Ancillaries, Seats and Servicing v1.2, Involuntary Changes

Scope: disruption on the airline side → airline sends an **OrderChangeNotification (OCN)** to Amadeus → Amadeus PNR is synchronized, updated and queued. Three possible outcomes: **Involuntary Acceptance**, **Involuntary Cancellation**, **Involuntary Exchange**.

Prerequisites:
- **Minimum version: Travel_Management Interface v1.10** is required to perform Involuntary Acceptance and Involuntary Exchange flows (stated for both flows and in the API prerequisites: "If scope includes Involuntary Acceptance and Involuntary Exchange flows, the minimum version Travel_Management v1.10 is required").
- **Disruptions are performed/triggered by Amadeus on the test environment.** Requesting to perform flight disruptions in production for testing purposes is **prohibited**.
- Certification recommendation: pick one carrier supporting the **fare driven** flow and a different carrier supporting the **schedule driven** flow to test the involuntary use cases (see Features per Airline spreadsheet).

## Detecting a disruption

1. Airline sends OCN → Amadeus PNR updated and queued. The disrupted record lands on **queue 7 category 257 (Q7C257)**.
   - `Involuntary flight schedule change`: cancelled segment status → `UN`, new flight segment added with `TK` status. Record queued in **Q7C257**.
   - `Involuntary schedule cancellation`: cancelled segment status → `UN`. Record queued in **Q7C257**.
   - Queue mapping (also see the Queues section): Involuntary flight time change → Q7C257; Involuntary schedule change → Q7C257 (alt. column Q7C256); Involuntary cancellation → Q7C257 (alt. column Q7C258).
   - Full set of dedicated NDC OCN queue categories: `Q0C256`, `Q1C256/257/258/259/260/261`, `Q7C256/257/258`. Create them in the office ID queue bank with `QAC0C256`, `QAC1C256-261`, `QAC7C256-258`.
2. `Travel_OrderRetrieve` and `PNR_Retrieve` return a message indicating an involuntary change happened (Amadeus API `PNRACC` returns a generic message that an involuntary change has taken place, prompting the travel seller to accept the change, rebook, or cancel the order).
   - Important nuance for Acceptance: **`PNR_Retrieve` is used to display the warning message and the segment status changes. At this time `Travel_OrderRetrieve` will NOT display the warning nor the segment status.**
   - `Travel_OrderRetrieve` is used to retrieve the **order details** needed for `Travel_OrderChange`.
3. Follow-up actions (improvement): **`Travel_OrderViewRS` will include the possible follow-up actions associated with the disruption.** These follow-up actions remain available **until the travel seller initiates an action on the NDC order**. (Some airlines already provide specific follow-up actions after a disruption, but this behaviour is not consistent across all carriers.)
   (diagrams in source, media/image77.png + media/image78.png: screenshots of the disruption follow-up actions returned in the response.)

### PNR_Retrieve segment statuses (disrupted vs. re-accommodated)

`PNR_Retrieve` returns the impacted segment with status `UN`, and the new (airline-proposed) segment added with status `TK`. **After the acceptance the error message is removed and the segment(s) are updated to `HK`.**

Disrupted (old) segment — status `UN`:

```xml
<itineraryInfo>
  <travelProduct>
    <product>
      <depDate>280623</depDate>
      <depTime>0740</depTime>
      <arrDate>280623</arrDate>
      <arrTime>0915</arrTime>
    </product>
    <boardpointDetail>
      <cityCode>SYD</cityCode>
    </boardpointDetail>
    <offpointDetail>
      <cityCode>MEL</cityCode>
    </offpointDetail>
    <companyDetail>
      <identification>QF</identification>
    </companyDetail>
    <productDetails>
      <identification>415</identification>
      <classOfService>J</classOfService>
    </productDetails>
  </travelProduct>
  ...
  <itineraryReservationInfo>
    <reservation>
      <companyId>QF</companyId>
      <controlNumber>PZK8JV</controlNumber>
    </reservation>
  </itineraryReservationInfo>
  <relatedProduct>
    <quantity>1</quantity>
    <status>UN</status>
  </relatedProduct>
  ...
</itineraryInfo>
```

Airline-proposed new segment — status `TK` (same PNR record locator, new flight number / times):

```xml
<itineraryInfo>
  ...
  <travelProduct>
    <product>
      <depDate>280623</depDate>
      <depTime>0900</depTime>
      <arrDate>280623</arrDate>
      <arrTime>1035</arrTime>
    </product>
    <boardpointDetail>
      <cityCode>SYD</cityCode>
    </boardpointDetail>
    <offpointDetail>
      <cityCode>MEL</cityCode>
    </offpointDetail>
    <companyDetail>
      <identification>QF</identification>
    </companyDetail>
    <productDetails>
      <identification>427</identification>
      <classOfService>J</classOfService>
    </productDetails>
  </travelProduct>
  ...
  <itineraryReservationInfo>
    <reservation>
      <companyId>QF</companyId>
      <controlNumber>PZK8JV</controlNumber>
    </reservation>
  </itineraryReservationInfo>
  <relatedProduct>
    <quantity>1</quantity>
    <status>TK</status>
  </relatedProduct>
  ...
</itineraryInfo>
```

Key detection XPaths:
| XPath | Meaning |
|---|---|
| `//itineraryInfo/relatedProduct/status` = `UN` | disrupted / cancelled segment |
| `//itineraryInfo/relatedProduct/status` = `TK` | airline's proposed re-accommodation segment |
| `//itineraryInfo/relatedProduct/status` = `HK` | confirmed after acceptance |
| `//itineraryInfo/travelProduct/productDetails/identification` | flight number (old vs. new) |
| `//itineraryInfo/travelProduct/product/depTime` \| `arrTime` | proposed new times |
| `//itineraryInfo/itineraryReservationInfo/reservation/controlNumber` | airline record locator |

The disrupted order is identified by the queued PNR (Q7C257) → PNR record locator → `PNR_Retrieve` for the warning/statuses, then `Travel_OrderRetrieve` (OrderID + OwnerCode) for the order/OrderItem/service IDs.

## Decision tree

Given a disruption on Q7C257, read the proposed `TK` segment(s) and ask the traveller:

| Traveller decision | Outcome | Requires |
|---|---|---|
| Accepts the airline's proposed re-accommodation (`TK` segments) | **Involuntary Acceptance** | `Travel_OrderChange` back to the airline, OrderItemRefID per pax, pax details, OrderID+OwnerCode, Fare Waiver Code if carrier requires it. Not supported by all carriers (Features per Airline). **1A recommends systematically accepting the change** for airlines that support acceptance. |
| Unhappy with the new flight details and does not want to exchange | **Involuntary Cancellation** | Cancel the order per the Involuntary Cancellation process flow. **Airline to be contacted**; cancellation possible but **penalties are not waived**. Refunds and Future Travel Credit currently NOT supported. May not be available for all carriers. |
| Unhappy with the proposal but wants another flight | **Involuntary Exchange** | Shopping (e.g. `Air_MultiAvailability`) → `Travel_OrderReshop` (with waiver code if required) → `Travel_OrderChange`. Two flows, same as voluntary: **Fare Driven** or **Schedule Driven** (per carrier). Form of payment is needed to proceed with the exchange, **including zero-amount exchanges**. |

Waiver-code rule of thumb: Acceptance → optional in principle but treated as mandatory by some airlines (e.g. American Airlines). Exchange → depends on carrier; carried in the **1st `Travel_OrderReshop`** request.

## Involuntary Acceptance

(diagram in source, media/image19.png: Involuntary Acceptance process flow.)

### Call sequence

1. Read queue **Q7C257** → notification for the affected PNR.
2. `PNR_Retrieve` — display the warning message and segment status changes (`UN` old / `TK` new). (`Travel_OrderRetrieve` does not show these.)
3. `Travel_OrderRetrieve` — retrieve the order details (OrderID, OwnerCode, OrderItem IDs, pax) needed for the change.
4. `Travel_OrderChange` — sent back to advise the airline that the change is accepted. Include a waiver code if the carrier requires one; **travel agencies need to know which waiver code is needed**.
5. Re-`PNR_Retrieve` — the error message is removed and the segment(s) are updated to `HK`.

### Mandatory inputs (certification criteria)

| Field path | Source of value | Notes |
|---|---|---|
| `AMA_TravelOrderChangeRQ/Request/.../OrderItemRefID` | `Travel_OrderRetrieve` | **Mandatory** — must be included **for each PAX** (Invol_Acceptance_01) |
| `.../Order/OrderID` | `Travel_OrderRetrieve` / PNR | **Mandatory** (Invol_Acceptance_02) |
| `.../Order/OwnerCode` | disrupting carrier (e.g. `QF`) | **Mandatory** (Invol_Acceptance_02) |
| `.../DataLists/PaxList/Pax/PaxID`, `PTC`, `Individual/TitleName`, `GivenName`, `Surname` | `Travel_OrderRetrieve` | **Mandatory** — pax details required (Invol_Acceptance_03) |
| `FareWaiver/FareRuleWaiverCode` | agency knowledge / test case list | **Mandatory if required by carrier** (Invol_Acceptance_04). AA = `SKCHG` |
| `PNR_Retrieve` by PNR record locator | queue | **Recommended** — retrieve NDC order by PNR Record Locator (Invol_Acceptance_04, second entry) |

### Request skeleton

The guide does not print a full acceptance XML sample; build it from the mandatory fields above. Waiver structure is as documented for Reshop:

```xml
<AMA_TravelOrderChangeRQ>
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>AMADNCE</AgencyID>
        <PseudoCityID>NCE</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <!-- one OrderItemRefID per PAX, from Travel_OrderRetrieve -->
    <FareWaiver>
      <FareRuleWaiverCode>SKCHG</FareRuleWaiverCode>
      <FareWaiverTypeCode>ScheduleChange</FareWaiverTypeCode>
    </FareWaiver>
    <DataLists>
      <PaxList>
        <Pax>
          <PaxID>T1</PaxID>
          <PTC>ADT</PTC>
          <Individual>
            <TitleName>MRS</TitleName>
            <GivenName>AALYJK</GivenName>
            <Surname>NDCX</Surname>
          </Individual>
        </Pax>
      </PaxList>
    </DataLists>
    <Order>
      <OrderID>QF081HF3BNWA3</OrderID>
      <OwnerCode>QF</OwnerCode>
    </Order>
  </Request>
</AMA_TravelOrderChangeRQ>
```

### Carrier support / test limits (Acceptance)

- Not supported by all carriers — check **Features per Airline**.
- Certification test-case limits: **AA — max 2 PNRs, Waiver Code = `SKCHG`**; **QF — max 2 PNRs**; **Altea — max 2 PNR**; **BA/IB — max 2 PNR**; **AF/KL — max 2 PNR**.

## Involuntary Cancellations

(diagram in source, media/image20.png: Involuntary Cancellation process flow.)

### Call sequence

1. Read queue **Q7C257**, `PNR_Retrieve` / `Travel_OrderRetrieve` to identify the disrupted order (OrderID + OwnerCode).
2. Traveller refuses the new flight details and does not want an exchange → **contact the airline**.
3. Cancel the order following the steps in the **Involuntary Cancellation process flow** section of the implementation guide (same cancel/void/refund mechanics as the standard cancellation flow).

### Mandatory inputs

| Field path | Source of value | Notes |
|---|---|---|
| `OrderID` | `Travel_OrderRetrieve` / PNR | required to cancel the order |
| `OwnerCode` | disrupting carrier | required |

### Constraints

- **Penalties are NOT waived** on involuntary cancellation; airline must be contacted.
- **Refunds and Future Travel Credit are currently not supported.**
- Feature may not be available for all carriers — check **Features per Airline**.
- Certification: Involuntary Cancellations are **not required if already certified with voids (paid orders) / refunds**.

## Involuntary Exchange

Flight disruptions for exchange are subject to **Altea NDC carriers and QF** (plus per Features per Airline; AA appears in the exchange test-case list). Two flows, identical to the voluntary exchange flows: **Fare Driven** or **Schedule Driven** (per carrier). The process flow is the same as voluntary fare-driven / schedule-driven exchange except that (a) a **waiver code may be required** depending on the carrier to waive fees, and (b) a **form of payment is needed** to proceed — also for zero-amount exchanges.

The **waiver code is included in the 1st `Travel_OrderReshop` request** (not in the OrderChange). Default waiver type code: `ScheduleChange`.

### Call sequence (Schedule Driven example)

1. `Travel_OrderRetrieve` — retrieve the disrupted order (recommended: must be sent prior to shopping; Invol_Exchange_01).
2. `Air_MultiAvailability` (or other shopping request) — find alternative flight schedule / class / flight number (recommended; Invol_Exchange_02).
3. `Travel_OrderReshop` — with `FareWaiver`, the new `PaxSegment` flight details, and `DeleteOrderItem` (+ `RetainServiceID` where applicable). **Mandatory before `Travel_OrderChange`** (Invol_Exchange_03). For **FLX only**, the `ReshopParameters` section is labeled `AutoExchRequestInd="true"`.
4. `Travel_OrderChange` — accept the selected offer returned by the Reshop.

Example scenario from the guide: carriers supporting the **schedule driven** flow; 1 adult + 1 child + 1 infant, roundtrip; **outbound disrupted**; OCN sent to Q7C257; traveller **does not accept the re-accommodation flight #647** proposed by the airline and wants another flight — flying **2 May instead of 21 April**. (diagrams in source, media/image79.png + media/image80.png: cryptic display of the disrupted PNR with the proposed flight.)

### Step 2 — Air_MultiAvailability

```xml
<Air_MultiAvailability>
  <messageActionDetails>
    <functionDetails>
      <businessFunction>1</businessFunction>
      <actionCode>44</actionCode>
    </functionDetails>
  </messageActionDetails>
  <requestSection>
    <availabilityProductInfo>
      <availabilityDetails>
        <departureDate>020523</departureDate>
      </availabilityDetails>
      <departureLocationInfo>
        <cityAirport>SYD</cityAirport>
      </departureLocationInfo>
      <arrivalLocationInfo>
        <cityAirport>PER</cityAirport>
      </arrivalLocationInfo>
    </availabilityProductInfo>
    <availabilityOptions>
      <productTypeDetails>
        <typeOfRequest>TN</typeOfRequest>
      </productTypeDetails>
      <optionInfo>
        <type>BIA</type>
        <arguments>QF</arguments>
      </optionInfo>
    </availabilityOptions>
  </requestSection>
</Air_MultiAvailability>
```

Response (values needed for the Reshop are in bold in the source: date, times, board/off points, carrier, flight number, class):

```xml
<Air_MultiAvailabilityReply>
  <messageActionDetails>
    <functionDetails>
      <businessFunction>1</businessFunction>
      <actionCode>45</actionCode>
    </functionDetails>
    <responseType>3</responseType>
  </messageActionDetails>
  <singleCityPairInfo>
    <locationDetails>
      <origin>SYD</origin>
      <destination>PER</destination>
    </locationDetails>
    <cityPairFreeFlowText>
      <freeTextQualification>
        <codedIndicator>4</codedIndicator>
        <typeOfInfo>50</typeOfInfo>
      </freeTextQualification>
      <freeText>** QANTAS AIRWAYS - AN ** 68 TU 02MAY 0000</freeText>
    </cityPairFreeFlowText>
    <cityPairFreeFlowText>
      <freeTextQualification>
        <codedIndicator>4</codedIndicator>
        <typeOfInfo>OFD</typeOfInfo>
      </freeTextQualification>
      <freeText>PER PERTH.AUWA</freeText>
    </cityPairFreeFlowText>
    <flightInfo>
      <basicFlightInfo>
        <flightDetails>
          <departureDate>020523</departureDate>
          <departureTime>1945</departureTime>
          <arrivalDate>020523</arrivalDate>
          <arrivalTime>2245</arrivalTime>
        </flightDetails>
        <departureLocation>
          <cityAirport>SYD</cityAirport>
        </departureLocation>
        <arrivalLocation>
          <cityAirport>PER</cityAirport>
        </arrivalLocation>
        <marketingCompany>
          <identifier>QF</identifier>
        </marketingCompany>
        <flightIdentification>
          <number>653</number>
        </flightIdentification>
        <productTypeDetail>
          <productIndicators>D</productIndicators>
          <productIndicators>ET</productIndicators>
        </productTypeDetail>
        <lineItemNumber>7</lineItemNumber>
      </basicFlightInfo>
      <infoOnClasses>
        <productClassDetail>
          <serviceClass>Q</serviceClass>
          <availabilityStatus>9</availabilityStatus>
        </productClassDetail>
      </infoOnClasses>
    </flightInfo>
  </singleCityPairInfo>
</Air_MultiAvailabilityReply>
```

### Step 3 — Travel_OrderReshop (with waiver)

```xml
<AMA_TravelOrderReshopRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderReshopRQ_v1">
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>AMADNCE</AgencyID>
        <PseudoCityID>NCE</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <OrderItemRefID>QF081HF3BNWA3</OrderItemRefID>
    <BookingRef>
      <BookingEntity>
        <Carrier>
          <AirlineDesigCode>QF</AirlineDesigCode>
        </Carrier>
      </BookingEntity>
    </BookingRef>
    <FareWaiver>
      <FareRuleWaiverCode>WAIVERCODE</FareRuleWaiverCode>
      <FareWaiverTypeCode>ScheduleChange</FareWaiverTypeCode>
    </FareWaiver>
    <UpdateOrder>
      <ReshopOrder>
        <ServiceOrder>
          <AddOfferItems>
            <Paxs>
              <Pax>
                <PaxID>T1</PaxID>
                <PTC>ADT</PTC>
                <Individual>
                  <TitleName>MRS</TitleName>
                  <GivenName>AALYJK</GivenName>
                  <Surname>NDCX</Surname>
                </Individual>
              </Pax>
              <Pax>
                <PaxID>T2</PaxID>
                <PTC>CNN</PTC>
                <Individual>
                  <TitleName>MR</TitleName>
                  <GivenName>CKLPCX</GivenName>
                  <Surname>NDCX</Surname>
                </Individual>
              </Pax>
              <Pax>
                <PaxID>T1.1</PaxID>
                <PTC>INF</PTC>
                <Individual>
                  <GivenName>FHTEDF</GivenName>
                  <Surname>NDCX</Surname>
                </Individual>
              </Pax>
            </Paxs>
            <FlightRequest>
              <SpecificOriginDestRequest>
                <OriginStationCode>SYD</OriginStationCode>
                <DestStationCode>PER</DestStationCode>
                <PaxJourney>
                  <PaxJourneyID>F1</PaxJourneyID>
                  <PaxSegment>
                    <PaxSegmentID>S2</PaxSegmentID>
                    <Departure>
                      <IATA_LocationCode>SYD</IATA_LocationCode>
                      <AircraftScheduledDateTime>2023-05-02T19:45:00</AircraftScheduledDateTime>
                    </Departure>
                    <Arrival>
                      <IATA_LocationCode>PER</IATA_LocationCode>
                      <AircraftScheduledDateTime>2023-05-02T22:45:00</AircraftScheduledDateTime>
                    </Arrival>
                    <MarketingCarrierInfo>
                      <CarrierDesigCode>QF</CarrierDesigCode>
                      <MarketingCarrierFlightNumberText>653</MarketingCarrierFlightNumberText>
                      <RBD_Code>Q</RBD_Code>
                    </MarketingCarrierInfo>
                  </PaxSegment>
                </PaxJourney>
              </SpecificOriginDestRequest>
            </FlightRequest>
          </AddOfferItems>
          <DeleteOrderItem>
            <OrderItemRefID>P58953DE3-3D0E-4E7E-1-1_1APAX_T1</OrderItemRefID>
            <RetainServiceID>SRV1-T1-S4</RetainServiceID>
          </DeleteOrderItem>
          <DeleteOrderItem>
            <OrderItemRefID>P58953DE3-3D0E-4E7E-1-2_1APAX_T2</OrderItemRefID>
            <RetainServiceID>SRV2-T2-S4</RetainServiceID>
          </DeleteOrderItem>
          <DeleteOrderItem>
            <OrderItemRefID>P58953DE3-3D0E-4E7E-1-3_1APAX_T1.1</OrderItemRefID>
            <RetainServiceID>SRV3-T1.1-S4</RetainServiceID>
          </DeleteOrderItem>
        </ServiceOrder>
      </ReshopOrder>
    </UpdateOrder>
  </Request>
</AMA_TravelOrderReshopRQ>
```

`<RetainServiceID>` content depends on the bound use case — see **Travel_OrderReshop RQ (Equivalent to shopping)**.

### Reshop response — waiver echo + new offer

The `Travel_OrderReshop` response includes an **endorsements** section with the waiver code that has been applied, plus the new exchanged offer:

```xml
<Ticketing>
  <Endorsements>
    <Endorsement>WAIVERCODE</Endorsement>
    <Endorsement>NON-REF/NON-END</Endorsement>
    <Endorsement>SPECIAL FARE CONDITIONS</Endorsement>
  </Endorsements>
</Ticketing>
```

(diagram in source, media/image81.png: Reshop response screenshot with the returned offer.)

Key response XPaths to feed the OrderChange: `//Ticketing/Endorsements/Endorsement` (applied waiver code), offer `OfferID`, `OwnerCode`, `ShoppingResponseRefID`, and one `OfferItemRefID` per pax/PTC.

### Step 4 — Travel_OrderChange (accept the new offer)

```xml
<AMA_TravelOrderChangeRQ>
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>AMADNCE</AgencyID>
        <PseudoCityID>NCE</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <ChangeOrder>
      <UpdateOrderItem>
        <AcceptOffer>
          <SelectedOffer>
            <OfferID>ERIxNaEYWcTGiKVByBRtL8NC_1A_1A_TPID_CiQIARIat</OfferID>
            <OwnerCode>QF</OwnerCode>
            <ShoppingResponseRefID>RD04D0D8A-F307-4E75-BFF7</ShoppingResponseRefID>
            <SelectedOfferItem>
              <OfferItemRefID>1A_TPID_CAESHFJEMDREMEQ4=</OfferItemRefID>
              <PaxRefID>T1</PaxRefID>
            </SelectedOfferItem>
            <SelectedOfferItem>
              <OfferItemRefID>1A_TPID_CAISHFJEMDREMEQ4=</OfferItemRefID>
              <PaxRefID>T2</PaxRefID>
            </SelectedOfferItem>
            <SelectedOfferItem>
              <OfferItemRefID>1A_TPID_CAMSHFJEMDREMEQ4=</OfferItemRefID>
              <PaxRefID>T1.1</PaxRefID>
            </SelectedOfferItem>
          </SelectedOffer>
        </AcceptOffer>
      </UpdateOrderItem>
    </ChangeOrder>
    <DataLists>
      <PaxList>
        <Pax>
          <PaxID>T1</PaxID>
          <PTC>ADT</PTC>
          <Individual>
            <TitleName>MRS</TitleName>
            <GivenName>AALYJK</GivenName>
            <Surname>NDCX</Surname>
          </Individual>
        </Pax>
        <Pax>
          <PaxID>T2</PaxID>
          <PTC>CNN</PTC>
          <Individual>
            <TitleName>MR</TitleName>
            <GivenName>CKLPCX</GivenName>
            <Surname>NDCX</Surname>
          </Individual>
        </Pax>
        <Pax>
          <PaxID>T1.1</PaxID>
          <PTC>INF</PTC>
          <Individual>
            <GivenName>FHTEDF</GivenName>
            <Surname>NDCX</Surname>
          </Individual>
        </Pax>
      </PaxList>
    </DataLists>
    <Order>
      <OrderID>QF081HF3BNWA3</OrderID>
      <OwnerCode>QF</OwnerCode>
    </Order>
    <PaymentInfo>
      <Amount CurCode="EUR">0</Amount>
      <TypeCode>CA</TypeCode>
      <PaymentMethod>
        <Cash>
          <CashInd>true</CashInd>
        </Cash>
      </PaymentMethod>
    </PaymentInfo>
  </Request>
</AMA_TravelOrderChangeRQ>
```

The updated order includes the **exchanged documents and new document details**. (diagrams in source, media/image82.png + media/image83.png: updated order view with exchanged/new ticket documents.)

### Mandatory inputs (Exchange, certification criteria)

| Field path | Source of value | Notes |
|---|---|---|
| `Travel_OrderRetrieve` before shopping | — | **Recommended** (Invol_Exchange_01) |
| `Air_MultiAvailability` (or other shopping) before Reshop | — | **Recommended** (Invol_Exchange_02) |
| `Travel_OrderReshop` before `Travel_OrderChange` | — | **Mandatory** (Invol_Exchange_03). FLX only: `ReshopParameters` labeled `AutoExchRequestInd="true"` |
| `OrderID` + `OwnerCode` in Travel_OrderRetrieve / Travel_OrderReshop / Travel_OrderChange | order | **Mandatory** (Invol_Exchange_04) |
| `UpdateOrder/ReshopOrder/ServiceOrder/DeleteOrderItem/OrderItemRefID` | `Travel_OrderRetrieve` | **Mandatory** — order item reference to delete (Invol_Exchange_05) |
| `DeleteOrderItem/RetainServiceID` | `Travel_OrderRetrieve` (bound use case) | included if applicable (Invol_Exchange_05) |
| `FareWaiver/FareRuleWaiverCode` (+ `FareWaiverTypeCode`) in the 1st `Travel_OrderReshop` | agency knowledge / test case list | **Mandatory if required by carrier** (Invol_Exchange_06); default type `ScheduleChange` |
| `SelectedOffer/OfferID`, `OwnerCode`, `ShoppingResponseRefID`, `SelectedOfferItem/OfferItemRefID` + `PaxRefID` | `Travel_OrderReshop` response | **Mandatory** — sent for **each PTC code as returned in the Travel_OrderReshop** (Invol_Exchange_07) |
| `PaymentInfo` (form of payment) | agency | needed to proceed with the exchange, incl. zero-amount exchanges |
| `AirlineDesigCode` in `Travel_OrderReshop` | carrier | for **AA**, after activation of Corporate Codes in exchange flow, the Airline Designator Code must be provided as input in Travel_OrderReshop |

### Carrier support (Exchange)

- Flight disruptions for exchange are subject to **Altea NDC carriers and QF**; check Features per Airline for Fare Driven vs. Schedule Driven support.
- Certification waiver codes: **AA — `SKCHG`**, **QF — `QFSKEDCHG`**.

## Gotchas

- `Travel_OrderRetrieve` does **not** show the disruption warning nor segment statuses — you must use `PNR_Retrieve` for that; use `Travel_OrderRetrieve` only for order details.
- Do not trigger disruptions in production: it is **prohibited**. Amadeus performs disruptions on the test environment.
- Flows require **Travel_Management Interface v1.10** minimum (general prerequisite list mentions Travel_Management Interface v1.14 for the overall solution).
- Waiver code placement differs per outcome: **Acceptance → `Travel_OrderChange`**; **Exchange → 1st `Travel_OrderReshop`** (echoed back in `//Ticketing/Endorsements/Endorsement`).
- Acceptance waiver code is "optional" by design but **mandatory in practice for some airlines (e.g. American Airlines, `SKCHG`)** — treat as carrier-driven configuration.
- Involuntary cancellation does **not** waive penalties, and **refunds / Future Travel Credit are not supported**; the airline must be contacted.
- Follow-up actions in `Travel_OrderViewRS` disappear once any action is initiated on the NDC order — capture them on first read.
- Form of payment is required for involuntary exchanges **even when the amount is zero** (example uses `<Amount CurCode="EUR">0</Amount>` with `TypeCode` `CA` / cash).
- For UA, the corporate account code from the prime booking is not retained for subsequent exchanges and must be re-entered; Amadeus does not validate that the corporate code matches the original booking — only the airline does.
- `RetainServiceID` values are use-case dependent (bound/unbound services) — do not hardcode.
