# Order Retrieve and the Amadeus NDC PNR

> Source: WBS Implementation Guide NDC[X] v1.5, sections: Retrieving an order with Travel_OrderRetrieve; How to identify an NDC booking in PNR_Reply; Agency Contact; Passenger Contact Refused; How to add CUIL/CUIT info on OrderCreate; Mixed content: Car and Hotel segments; Adding an AIAN to an NDC booking.

## 1. Retrieving an order with Travel_OrderRetrieve

The Amadeus Travel Platform allows to retrieve an order either from an OrderID, or from the associated Amadeus PNR record locator.

### 1.1 Retrieving an order from an Airline OrderID

Key: `Request/Order/OrderID` + `Request/Order/OwnerCode`.

```xml
<AMA_TravelOrderRetrieveRQ>
  <Party>
    <!-- ...truncated -->
  </Party>
  <Request>
    <Order>
      <OrderID>06X00ORDERID00</OrderID>
      <OwnerCode>6X</OwnerCode>
    </Order>
  </Request>
</AMA_TravelOrderRetrieveRQ>
```

### 1.2 Retrieving an order from an Amadeus NDC PNR

Key: `Request/OrderFilterCriteria/BookingRefFilterCriteria/BookingID` = the Amadeus PNR record locator, with `BookingEntity/Org/OrgID` = `1A` (Amadeus).

```xml
<AMA_TravelOrderRetrieveRQ>
  <Party>
    <Sender>
      <!-- ...truncated -->
  </Party>
  <Request>
    <OrderFilterCriteria>
      <BookingRefFilterCriteria>
        <BookingID>1A_PNR</BookingID>
        <BookingEntity>
          <Org>
            <OrgID>1A</OrgID>
          </Org>
        </BookingEntity>
      </BookingRefFilterCriteria>
    </OrderFilterCriteria>
  </Request>
</AMA_TravelOrderRetrieveRQ>
```

## 2. How to identify an NDC booking in PNR_Reply

Field mappings below pair the Edifact `PNR_Reply` path with the equivalent `AMA_TravelOrderViewRS` path. Example values come from the same booking sample unless noted.

### 2.1 PNR Control Number and Order ID

There are two `pnrHeader/reservationInfo/reservation` occurrences: one for the Amadeus PNR (`companyId` = `1A`), one for the airline/NDC record (`companyId` = carrier code) carrying the NDC tag.

| PNR_Reply XPath | Meaning | Example value |
|---|---|---|
| `/PNR_Reply/pnrHeader/reservationInfo/reservation/companyId` | Owning system of this reservation reference; `1A` = Amadeus PNR | `1A` |
| `/PNR_Reply/pnrHeader/reservationInfo/reservation/controlNumber` | Amadeus PNR record locator | `2VLTTZ` |
| `/PNR_Reply/pnrHeader/reservationInfo/reservation/date` | PNR creation date (DDMMYY) | `290524` |
| `/PNR_Reply/pnrHeader/reservationInfo/reservation/time` | PNR creation time (HHMM) | `1658` |
| `/PNR_Reply/pnrHeader/reservationInfo/reservation/companyId` (2nd occurrence) | Airline owner code | `6X` |
| `/PNR_Reply/pnrHeader/reservationInfo/reservation/controlNumber` (2nd occurrence) | Airline NDC reference; contains the airline OrderID | `6XA016HOF8X3A5` |
| `/PNR_Reply/pnrHeader/reservationInfo/reservation/controlType` | **NDC Tag** — value `N` identifies the booking as NDC | `N` |

| AMA_TravelOrderViewRS XPath | Meaning | Example value |
|---|---|---|
| `/AMA_TravelOrderViewRS/Response/Order/OrderID` | Airline OrderID | `6X016HOF8X3A5` |
| `/AMA_TravelOrderViewRS/Response/Order/OwnerCode` | Order owner (airline) | `6X` |
| `.../Order/BookingRef/BookingID` (Org `F1`) | Aggregator booking reference | `ZOF8X3` |
| `.../Order/BookingRef/BookingEntity/Org/@OrgID` + `Name` | `F1` / `Farelogix` | `F1`, `Farelogix` |
| `.../Order/BookingRef/BookingID` (Carrier) | Airline PNR / booking reference | `MNN1YH` |
| `.../Order/BookingRef/BookingEntity/Carrier/AirlineDesigCode` + `Name` | `6X` / `Airline` | `6X`, `Airline` |
| `.../Order/BookingRef/BookingID` (Org `1A`) | Amadeus PNR record locator | `2VLTTZ` |
| `.../Order/BookingRef/BookingEntity/Org/@OrgID` + `Name` | `1A` / `Amadeus` | `1A`, `Amadeus` |

PNR_Reply excerpt:

```xml
<pnrHeader>
  <reservationInfo>
    <reservation>
      <companyId>1A</companyId>
      <controlNumber>2VLTTZ</controlNumber>
      <date>290524</date>
      <time>1658</time>
    </reservation>
  </reservationInfo>
</pnrHeader>
<pnrHeader>
  <reservationInfo>
    <reservation>
      <companyId>6X</companyId>
      <controlNumber>6XA016HOF8X3A5</controlNumber>
      <controlType>N</controlType>   <!-- NDC Tag -->
    </reservation>
  </reservationInfo>
</pnrHeader>
```

AMA_TravelOrderViewRS excerpt:

```xml
<OrderID>6X016HOF8X3A5</OrderID>
<OwnerCode>6X</OwnerCode>
<BookingRef>
  <BookingID>ZOF8X3</BookingID>
  <BookingEntity>
    <Org OrgID="F1">
      <Name>Farelogix</Name>
    </Org>
  </BookingEntity>
</BookingRef>
<BookingRef>
  <BookingID>MNN1YH</BookingID>
  <BookingEntity>
    <Carrier>
      <AirlineDesigCode>6X</AirlineDesigCode>
      <Name>Airline</Name>
    </Carrier>
  </BookingEntity>
</BookingRef>
<BookingRef>
  <BookingID>2VLTTZ</BookingID>
  <BookingEntity>
    <Org OrgID="1A">
      <Name>Amadeus</Name>
    </Org>
  </BookingEntity>
</BookingRef>
```

### 2.2 Passenger Information

| PNR_Reply XPath (under `/PNR_Reply/travellerInfo`) | Meaning | Example value |
|---|---|---|
| `elementManagementPassenger/reference/qualifier` | Reference qualifier; `PT` = passenger | `PT` |
| `elementManagementPassenger/reference/number` | Passenger reference number (tattoo) | `1` |
| `elementManagementPassenger/segmentName` | Element type; `NM` = name element | `NM` |
| `elementManagementPassenger/lineNumber` | PNR line number | `1` |
| `passengerData/travellerInformation/traveller/surname` | Surname | `TEST` |
| `passengerData/travellerInformation/traveller/quantity` | Number of travellers under the name element | `1` |
| `passengerData/travellerInformation/passenger/firstName` | Given name | `NDCGOLD` |
| `passengerData/travellerInformation/passenger/type` | PTC | `ADT` |
| `enhancedPassengerData/enhancedTravellerInformation/travellerNameInfo/quantity` | Quantity | `1` |
| `enhancedPassengerData/enhancedTravellerInformation/travellerNameInfo/type` | PTC | `ADT` |
| `.../otherPaxNamesDetails/nameType` | Name type; `UN` | `UN` |
| `.../otherPaxNamesDetails/referenceName` | Reference name flag | `Y` |
| `.../otherPaxNamesDetails/displayedName` | Displayed name flag | `Y` |
| `.../otherPaxNamesDetails/surname` | Surname | `TEST` |
| `.../otherPaxNamesDetails/givenName` | Given name | `NDCGOLD` |

| AMA_TravelOrderViewRS XPath (under `/Response/DataLists/PaxList/Pax`) | Meaning | Example value |
|---|---|---|
| `PaxID` | Passenger ID used by all refs | `T1` |
| `PTC` | Passenger type code | `ADT` |
| `Birthdate` | Date of birth (`YYYY-MM-DD`) | `2003-05-01` |
| `ContactInfoRefID` | Ref into `ContactInfoList/ContactInfo/ContactInfoID` | `CI1` |
| `Individual/IndividualID` | Individual ID | `ID1` |
| `Individual/Birthdate` | Date of birth | `2003-05-01` |
| `Individual/GenderCode` | Gender | `M` |
| `Individual/GivenName` | Given name | `NDCGOLD` |
| `Individual/Surname` | Surname | `TEST` |

### 2.3 Segments

| PNR_Reply XPath (under `/PNR_Reply/originDestinationDetails/itineraryInfo`) | Meaning | Example value |
|---|---|---|
| `elementManagementItinerary/reference/qualifier` | `ST` = segment | `ST` |
| `elementManagementItinerary/reference/number` | Segment reference number | `1` |
| `elementManagementItinerary/segmentName` | `AIR` = air segment | `AIR` |
| `elementManagementItinerary/lineNumber` | PNR line number | `2` |
| `travelProduct/product/depDate` | Departure date (DDMMYY) | `310724` |
| `travelProduct/product/depTime` | Departure time (HHMM) | `1545` |
| `travelProduct/product/arrDate` | Arrival date (DDMMYY) | `010824` |
| `travelProduct/product/arrTime` | Arrival time (HHMM) | `0555` |
| `travelProduct/product/dayChangeIndicator` | Day change | `1` |
| `travelProduct/boardpointDetail/cityCode` | Departure station | `ORD` |
| `travelProduct/offpointDetail/cityCode` | Arrival station | `LHR` |
| `travelProduct/companyDetail/identification` | Marketing carrier | `6X` |
| `travelProduct/productDetails/identification` | Flight number | `929` |
| `travelProduct/productDetails/classOfService` | RBD / booking class | `L` |

| AMA_TravelOrderViewRS XPath (under `/Response/DataLists/PaxSegmentList/PaxSegment`) | Meaning | Example value |
|---|---|---|
| `PaxSegmentID` | Segment ID used by refs | `S2` |
| `SecureFlightInd` | Secure Flight indicator | `true` |
| `Duration` | ISO 8601 duration | `PT8H10M` |
| `CabinType/CabinTypeCode` | Cabin code at segment level (here mirrors RBD) | `L` |
| `Dep/IATA_LocationCode` | Departure airport | `ORD` |
| `Dep/StationName` | Departure station name | `Chicago OHare International Apt, US` |
| `Dep/TerminalName` | Departure terminal | `1` |
| `Dep/AircraftScheduledDateTime` | Scheduled departure | `2024-07-31T15:45:00` |
| `Arrival/IATA_LocationCode` | Arrival airport | `LHR` |
| `Arrival/StationName` | Arrival station name | `London Heathrow Apt, GB` |
| `Arrival/TerminalName` | Arrival terminal | `2` |
| `Arrival/AircraftScheduledDateTime` | Scheduled arrival | `2024-08-01T05:55:00` |
| `MarketingCarrierInfo/CarrierDesigCode` | Marketing carrier | `6X` |
| `MarketingCarrierInfo/CarrierName` | Carrier name | `Airlines` |
| `MarketingCarrierInfo/MarketingCarrierFlightNumberText` | Flight number | `929` |

Fare basis / RBD live outside the segment list, under `AMA_TravelOrderViewRS/Response/Order/OrderItem/FareDetail/FareComponent/FareBasis`:

| XPath | Meaning | Example value |
|---|---|---|
| `FareBasis/FareBasisCode/@refs` | Ref to the fare group | `FG1` |
| `FareBasis/FareBasisCode/Code` | Fare basis code | `LKX06LGT` |
| `FareBasis/RBD` | Booking class — maps to PNR `classOfService` | `L` |
| `FareBasis/CabinType/CabinTypeCode` | Cabin code | `Y` |
| `FareBasis/CabinType/CabinTypeName` | Cabin name | `Economy` |

### 2.4 Contact Information

In the PNR contacts appear as SSR elements (`CTCM` for mobile phone, `CTCE` for email) under `/PNR_Reply/dataElementsMaster/dataElementsIndiv`. In the Order view they appear as one `ContactInfo` entry.

| PNR_Reply XPath (under `dataElementsIndiv`) | Meaning | Example value |
|---|---|---|
| `elementManagementData/reference/qualifier` | `OT` = other element | `OT` |
| `elementManagementData/reference/number` | Element reference number (`6` = CTCM, `7` = CTCE) | `6` / `7` |
| `elementManagementData/segmentName` | `SSR` | `SSR` |
| `elementManagementData/lineNumber` | PNR line number (`9` = CTCM, `10` = CTCE) | `9` / `10` |
| `serviceRequest/ssr/type` | SSR code: `CTCM` = contact mobile, `CTCE` = contact email | `CTCM` / `CTCE` |
| `serviceRequest/ssr/status` | Status | `HK` |
| `serviceRequest/ssr/quantity` | Quantity | `1` |
| `serviceRequest/ssr/companyId` | Airline the SSR is sent to | `UA` |
| `serviceRequest/ssr/freeText` | Phone number, or email with `@` encoded as `//` | `3054996000` / `NDCGOLD//MYMAIL.COM` |
| `referenceForDataElement/reference/qualifier` + `number` | Passenger association (`PT` + tattoo) | `PT`, `1` |

| AMA_TravelOrderViewRS XPath (under `/Response/DataLists/ContactInfoList/ContactInfo`) | Meaning | Example value |
|---|---|---|
| `ContactInfoID` | ID referenced by `Pax/ContactInfoRefID` | `CI1` |
| `Phone/PhoneNumber` | Phone number | `3054996000` |
| `EmailAddress/EmailAddressText` | Email (real `@`) | `NDCGOLD@MYMAIL.COM` |

```xml
<!-- PNR_Reply: CTCM (mobile) -->
<dataElementsIndiv>
  <elementManagementData>
    <reference>
      <qualifier>OT</qualifier>
      <number>6</number>
    </reference>
    <segmentName>SSR</segmentName>
    <lineNumber>9</lineNumber>
  </elementManagementData>
  <serviceRequest>
    <ssr>
      <type>CTCM</type>
      <status>HK</status>
      <quantity>1</quantity>
      <companyId>UA</companyId>
      <freeText>3054996000</freeText>
    </ssr>
  </serviceRequest>
  <referenceForDataElement>
    <reference>
      <qualifier>PT</qualifier>
      <number>1</number>
    </reference>
  </referenceForDataElement>
</dataElementsIndiv>
<!-- PNR_Reply: CTCE (email) -->
<dataElementsIndiv>
  <elementManagementData>
    <reference>
      <qualifier>OT</qualifier>
      <number>7</number>
    </reference>
    <segmentName>SSR</segmentName>
    <lineNumber>10</lineNumber>
  </elementManagementData>
  <serviceRequest>
    <ssr>
      <type>CTCE</type>
      <status>HK</status>
      <quantity>1</quantity>
      <companyId>UA</companyId>
      <freeText>NDCGOLD//MYMAIL.COM</freeText>
    </ssr>
  </serviceRequest>
  <referenceForDataElement>
    <reference>
      <qualifier>PT</qualifier>
      <number>1</number>
    </reference>
  </referenceForDataElement>
</dataElementsIndiv>
```

## 3. Agency Contact

Travel agencies can send their own contact information in the Travel_Order API. Supported fields:

| Data | XPath |
|---|---|
| Agency Name | `/AMA_TravelOrderCreateRQ/Party/Sender/TravelAgency/Name` |
| Street Text | `/AMA_TravelOrderCreateRQ/Party/Sender/TravelAgency/ContactInfo/StreetText` |
| City | `/AMA_TravelOrderCreateRQ/Party/Sender/TravelAgency/ContactInfo/PostalAddress/CityName` |
| Country Code | `/AMA_TravelOrderCreateRQ/Party/Sender/TravelAgency/ContactInfo/PostalAddress/CountryCode` |
| Phone # | `/AMA_TravelOrderCreateRQ/Party/Sender/TravelAgency/ContactInfo/Phone/PhoneNumber` |
| Email Address | `/AMA_TravelOrderCreateRQ/Party/Sender/TravelAgency/ContactInfo/Phone/EmailAddress/EmailAddressText` |

If the agency information is not present in the input of the Travel_Order API, the travel platform looks in the Office profile to retrieve the missing information (if populated). Office profile fields checked:

- `NAM` for the travel agency name
- `AD1` and `AD2` for the street text
- `AD3` for the city name
- `PHO` for the phone number
- `EML` for the email address

The phone number and the email address are then stored in APA elements in the Travel Order PNR.

```xml
<AMA_TravelOrderCreateRQ xmlns:trav="http://xml.amadeus.com/2010/06/Travel_OrderCreateRQ_v1">
  <Party>
    <Sender>
      <TravelAgency>
        <!-- ...TRUNCATED -->
        <Name>Amadeus</Name>
        <ContactInfo>
          <PostalAddress>
            <StreetText>Salvador de Madariaga 1</StreetText>
            <CityName>Madrid</CityName>
            <CountryCode>ES</CountryCode>
            <PostalCode>28027</PostalCode>
          </PostalAddress>
          <Phone>
            <PhoneNumber>34915820100</PhoneNumber>
          </Phone>
          <EmailAddress>
            <EmailAddressText>amadeus@es.amadeus.com</EmailAddressText>
          </EmailAddress>
        </ContactInfo>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <!-- ...TRUNCATED -->
  </Request>
</AMA_TravelOrderCreateRQ>
```

## 4. Passenger Contact Refused

Passenger contact info can be refused via Travel_OrderCreate using `ContactRefusedInd`. Some carriers do not allow all pax to refuse sharing this information — refer to the differences per carrier spreadsheet, column/entry `CTCR`.

```xml
<AMA_TravelOrderCreateRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderCreateRQ_v1">
  <Party />
  <Request>
    <CreateOrder>
      <SelectedOffer>
        <!-- ...truncated -->
      </SelectedOffer>
    </CreateOrder>
    <DataLists>
      <PaxList>
        <Pax>
          <PaxID>1</PaxID>
          <PTC>ADT</PTC>
          <Birthdate>1993-11-17</Birthdate>
          <ContactInfo>
            <ContactRefusedInd>TRUE</ContactRefusedInd>
            <Phone>
              <LabelText>Mobile</LabelText>
              <PhoneNumber>3054996000</PhoneNumber>
            </Phone>
          </ContactInfo>
          <Individual>
            <GenderCode>M</GenderCode>
            <TitleName>MR</TitleName>
            <GivenName>MARCO</GivenName>
            <Surname>JACKSON</Surname>
          </Individual>
        </Pax>
        <Pax>
          <PaxID>2</PaxID>
          <PTC>ADT</PTC>
          <Birthdate>2000-11-14</Birthdate>
          <ContactInfo>
            <ContactRefusedInd>TRUE</ContactRefusedInd>
            <Phone>
              <LabelText>Mobile</LabelText>
              <PhoneNumber>3054996000</PhoneNumber>
            </Phone>
          </ContactInfo>
          <Individual>
            <GenderCode>F</GenderCode>
            <TitleName>MRS</TitleName>
            <GivenName>MILEY</GivenName>
            <Surname>JACKSON</Surname>
          </Individual>
        </Pax>
      </PaxList>
    </DataLists>
  </Request>
</AMA_TravelOrderCreateRQ>
```

## 5. How to add CUIL/CUIT info on OrderCreate

Market specificity for several countries in Latin America (Argentina, Bolivia, Peru) when there is an international travel. A tax data (payer's fiscal number) must be included on the PNR before issuing the documents. In webservices it is known as the FS element (i.e. `FS R/CUIT21818160`).

If the data is missing, at issuing time the error returned is:

> Document issuance failed. Root cause: Impuesto PAIS requires that purchasers CUIL, CUIT or CDI is provided for this passenger.

Each country has a specific way of entering the details within the `EntitlementDocument` section. For specific formats in a particular country, refer to the Amadeus Service Hub - Market Specifics for GHE Service.

`EntitlementDocument` is sent inside `Request/DataLists/PaxList` (per passenger):

```xml
<AMA_TravelOrderCreateRQ>
  <Party>
    <!-- ...truncated -->
  </Party>
  <Request>
    <CreateOrder>
      <!-- ...truncated -->
    </CreateOrder>
    <DataLists>
      <PaxList>
        <!-- ...truncated -->
        <EntitlementDocument>
          <DocumentType>TaxIdentification</DocumentType>
          <Number>21818160</Number>
          <SubDocumentType>CUIT</SubDocumentType>
        </EntitlementDocument>
        <!-- ...truncated -->
      </PaxList>
    </DataLists>
  </Request>
</AMA_TravelOrderCreateRQ>
```

Argentina & Peru:

```xml
<EntitlementDocument>
  <DocumentType>TaxIdentification</DocumentType>
  <Number>21818160</Number>
  <SubDocumentType>CUIT</SubDocumentType>
</EntitlementDocument>
```

Bolivia (note the inverted usage: name in `Number`, fiscal number in `SubDocumentType`):

```xml
<EntitlementDocument>
  <DocumentType>TaxIdentification</DocumentType>
  <Number>MOLINA FRANCISCO</Number>
  <SubDocumentType>21234454</SubDocumentType>
</EntitlementDocument>
```

## 6. Mixed content: Car and Hotel segments

Car and Hotel segments are now in the scope of temporary mixed PNR with NDC.

## 7. Adding an AIAN to an NDC booking

Currently there is a limitation with adding the AIAN field via the NDC Travel APIs, as this is a back-office requirement which does not pertain to NDC orders. This information:

- will NOT be sent to the airlines
- will NOT be returned in the Travel_OrderRetrieve response

Use PNR_AddMultiElements instead. Flow: after the order has been created via Travel_OrderCreate, locate the NDC PNR returned in the Travel_OrderViewRS response (the `BookingRef` whose `BookingEntity/Org/@OrgID` = `1A`).

```xml
<AMA_TravelOrderViewRS>
  <!-- ..... -->
  <Order>
    <OrderID>AA001HD7ZPWA2</OrderID>
    <OwnerCode>AA</OwnerCode>
    <!-- ...truncated -->
    <BookingRef>
      <BookingID>2VQVWU</BookingID>
      <BookingEntity>
        <Org OrgID="1A">
          <Name>Amadeus</Name>
        </Org>
      </BookingEntity>
    </BookingRef>
    <!-- ..... -->
</AMA_TravelOrderViewRS>
```

### Session management (STATEFUL REQUIRED)

By default, all NDC Travel APIs are **stateless** sessions. However, since the PNR needs to be updated using PNR_AddMultiElements, this **requires a stateful session**. Two ways to handle session management:

1. Start the stateful session at PNR_Retrieve and close the session after Travel_OrderPay.
2. Send PNR_Retrieve and PNR_AddMultiElements as a stateful session, close the session, and continue with the stateless flow to submit the payment.

### PNR_Retrieve (stateful)

`retrieve/type` = `2`, `controlNumber` = the Amadeus PNR from the `1A` BookingRef.

```xml
<PNR_Retrieve>
  <retrievalFacts>
    <retrieve>
      <type>2</type>
    </retrieve>
    <reservationOrProfileIdentifier>
      <reservation>
        <controlNumber>2VQVWU</controlNumber>
      </reservation>
    </reservationOrProfileIdentifier>
  </retrievalFacts>
</PNR_Retrieve>
```

### PNR_AddMultiElements (stateful) — TK OK + RF + AI (accounting/AIAN)

```xml
<PNR_AddMultiElements>
  <pnrActions>
    <optionCode>11</optionCode>
  </pnrActions>
  <dataElementsMaster>
    <marker1/>
    <dataElementsIndiv>
      <elementManagementData>
        <segmentName>TK</segmentName>
      </elementManagementData>
      <ticketElement>
        <ticket>
          <indicator>OK</indicator>
        </ticket>
      </ticketElement>
    </dataElementsIndiv>
    <dataElementsIndiv>
      <elementManagementData>
        <segmentName>RF</segmentName>
      </elementManagementData>
      <freetextData>
        <freetextDetail>
          <subjectQualifier>3</subjectQualifier>
          <type>P22</type>
        </freetextDetail>
        <longFreetext>OFFICE ID</longFreetext>
      </freetextData>
    </dataElementsIndiv>
    <dataElementsIndiv>
      <elementManagementData>
        <reference>
          <qualifier>OT</qualifier>
          <number>1</number>
        </reference>
        <segmentName>AI</segmentName>
      </elementManagementData>
      <accounting>
        <account>
          <number>12345566</number>
        </account>
      </accounting>
    </dataElementsIndiv>
  </dataElementsMaster>
</PNR_AddMultiElements>
```

TKOK, Received From, Office ID and AIAN number are all required to successfully add the information to the Edifact PNR.

## Gotchas

- The NDC discriminator in PNR_Reply is `pnrHeader/reservationInfo/reservation/controlType` = `N`. There are multiple `pnrHeader` blocks — do not assume one; match on `companyId` (`1A` = Amadeus PNR locator, carrier code = airline NDC reference containing the OrderID).
- `Order/BookingRef` is repeated with different `BookingEntity` types: `Org OrgID="F1"` (Farelogix aggregator ref), `Carrier/AirlineDesigCode` (airline booking ref), `Org OrgID="1A"` (Amadeus PNR). Select by entity, never by position.
- Email in the Edifact PNR SSR `CTCE` freeText encodes `@` as `//` (`NDCGOLD//MYMAIL.COM`), while `ContactInfoList/EmailAddress/EmailAddressText` uses the real `@`.
- Segment-level `PaxSegment/CabinType/CabinTypeCode` (`L` in the sample) is not the same value as the fare-level `FareBasis/CabinType/CabinTypeCode` (`Y`/Economy); the PNR `classOfService` corresponds to `FareBasis/RBD`.
- PNR_Reply dates/times are DDMMYY / HHMM; OrderView uses ISO 8601 (`2024-07-31T15:45:00`, `PT8H10M`, `2003-05-01`).
- The Agency Contact table in the source lists Email Address under `.../ContactInfo/Phone/EmailAddress/EmailAddressText` (nested under `Phone`), while the sample XML places `EmailAddress` as a sibling of `Phone` under `ContactInfo`. Prefer the sample structure.
- Bolivia's CUIL/CUIT mapping inverts the semantics: passenger/payer name goes in `Number` and the fiscal number in `SubDocumentType`.
- `ContactRefusedInd` is not universally supported — check the per-carrier differences spreadsheet (`CTCR`) before sending it.
- AIAN is fire-and-forget for back office only: it never reaches the airline and never comes back in Travel_OrderRetrieve, so do not read it back to verify.
- Adding the AIAN forces a stateful session around PNR_Retrieve / PNR_AddMultiElements — everything else in the NDC flow is stateless by default.
