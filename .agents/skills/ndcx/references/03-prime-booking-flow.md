# Prime Booking Flow — Travel_OfferPrice → OrderCreate → OrderPay → OrderRetrieve

> Source: WBS Implementation Guide NDC[X] v1.5, sections Travel_OfferPrice, Travel_OrderCreate, Travel_OrderPay (incl. Payment with Installments — Iberia / American Airlines Brazil), Travel_OrderRetrieve

Worked example throughout: round trip, 2 ADT + 1 CHD (PTC `CNN`) + 1 INF, credit card payment, carrier `6X` (test carrier).
Traveler IDs used consistently: `T1` (ADT, infant holder), `T1.1` (INF), `T2` (ADT), `T3` (CNN).

Common to **all** `Travel_*` web services: the `Party` block immediately below the root `AMA_Travel*RQ` element is **not used but is mandatory**. Send it with placeholder values (`unused`).

```xml
<Party>
  <Sender>
    <TravelAgency>
      <AgencyID>unused</AgencyID>
      <PseudoCityID>unused</PseudoCityID>
    </TravelAgency>
  </Sender>
</Party>
```

---

## 1. Travel_OfferPrice

**Purpose:** price the offer selected from shopping (MasterPricer / AirShopping). Passenger type (PTC) is required at this step. Returns the priced offer whose IDs feed OrderCreate.

Root: `<AMA_TravelOfferPriceRQ>`.

### Mandatory inputs

| Field path | Source of the value | Notes |
|---|---|---|
| `//AMA_TravelOfferPriceRQ/Party` | static | Not used but mandatory. |
| `//AMA_TravelOfferPriceRQ/Request/DataLists/PaxList/Pax/PaxID` | client-assigned | `T1`, `T1.1`, `T2`, `T3`. Referenced by `PaxRefID` elsewhere. |
| `.../Pax/PTC` | client | `ADT`, `CNN` (child), `INF` (infant). Passenger type is **required at pricing step**. |
| `.../Pax[PaxID=T1]/PaxRefID` | client | Infant association: on the **adult** Pax, `PaxRefID` = the infant's `PaxID` (`T1.1`). |
| `.../Pax[PTC=INF]/Birthdate` | client | Infant DOB, `YYYY-MM-DD` (`2021-10-14` in example). |
| `.../Pax[PTC=INF]/GenderCode` | client | `F` / `M`. |
| `//Request/PricedOffer/SelectedOffer/OfferRefID` | shopping RS `Offer/OfferID` | e.g. `Sh_ResponseID_000-1`. |
| `//Request/PricedOffer/SelectedOffer/OwnerCode` | shopping RS `Offer/OwnerCode` | e.g. `6X`. |
| `//Request/PricedOffer/SelectedOffer/ShoppingResponseRefID` | shopping RS `ShoppingResponseID` | e.g. `Sh_ResponseID_000`. |
| `//SelectedOffer/SelectedOfferItem/OfferItemRefID` | shopping RS `Offer/OfferItem/OfferItemID` | One `SelectedOfferItem` per offer item. |
| `//SelectedOffer/SelectedOfferItem/PaxRefID` | client `PaxID` values | In OfferPrice the example puts **multiple travelers in one element, space-separated**: `<PaxRefID>T1 T2</PaxRefID>`. |

All shopping IDs stored from the MasterPricer RS are given in Travel_OfferPrice RQ under `//AMA_TravelOfferPriceRQ/Request/PricedOffer/SelectedOffer`.

**offerItemID granularity is provider-dependent:** for **Accelya**, `offerItemID` is returned **per PTC type**; for **Altea NDC carriers and AF/KL** there is **1 offerItemID for all travelers**. See the "Normalization Differences per Provider" document.

### Request skeleton

```xml
<AMA_TravelOfferPriceRQ>
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>unused</AgencyID>
        <PseudoCityID>unused</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <DataLists>
      <PaxList>
        <Pax>
          <PaxID>T1</PaxID>
          <PTC>ADT</PTC>
          <PaxRefID>T1.1</PaxRefID>
        </Pax>
        <Pax>
          <PaxID>T1.1</PaxID>
          <PTC>INF</PTC>
          <Birthdate>2021-10-14</Birthdate>
          <GenderCode>F</GenderCode>
        </Pax>
        <Pax>
          <PaxID>T2</PaxID>
          <PTC>ADT</PTC>
        </Pax>
        <Pax>
          <PaxID>T3</PaxID>
          <PTC>CNN</PTC>
        </Pax>
      </PaxList>
    </DataLists>
    <PricedOffer>
      <SelectedOffer>
        <OfferRefID>Sh_ResponseID_000-1</OfferRefID>
        <OwnerCode>6X</OwnerCode>
        <ShoppingResponseRefID>Sh_ResponseID_000</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemRefID>Sh_ResponseID_000-1-1</OfferItemRefID>
          <PaxRefID>T1 T2</PaxRefID>
        </SelectedOfferItem>
        <SelectedOfferItem>
          <OfferItemRefID>Sh_ResponseID_000-1-2</OfferItemRefID>
          <PaxRefID>T3</PaxRefID>
        </SelectedOfferItem>
        <SelectedOfferItem>
          <OfferItemRefID>Sh_ResponseID_000-1-3</OfferItemRefID>
          <PaxRefID>T1.1</PaxRefID>
        </SelectedOfferItem>
      </SelectedOffer>
    </PricedOffer>
  </Request>
</AMA_TravelOfferPriceRQ>
```

(diagram in source: image19.png — screenshot of the corresponding Travel_OfferPrice **response** payload, shown side-by-side with the request; its literal XML is not reproduced in the text.)

### Key response fields to read

| Value | Exact path |
|---|---|
| Pricing OfferID | `//AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OfferID` |
| Pricing OwnerCode | `//AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OwnerCode` |
| Pricing ResponseID | `//AMA_TravelOfferPriceRS/Response/ShoppingResponse/ShoppingResponseID` |
| Pricing OfferItemID | `//AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OfferItem/OfferItemID` |
| Installment plan code (Iberia) | `//AMA_TravelOfferPriceRS/Response/Payments/PaymentInfo/PaymentMethod/PaymentCard/InstallmentPlanCatalogue/InstallmentPlan/PlanCode` |

### Price levels (Offer)

Total OfferItem amounts are **not** normalized among all airlines at `OfferItem/FareDetail/Price` level with price details. Offer price is returned at 3 levels:

- **Level 1 — total at Offer/Order level:** `//AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/TotalPrice`
  - **Recommended NOT to use** — there are plans to deprecate this section in a coming release.
- **Level 2 — total per OfferItem:** `//AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OfferItem/Price/TotalAmount`
  - Summed from: base amount + total tax amount + surcharges (e.g. aggregator surcharges) included; **CC fees not yet included** (to be covered by the OB fees normalization gap).
  - Recommended way to display total per OfferItem **if OB fees are not required** to be displayed.
- **Level 3 — breakdown per OfferItem:** `//AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OfferItem/FareDetail/Price`
  - Contains base fare amount; tax (total tax + tax breakdown); surcharges (total + breakdown); CC fees and their breakdown.
  - **Does not sum up the totals** — client must implement summing logic. Breakdown amounts here are fully normalized and accuracy is guaranteed.
  - Use Level 3 **if OB fees are required**.

---

## 2. Travel_OrderCreate

**Purpose:** create the order from the priced offer. Full passenger info is required at this step, provided under `//AMA_TravelOrderCreateRQ/Request/DataLists/PaxList` (the source writes this path as `//AMA_TravelOrederCreateRQ/Request/DataLists/PaxList` — typo).

Root: `<AMA_TravelOrderCreateRQ xmlns:trav="http://xml.amadeus.com/2010/06/Travel_OrderCreateRQ_v1">`.

Response document is `AMA_TravelOrderViewRS` (OrderView).

### Mandatory inputs

| Field path | Source of the value | Notes |
|---|---|---|
| `//AMA_TravelOrderCreateRQ/Party` | static | Not used but mandatory. |
| `//Request/CreateOrder/SelectedOffer/OfferID` | OfferPrice RS `PricedOffer/Offer/OfferID` | e.g. `Pr_ResponseID_000-1`. Note element name is `OfferID` here (not `OfferRefID`). |
| `//Request/CreateOrder/SelectedOffer/OwnerCode` | OfferPrice RS `Offer/OwnerCode` | `6X`. |
| `//Request/CreateOrder/SelectedOffer/ShoppingResponseRefID` | OfferPrice RS `ShoppingResponse/ShoppingResponseID` | `Pr_ResponseID_000`. |
| `//SelectedOffer/SelectedOfferItem/OfferItemID` | OfferPrice RS `Offer/OfferItem/OfferItemID` | Element name is `OfferItemID` here (not `OfferItemRefID`). |
| `//SelectedOffer/SelectedOfferItem/PaxRefID` | client `PaxID` | Here **one `PaxRefID` element per traveler** (repeated), unlike OfferPrice's space-separated form. |
| `//Request/DataLists/PaxList/Pax/PaxID` + `PTC` | client | Same IDs as OfferPrice. |
| `.../Pax/Birthdate` | client | **TSA requirement** — must be present. |
| `.../Pax/Individual/GenderCode` | client | **TSA requirement** — must be present. |
| `.../Pax/Individual/TitleName`, `GivenName`, `Surname` | client | Names. |
| `.../Pax[T1]/PaxRefID` | client | Infant association on the adult: `T1.1`. |
| `.../Pax/ContactInfo/ContactRefusedInd` | client | `false` when contact is provided. |
| `.../ContactInfo/Phone/LabelText` | static | Must be `MOBILE` — required text; affects post-booking modifications. |
| `.../ContactInfo/EmailAddress/LabelText` | static | Must be `EMAIL` — required text; affects post-booking modifications. |
| `.../ContactInfo/PostalAddress/LabelText` | static | `R` = residential address, `D` = delivery address. |

All pricing IDs stored from Travel_OfferPrice RS are given under `//AMA_TravelOrderCreateRQ/Request/CreateOrder/SelectedOffer`.

**Not sent to the airline:** the Known Traveler Number and the Redress number — these are stored on the Amadeus PNR only.

**If Gender and DOB are missing, `Travel_OrderPay` fails** with an error code (see "Obtain secured flight information at Pricing"). (diagram in source: image20.png — screenshot of the error returned by Travel_OrderPay when Gender/DOB are absent; the literal error code/string is not in the text.)

### Identity document / visa encoding

Within `Pax/IdentityDoc`:
- `IdentityDocID` — document number.
- `IdentityDocTypeCode` — `PT` = passport (adult example), `P` = passport (infant/child/other examples).
- `IssuingCountryCode`, `CitizenshipCountryCode`, `IssueDate`, `ExpiryDate`.
- Nested `Visa` blocks distinguished by `VisaTypeCode`:
  - `K` → **Known Traveler Number** (`VisaID` carries the KTN).
  - `R` → **Redress number**.
  - `V` → actual **visa**.
  - Each with `EnterBeforeDate`, `HostCountryCode`, `IssueDate`.

Frequent flyer: `Pax/LoyaltyProgramAccount/AccountNumber` + `Carrier/AirlineDesigCode`.

### Request skeleton

```xml
<AMA_TravelOrderCreateRQ xmlns:trav="http://xml.amadeus.com/2010/06/Travel_OrderCreateRQ_v1">
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
        <OfferID>Pr_ResponseID_000-1</OfferID>
        <OwnerCode>6X</OwnerCode>
        <ShoppingResponseRefID>Pr_ResponseID_000</ShoppingResponseRefID>
        <SelectedOfferItem>
          <OfferItemID>Pr_ResponseID_000-1-1</OfferItemID>
          <PaxRefID>T1</PaxRefID>
          <PaxRefID>T2</PaxRefID>
        </SelectedOfferItem>
        <SelectedOfferItem>
          <OfferItemID>Pr_ResponseID_000-1-3</OfferItemID>
          <PaxRefID>T1.1</PaxRefID>
        </SelectedOfferItem>
        <SelectedOfferItem>
          <OfferItemID>Pr_ResponseID_000-1-2</OfferItemID>
          <PaxRefID>T3</PaxRefID>
        </SelectedOfferItem>
      </SelectedOffer>
    </CreateOrder>
    <DataLists>
      <PaxList>
        <Pax>
          <PaxID>T1</PaxID>
          <PTC>ADT</PTC>
          <Birthdate>2000-11-13</Birthdate>            <!-- TSA REQUIREMENT -->
          <PaxRefID>T1.1</PaxRefID>                     <!-- infant association -->
          <ContactInfo>
            <ContactRefusedInd>false</ContactRefusedInd>
            <Phone>
              <LabelText>MOBILE</LabelText>
              <PhoneNumber>3054996000</PhoneNumber>
            </Phone>
          </ContactInfo>
          <ContactInfo>
            <ContactRefusedInd>false</ContactRefusedInd>
            <EmailAddress>
              <LabelText>EMAIL</LabelText>
              <EmailAddressText>SQUIN@MYEMAIL.COM</EmailAddressText>
            </EmailAddress>
          </ContactInfo>
          <ContactInfo>
            <ContactRefusedInd>false</ContactRefusedInd>
            <PostalAddress>
              <LabelText>R</LabelText>                  <!-- RESIDENTIAL ADDRESS -->
              <StreetText>3470 NW 82 AVENUE</StreetText>
              <PostalCode>33122</PostalCode>
              <CityName>MIAMI</CityName>
              <CountrySubDivisionName>FL</CountrySubDivisionName>
              <CountryCode>USA</CountryCode>
            </PostalAddress>
          </ContactInfo>
          <ContactInfo>
            <ContactRefusedInd>false</ContactRefusedInd>
            <PostalAddress>
              <LabelText>D</LabelText>                  <!-- DELIVERY ADDRESS -->
              <StreetText>123 BILTMORE WAY </StreetText>
              <PostalCode>33143</PostalCode>
              <CityName>CORAL GABLES</CityName>
              <CountrySubDivisionName>FL</CountrySubDivisionName>
              <CountryCode>USA</CountryCode>
            </PostalAddress>
          </ContactInfo>
          <IdentityDoc>
            <IdentityDocID>29090880</IdentityDocID>     <!-- PASSPORT -->
            <IdentityDocTypeCode>PT</IdentityDocTypeCode>
            <IssuingCountryCode>USA</IssuingCountryCode>
            <CitizenshipCountryCode>USA</CitizenshipCountryCode>
            <ExpiryDate>2028-01-01</ExpiryDate>
            <Visa>
              <VisaID>888845</VisaID>                   <!-- KNOWN TRAVELER NUMBER -->
              <VisaTypeCode>K</VisaTypeCode>
              <EnterBeforeDate>2027-03-17</EnterBeforeDate>
              <HostCountryCode>USA</HostCountryCode>
              <IssueDate>2024-01-24</IssueDate>
            </Visa>
            <Visa>
              <VisaID>22252</VisaID>
              <VisaTypeCode>R</VisaTypeCode>            <!-- REDRESS -->
              <EnterBeforeDate>2028-03-09</EnterBeforeDate>
              <HostCountryCode>USA</HostCountryCode>
              <IssueDate>2023-03-15</IssueDate>
            </Visa>
            <Visa>
              <VisaID>A7842037</VisaID>                 <!-- VISA -->
              <VisaTypeCode>V</VisaTypeCode>
              <EnterBeforeDate>2029-05-31</EnterBeforeDate>
              <HostCountryCode>USA</HostCountryCode>
              <IssueDate>2023-03-15</IssueDate>
            </Visa>
          </IdentityDoc>
          <Individual>
            <GenderCode>F</GenderCode>                  <!-- TSA REQUIREMENT -->
            <TitleName>MRS</TitleName>
            <GivenName>SYL</GivenName>
            <Surname>QUIN</Surname>
          </Individual>
          <LoyaltyProgramAccount>                       <!-- FREQUENT FLYER / LOYALTY NUMBER -->
            <AccountNumber>99665521144</AccountNumber>
            <Carrier>
              <AirlineDesigCode>AA</AirlineDesigCode>
            </Carrier>
          </LoyaltyProgramAccount>
        </Pax>
        <Pax>
          <PaxID>T1.1</PaxID>
          <PTC>INF</PTC>
          <Birthdate>2023-12-13</Birthdate>
          <IdentityDoc>
            <IdentityDocID>547896592</IdentityDocID>
            <IdentityDocTypeCode>P</IdentityDocTypeCode>
            <IssuingCountryCode>US</IssuingCountryCode>
            <IssueDate>2024-01-04</IssueDate>
            <ExpiryDate>2026-01-04</ExpiryDate>
          </IdentityDoc>
          <Individual>
            <GenderCode>M</GenderCode>
            <GivenName>JIM</GivenName>
            <Surname>SMITH</Surname>
          </Individual>
        </Pax>
        <Pax>
          <PaxID>T2</PaxID>
          <PTC>ADT</PTC>
          <Birthdate>1970-08-13</Birthdate>
          <ContactInfo>
            <ContactRefusedInd>false</ContactRefusedInd>
            <EmailAddress>
              <LabelText>EMAIL</LabelText>
              <EmailAddressText>JANE.SMITH@MYMAIL.COM</EmailAddressText>
            </EmailAddress>
          </ContactInfo>
          <IdentityDoc>
            <IdentityDocID>547896603</IdentityDocID>
            <IdentityDocTypeCode>P</IdentityDocTypeCode>
            <IssuingCountryCode>US</IssuingCountryCode>
            <IssueDate>2016-11-01</IssueDate>
            <ExpiryDate>2026-11-01</ExpiryDate>
          </IdentityDoc>
          <Individual>
            <GenderCode>F</GenderCode>
            <GivenName>JANE</GivenName>
            <Surname>SMITH</Surname>
          </Individual>
        </Pax>
        <Pax>
          <PaxID>T3</PaxID>
          <PTC>CNN</PTC>
          <Birthdate>2020-08-13</Birthdate>
          <IdentityDoc>
            <IdentityDocID>547896614</IdentityDocID>
            <IdentityDocTypeCode>P</IdentityDocTypeCode>
            <IssuingCountryCode>US</IssuingCountryCode>
            <IssueDate>2019-11-01</IssueDate>
            <ExpiryDate>2026-11-01</ExpiryDate>
          </IdentityDoc>
          <Individual>
            <GenderCode>F</GenderCode>
            <GivenName>JOANNE</GivenName>
            <Surname>SMITH</Surname>
          </Individual>
        </Pax>
      </PaxList>
    </DataLists>
  </Request>
</AMA_TravelOrderCreateRQ>
```

(diagram in source: image21.png — screenshot of the Travel_OrderCreate / OrderView **response** payload; its literal XML is not reproduced in the text.)

### Key response fields to read (AMA_TravelOrderViewRS)

The order is **fully defined by two keys**:

| Value | Exact path |
|---|---|
| Order OrderID | `//AMA_TravelOrderViewRS/Response/Order/OrderID` |
| Order OwnerCode | `//AMA_TravelOrderViewRS/Response/Order/OwnerCode` |

Price and currency, also needed for the payment request:

| Value | Exact path |
|---|---|
| Total amount — Level 1 (deprecating, do not use) | `//AMA_TravelOrderViewRS/Response/Order/TotalPrice` |
| Total amount — Level 2 (per OrderItem) | `//AMA_TravelOrderViewRS/Response/Order/OrderItem/Price/TotalAmount` |
| Total amount — Level 3 (breakdown per OrderItem) | `//AMA_TravelOrderViewRS/Response/Order/OrderItem/FareDetail/Price` |
| Currency | `//AMA_TravelOrderViewRS/Response/Order/.../.../@CurCode` (missing path segment depends on whether Level 2 or 3 is used) |
| Currency decimal place | `//AMA_TravelOrderViewRS/Response/Metadata/Other/OtherMetadata/CurrencyMetadatas/CurrencyMetadata[@MetadataKey="${Currency}"]/Decimals` |

Order price levels (same 3-level model as the Offer):
- **Level 1** `Order/TotalPrice` — recommended **not** to use; planned for deprecation.
- **Level 2** `Order/OrderItem/Price/TotalAmount` — sums base amount + total tax amount; **surcharges not displayed**; **CC fees not yet included** (OB fees normalization gap).
- **Level 3** `Order/OrderItem/FareDetail/Price` — base fare amount, tax (total + breakdown), surcharges (total + breakdown), CC fees and breakdown. **Does not sum totals** — build summing logic. Fully normalized, accuracy guaranteed.

**Amount / decimalPlace handling:** the total amount is returned as an **integer** in the Travel_OrderCreate response (e.g. `44126`) and must be read together with the decimal place (`2`) to obtain the ticket amount in decimal (`441.26`). **The decimal value is what must be sent in Travel_OrderPay.**

### Record locators (BookingRef)

OrderView exposes the record locator of different entities, usually 3:
- the airline record locator,
- the airline's IT provider record locator,
- the Amadeus NDC PNR.

Path: `//AMA_TravelOrderViewRS/Response/Order/BookingRef/BookingID`

An Amadeus PNR is created at the same time as the order. It is **not** the airline record but a local copy of the booking; usable for adding remarks, car or hotel segments, and for servicing via Amadeus Selling Platform Connect or SoapXML applications. The Amadeus recloc is the `BookingRef` whose `BookingEntity/Org/@OrgID` is `1A`:

```xml
<BookingRef>
  <BookingID>1A_PNR</BookingID>
  <BookingEntity>
    <Org OrgID="1A">
      <Name>Amadeus</Name>
    </Org>
  </BookingEntity>
</BookingRef>
```

---

## 3. Travel_OrderPay

**Purpose:** pay for the order and issue the documents. The amount to pay **requires the decimal** (unlike the integer returned by OrderCreate).

Root: `<AMA_TravelOrderPayRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderPayRQ_v1">`.
The AA installment examples use `<AMA_TravelOrderPayRQ version="1.008">` / `<AMA_TravelOrderPayRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderPayRQ_v1" version="1.008">`.

The request contains the `OrderID`, the `OwnerCode`, the `Amount`, the `CurCode`, and the rest of the info below `PaymentInfo` declaring that payment is made with a credit card.

### Mandatory inputs

| Field path | Source of the value | Notes |
|---|---|---|
| `//AMA_TravelOrderPayRQ/Party` | static | Not used but mandatory. |
| `//Request/PaymentInfo/Amount/@CurCode` | OrderView currency (`@CurCode`) | e.g. `USD`. |
| `//Request/PaymentInfo/Amount` | OrderView total amount **converted to decimal** using `Decimals` metadata | `2481.57` (from integer + 2 decimals). |
| `//Request/PaymentInfo/TypeCode` | static | `CC` for credit card. |
| `//PaymentInfo/SecurePaymentVersion2/PaymentTrxChannelCode` | client | `MO` in all examples. |
| `//PaymentInfo/PaymentMethod/PaymentCard/CardNumber` | client | e.g. `4434260000000008`. |
| `.../PaymentCard/SeriesCode` | client | CVV, e.g. `123`. |
| `.../PaymentCard/CreditCardVendorCode` | client | e.g. `VI`. |
| `.../PaymentCard/ExpirationDate` | client | `MMYY`, e.g. `0139`. |
| `.../PaymentCard/CardIssuerName` | client | Cardholder name (used in the AA installment examples), e.g. `ROBERT SMITH`. |
| `//Request/Order/OrderID` | OrderView `Order/OrderID` | e.g. `6X001HTUAUWA2`. |
| `//Request/Order/OwnerCode` | OrderView `Order/OwnerCode` | e.g. `6X`. |
| `//Request/DataLists/PaxList/Pax/PaxID` + `PTC` | client | Repeat the traveler list (`T1` ADT, `T1.1` INF, `T2` ADT, `T3` CNN). |

### Request skeleton (credit card, no installments)

```xml
<AMA_TravelOrderPayRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderPayRQ_v1">
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
      <Amount CurCode="USD">2481.57</Amount>
      <TypeCode>CC</TypeCode>
      <SecurePaymentVersion2>
        <PaymentTrxChannelCode>MO</PaymentTrxChannelCode>
      </SecurePaymentVersion2>
      <PaymentMethod>
        <PaymentCard>
          <CardNumber>4434260000000008</CardNumber>
          <SeriesCode>123</SeriesCode>
          <CreditCardVendorCode>VI</CreditCardVendorCode>
          <ExpirationDate>0139</ExpirationDate>
        </PaymentCard>
      </PaymentMethod>
    </PaymentInfo>
    <Order>
      <OrderID>6X001HTUAUWA2</OrderID>
      <OwnerCode>6X</OwnerCode>
    </Order>
    <DataLists>
      <PaxList>
        <Pax><PaxID>T1</PaxID><PTC>ADT</PTC></Pax>
        <Pax><PaxID>T1.1</PaxID><PTC>INF</PTC></Pax>
        <Pax><PaxID>T2</PaxID><PTC>ADT</PTC></Pax>
        <Pax><PaxID>T3</PaxID><PTC>CNN</PTC></Pax>
      </PaxList>
    </DataLists>
  </Request>
</AMA_TravelOrderPayRQ>
```

### Key response fields to read

Response is an OrderView. `PaymentInfo` appears **under `Order`, between `OrderItem` and `TotalPrice`**, with the amount back in **integer** form (`248157` for USD 2481.57):

```xml
<PaymentInfo>
  <Amount CurCode="USD">248157</Amount>
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

- `Order/PaymentInfo/PaymentStatusCode` → `COMMITTED` on successful payment.
- `Order/PaymentInfo/PaymentMethod/PaymentCard/MaskedCardID` → masked PAN, last 4 digits visible.
- **`TicketDocInfos` is now added at the end of the response** — it carries the issued document/ticket details. (diagram in source: image22.png — screenshot listing the content of the `TicketDocInfos` section; the individual field names are only in the image.)

### Errors specific to Travel_OrderPay

- If `GenderCode` and `Birthdate` were **not** supplied at Travel_OrderCreate (TSA requirement), Travel_OrderPay **fails**; see "Obtain secured flight information at Pricing". (The literal error code appears only in image20.png.)

### Payment with Installments — Iberia (IB)

Lets travel sellers offer payment in installments for **Iberia** bookings made via credit card: instead of paying the full amount upfront, the total cost is spread into smaller scheduled payments.

**Market scope:** Brazil only; in Q1 it will be activated for Perú, Colombia, Chile and Uruguay.

```xml
<PaymentInfo>
  <Amount CurCode="BRL">4054.38</Amount>          <!-- Ticket total amount -->
  <TypeCode>CC</TypeCode>
  <SecurePaymentVersion2>
    <PaymentTrxChannelCode>MO</PaymentTrxChannelCode>
  </SecurePaymentVersion2>
  <PaymentMethod>
    <PaymentCard>
      <CardNumber>4461250000000005</CardNumber>
      <CreditCardVendorCode>VI</CreditCardVendorCode>
      <ExpirationDate>0330</ExpirationDate>
      <SeriesCode>123</SeriesCode>
      <InstallmentPlan>
        <InstallmentNumber>6</InstallmentNumber>    <!-- Total number of installments -->
        <PlanCode>IBVI06</PlanCode>                 <!-- IB Plan Code -->
      </InstallmentPlan>
    </PaymentCard>
  </PaymentMethod>
</PaymentInfo>
```

`PlanCode` **must be retrieved from Travel_OfferPriceRS**: `AMA_TravelOfferPriceRS/Response/Payments/PaymentInfo/PaymentMethod/PaymentCard/InstallmentPlanCatalogue/InstallmentPlan/PlanCode`.

(diagram in source: image23.png — installment calculation illustration for the Iberia case.)

### Payment with Installments — American Airlines (AA), Brazilian market

AA uses a **seller-driven model with no installment catalogue**: the travel seller supplies all installment details at payment time.

Required elements:
- **Installment Plan** — `PlanCode` (format may follow airline logic combining airline, card type and number of installments) and `InstallmentNumber` (how many installments).
- **Financial breakdown** — `FirstInstallmentAmount` (charged at booking time) and `RemainingAmount`.

Formulas:
- `First Installment Amount = (Base Amount / #Installments) + Taxes`
- `Remaining Amount = (Base Amount / #Installments) * (#Installments - 1)`
  For AA, the remaining amount is the remaining base amount **per passenger (or per OrderItem)** after deducting the first installment.

Values are taken from the **OrderCreate response** price section (integers, 2 decimals for BRL):

```xml
<Price>
  <TotalAmount>
    <DetailCurrencyPrice>
      <Total Code="BRL">74812</Total>
    </DetailCurrencyPrice>
  </TotalAmount>
  <BaseAmount Code="BRL">62373</BaseAmount>
  <Taxes>
    <Total Code="BRL">12439</Total>
    .....
```

Single-ADT, 4-installment example (BRL 748.12 total, base 623.73, taxes 124.39):

```xml
<AMA_TravelOrderPayRQ version="1.008">
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
      <Amount CurCode="BRL">748.12</Amount>                          <!-- Total Amount -->
      <TypeCode>CC</TypeCode>
      <SecurePaymentVersion2>
        <PaymentTrxChannelCode>MO</PaymentTrxChannelCode>
      </SecurePaymentVersion2>
      <PaymentMethod>
        <PaymentCard>
          <CreditCardVendorCode>VI</CreditCardVendorCode>
          <CardNumber>4012000033330026</CardNumber>
          <SeriesCode>123</SeriesCode>
          <CardIssuerName>ROBERT SMITH</CardIssuerName>
          <ExpirationDate>0139</ExpirationDate>
          <InstallmentPlan>
            <InstallmentNumber>4</InstallmentNumber>                  <!-- Number of Installments -->
            <PlanCode>AA05</PlanCode>                                 <!-- For testing purpose, AA05 must be sent -->
            <FirstInstallmentAmount CurCode="BRL">280.32</FirstInstallmentAmount>
            <RemainingAmount CurCode="BRL">467.80</RemainingAmount>
          </InstallmentPlan>
        </PaymentCard>
      </PaymentMethod>
      <OrderItemRefID>P20A857BD-59F5-4AAE-96353rgjjnomf8ntm-1-1_1APAX_T1</OrderItemRefID>
    </PaymentInfo>
    <Order>
      <OrderID>AA001XRL435A5</OrderID>
      <OwnerCode>AA</OwnerCode>
    </Order>
  </Request>
</AMA_TravelOrderPayRQ>
```

Resulting FP/FA lines in cryptic:

```
10 FA PAX 001-5763597557/ETAA/05JUN26/SAOXXXXXX/57564931/S2
11 FP PAX CCVIXXXXXXXXXXXX0026/0139/BRL280.32+MSPL4XAA05/BRL467.80/S2/P1
```

**Multi-passenger installments:** the `PaymentInfo` structure must be **repeated for each passenger**, each carrying its own `OrderItemRefID`. The **number of installments and the credit card brand must be the same for all passengers**. Amounts must be applied to the per-passenger installment/remaining calculation. Example (2 ADT + 1 CHD, 4 installments, BRL 1123.18 each, first 447.87, remaining 675.31), `<AMA_TravelOrderPayRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderPayRQ_v1" version="1.008">`, `Order/OrderID` = `AA001LBF835A5`, `OwnerCode` = `AA`, with `OrderItemRefID` values:

- `P3D5675EC-AC24-426E-B1DBkgsje65j2vwe7-1-1_1APAX_T1` (ADT T1)
- `P3D5675EC-AC24-426E-B1DBkgsje65j2vwe7-1-1_1APAX_T2` (ADT T2)
- `P3D5675EC-AC24-426E-B1DBkgsje65j2vwe7-1-2_1APAX_T3` (CNN T3 — note the `-1-2` offer-item segment)

Note the `OrderItemRefID` pattern: `<order-item id>_1APAX_<PaxID>`.

---

## 4. Travel_OrderRetrieve

**Purpose:** retrieve an existing order. Request needs only the two order keys.

### Mandatory inputs

| Field path | Source of the value | Notes |
|---|---|---|
| `//AMA_TravelOrderRetrieveRQ/Party` | static | Not used but mandatory (truncated in source example). |
| `//Request/Order/OrderID` | OrderView `Order/OrderID` | e.g. `06X00ORDERID00`. |
| `//Request/Order/OwnerCode` | OrderView `Order/OwnerCode` | e.g. `6X`. |

### Request skeleton

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
    <Order>
      <OrderID>06X00ORDERID00</OrderID>
      <OwnerCode>6X</OwnerCode>
    </Order>
  </Request>
</AMA_TravelOrderRetrieveRQ>
```

### Response

`Travel_OrderView` returned in response to Travel_OrderRetrieve has **the same data details** as previously seen with OrderCreate and OrderPay — i.e. read `Order/OrderID`, `Order/OwnerCode`, `Order/BookingRef/BookingID`, `Order/OrderItem/...` prices, `Order/PaymentInfo` and `TicketDocInfos` from the same paths.

---

## ID chaining

| Value produced | Response path (source) | Consumed as (target request field) |
|---|---|---|
| ShoppingResponseID (shopping) | shopping RS `ShoppingResponseID` | `AMA_TravelOfferPriceRQ/Request/PricedOffer/SelectedOffer/ShoppingResponseRefID` (`Sh_ResponseID_000`) |
| OfferID (shopping) | shopping RS `Offer/OfferID` | `.../SelectedOffer/OfferRefID` (`Sh_ResponseID_000-1`) |
| OwnerCode (shopping) | shopping RS `Offer/OwnerCode` | `.../SelectedOffer/OwnerCode` (`6X`) |
| OfferItemID (shopping) | shopping RS `Offer/OfferItem/OfferItemID` | `.../SelectedOffer/SelectedOfferItem/OfferItemRefID` (`Sh_ResponseID_000-1-1/-2/-3`) |
| Pricing ResponseID | `AMA_TravelOfferPriceRS/Response/ShoppingResponse/ShoppingResponseID` | `AMA_TravelOrderCreateRQ/Request/CreateOrder/SelectedOffer/ShoppingResponseRefID` (`Pr_ResponseID_000`) |
| Pricing OfferID | `AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OfferID` | `.../CreateOrder/SelectedOffer/OfferID` (`Pr_ResponseID_000-1`) |
| Pricing OwnerCode | `AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OwnerCode` | `.../CreateOrder/SelectedOffer/OwnerCode` (`6X`) |
| Pricing OfferItemID | `AMA_TravelOfferPriceRS/Response/PricedOffer/Offer/OfferItem/OfferItemID` | `.../SelectedOffer/SelectedOfferItem/OfferItemID` (`Pr_ResponseID_000-1-1/-2/-3`) |
| IB installment PlanCode | `AMA_TravelOfferPriceRS/Response/Payments/PaymentInfo/PaymentMethod/PaymentCard/InstallmentPlanCatalogue/InstallmentPlan/PlanCode` | `AMA_TravelOrderPayRQ/Request/PaymentInfo/PaymentMethod/PaymentCard/InstallmentPlan/PlanCode` (`IBVI06`) |
| OrderID | `AMA_TravelOrderViewRS/Response/Order/OrderID` | `AMA_TravelOrderPayRQ/Request/Order/OrderID`; `AMA_TravelOrderRetrieveRQ/Request/Order/OrderID` |
| OwnerCode (order) | `AMA_TravelOrderViewRS/Response/Order/OwnerCode` | `AMA_TravelOrderPayRQ/Request/Order/OwnerCode`; `AMA_TravelOrderRetrieveRQ/Request/Order/OwnerCode` |
| Order total amount (integer) + Decimals metadata | `Order/OrderItem/Price/TotalAmount` (or `OrderItem/FareDetail/Price`) + `Metadata/Other/OtherMetadata/CurrencyMetadatas/CurrencyMetadata[@MetadataKey="${Currency}"]/Decimals` | `AMA_TravelOrderPayRQ/Request/PaymentInfo/Amount` **as decimal** (44126 + 2 → 441.26) |
| Order currency | `Order/.../@CurCode` | `AMA_TravelOrderPayRQ/Request/PaymentInfo/Amount/@CurCode` |
| Order item ID (AA installments) | OrderView order item ID | `AMA_TravelOrderPayRQ/Request/PaymentInfo/OrderItemRefID` (`<orderItemId>_1APAX_<PaxID>`) |
| PaxID (client-assigned, stable across all calls) | n/a | `PaxList/Pax/PaxID` and every `PaxRefID` in OfferPrice, OrderCreate, OrderPay |

---

## Gotchas

- `Party` is unused but **mandatory** on every `Travel_*` request; omitting it fails.
- Element names change between calls for the same value: OfferPrice uses `OfferRefID` / `OfferItemRefID`; OrderCreate uses `OfferID` / `OfferItemID`. `ShoppingResponseRefID` is used in both.
- `PaxRefID` cardinality differs: OfferPrice example uses one element with space-separated IDs (`T1 T2`); OrderCreate uses repeated `<PaxRefID>` elements. Follow each service's form.
- Infant association is expressed by putting the infant's `PaxID` in the **adult's** `PaxRefID` (`T1` → `T1.1`), and the infant is a full `Pax` entry with `PTC=INF`.
- Child PTC is `CNN`, not `CHD`, in these payloads.
- `offerItemID` granularity is carrier-dependent (Accelya: one per PTC; Altea NDC / AF / KL: one for all travelers) — do not hardcode the 3-item layout of the example.
- Amounts flip representation: OrderCreate/OrderPay **responses** return integers (`44126`, `248157`); Travel_OrderPay **request** needs the decimal value (`441.26`, `2481.57`). Always divide by 10^`Decimals` from the currency metadata.
- `TotalPrice` (Level 1) at both Offer and Order level is slated for deprecation — do not build on it. Level 2 excludes CC/OB fees (and, at Order level, surcharges are not displayed); Level 3 is fully normalized but does **not** sum — you must sum it yourself.
- Missing `GenderCode` / `Birthdate` at OrderCreate does not fail OrderCreate — it fails later at **Travel_OrderPay**.
- `LabelText` values `MOBILE` and `EMAIL` are required literal texts; they affect post-booking modification capability. Postal address labels: `R` residential, `D` delivery.
- Known Traveler Number (`VisaTypeCode=K`) and Redress number (`VisaTypeCode=R`) are **not forwarded to the airline** — Amadeus PNR only.
- `IdentityDocTypeCode` appears as both `PT` and `P` for passports across the source examples.
- The Amadeus PNR is a local copy, not the airline record; pick it out of `BookingRef` by `BookingEntity/Org/@OrgID = "1A"`. Expect ~3 `BookingRef` entries (airline, airline IT provider, Amadeus).
- Installments: Brazil-only at time of writing (Perú, Colombia, Chile, Uruguay planned for Q1). Iberia takes `PlanCode` from the OfferPrice catalogue; AA has **no catalogue** — seller computes `FirstInstallmentAmount` and `RemainingAmount`, and for testing `PlanCode` must be `AA05`. One `PaymentInfo` per passenger, same installment count and card brand for all.
- Source XML for OrderCreate's `PaxList` omits the opening `<Pax>` tag for `T1` (pandoc/DOCX artifact) — it is required; the skeleton above restores it. The source also mistypes the path as `//AMA_TravelOrederCreateRQ`.
