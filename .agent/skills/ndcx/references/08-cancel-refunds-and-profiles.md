# NDC[X] — Retailing Attributes, Amadeus Profiles, Cancel/Void/Refund

> Source: WBS Implementation Guide NDC[X] v1.5, sections "Retrieve retailing information to structure airline offers (or fare families)", "Working with Amadeus Profiles", "Cancel or Refunds"

---

## 1. Retrieve retailing information to structure airline offers (fare families)

Purpose: retrieve retailing attributes (bags, fare conditions, included services) so the travel agency can build its own structured fare-family description. Today the fare family description is free-flow text mapped in `Travel_OfferPrice` RS under `PriceClassList`.

(diagram in source: image63 — overview screenshot of the retailing attributes available on an offer.)

### 1.1 Baggage allowance

Free baggage allowance (cabin and checked bags) attached to the offer:

```
AMA_TravelOfferPriceRS/Response/PricedOffer/OfferItem/BaggageAllowance
```

Description of the allowance:

```
AMA_TravelOfferPriceRS/Response/DataLists/BaggageAllowanceList/BaggageAllowance
```

(diagrams in source: image64 = `BaggageAllowance` reference on the OfferItem; image65 = `BaggageAllowanceList/BaggageAllowance` description content.)

### 1.2 Fare conditions

Available in `Travel_OfferPrice` RS under:

```
AMA_TravelOfferPriceRS/Response/OtherOffers/Offer/OfferItem/FareDetail/FareComponent/FareRules/Penalty/Details/Detail
```

Description available under:

```
AMA_TravelOfferPriceRS/Response/DataLists/MetaData/Other/OtherMetaData/RuleMetaDatas
```

(diagrams in source: image66 = penalty `Detail` entries; image67 = `RuleMetaDatas` description text.)

### 1.3 Services included

Some airlines file services included in an offer.

Service descriptions:

```
AMA_TravelOfferPriceRS/Response/DataLists/ServiceDefinitionList/ServiceDefinition
```

Services attached to the offer:

```
AMA_TravelOfferPriceRS/Response/OtherOffers/Offer/OfferItem/Service
```

(diagrams in source: image68 = `ServiceDefinition` content; image69 = `OfferItem/Service` references.)

### Summary table — retailing attribute XPaths

| Attribute | XPath (Travel_OfferPrice RS) |
|---|---|
| Baggage allowance on offer | `AMA_TravelOfferPriceRS/Response/PricedOffer/OfferItem/BaggageAllowance` |
| Baggage allowance description | `AMA_TravelOfferPriceRS/Response/DataLists/BaggageAllowanceList/BaggageAllowance` |
| Fare conditions / penalties | `AMA_TravelOfferPriceRS/Response/OtherOffers/Offer/OfferItem/FareDetail/FareComponent/FareRules/Penalty/Details/Detail` |
| Fare condition descriptions | `AMA_TravelOfferPriceRS/Response/DataLists/MetaData/Other/OtherMetaData/RuleMetaDatas` |
| Included service definitions | `AMA_TravelOfferPriceRS/Response/DataLists/ServiceDefinitionList/ServiceDefinition` |
| Included services on offer | `AMA_TravelOfferPriceRS/Response/OtherOffers/Offer/OfferItem/Service` |
| Free-flow fare family text (legacy) | `Travel_OfferPrice` RS → `PriceClassList` |

---

## 2. Working with Amadeus Profiles

Travel agencies using Amadeus Profiles can incorporate the functionality for NDC orders. Profiles can transfer **remarks, accounting information, payment details**.

### 2.1 Rules and constraints

- Car, Hotel and MIS segments **cannot** be committed at the same time as the Order creation. Other supported segments must be added in a **different envelope** than the NDC order (either before or after).
- Any change on the PNR context before a `Travel_OrderCancel` / `Travel_OrderPay` / `Travel_OrderChange` action **must be committed first**.
- Profile transfer can be sent either:
  1. via the profile ID inside the `Travel_OrderCreate` request, or
  2. after `Travel_OrderCreate` via `Command_Cryptic`.
- Not transferrable — must be included explicitly in the `Travel_OrderCreate` request:
  - passenger name
  - PTC type
  - date of birth
  - gender
  - SSRs: **DOCA, DOCS, DOCO**
  - Frequent Flyer Number (Loyalty #)
- If those elements already exist within the profile, **SSR\*** elements are cleaned from the initial context by the system and re-created based on what was actually sent in the order creation.
- All elements not transferred to the provider before the Order creation are saved in the NDC-X PNR after the order is created — e.g. **RM, FOP, RI, ES**.

(diagram in source: image70 — "Profile transfer in the Travel_OrderCreate" flow.)

### 2.2 Option A — Profile ID at order creation

`ProfileID_Text` is placed on the `Pax` in `DataLists/PaxList`.

```xml
<AMA_TravelOrderCreateRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderCreateRQ_v1">
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>unused</AgencyID>
        <PseudoCityID>unused</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <CreateOrder>
      <SelectedOffer>
        <OfferID>ERU~yR4Ry0TrqLQocjb0j6iB_1A_0a5397a0-1294-4560-a356-f23800534657_1A_PoPF373238A-605B-42EB-B670-1</OfferID>
        <OwnerCode>AA</OwnerCode>
        <ShoppingResponseRefID>PF373238A-605B-42EB-B670</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemID>PoIPF373238A-605B-42EB-B670-1-1</OfferItemID>
          <PaxRefID>P1</PaxRefID>
        </SelectedOfferItem>
      </SelectedOffer>
    </CreateOrder>
    <DataLists>
      <PaxList>
        <Pax>
          <PaxID>P1</PaxID>
          <PTC>ADT</PTC>
          <ProfileID_Text>VT3XP</ProfileID_Text>
          <Birthdate>1980-10-06</Birthdate>
          <ContactInfo>
            <EmailAddress>
              <EmailAddressText>myemail.amadeus.com</EmailAddressText>
            </EmailAddress>
          </ContactInfo>
          <IdentityDoc>
            <IdentityDocID>7272720</IdentityDocID>
            <IdentityDocTypeCode>PT</IdentityDocTypeCode>
            <IssuingCountryCode>US</IssuingCountryCode>
            <ExpiryDate>2028-01-01</ExpiryDate>
          </IdentityDoc>
          <Individual>
            <GenderCode>M</GenderCode>
            <GivenName>MIKE</GivenName>
            <Surname>SMITH</Surname>
          </Individual>
        </Pax>
      </PaxList>
    </DataLists>
  </Request>
</AMA_TravelOrderCreateRQ>
```

Result on the Amadeus PNR: Remarks and Form of Payment from the profile are added to the Amadeus PNR. (diagrams in source: image71 = example profile; image72 = resulting Amadeus PNR with RM + FP.)

### 2.3 Option B — Profile transfer after Travel_OrderCreate (stateful session)

Example goal: transfer the form of payment to the PNR so it can then be used to pay for the NDC order.

**Call sequence — `TransactionStatusCode` per step (certification rule SEM-03 territory):**

1. **`PNR_Retrieve`** — `TransactionStatusCode="Start"`. Starts the stateful session and retrieves the Amadeus PNR by record locator. Nothing to commit yet; the session context is now open and must be carried through all following calls.

   ```xml
   <PNR_Retrieve>
     <retrievalFacts>
       <retrieve>
         <type>2</type>
       </retrieve>
       <reservationOrProfileIdentifier>
         <reservation>
           <controlNumber>XA1234</controlNumber>
         </reservation>
       </reservationOrProfileIdentifier>
     </retrievalFacts>
   </PNR_Retrieve>
   ```

   Reply carries `PNR_Reply/pnrHeader/reservationInfo/reservation` with `companyId` (`1A`), `controlNumber` (`XA1234`), `date` (`220324`), `time` (`1459`).

2. **`Command_Cryptic`** — `TransactionStatusCode="InSeries"`. Proceed with the **profile display** entry `PDRT/V12345`. Note: this entry is **not available by default** — it must be requested; contact your Amadeus Account Manager. Nothing is committed by this call; it only displays the profile's transferable data so you can pick the line to transfer.

   ```xml
   <Command_Cryptic>
     <messageAction>
       <messageFunctionDetails>
         <messageFunction>M</messageFunction>
       </messageFunctionDetails>
     </messageAction>
     <longTextString>
       <textStringDetails>PDRT/V12345</textStringDetails>
     </longTextString>
   </Command_Cryptic>
   ```

   Reply (`Command_CrypticReply`, namespace `http://xml.amadeus.com/HSFRES_07_3_1A`) returns the PNR TRANSFERABLE DATA list, e.g.:

   ```
   /$*T* SMITH/MIKE MR V12345
   ------- PNR TRANSFERABLE DATA OFFICE_ID
   1 A NM 1SMITH/MIKE MR
   2 A AP 53226633
   3 S RM TRAVELLER PROFILE
   4 S FP CCVIXXXXXXXXXXXX0002/0330
   5 S FP CASH
   6 S FP CCVIXXXXXXXXXXXX9062/0330
   7 S RIR PAX PREFER AISLE SEAT
   END OF DISPLAY
   ```

3. **`Command_Cryptic`** — `TransactionStatusCode="InSeries"`. Transfer the selected line from the previous display with `PTO<line#>`; this example selects FP line **#6** → `PTO6`. The element is now present in the session PNR context but **still uncommitted**.

   ```xml
   <Command_Cryptic>
     <messageAction>
       <messageFunctionDetails>
         <messageFunction>M</messageFunction>
       </messageFunctionDetails>
     </messageAction>
     <longTextString>
       <textStringDetails>PTO6</textStringDetails>
     </longTextString>
   </Command_Cryptic>
   ```

   Reply returns the Amadeus PNR details along with the payment details, e.g.:

   ```
   /$--- TST RLR RLP NDC ---
   RP/OFFICE_ID/OFFICE_ID   WS/SU  22MAR24/1459Z  XA1234
   1.SMITH/MIKE MR(ADT)
   2 AY1331 V 02APR 2 HELLHR HK1 0715 0800 0910  NDC
   3 AY1338 Q 03APR 3 LHRHEL HK1 1725 3 1810 2300  NDC
   4 APA AGENCY EMAIL CONTACT
   5 APA AGENCY PHONE CONTACT
   6 SSR CTCE AY HK1 MSMITH//TAYRONA.LATAM.CO
   7 SSR DOCS AY HK1 P/CO/23434320//15JUN81/M/01JAN28/SMITH/MIKE
   8 OPC-25MAR:1459/1C256/AY PAYMENT TIME LIMIT/S2-3
   9 FP CCVIXXXXXXXXXXXX9062/0330
   ```

4. **`PNR_AddMultiElements`** — `TransactionStatusCode="InSeries"`. **Commit** the changes to the PNR (`pnrActions/optionCode` = `11`, with an `RF` element). This is the commit that must succeed before any `Travel_OrderPay` / `Travel_OrderCancel` / `Travel_OrderChange` on the order.

   ```xml
   <PNR_AddMultiElements>
     <pnrActions>
       <optionCode>11</optionCode>
     </pnrActions>
     <dataElementsMaster>
       <marker1 />
       <dataElementsIndiv>
         <elementManagementData>
           <segmentName>RF</segmentName>
         </elementManagementData>
         <freetextData>
           <freetextDetail>
             <subjectQualifier>3</subjectQualifier>
             <type>P23</type>
           </freetextDetail>
           <longFreetext>Example</longFreetext>
         </freetextData>
       </dataElementsIndiv>
     </dataElementsMaster>
   </PNR_AddMultiElements>
   ```

   Reply is a `PNR_Reply` with an updated `pnrHeader` (same `controlNumber` XA1234, `time` now `1503`).

5. **`Security_SignOut`** — `TransactionStatusCode="End"`. Closes the stateful session. The PNR change must already be committed (step 4) at this point.

   ```xml
   <Security_SignOut></Security_SignOut>
   ```

6. **`Travel_OrderRetrieve`** (stateless, after sign-out) — retrieve the NDC order.

   ```xml
   <AMA_TravelOrderRetrieveRQ>
     <Party>
       <Sender>
         <TravelAgency>
           <AgencyID>unused</AgencyID>
           <PseudoCityID>unused</PseudoCityID>
         </TravelAgency>
       </Sender>
     </Party>
     <Request>
       <OrderFilterCriteria>
         <Order>
           <OrderID>AY_ORQ8FS</OrderID>
           <OwnerCode>AY</OwnerCode>
         </Order>
       </OrderFilterCriteria>
     </Request>
   </AMA_TravelOrderRetrieveRQ>
   ```

7. **`Travel_OrderPay`** with `TypeCode` = **`FROM_PNR`** — submits payment using the FOP transferred into the PNR. The `Remark/RemarkText` carries the PNR FOP element line number (here `21`). See guide section "10.2.8 Implicit FOP (Use the FOP from PNR)" for finding FOP details from a PNR.

   ```xml
   <AMA_TravelOrderPayRQ>
     <Party>
       <Sender>
         <TravelAgency>
           <AgencyID>unused</AgencyID>
           <PseudoCityID>unused</PseudoCityID>
         </TravelAgency>
       </Sender>
     </Party>
     <Request>
       <PaymentInfo>
         <Amount CurCode="SEK">3915</Amount>
         <TypeCode>FROM_PNR</TypeCode>
         <PaymentMethod>
           <OtherPaymentMethod>
             <Remark>
               <RemarkText>21</RemarkText>
             </Remark>
           </OtherPaymentMethod>
         </PaymentMethod>
       </PaymentInfo>
       <Order>
         <OrderID>AY_ORQ8FS</OrderID>
         <OwnerCode>AY</OwnerCode>
       </Order>
     </Request>
   </AMA_TravelOrderPayRQ>
   ```

   A successful payment returns the issued documents in `AMA_TravelOrderViewRS/Response/TicketDocInfos/TicketDocInfo`, e.g. `AgentID` Type `B` / ID `1234WS/AS`, `TicketDocNbr` `1052481508370`, `Type` `T`, `NumberofBooklets` `1`, `DateOfIssue` `2024-03-22`, per-coupon `CouponNumber` 1/2 with `CouponReference` `SEG1`/`SEG2`, `FareBasisCode/Code` `VNY0S9BZ` / `QNY0S9BZ`, `Status` `O`, `AddlBaggageInfo/AllowableBag Number="0"`, `ReportingType` `BSP`, `PassengerReference` `PAX2`.

---

## 3. Cancel or Refunds

### 3.1 Eligibility rules

- **Before payment**: send `Travel_OrderRetrieve` (to ensure the order is found) followed by `Travel_OrderCancel`. `Travel_OrderReshop` is not needed.
- **After payment**: send `Travel_OrderRetrieve`, then `Travel_OrderReshop`, then `Travel_OrderCancel`. **`Travel_OrderReshop` is mandatory before sending `Travel_OrderCancel`.**
- `Travel_OrderReshop` initiates the cancellation and returns the details regarding the cancel fare conditions.
- `Travel_OrderCancel` orchestrates the complete cancellation of the order, including **voiding or refunding of all the accountable documents**.
- **Void vs refund is determined by the airline/provider and returned in the Reshop response**, in `//AMA_TravelOrderReshopRS/Response/ReshopResults/@UseCase` = `VOID` or `REFUND` (confirmed by `ReshopOffer/ns2:Desc/DescText` = `VOID` / `REFUND`).
- **Void window or cooling-off period may vary per carrier** — see the "Features per Airline" section of the guide.
- **Farelogix carriers only**: `ReshopParameters/Notices/PricingParameters/@AutoExchRequestInd`. During a cancellation after payment `AutoExchReqInd` must always be set to **`false`**, as no exchanges are expected in the flow.

### 3.2 Call sequence

1. `Travel_OrderRetrieve` — confirm the order exists.
2. `Travel_OrderReshop` — quote the cancellation; returns `@UseCase` VOID/REFUND and the amount in `DeleteOrderItem/DifferentialAmountDue`. (Skip only when cancelling before payment.)
3. `Travel_OrderCancel` — validates and orchestrates the process triggered with `Travel_OrderReshop`; used for **all** cases (void, cancel or refund).

### 3.3 Travel_OrderReshop request

Note the top-level element is named `OrderItemRefID` but **carries an Order ID**; the `DeleteOrderItem/OrderItemRefID` entries are the true order item IDs — include one `DeleteOrderItem` per traveler.

```xml
<AMA_TravelOrderReshopRQ>
  <Party>
    <!-- ...truncated... -->
  </Party>
  <Request>
    <OrderItemRefID>06X00ORDERID00</OrderItemRefID><!-- !THIS IS AN ORDER ID! -->
    <BookingRef>
      <BookingID/>
      <BookingEntity>
        <Carrier>
          <AirlineDesigCode>6X</AirlineDesigCode>
        </Carrier>
      </BookingEntity>
    </BookingRef>
    <ReshopParameters>
      <Notices>
        <!-- Farelogix carriers only: -->
        <PricingParameters AutoExchRequestInd="false"/>
      </Notices>
    </ReshopParameters>
    <UpdateOrder>
      <ReshopOrder>
        <ServiceOrder>
          <DeleteOrderItem>
            <OrderItemRefID>06X00ORDERID00-1</OrderItemRefID>
          </DeleteOrderItem>
          <DeleteOrderItem>
            <OrderItemRefID>06X00ORDERID00-2</OrderItemRefID>
          </DeleteOrderItem>
          <DeleteOrderItem>
            <OrderItemRefID>06X00ORDERID00-3</OrderItemRefID>
          </DeleteOrderItem>
        </ServiceOrder>
      </ReshopOrder>
    </UpdateOrder>
  </Request>
</AMA_TravelOrderReshopRQ>
```

(diagram in source: image73 — screenshot of the corresponding Travel_OrderReshop response.)

### 3.4 Reshop response — VOID case

```xml
<Desc>
  <DescID>0</DescID>
  <DescText>VOID</DescText>
</Desc>
```

```xml
<DifferentialAmountDue>
  <Amount CurCode="EUR">0</Amount>
</DifferentialAmountDue>
```

### 3.5 Reshop response — REFUND case

If the amount is **negative**, this is a refund that will be returned to the customer using the **original form of payment**.

```xml
<Desc>
  <DescID>0</DescID>
  <DescText>REFUND</DescText>
</Desc>
```

```xml
<DifferentialAmountDue>
  <Amount CurCode="GBP">-38990</Amount>
  <!-- ...truncated... -->
</DifferentialAmountDue>
```

### 3.6 Response fields carrying amounts, penalties and statuses

| Meaning | Exact path |
|---|---|
| Void vs refund use case | `//AMA_TravelOrderReshopRS/Response/ReshopResults/@UseCase` = `"VOID"` or `"REFUND"` |
| Textual use-case confirmation | `//AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/ns2:Desc` → `DescID` = `0`, `DescText` = `VOID` \| `REFUND` |
| Refund / net amount due (negative = refund to original FOP; `0` on void) | `//AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/DeleteOrderItem/DifferentialAmountDue/Amount` with `@CurCode` |
| Farelogix exchange indicator (request side, must be `false` on cancel) | `AMA_TravelOrderReshopRQ/Request/ReshopParameters/Notices/PricingParameters/@AutoExchRequestInd` |
| Cancel confirmation — order | `AMA_TravelOrderCancelRS/Response/OrderRefID` |
| Cancelled document number | `AMA_TravelOrderCancelRS/Response/TicketDocInfo/TicketDocument/TicketDocNbr` |
| Document type / booklets | `.../TicketDocument/Type` (`T`), `.../NumberofBooklets` (`1`) |
| Per-coupon status (`V` = voided) | `.../TicketDocument/CouponInfo/CouponNumber` + `.../CouponInfo/Status` |
| Reporting scheme | `.../TicketDocument/ReportingType` (e.g. `ARC`; `BSP` on issuance example) |
| Fare conditions / penalty details (from OfferPrice) | `AMA_TravelOfferPriceRS/Response/OtherOffers/Offer/OfferItem/FareDetail/FareComponent/FareRules/Penalty/Details/Detail` (descriptions in `DataLists/MetaData/Other/OtherMetaData/RuleMetaDatas`) |

### 3.7 Travel_OrderCancel

```xml
<AMA_TravelOrderCancelRQ>
  <Party>
    <!-- ...truncated... -->
  </Party>
  <Request>
    <Order>
      <OrderID>06X00ORDERID00</OrderID>
      <OwnerCode>6X</OwnerCode>
    </Order>
  </Request>
</AMA_TravelOrderCancelRQ>
```

Success response (example below is for 2 adults + 1 child → three `TicketDocument` blocks, each with 2 coupons in status `V`):

```xml
<AMA_TravelOrderCancelRS xmlns="http://xml.amadeus.com/2010/06/Travel_OrderCancelRS_v1">
  <Response>
    <OrderRefID>6X10051HJ9TMWA2</OrderRefID>
    <TicketDocInfo>
      <TicketDocument>
        <TicketDocNbr>0015743425756</TicketDocNbr>
        <Type>T</Type>
        <NumberofBooklets>1</NumberofBooklets>
        <CouponInfo><CouponNumber>1</CouponNumber><Status>V</Status></CouponInfo>
        <CouponInfo><CouponNumber>2</CouponNumber><Status>V</Status></CouponInfo>
        <ReportingType>ARC</ReportingType>
      </TicketDocument>
      <TicketDocument>
        <TicketDocNbr>0015743425757</TicketDocNbr>
        <Type>T</Type>
        <NumberofBooklets>1</NumberofBooklets>
        <CouponInfo><CouponNumber>1</CouponNumber><Status>V</Status></CouponInfo>
        <CouponInfo><CouponNumber>2</CouponNumber><Status>V</Status></CouponInfo>
        <ReportingType>ARC</ReportingType>
      </TicketDocument>
      <TicketDocument>
        <TicketDocNbr>0015743425758</TicketDocNbr>
        <Type>T</Type>
        <NumberofBooklets>1</NumberofBooklets>
        <CouponInfo><CouponNumber>1</CouponNumber><Status>V</Status></CouponInfo>
        <CouponInfo><CouponNumber>2</CouponNumber><Status>V</Status></CouponInfo>
        <ReportingType>ARC</ReportingType>
      </TicketDocument>
    </TicketDocInfo>
  </Response>
</AMA_TravelOrderCancelRS>
```

---

## Gotchas

- `Travel_OrderReshop` is **mandatory** after payment before `Travel_OrderCancel`; skipping it is only valid for a pre-payment cancel.
- In `AMA_TravelOrderReshopRQ`, `Request/OrderItemRefID` holds an **Order ID**, not an order item ID (the source flags this explicitly: "!THIS IS AN ORDER ID!"). Only `DeleteOrderItem/OrderItemRefID` holds real order item IDs, and you must repeat one per traveler.
- `AutoExchRequestInd` exists only for **Farelogix carriers** and must be `"false"` on cancellations — sending `true` implies an exchange that does not exist in this flow.
- Void vs refund is not a client decision: read `ReshopResults/@UseCase`. Void → `DifferentialAmountDue/Amount` = `0`; refund → negative amount, returned on the original form of payment.
- Void windows / cooling-off periods differ per carrier — check "Features per Airline" before assuming a void is possible.
- Stateful profile flow: the very first message uses `TransactionStatusCode="Start"`, every intermediate message `"InSeries"`, and only the `Security_SignOut` uses `"End"`. Losing this sequencing breaks session continuity.
- PNR changes must be **committed** with `PNR_AddMultiElements` (`optionCode` `11`) before any `Travel_OrderCancel` / `Travel_OrderPay` / `Travel_OrderChange`; an uncommitted context is not visible to the order actions.
- The `PDRT/<profileID>` profile display cryptic entry is **not enabled by default** — it must be requested via the Amadeus Account Manager, so code paths depending on it can fail on unprovisioned offices.
- Car, Hotel and MIS segments must go in a separate envelope from the NDC order creation.
- Profile data that cannot be transferred (name, PTC, DOB, gender, DOCA/DOCS/DOCO, FF number) must be sent in `Travel_OrderCreate`; existing profile SSR\* elements are wiped and rebuilt from the order-create payload.
- `Travel_OrderPay` with `TypeCode` `FROM_PNR` needs the PNR FOP line number in `PaymentMethod/OtherPaymentMethod/Remark/RemarkText` (example `21`) — it is a line reference, not an amount or card token.
