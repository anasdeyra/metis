# NDC[X] Prime Booking Flow — Shopping with Fare_MasterPricerTravelBoardSearch

> Source: WBS Implementation Guide NDC[X] v1.5, sections "Prime Booking Detailed Example", "NDCX prime booking Flow -- How to Shop, Price, Book and Pay", "Time Limits", "Round-Trip for 2 Adults, 1 Child, 1 Infant with a Credit Card Payment", "Fare_MasterPricerTravelBoardSearch", "Operating Carrier Information in Master Pricer response"

## 1. Prime booking flow

All web service calls are **stateless**.

| Step | Service | Purpose |
|---|---|---|
| Shopping | `Fare_MasterPricerTravelBoardSearch` | Obtain travel recommendations, including some sourced directly from the airline through the NDC interface they expose |
| Pricing | `Travel_OfferPrice` | Price the offer |
| Order creation | `Travel_OrderCreate` | Create the order |
| Order payment and issuance | `Travel_OrderPay` | Pay and issue the order |

## 2. Time Limits

| Service | Time limit | Rule | XML location |
|---|---|---|---|
| Fare_MasterPricerTravelBoard | Offer Time Limit (`OTL`) | Shopping offer must be priced before the time expires. Time is **GMT**. Range depends on carrier: **15 min to 30 min**. If expired, a new shopping request is required. | `offers/timeLimits/dateAndTimeDetails` with `qualifier=OTL` |
| Travel_OfferPrice | Offer Expiration Date Time | Offer must be converted into an order before this time. Varies between carriers, **15 min to 30 min**. Once expired the offer cannot be repriced — a new shopping request is needed. | `PricedOffer/OfferExpirationDateTime` |
| Travel_OfferPrice | Payment Time Limit DateTime | When the order must be paid. **Cannot be extended.** | `PricedOffer/PaymentTimeLimitDateTime` |
| Travel_OrderCreate | Price Guarantee Time Limit | Returned by some providers. Once expired the fare is not guaranteed. Shorter than the ticketing/payment time limit. Repricing the existing fare is currently **not possible** — a new shopping request is required. | `OrderItem/PriceGuaranteeTimeLimitDateTime` |
| Travel_OrderCreate | Ticketing Time Limit / Payment Time Limit | These two are **the same**, returned in the **local time zone of the POS office id**. Some carriers return both sections, some only one of the two. | `OrderItem/PaymentTimeLimitDateTime`, `OrderItem/TicketingTimeLimitDateTime` (also `OrderItem/CreationDateTime`) |
| Travel_OrderPay | Ticketing date/time of issue | Ticketing time and date information are **not returned by all airlines** today. See the Normalization Document. | `TicketDocument/DateOfIssue`, `TicketDocument/TimeOfIssue` |

### Vueling (VY) 10-minute rule
Vueling historically does **not** allow deferred payment; on the VY direct channel and VY website only instant payment is proposed. For bookings done through the Amadeus Travel Platform, VY grants travel sellers **up to 10 minutes** to collect payment information and proceed to the payment of the order.

### Time limit sample fragments

MasterPricer reply (`OTL`, date `DDMMYY`, time `HHMM`):

```xml
<offers>
  <!-- ...truncated -->
  <timeLimits>
    <dateAndTimeDetails>
      <qualifier>OTL</qualifier>
      <date>130723</date>
      <time>1843</time>
    </dateAndTimeDetails>
  </timeLimits>
  <offerItems>
    <!-- ...truncated -->
  </offerItems>
</offers>
```

Travel_OfferPrice reply (ISO-8601, `Z` = UTC):

```xml
<PricedOffer>
  <!-- ...truncated -->
  <OfferExpirationDateTime>2023-07-13T18:43:45Z</OfferExpirationDateTime>
  <PaymentTimeLimitDateTime>2023-07-17T03:59:00Z</PaymentTimeLimitDateTime>
</PricedOffer>
```

Travel_OrderCreate reply (ISO-8601, **no** `Z` — local time of POS office id):

```xml
<OrderItem>
  <!-- ...truncated -->
  <PriceGuaranteeTimeLimitDateTime>2023-07-14T14:13:00</PriceGuaranteeTimeLimitDateTime>
</OrderItem>
<OrderItem>
  <!-- ...truncated -->
  <CreationDateTime>2023-03-09T16:30:00</CreationDateTime>
  <PaymentTimeLimitDateTime>2023-03-10T23:59:00</PaymentTimeLimitDateTime>
  <TicketingTimeLimitDateTime>2023-03-10T23:59:00</TicketingTimeLimitDateTime>
  <!-- ...truncated -->
</OrderItem>
```

Travel_OrderPay reply:

```xml
<TicketDocument>
  <!-- ...truncated -->
  <DateOfIssue>2023-03-02</DateOfIssue>
  <TimeOfIssue>19:23</TimeOfIssue>
  <!-- ...truncated -->
</TicketDocument>
```

## 3. Worked example scope

Round-trip, **2 adults + 1 child + 1 infant**, paid with credit card. The Travel_OrderCreate in the full example includes Redress, Known Traveler Number, Visa, Loyalty # and Passport for the 1st adult.

- Out of scope: infant with American Airlines.
- Some providers do **not** send SSR DOCO and DOCA directly to the airline; they are stored on the Amadeus NDC PNR. See the "Features per Airline" spreadsheet.

## 4. Fare_MasterPricerTravelBoardSearch — request

The MasterPricer TravelBoard request is **standard** (no NDC-specific request structure), but note the `offerItemID` differences on the response between NDC providers (see §6.4).

```xml
<Fare_MasterPricerTravelBoardSearch>
  <numberOfUnit>
    <unitNumberDetail>
      <numberOfUnits>250</numberOfUnits>
      <typeOfUnit>RC</typeOfUnit>
    </unitNumberDetail>
    <unitNumberDetail>
      <numberOfUnits>100</numberOfUnits>
      <typeOfUnit>NDC</typeOfUnit>
    </unitNumberDetail>
    <unitNumberDetail>
      <numberOfUnits>3</numberOfUnits>
      <typeOfUnit>PX</typeOfUnit>
    </unitNumberDetail>
  </numberOfUnit>

  <paxReference>
    <ptc>ADT</ptc>
    <traveller>
      <ref>1</ref>
    </traveller>
    <traveller>
      <ref>2</ref>
    </traveller>
  </paxReference>
  <paxReference>
    <ptc>CNN</ptc>
    <traveller>
      <ref>3</ref>
    </traveller>
  </paxReference>
  <paxReference>
    <ptc>INF</ptc>
    <traveller>
      <ref>1</ref>
      <infantIndicator>1</infantIndicator>
    </traveller>
  </paxReference>

  <fareOptions>
    <pricingTickInfo>
      <pricingTicketing>
        <priceType>RP</priceType>
        <priceType>RU</priceType>
      </pricingTicketing>
    </pricingTickInfo>
  </fareOptions>

  <itinerary>
    <requestedSegmentRef>
      <segRef>1</segRef>
    </requestedSegmentRef>
    <departureLocalization>
      <departurePoint>
        <locationId>NRT</locationId>
      </departurePoint>
    </departureLocalization>
    <arrivalLocalization>
      <arrivalPointDetails>
        <locationId>DFW</locationId>
      </arrivalPointDetails>
    </arrivalLocalization>
    <timeDetails>
      <firstDateTimeDetail>
        <date>130323</date>
      </firstDateTimeDetail>
    </timeDetails>
  </itinerary>
  <itinerary>
    <requestedSegmentRef>
      <segRef>2</segRef>
    </requestedSegmentRef>
    <departureLocalization>
      <departurePoint>
        <locationId>DFW</locationId>
      </departurePoint>
    </departureLocalization>
    <arrivalLocalization>
      <arrivalPointDetails>
        <locationId>NRT</locationId>
      </arrivalPointDetails>
    </arrivalLocalization>
    <timeDetails>
      <firstDateTimeDetail>
        <date>230323</date>
      </firstDateTimeDetail>
    </timeDetails>
  </itinerary>
</Fare_MasterPricerTravelBoardSearch>
```

### 4.1 numberOfUnit — typeOfUnit values

| typeOfUnit | Meaning in example | Sample value |
|---|---|---|
| `RC` | Number of recommendations requested | 250 |
| `NDC` | Number of NDC recommendations requested | 100 |
| `PX` | Number of passengers | 3 |

Note: `PX` = 3 for 2 ADT + 1 CNN + 1 INF — the infant is not counted as a unit; it is carried as `infantIndicator` on the adult's `traveller` reference.

### 4.2 paxReference / PTC blocks

| Field path | Notes |
|---|---|
| `/Fare_MasterPricerTravelBoardSearch/paxReference/ptc` | `ADT`, `CNN`, `INF` |
| `/Fare_MasterPricerTravelBoardSearch/paxReference/traveller/ref` | Traveller reference number; repeated per traveller of that PTC |
| `/Fare_MasterPricerTravelBoardSearch/paxReference/traveller/infantIndicator` | `1` — attaches the infant to the adult whose `ref` it is nested under (here `ref` 1) |

### 4.3 fareOptions / priceType

| priceType | Used in example |
|---|---|
| `RP` | yes |
| `RU` | yes |

Path: `/Fare_MasterPricerTravelBoardSearch/fareOptions/pricingTickInfo/pricingTicketing/priceType` (repeatable).

### 4.4 itinerary

| Field path | Notes |
|---|---|
| `itinerary/requestedSegmentRef/segRef` | 1-based bound index (`1` outbound, `2` inbound) |
| `itinerary/departureLocalization/departurePoint/locationId` | IATA code, e.g. `NRT` |
| `itinerary/arrivalLocalization/arrivalPointDetails/locationId` | IATA code, e.g. `DFW` |
| `itinerary/timeDetails/firstDateTimeDetail/date` | **DDMMYY**, e.g. `130323` = 13 March 2023 |

## 5. Fare_MasterPricerTravelBoardSearch — reply (NDC parts)

The reply displays **Amadeus EDIFACT content** (travel recommendations) **and NDC content** (Offers). The `flightIndex` group is unchanged. The `recommendation` group contains specific tags to identify NDC content and link it to the OfferID. The `offersGroup` at the end of the reply contains the IDs used for the NDC booking flow. All details about flights and fares are displayed the same way for NDC and EDIFACT.

(diagram in source: screenshot of a MasterPricer reply showing the relationship between the recommendation group, segmentFlightRef offer index and the offersGroup IDs.)

### 5.1 Identifying an NDC recommendation

NDC travel recommendation groups are identified by `priceType="N"`; EDIFACT travel recommendations remain unchanged.

```
//Fare_MasterPricerTravelBoardSearchReply/recommendation/itemNumber/priceTicketing/priceType="N"
```

### 5.2 Offer Index (`OI`) under segmentFlightRef

A reference to an offer Index (`OI`) is present **only for NDC travel solutions**.

```xml
<segmentFlightRef>
  <referencingDetail>
    <refQualifier>S</refQualifier>
    <refNumber>20</refNumber>
  </referencingDetail>
  <referencingDetail>
    <refQualifier>OI</refQualifier>
    <refNumber>65</refNumber>
  </referencingDetail>
  <referencingDetail>
    <refQualifier>B</refQualifier>
    <refNumber>1</refNumber>
  </referencingDetail>
</segmentFlightRef>
```

| refQualifier | Meaning |
|---|---|
| `S` | Segment reference |
| `OI` | Offer Index — NDC only; refers to the corresponding index in `offersGroup` where the *ShoppingResponseID*, *OfferID* and *OfferItemID* are found |
| `B` | Bound reference |

Matching index path:

```
//Fare_MasterPricerTravelBoardSearchReply/offersGroup/offers/offerDetails/reference
```

### 5.3 offersGroup skeleton (as returned in the example flow)

```xml
<offersGroup>
  <response>
    <applicationDetails>
      <internalId>Sh_ResponseID_000</internalId>
    </applicationDetails>
  </response>
  <offers>
    <offerDetails>
      <reference>1</reference>
      <uniqueOfferReference>Sh_OfferID_000-0</uniqueOfferReference>
    </offerDetails>
    <timeLimits>
      <dateAndTimeDetails>
        <qualifier>OTL</qualifier>
        <date>200920</date>
        <time>1730</time>
      </dateAndTimeDetails>
      <dateAndTimeDetails>
        <qualifier>TTL</qualifier>
        <date>230920</date>
        <time>2359</time>
      </dateAndTimeDetails>
    </timeLimits>
    <offerItems>
      <offerItemDetails>
        <offerItemId>Sh_OfferID_000-0-1</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>ADT</ptc>
        <traveller>
          <ref>1</ref>
        </traveller>
        <traveller>
          <ref>2</ref>
        </traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>Sh_OfferID_000-0-2</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>CNN</ptc>
        <traveller>
          <ref>3</ref>
        </traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>Sh_OfferID_000-0-4</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>INF</ptc>
        <traveller>
          <ref>1</ref>
          <infantIndicator>1</infantIndicator>
        </traveller>
      </paxReference>
    </offerItems>
  </offers>
</offersGroup>
```

### 5.4 offersGroup — multiple groups, indexed by OI

The reply may contain several `offersGroup` elements; the `OI` refNumber matches `offerDetails/reference` (here `65`).

```xml
<offersGroup><!-- OG1 --></offersGroup>

<offersGroup>
  <response>
    <applicationDetails>
      <internalId>Sh_ResponseID_000</internalId>
    </applicationDetails>
  </response>
  <offers>
    <offerDetails>
      <reference>65</reference>
      <uniqueOfferReference>Sh_OfferID_000-0</uniqueOfferReference>
    </offerDetails>
    <timeLimits>
      <dateAndTimeDetails>
        <qualifier>OTL</qualifier>
        <date>261120</date>
        <time>1051</time>
      </dateAndTimeDetails>
      <dateAndTimeDetails>
        <qualifier>TTL</qualifier>
        <date>291120</date>
        <time>1121</time>
      </dateAndTimeDetails>
    </timeLimits>
    <offerItems>
      <offerItemDetails>
        <offerItemId>Sh_ResponseID_000-1-1</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>ADT</ptc>
        <traveller>
          <ref>1</ref>
        </traveller>
        <traveller>
          <ref>2</ref>
        </traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>Sh_ResponseID_000-1-2</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>CNN</ptc>
        <traveller>
          <ref>3</ref>
        </traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>Sh_ResponseID_000-1-3</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>INF</ptc>
        <traveller>
          <ref>1</ref>
          <infantIndicator>1</infantIndicator>
        </traveller>
      </paxReference>
    </offerItems>
  </offers>
</offersGroup>

<offersGroup><!-- OG3 --></offersGroup>
<offersGroup><!-- OG3 --></offersGroup>
```

Time limit qualifiers in `offers/timeLimits/dateAndTimeDetails/qualifier`:

| qualifier | Meaning |
|---|---|
| `OTL` | Offer Time Limit — offer must be priced before it expires (GMT) |
| `TTL` | Ticketing Time Limit |

Date format `DDMMYY`, time format `HHMM`.

## 6. IDs to carry from MasterPricer RS into Travel_OfferPrice RQ

Filtering on the selected travel recommendation must be applied.

| Target field | Source XPath |
|---|---|
| Shopping OfferID | `//Fare_MasterPricerTravelBoardSearchReply/offersGroup/offers/offerDetails/uniqueOfferReference` |
| Shopping OwnerCode | `//Fare_MasterPricerTravelBoardSearchReply/recommendation/itemNumber/codeShareDetails/company` |
| Shopping ResponseID | `//Fare_MasterPricerTravelBoardSearchReply/offersGroup/response/applicationDetails/internalId` |
| Shopping OfferItemID | `//Fare_MasterPricerTravelBoardSearchReply/offersGroup/offers/offerItems/offerItemDetails/offerItemId` |

### 6.4 offerItemID granularity per provider

| Provider | offerItemID granularity |
|---|---|
| Accelya, AF/KL, IB/BA | One `offerItemID` **per PTC type** |
| Altea NDC carriers | **One** `offerItemID` for all travelers |

More details: "Normalization Differences per Provider" document.

## 7. Operating Carrier Information in MasterPricer response

Operating carrier details shown in the MP response are determined by the configuration settings applied to each **Office ID** within the Amadeus Travel Platform.

| Setting | Behaviour |
|---|---|
| `CODESHARE CARRIER 0` (default) | If the operating carrier code is unknown, the operating carrier code is overridden by the **marketing carrier code**. |
| `CODESHARE CARRIER 1` | If operating carrier information (e.g. flight with wet lease operations) is returned by NDC airlines, it is displayed in the MP response. |
| `CODESHARE CARRIER 4` | Operating flight number, operating carrier code, and operating carrier information for wet lease operations are returned if returned by airlines. If the operating carrier code equals the marketing carrier code, **no** operating carrier information (carrier code and flight number) is displayed. |

`CODESHARE CARRIER 4` aggregation conflict rules (when both EDIFACT and NDC content are eligible for aggregation):

1. If operating carrier code or operating flight number conflict → the **EDIFACT** one is displayed.
2. If the length of the operating carrier information, after removing the eventual prefix `"operated by"`, differs → the **longer** one is displayed.
3. If that length is the same → the **EDIFACT** one is displayed.

## Gotchas

- **All calls are stateless** — every ID (ShoppingResponseID, OfferID, OfferItemID) must be re-sent from the client; nothing is held server-side between calls.
- `OTL` is **GMT**; Travel_OrderCreate's `TicketingTimeLimitDateTime` / `PaymentTimeLimitDateTime` are in the **local time zone of the POS office id** and have **no `Z` suffix**. Do not treat these uniformly.
- MasterPricer time limits use `date` = `DDMMYY` + separate `time` = `HHMM`; Travel_* services use ISO-8601. The itinerary request `date` is also `DDMMYY` — `130323` is 13 March 2023, not 13 March 2023 in YYMMDD.
- Once `OTL` / `OfferExpirationDateTime` / `PriceGuaranteeTimeLimitDateTime` expires, there is **no reprice path** — a new shopping request is mandatory.
- Payment Time Limit **cannot be extended**.
- Vueling grants only **10 minutes** to collect payment and pay the order — build the payment step to complete inside that window.
- `PX` unit count excludes infants; infants are expressed via `infantIndicator` nested in the accompanying adult's `traveller` block (with the adult's `ref`), both in the request and in the reply's `offerItems/paxReference`.
- The `OI` referencingDetail under `segmentFlightRef` exists **only** for NDC solutions — its absence plus `priceType != "N"` means EDIFACT content, which must not be routed through the NDC flow.
- There can be **multiple `offersGroup` elements**; you must select the one whose `offerDetails/reference` equals the `OI` refNumber, not simply the first/last.
- `offerItemId` granularity differs per provider (per-PTC vs single for all travelers) — do not assume one item per passenger.
- Source examples show two different `offerItemId` naming shapes (`Sh_OfferID_000-0-1` and `Sh_ResponseID_000-1-1`) and non-contiguous suffixes (`-0-1`, `-0-2`, `-0-4`). Treat offerItemId as an **opaque string**; never construct or infer it.
- Some providers do not forward SSR DOCO/DOCA to the airline (stored on the Amadeus NDC PNR only) — check "Features per Airline".
- Ticketing date/time of issue is not returned by all airlines in Travel_OrderPay; handle absence.
