# Shopping Options and Fare Handling (Fare_MasterPricerTravelBoardSearch)

> Source: WBS Implementation Guide NDC[X] v1.5, sections: Prime Booking Functionality > Shopping options (Search By Frequent Flyer, Exclude NDC, NDC only, Exclude specific NDC carriers + Include NDC carriers, Fare Options, SAF Bundles, Mini Rules - PriceType MNR, Search by Spanish Resident, Search by fare with refundability and exchangeability or non-exchangeability, PTCs, Passenger Reference IDs, Airline Fare Families, Amenities in MasterPricer TravelBoard, Interline Offers in the Shopping Response)

The options listed here are not an exhaustive list. For the full option set, see the MasterPricer TravelBoard API user guide on the Amadeus for Developers Portal.

## Summary table

| Option | Path | Value | Carrier restriction |
|---|---|---|---|
| Search by Frequent Flyer | `/Fare_MasterPricerTravelBoardSearch/ndcQueryParameters/ndcSpecialParameters/ndcLoyaltyProgram/frequentTravellerDetails` | `carrier`=FF card airline, `number`=card number, `type`=1 | NDC content only. QF and AA: cardholder name mandatory, else FF data ignored |
| Exclude NDC (XND) | `/Fare_MasterPricerTravelBoardSearch/fareOptions/pricingTickInfo/pricingTicketing/priceType` | `XND` | NDC-activated OID |
| NDC only | `/Fare_MasterPricerTravelBoardSearch/numberOfUnit/unitNumberDetail` | `numberOfUnits`=100 (must be exactly 100), `typeOfUnit`=NDC | NDC-activated OID |
| Exclude NDC for a carrier | `/Fare_MasterPricerTravelBoardSearch/travelFlightInfo/companyIdentity` | `carrierQualifier`=XNDC + `carrierId` | MPTB 23.1+ |
| Include/mandatory NDC carrier | `/Fare_MasterPricerTravelBoardSearch/travelFlightInfo/companyIdentity` | `carrierQualifier`=MNDC + `carrierId` | MPTB 23.1+ |
| Public fare | `.../pricingTicketing/priceType` | `RP` | none |
| Unifares (private/negotiated) | `.../pricingTicketing/priceType` | `RU` | OTAs only for AF private fares; IT fares → list PTC `IIT` first |
| Corporate code | `.../pricingTicketing/priceType` | `RW` | Airline association possible with MPTB 19.3+ |
| Corporate Identifier (CLID/OIN/ABN/QCI) | `/Fare_MasterPricerTravelBoardSearch/fareOptions/frequentTravellerInfo/frequentTravellerDetails` | `carrier`=airline, `number`=CLID, `type`=2 | 1 CLID per NDC airline; AF/KL call it OIN, QF calls it ABN or QCI |
| Refundable fares | `.../pricingTicketing/priceType` | `RF` | carrier-dependent |
| Exchangeable fares | `.../pricingTicketing/priceType` | `RB` | carrier-dependent |
| Non-exchangeable fares | `.../pricingTicketing/priceType` | `NRB` | carrier-dependent |
| Mini Rules | `.../pricingTicketing/priceType` | `MNR` | NDC: refundability + exchangeability with penalties only; carrier must return it |
| SAF bundles (fare family upsell) | `/Fare_MasterPricerTravelBoardSearch/fareOptions/feeIdDescription/feeId` | `feeType`=FFI + `feeIdNumber`; `feeType`=UPH + `feeIdNumber` | AF / KL only |
| Spanish Resident | `/Fare_MasterPricerTravelBoardSearch/paxReference/ptc` | `ADT` + `RC` + `F1` | Iberia (IB) |
| Interline offers (itinerary level) | `/Fare_MasterPricerTravelBoardSearch/travelFlightInfo/companyIdentity` | `carrierQualifier`=M, `carrierId` list incl. `YY` | carrier must support interline |
| Interline offers (segment level) | `/Fare_MasterPricerTravelBoardSearch/itinerary/flightInfo/companyIdentity` | `carrierQualifier`=M, `carrierId` list incl. `YY` | no restriction for NDC content |

## Search By Frequent Flyer

New option available **exclusively for NDC content** through Master Pricer Travel Board. Lets airlines offer tailored content to travel sellers based on frequent flyer information.

Carrier rule: for **Qantas (QF)** and **American Airlines (AA)**, providing the frequent flyer cardholder's **name is mandatory**. If the name is missing, the frequent flyer details are **disregarded**.

```xml
<ndcQueryParameters>
  <ndcMarker>
    <reference>NDC</reference>
  </ndcMarker>
  <ndcSpecialParameters>
    <ndcParameterIdentification>
      <itemNumberDetails>
        <number>1</number>
      </itemNumberDetails>
    </ndcParameterIdentification>
    <ndcLoyaltyProgram>
      <frequentTravellerDetails>
        <carrier>QF</carrier>          <!-- frequent flyer card airline code -->
        <number>123456</number>        <!-- frequent flyer card number -->
        <type>1</type>                 <!-- always 1 for frequent flyer card -->
      </frequentTravellerDetails>
    </ndcLoyaltyProgram>
    <travellerDetails>
      <ptc>ADT</ptc>
      <traveller>
        <givenName>JOHN</givenName>                        <!-- FF cardholder given name; first letter is enough -->
        <uniqueCustomerIdentifier>1</uniqueCustomerIdentifier> <!-- passenger reference -->
        <surname>DOE</surname>                             <!-- FF cardholder surname -->
      </traveller>
    </travellerDetails>
  </ndcSpecialParameters>
</ndcQueryParameters>
```

## Exclude NDC (XND)

On an NDC-activated OID, include a tag to **exclude NDC from the recommendations**.

Path: `//Fare_MasterPricerTravelBoardSearch/fareOptions/pricingTickInfo/pricingTicketing/priceType="XND"`

```xml
<fareOptions>
  <pricingTickInfo>
    <pricingTicketing>
      <priceType>XND</priceType>
    </pricingTicketing>
  </pricingTickInfo>
</fareOptions>
```

## NDC only

On an NDC-activated OID, include a tag to **request exclusively NDC recommendations**.

Path: under `//Fare_MasterPricerTravelBoardSearch/numberOfUnit`

```xml
<unitNumberDetail>
  <numberOfUnits>100</numberOfUnits>
  <typeOfUnit>NDC</typeOfUnit>
</unitNumberDetail>
```

The value `100` in `numberOfUnits` returns 100% of NDC recommendations. **This value must always be 100.** If a different value is sent, the criteria is **ignored** and the response returns both NDC and EDIFACT recommendations.

## Exclude specific NDC carriers + Include NDC carriers

WBS users can exclude or include airlines for EDIFACT or NDC content search, respecting their traffic capacity agreements with airlines. Full flexibility to control shopping traffic to airlines by content type. Example: search both EDIFACT and NDC but exclude NDC for airline X — no `AirShoppingRQ` is then sent to airline X.

Supported with **Fare_MasterPricerTravelBoard version 23.1 or higher**.

- `MNDC` — mandatory/include NDC carrier
- `XNDC` — exclude NDC carrier

```xml
<travelFlightInfo>
  <companyIdentity>
    <carrierQualifier>MNDC</carrierQualifier>
    <carrierId>SQ</carrierId>
  </companyIdentity>
  <companyIdentity>
    <carrierQualifier>XNDC</carrierQualifier>
    <carrierId>UA</carrierId>
  </companyIdentity>
</travelFlightInfo>
```

## Fare Options

NDC supports the following types of fares:

1. Public (RP)
2. Unifares (RU) — Private or Negotiated
3. Corporate (RW)
4. (source list item truncated: "processing)")
5. Corporate Identifier, also known as a CLID, OIN or QBC/QCI identifier
6. Airline Promotion Code — original and discount price of an offer are both returned in Master Pricer Travel Board output

### Public (RP)

Nothing specific to NDC. It is a published fare.

```xml
<fareOptions>
  <pricingTickInfo>
    <pricingTicketing>
      <priceType>RP</priceType>
    </pricingTicketing>
  </pricingTickInfo>
</fareOptions>
```

### Unifares (RU) — Private or Negotiated

- OTAs only — Air France private fares (RU) restricted at shopping time.
- IT Fares — With NDC, the **1st private fare listed in the MPTB request** is the one sent to the provider. If targeting IT fares (`IIT`), ensure the PTC `IIT` is listed first.

### Corporate Code (RW)

For NDC content, corporate fare is triggered in different ways depending on the NDC airline.

With **MPTB version 19.3 or higher**, the airlines a given corporate code belongs to can be specified:

- If the airline code is specified, the corporate code is sent **only** to the selected airline. Various corporate codes can be assigned, each linked to a specific airline.
- If the airline is missing, the corporate code is sent to **all** airlines accepting such "generic" corporate codes.

Not all corporate codes are sent to all NDC providers:

- If a given airline accepts all corporate codes specified in the input, all are sent to its NDC provider.
- If the airline accepts fewer than specified, the request sends the **first N** corporate codes, where N is the maximum number supported by that provider.

Number of corporate codes accepted per carrier: see the Features per carrier spreadsheet, feature row labelled **"Input – Corporate codes"**.

(diagram in source: image of the "Input – Corporate codes" row in the Features per carrier spreadsheet)

### Corporate Identifier (CLID, OIN, ABN/QCI)

Triggered in Master Pricer in the `frequentTravellerDetails` section of the **frequentTravellerInfo (FTI)** segment, by:

- The airline associated to the CLID in the `carrier` field
- The CLID number in the `number` field
- The qualifier `2` (standing for CLID) in the `type` field

```xml
<fareOptions>
  <pricingTickInfo/>
  <frequentTravellerInfo>
    <frequentTravellerDetails>
      <carrier>6X</carrier>              <!-- CLID associated airline code -->
      <number>YX018263442</number>       <!-- CLID value -->
      <type>2</type>                     <!-- CLID identifier (hardcode) -->
    </frequentTravellerDetails>
  </frequentTravellerInfo>
</fareOptions>
```

Limits:

- TA customers can enter as many CLIDs as Master Pricer grammar allows. **Master Pricer Verb allows max 99 CLIDs.**
- Availability biasing process accepts a maximum of **9 CLIDs of an airline and its partners** in total (e.g. if AF and SQ are partners, max 9 AF+SQ CLIDs combined). This is an IATA industry constraint. So far no observation of more than 9 CLIDs for an airline and its partners in total in PRD.
- **Only 1 CLID is supported by each NDC airline.** Amadeus Travel Platform sends the **first CLID** of an airline for its NDC content search; the airline's other CLIDs are ignored.
- The CLID **must be associated to an airline** in the MPTB query — the airline association routes the CLID to that airline.

Naming per carrier: for **AF/KL** the CLID is known as an **OIN** number. For **QF** it is known as an **ABN** or **QCI** number.

### Airline Promotion Code

Discount price: when an Airline Promotion Code is applied as one of the MasterPricer TravelBoard options, both the **original price and the discount price** are returned for the NDC offers.

## SAF Bundles (Sustainable Aviation Fuel — AF / KL)

Travel Sellers can book SAF bundle(s) via **Air France / KLM**. The SAF bundle(s) include one offer for the flight with **a SAF offer item for each leg**. Both offer items (air + SAF) are **mandatory to create the order**. There is **one SAF offer per pax and per bound**. A dedicated branded fare name is returned within `familyInformation` of the `Fare_MasterPricerTravelBoardSearch` response.

Note: the flow below starts with Fare_MasterPricerTravelBoard. If the required options are not included in the shopping request but the office id has already been activated by AF/KL to receive SAF bundles, these offers can also be returned in the **Travel Offer Price response** when the **"Upsell" shopping criteria** is included in the Travel Offer Price request.

### Prerequisites

- Agreement between Travel Seller and AF/KL. Activation of the SAF bundle is managed by AF/KL via the Travel Seller's **IATA number**.
- The office id used for MasterPricer TravelBoard must be updated to allow upsells at shopping time. Data profiles needed: **FAMILY UPSELL 3** and **FARE FAMILY INFO**. Request via the account manager, for **both MPT and ORC applications**.
- Default: offers with SAF might not be displayed (most of the time not the cheapest).
- Display is triggered by **Fare Family + Upsell Options** (see request below).

SAF bundles are considered **upsells** at shopping time and at offer price with the upsell shopping criteria. The total price consists of flight + SAF + taxes (**no breakdown of the SAF price at shopping**).

### Shopping request (SAF trigger)

```xml
<Fare_MasterPricerTravelBoardSearch>
  ...
  <fareOptions>
    <pricingTickInfo>
      <pricingTicketing>
        <priceType>RP</priceType>
      </pricingTicketing>
    </pricingTickInfo>
    <feeIdDescription>
      <feeId>
        <feeType>FFI</feeType>
        <feeIdNumber>3</feeIdNumber>
      </feeId>
      <feeId>
        <feeType>UPH</feeType>
        <feeIdNumber>3</feeIdNumber>
      </feeId>
    </feeIdDescription>
    <frequentTravellerInfo>
      <frequentTravellerDetails>
        <carrier>AF</carrier>
        <number>AMAZON</number>
        <type>2</type>
      </frequentTravellerDetails>
    </frequentTravellerInfo>
  </fareOptions>
  <travelFlightInfo>
    <companyIdentity>
      <carrierQualifier>M</carrierQualifier>
      <carrierId>AF</carrierId>
    </companyIdentity>
  </travelFlightInfo>
  ...
</Fare_MasterPricerTravelBoardSearch>
```

### Shopping response — SAF branded fare names in familyInformation

```xml
<Fare_MasterPricerTravelBoardSearchReply>
  ...
  <familyInformation>
    <refNumber>3</refNumber>
    <description>Light Extra SAF</description>
    <carrier>AF</carrier>
    <services>
      <reference>1</reference>   <!-- reference to service description -->
      <status>INC</status>
    </services>
  </familyInformation>
  <familyInformation>
    <refNumber>4</refNumber>
    <description>Standard Extra SAF</description>
    <carrier>AF</carrier>
    <services>
      <reference>1</reference>
      <status>INC</status>
    </services>
  </familyInformation>
  <familyInformation>
    <refNumber>5</refNumber>
    <description>Flex Extra SAF</description>
    <carrier>AF</carrier>
    <services>
      <reference>1</reference>
      <status>INC</status>
    </services>
  </familyInformation>
  ...
</Fare_MasterPricerTravelBoardSearchReply>
```

Reply namespace in the example: `xmlns="http://xml.amadeus.com/FMPTBR_23_2_1A"`.

### Shopping response — recommendation, service description, offers

```xml
<recommendation>
  <itemNumber>
    <itemNumberId><number>6</number></itemNumberId>
    <codeShareDetails><company>AF</company></codeShareDetails>
    <priceTicketing><priceType>N</priceType></priceTicketing>
  </itemNumber>
  <fareFamilyRef>
    <referencingDetail>
      <refQualifier>F</refQualifier>
      <refNumber>3</refNumber>
    </referencingDetail>
    <referencingDetail>
      <refNumber>3</refNumber>
    </referencingDetail>
  </fareFamilyRef>
  <recPriceInfo>
    <monetaryDetail><amount>1633.34</amount></monetaryDetail>  <!-- total: air + tax + SAF -->
    <monetaryDetail><amount>604.58</amount></monetaryDetail>
  </recPriceInfo>
  <segmentFlightRef>
    <referencingDetail><refQualifier>S</refQualifier><refNumber>1</refNumber></referencingDetail>
    <referencingDetail><refQualifier>S</refQualifier><refNumber>1</refNumber></referencingDetail>
    <referencingDetail><refQualifier>OI</refQualifier><refNumber>9</refNumber></referencingDetail>
    <referencingDetail><refQualifier>B</refQualifier><refNumber>1</refNumber></referencingDetail>
  </segmentFlightRef>
  ...
</recommendation>
...
<serviceFeesGrp>   <!-- description of SAF service -->
  <serviceTypeInfo>
    <carrierFeeDetails><type>OC</type></carrierFeeDetails>
  </serviceTypeInfo>
  <globalMessageMarker/>
  <serviceDetailsGrp>
    <serviceOptionInfo>
      <dataTypeInformation><subType>SAF</subType></dataTypeInformation>
    </serviceOptionInfo>
    <feeDescriptionGrp>
      <itemNumberInfo>
        <itemNumberDetails>
          <number>1</number>
          <type>SD</type>
        </itemNumberDetails>
      </itemNumberInfo>
      <serviceDescriptionInfo>
        <serviceRequirementsInfo>
          <serviceClassification>Z</serviceClassification>
          <serviceMarketingCarrier>AF</serviceMarketingCarrier>
          <serviceGroup>BD</serviceGroup>
        </serviceRequirementsInfo>
      </serviceDescriptionInfo>
      <commercialName>
        <freeTextQualification><textSubjectQualifier>3</textSubjectQualifier></freeTextQualification>
        <freeText>SUSTAINABLE_AVIATION_FUEL</freeText>
      </commercialName>
    </feeDescriptionGrp>
  </serviceDetailsGrp>
</serviceFeesGrp>
...
<offersGroup>
  <response>
    <applicationDetails>
      <internalId>d956d3b9-7d49-536a-96d3-b97d49131112</internalId>   <!-- Shopping Response ID -->
    </applicationDetails>
  </response>
  ...
  <offers>
    <offerDetails>
      <reference>9</reference>
      <uniqueOfferReference>TOhAktnyacRTC-8pCWQjQumD_1A_49175657-db44-4bb6-90b1-bd5b14ca4f75_1A_d845d2b9-6d38-425a-85d2-b96d380201fd</uniqueOfferReference> <!-- Offer ID for air + SAF -->
    </offerDetails>
    <timeLimits>
      <dateAndTimeDetails>
        <qualifier>OTL</qualifier>
        <date>090724</date>
        <time>0001</time>
      </dateAndTimeDetails>
    </timeLimits>
    <offerItems>
      <offerItemDetails><offerItemId>ac8e0ccd-f0eb-4ccc-8e0c-cdf0eb5cccbe</offerItemId></offerItemDetails> <!-- Air offer, all travelers -->
      <paxReference>
        <ptc>ADT</ptc>
        <traveller><ref>1</ref></traveller>
        <traveller><ref>2</ref></traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails><offerItemId>ef4a4eae-eef9-411a-8a4e-aeeef9711ad4</offerItemId></offerItemDetails> <!-- SAF bundle, 1st Adult, outbound -->
      <paxReference><ptc>ADT</ptc><traveller><ref>1</ref></traveller></paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails><offerItemId>df3e9e8a-06aa-42a7-be9e-8a06aaf2a7ed</offerItemId></offerItemDetails> <!-- SAF bundle, 2nd Adult, outbound -->
      <paxReference><ptc>ADT</ptc><traveller><ref>2</ref></traveller></paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails><offerItemId>bba86203-5fc5-46a7-a862-035fc526a74d</offerItemId></offerItemDetails> <!-- SAF bundle, 1st Adult, return -->
      <paxReference><ptc>ADT</ptc><traveller><ref>1</ref></traveller></paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails><offerItemId>cf2a1112-d968-4e24-aa11-12d968de24df</offerItemId></offerItemDetails> <!-- SAF bundle, 2nd Adult, return -->
      <paxReference><ptc>ADT</ptc><traveller><ref>2</ref></traveller></paxReference>
    </offerItems>
  </offers>
  ...
</offersGroup>
```

### SAF in Travel_OfferPrice

The Travel_OfferPrice response returns **one OfferID** for the air and SAF bundles: one `offerItem` for the air offer for all travelers, and several `offerItems` — one for each SAF bundle per bound and per pax.

```xml
<AMA_TravelOfferPriceRQ>
  <Request>
    <PricedOffer>
      <SelectedOffer>
        <OfferRefID>TOhAktnyacRTC-8pCWQjQumD_1A_49175657-db44-4bb6-90b1-bd5b14ca4f75_1A_d845d2b9-6d38-425a-85d2-b96d380201fd</OfferRefID>
        <OwnerCode>AF</OwnerCode>
        <ShoppingResponseRefID>d956d3b9-7d49-536a-96d3-b97d49131112</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemRefID>ac8e0ccd-f0eb-4ccc-8e0c-cdf0eb5cccbe</OfferItemRefID>
          <PaxRefID>1</PaxRefID>
          <PaxRefID>2</PaxRefID>
        </SelectedOfferItem>
        <SelectedOfferItem>
          <OfferItemRefID>ef4a4eae-eef9-411a-8a4e-aeeef9711ad4</OfferItemRefID>
          <PaxRefID>1</PaxRefID>
        </SelectedOfferItem>
        <SelectedOfferItem>
          <OfferItemRefID>df3e9e8a-06aa-42a7-be9e-8a06aaf2a7ed</OfferItemRefID>
          <PaxRefID>2</PaxRefID>
        </SelectedOfferItem>
        <SelectedOfferItem>
          <OfferItemRefID>bba86203-5fc5-46a7-a862-035fc526a74d</OfferItemRefID>
          <PaxRefID>1</PaxRefID>
        </SelectedOfferItem>
        <SelectedOfferItem>
          <OfferItemRefID>cf2a1112-d968-4e24-aa11-12d968de24df</OfferItemRefID>
          <PaxRefID>2</PaxRefID>
        </SelectedOfferItem>
      </SelectedOffer>
    </PricedOffer>
  </Request>
</AMA_TravelOfferPriceRQ>
```

### SAF in Travel_OrderCreate

`AMA_TravelOrderCreateRQ` uses `CreateOrder/SelectedOffer` with `OfferID`, `OwnerCode`=AF, `ShoppingResponseRefID`, and the same set of `SelectedOfferItem`/`OfferItemID` + `PaxRefID` pairs as OfferPrice (air item for pax 1 and 2, then one item per SAF bundle per pax per bound), followed by `DataLists`.

Example from source: `<OfferID>TOg0k8Tl0QR1Kx5DQMOYN0MC_1A_49175657-db44-4bb6-90b1-bd5b14ca4f75_1A_d845d2b9-6d38-425a-85d2-b96d380201fd</OfferID>`, `<ShoppingResponseRefID>49175657-db44-4bb6-90b1-bd5b14ca4f75</ShoppingResponseRefID>`.

The Travel_OrderCreate response returns:
- One OrderID
- An OrderItem for the air for each traveler
- An OrderItem for each SAF bundle per bound and per traveler

### SAF in Travel_OrderPay

Travel_OrderPay request remains the same as any other NDC payment request. The response returns:
- OrderItems and TicketDocInfo for the air segments
- SAF bundle details, which include:
  - ServiceDefinition details
  - An OrderItem for each SAF bundle per pax / per bound
  - An EMD for each SAF bundle per pax / per bound

## Mini Rules — priceType MNR

MNR for NDC is limited to **refundability and exchangeability with penalties**. It depends on whether the carrier returns the information in the MPTB response.

```xml
<fareOptions>
  <pricingTickInfo>
    <pricingTicketing>
      <priceType>MNR</priceType>
    </pricingTicketing>
  </pricingTickInfo>
</fareOptions>
```

## Search by Spanish Resident

Travel agents can receive differentiated NDC offers from **Iberia** when providing a Spanish Resident discount at shopping time.

```xml
<paxReference>
  <ptc>ADT</ptc>
  <ptc>RC</ptc>
  <ptc>F1</ptc>
  <traveller>
    <ref>1</ref>
  </traveller>
</paxReference>
```

## Search by fare with refundability and exchangeability or non-exchangeability

Specify fare attributes (refundability, exchangeability) at shopping time to receive only refundable, exchangeable or non-exchangeable fares in the shopping response.

```xml
<fareOptions>
  <pricingTickInfo>
    <pricingTicketing>
      <priceType>RP</priceType>
      <priceType>RU</priceType>
      <priceType>RF</priceType>
      <priceType>RB</priceType>
      <priceType>NRB</priceType>
    </pricingTicketing>
  </pricingTickInfo>
</fareOptions>
```

(diagram in source: small image alongside this section; no additional codes carried)

## PTCs

Describes the type of passengers. Possible values: `ADT, B15, BNN, C15, CNN, CMA, CMP, DIS, EMI, FFY, HOF, IIT, INF, INN, INS, ITF, ITS, ITX, JCB, JNF, JNN, JNS, LBR, LIF, LNN, MED, MIC, MIF, MIL, MIS, OFW, SEA, SPS, SNN, SRC, STR, STU, TUR, VFR, YSB, YTH`.

- Some carriers may not support all the PTCs above — see the Features per carrier spreadsheet.
- When no PTC is present, **one ADT is considered by default**.
- There is **no Date of Birth check** when a PTC refers to a specific age (e.g. B15), **except on the PNR side for CNN, INF, INS**.
- **SQ VFR fares**: when searching for VFR (Visit Friends and Relatives) fares, it is recommended to use standard PTCs such as **ADT, CHD and INF — not the "VFR" code**. To access VFR-specific fares, an **access code** must be applied.

### PTC in shopping request

The list of PTCs supported by each airline is in the *NDC Features per Airline in TAPI* documentation. During shopping, MasterPricer supports all PTCs supported today by EDIFACT content. **If a PTC is not supported by a given airline, MasterPricer defaults it to ADT** to get that airline's content.

### PTC in shopping response

The MasterPricer response always includes **two PTCs**:

1. **Requested PTC** — the one requested through MasterPricer.
2. **Priced PTC** — the one applied to the fare of a recommendation or an offer.

Priced PTC comes from the airline's AirShopping response. Some airlines return both requested and priced PTC clearly (e.g. Accelya carriers). Some return only one PTC, which MasterPricer interprets as the priced PTC (because it is the PTC the airline returns for all their offers).

Scenarios:

- **1.1** — PTC in MasterPricer is supported by the airline (e.g. JCB). MasterPricer routes JCB in AirShoppingRQ; airline returns offers with JCB in AirShoppingRS; MasterPricer displays it as priced PTC. Requested PTC = JCB, priced PTC = JCB.
- **1.2** — PTC supported by the airline (JCB) but the airline finds no JCB offers and returns an ADT fare instead. MasterPricer routes JCB; airline returns ADT; MasterPricer shows ADT as priced PTC. Requested PTC = JCB, priced PTC = ADT.
- **2** — PTC in the MasterPricer query is not supported by the airline (e.g. JCB). MasterPricer defaults the PTC to ADT and sends ADT in AirShoppingRQ; airline returns ADT offers; MasterPricer shows ADT as priced PTC. Requested PTC = JCB, priced PTC = ADT.

## Passenger Reference IDs

Prior to the Order Create response, **any pax ref id can be used**. Once the order has been created, the **pax id returned in the response must be used** for any changes such as adding seats, merchandising or exchanges.

## Airline Fare Families

Nothing specific to NDC. Notes:

- Sending **FFI "3"** will **not** return the services for the Fare Families, **except** for services related to **SAF and SEAT from AF/KL**.
- Fare Family **short name** (also called brand code) is available for NDC content using **MasterPricer TravelBoard 21.4 or higher**.
- Fare Family **name** (also called short description — in the `description` field) is available for NDC content. The data profile **"FARE FAMILY INFORMATION"** must be activated (contact Account Manager).

## Amenities in MasterPricer TravelBoard

Travel sellers can receive amenities of an NDC offer in the MPTB response, **except for Air France / KLM NDC offers**. Supported by **MPTB version 20.1 or higher**. Customers must adapt and/or implement new elements in their UI to display the amenities. **Activation is required** (contact account manager). Details on how amenities are returned are in the MasterPricer TravelBoard user guide.

## Interline Offers in the Shopping Response

Travel sellers can request interline carriers in the MasterPricer TravelBoard response. Receiving these interline offers depends on whether the carrier supports it.

- **Offer Responsible Airline (ORA)** — the carrier building one or several offers for the travel request. For example, an Altea NDC carrier would be the ORA.
- **Participating Offer Airline (POA)** — an interline/codeshare carrier (non-NDC or NDC) that the ORA can contact to increase its offer; the ORA is then responsible for building the offer with both airlines' products.
- The **owner code is always the primary NDC carrier** throughout shopping, pricing, order creation, seats, ancillaries and servicing orders.
- The include-airline option can be requested at **itinerary level or segment level**. There is **no restriction to request at segment level for NDC content**.

Example at itinerary level:

```xml
<travelFlightInfo>
  <companyIdentity>
    <carrierQualifier>M</carrierQualifier>
    <carrierId>SQ</carrierId>
    <carrierId>YY</carrierId>
  </companyIdentity>
</travelFlightInfo>
```

Example at segment level:

```xml
<Fare_MasterPricerTravelBoardSearch>
  [...]
  <itinerary>
    <requestedSegmentRef>
      <segRef>1</segRef>
    </requestedSegmentRef>
    <departureLocalization>
      <departurePoint>
        <locationId>SIN</locationId>
        <airportCityQualifier>A</airportCityQualifier>
      </departurePoint>
    </departureLocalization>
    <arrivalLocalization>
      <arrivalPointDetails>
        <locationId>SEA</locationId>
        <airportCityQualifier>A</airportCityQualifier>
      </arrivalPointDetails>
    </arrivalLocalization>
    <timeDetails>
      <firstDateTimeDetail>
        <date>250924</date>
      </firstDateTimeDetail>
    </timeDetails>
    <flightInfo>
      <companyIdentity>
        <carrierQualifier>M</carrierQualifier>
        <carrierId>SQ</carrierId>
        <carrierId>YY</carrierId>
      </companyIdentity>
    </flightInfo>
  </itinerary>
  ...
</Fare_MasterPricerTravelBoardSearch>
```

## Gotchas

- **`numberOfUnits` for NDC-only must be exactly `100`.** Any other value silently ignores the criteria and the response mixes NDC and EDIFACT recommendations — no error is raised.
- **QF and AA silently drop frequent flyer data** if the cardholder given name / surname is not sent in `travellerDetails/traveller`. Other carriers do not require the name.
- Frequent-flyer search lives under `ndcQueryParameters/ndcSpecialParameters/ndcLoyaltyProgram` with `type`=1, while the **Corporate Identifier (CLID/OIN/ABN/QCI)** lives under `fareOptions/frequentTravellerInfo` with `type`=2 — same element names, different parents and different qualifier.
- Only **1 CLID per NDC airline** is used (the first one); extras are ignored. Availability biasing caps at **9 CLIDs across an airline and its partners**; Master Pricer Verb caps at 99 overall.
- A CLID **must** carry an airline association in the MPTB query, otherwise it cannot be routed.
- For IT fares over NDC, only the **first private fare / PTC listed** is forwarded to the provider — put `IIT` first.
- Corporate codes may be **silently truncated** to the first N codes accepted by a given provider.
- SAF bundles need **both** `FFI` and `UPH` feeIds plus the **FAMILY UPSELL 3** and **FARE FAMILY INFO** data profiles on the office id, activated for **both MPT and ORC** applications; activation itself is done by AF/KL against the seller's IATA number.
- SAF offers are usually not the cheapest, so they may not appear by default — the Fare Family + Upsell options are what surface them. Alternatively use the "Upsell" shopping criteria in Travel_OfferPrice.
- **Both air and SAF offer items are mandatory in OrderCreate**; there is one SAF offer item per pax per bound, and no SAF price breakdown at shopping (the amount is air + SAF + tax).
- Sending FFI "3" suppresses Fare Family services, except SAF and SEAT services from AF/KL.
- Amenities are not returned for AF/KL NDC offers.
- MNR over NDC returns only refundability/exchangeability with penalties, and only if the carrier supplies it.
- Requested PTC ≠ priced PTC: always read the priced PTC for fare logic, since unsupported PTCs are defaulted to ADT either by MasterPricer or by the airline.
- The PTC value list contains `CNN` (child), not `CHD`; but the SQ VFR guidance is written in terms of `ADT, CHD, INF`.
- After OrderCreate, reusing your own pax ref ids will break seats/ancillaries/exchanges — switch to the ids returned in the OrderCreate response.
