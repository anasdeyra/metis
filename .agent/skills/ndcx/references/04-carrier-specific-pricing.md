# Carrier-Specific Pricing Variants (Per-Bound, Per-Bound-Per-PTC, Corporate Code Repricing)

> Source: WBS Implementation Guide NDC[X] v1.5, sections "Round-Trip for 2 Adults, 1 Child, 1 Infant – Per Bound (Vueling Only)", "Round-Trip for 2 Adults, 1 Child, 1 Infant – Per Bound per PTC (Qantas Only)", "One-Way trip – 1ADT + 1CHD + INF Repricing with Corporate Code Example"

Baseline flow, full request/response skeletons, Party block, PaxList shape, payment block: see `03-prime-booking-flow.md`. This file records ONLY the deltas.

## OfferItemID cardinality by provider (normalization difference)

The offerItemID granularity differs between NDC providers. Source statement, verbatim in substance:

| Provider group | offerItemID granularity |
|---|---|
| Accelya, AF/KL, IB/BA | 1 offerItemID **per PTC type** |
| Altea NDC carriers (e.g. SQ) | **1 offerItemID for all travellers** |
| Vueling (VY) | offerItemIDs **per bound** |
| Qantas (QF) | offerItemIDs **per bound per PTC** |

Authoritative per-carrier detail lives in the separate **Normalization Differences per Provider** document.

Extraction paths are identical in all three scenarios:

```
Shopping OfferID     //Fare_MasterPricerTravelBoardSearchReply/offersGroup/offers/offerDetails/uniqueOfferReference
Shopping OwnerCode   //Fare_MasterPricerTravelBoardSearchReply/recommendation/itemNumber/codeShareDetails/company
Shopping ResponseID  //Fare_MasterPricerTravelBoardSearchReply/offersGroup/response/applicationDetails/internalId
Shopping OfferItemID //Fare_MasterPricerTravelBoardSearchReply/offersGroup/offers/offerItems/offerItemDetails/offerItemId
```
Filtering on the selected travel recommendation must be applied before extraction.

---

# 1. Round trip, 2 ADT + 1 CHD + 1 INF — Per Bound (Vueling only, VY)

**Differs from standard flow by:**
- MPTB returns **multiple offers / multiple offerItemIDs because VY sends them per bound**. Worked count for this pax mix: **6 offerItemIDs = 2 bounds x 3 PTCs** — 3 for the outbound (ADT, CHD, INF), 3 for the return (ADT, CHD, INF). ALL 6 must be echoed in `Travel_OfferPrice`.
- Two ADT travellers share **one** offerItem per bound (offerItem is per PTC, not per traveller): the ADT `paxReference` carries `<traveller><ref>1</ref>` AND `<traveller><ref>2</ref>`.
- Child PTC code is **`CHD`** (contrast Qantas: `CNN`).
- INF is referenced through the ADT traveller: `<ptc>INF</ptc>` + `<traveller><ref>1</ref><infantIndicator>1</infantIndicator></traveller>`.
- **No Offer Time Limit** is returned on the MPTB response. VY grants up to **10 minutes** from shopping through OrderPay to collect payment and pay.
- **No deferred payment** — instant payment only. **Credit card only**: FOP cash is rejected by the Travel Platform at issuance time.
- **Card holder name is required** in `Travel_OrderPay` for VY.
- **Taxes returned at shopping are wrong** — discard tax info from MPTB output (`Fare_MasterPricerTravelBoardSearchReply/recommendation/recPriceInfo`). Correct taxes come from `Travel_OfferPrice`. The *total* amount is correct and stable from shopping → pricing → issuance.
- OrderPay response returns an **OrderItem and TicketDocInfo per traveller PER BOUND** (not one per traveller).
- Ticket numbers are **fake** (VY is ticketless); one ticket number, one FA line and one A.I.R. feed **per passenger per bound**.

## Fare_MasterPricerTravelBoardSearch RS — offer/offerItem structure

(request is an .emf image in source; only the response is textual)

Two offer-item ID stems appear: `...-o-1_1A_...-o-1-N` (outbound) and `...-o-4_1A_...-o-4-N` (return); suffix `-1`=ADT, `-2`=CHD, `-3`=INF.

```xml
<offersGroup>
  <response>
    <applicationDetails>
      <internalId>2382847787_id-7d5661de-56e1-572c-bc7e-926bfb8bf7a4-o-2</internalId>
    </applicationDetails>
  </response>
  <offers>
    <offerDetails>
      <reference>1</reference>
      <uniqueOfferReference>ER5t1gwEb7QGuYjLc~itx9SD_1A_c289adb6-079b-4b61-a9ce-63aeaa42df07_1A_1</uniqueOfferReference>
    </offerDetails>

    <!-- OUTBOUND: 3 offerItems -->
    <offerItems>
      <offerItemDetails>
        <offerItemId>1271736676_id-6d4550de-45e0-461c-bc6e-815bfb7bf6a3-o-1_1A_1271736676_id-6d4550de-45e0-461c-bc6e-815bfb7bf6a3-o-1-1</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>ADT</ptc>
        <traveller><ref>1</ref></traveller>
        <traveller><ref>2</ref></traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>1271736676_id-...-o-1_1A_1271736676_id-...-o-1-2</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>CHD</ptc>
        <traveller><ref>3</ref></traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>1271736676_id-...-o-1_1A_1271736676_id-...-o-1-3</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>INF</ptc>
        <traveller><ref>1</ref><infantIndicator>1</infantIndicator></traveller>
      </paxReference>
    </offerItems>

    <!-- RETURN: 3 offerItems, stem -o-4 -->
    <offerItems>
      <offerItemDetails>
        <offerItemId>1271736676_id-...-o-4_1A_1271736676_id-...-o-4-1</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>ADT</ptc>
        <traveller><ref>1</ref></traveller>
        <traveller><ref>2</ref></traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>1271736676_id-...-o-4_1A_1271736676_id-...-o-4-2</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>CHD</ptc>
        <traveller><ref>3</ref></traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>1271736676_id-...-o-4_1A_1271736676_id-...-o-4-3</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>INF</ptc>
        <traveller><ref>1</ref><infantIndicator>1</infantIndicator></traveller>
      </paxReference>
    </offerItems>
  </offers>
```
(Full offerItemIds are shown expanded for outbound item 1; the elided stems above are the identical GUID `6d4550de-45e0-461c-bc6e-815bfb7bf6a3`.)

## Travel_OfferPrice (VY)

- Party block under `//AMA_TravelOfferPriceRQ` is unused but **mandatory**.
- Passenger type required: `//AMA_TravelOfferPriceRQ/Request/DataLists/PaxList`.
- All shopping IDs (OfferID, OwnerCode, ResponseID, and **all 6 OfferItemIDs**) go under `//AMA_TravelOfferPriceRQ/Request/PricedOffer/SelectedOffer`.
- Pax refs used in the VY example: `1, 2, 3, 1.1` (`1.1` = infant attached to pax 1).
- Total OfferItem amount is normalized under `OfferItem/FareDetail/Price`. Offer total is not fully normalized — it can be returned at 3 different levels (see source section 6.1.4).

(request/response XML are images in source: RQ is an .emf; RS is a screenshot)

## Travel_OrderCreate (VY)

- Party block mandatory-but-unused, same as OfferPrice.
- **EMAIL and MOBILE label texts are required** (affects future post-booking modifications).
- Full passenger info: `//AMA_TravelOrederCreateRQ/Request/DataLists/PaxList` (note: source spells the path `OrederCreate`).
- Pricing IDs from OfferPrice RS go under `//AMA_TravelOrderCreateRQ/Request/CreateOrder/SelectedOffer`.
- Order keys from OrderView:
```
Order OrderID    //AMA_TravelOrderViewRS/Response/Order/OrderID
Order OwnerCode  //AMA_TravelOrderViewRS/Response/Order/OwnerCode
```
- Currency / decimals:
```
Order Currency        //AMA_TravelOrderViewRS/Response/Order/.../.../@CurCode
                      (path between Order and @CurCode depends on which level, 2 or 3, is used for Total Amount)
Currency decimals     //AMA_TravelOrderViewRS/Response/Metadata/Other/OtherMetadata/CurrencyMetadatas/CurrencyMetadata[@MetadataKey="${Currency}"]/Decimals
```
- Total amount is an **integer** (e.g. `44126`) — combine with decimals (`2`) → `441.26`. The **decimal** value is what Travel_OrderPay must send.
- OrderView exposes usually 3 record locators under `//AMA_TravelOrderViewRS/Response/Order/BookingRef/BookingID`: airline recloc, airline IT-provider recloc, Amadeus recloc. Amadeus one:
```xml
<BookingRef>
  <BookingID>1A_PNR</BookingID>
  <BookingEntity>
    <Org OrgID="1A"><Name>Amadeus</Name></Org>
  </BookingEntity>
</BookingRef>
```
An Amadeus PNR is created alongside the order (local copy, not the airline record; usable for remarks, car/hotel segments, Selling Platform Connect, SoapXML servicing).

## Travel_OrderPay (VY)

Sends OrderID, OwnerCode, Amount, CurCode + PaymentInfo (credit card). Card holder name required for VY.
Response: **one OrderItem and one TicketDocInfo per traveller, per bound.**

`PaymentInfo` appears under `Order`, between `OrderItem` and `TotalPrice`:

```xml
<PaymentInfo>
  <PaymentInfoID>173752097</PaymentInfoID>
  <Amount CurCode="EUR">36788</Amount>
  <TypeCode>CC</TypeCode>
  <PaymentStatusCode>SUCCESSFUL</PaymentStatusCode>
  <PaymentMethod>
    <PaymentCard>
      <MaskedCardID>XXXXXXXXXXXX0008</MaskedCardID>
      <CreditCardVendorCode>VI</CreditCardVendorCode>
    </PaymentCard>
  </PaymentMethod>
</PaymentInfo>
```

## VY operational rules (non-XML, but binding)

- **Issuance error — do not retry:**
```xml
<Code>38857</Code>
<DescText>Unable to change the order - Failed on provider side</DescText>
<OwnerName>1A</OwnerName>
```
  On this error the airline-order ↔ Travel Order PNR sync may be broken. Contact the airline first. If VY says not issued → retry issuance. If VY says issued → fake ticket numbers can no longer be generated and the PNR will appear as not issued.
- FA element format created per passenger per new ticket:
  `FA PAX 172-1234567890/ET6X/EUR420.00/26AUG21/PAR1A0900/50607080/S2-3/P1`
  (diagram in source: text box illustrating the per-passenger-per-bound A.I.R. feed)
- **Refund (basic fares):** not refundable; **void not possible**; refundable taxes claimed via VY call centre. `Travel_OrderReshop` cancel returns **all amounts due = 0**. Cancelling via the Travel Platform still removes the order and converts **FA → FHA** (lets TAs detect an invalid PNR).
- **Grace period:** cancellation within **2 hours** of issuance is fully refundable; refund obtained by calling the VY call centre (call may be placed later — what matters is that the cancellation happened within the 2 hours).
- **No A.I.R. on cancellation:** a refund at amount 0 is rejected/unprocessable by Mid-Back-Office software, so no AIR is sent; MBO must be updated manually.
- **No FD element for Spanish Resident Discount on INF.** FD normally carries discount codes, certificate numbers, location codes, e.g. `FD PAX RCDN/30000055M/350136/P1`. Infants are SRD-eligible but VY does not supply the data, so no FD line for INF even though the amount is discounted.
- **Fares:** Optima fare unusable today because MPTB always shows the cheapest fare (needs Upsell support). INF fare can be **higher than ADT/CHD** on some routes — infants are handled as SSRs (single SSR price per route), so they miss ADT promo fares.

---

# 2. Round trip, 2 ADT + 1 CHD + 1 INF — Per Bound per PTC (Qantas only, QF)

**Differs from standard flow by:**
- MPTB returns offers **per bound per PTC**. Worked count for this pax mix: **6 offerItemIDs = 2 bounds x 3 PTCs** — outbound (ADT, CNN, INF) + return (ADT, CNN, INF). All 6 are sent in `Travel_OfferPrice`.
- Child PTC is **`CNN`**, not `CHD`.
- `Travel_OfferPrice` **RS collapses the per-bound OfferItems into one OfferItem**.
- `Travel_OrderCreate` creates **one OrderItem per PTC**.
- `Travel_OrderPay` RS returns one OrderItem and TicketDocInfo **per traveller** (not per traveller per bound, unlike VY).
- Pax references are written **`P1, P2, P3, P1.1`** in the QF example (VY example uses bare `1, 2, 3, 1.1`).
- Carrier **may return several currencies in Metadata** — pay using the currency returned **under the OrderItem**.
- `uniqueOfferReference` embeds both bound offer IDs (`...-1` and `...-30`).

## Fare_MasterPricerTravelBoardSearch RS — offer/offerItem structure

```xml
<offersGroup>
  <response>
    <applicationDetails>
      <internalId>X837B9675-59D9-411E-8FB7</internalId>
    </applicationDetails>
  </response>
  <offers>
    <offerDetails>
      <reference>1</reference>
      <uniqueOfferReference>ER9QEfpNLcSomluBJrVh6r7B_1A_94257017-f43d-4081-bbf7-8df504109c71_1A_X837B9675-59D9-411E-8FB7-1_1A_X837B9675-59D9-411E-8FB7-30</uniqueOfferReference>
    </offerDetails>

    <!-- OUTBOUND (stem ...-8FB7-1) -->
    <offerItems>
      <offerItemDetails>
        <offerItemId>X837B9675-59D9-411E-8FB7-1_1A_X837B9675-59D9-411E-8FB7-1-1</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>ADT</ptc>
        <traveller><ref>1</ref></traveller>
        <traveller><ref>2</ref></traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>X837B9675-59D9-411E-8FB7-1_1A_X837B9675-59D9-411E-8FB7-1-2</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>CNN</ptc>
        <traveller><ref>3</ref></traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>X837B9675-59D9-411E-8FB7-1_1A_X837B9675-59D9-411E-8FB7-1-3</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>INF</ptc>
        <traveller><ref>1</ref><infantIndicator>1</infantIndicator></traveller>
      </paxReference>
    </offerItems>

    <!-- RETURN (stem ...-8FB7-30) -->
    <offerItems>
      <offerItemDetails>
        <offerItemId>X837B9675-59D9-411E-8FB7-30_1A_X837B9675-59D9-411E-8FB7-30-1</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>ADT</ptc>
        <traveller><ref>1</ref></traveller>
        <traveller><ref>2</ref></traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>X837B9675-59D9-411E-8FB7-30_1A_X837B9675-59D9-411E-8FB7-30-2</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>CNN</ptc>
        <traveller><ref>3</ref></traveller>
      </paxReference>
    </offerItems>
    <offerItems>
      <offerItemDetails>
        <offerItemId>X837B9675-59D9-411E-8FB7-30_1A_X837B9675-59D9-411E-8FB7-30-3</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>INF</ptc>
        <traveller><ref>1</ref><infantIndicator>1</infantIndicator></traveller>
      </paxReference>
    </offerItems>
  </offers>
```

## Travel_OfferPrice / OrderCreate / OrderPay (QF) — deltas only

Same mandatory Party block, same `PaxList` / `PricedOffer/SelectedOffer` / `CreateOrder/SelectedOffer` paths, same OrderID/OwnerCode/currency/decimals extraction and integer-amount rule (`44126` + decimals `2` → `441.26`) as the VY scenario above, plus:
- OfferPrice RS **merges the per-bound OfferItems into a single OfferItem**.
- OrderCreate produces **one OrderItem per PTC**.
- (diagram in source: two screenshots showing multiple `CurrencyMetadata` entries vs the OrderItem currency — use the OrderItem currency for payment)
- EMAIL and MOBILE label texts required (stated without the "should it be supported in the future" caveat).
- OrderPay RS returns OrderItem + TicketDocInfo **per traveller**.

`PaymentInfo` in the QF example (note: no `PaymentInfoID`, status `COMMITTED`, `ExpirationDate` present):

```xml
<PaymentInfo>
  <Amount CurCode="EUR">529865</Amount>
  <TypeCode>CC</TypeCode>
  <PaymentStatusCode>COMMITTED</PaymentStatusCode>
  <PaymentMethod>
    <PaymentCard>
      <MaskedCardID>XXXXXXXXXXXX0008</MaskedCardID>
      <CreditCardVendorCode>VI</CreditCardVendorCode>
      <ExpirationDate>0139</ExpirationDate>
    </PaymentCard>
  </PaymentMethod>
</PaymentInfo>
```

---

# 3. One-way, 1 ADT + 1 CHD + INF — Repricing with a Corporate Code (SQ, Altea)

**Differs from standard flow by:**
- Carrier is **SQ**, an **Altea NDC** carrier → **exactly 1 offerItemID for ALL travellers and all PTCs**. Worked count for this pax mix: **1 offerItemID**, carrying three `paxReference` blocks (ADT ref 1, CHD ref 2, INF ref 1 + infantIndicator).
- Flow is longer: **MasterPricer → OfferPrice → OrderCreate → OrderRetrieve → OrderReshop (repricing) → OrderChange**.
- MPTB RS **does** return an Offer Time Limit (`timeLimits/dateAndTimeDetails`, qualifier `OTL`).
- The corporate code is applied at **OrderReshop**, not at shopping/pricing, via `ProgramCriteria` in the update-order portion of the request.
- `Travel_OfferPrice` RQ carries a `<Header><Session>` block (SessionId / SequenceNumber / SecurityToken) in this example.
- `PaxList` here uses `PaxID` `1`, `2`, `1.1`, and the ADT `Pax` also carries `<PaxRefID>1.1</PaxRefID>` linking the infant.

## Fare_MasterPricerTravelBoardSearch RS

```xml
<offersGroup>
  <response>
    <applicationDetails>
      <internalId>1H1SQZ_PC9WHPHHOVMK7J7CX2Z9CMPXW3QY</internalId>
    </applicationDetails>
  </response>
  <offers>
    <offerDetails>
      <reference>1</reference>
      <uniqueOfferReference>TOxR7jP7F4RZe1b1s4Ez1A9D.1_1A_bd39bc4f-a0a9-4573-a10d-87fb7fc4f604_1A_1H1SQZ_NSIS04E46DFQ02OST2JINC5ZSOZT</uniqueOfferReference>
    </offerDetails>
    <timeLimits>
      <dateAndTimeDetails>
        <qualifier>OTL</qualifier>
        <date>120625</date>
        <time>1536</time>
      </dateAndTimeDetails>
    </timeLimits>
    <offerItems>
      <offerItemDetails>
        <offerItemId>1H1SQZ_NSIS04E46DFQ02OST2JINC5ZSOZT-1</offerItemId>
      </offerItemDetails>
      <paxReference>
        <ptc>ADT</ptc>
        <traveller><ref>1</ref></traveller>
      </paxReference>
      <paxReference>
        <ptc>CHD</ptc>
        <traveller><ref>2</ref></traveller>
      </paxReference>
      <paxReference>
        <ptc>INF</ptc>
        <traveller><ref>1</ref><infantIndicator>1</infantIndicator></traveller>
      </paxReference>
    </offerItems>
  </offers>
</offersGroup>
```

Three elements are needed to price this offer: **`internalId`, `uniqueOfferReference`, `paxReference`**.

## Travel_OfferPrice RQ (full, textual in source)

```xml
<Header>
  <Session>
    <SessionId>04K1BK3NOK</SessionId>
    <SequenceNumber>1</SequenceNumber>
    <SecurityToken>3JXEB7AXMX1WX1HNJ3HY0GZNS0</SecurityToken>
  </Session>
</Header>
<Body>
<AMA_TravelOfferPriceRQ>
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>NU</AgencyID>
        <PseudoCityID>NU</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <DataLists>
      <PaxList>
        <Pax><PTC>ADT</PTC><PaxID>1</PaxID><PaxRefID>1.1</PaxRefID></Pax>
        <Pax><PTC>CHD</PTC><PaxID>2</PaxID></Pax>
        <Pax><PTC>INF</PTC><PaxID>1.1</PaxID></Pax>
      </PaxList>
    </DataLists>
    <PricedOffer>
      <SelectedOffer>
        <OfferRefID>TOxR7jP7F4RZe1b1s4Ez1A9D.1_1A_bd39bc4f-a0a9-4573-a10d-87fb7fc4f604_1A_1H1SQZ_NSIS04E46DFQ02OST2JINC5ZSOZT</OfferRefID>
        <OwnerCode>SQ</OwnerCode>
        <ShoppingResponseRefID>1H1SQZ_PC9WHPHHOVMK7J7CX2Z9CMPXW3QY</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemRefID>1H1SQZ_NSIS04E46DFQ02OST2JINC5ZSOZT-1</OfferItemRefID>
          <PaxRefID>1</PaxRefID>
          <PaxRefID>2</PaxRefID>
          <PaxRefID>1.1</PaxRefID>
        </SelectedOfferItem>
      </SelectedOffer>
    </PricedOffer>
    <ShoppingCriteria />
  </Request>
</AMA_TravelOfferPriceRQ>
```

Key point: **one `SelectedOfferItem` with one `OfferItemRefID` and three `PaxRefID` children** — the Altea single-offerItem pattern. Contrast VY/QF, which need six `SelectedOfferItem` blocks.

## Travel_OrderCreate (SQ)

Same as standard: Party mandatory-but-unused; EMAIL and MOBILE label texts required; full pax info under `//AMA_TravelOrederCreateRQ/Request/DataLists/PaxList`; pricing IDs from OfferPrice RS under `//AMA_TravelOrderCreateRQ/Request/CreateOrder/SelectedOffer`. Pax refs `1, 2, 3, 1.1`. OrderCreate reply returns `OrderID` and `OwnerCode`.
(RQ and OrderView RS are images in source.)

## Travel_OrderRetrieve (SQ)

```xml
<AMA_TravelOrderRetrieveRQ>
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>NU</AgencyID>
        <PseudoCityID>NU</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <OrderFilterCriteria>
      <Order>
        <OrderID>SQ618FCSNF700</OrderID>
        <OwnerCode>SQ</OwnerCode>
      </Order>
    </OrderFilterCriteria>
  </Request>
</AMA_TravelOrderRetrieveRQ>
```

## Travel_OrderReshop — manual repricing with corporate code

- Add the **OrderID**, which in the request appears as **`OrderItemRefID`**.
- Add **`AirlineDesignCode`** = the owner code, here **`SQ`**.
- The **update-order portion contains `ProgramCriteria`, where the corporate code is added.**
- The reply performs the repricing and returns the new amount; the **`AccountCode`** (the applied corporate code) is referenced under **`AddOfferItem`**.

(RQ and RS bodies are screenshots in source: diagram shows the OrderReshop RQ with ProgramCriteria/corporate code, and the RS with the new amount plus AccountCode inside AddOfferItem.)

## Travel_OrderChange

- Built from the **Travel_OrderReshop reply**.
- **Each `SelectedOfferItem` is taken from an `AddOfferItem`** of the reshop reply.
- **`PaxList` must also be included** in the OrderChange request.
- New total after change: `AMA_TravelOrderViewsRS/Response/Order/TotalPrice` (source spells it `OrderViewsRS`).

---

## Gotchas

- **Do not assume "per bound" means one offerItem per bound.** The Vueling prose says "offerItemIDs per bound", but the worked example returns **6** — 3 PTC items under each of the two bound stems (`-o-1-*`, `-o-4-*`). Drive your code off the actual `offerItems` list, not off the prose.
- **Child PTC differs by carrier: VY = `CHD`, QF = `CNN`.** A hardcoded `CHD` breaks Qantas.
- **Two ADTs share one offerItem.** The offerItem is per PTC (with multiple `<traveller><ref>`), never per individual traveller — do not send one SelectedOfferItem per adult.
- **Send every offerItemID.** 6 for VY and QF round trips with this pax mix; exactly 1 for Altea/SQ. Sending only the first will misprice or fail.
- **VY taxes at shopping are wrong by design** — discard them; only the total is trustworthy pre-pricing.
- **Amounts are integers.** Always pair with `CurrencyMetadata[@MetadataKey="${Currency}"]/Decimals` before sending to OrderPay (`44126` + `2` → `441.26`).
- **QF may return multiple currencies in Metadata** — the payable currency is the one under the OrderItem, not the first in Metadata.
- **VY error 38857 is terminal for retries** — never re-issue; call the airline first, or the PNR can be left permanently un-issuable.
- **VY 10-minute end-to-end window** replaces the missing OfferTimeLimit; shopping→OrderPay must complete inside it.
- **VY refund amounts of 0 are expected**, not a bug; void is impossible and no AIR is emitted on cancellation.
- **Corporate code is a post-booking OrderReshop concept here** (`ProgramCriteria` in, `AccountCode` under `AddOfferItem` out) — not a shopping-time input in this example.
- Source path typos to reproduce carefully: `AMA_TravelOrederCreateRQ` (OfferPrice/OrderCreate PaxList notes) and `AMA_TravelOrderViewsRS` (OrderChange total price) appear as written in the guide; the canonical spellings are `AMA_TravelOrderCreateRQ` and `AMA_TravelOrderViewRS`.
