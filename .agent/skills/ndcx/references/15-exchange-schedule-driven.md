# Voluntary Exchange — Schedule Driven Exchange & Exchange with Netting

> Source: WBS Implementation Guide NDC[X] Ancillaries, Seats and Servicing v1.2, Voluntary Exchange - Schedule Driven Exchange / Exchange with Netting

Scenario premise: "the TA knows which flight they want to change from the original flight, or they can send an Air_MultiAvailability to get the new flight details." The agent supplies the exact replacement flights; the airline does not propose alternatives.

## Call sequence

1. **Air_MultiAvailability** (optional) — get concrete flight details (carrier, flight number, dates/times, RBD availability) for the new flights. Skippable if the flights are already known, or replaceable by "any shopping request".
2. **Travel_OrderReshop** — one single call. Refers to the deleted order and carries the *explicit* new flight details in `FlightRequest/SpecificOriginDestRequest`. Returns a priced `ReshopOffer` (`ReshopResults UseCase="EXCHANGE"`) with the differentials.
3. **Travel_OrderChange** — accepts the selected offer/offer item; orchestrates the exchange.
4. **Travel_OrderPay** — submits the additional collection payment. Only in the 2-step variant (see below). The Travel Order View then reflects the new segments; `TicketDocInfos` includes the exchanged tickets, the new reissued ticket and the EMD (if applicable).

1-step vs 2-step (driven by form of payment, not by the flight selection):

| Variant | How payment is provided | Calls |
|---|---|---|
| 1-Step | Application reuses the payment details from the existing PNR (FP element) — Implicit FOP / `FROM_PNR`; uses the FOP stored in the PNR *before* changes. | Travel_OrderReshop → Travel_OrderChange (payment details **must** be in the Travel_OrderChange request) |
| 2-Step | Application supplies payment details itself. | Travel_OrderReshop → Travel_OrderChange → Travel_OrderPay |

Hard rule: "When you use Implicit FOP for Schedule Driven Exchanges, you must not use `Travel_OrderPay`". See the "Implicit FOP (Use the FOP from PNR)" section for `FROM_PNR` details.

(diagram in source, image73: the Travel_OrderReshop → Travel_OrderChange → Travel_OrderPay order flow for the schedule driven exchange.)

## Schedule driven vs fare driven

Sibling reference: `14-exchange-fare-driven.md`.

| Aspect | Schedule driven (this file) | Fare driven |
|---|---|---|
| Who chooses the replacement flights | The agent/TA — explicit flights passed in the request | The airline — returns a list of `ReshopOffer`s to choose from |
| Shopping input | `AddOfferItems/FlightRequest/SpecificOriginDestRequest` with full `PaxJourney`/`PaxSegment` (carrier, flight number, RBD, departure date-time) | Origin/destination/date criteria only; no explicit flight identity |
| Number of Travel_OrderReshop calls | **One** (shop+price in a single call) | **Two**: 1st = "equivalent to shopping" (returns candidate ReshopOffers), 2nd = "equivalent to pricing" of the selected offer |
| Offer selection step | Offer returned by the single Reshop is passed straight to Travel_OrderChange | Selected ReshopOffer is re-priced by the 2nd Travel_OrderReshop, whose RS confirms the final amounts |
| Where final amounts are confirmed | The single Travel_OrderReshopRS | The 2nd Travel_OrderReshopRS ("will confirm the final amounts") |
| Wording used in guide for the pay total | "total amount to pay with this 2-Step Exchange is the addition of both amounts" (PenaltyDifferential + DifferentialAmountDue) | "total amount to pay with this 1-Step Exchange is the addition of both amounts" |
| Availability pre-step | Air_MultiAvailability (or any shopping request) to obtain flight details | Not needed |
| Differential elements returned | Identical set (`OriginalOrderItemDifferential`, `NewOfferItemDifferential`, `PenaltyDifferential`, `DifferentialAmountDue`) | Identical set |

Use schedule driven when the customer has already picked the exact replacement flight(s); use fare driven when you want the airline to propose priced alternatives.

## ID chaining

| Value | Produced by | Consumed by |
|---|---|---|
| Flight identity (carrier code, flight number, dep/arr airports, dep date+time) | `Air_MultiAvailabilityReply/singleCityPairInfo/flightInfo/basicFlightInfo` (`marketingCompany/identifier`, `flightIdentification/number`, `departureLocation/cityAirport`, `arrivalLocation/cityAirport`, `flightDetails/departureDate`+`departureTime`) and `infoOnClasses/productClassDetail/serviceClass` | Travel_OrderReshopRQ `PaxSegment/MarketingCarrierInfo/CarrierDesigCode`, `MarketingCarrierFlightNumberText`, `RBD_Code`, `Departure/IATA_LocationCode`, `Departure/AircraftScheduledDateTime`, `Arrival/IATA_LocationCode` |
| OrderID (e.g. `QF081HQXKHUA4`) | existing order / Order View | Travel_OrderReshopRQ `Request/OrderItemRefID`; Travel_OrderChangeRQ `Order/OrderID`; Travel_OrderPayRQ `Order/OrderID` |
| Original order item ID (e.g. `P95C50EAF-F0E6-4DB2-B250gap9vvp0g4rly-1-1_1APAX_T1`) | Order View | Travel_OrderReshopRQ `DeleteOrderItem/OrderItemRefID`; echoed back in `AddOfferItem/OrderItemRefID` |
| Service ID to retain (e.g. `SRV1-T1-S2`) | Order View services | Travel_OrderReshopRQ `DeleteOrderItem/RetainServiceID` |
| `OfferID` | Travel_OrderReshopRS `ReshopOffers/ReshopOffer/OfferID` | Travel_OrderChangeRQ `AcceptOffer/SelectedOffer/OfferID` |
| `OwnerCode` (`QF`) | Travel_OrderReshopRS `ReshopOffer/OwnerCode` | Travel_OrderChangeRQ `SelectedOffer/OwnerCode`, `Order/OwnerCode`; Travel_OrderPayRQ `Order/OwnerCode` |
| `OfferItemID` | Travel_OrderReshopRS `AddOfferItem/OfferItemID` | Travel_OrderChangeRQ `SelectedOfferItem/OfferItemRefID` |
| `ShoppingResponseID` (e.g. `R309BC57F-A1C6-4CAC-90C8`) | Travel_OrderReshopRS `Response/ShoppingResponse/ShoppingResponseID` | Travel_OrderChangeRQ `SelectedOffer/ShoppingResponseRefID` |
| `PaxID` (`T1`) | Order View / request PaxList | Travel_OrderReshopRQ `Paxs/Pax/PaxID`; Travel_OrderChangeRQ `SelectedOfferItem/PaxRefID` and `DataLists/PaxList/Pax/PaxID` |
| `PenaltyDifferential/Amount` + `DifferentialAmountDue/Amount` | Travel_OrderReshopRS | Travel_OrderPayRQ `PaymentInfo/Amount` (sum of both) |

## 1. Air_MultiAvailability

Mandatory inputs:

| Field path | Source of value | Notes |
|---|---|---|
| `messageActionDetails/functionDetails/actionCode` | constant | `44` |
| `requestSection/availabilityProductInfo/availabilityDetails/departureDate` | new travel date | `DDMMYY`, e.g. `141223` |
| `.../departureLocationInfo/cityAirport` | new origin | e.g. `LHR` |
| `.../arrivalLocationInfo/cityAirport` | new destination | e.g. `SYD` |
| `airlineOrFlightOption/flightIdentification/airlineCode` | order owner carrier | e.g. `QF` |
| `availabilityOptions/productTypeDetails/typeOfRequest` | constant | `TN` |

Request:

```xml
<Air_MultiAvailability>
  <messageActionDetails>
    <functionDetails>
      <actionCode>44</actionCode>
    </functionDetails>
  </messageActionDetails>
  <requestSection>
    <availabilityProductInfo>
      <availabilityDetails>
        <departureDate>141223</departureDate>
      </availabilityDetails>
      <departureLocationInfo>
        <cityAirport>LHR</cityAirport>
      </departureLocationInfo>
      <arrivalLocationInfo>
        <cityAirport>SYD</cityAirport>
      </arrivalLocationInfo>
    </availabilityProductInfo>
    <airlineOrFlightOption>
      <flightIdentification>
        <airlineCode>QF</airlineCode>
      </flightIdentification>
    </airlineOrFlightOption>
    <availabilityOptions>
      <productTypeDetails>
        <typeOfRequest>TN</typeOfRequest>
      </productTypeDetails>
    </availabilityOptions>
  </requestSection>
</Air_MultiAvailability>
```

Response (abridged, real values from the guide):

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
      <origin>LHR</origin>
      <destination>SYD</destination>
    </locationDetails>
    <cityPairFreeFlowText>
      <freeTextQualification>
        <codedIndicator>4</codedIndicator>
        <typeOfInfo>50</typeOfInfo>
      </freeTextQualification>
      <freeText>** AMADEUS AVAILABILITY - AN ** 96 TH 14DEC 0000</freeText>
    </cityPairFreeFlowText>
    <cityPairFreeFlowText>
      <freeTextQualification>
        <codedIndicator>4</codedIndicator>
        <typeOfInfo>OFD</typeOfInfo>
      </freeTextQualification>
      <freeText>SYD SYDNEY.AUNS</freeText>
    </cityPairFreeFlowText>
    <flightInfo>
      <basicFlightInfo>
        <flightDetails>
          <departureDate>141223</departureDate>
          <departureTime>1340</departureTime>
          <arrivalDate>151223</arrivalDate>
          <arrivalTime>0040</arrivalTime>
        </flightDetails>
        <departureLocation><cityAirport>LHR</cityAirport></departureLocation>
        <arrivalLocation><cityAirport>DXB</cityAirport></arrivalLocation>
        <marketingCompany><identifier>QF</identifier></marketingCompany>
        <operatingCompany><identifier>EK</identifier></operatingCompany>
        <flightIdentification><number>8002</number></flightIdentification>
        <productTypeDetail>
          <productIndicators>S</productIndicators>
          <productIndicators>701</productIndicators>
          <productIndicators>ET</productIndicators>
        </productTypeDetail>
        <lineItemNumber>2</lineItemNumber>
      </basicFlightInfo>
      <infoOnClasses>
        <productClassDetail>
          <serviceClass>Y</serviceClass>
          <availabilityStatus>9</availabilityStatus>
        </productClassDetail>
      </infoOnClasses>
    </flightInfo>
    <flightInfo>
      <basicFlightInfo>
        <flightDetails>
          <departureDate>151223</departureDate>
          <departureTime>0200</departureTime>
          <arrivalDate>151223</arrivalDate>
          <arrivalTime>2230</arrivalTime>
        </flightDetails>
        <departureLocation><cityAirport>DXB</cityAirport></departureLocation>
        <arrivalLocation><cityAirport>SYD</cityAirport></arrivalLocation>
        <marketingCompany><identifier>QF</identifier></marketingCompany>
        <operatingCompany><identifier>EK</identifier></operatingCompany>
        <flightIdentification><number>8414</number></flightIdentification>
        <productTypeDetail>
          <productIndicators>E</productIndicators>
          <productIndicators>701</productIndicators>
          <productIndicators>ET</productIndicators>
        </productTypeDetail>
      </basicFlightInfo>
      <infoOnClasses>
        <productClassDetail>
          <serviceClass>Y</serviceClass>
          <availabilityStatus>9</availabilityStatus>
        </productClassDetail>
      </infoOnClasses>
    </flightInfo>
  </singleCityPairInfo>
</Air_MultiAvailabilityReply>
```

Key response XPaths: `/Air_MultiAvailabilityReply/singleCityPairInfo/flightInfo/basicFlightInfo/{flightDetails,departureLocation/cityAirport,arrivalLocation/cityAirport,marketingCompany/identifier,operatingCompany/identifier,flightIdentification/number,lineItemNumber}`, `/…/flightInfo/infoOnClasses/productClassDetail/{serviceClass,availabilityStatus}`.

## 2. Travel_OrderReshop (single call — refers to deleted order + explicit new flights)

"Travel_OrderReshop request refers to the deleted order and contains flight details for the new flight to book. The flight details obtained using Air_MultiAvailability or any shopping request."

`<RetainServiceID>` content depends on the bound use case — see **Travel_OrderReshop RQ (Equivalent to shopping)**.

Mandatory inputs:

| Field path | Source of value | Notes |
|---|---|---|
| `Party/Sender/TravelAgency/AgencyID` | agency config | e.g. `NCE123456` |
| `Party/Sender/TravelAgency/PseudoCityID` | agency config | e.g. `NCE` |
| `Request/OrderItemRefID` | Order ID | e.g. `QF081HQXKHUA4` |
| `Request/BookingRef/BookingEntity/Carrier/AirlineDesigCode` | order owner | `QF` |
| `ReshopParameters/Notices/PricingParameters/@AutoExchRequestInd` | constant `true` | **Accelya carriers only** (highlighted grey in source) |
| `UpdateOrder/ReshopOrder/ServiceOrder/AddOfferItems/Paxs/Pax` | Order View pax | `PaxID`, `PTC`, `Individual/GivenName`, `Individual/Surname` |
| `AddOfferItems/ShoppingCriteria` | — | empty element `<ShoppingCriteria />` |
| `FlightRequest/SpecificOriginDestRequest/OriginStationCode` / `DestStationCode` | new O&D | `LHR` / `SYD` |
| `.../PaxJourney/PaxJourneyID` | agent-assigned | e.g. `F2` |
| `.../PaxSegment/PaxSegmentID` | agent-assigned | `S1`, `S2`, … one per leg |
| `PaxSegment/Departure/IATA_LocationCode` + `AircraftScheduledDateTime` | availability | ISO `2023-12-14T13:40:00` |
| `PaxSegment/Arrival/IATA_LocationCode` | availability | |
| `PaxSegment/MarketingCarrierInfo/CarrierDesigCode` / `MarketingCarrierFlightNumberText` / `RBD_Code` | availability | `QF` / `8002` / `Y` |
| `DeleteOrderItem/OrderItemRefID` | original order item | `P95C50EAF-F0E6-4DB2-B250gap9vvp0g4rly-1-1_1APAX_T1` |
| `DeleteOrderItem/RetainServiceID` | services to keep | e.g. `SRV1-T1-S2` |

```xml
<AMA_TravelOrderReshopRQ>
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>NCE123456</AgencyID>
        <PseudoCityID>NCE</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <OrderItemRefID>QF081HQXKHUA4</OrderItemRefID>
    <BookingRef>
      <BookingEntity>
        <Carrier>
          <AirlineDesigCode>QF</AirlineDesigCode>
        </Carrier>
      </BookingEntity>
    </BookingRef>
    <!-- ReshopParameters: Accelya carriers only -->
    <ReshopParameters>
      <Notices>
        <PricingParameters AutoExchRequestInd="true"/>
      </Notices>
    </ReshopParameters>
    <UpdateOrder>
      <ReshopOrder>
        <ServiceOrder>
          <AddOfferItems>
            <Paxs>
              <Pax>
                <PaxID>T1</PaxID>
                <PTC>ADT</PTC>
                <Individual>
                  <GivenName>SYL</GivenName>
                  <Surname>QUIN</Surname>
                </Individual>
              </Pax>
            </Paxs>
            <ShoppingCriteria />
            <FlightRequest>
              <SpecificOriginDestRequest>
                <OriginStationCode>LHR</OriginStationCode>
                <DestStationCode>SYD</DestStationCode>
                <PaxJourney>
                  <PaxJourneyID>F2</PaxJourneyID>
                  <PaxSegment>
                    <PaxSegmentID>S1</PaxSegmentID>
                    <Departure>
                      <IATA_LocationCode>LHR</IATA_LocationCode>
                      <AircraftScheduledDateTime>2023-12-14T13:40:00</AircraftScheduledDateTime>
                    </Departure>
                    <Arrival>
                      <IATA_LocationCode>DXB</IATA_LocationCode>
                    </Arrival>
                    <MarketingCarrierInfo>
                      <CarrierDesigCode>QF</CarrierDesigCode>
                      <MarketingCarrierFlightNumberText>8002</MarketingCarrierFlightNumberText>
                      <RBD_Code>Y</RBD_Code>
                    </MarketingCarrierInfo>
                  </PaxSegment>
                  <PaxSegment>
                    <PaxSegmentID>S2</PaxSegmentID>
                    <Departure>
                      <IATA_LocationCode>DXB</IATA_LocationCode>
                      <AircraftScheduledDateTime>2023-12-15T02:00:00</AircraftScheduledDateTime>
                    </Departure>
                    <Arrival>
                      <IATA_LocationCode>SYD</IATA_LocationCode>
                    </Arrival>
                    <MarketingCarrierInfo>
                      <CarrierDesigCode>QF</CarrierDesigCode>
                      <MarketingCarrierFlightNumberText>8414</MarketingCarrierFlightNumberText>
                      <RBD_Code>Y</RBD_Code>
                    </MarketingCarrierInfo>
                  </PaxSegment>
                </PaxJourney>
              </SpecificOriginDestRequest>
            </FlightRequest>
          </AddOfferItems>
          <DeleteOrderItem>
            <OrderItemRefID>P95C50EAF-F0E6-4DB2-B250gap9vvp0g4rly-1-1_1APAX_T1</OrderItemRefID>
            <RetainServiceID>SRV1-T1-S2</RetainServiceID>
          </DeleteOrderItem>
        </ServiceOrder>
      </ReshopOrder>
    </UpdateOrder>
  </Request>
</AMA_TravelOrderReshopRQ>
```

Response (abridged; grey-highlighted elements in source = `PenaltyDifferential`, `DifferentialAmountDue/Amount`):

```xml
<AMA_TravelOrderReshopRS>
  <Response>
    <ReshopResults UseCase="EXCHANGE">
      <ReshopOffers>
        <ReshopOffer>
          <OfferID>ERmr-1TQhuSL658It1K8MQAD_1A__1A_1A_TPID_CiAIARIaUjMwOUJDNTdGLUExQzYtNENBQy05MEM4LTEYARIIRXhjaGFuZ2U=</OfferID>
          <OwnerCode>QF</OwnerCode>
          <AddOfferItem>
            <OfferItemID>1A_TPID_CAESHFIzMDlCQzU3Ri1BMUM2LTRDQUMtOTBDOC0xLTE=</OfferItemID>
            <MandatoryInd>true</MandatoryInd>
            <OrderItemRefID>P95C50EAF-F0E6-4DB2-B250gap9vvp0g4rly-1-1_1APAX_T1</OrderItemRefID>
            <FareDetail>
              <PassengerRefs>T1</PassengerRefs>
              <Price>
                <TotalAmount>
                  <DetailCurrencyPrice>
                    <Total Code="AUD">395198</Total>
                  </DetailCurrencyPrice>
                </TotalAmount>
                <BaseAmount Code="AUD">346000</BaseAmount>
                <Taxes>
                  <Total Code="AUD">49198</Total>
                  <Breakdown>
                    <Tax RefundInd="true">
                      <Qualifier>701</Qualifier>
                      <Amount Code="AUD">1750</Amount>
                      <TaxCode>YR</TaxCode>
                      <CollectionPoint>
                        <CurrCode>AUD</CurrCode>
                        <AirportAmount>1750</AirportAmount>
                        <AirportCode>SYD</AirportCode>
                      </CollectionPoint>
                      <LocalAmount Code="AUD">1750</LocalAmount>
                      <Description>YRI QF CARRIER IMPOSED MISC FEE</Description>
                    </Tax>
                  </Breakdown>
                </Taxes>
              </Price>
            </FareDetail>
            <OriginalOrderItemDifferential>
              <!-- Amount + TaxSummary of the ORIGINAL fare (same shape as NewOfferItemDifferential) -->
            </OriginalOrderItemDifferential>
            <NewOfferItemDifferential>
              <Amount CurCode="AUD">346000</Amount>
              <TaxSummary>
                <TotalTaxAmount CurCode="AUD">49198</TotalTaxAmount>
                <Tax>
                  <Amount CurCode="AUD">1750</Amount>
                  <TaxCode>YR</TaxCode>
                  <DescText>YRI QF CARRIER IMPOSED MISC FEE</DescText>
                  <CollectionPointTax>
                    <AirportAmount CurCode="AUD">1750</AirportAmount>
                    <IATA_StationCode>SYD</IATA_StationCode>
                  </CollectionPointTax>
                </Tax>
              </TaxSummary>
            </NewOfferItemDifferential>
            <PenaltyDifferential>
              <Amount CurCode="AUD">12500</Amount>
            </PenaltyDifferential>
            <DifferentialAmountDue>
              <Amount CurCode="AUD">97420</Amount>
              <TaxSummary>
                <TotalTaxAmount CurCode="AUD">2420</TotalTaxAmount>
                <CollectionInd>true</CollectionInd>
                <Tax>
                  <Amount CurCode="AUD">700</Amount>
                  <TaxCode>YR</TaxCode>
                  <DescText>YRI QF CARRIER IMPOSED MISC FEE</DescText>
                  <CollectionPointTax>
                    <AirportAmount CurCode="AUD">1750</AirportAmount>
                    <IATA_StationCode>DXB</IATA_StationCode>
                  </CollectionPointTax>
                </Tax>
              </TaxSummary>
            </DifferentialAmountDue>
          </AddOfferItem>
        </ReshopOffer>
      </ReshopOffers>
    </ReshopResults>
    <ShoppingResponse>
      <ShoppingResponseID>R309BC57F-A1C6-4CAC-90C8</ShoppingResponseID>
    </ShoppingResponse>
  </Response>
</AMA_TravelOrderReshopRS>
```

Differential semantics (inside `AddOfferItem`; "For details regarding the netting, please refer to Exchange with Netting section"):

- **OriginalOrderItemDifferential** — old base fare amount and taxes. `Amount` = original base fare amount; `TaxSummary` = original taxes total and breakdown per tax.
- **NewOfferItemDifferential** — new base fare amount and taxes. `Amount` = new base fare amount; `TaxSummary` = new taxes total + breakdown per tax.
- **PenaltyDifferential** — penalty for the exchange. `Amount` = penalty amount.
- **DifferentialAmountDue** — balance between old fare/old taxes and new fare/new taxes.
  - `Amount` = base fare amount balance. Positive → due by the passenger (additional collection). Negative → due by the airline (residual value). *Auto refund of a residual value is not supported for all carriers — see the Features per Carrier spreadsheet.*
  - `TaxSummary/TotalTaxAmount` = total balance of the taxes.
  - `TaxSummary/CollectionInd` = `true` if amount due by passenger, `false` if due by airline.
  - `TaxSummary/Tax` breakdown = balance for each tax.

## 3. Travel_OrderChange

"Travel_OrderChange request contains the new selected offer(s) to be exchanged."

Mandatory inputs:

| Field path | Source of value | Notes |
|---|---|---|
| `Party/Sender/TravelAgency/AgencyID` | agency config | e.g. `27212216` |
| `Party/Sender/TravelAgency/PseudoCityID` | agency config | e.g. `AE9L` |
| `ChangeOrder/UpdateOrderItem/AcceptOffer/SelectedOffer/OfferID` | Reshop RS `ReshopOffer/OfferID` | |
| `SelectedOffer/OwnerCode` | Reshop RS `ReshopOffer/OwnerCode` | `QF` |
| `SelectedOffer/ShoppingResponseRefID` | Reshop RS `ShoppingResponseID` | `R309BC57F-A1C6-4CAC-90C8` |
| `SelectedOfferItem/OfferItemRefID` | Reshop RS `AddOfferItem/OfferItemID` | |
| `SelectedOfferItem/PaxRefID` | pax id | `T1` |
| `DataLists/PaxList/Pax` | pax data | `PaxID`, `PTC`, `Individual/GivenName`, `Individual/Surname` |
| `Order/OrderID` + `Order/OwnerCode` | existing order | `QF081HQXKHUA4`, `QF` |
| Payment details | agency | **Required here only in the 1-Step / Implicit FOP (`FROM_PNR`) variant** |

```xml
<AMA_TravelOrderChangeRQ>
    <Party>
        <Sender>
            <TravelAgency>
                <AgencyID>27212216</AgencyID>
                <PseudoCityID>AE9L</PseudoCityID>
            </TravelAgency>
        </Sender>
    </Party>
    <Request>
        <ChangeOrder>
            <UpdateOrderItem>
                <AcceptOffer>
                    <SelectedOffer>
                        <OfferID>ERmr-1TQhuSL658It1K8MQAD_1A__1A_1A_TPID_CiAIARIaUjMwOUJDNTdGLUExQzYtNENBQy05MEM4LTEYARIIRXhjaGFuZ2U=</OfferID>
                        <OwnerCode>QF</OwnerCode>
                        <ShoppingResponseRefID>R309BC57F-A1C6-4CAC-90C8</ShoppingResponseRefID>
                        <SelectedOfferItem>
                            <OfferItemRefID>1A_TPID_CAESHFIzMDlCQzU3Ri1BMUM2LTRDQUMtOTBDOC0xLTE=</OfferItemRefID>
                            <PaxRefID>T1</PaxRefID>
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
                        <GivenName>SYL</GivenName>
                        <Surname>QUIN</Surname>
                    </Individual>
                </Pax>
            </PaxList>
        </DataLists>
        <Order>
            <OrderID>QF081HQXKHUA4</OrderID>
            <OwnerCode>QF</OwnerCode>
        </Order>
    </Request>
</AMA_TravelOrderChangeRQ>
```

(diagram in source, image74: the corresponding Travel_OrderChangeRS structure.)

## 4. Travel_OrderPay (2-Step only)

"Travel_OrderPay provides the payment details. The Travel Order View will update the information with the new segments. In the TicketDocInfos section, will include the exchanged tickets, new reissued ticket and EMD (if applicable)."

Mandatory inputs:

| Field path | Source of value | Notes |
|---|---|---|
| `PaymentInfo/Amount@CurCode` + value | Reshop RS | **= PenaltyDifferential + DifferentialAmountDue** (source annotates the field with exactly that formula). Example `AUD 1099.20` = 12500 + 97420 |
| `PaymentInfo/TypeCode` | FOP type | `CC` |
| `PaymentInfo/SecurePaymentVersion2/PaymentTrxChannelCode` | channel | `MO` |
| `PaymentMethod/PaymentCard/CreditCardVendorCode` | card | `VI` |
| `PaymentMethod/PaymentCard/CardNumber` | card | `123412341234` |
| `PaymentMethod/PaymentCard/SeriesCode` | card CVV | `123` |
| `PaymentMethod/PaymentCard/ExpirationDate` | card | `0139` (MMYY) |
| `Order/OrderID` + `Order/OwnerCode` | existing order | `QF081HQXKHUA4`, `QF` |

```xml
<AMA_TravelOrderPayRQ>
    <Party>
        <Sender>
            <TravelAgency>
                <AgencyID>27212216</AgencyID>
                <PseudoCityID>AE9L</PseudoCityID>
            </TravelAgency>
        </Sender>
    </Party>
    <Request>
        <PaymentInfo>
            <!-- PenaltyDifferential + DifferentialAmountDue -->
            <Amount CurCode="AUD">1099.20</Amount>
            <TypeCode>CC</TypeCode>
            <SecurePaymentVersion2>
                <PaymentTrxChannelCode>MO</PaymentTrxChannelCode>
            </SecurePaymentVersion2>
            <PaymentMethod>
                <PaymentCard>
                    <CreditCardVendorCode>VI</CreditCardVendorCode>
                    <CardNumber>123412341234</CardNumber>
                    <SeriesCode>123</SeriesCode>
                    <ExpirationDate>0139</ExpirationDate>
                </PaymentCard>
            </PaymentMethod>
        </PaymentInfo>
        <Order>
            <OrderID>QF081HQXKHUA4</OrderID>
            <OwnerCode>QF</OwnerCode>
        </Order>
    </Request>
</AMA_TravelOrderPayRQ>
```

(diagram in source, image75: the corresponding Travel_OrderPayRS / Order View with TicketDocInfos.)

## Exchange with netting

"This section describes how the global netting process is handled."

- Netting applies **in an exchange process** and consists in *compensating* the amounts to be collected for the new OfferItem and the penalty (if any) with the amounts to be refunded from the old OfferItem, **instead of collecting and refunding them through separate documents**. The separate documents that netting replaces are:
  - **Re-issue ticket**: additional collection of fare and taxes.
  - **Penalty EMD**: remaining penalty amount to be collected.
  - **Refundable balance EMD**: amount to be refunded to traveler.
- Fields carrying the netted amounts (all under Travel_OrderReshopRS `.../AddOfferItem`):
  - `DifferentialAmountDue/Amount` — netted base fare balance (new fare − old fare). Positive = collect from passenger; negative = due by airline (residual value).
  - `DifferentialAmountDue/TaxSummary/TotalTaxAmount` — netted tax balance; direction given by `DifferentialAmountDue/TaxSummary/CollectionInd` (`true` = due by passenger, `false` = due by airline).
  - `DifferentialAmountDue/TaxSummary/Tax/Amount` (+ `TaxCode`, `DescText`, `CollectionPointTax/AirportAmount`, `CollectionPointTax/IATA_StationCode`) — netted balance per tax.
  - `PenaltyDifferential/Amount` — penalty being netted in.
  - Inputs to the netting: `OriginalOrderItemDifferential/{Amount,TaxSummary}` (old) vs `NewOfferItemDifferential/{Amount,TaxSummary}` (new).
- Single amount to charge = `PenaltyDifferential/Amount` + `DifferentialAmountDue/Amount`, passed as `Travel_OrderPayRQ/Request/PaymentInfo/Amount`.
- **Carrier support**: "The features per carrier spreadsheet will list which carriers handle netting." Auto refund of a residual value is likewise not supported by all carriers (same spreadsheet). For **AF/KL**, see Amadeus Service Hub: "Exchange with Netting for Air France-KLM" — https://servicehub.amadeus.com/c/portal/view-solution/530360862
- (diagram in source, image76: illustration of the netting computation / resulting documents.)

## Money

| Concept | XPath | Example |
|---|---|---|
| New total (fare + taxes) of the new offer item | `AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/AddOfferItem/FareDetail/Price/TotalAmount/DetailCurrencyPrice/Total/@Code` + text | `AUD` `395198` |
| New base fare | `.../FareDetail/Price/BaseAmount` (`@Code`) | `AUD` `346000` |
| New taxes total | `.../FareDetail/Price/Taxes/Total` (`@Code`) | `AUD` `49198` |
| New tax breakdown item | `.../Price/Taxes/Breakdown/Tax` with `@RefundInd`, `Qualifier`, `Amount/@Code`, `TaxCode`, `CollectionPoint/{CurrCode,AirportAmount,AirportCode}`, `LocalAmount/@Code`, `Description` | `RefundInd="true"`, `Qualifier` `701`, `YR`, `SYD`, `1750`, `YRI QF CARRIER IMPOSED MISC FEE` |
| Old base fare | `.../AddOfferItem/OriginalOrderItemDifferential/Amount/@CurCode` + text | |
| Old taxes total / breakdown | `.../OriginalOrderItemDifferential/TaxSummary/TotalTaxAmount`, `.../TaxSummary/Tax/Amount` | |
| New base fare (differential view) | `.../AddOfferItem/NewOfferItemDifferential/Amount/@CurCode` | `AUD` `346000` |
| New taxes total (differential view) | `.../NewOfferItemDifferential/TaxSummary/TotalTaxAmount/@CurCode` | `AUD` `49198` |
| Per-tax detail (differential view) | `.../NewOfferItemDifferential/TaxSummary/Tax/{Amount,TaxCode,DescText,CollectionPointTax/AirportAmount,CollectionPointTax/IATA_StationCode}` | `1750`, `YR`, `SYD` |
| **Penalty** | `.../AddOfferItem/PenaltyDifferential/Amount/@CurCode` + text | `AUD` `12500` |
| **Add-collect / residual (fare balance)** | `.../AddOfferItem/DifferentialAmountDue/Amount/@CurCode` + text | `AUD` `97420` (positive = add-collect; negative = residual due by airline) |
| **Tax balance** | `.../DifferentialAmountDue/TaxSummary/TotalTaxAmount/@CurCode` | `AUD` `2420` |
| Tax balance direction | `.../DifferentialAmountDue/TaxSummary/CollectionInd` | `true` = passenger owes, `false` = airline owes |
| Per-tax balance | `.../DifferentialAmountDue/TaxSummary/Tax/{Amount,TaxCode,DescText,CollectionPointTax/AirportAmount,CollectionPointTax/IATA_StationCode}` | `700`, `YR`, `DXB` (note `AirportAmount` still `1750`) |
| **Total to pay** | `AMA_TravelOrderPayRQ/Request/PaymentInfo/Amount/@CurCode` + text | `AUD` `1099.20` = `PenaltyDifferential` (12500) + `DifferentialAmountDue` (97420) |

Amount formatting:

- Reshop RS amounts are unpunctuated integers with the decimals implied by the currency (`AUD 395198` = 3951.98; `12500` = 125.00; `97420` = 974.20). Currency is on the attribute — `Code` inside `FareDetail/Price` (`<Total Code="AUD">`, `<BaseAmount Code="AUD">`, `<Amount Code="AUD">`, `<LocalAmount Code="AUD">`) but `CurCode` in the differential elements (`<Amount CurCode="AUD">`, `<TotalTaxAmount CurCode="AUD">`, `<AirportAmount CurCode="AUD">`). `CollectionPoint` inside `Price/Taxes/Breakdown` instead uses a child element `<CurrCode>AUD</CurrCode>` and a plain `<AirportAmount>`.
- Travel_OrderPayRQ `PaymentInfo/Amount` is written **with a decimal point** (`1099.20`), i.e. the sum 12500 + 97420 = 109920 minor units rendered as major units. Do not send the reshop integer form here.

## Gotchas

- Do not mix Implicit FOP with Travel_OrderPay: for schedule driven exchanges using Implicit FOP (`FROM_PNR`, FP element from the existing PNR), payment must go in Travel_OrderChange and Travel_OrderPay must not be called.
- Implicit FOP uses the FOP stored in the PNR *before* the changes are made.
- Only one Travel_OrderReshop call here — there is no separate "pricing" Reshop as in the fare driven flow; the amounts returned by this single Reshop are the ones to pay.
- `ReshopParameters/Notices/PricingParameters@AutoExchRequestInd="true"` is for **Accelya carriers** only (grey-highlighted in the source); omit for others.
- `Request/OrderItemRefID` at the top level of Travel_OrderReshopRQ carries the **OrderID** (`QF081HQXKHUA4`), while `DeleteOrderItem/OrderItemRefID` carries the actual **order item** ID — same element name, different values.
- `AircraftScheduledDateTime` is required on `Departure` only (no arrival time), in ISO local form `YYYY-MM-DDThh:mm:ss`; Air_MultiAvailability gives dates as `DDMMYY` and times as `hhmm` — convert.
- Marketing vs operating carrier: use `marketingCompany/identifier` (QF), not `operatingCompany/identifier` (EK), for `MarketingCarrierInfo/CarrierDesigCode`.
- Negative `DifferentialAmountDue/Amount` (residual value) is not auto-refundable for every carrier — check the Features per Carrier spreadsheet; netting support is listed in the same spreadsheet.
- Do not infer refund direction from the sign of the tax total alone: use `CollectionInd`.
- `RetainServiceID` content is use-case dependent (bound ancillaries/seats) — see the Travel_OrderReshop RQ (Equivalent to shopping) section; services not listed are lost with the deleted order item.
