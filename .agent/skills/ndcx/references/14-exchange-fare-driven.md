# Voluntary Exchange — Fare Driven Exchange

> Source: WBS Implementation Guide NDC[X] Ancillaries, Seats and Servicing v1.2, Voluntary Exchange - Fare Driven Exchange

In the Fare driven exchange, **Travel_OrderReshop must be sent twice**.

- 1st Travel_OrderReshop = shopping: obtain the list of flights and fares available to replace the original trip (equivalent to the shopping step of the prime booking flow). It is mandatory.
- 2nd Travel_OrderReshop = pricing: price the selected flight offer returned by the 1st Travel_OrderReshop, producing a priced offer.
- The change is validated **and paid (additional collection only) at the same time** using Travel_OrderChange. There is no separate Travel_OrderPay step in this flow.

For FLX carriers only — the ReshopParameters section is labeled as `AutoExchRequestInd="true"`.
(The same `<ReshopParameters>` block is shown highlighted in the source use-case snippets with the note "This section is required for -- Accelya only".)

## Call sequence

1. **Travel_OrderReshop** (equivalent to shopping) — `AMA_TravelOrderReshopRQ` / `AMA_TravelOrderReshopRS`. Sends the order item ref (order ID), the carrier, optional `ReshopParameters`, the new flight request (`AddOfferItems`) and the `DeleteOrderItem` / `RetainServiceID` instructions. Returns a list of `ReshopOffer`s under `ReshopResults UseCase="EXCHANGE"`, each with amount + **tax summary**, plus the differential elements.
2. **Travel_OrderReshop** (equivalent to pricing) — same message, but `AddOfferItems/FlightRequest/SelectedOffer` references the chosen offer from step 1. Returns a **priced offer** with amount + **tax breakdown**. This response's IDs feed Travel_OrderChange.
3. **Travel_OrderChange** — `AMA_TravelOrderChangeRQ`. Accepts the priced offer (`ChangeOrder/UpdateOrderItem/AcceptOffer/SelectedOffer`) and carries `PaymentInfo` for the add-collect. The change is validated and the payment is done here.
4. **Travel_OrderView RS** — returned by Travel_OrderChange; contains multiple OrderItems after the exchange.

(diagram in source: Travel_OrderReshop RS screenshot showing the returned list of ReshopOffer entries, one of which is selected and priced in the 2nd Travel_OrderReshop.)
(diagram in source: Travel_OrderReshop pricing RQ screenshot alongside the request XML.)
(diagram in source: two Travel_OrderView screenshots, "Before schedule change" vs "After schedule change", the latter showing multiple OrderItems.)

## ID chaining

| Source (response) | XPath in source | Target (next request) | XPath in target |
|---|---|---|---|
| Existing order ID | (from prior Travel_OrderView / order retrieval) | Travel_OrderReshop RQ #1 and #2 | `//AMA_TravelOrderReshopRQ/Request/OrderItemRefID` — this is the **actual order ID** (e.g. `6X_TP2WDV`, `6X001FOEX14`, `6X001H7FOEXA2`) |
| Pax order item ID | order item ID of the pax (e.g. `6X_TP2WDV-AIR-1-1`, `PoIP168A7C02-F079-8A86-1-1_1APAX_T1`) | Travel_OrderReshop RQ | `//Request/UpdateOrder/ReshopOrder/ServiceOrder/DeleteOrderItem/OrderItemRefID` |
| Service ID (segment/passenger pair, e.g. `SEG1_PAX1`) | order services | Travel_OrderReshop RQ | `//Request/UpdateOrder/ReshopOrder/ServiceOrder/DeleteOrderItem/RetainServiceID` |
| Pricing OfferID | `//AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/OfferID` | Travel_OrderReshop RQ #2 | `//Request/UpdateOrder/ReshopOrder/ServiceOrder/AddOfferItems/FlightRequest/SelectedOffer/OfferRefID` |
| Pricing OwnerCode | `//AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/OwnerCode` | Travel_OrderReshop RQ #2 | `.../SelectedOffer/OwnerCode` |
| Pricing ResponseID | `//AMA_TravelOrderReshopRS/Response/ShoppingResponse/ShoppingResponseID` | Travel_OrderReshop RQ #2 | `.../SelectedOffer/ShoppingResponseRefID` |
| Pricing OfferItemID | `//AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/OfferItem/OfferItemID` | Travel_OrderReshop RQ #2 | `.../SelectedOffer/SelectedOfferItem/OfferItemRefID` |
| Pricing OfferID (from RS #2) | `//AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/OfferID` | Travel_OrderChange RQ | `//Request/ChangeOrder/UpdateOrderItem/AcceptOffer/SelectedOffer/OfferID` |
| Pricing OwnerCode (RS #2) | `.../ReshopOffer/OwnerCode` | Travel_OrderChange RQ | `.../AcceptOffer/SelectedOffer/OwnerCode` |
| Pricing ResponseID (RS #2) | `//Response/ShoppingResponse/ShoppingResponseID` | Travel_OrderChange RQ | `.../AcceptOffer/SelectedOffer/ShoppingResponseRefID` |
| Pricing OfferItemID (RS #2) | `.../ReshopOffer/OfferItem/OfferItemID` | Travel_OrderChange RQ | `.../SelectedOffer/SelectedOfferItem/OfferItemRefID` |
| PaxID | `//DataLists/PaxList/Pax/PaxID` (e.g. `T1`) | Travel_OrderChange RQ | `.../SelectedOfferItem/PaxRefID` |
| Order ID + owner | existing order | Travel_OrderChange RQ | `//Request/Order/OrderID`, `//Request/Order/OwnerCode` |

The new offer is linked to the existing order by (a) sending the order ID in `Request/OrderItemRefID` on both Reshop calls so the reshop is scoped to that order, and (b) sending `Request/Order/OrderID` + `OwnerCode` in Travel_OrderChange alongside the accepted offer.

## Use case 1 — Add a segment

A new bound is added and **all existing bounds in the order are kept unchanged**. New origin, destination, and date (with time if needed), **cabin type and cabin name** are received in the input. **If some of these items are missing, the query is rejected.** The order items are to be deleted and all services (segment/passenger pairs) are protected (retained).

Note: the `OrderItemRefID` beneath `<Request>` is **not** the same `OrderItemRefID` inside `<DeleteOrderItem>`. The 1st one is the actual order ID; the 2nd one is the pax order item ID.

**Differs by:**
- `ShoppingCriteria/CabinTypeCriteria/CabinTypeName` is used (value `BUS`), plus `ShoppingCriteria/CarrierCriteria/Carrier/AirlineDesigCode`.
- No `<Paxs>` block in `AddOfferItems`.
- `DeleteOrderItem` carries a `RetainServiceID` for each unchanged bound's service.

```xml
<Request>
  <OrderItemRefID>6X_TP2WDV</OrderItemRefID>          <!-- actual order ID -->
  <BookingRef>
    <BookingEntity>
      <Carrier>
        <AirlineDesigCode>6X</AirlineDesigCode>
      </Carrier>
    </BookingEntity>
  </BookingRef>
  <ReshopParameters>                                   <!-- required for Accelya only -->
    <Notices>
      <PricingParameters AutoExchRequestInd="true"/>
    </Notices>
  </ReshopParameters>
  <UpdateOrder>
    <ReshopOrder>
      <ServiceOrder>
        <AddOfferItems>
          <ShoppingCriteria>
            <CabinTypeCriteria>
              <CabinTypeName>BUS</CabinTypeName>
            </CabinTypeCriteria>
            <CarrierCriteria>
              <Carrier>
                <AirlineDesigCode>6X</AirlineDesigCode>
              </Carrier>
            </CarrierCriteria>
          </ShoppingCriteria>
          <FlightRequest>
            <OriginDestRequest>
              <DestArrivalRequest>
                <IATA_LocationCode>CDG</IATA_LocationCode>
              </DestArrivalRequest>
              <OriginDepRequest>
                <IATA_LocationCode>NCE</IATA_LocationCode>
                <Date>2022-12-01</Date>
              </OriginDepRequest>
            </OriginDestRequest>
          </FlightRequest>
        </AddOfferItems>
        <DeleteOrderItem>
          <OrderItemRefID>6X_TP2WDV-AIR-1-1</OrderItemRefID>   <!-- pax order item ID -->
          <RetainServiceID>SEG1_PAX1</RetainServiceID>         <!-- retain the service for the unchanged bound(s) -->
        </DeleteOrderItem>
      </ServiceOrder>
    </ReshopOrder>
  </UpdateOrder>
</Request>
```

XPaths: `//AMA_TravelOrderReshopRQ/Request/UpdateOrder/ReshopOrder/ServiceOrder/AddOfferItems/ShoppingCriteria/CabinTypeCriteria/CabinTypeName`, `.../AddOfferItems/FlightRequest/OriginDestRequest/{DestArrivalRequest|OriginDepRequest}/IATA_LocationCode`, `.../OriginDepRequest/Date`, `.../ServiceOrder/DeleteOrderItem/{OrderItemRefID|RetainServiceID}`.

## Use case 2 — Change a segment

New origin, destination, and date (with time if needed) is received in the input, with the order item to be deleted and services to be retained (segment/passenger pairs). Example: delete 1 segment, retain 1 service for the unchanged bound(s).

**Differs by:**
- `AddOfferItems` includes a `<Paxs>` block with the pax to reprice.
- `ShoppingCriteria/CabinTypeCriteria/CabinTypeCode` (`Y`) is used instead of `CabinTypeName`; no `CarrierCriteria`.
- `DeleteOrderItem` still carries `RetainServiceID` for the unchanged bound(s).

```xml
<AMA_TravelOrderReshopRQ>
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>anId</AgencyID>
        <PseudoCityID>aPccId</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <OrderItemRefID>6X001FOEX14</OrderItemRefID>
    <BookingRef>
      <BookingEntity>
        <Carrier>
          <AirlineDesigCode>6X</AirlineDesigCode>
        </Carrier>
      </BookingEntity>
    </BookingRef>
    <ReshopParameters>                                 <!-- required for Accelya only -->
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
                <PaxID>PAX1</PaxID>
                <PTC>ADT</PTC>
                <Individual>
                  <GivenName>SMITH</GivenName>
                  <Surname>MIKE</Surname>
                  <GenderCode>M</GenderCode>
                </Individual>
              </Pax>
            </Paxs>
            <ShoppingCriteria>
              <CabinTypeCriteria>
                <CabinTypeCode>Y</CabinTypeCode>
              </CabinTypeCriteria>
            </ShoppingCriteria>
            <FlightRequest>
              <OriginDestRequest>
                <DestArrivalRequest>
                  <IATA_LocationCode>DFW</IATA_LocationCode>
                </DestArrivalRequest>
                <OriginDepRequest>
                  <IATA_LocationCode>MIA</IATA_LocationCode>
                  <Date>2023-06-23</Date>
                </OriginDepRequest>
              </OriginDestRequest>
            </FlightRequest>
          </AddOfferItems>
          <DeleteOrderItem>
            <OrderItemRefID>PoIP168A7C02-F079-8A86-1-1_1APAX_T1</OrderItemRefID>
            <RetainServiceID>SEG1_PAX1</RetainServiceID>   <!-- retain the service for the unchanged bound(s) -->
          </DeleteOrderItem>
        </ServiceOrder>
      </ReshopOrder>
    </UpdateOrder>
  </Request>
</AMA_TravelOrderReshopRQ>
```

## Use case 3 — Change all segments

New origin, destination, and date (with time if needed) is received in the input with the order item to be deleted. **No services are retained.**

**Differs by:**
- Identical to "change a segment" except `<DeleteOrderItem>` contains **only** `OrderItemRefID` — **no `RetainServiceID`**.

```xml
<!-- //AMA_TravelOrderReshopRQ/Request/UpdateOrder/ReshopOrder/ServiceOrder/DeleteOrderItem -->
<DeleteOrderItem>
  <OrderItemRefID>PoIP168A7C02-F079-8A86-1-1_1APAX_T1</OrderItemRefID>
</DeleteOrderItem>
```

All other elements (`Party`, `Request/OrderItemRefID` = `6X001FOEX14`, `BookingRef/BookingEntity/Carrier/AirlineDesigCode` = `6X`, `ReshopParameters` for Accelya, `Paxs` PAX1/ADT SMITH MIKE/M, `CabinTypeCode` = `Y`, `FlightRequest` MIA→DFW `2023-06-23`) are as in use case 2.

## Travel_OrderReshop RS (shopping) — differential structure

Within the `AddOfferItem` section there are several differential details. The **1st** OrderReshop returns the amount + the **tax summary**. The **2nd** OrderReshop provides the amount + the **tax breakdown**. For netting details see the Exchange with Netting section of the implementation guide.

```xml
<ReshopResults UseCase="EXCHANGE">
  <ReshopOffers>
    <ReshopOffer>
      ...truncated
      <AddOfferItem>
        <OfferItemID>1A_TPID_CAESJGEzZGZlZTN==</OfferItemID>
        ...truncated
        <OriginalOrderItemDifferential>
          <Amount CurCode="EUR">13100</Amount>
          <TaxSummary>
            <TotalTaxAmount CurCode="EUR">39177</TotalTaxAmount>
          </TaxSummary>
        </OriginalOrderItemDifferential>
        <NewOfferItemDifferential>
          <Amount CurCode="EUR">18000</Amount>
          <TaxSummary>
            <TotalTaxAmount CurCode="EUR">40733</TotalTaxAmount>
          </TaxSummary>
        </NewOfferItemDifferential>
        <PenaltyDifferential>
          <Amount CurCode="EUR">20000</Amount>
        </PenaltyDifferential>
        <DifferentialAmountDue>
          <Amount CurCode="EUR">7656</Amount>
          <TaxSummary>
            <TotalTaxAmount CurCode="EUR">2756</TotalTaxAmount>
            <CollectionInd>true</CollectionInd>
          </TaxSummary>
        </DifferentialAmountDue>
      </AddOfferItem>
    </ReshopOffer>...
```

Element semantics:

- **OriginalOrderItemDifferential** — old base fare amount and taxes. `Amount` = original base fare amount. `TaxSummary` = original taxes total and breakdown per tax.
- **NewOfferItemDifferential** — new base fare amount and taxes. `Amount` = new base fare amount. `TaxSummary` = new taxes total and breakdown per tax.
- **PenaltyDifferential** — penalty for the exchange. `Amount` = penalty amount.
- **DifferentialAmountDue** — balance amounts between old fare + old taxes and new fare + new taxes. `Amount` includes base fare + tax.
  - Positive → due by the passenger (additional collection).
  - Negative → due by the airline (residual value). Auto refund of a residual value is **not supported for all carriers**; refer to the Features per Carrier spreadsheet.
  - `TaxSummary/TotalTaxAmount` = total balance of the taxes (already included in the base-fare-plus-tax `Amount`).
  - `TaxSummary/CollectionInd` = `true` if amount is due by passenger, `false` if due by airline.
  - Breakdown per tax = balance for each tax.

If there is a **PenaltyDifferential** + a **DifferentialAmountDue** returned in the Travel_OrderReshopRS, the total amount to pay with this 1-Step Exchange is the **addition of both amounts**. The 2nd Travel_OrderReshopRS confirms the final amounts.

## Travel_OrderReshop RQ (pricing, 2nd call)

Namespace: `http://xml.amadeus.com/2010/06/Travel_OrderReshopRQ_v1`.

```xml
<AMA_TravelOrderReshopRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderReshopRQ_v1">
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>anId</AgencyID>
        <PseudoCityID>aPccId</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <OrderItemRefID>6X001H7FOEXA2</OrderItemRefID>
    <BookingRef>
      <BookingID/>
      <BookingEntity>
        <Carrier>
          <AirlineDesigCode>6X</AirlineDesigCode>
        </Carrier>
      </BookingEntity>
    </BookingRef>
    <UpdateOrder>
      <ReshopOrder>
        <ServiceOrder>
          <AddOfferItems>
            <FlightRequest>
              <SelectedOffer>
                <OfferRefID>ERaVWQvNt4YDD_1A_1A_TPID_CiEICEV4Y2hhbmdl</OfferRefID>
                <OwnerCode>6X</OwnerCode>
                <ShoppingResponseRefID>R38022B87-5F99-464A-85BE</ShoppingResponseRefID>
                <SelectedOfferItem>
                  <OfferItemRefID>1A_TPID_CGESHVIzODAODVCRS05Ny0x</OfferItemRefID>
                </SelectedOfferItem>
              </SelectedOffer>
            </FlightRequest>
          </AddOfferItems>
        </ServiceOrder>
      </ReshopOrder>
    </UpdateOrder>
  </Request>
</AMA_TravelOrderReshopRQ>
```

Note: no `ReshopParameters` and no `DeleteOrderItem` in the pricing call. The output is a priced offer; its information is used in Travel_OrderChange to create the new order (same four IDs: OfferID, OwnerCode, ShoppingResponseID, OfferItemID, at the XPaths in the ID chaining table).

## Travel_OrderChange RQ (validate + pay)

Namespace: `http://xml.amadeus.com/2010/06/Travel_OrderChangeRQ_v1`.

```xml
<AMA_TravelOrderChangeRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderChangeRQ_v1">
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>anId</AgencyID>
        <PseudoCityID>anId</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <ChangeOrder>
      <UpdateOrderItem>
        <AcceptOffer>
          <SelectedOffer>
            <OfferID>1A_TPID_CiAIARIaUkI0MEQyRIIRXhjaGFuZ2U=</OfferID>
            <OwnerCode>6X</OwnerCode>
            <ShoppingResponseRefID>RB40D2C5B-A3D0-4068-A137</ShoppingResponseRefID>
            <SelectedOfferItem>
              <OfferItemRefID>1A_TPID_CAESHFJCNDBxLTE=</OfferItemRefID>
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
            <GivenName>MIKE</GivenName>
            <Surname>SMITH</Surname>
          </Individual>
        </Pax>
      </PaxList>
    </DataLists>
    <Order>
      <OrderID>6X001H7FOEXA2</OrderID>
      <OwnerCode>6X</OwnerCode>
    </Order>
    <PaymentInfo>
      <Amount CurCode="USD">276.56</Amount>   <!-- → DifferentialAmountDue + PenaltyDifferential -->
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
  </Request>
</AMA_TravelOrderChangeRQ>
```

The change is validated, and the payment is done in Travel_OrderChange. The Travel_OrderView response returned afterwards contains multiple OrderItems.

## Money

| Value | XPath | Notes |
|---|---|---|
| Original base fare | `//AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/AddOfferItem/OriginalOrderItemDifferential/Amount` | `CurCode` attribute carries currency |
| Original total tax | `.../AddOfferItem/OriginalOrderItemDifferential/TaxSummary/TotalTaxAmount` | breakdown per tax also present |
| New base fare | `.../AddOfferItem/NewOfferItemDifferential/Amount` | |
| New total tax | `.../AddOfferItem/NewOfferItemDifferential/TaxSummary/TotalTaxAmount` | |
| Penalty / change fee | `.../AddOfferItem/PenaltyDifferential/Amount` | penalty amount for the exchange |
| Add-collect **or** residual value | `.../AddOfferItem/DifferentialAmountDue/Amount` | positive = add-collect due by pax; negative = residual value due by airline; includes base fare + tax |
| Tax balance | `.../AddOfferItem/DifferentialAmountDue/TaxSummary/TotalTaxAmount` | balance of taxes, already inside `DifferentialAmountDue/Amount` |
| Who owes | `.../AddOfferItem/DifferentialAmountDue/TaxSummary/CollectionInd` | `true` = due by passenger, `false` = due by airline |
| Total to pay | not a single element — compute `DifferentialAmountDue/Amount` + `PenaltyDifferential/Amount` | send in `//AMA_TravelOrderChangeRQ/Request/PaymentInfo/Amount` |

Formatting:
- Currency is on the `CurCode` attribute of `<Amount>` / `<TotalTaxAmount>` (e.g. `CurCode="EUR"`, `CurCode="USD"`).
- Reshop differential amounts appear as unpunctuated integers (`13100`, `39177`, `18000`, `40733`, `20000`, `7656`, `2756` EUR).
- The Travel_OrderChange `PaymentInfo/Amount` in the guide is written with a decimal point (`276.56` USD) and is documented as DifferentialAmountDue + PenaltyDifferential.

## Gotchas

- Two Travel_OrderReshop calls are mandatory: the 1st cannot be skipped, and only an offer returned by the 1st can be priced by the 2nd.
- `Request/OrderItemRefID` (order ID) vs `DeleteOrderItem/OrderItemRefID` (pax order item ID) are different values despite the identical element name — mixing them up breaks the reshop.
- Add-a-segment requires origin, destination, date (with time if needed), **cabin type and cabin name**; if any are missing the query is rejected.
- Add a segment and change a segment must retain services (`RetainServiceID`, segment/passenger pairs, e.g. `SEG1_PAX1`) for the bounds that stay; change-all-segments must omit `RetainServiceID` entirely.
- The source's add-a-segment example uses `CabinTypeName` (`BUS`) while change-a-segment / change-all use `CabinTypeCode` (`Y`) — do not assume one element for both.
- `ReshopParameters/Notices/PricingParameters@AutoExchRequestInd="true"` — stated as "for FLX carriers only" in the intro and as "required for Accelya only" in the per-use-case snippets; send it for those carriers, omit for others. It is not sent on the 2nd (pricing) Reshop.
- 1st Reshop RS gives a tax **summary**; only the 2nd Reshop RS gives the tax **breakdown**. Do not expect per-tax detail from the shopping call.
- The final amounts are confirmed by the 2nd Travel_OrderReshopRS, not the 1st — price the payment from the 2nd response.
- Auto refund of a negative `DifferentialAmountDue` (residual value) is not supported by all carriers — check the Features per Carrier spreadsheet.
- Payment for the exchange goes in Travel_OrderChange's `PaymentInfo` (additional collection only); there is no separate pay call in this flow.
- `BookingRef/BookingID` may be sent empty (`<BookingID/>`) on the pricing Reshop.
