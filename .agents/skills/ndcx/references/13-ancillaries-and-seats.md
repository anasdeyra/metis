# Ancillaries and Seats

> Source: WBS Implementation Guide NDC[X] Ancillaries, Seats and Servicing v1.2, sections "Ancillary and Seats", "Pre-Booking UseCase", "Post Booking UseCase", "Post Issuance UseCase", "Exchange of Free Seats for Family Seating", "Bag and Seats Specificities", "AF/KL SAF + Seat Bundles".

Seats and ancillaries can be added at three timings: pre-booking (before order creation), post-booking (order created, not yet paid/issued), post-issuance (after air documents issued).

Global rules:
- `Travel_SeatAvailability` and `Travel_ServiceList` are **independent APIs**; they do NOT have to be sent together.
- **If an amount is not returned for chargeable seats, it is recommended to block this seat.**
- **If chargeable bags are not available for all segments, it is recommended to block the selection of these services.**
- For AF/KL a **second `Travel_OfferPrice` is required**; the details put into `Travel_OrderCreate` must be taken **only from the second offer price**.
- For bags in weight ("kg") returned by **Altea carriers** via the `Travel_ServiceList` response, the 2nd `Travel_OfferPrice` must include the OfferPrice details of the **air offer + the offer ids returned in the `Travel_ServiceList` response**.
- In every use case the resulting order contains **one OrderItem for the segments and one OrderItem for the seat and/or ancillary**.

---

## 1. Pre-Booking use case

Call sequence:

```
Fare_MasterPricerTravelBoardSearch / shopping  ->  Travel_OfferPrice (air)
   -> Travel_SeatAvailability  (seat map, keyed on the AIR offer)
   -> Travel_ServiceList       (ancillaries, keyed on the AIR offer)
   -> [conditional] 2nd Travel_OfferPrice   (AF/KL always; bags in "kg" for any carrier)
   -> Travel_OrderCreate
```

### 1.1 Travel_SeatAvailability RQ (pre-booking)

| Field path | Source of value | Notes |
|---|---|---|
| `Request/CoreRequest/Offer/OfferItemID` | air `Travel_OfferPrice` RS offer item | e.g. `Pr_ResponseID_00-1` |
| `Request/CoreRequest/Offer/OwnerCode` | airline code of the offer | e.g. `6X` |
| `Request/ShoppingResponse/ShoppingResponseID` | shopping/OfferPrice RS | e.g. `Pr_ResponseID_000` |
| `Party/...` | agency/sender block | truncated in guide |

```xml
<AMA_TravelSeatAvailabilityRQ>
  <Party><!-- sender / travel agency block --></Party>
  <Request>
    <CoreRequest>
      <Offer>
        <OfferItemID>Pr_ResponseID_00-1</OfferItemID>
        <OwnerCode>6X</OwnerCode>
      </Offer>
    </CoreRequest>
    <ShoppingResponse>
      <ShoppingResponseID>Pr_ResponseID_000</ShoppingResponseID>
    </ShoppingResponse>
  </Request>
</AMA_TravelSeatAvailabilityRQ>
```

### 1.2 Travel_ServiceList RQ (pre-booking)

| Field path | Source of value | Notes |
|---|---|---|
| root `xmlns:ns8` | `http://xml.amadeus.com/2010/06/Travel_ServiceListRQ_v1` | namespace used in guide sample |
| `Party/Sender/TravelAgency/AgencyID` | literal `NOT USED` | not used at this step |
| `Party/Sender/TravelAgency/PseudoCityID` | literal `NOT USED` | not used at this step |
| `Request/CoreRequest/Offer/OfferID` | air offer id | e.g. `1A_TPID_CiESG1NQMUYtMTQxOAI=` |
| `Request/CoreRequest/Offer/OwnerCode` | airline code | e.g. `6X` |
| `Request/CoreRequest/Offer/OfferItem/OfferItemID` | air offer item id | e.g. `1A_TPID_CAESHVNQMUYS0x` |
| `Request/CoreRequest/Offer/OfferItem/OwnerCode` | airline code | **QF requires OwnerCode in this section** |
| `Request/CoreRequest/Offer/OfferItem/Service/ServiceID` | service id of the air offer item | e.g. `1` |
| `Request/ShoppingResponse/ShoppingResponseID` | shopping RS | e.g. `SP1F-14193187327050054900` |

```xml
<AMA_TravelServiceListRQ xmlns:ns8="http://xml.amadeus.com/2010/06/Travel_ServiceListRQ_v1">
  <Party><Sender><TravelAgency>
    <AgencyID>NOT USED</AgencyID><PseudoCityID>NOT USED</PseudoCityID>
  </TravelAgency></Sender></Party>
  <Request>
    <CoreRequest>
      <Offer>
        <OfferID>1A_TPID_CiESG1NQMUYtMTQxOAI=</OfferID>
        <OwnerCode>6X</OwnerCode>
        <OfferItem>
          <OfferItemID>1A_TPID_CAESHVNQMUYS0x</OfferItemID>
          <OwnerCode>6X</OwnerCode>
          <Service>
            <ServiceID>1</ServiceID>
          </Service>
        </OfferItem>
      </Offer>
    </CoreRequest>
    <ShoppingResponse>
      <ShoppingResponseID>SP1F-14193187327050054900</ShoppingResponseID>
    </ShoppingResponse>
  </Request>
</AMA_TravelServiceListRQ>
```

### 1.3 Travel_SeatAvailability RS — key response fields

Offer items (one per bookable seat price point), base XPath
`//AMA_TravelSeatAvailabilityRS/Response/ALaCarteOffer/ALaCarteOfferItem`:

| Relative XPath | Sample value |
|---|---|
| `OfferItemID` | `Seat_ResponseID_000-1-7` |
| `UnitPrice/TotalAmount/@CurCode`, text | `EUR`, `1790` |
| `UnitPrice/BaseAmount/@CurCode`, text | `EUR`, `1790` |
| `Service/ServiceID` | `DFDC-4162-A53D-1-1-1` |
| `Service/ServiceDefinitionRefID` | `6a244d03a0b66a0480` |
| `Eligibility/PaxRefID` | `P1` |
| `Eligibility/FlightAssociations/PaxSegmentRefID` | `S1` |

Seat map, base XPath
`//AMA_TravelSeatAvailabilityRS/Response/SeatMap/CabinCompartment/SeatRow/Seat`:

| Relative XPath | Sample value |
|---|---|
| `CabinColumnID` | `A` |
| `OccupationStatusCode` | `F` |
| `CharacteristicCode` (repeating) | `L`, `CH`, `LS`, `PP` |
| `OfferItemRefID` | `Seat_ResponseID_000-1-7` |

Reading the seat map:
- Row number: the parent `SeatMap/CabinCompartment/SeatRow` element; column: `Seat/CabinColumnID`. Seat number = row + column (e.g. row `19` + `A` = 19A).
- Availability: `Seat/OccupationStatusCode` (`F` in the sample = free/available).
- Characteristics: repeating `Seat/CharacteristicCode` (sample values `L`, `CH`, `LS`, `PP`).
- Price: `Seat/OfferItemRefID` → matching `ALaCarteOfferItem/OfferItemID`, whose `UnitPrice/TotalAmount@CurCode` / `BaseAmount` carry the amount. **No matching offer item / no amount ⇒ block the seat.**

### 1.4 Travel_ServiceList RS — key response fields

Offer items, base XPath `//AMA_TravelServiceListRS/Response/ALaCarteOffer/ALaCarteOfferItem`:

| Relative XPath | Sample value |
|---|---|
| `OfferItemID` | `SP1F-14190-1-2` |
| `UnitPrice/TotalAmount/@CurCode`, text | `JPY`, `22960` |
| `UnitPrice/BaseAmount/@CurCode`, text | `JPY`, `22960` |
| `UnitPrice/TaxSummary/TotalTaxAmount/@CurCode`, text | `JPY`, `0` |
| `Service/ServiceID` | `1` |
| `Service/ServiceDefinitionRefID` | `SRV1` (→ `ServiceDefinitionID`) |
| `Eligibility/PaxRefID` | `PAX1` |
| `Eligibility/FlightAssociations/PaxSegmentRefID` (repeating) | `SEG3`, `SEG5` |

Service descriptions: `//AMA_TravelServiceListRS/Response/DataLists/ServiceDefinitionList/ServiceDefinition`

```xml
<ServiceDefinition>
  <ServiceDefinitionID>SRV1</ServiceDefinitionID>
  <OwnerCode>SQ</OwnerCode>
  <Name>EXCESS SIZE</Name>
  <ReasonForIssuanceCode>C</ReasonForIssuanceCode>
  <ReasonForIssuanceSubCode>0ID</ReasonForIssuanceSubCode>
  <ValidatingCarrierCode>SQ</ValidatingCarrierCode>
  <Description>
    <DescID>1</DescID>
    <DescText>EXCESS SIZE</DescText>
  </Description>
  <!-- DescID 2,3,4,6 identical text; DescID 5 additionally carries <Media><MediaID>13232214</MediaID></Media> -->
  <BookingInstructions>
    <SSRCode>BULK</SSRCode>
    <AddlDataMeasure UnitCode="n">1</AddlDataMeasure>
  </BookingInstructions>
</ServiceDefinition>
```

Field meanings:
- `ServiceDefinitionID` — join key from `ALaCarteOfferItem/Service/ServiceDefinitionRefID`.
- `Name` / `Description/DescText` — display name / long text; `Description/Media/MediaID` — image reference.
- `ReasonForIssuanceCode` (`C`) + `ReasonForIssuanceSubCode` (`0ID`, `OCC`, `0AA`) — EMD/service code pair.
- `BookingInstructions/SSRCode` — SSR to book (`BULK`, `ABAG`, `XBAG`).
- `BookingInstructions/AddlDataMeasure@UnitCode` — **unit of the quantity: `n` = pieces, `kg` = weight**. See "Baggage: weight (kg) vs pieces".

### 1.5 Travel_OfferPrice RQ (conditional) for Seats — pre-booking

Same skeleton is used in all three use cases. `SelectedSeat` carries the chosen seat; `Qty` carries quantity (mandatory for AF/KL for any ancillary service).

```xml
<AMA_TravelOfferPriceRQ>
  <Party><!-- truncated --></Party>
  <Request>
    <DataLists><PaxList><!-- truncated --></PaxList></DataLists>
    <PricedOffer>
      <SelectedOffer>
        <OfferRefID>b5c61dce-e917-490e-861d-cee917790007</OfferRefID>
        <OwnerCode>AF</OwnerCode>
        <ShoppingResponseRefID>c1fe4ad2-4b4c-4acb-aa38-07d517cee55d</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemRefID>d41fd47f-0d01-4806-9fd4-7f0d01480011</OfferItemRefID>
          <PaxRefID>T1</PaxRefID>
          <SelectedAlaCarteOfferItem>
            <Qty>1</Qty>
          </SelectedAlaCarteOfferItem>
          <SelectedSeat>
            <ColumnID>A</ColumnID>
            <SeatRowNumber>19</SeatRowNumber>
          </SelectedSeat>
        </SelectedOfferItem>
        <!-- one SelectedOfferItem per pax; 2nd pax in the guide:
             OfferItemRefID d41fd47f-0d01-4806-9fd4-7f0d01480013, PaxRefID T2, Qty 1, seat 19B -->
      </SelectedOffer>
    </PricedOffer>
  </Request>
</AMA_TravelOfferPriceRQ>
```

`Travel_OfferPrice RS for Seats`: (diagram in source: screenshot of the OfferPrice response showing the priced offer with the seat offer items and total amount — the amount returned is the total amount to pay for the seat or ancillary).

### 1.6 Travel_OrderCreate RQ (pre-booking)

**If `Travel_SeatAvailability` RS or `Travel_ServiceList` RS does not return a `ShoppingResponseRefID`, use the `ShoppingResponseRefID` from the `Travel_OfferPrice` RS.**

Structure: one `SelectedOffer` for the **air** offer, plus one `SelectedOffer` for the **seat / ancillary** offer.

Variant A — air offer + seat offer (seat requires `SelectedSeat`):

```xml
<AMA_TravelOrderCreateRQ>
  <Party><!-- truncated --></Party>
  <Request>
    <CreateOrder>
      <SelectedOffer>
        <OfferID>Pr_ResponseID_000-1</OfferID>
        <OwnerCode>6X</OwnerCode>
        <ShoppingResponseRefID>Pr_ResponseID_000</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemID>Pr_ResponseID_000-1-1</OfferItemID>
          <PaxRefID>T1</PaxRefID>
        </SelectedOfferItem>
      </SelectedOffer>
      <SelectedOffer>
        <OfferID>Seat_ResponseID_000-1</OfferID>
        <OwnerCode>6X</OwnerCode>
        <ShoppingResponseRefID>Seat_ResponseID_000</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemID>Seat_ResponseID_000-1-7</OfferItemID>
          <PaxRefID>T1</PaxRefID>
          <SelectedSeat>
            <SeatRowNumber>7</SeatRowNumber>
            <ColumnID>A</ColumnID>
          </SelectedSeat>
        </SelectedOfferItem>
      </SelectedOffer>
    </CreateOrder>
    <DataLists><PaxList><!-- truncated --></PaxList></DataLists>
  </Request>
</AMA_TravelOrderCreateRQ>
```

Variant B — air offer + ancillary (service) offer, **no `SelectedSeat`**; the ancillary `SelectedOffer` reuses the same `OfferID`/`ShoppingResponseRefID` as the air offer but carries the **service owner** code (`SQ`):

```xml
<CreateOrder>
  <SelectedOffer>
    <OfferID>1A_TPID_CiESG1NQMUYtMTQxOAI=</OfferID>
    <OwnerCode>6X</OwnerCode>
    <ShoppingResponseRefID>SP1F-14193187327050054900</ShoppingResponseRefID>
    <SelectedOfferItem>
      <OfferItemID>1A_TPID_CAESHVNQMUYS0x</OfferItemID>
      <PaxRefID>PAX1</PaxRefID>
    </SelectedOfferItem>
  </SelectedOffer>
  <SelectedOffer>
    <OfferID>1A_TPID_CiESG1NQMUYtMTQxOAI=</OfferID>
    <OwnerCode>SQ</OwnerCode>
    <ShoppingResponseRefID>SP1F-14193187327050054900</ShoppingResponseRefID>
    <SelectedOfferItem>
      <OfferItemID>SP1F-14190-1-2</OfferItemID>
      <PaxRefID>PAX1</PaxRefID>
    </SelectedOfferItem>
  </SelectedOffer>
</CreateOrder>
<!-- + Request/DataLists/PaxList as in Variant A -->
```

`Travel_OrderCreate RS`: (diagram in source: screenshot of the created order). The order contains **one OrderItem for the segments and one OrderItem for the seat and/or ancillary**.

---

## 2. Post-Booking use case

Sent **after `Travel_OrderCreate` but before `Travel_OrderPay`** — i.e. deferred payment. **Air and ancillaries are combined into one single payment**, so no `PaymentInfo` goes in the `Travel_OrderChange` here.

Call sequence:

```
Travel_OrderCreate (done)
   -> Travel_SeatAvailability / Travel_ServiceList   (keyed on OrderID, not on an offer)
   -> [conditional] Travel_OfferPrice
   -> Travel_OrderChange (ChangeOrder/UpdateOrderItem/AcceptOffer)
   -> Travel_OrderPay
```

### 2.1 Travel_SeatAvailability RQ (post-booking)

| Field path | Source of value | Notes |
|---|---|---|
| `Request/CoreRequest/Order/OrderID` | `Travel_OrderCreate` RS | e.g. `06X00ORDERID00` |
| `Request/CoreRequest/Order/OwnerCode` | order owner | e.g. `6X` |

```xml
<AMA_TravelSeatAvailabilityRQ>
  <Party><Sender><!-- truncated --></Sender></Party>
  <Request>
    <CoreRequest>
      <Order>
        <OrderID>06X00ORDERID00</OrderID>
        <OwnerCode>6X</OwnerCode>
      </Order>
    </CoreRequest>
  </Request>
</AMA_TravelSeatAvailabilityRQ>
```

### 2.2 Travel_ServiceList RQ (post-booking)

Note the empty `<Paxs/>` element.

```xml
<AMA_TravelServiceListRQ>
  <Party><!-- truncated --></Party>
  <Request>
    <CoreRequest>
      <Order>
        <OrderID>6XXF057U205FBC0</OrderID>
        <OwnerCode>6X</OwnerCode>
      </Order>
    </CoreRequest>
    <Paxs/>
  </Request>
</AMA_TravelServiceListRQ>
```

### 2.3 Responses (post-booking)

`Travel_SeatAvailability` RS is identical in shape to pre-booking:
- `//AMA_TravelSeatAvailabilityRS/Response/ALaCarteOffer/ALaCarteOfferItem` — `OfferItemID` `Seat_ResponseID_000-1-7`, `UnitPrice/TotalAmount CurCode="EUR" 1790`, `BaseAmount 1790`, `Service/ServiceID DFDC-4162-A53D-1-1-1`, `Service/ServiceDefinitionRefID 6a244d03a0b66a0480`, `Eligibility/PaxRefID P1`, `Eligibility/FlightAssociations/PaxSegmentRefID S1`.
- `//AMA_TravelSeatAvailabilityRS/Response/SeatMap/CabinCompartment/SeatRow/Seat` — `CabinColumnID A`, `OccupationStatusCode F`, `CharacteristicCode L/CH/LS/PP`, `OfferItemRefID Seat_ResponseID_000-1-7`.

`Travel_ServiceList` RS is namespaced `ns2` in this example.
`//ns2:AMA_TravelServiceListRS/ns2:Response/ns2:ALaCarteOffer`:

| Relative XPath | Sample value |
|---|---|
| `OwnerCode` | `6X` |
| `ValidatingCarrierCode` | `6X` |
| `OfferExpirationDateTime` | `2022-01-03T10:40:01.745` |
| `ALaCarteOfferItem/OfferItemID` | `a7a0dee0-7c38-45ff-a0de-e07c38d50001` |
| `ALaCarteOfferItem/UnitPrice/TotalAmount/@CurCode`, text | `EUR`, `2500` |
| `ALaCarteOfferItem/UnitPrice/BaseAmount/@CurCode`, text | `EUR`, `2500` |
| `ALaCarteOfferItem/Service/ServiceDefinitionRefID` | `SRV1` (no `ServiceID` in this sample) |
| `ALaCarteOfferItem/Eligibility/PaxRefID` | `PAX1` |
| `ALaCarteOfferItem/Eligibility/FlightAssociations/PaxSegmentRefID` | `SEG1` |

`//ns2:AMA_TravelServiceListRS/ns2:Response/ns2:DataLists/ns2:ServiceDefinitionList/ns2:ServiceDefinition` — `ServiceDefinitionID` `SRV1`, `OwnerCode` `AF`, `Name` `LUGGAGE`, `ReasonForIssuanceCode` `C`, `ReasonForIssuanceSubCode` `OCC`, `Description/DescID` `11` + `DescText` `ABAG`, `BookingInstructions/SSRCode` `ABAG`. **No `AddlDataMeasure` ⇒ this bag is not weight-based.**

### 2.4 Travel_OfferPrice (conditional) — post-booking

Identical request skeleton to 1.5 (`PricedOffer/SelectedOffer` with `OfferRefID`, `OwnerCode AF`, `ShoppingResponseRefID`, per-pax `SelectedOfferItem` carrying `SelectedAlaCarteOfferItem/Qty` and `SelectedSeat/ColumnID` + `SeatRowNumber`). A second offer price is required for AF/KL. `Travel_OfferPrice RS`: (diagram in source: same OfferPrice response screenshot as pre-booking).

### 2.5 Travel_OrderChange RQ (post-booking)

**If `Travel_SeatAvailability` RS or `Travel_ServiceList` RS does not return a `ShoppingResponseRefID`, use the one from `Travel_OfferPrice` RS.**

Shape: `Request/ChangeOrder/UpdateOrderItem/AcceptOffer/SelectedOffer`, plus `DataLists/PaxList` and `Request/Order` (OrderID + OwnerCode). No payment at this stage.

Variant A — add a seat:

```xml
<AMA_TravelOrderChangeRQ>
  <Party><!-- truncated --></Party>
  <Request>
    <ChangeOrder>
      <UpdateOrderItem>
        <AcceptOffer>
          <SelectedOffer>
            <OfferID>Seat_ResponseID_000-1</OfferID>
            <OwnerCode>6X</OwnerCode>
            <ShoppingResponseRefID>Seat_ResponseID_000</ShoppingResponseRefID>
            <SelectedOfferItem>
              <OfferItemRefID>Seat_ResponseID_000-1-3</OfferItemRefID>
              <PaxRefID>T1</PaxRefID>
              <SelectedSeat>
                <SeatRowNumber>10</SeatRowNumber>
                <ColumnID>A</ColumnID>
              </SelectedSeat>
            </SelectedOfferItem>
          </SelectedOffer>
        </AcceptOffer>
      </UpdateOrderItem>
    </ChangeOrder>
    <DataLists><PaxList><!-- truncated --></PaxList></DataLists>
    <Order>
      <OrderID>06X00ORDERID00</OrderID>
      <OwnerCode>6X</OwnerCode>
    </Order>
  </Request>
</AMA_TravelOrderChangeRQ>
```

Variant B — add an ancillary (no `SelectedSeat`); note the composite `OfferID` shape `<shoppingResponseId>_1A_<offerItemId>`:

Root element in the guide sample: `<AMA_TravelOrderChangeRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderChangeRQ_v1">`, with `Party/Sender/TravelAgency/AgencyID` `27212216` and `PseudoCityID` `AE9L`.

```xml
<ChangeOrder>
  <UpdateOrderItem>
    <AcceptOffer>
      <SelectedOffer>
        <OfferID>1401ba06-e2cb-4ead-8b5a-271579bf4dc1_1A_dca20634-b482-45bc-a206-34b482e50001</OfferID>
        <OwnerCode>6X</OwnerCode>
        <ShoppingResponseRefID>1401ba06-e2cb-4ead-8b5a-271579bf4dc1</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemRefID>a7a0dee0-7c38-45ff-a0de-e07c38d50001</OfferItemRefID>
          <PaxRefID>PAX1</PaxRefID>
        </SelectedOfferItem>
      </SelectedOffer>
    </AcceptOffer>
  </UpdateOrderItem>
</ChangeOrder>
<!-- + Request/DataLists/PaxList, + Request/Order: OrderID 6X057U205FBC0 / OwnerCode 6X -->
```

`Travel_OrderChange RS`: (diagram in source: screenshot of the updated order). One OrderItem for the segments and one OrderItem for the seat and/or ancillary.

---

## 3. Post-Issuance use case

After the air travel documents have been issued, adding seats/ancillaries **requires the payment to be sent in the same `Travel_OrderChange` request** (instant payment flow).

Call sequence:

```
Travel_SeatAvailability / Travel_ServiceList (keyed on OrderID)
   -> [conditional] Travel_OfferPrice
   -> Travel_OrderChange  WITH PaymentInfo   (instant payment)
```

### 3.1 Travel_SeatAvailability RQ (post-issuance)

Byte-identical in shape to 2.1: `Request/CoreRequest/Order/OrderID` = `06X00ORDERID00`, `OwnerCode` = `6X`.

### 3.2 Travel_ServiceList RQ (post-issuance)

`AgencyID` / `PseudoCityID` are literally `unused` in this sample.

```xml
<AMA_TravelServiceListRQ>
  <Party><Sender><TravelAgency>
    <AgencyID>unused</AgencyID><PseudoCityID>unused</PseudoCityID>
  </TravelAgency></Sender></Party>
  <Request>
    <CoreRequest>
      <Order>
        <OrderID>6X_6LKLQS</OrderID>
        <OwnerCode>6X</OwnerCode>
      </Order>
    </CoreRequest>
  </Request>
</AMA_TravelServiceListRQ>
```

### 3.3 Responses (post-issuance)

`Travel_SeatAvailability` RS: unchanged from 1.3 / 2.3 (same `ALaCarteOfferItem` and `Seat` samples).

`//ns2:AMA_TravelServiceListRS/ns2:Response/ns2:ALaCarteOffer/ns2:ALaCarteOfferItem` — same shape as 1.4: `OfferItemID` `SP2P-633551006018491686-1-1`, `UnitPrice/TotalAmount CurCode="INR"` `877`, `BaseAmount` `877`, `UnitPrice/TaxSummary/TotalTaxAmount CurCode="INR"` `0`, `Service/ServiceID` `1`, `Service/ServiceDefinitionRefID` `SRV1`, `Eligibility/PaxRefID` `PAX2`, `Eligibility/FlightAssociations/PaxSegmentRefID` `SEG1`.

`//ns2:AMA_TravelServiceListRS/ns2:Response/ns2:DataLists/ns2:ServiceDefinitionList/ns2:ServiceDefinition` — **weight-based bag example**:

```xml
<ServiceDefinition>
  <ServiceDefinitionID>SRV1</ServiceDefinitionID>
  <OwnerCode>SQ</OwnerCode>
  <Name>ONE KILOGRAM BAGGAGE</Name>
  <ReasonForIssuanceCode>C</ReasonForIssuanceCode>
  <ReasonForIssuanceSubCode>0AA</ReasonForIssuanceSubCode>
  <ValidatingCarrierCode>6X</ValidatingCarrierCode>
  <Description>
    <DescID>1</DescID>
    <DescText>ONE KILOGRAM BAGGAGE</DescText>
  </Description>
  <!-- DescID 2,3,4 identical text; DescID 5 additionally carries <Media><MediaID>13232214</MediaID></Media> -->
  <BookingInstructions>
    <SSRCode>XBAG</SSRCode>
    <AddlDataMeasure UnitCode="kg">1</AddlDataMeasure>
  </BookingInstructions>
</ServiceDefinition>
```

### 3.4 Travel_OfferPrice RQ (conditional) for Seats — post-issuance

Identical to 1.5 (`OfferRefID b5c61dce-e917-490e-861d-cee917790007`, `OwnerCode AF`, `ShoppingResponseRefID c1fe4ad2-4b4c-4acb-aa38-07d517cee55d`, two `SelectedOfferItem` with `Qty` 1 and `SelectedSeat` 19A / 19B). A second offer price is required for AF/KL. `Travel_OfferPrice RS for Seats`: (diagram in source: OfferPrice response screenshot).

### 3.5 Travel_OrderChange RQ (post-issuance, instant payment)

The order contains one OrderItem for the segments and one OrderItem for the seat or ancillary.

Variant A — seat + full PaxList + PaymentInfo:

```xml
<!-- AMA_TravelOrderChangeRQ / Party (truncated) / Request -->
    <ChangeOrder>
      <UpdateOrderItem>
        <AcceptOffer>
          <SelectedOffer>
            <OfferID>WE55D0D80-FFCB-4147-9EA-1</OfferID>
            <OwnerCode>6X</OwnerCode>
            <ShoppingResponseRefID>WE55D0D80-FFCB-4147-9EA</ShoppingResponseRefID>
            <SelectedOfferItem>
              <OfferItemRefID>WE55D0D80-FFCB-4147-9EA-1-6</OfferItemRefID>
              <PaxRefID>T1</PaxRefID>
              <SelectedSeat>
                <SeatRowNumber>8</SeatRowNumber>
                <ColumnID>A</ColumnID>
              </SelectedSeat>
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
            <GivenName>JOHN</GivenName>
            <Surname>SMITH</Surname>
            <GenderCode>M</GenderCode>
          </Individual>
        </Pax>
        <!-- OTHER PAX -->
      </PaxList>
    </DataLists>
    <PaymentInfo>
      <Amount CurCode="EUR">45.58</Amount>
      <TypeCode>CC</TypeCode>
      <SecurePaymentVersion2>
        <PaymentTrxChannelCode>MO</PaymentTrxChannelCode>
      </SecurePaymentVersion2>
      <PaymentMethod>
        <PaymentCard>
          <CreditCardVendorCode>VI</CreditCardVendorCode>
          <CardNumber>4434260000000008</CardNumber>
          <SeriesCode>123</SeriesCode>
          <ExpirationDate>0139</ExpirationDate>
        </PaymentCard>
      </PaymentMethod>
    </PaymentInfo>
    <Order>
      <OrderID>06X00ORDERID00</OrderID>
      <OwnerCode>6X</OwnerCode>
    </Order>
```

Variant B — ancillary (no `SelectedSeat`), composite `OfferID` `<shoppingResponseRefId>_1A_<serviceOfferId>`. Same envelope as Variant A, replacing the `SelectedOffer` and using `PaymentInfo/Amount CurCode="INR"` `25.77`, `Request/Order/OrderID` `6X_6LKLQS` / `OwnerCode` `6X`:

```xml
<SelectedOffer>
  <OfferID>16758202-5504-48ac-9474-cf51b87ee7c0_1A_1A_TPID_ChsSGVNQMlAtNjMzNTUxMDA2MDE4NDkxNjg2LTE=</OfferID>
  <OwnerCode>6X</OwnerCode>
  <ShoppingResponseRefID>SP2P-633551006018491686</ShoppingResponseRefID>
  <SelectedOfferItem>
    <OfferItemRefID>SP2P-633551006018491686-1-1</OfferItemRefID>
    <PaxRefID>PAX2</PaxRefID>
  </SelectedOfferItem>
</SelectedOffer>
```

`Travel_OrderChange RS`: (diagram in source: updated order screenshot).

---

## OrderCreate vs OrderChange — which path

| | Pre-booking | Post-booking | Post-issuance |
|---|---|---|---|
| Booking API | `Travel_OrderCreate` | `Travel_OrderChange` | `Travel_OrderChange` |
| Wrapper | `Request/CreateOrder/SelectedOffer` (one per offer: air + seat/ancillary) | `Request/ChangeOrder/UpdateOrderItem/AcceptOffer/SelectedOffer` | same as post-booking |
| Order reference | none (order does not exist yet) | `Request/Order/OrderID` + `OwnerCode` | `Request/Order/OrderID` + `OwnerCode` |
| Air offer resent? | Yes — air `SelectedOffer` must be included | No — only the ancillary/seat offer | No |
| SeatAvailability/ServiceList keyed on | `CoreRequest/Offer` (+ `ShoppingResponse`) | `CoreRequest/Order` | `CoreRequest/Order` |
| Payment | separate `Travel_OrderPay` | deferred: **single combined payment** later via `Travel_OrderPay` (no `PaymentInfo` in the change) | **`PaymentInfo` mandatory inside the `Travel_OrderChange`** (instant payment) |

---

## When is Travel_OfferPrice required?

`Travel_OfferPrice` after `Travel_SeatAvailability` / `Travel_ServiceList` is **conditional**. It is a *second* OfferPrice (the first priced the air offer). Send it when:

1. **Carrier is AF/KL** — always, for seats *and* ancillaries. AF/KL signals it by returning, in the `Travel_SeatAvailability` or `Travel_ServiceList` response, metadata:
   `Metadata/Other/.../OtherMetadata/EquivalentID_Metadatas/EquivalentID_Metadata/EquivID[@MetadataKey="EQ01"]/EquivalentID_Key` = **`OFP`** (with `ID_Value` `1`, `Owner` `1A`). Presence of `EquivalentID_Key = OFP` ⇒ a 2nd `Travel_OfferPrice` is needed.
2. **Any carrier supporting the weight concept for bags** — if `ServiceDefinitionList/.../BookingInstructions/AddlDataMeasure@UnitCode` = **`kg`**, a 2nd `Travel_OfferPrice` is **mandatory** to price the total weight for the chargeable bag.
3. **AF/KL SAF + Seat Bundle offers** — see that section; a 2nd `Travel_OfferPrice` with the seat's `OfferItemID` + seat number is required.

Consequences:
- The details returned in the second offer price response (**offer ids and shopping response ids for both the air and the chargeable services, and total amounts**) must be used for `Travel_OrderCreate` or `Travel_OrderChange` **BEFORE ISSUANCE**.
- For AF/KL, the required details in the `Travel_OrderCreate` request must be taken **only from the second offer price**.
- For bags in weight ("kg") from **Altea** carriers via `Travel_ServiceList`, the 2nd `Travel_OfferPrice` must contain the **air offer's OfferPrice details + the offer ids from the `Travel_ServiceList` response**.
- The amount in the `Travel_OfferPrice` response is the **total amount to pay** for the bag / seat / ancillary (not a unit price).
- `Qty` is **mandatory for AF/KL** when booking any ancillary service.

---

## Baggage: weight (kg) vs pieces

Discriminator: `ServiceDefinition/BookingInstructions/AddlDataMeasure/@UnitCode`.

| `@UnitCode` | Meaning | Sample | Handling |
|---|---|---|---|
| `n` | number of **pieces** | `<SSRCode>BULK</SSRCode><AddlDataMeasure UnitCode="n">1</AddlDataMeasure>` | `Qty` = number of pieces; price scales per piece |
| `kg` | **weight** in kilograms | `<SSRCode>XBAG</SSRCode><AddlDataMeasure UnitCode="kg">1</AddlDataMeasure>`, `Name` = `ONE KILOGRAM BAGGAGE` | `Qty` = number of **kilograms**; a **2nd `Travel_OfferPrice` is mandatory** to price the total weight |
| element absent | neither (e.g. `ABAG` / `LUGGAGE`) | `<SSRCode>ABAG</SSRCode>` only | plain a-la-carte service |

Weight example (traveler entered 5 kg — `Qty` is the kg count, and the OfferPrice RS amount is the **total** to pay):

```xml
<!-- AMA_TravelOfferPriceRQ / Party (truncated) / Request / DataLists (truncated) -->
    <PricedOffer>
      <SelectedOffer>
        <OfferRefID>SP1P-1274260-1</OfferRefID>
        <OwnerCode>6X</OwnerCode>
        <ShoppingResponseRefID>SP1P-1274260401105</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemRefID>SP1P-1274260-1-1</OfferItemRefID>
          <PaxRefID>PAX2</PaxRefID>
          <SelectedALaCarteOfferItem>
            <Qty>5</Qty>
          </SelectedALaCarteOfferItem>
        </SelectedOfferItem>
      </SelectedOffer>
    </PricedOffer>
    <ShoppingCriteria>
      <ExistingOrderCriteria>
        <PaxRefID>PAX2</PaxRefID>
        <Order>
          <OrderID>6X_52577</OrderID>
        </Order>
      </ExistingOrderCriteria>
    </ShoppingCriteria>
```

Altea/AF-KL variant — air offer item **plus** the ServiceList offer item in the same request (`Qty` 10 kg on the bag item; the air item has no `SelectedALaCarteOfferItem`):

```xml
<!-- AMA_TravelOfferPriceRQ / Party (truncated) / Request / DataLists (truncated) -->
    <PricedOffer>
      <SelectedOffer>
        <OfferRefID>TOg-eKABE5SGyJxhYIh-oK7C_1A_b7f8b31a-b035-4899-83da-06c503affcbd_1A_1A_TPID_CicSIzFGMlNRWl9kOGVkRlhtYnRLdDkxdmlZRUFkS3VYa3pHeEVKGAE</OfferRefID>
        <OwnerCode>SQ</OwnerCode>
        <ShoppingResponseRefID>1F2SQZ_d8edFXmbtKt91viYEAdKuXkzGxEJ</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemRefID>1A_TPID_CAESJTFGMlNRWl9kOGVkRlhtYnRLdDkxdmlZRUFkS3VYa3pHeEVKLTE=</OfferItemRefID>
          <PaxRefID>1</PaxRefID>
        </SelectedOfferItem>
        <SelectedOfferItem>
          <OfferItemRefID>1F2SQZ_d8edFXmbtKt91viYEAdKuXkzGxEJ-2</OfferItemRefID>
          <PaxRefID>1</PaxRefID>
          <SelectedALaCarteOfferItem>
            <Qty>10</Qty>
          </SelectedALaCarteOfferItem>
        </SelectedOfferItem>
      </SelectedOffer>
    </PricedOffer>
```

AF/KL detection metadata (returned in `Travel_SeatAvailability` / `Travel_ServiceList` RS):

```xml
<Metadata>
  <Other>
    <!-- ... -->
    <OtherMetadata>
      <EquivalentID_Metadatas>
        <EquivalentID_Metadata>
          <EquivID MetadataKey="EQ01">
            <EquivalentID_Key>OFP</EquivalentID_Key>
            <ID_Value>1</ID_Value>
            <Owner>1A</Owner>
          </EquivID>
        </EquivalentID_Metadata>
      </EquivalentID_Metadatas>
    </OtherMetadata>
  </Other>
</Metadata>
```

AF/KL returns the same `OFP` marker for bags as for seats.

> Certification note (caller-supplied rule id **Offer_07**; the rule id itself is not printed in this section of the guide): treating a `kg` bag as a piece bag — or sending `Qty` as a piece count when `@UnitCode="kg"` — produces the wrong total and skips the mandatory 2nd `Travel_OfferPrice`. Always branch on `@UnitCode`.

---

## ID chaining

From **air shopping / 1st `Travel_OfferPrice`**:
- `OfferID` / `OfferItemID` + `OwnerCode` → `Travel_SeatAvailability` `Request/CoreRequest/Offer/OfferItemID` + `OwnerCode`; `Travel_ServiceList` `Request/CoreRequest/Offer/OfferID`, `OwnerCode`, `OfferItem/OfferItemID`, `OfferItem/OwnerCode`, `OfferItem/Service/ServiceID`.
- `ShoppingResponseID` → `Request/ShoppingResponse/ShoppingResponseID` in both (pre-booking only).

From **`Travel_OrderCreate` RS** (post-booking / post-issuance):
- `OrderID` + `OwnerCode` → `Travel_SeatAvailability`/`Travel_ServiceList` `Request/CoreRequest/Order/*`, and `Travel_OrderChange` `Request/Order/*`.

Inside **`Travel_SeatAvailability` RS**:
- `SeatMap/.../Seat/OfferItemRefID` → `ALaCarteOffer/ALaCarteOfferItem/OfferItemID` (gives the price).
- `ALaCarteOfferItem/Service/ServiceDefinitionRefID` → `ServiceDefinitionList/ServiceDefinition/ServiceDefinitionID`.
- `ALaCarteOfferItem/Eligibility/PaxRefID` and `.../FlightAssociations/PaxSegmentRefID` say for which pax/segment the item is valid.

Inside **`Travel_ServiceList` RS**:
- `ALaCarteOfferItem/Service/ServiceDefinitionRefID` (e.g. `SRV1`) → `ServiceDefinitionList/ServiceDefinition/ServiceDefinitionID` (name, SSR code, EMD sub-code, `AddlDataMeasure`).

Into **`Travel_OfferPrice` (2nd)**:
- `ALaCarteOfferItem/OfferItemID` → `PricedOffer/SelectedOffer/SelectedOfferItem/OfferItemRefID`.
- Enclosing offer id → `SelectedOffer/OfferRefID`; owner → `SelectedOffer/OwnerCode`; shopping response → `SelectedOffer/ShoppingResponseRefID`.
- `Eligibility/PaxRefID` → `SelectedOfferItem/PaxRefID`.
- Chosen seat row/column (from the seat map) → `SelectedOfferItem/SelectedSeat/SeatRowNumber` + `ColumnID`.
- Quantity (pieces or kg) → `SelectedOfferItem/SelectedAlaCarteOfferItem/Qty` (also spelled `SelectedALaCarteOfferItem` in the bag samples).
- Post-booking bag pricing may also carry `ShoppingCriteria/ExistingOrderCriteria/PaxRefID` + `Order/OrderID`.

Into **`Travel_OrderCreate`** (pre-booking):
- Air: `SelectedOffer/OfferID`, `OwnerCode`, `ShoppingResponseRefID`, `SelectedOfferItem/OfferItemID`, `PaxRefID`.
- Seat/ancillary: second `SelectedOffer` with the seat/service `OfferID`, its `OwnerCode` (may be the service owner, e.g. `SQ`), `ShoppingResponseRefID`, `SelectedOfferItem/OfferItemID` (= `ALaCarteOfferItem/OfferItemID`), `PaxRefID`, and for seats `SelectedSeat/SeatRowNumber` + `ColumnID`.

Into **`Travel_OrderChange`** (post-booking / post-issuance):
- `ChangeOrder/UpdateOrderItem/AcceptOffer/SelectedOffer/OfferID` (sometimes composite: `<shoppingResponseRefID>_1A_<offerItemID>`), `OwnerCode`, `ShoppingResponseRefID`.
- `SelectedOfferItem/OfferItemRefID` = the `ALaCarteOfferItem/OfferItemID`; `PaxRefID`; seats add `SelectedSeat`.
- `Request/Order/OrderID` + `OwnerCode`.
- Post-issuance only: `Request/PaymentInfo`.
- Free-seat exchange only: `ChangeOrder/DeleteOrderItem/OrderItemRefID` = the existing free-seat OrderItem id.

**Fallback rule:** if `Travel_SeatAvailability` RS or `Travel_ServiceList` RS does not return a `ShoppingResponseRefID`, take the `ShoppingResponseRefID` from the `Travel_OfferPrice` RS.

---

## Exchange of Free Seats for Family Seating

- Some carriers guarantee children are seated next to an accompanying adult; this shows in the PNR reply as a **free seat automatically assigned to the child**.
- Free seats can be exchanged for other free or chargeable seats, as per travel seller selection.
- **Seats for all members of the reservation are assigned a few minutes after the order is created.**
- To know the seats allocated by the carrier, travel sellers must **retrieve the corresponding Amadeus PNR and manually synchronize it**; the child seat is then visible in the Amadeus PNR.
- Check the **NDC Features per Airline spreadsheet** for which carriers support exchange of free seats.
- (diagram in source: table/screenshot listing carriers supporting free-seat exchange.)
- **Note — it is not possible to test this functionality in the test system. AA agents will update production bookings only.**

Retrieve the seat map on the existing order: `Travel_SeatAvailability` as in 2.1 with `Request/CoreRequest/Order/OrderID` = `06X00ORDERID00`, `OwnerCode` = `AA`.

Exchange = `AcceptOffer` (new seat) + `DeleteOrderItem` (the free seat OrderItem) in the **same** `ChangeOrder`:

```xml
<!-- AMA_TravelOrderChangeRQ / Party (truncated) / Request -->
    <ChangeOrder>
      <UpdateOrderItem>
        <AcceptOffer>
          <SelectedOffer>
            <OfferID>WE55DFFCB-4147-9EA-1</OfferID>
            <OwnerCode>AA</OwnerCode>
            <ShoppingResponseRefID>WE55D0D80-FFCB-4147-9EA</ShoppingResponseRefID>
            <SelectedOfferItem>
              <OfferItemRefID>WE55D0D80-FFCB-4147-9EA-1-6</OfferItemRefID>
              <PaxRefID>T1</PaxRefID>
              <SelectedSeat>
                <SeatRowNumber>8</SeatRowNumber>
                <ColumnID>A</ColumnID>
              </SelectedSeat>
            </SelectedOfferItem>
          </SelectedOffer>
        </AcceptOffer>
      </UpdateOrderItem>
      <DeleteOrderItem>
        <OrderItemRefID>FREE-SEAT-T1-S4</OrderItemRefID>
      </DeleteOrderItem>
    </ChangeOrder>
    <!-- DataLists/PaxList: Pax PaxID T1, PTC ADT, Individual JOHN SMITH -->
    <PaymentInfo>
      <Amount CurCode="USD">45.58</Amount>
      <!-- TypeCode CC, SecurePaymentVersion2/PaymentTrxChannelCode MO,
           PaymentMethod/PaymentCard: VI / 4434260000000008 / SeriesCode 123 / ExpirationDate 0139 -->
    </PaymentInfo>
    <Order>
      <OrderID>06X00ORDERID00</OrderID>
      <OwnerCode>AA</OwnerCode>
    </Order>
```

Note: `DeleteOrderItem` is a sibling of `UpdateOrderItem` under `ChangeOrder` (it is **outside** `AcceptOffer`/`UpdateOrderItem`).

---

## AF/KL SAF + Seat Bundles

- Flow is very similar to the AF/KL **Pre-Booking** flow.
- With activation on AFKL side, **AFKL NDC recommendation can return free-seat `offerItemID`s when performing Upsell** with `Fare_MasterPricerTravelBoardSearch` search criteria **`FFI-3`** and **`UPH-3`**. Both parameters must be **enabled at the office profile level** (see office setting requirements at the start of the implementation guide).
- (diagram in source: MasterPricer request snippet showing the FFI-3 / UPH-3 criteria.)
- The total price of each SAF/Seat Bundle recommendation includes **Flight + Seat + Taxes**; therefore **the price of Air and Seats cannot be calculated separately**.
- (diagram in source: recommendation pricing screenshot showing the combined total.)
- For SAF/Seat Bundle offers, **within 1 `offerID`, 1 AIR `offerItemID` and 1 Seat `OfferItemID` are returned for each PTC**.
- (diagram in source: shopping response showing one air and one seat offer item per PTC inside a single offer.)

Sequence:
1. `Travel_OfferPrice` (1st) — **both the Flight and Seat offer item IDs must be present in the request** to successfully price a SAF/Seat Bundle offer. (diagram in source: OfferPrice request with both offer item IDs.)
2. `Travel_OfferPrice` RS returns **both Flight and Seat offer items, both marked mandatory for booking**; the total price is the price of Flight and Seat combined. (diagram in source: OfferPrice response.)
3. `Travel_SeatAvailability` — retrieve the seat map by **specifying the `OfferItemID` returned in the `Travel_OfferPrice` response**. (diagram in source: SeatAvailability request with that OfferItemID.)
4. Each seat in the `Travel_SeatAvailability` response has an `offerItemID` which must be used to perform a **2nd `Travel_OfferPrice`**; the **seat number must also be specified** in that 2nd request. (diagram in source: 2nd OfferPrice request with seat offer item id + seat number.)
5. The 2nd `Travel_OfferPrice` response again returns **both the flight and seat offer item**. (diagram in source: 2nd OfferPrice response.)
6. **Both `offerItemID`s are mandatory in the `Travel_OrderCreate` request** for a successful booking creation. (diagram in source: OrderCreate request containing both offer item IDs.)

---

## Gotchas

- `Travel_SeatAvailability` and `Travel_ServiceList` are independent — do not assume one implies the other, and do not require both.
- A chargeable seat with **no amount** returned must be **blocked** in the UI; chargeable bags **not available on all segments** must be blocked too.
- **Missing `ShoppingResponseRefID`** in SeatAvailability/ServiceList RS: fall back to the one from `Travel_OfferPrice` RS. Applies to `Travel_OrderCreate` and to both `Travel_OrderChange` flows.
- **AF/KL:** build `Travel_OrderCreate`/`Travel_OrderChange` *only* from the **2nd** `Travel_OfferPrice` response — never from the 1st or from the SeatAvailability/ServiceList response directly.
- **AF/KL:** `Qty` is mandatory for any ancillary service.
- **`AddlDataMeasure@UnitCode="kg"` ⇒ mandatory 2nd `Travel_OfferPrice`**; `Qty` is kilograms, not pieces (`UnitCode="n"` = pieces). Amount returned is the total for the whole weight.
- **Altea carriers, bags in kg:** the 2nd `Travel_OfferPrice` must include the **air offer's** OfferPrice details **plus** the offer ids from the `Travel_ServiceList` response — sending only the bag offer is wrong.
- The `OFP` marker lives in `Metadata/.../EquivID[@MetadataKey="EQ01"]/EquivalentID_Key`, not in the offer items — parse metadata, not just the offer.
- **QF requires `OwnerCode`** inside `Request/CoreRequest/Offer/OfferItem` of `Travel_ServiceList` RQ.
- Post-booking `Travel_OrderChange` must carry **no** payment (single combined payment via `Travel_OrderPay`); post-issuance `Travel_OrderChange` **must** carry `PaymentInfo` (instant payment).
- Ancillary `SelectedOffer` may need the **service owner** code (e.g. `SQ`) while the air `SelectedOffer` uses the marketing/order owner (e.g. `6X`) — even when both share the same `OfferID`.
- Post-issuance / post-booking ancillary `OfferID`s are sometimes **composite**: `<ShoppingResponseRefID>_1A_<offerItemID>`. Send the composite value in `OfferID` and the plain value in `ShoppingResponseRefID`.
- Element name casing differs across samples: `SelectedAlaCarteOfferItem` (seat samples) vs `SelectedALaCarteOfferItem` (bag samples). Follow the WSDL/XSD, not the guide text.
- Family-seating free seats appear **a few minutes after order creation** and require a manual Amadeus PNR retrieve/synchronize to be visible; exchange cannot be tested in the test system (AA production only).
- SAF/Seat Bundles: air and seat prices are **not separable**, and both offer item IDs are mandatory in OfferPrice (both calls) and OrderCreate.
- `Travel_ServiceList` responses may be namespaced (`ns2:`); write namespace-agnostic XPath.
