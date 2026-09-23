# NDC[X] Payment and Features Reference

> Source: WBS Implementation Guide NDC[X] v1.5, sections: Features — Commissions, Upsell at pricing, Payment with Cash, 3DS Offline CC payment, 3DS CC payment, Support Fraud Checks for CC payment (BA, IB, AC, 6E, VY only), Manual Approval Code, Implicit FOP (Use the FOP from PNR), OB fees and airline surcharge, Obtain secured flight information at Pricing, Create NDC booking within an existing PNR (w/ hotel or miscellaneous segment), Combined or Joint Invoice for US Market

---

## Commissions

- For carriers that support commissions, the commission is returned **as a percentage amount**.
- Visible at **shopping**, **pricing**, and **stored in the PNR** at booking and post-booking.
- Creates an **automatic FM element** in the Amadeus NDC PNR. **No computation on the FM element is to be considered.**
- The amount is also included in the **back office A.I.R. file**.
- Carriers: "carriers that will support commissions" (no explicit list given in source).

---

## Upsell at pricing

Service: **Travel_OfferPrice**

Request flag (mandatory to get upsells):

```
//AMA_TravelOfferPriceRQ/Request/ShoppingCriteria/FarePreferences/@PreferencesContext="Upsell"
```

Response: contains a **new level `OtherOffers`** (in addition to `PricedOffer`).
(diagram in source: screenshot of the Travel_OfferPrice RS tree showing the `OtherOffers` node alongside `PricedOffer`.)

One of the offers returned under `OtherOffers` can be selected and used to create the order **the same way as if it was the priced offer**.

```xml
<Request>
  <DataLists>
    <!-- ...truncated -->
  </DataLists>
  <PricedOffer>
    <!-- ...truncated -->
  </PricedOffer>
  <ShoppingCriteria>
    <FarePreferences PreferencesContext="Upsell"/>
  </ShoppingCriteria>
</Request>
```

---

## Payment with Cash

Service: **Travel_OrderPay**

Key values: `TypeCode` = `CA`, `PaymentMethod/Cash/CashInd` = `true`.
Amount carries currency in attribute `CurCode` and is expressed with decimals (`441.26`).

```xml
<AMA_TravelOrderPayRQ>
  <Party>
    <!-- ...truncated -->
  </Party>
  <Request>
    <PaymentInfo>
      <Amount CurCode="EUR">441.26</Amount>
      <TypeCode>CA</TypeCode>
      <PaymentMethod>
        <Cash>
          <CashInd>true</CashInd>
        </Cash>
      </PaymentMethod>
    </PaymentInfo>
    <Order>
      <!-- ...truncated -->
    </Order>
  </Request>
</AMA_TravelOrderPayRQ>
```

---

## 3DS Offline CC payment

- For **Travel Agencies exempted from 3DS authentication via webservices**.
- Include **`MO`** (mail order) in the request to ensure the credit card payment is accepted.
- **`MO` is the only value that can be used** for this request. (Value belongs to the `PaymentTrxChannelCode` value set — see below.)

---

## 3DS CC payment (online / full 3D Secure)

Service: **Travel_OrderPay**, using the **Auth Data** details.

- To be compliant with credit card payments, it is required to be able to perform 3D Secure authentication using the travel API.
- **The payment provider handling the 3DS is responsible for providing the details to be included in the request.**
- For 3DS payments involving **ANDC carriers**, the following **must be base64 encoded**:
  - `SecurePaymentVersion2/AuthenticationTokenValue`
  - `SecurePaymentVersion2/DirectoryServerTrxID`
- According to the IATA schema, **all 3DS data elements are exposed through the Travel Platform**. The **Seller must pass all relevant and applicable 3DS information** through the Travel Platform.

### 3DS field reference

| Field Name | Values | Description |
|---|---|---|
| `PaymentTrxChannelCode` | `EC` (Electronic Commerce), `FA` (Face2Face), `MO` (Mail Order), `NS` (Not Specified), `TO` (Telephone Order/IVR) | **Mandatory.** Rest will depend on the transaction (whether 3DS is successfully authenticated, request exemption, or not done). **For e-commerce transactions (and where 3DS applies) this must be `EC`.** |
| `AuthenticationTokenValue` | Important: **should be base64 encoded** | Cardholder Authentication Verification Value (CAVV) returned by 3DS2 authentication |
| `AuthenticationMerchantName` | e.g., `Merchant ABC` | Name of the merchant assigned by the acquirer or payment partner |
| `CardNumberCollectionCode` | `K` — Keyed entry; `S` — Previously stored | Indicates the collection method of the card number: newly entered or using previously saved information |
| `PayerAuthenticationExemptionCode` | `AO` — Authentication Outage; `DA` — Delegated Authentication, Low Value Exemption; `MA` — Merchant Problem/Major Outage; `ND` — None defined; `SC` — Secure Corporate Exemption; `TB` — Trusted Beneficiary Exemption; `TR` — Tx risk analysis exemption | To be sent **only when the merchant is requesting an exemption** |
| `PayerAuthenticationFailureToCompleteCode` | `NC` — Authentication Not Complete; `NS` — Authentication Not Successful | Identifies possible pre-defined reasons for failure to complete payer authentication |
| `AuthenticationValue` | (28-character string) | 28-character string from authentication; a cryptographic value generated by the ACS |
| `ProgramProtocolText` | e.g., `2.2.0` | 3DS protocol version number |
| `DirectoryServerTrxID` | Important: **should be base64 encoded** | Universally unique transaction identifier assigned by the Directory Server (DS) to identify a single transaction |
| `ElectronicCoomcerceIndText` (spelling exactly as in source) | e.g., `05` | Electronic Commerce Indicator (ECI) returned by 3DS2 authentication |
| `TrxStatusReasonText` | See **EMVCO documentation** for list of possible values | Outcome of authentication coming from the directory server |
| `TrxStatusText` | See **EMVCO documentation** | Outcome of authentication |

### Error reporting

**In the Order_Create response** the platform provides:
- **1A error code** and **error message** (canned message), and additionally
- **provider error code** and **provider error message** — more granular details on the reasons.

---

## Support Fraud Checks for CC payment (BA, IB, AC, 6E, VY only)

Carriers: **BA, IB, AC, 6E, VY only.**

- When an order is created, a **warning in the Travel_OrderView response** advises that additional details are required for credit card payments. The warning message **varies depending on the carrier**:
  - `"For credit card payment enter card holder name, address and email"`
  - `"For credit card payment enter card holder name and address"`
- **6E** requires both the **cardholder's name and address**.
- **VY** requires **only the cardholder's name**.
- The TA can enter the fraud data into **Travel_OrderPay** or **Travel_OrderChange** when requested by the airline.
- **The data is not stored in the PNR.** Storage will be defined during phase 2 of this development.

---

## Manual Approval Code

- Some carriers may require a **manual approval code** for payment of an NDC order **in some markets**.
- The **TA must execute a process offline** to obtain the approval code.

---

## Implicit FOP (Use the FOP from PNR)

Service: **Travel_OrderPay**

Allows the travel agent to use a Form of Payment (FOP) **already present in the Amadeus PNR** to pay for an Order.

- `<TypeCode>FROM_PNR</TypeCode>` — indicator for the use case of using the existing FOP in the record.
- `<RemarkText>15</RemarkText>` — `15` is the **tattoo of the FP element** in the record.

```xml
<AMA_TravelOrderPayRQ>
  <Party>
    <!-- ...truncated -->
  </Party>
  <Request>
    <PaymentInfo>
      <Amount CurCode="EUR">123</Amount>
      <TypeCode>FROM_PNR</TypeCode>
      <PaymentMethod>
        <OtherPaymentMethod>
          <Remark>
            <RemarkText>15</RemarkText>
          </Remark>
        </OtherPaymentMethod>
      </PaymentMethod>
    </PaymentInfo>
    <Order>
      <!-- ...truncated -->
    </Order>
  </Request>
</AMA_TravelOrderPayRQ>
```

---

## OB fees and airline surcharge

### OB fees at pricing

Service: **Travel_OfferPrice**

To obtain OB fees, the **credit card BIN number must be passed in the Travel_OfferPrice request** via `ShoppingCriteria/PaymentCardCriteria`:

```xml
<AMA_TravelOfferPriceRQ>
  <Party>
    <!-- ...truncated -->
  </Party>
  <Request>
    <!-- ...truncated -->
    <ShoppingCriteria>
      <PaymentCardCriteria>
        <CardTypeCode>VI</CardTypeCode>
        <IssuerIdentificationNumber>400555</IssuerIdentificationNumber>
      </PaymentCardCriteria>
    </ShoppingCriteria>
  </Request>
</AMA_TravelOfferPriceRQ>
```

Response path: `//AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OfferItem/FareDetail/Price`

```xml
<Price>
  <BaseAmount Code="EUR">7100</BaseAmount>
  <Surcharges>
    <Surcharge>
      <Total Code="EUR">315</Total>
      <Breakdown>
        <Fee>
          <Amount Code="EUR">315</Amount>
          <Designator>OB</Designator>
          <Description>CC FEE</Description>
          <Nature>FCA</Nature>
        </Fee>
      </Breakdown>
    </Surcharge>
  </Surcharges>
  <!-- ...truncated -->
</Price>
```

Codes: `Designator` = `OB`, `Description` = `CC FEE`, `Nature` = `FCA`.

### OB Fees best practices

For some airlines it is a requirement to perform the pricing **with** the BIN number. **Without this, the order creation will fail.** Options:

- Enter the **most likely BIN** in Travel_OfferPrice, but be ready to **cancel the order and restart the flow from the beginning (MasterPricer)** if the user selects a different BIN (can be complex but invisible for the end user).
- Implement a **special UI flow to request the BIN before Pricing**.

### Airline surcharge

At pricing — path: `//AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OfferItem/FareDetail/Price/Surcharges`

```xml
<Price>
  <BaseAmount Code="EUR">5500</BaseAmount>
  <Surcharges>
    <Surcharge>
      <Total Code="EUR">304</Total>
      <Breakdown>
        <Fee>
          <Amount Code="EUR">304</Amount>
          <Description>AggregatorFee</Description>
          <Nature>T02</Nature>
        </Fee>
      </Breakdown>
    </Surcharge>
  </Surcharges>
  <!-- ...truncated -->
</Price>
```

In Travel_OrderView the airline surcharge is under the **breakdown section**:
`//AMA_TravelOrderViewRS/Response/Order/OrderItem/FareDetail/Price/TotalAmount/DetailCurrencyPrice/Fees/Breakdown`

```xml
<Price>
  <TotalAmount>
    <DetailCurrencyPrice>
      <Total Code="EUR">10398</Total>
      <Fees>
        <Total Code="EUR">304</Total>
        <Breakdown>
          <Fee>
            <Amount Code="EUR">304</Amount>
            <Description>AggregatorFee</Description>
            <Nature>T02</Nature>
          </Fee>
        </Breakdown>
      </Fees>
    </DetailCurrencyPrice>
  </TotalAmount>
  <BaseAmount Code="EUR">5500</BaseAmount>
  <!-- ...truncated -->
</Price>
```

Codes: `Description` = `AggregatorFee`, `Nature` = `T02`.

---

## Obtain secured flight information at Pricing

Service: **Travel_OfferPrice**

Path: `//AMA_TravelOfferPriceRS/Response/DataLists/PaxSegmentList/PaxSegment/SecureFlightInd`

- If `SecureFlightInd` = **`True`**, then passenger **gender** and **date of birth** are **mandatory in Travel_OrderCreate**.
- If missing, **the booking cannot be completed**, and the process **must be restarted all over again with a new shopping request**.

---

## Create NDC booking within an existing PNR (w/ hotel or miscellaneous segment)

- By default, an Amadeus PNR is created with each new order created by calling **Travel_OrderCreate**.
- To create an order and attach it to an **already created PNR**, use **Travel_OrderChange** instead.
- The flow is identical to the prime booking flow, with the **only difference being the replacement of Travel_OrderCreate with Travel_OrderChange**.
- **Prerequisite:** PAX info **must be aligned** between the existing PNR and the Travel_OrderChange request — **name, surname, title, gender** — otherwise **it will fail**.
- The request contains a reference to the existing PNR (`BookingRef/BookingID` = the record locator) plus the offer information to create the order in the existing PNR.

```xml
<AMA_TravelOrderChangeRQ>
  <Party>
    <!-- ...truncated -->
  </Party>
  <Request>
    <BookingRef>
      <BookingID>VHPCGF</BookingID>
      <BookingEntity/>
    </BookingRef>
    <ChangeOrder>
      <UpdateOrderItem>
        <AcceptOffer>
          <SelectedOffer>
            <OfferID>PoP90255C1E-C267-4287-9B60-1</OfferID>
            <OwnerCode>AA</OwnerCode>
            <ShoppingResponseRefID>P90255C1E-C267-4287-9B60</ShoppingResponseRefID>
            <SelectedOfferItem>
              <OfferItemRefID>PoIP90255C1E-C267-4287-9B60-1-1</OfferItemRefID>
              <PaxRefID>T1</PaxRefID>
            </SelectedOfferItem>
          </SelectedOffer>
        </AcceptOffer>
      </UpdateOrderItem>
    </ChangeOrder>
    <DataLists>
      <!-- ...truncated -->
    </DataLists>
  </Request>
</AMA_TravelOrderChangeRQ>
```

---

## Combined or Joint Invoice for US Market

- **US Market only.** TAs can generate a **combined invoice or joint invoice** and **BO A.I.R.** for NDC orders.
- Invoice parameters are sent via **Travel_OrderPay** or **Travel_OrderChange** under `Request/Parameters/Invoice`.
- Supported delivery channels: **`EMAIL`, `FAX`, `PRINT`**.

Type / Joint → use case matrix:

| TYPE | JOINT | USECASE |
|---|---|---|
| BASIC | FALSE | `INV` |
| BASIC | TRUE | `INVJ` |
| EXTENDED | FALSE | `INE` |
| EXTENDED | TRUE | `INEJ` |

```xml
<AMA_TravelOrderPayRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderPayRQ_v1">
  <Party>
    <!-- ...truncated -->
  </Party>
  <Request>
    <PaymentInfo>
      <!-- ...truncated -->
    </PaymentInfo>
    <Order>
      <OrderID>6X01478798</OrderID>
      <OwnerCode>6X</OwnerCode>
    </Order>
    <Parameters>
      <Invoice>
        <Formatting>
          <Type Joint="false">extended</Type>
          <Language>EN</Language>
        </Formatting>
        <Delivery>
          <Channel>PRINT</Channel>
          <Destination>
            <Printer>
              <Identifier> printer mnemonic</Identifier>
            </Printer>
          </Destination>
        </Delivery>
      </Invoice>
    </Parameters>
  </Request>
</AMA_TravelOrderPayRQ>
```

Note: in the sample, `Type` element value is lowercase `extended` and `Joint` is an attribute (`Joint="false"`); the namespace `http://xml.amadeus.com/2010/06/Travel_OrderPayRQ_v1` is declared on the root.

---

## Summary table

| Feature | Service | Path | Carriers | Notes |
|---|---|---|---|---|
| Commissions | Shopping / OfferPrice / OrderCreate / post-booking | — | Carriers that support commissions | Percentage amount; auto FM element (no computation); in BO A.I.R. |
| Upsell at pricing | Travel_OfferPrice | `RQ: /Request/ShoppingCriteria/FarePreferences/@PreferencesContext="Upsell"`; `RS: OtherOffers` | — | Upsell offer selectable for order creation like the priced offer |
| Payment with Cash | Travel_OrderPay | `/Request/PaymentInfo`: `TypeCode=CA`, `PaymentMethod/Cash/CashInd=true` | — | `<Amount CurCode="EUR">441.26</Amount>` |
| 3DS Offline CC payment | Travel_OrderPay | `PaymentTrxChannelCode=MO` | — | Only for TAs exempted from 3DS via webservices; `MO` is the only permitted value |
| 3DS CC payment | Travel_OrderPay (Auth Data / `SecurePaymentVersion2`) | See 3DS field table | ANDC carriers require base64 for `AuthenticationTokenValue`, `DirectoryServerTrxID` | `PaymentTrxChannelCode` mandatory; `EC` for e-commerce; provider supplies values; Order_Create RS returns 1A code+message plus provider code+message |
| Fraud checks for CC | Travel_OrderPay or Travel_OrderChange (warning in Travel_OrderView RS) | Cardholder name / address / email | **BA, IB, AC, 6E, VY only** | 6E: name+address; VY: name only. Data not stored in PNR (phase 2) |
| Manual Approval Code | (offline process, then payment) | — | Some carriers, some markets | TA obtains code offline |
| Implicit FOP | Travel_OrderPay | `PaymentInfo`: `TypeCode=FROM_PNR`, `PaymentMethod/OtherPaymentMethod/Remark/RemarkText=<FP tattoo>` | — | RemarkText `15` = tattoo of FP element in the PNR |
| OB fees | Travel_OfferPrice | `RQ: /Request/ShoppingCriteria/PaymentCardCriteria/{CardTypeCode, IssuerIdentificationNumber}`; `RS: .../FareDetail/Price/Surcharges/Surcharge/Breakdown/Fee` | Some airlines mandatory | `Designator=OB`, `Description=CC FEE`, `Nature=FCA`; missing BIN → order creation fails |
| Airline surcharge | Travel_OfferPrice / Travel_OrderView | `.../FareDetail/Price/Surcharges`; `//AMA_TravelOrderViewRS/Response/Order/OrderItem/FareDetail/Price/TotalAmount/DetailCurrencyPrice/Fees/Breakdown` | — | `Description=AggregatorFee`, `Nature=T02` |
| Secure flight info at pricing | Travel_OfferPrice | `//AMA_TravelOfferPriceRS/Response/DataLists/PaxSegmentList/PaxSegment/SecureFlightInd` | — | `True` → gender + DOB mandatory in Travel_OrderCreate |
| NDC booking in existing PNR | Travel_OrderChange (replaces Travel_OrderCreate) | `/Request/BookingRef/BookingID`, `/Request/ChangeOrder/UpdateOrderItem/AcceptOffer/SelectedOffer` | — | PAX name/surname/title/gender must match PNR or it fails |
| Combined / Joint Invoice | Travel_OrderPay or Travel_OrderChange | `/Request/Parameters/Invoice/{Formatting/Type@Joint, Formatting/Language, Delivery/Channel, Delivery/Destination}` | US market | Channels EMAIL, FAX, PRINT; use cases INV / INVJ / INE / INEJ |

---

## Gotchas

- **BIN before pricing is load-bearing:** for some airlines, pricing without `IssuerIdentificationNumber` makes **order creation fail**. Recovery requires cancelling the order and restarting from MasterPricer — design the UI to collect the BIN before pricing, or accept a silent restart.
- **`SecureFlightInd=True` is a point of no return:** if gender/DOB are not supplied in Travel_OrderCreate, the booking cannot be completed and **the whole flow must restart with a new shopping request**.
- **Base64 only for ANDC carriers' 3DS fields** (`AuthenticationTokenValue`, `DirectoryServerTrxID`) — encoding them where not required, or omitting encoding where required, breaks the payment.
- **`PaymentTrxChannelCode` is mandatory** on 3DS CC payments; it must be `EC` for e-commerce transactions where 3DS applies. `MO` is reserved for the offline/exempted-TA case and is the only value usable there.
- **`PayerAuthenticationExemptionCode` must be sent only when actually requesting an exemption** — do not default it (`ND` = "None defined" is a value, not a substitute for omitting the field).
- Field name in the schema is misspelled as **`ElectronicCoomcerceIndText`** (not `ElectronicCommerce...`) — copy the spelling exactly.
- **Amount formatting differs by service in the source samples:** Travel_OrderPay uses `<Amount CurCode="EUR">441.26</Amount>` (decimal point, `CurCode` attribute), while Travel_OfferPrice/Travel_OrderView use `<Amount Code="EUR">315</Amount>` / `<BaseAmount Code="EUR">7100</BaseAmount>` (attribute `Code`, unscaled integer). Do not assume the same attribute name or scaling across services.
- **Fraud-check data is not persisted** in the PNR — it must be re-sent on each Travel_OrderPay / Travel_OrderChange that needs it.
- The FM element created by commissions must not be recomputed — treat it as informational output only.
- Order_Create failures for CC payment carry **two** error layers; log the **provider** error code/message, since the 1A message is a canned generic string.
