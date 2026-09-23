# NDC[X] Post-Booking Modifications, Retain/Reuse Credit and Split PNR

> Source: WBS Implementation Guide NDC[X] Ancillaries, Seats and Servicing v1.2, sections: Features (Payment with Cash; 3DS Offline CC payment; 3DS CC payment; Support Fraud Checks for CC payment (BA, IB, AC only); Manual Approval Code; Implicit FOP (Use the FOP from PNR); Retrieving an order with Travel_OrderRetrieve), Deferred Payment vs Instant Payment, Post Booking Modifications (Update Passenger Contact Information; Update Frequent Flyer Number), Retain Credit, Reuse Credit, Split PNR

---

## Payment features: deltas vs the Prime Booking guide

Full specs for these features live in `06-payment-and-features.md` (from WBS Implementation Guide NDC[X] v1.5) and `07-order-retrieve-and-pnr.md`. Only differences found in the **Ancillaries, Seats and Servicing v1.2** guide are listed here.

| Feature | v1.2 (this guide) | v1.5 Prime Booking guide | Action |
|---|---|---|---|
| **Payment with Cash** | Adds constraint: **"This method of payment is allowed for Voluntary Exchanges only."** `TypeCode` = `CA`, `PaymentMethod/Cash/CashInd` = `true`, `Amount CurCode="EUR"` = `441.26` — identical snippet. Service shown: `AMA_TravelOrderPayRQ`. | Same snippet, **no voluntary-exchange-only restriction stated**. | **Discrepancy — flag.** In a servicing/exchange context assume cash is exchange-only; do not offer cash as FOP for a plain new-order pay flow without checking. |
| **3DS Offline CC payment** | Identical text: agencies exempted from 3DS authentication via webservices include **`MO`** (mail order); **`MO` is the only value that can be used**. | Same, plus notes `MO` belongs to the `PaymentTrxChannelCode` value set. | Use v1.5 for the field name. |
| **3DS CC payment** | Handled via **Travel_OrderPay _or_ Travel_OrderChange** using the **Auth Data** details. Responsible party is stated as **"The bank card issuer handling the 3DS"**. | Service listed as **Travel_OrderPay**; responsible party stated as **"The payment provider handling the 3DS"**. Also carries the full 3DS field table (`PaymentTrxChannelCode`, `AuthenticationTokenValue`, `ElectronicCoomcerceIndText`, base64 rules for ANDC carriers, etc.). | **Two discrepancies — flag.** (a) v1.2 explicitly allows 3DS auth data on **Travel_OrderChange** (needed for instant payment / post-booking ancillaries); (b) "bank card issuer" vs "payment provider" as the source of the 3DS details. Field-level detail: use v1.5. |
| **Fraud checks for CC payment** | Carriers: **BA, IB, AC only.** Warning returned in the Travel Order View response; two message variants: `"For credit card payment enter card holder name, address and email"` and `"For credit card payment enter card holder name and address"`. Fraud data entered in **Travel_OrderPay or Travel_OrderChange** when requested by the airline. **Data is not stored in the PNR**; storage to be defined in **phase 2**. | Carriers: **BA, IB, AC, 6E, VY only**, plus per-carrier rules (**6E** = name + address; **VY** = name only). Same warning strings, same non-persistence note. | **Discrepancy — flag.** v1.2 omits **6E** and **VY**. Treat the v1.5 list (BA, IB, AC, 6E, VY) as the superset; always re-verify against the *Features per carrier* spreadsheet. |
| **Manual Approval Code** | Identical: some carriers require a manual approval code for payment of an NDC order **in some markets**; TA must run an **offline process** to obtain the code. | Identical. | No delta. |
| **Implicit FOP (use FOP from PNR)** | Shown as valid on **`AMA_TravelOrderPayRQ` _or_ `AMA_TravelOrderChangeRQ`**. `TypeCode` = `FROM_PNR`; `PaymentMethod/OtherPaymentMethod/Remark/RemarkText` = `15` = **tattoo of the FP element** in the record. Sample `Amount CurCode="EUR"` = `123`. | Documented for **Travel_OrderPay** only; same codes and same tattoo semantics. | **Delta — flag.** Implicit FOP is also usable on **Travel_OrderChange** (relevant for instant payment of post-booking ancillaries/seats). |
| **Travel_OrderRetrieve** | Byte-identical to v1.5: by OrderID (`Request/Order/OrderID` = `06X00ORDERID00`, `OwnerCode` = `6X`) or by Amadeus PNR (`Request/OrderFilterCriteria/BookingRefFilterCriteria/BookingID` = `1A_PNR`, `BookingEntity/Org/OrgID` = `1A`). | Same. | No delta. See `07-order-retrieve-and-pnr.md`. |

Implicit FOP on a change (unique to this guide):

```xml
<AMA_TravelOrderChangeRQ>
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
</AMA_TravelOrderChangeRQ>
```

---

## Deferred Payment vs Instant Payment

Two distinct payment models. Choosing wrongly means either an unpaid order item or a rejected `PaymentInfo` block.

**Deferred payment** — booking and issuance handled in **2 steps**:
1. `Travel_OrderCreate` and/or `Travel_OrderChange` (no payment data).
2. `Travel_OrderPay` to submit the payment.

**Instant payment** — payment for the airfare has **already been completed**; the customer is adding additional services (chargeable bags, chargeable seats). The additional services **and** the CC payment are sent together in **one `Travel_OrderChange` request**.

The same applies to **exchanges with an additional collection**: payment details are submitted **with the exchanged offers** (i.e. in the same `Travel_OrderChange`).

(diagram in source: flow diagram of payment method — deferred path `Travel_OrderCreate`/`Travel_OrderChange` → `Travel_OrderPay`, versus instant path with services + payment inside a single `Travel_OrderChange`.)

Implications for integration code:
- Instant payment ⇒ `PaymentInfo` is a sibling of `ChangeOrder` inside `AMA_TravelOrderChangeRQ/Request`; no follow-up `Travel_OrderPay`.
- Deferred payment ⇒ `Travel_OrderChange` returns an unpaid order item; the pay call must reference `Request/Order/OrderID` + `OwnerCode`.
- 3DS auth data, fraud-check data and `FROM_PNR` implicit FOP are all usable in the instant-payment `Travel_OrderChange` (see delta table).

---

## Post Booking Modifications

Both post-booking modifications below use the **same 2-call pattern**:

```
Travel_OrderReshop  (describe the new pax data)  →  returns ReshopOffer/OfferID (+ OwnerCode)
Travel_OrderChange  (accept that OfferID)        →  returns AMA_TravelOrderViewRS with updated data
```

The reshop **does not** persist anything; only the subsequent `Travel_OrderChange` commits the change. No stateful Amadeus session is required — the order is addressed by `OrderItemRefID` / `OrderID` + carrier code.

Reshop request skeleton common to both (values from the source samples):

- `AMA_TravelOrderReshopRQ/Request/OrderItemRefID` — the order item to modify (e.g. `6X081HGUHKWA3`, `6X001HKKEO4A2`).
- `AMA_TravelOrderReshopRQ/Request/BookingRef/BookingID` — sent **empty** (`<BookingID/>`).
- `AMA_TravelOrderReshopRQ/Request/BookingRef/BookingEntity/Carrier/AirlineDesigCode` — `6X`.
- `AMA_TravelOrderReshopRQ/Request/UpdateOrder/ReshopOrder/UpdatePax/New/...` — the **new** passenger payload.
- Namespace: `xmlns="http://xml.amadeus.com/2010/06/Travel_OrderReshopRQ_v1"` (the RS reuses this namespace as default and binds `xmlns:ns2="http://xml.amadeus.com/2010/06/Travel_OrderReshopRS_v1"`).
- Change namespace: `xmlns="http://xml.amadeus.com/2010/06/Travel_OrderChangeRQ_v1"`.
- `Party/Sender/TravelAgency/AgencyID` + `PseudoCityID` may be sent as literal `unused` / `UNUSED`, or as real values (`27212216` / `AE9L`).

---

### Update Passenger Contact Information

**Purpose:** update contact information (email and/or phone) after an Order is booked.

**Rules / prerequisites:**
- At least **one contact element must be present** in the `Travel_OrderReshop` request and **linked to a passenger present in the query**.
- **Not to an infant** — contact information received for an infant is **ignored**.
- The contact can be **either an email or a phone number — one of these is mandatory**.
- The passenger must have **allowed the contact to be shared with the airline**, i.e. **`ContactRefusedInd ≠ FALSE`** (as written in source).
- Carrier support: check the **Features per carrier** spreadsheet.

**Call 1 — Travel_OrderReshop:**

```xml
<AMA_TravelOrderReshopRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderReshopRQ_v1">
  <!-- Party ... -->
  <Request>
    <OrderItemRefID>6X081HGUHKWA3</OrderItemRefID>
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
        <UpdatePax>
          <New>
            <PaxID>T1</PaxID>
            <PTC>ADT</PTC>
            <Individual>
              <GivenName>Jean</GivenName>
              <Surname>DUPONT</Surname>
            </Individual>
            <ContactInfo>
              <EmailAddress>
                <EmailAddressText>jean.dupontNEW@email.com</EmailAddressText>
              </EmailAddress>
              <Phone>
                <PhoneNumberText>336546743</PhoneNumberText>
              </Phone>
            </ContactInfo>
            <!-- ... -->
          </New>
        </UpdatePax>
      </ReshopOrder>
    </UpdateOrder>
  </Request>
</AMA_TravelOrderReshopRQ>
```

**Response to read:**
- `AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/OfferID` — e.g. `ERlp2shnDaTdmWRrav1C1z3D_1A__1A_1A_TPID_Eg1DaGFuZ2VQYXhJbmZv`
- `.../ReshopOffer/OwnerCode` — `6X`

**Call 2 — Travel_OrderChange** (reuses that OfferID; `Order/OrderID` + `OwnerCode` are also required):

```xml
<AMA_TravelOrderChangeRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderChangeRQ_v1">
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>unused</AgencyID>
        <PseudoCityID>unused</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <ChangeOrder>
      <UpdateOrderItem>
        <AcceptOffer>
          <SelectedOffer>
            <OfferID>ERlp2shnDaTdmWRrav1C1z3D_1A__1A_1A_TPID_Eg1DaGFuZ2VQYXhJbmZv</OfferID>
            <OwnerCode>6X</OwnerCode>
          </SelectedOffer>
        </AcceptOffer>
      </UpdateOrderItem>
    </ChangeOrder>
    <Order>
      <OrderID>6X081HGUHKWA3</OrderID>
      <OwnerCode>6X</OwnerCode>
    </Order>
  </Request>
</AMA_TravelOrderChangeRQ>
```

**Response (`AMA_TravelOrderViewRS`) fields to read:**
- `Response/DataLists/ContactInfoList/ContactInfo/ContactInfoID` — e.g. `CI1`
- `.../ContactInfo/Phone/PhoneNumber` — `336546743` (note: RS element is **`PhoneNumber`**, while the reshop RQ uses **`PhoneNumberText`**)
- `.../ContactInfo/EmailAddress/EmailAddressText` — `JEAN.DUPONTNEW@EMAIL.COM` (returned **upper-cased**)
- `Response/Order/OrderID` = `6X081HGUHKWA3`, `Response/Order/OwnerCode` = `6X`

---

### Update Frequent Flyer Number

**Purpose:** **add, update, or delete** a Frequent Flyer number in an Order **after** the booking has been created.

**Rules / prerequisites:**
- **All passengers** must be present in the `Travel_OrderChange` request input — not only the passengers being changed.
- The request **should only contain the changes for the frequent flyer number**.
- **Combining other updates** (e.g. contact phone number and email) **in one request is not allowed.**
- **However**, if the **original order contains the phone number and e-mail address, this information is mandatory in the `Travel_OrderReshop` request.** If contact information is omitted from the reshop, `Travel_OrderChange` returns:
  `MULTIPLE UPDATES NOT SUPPORTED BY THE AIRLINE. PLEASE RETRY WITH A SINGLE UPDATE`
  (i.e. echo the *existing* contact data unchanged, and change only `LoyaltyProgramAccount`.)
- Carrier support: check the **Features per carrier** spreadsheet.

**Call 1 — Travel_OrderReshop:**

```xml
<AMA_TravelOrderReshopRQ xmlns="http://xml.amadeus.com/2010/06/Travel_OrderReshopRQ_v1">
  <Party>
    <Sender>
      <TravelAgency>
        <AgencyID>27212216</AgencyID>
        <PseudoCityID>AE9L</PseudoCityID>
      </TravelAgency>
    </Sender>
  </Party>
  <Request>
    <OrderItemRefID>6X001HKKEO4A2</OrderItemRefID>
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
        <UpdatePax>
          <New>
            <PaxID>T1</PaxID>
            <PTC>ADT</PTC>
            <Individual>
              <GivenName>ELIZABETH</GivenName>
              <Surname>NG</Surname>
            </Individual>
            <ContactInfo>
              <EmailAddress>
                <LabelText>Home</LabelText>
                <EmailAddressText>MYEMAIL@MYMAIL.COM</EmailAddressText>
              </EmailAddress>
              <Phone>
                <LabelText>mobile</LabelText>
                <PhoneNumberText>3054996000</PhoneNumberText>
              </Phone>
            </ContactInfo>
            <LoyaltyProgramAccount>
              <AccountNumber>28TCH98</AccountNumber>
              <Carrier>
                <AirlineDesigCode>6X</AirlineDesigCode>
              </Carrier>
            </LoyaltyProgramAccount>
          </New>
        </UpdatePax>
      </ReshopOrder>
    </UpdateOrder>
  </Request>
</AMA_TravelOrderReshopRQ>
```

**Reshop response:** `AMA_TravelOrderReshopRS/Response/ReshopResults/ReshopOffers/ReshopOffer/OfferID` = `ERWIitsVthSC6IH9xFJN3ztC_1A__1A_1A_TPID_Eg1DaGFuZ2VQYXhJbmZv`, `OwnerCode` = `6X`.

**Call 2 — Travel_OrderChange:** same shape as the contact-info change, with
`ChangeOrder/UpdateOrderItem/AcceptOffer/SelectedOffer/OfferID` = `ERWIitsVthSC6IH9xFJN3ztC_1A__1A_1A_TPID_Eg1DaGFuZ2VQYXhJbmZv`, `OwnerCode` = `6X`, and `Request/Order/OrderID` = `6X001HKKEO4A2`, `OwnerCode` = `6X`.

**Response (`AMA_TravelOrderViewRS`) fields to read:**
- `Response/DataLists/PaxList/Pax/Individual/GivenName` = `ELIZABETH`, `Surname` = `NG`
- `Response/DataLists/PaxList/Pax/LoyaltyProgramAccount/AccountNumber` = `28TCH98`
- `.../LoyaltyProgramAccount/Carrier/AirlineDesigCode` = `6X`, `.../Carrier/Name` = `Carrier Name`

Note the OfferID suffix `_TPID_Eg1DaGFuZ2VQYXhJbmZv` is shared by both pax-update use cases (base64 of a "ChangePaxInfo"-style token) — do not parse it, echo it verbatim.

---

## Retain Credit

**Purpose:** when a booking is **outside the void window** and the fare is **not fully refundable**, during the cancellation process it may be possible to **cancel the itinerary and keep the ticket open as a credit for future use**.

**Prerequisites:**
- The booking is **outside the void window** AND the fare is **not fully refundable** during the cancellation process.
- Carrier must support the functionality — see the **Features per carrier** spreadsheet.

**Behaviour to code around:**
- The **`Travel_OrderReshop` response returns a Reshop UseCase labeled `"Unknown"`. This use case can be ignored. It will be removed in the future.** Do not treat `Unknown` as an error or as an unsupported use case.
- The retained document is a **retained ticket**, identified downstream by its **retained ticket number** (see Reuse Credit).

(diagram in source: screenshot of the Retain Credit flow. The request/response XML examples for Retain Credit are embedded in the DOCX as `.emf` objects — `media/image27.emf` … `media/image32.emf` — and carry no extractable text; the exact field paths for the retain call are therefore not available from this conversion.)

---

## Reuse Credit

**Purpose:** reuse a **retained credit** to pay for a **new booking** (if the carrier supports the feature). **Retained NDC tickets or legacy EDIFACT tickets can be reused for NDC Orders.**

**How the credit is identified and carried forward:**
- The credit is identified by the **retained ticket number**.
- In the reuse-credit flow, while paying a new NDC Order, the user provides the **retained ticket information** to obtain an **exchanged offer** (reusing its credits) to compensate for the new booking. The agency then **confirms the exchange** for the new ticket.
- "If the agency chooses the 'reuse credit' flow, there will be a **field to provide the retained ticket number** and get the **balance amount to be paid** from the airline." → read the balance/residual collection from the exchanged offer returned by the airline and pay only that amount.

**Post-conditions:**
- The **Amadeus Travel Order PNR is updated to reflect the exchange**; corresponding **FA** and **FO** elements are added.
- A **BO A.I.R.** record corresponding to an exchange is also sent (back-office).

**Limitations (all verbatim constraints):**
- In the reuse credit workflow, the **seat must be added after the reuse of credit**.
- **Exchange of an order paid with a retained ticket is not possible.**
- **Multiple retained documents cannot be used for the same passenger on the same order.**
- Retained tickets can be **reused only by the same passenger** (airlines apply checks at their discretion based on passenger identity, credit expiration date, ...).
- If the original ticket has a **higher value than the new Order**, **airlines decide what happens to the leftover**.
- For **multipax Orders, all or none of the passengers** can request to reuse a credit (can depend on airline).

(The Reuse Credit request/response examples are embedded as `.emf` objects — `media/image33.emf` … `media/image43.emf` — so the exact element name/XPath of the "retained ticket number" input field is **not** recoverable from this conversion. Confirm against the Travel_OrderReshop / Travel_OrderPay schema before coding.)

---

## Split PNR

**Purpose:** enable travel sellers to perform a **partial exchange** or **partial cancellation** on an existing PNR by splitting a **multi-pax NDC Order** into multiple Orders/PNRs for different passengers. Also used to book one PNR/Order for all passengers and then split it — eliminating rework when the itinerary is the same, while **maintaining privacy for each passenger**.

**The split instruction (exact structure, with the source's own schema comments):**

```xml
<SplitOrder>
  <PaxToNewOrder>            <!-- Mandatory, repeatable up to 8 -->
    <PaxRefID>PAX1</PaxRefID> <!-- Id of the passenger to be split from the order - mandatory unique -->
  </PaxToNewOrder>
</SplitOrder>
```

- `PaxToNewOrder` — **mandatory**, **repeatable up to 8**.
- `PaxRefID` — **mandatory** and **unique**; the ID of the passenger to be split out of the order.

**Call sequence (as documented):**
1. Send the **`SplitOrder` / `PaxToNewOrder` / `PaxRefID`** instruction, listing each passenger to move to the new Order (up to 8 `PaxToNewOrder` occurrences).
2. The split produces separate Orders/PNRs — the split-out passenger(s) in a new Order.
3. Then act on the split Order: **cancel** it (partial cancellation), or
4. For **partial exchanges**: "the split pnr flow remains the same as described above **followed by the fare driven or schedule driven flow** (depending on which flow the carrier supports)."

**Documented example:** an order with **3 adults + 1 child**; the use case **splits one adult and cancels the order for that adult**.

The guide points to an external process-flow document titled **"Split PNR"** for the supported use cases.

(The Split PNR request/response examples are embedded as `.emf` objects — `media/image44.emf` … `media/image51.emf` — so the enclosing web service/message name for `SplitOrder` is not stated in extractable text in this range. `SplitOrder` sits in the order-change family; verify against the Travel_OrderChange / Travel_OrderSplit schema.)

---

## Gotchas

- **Fraud-check carrier list disagrees between guides:** this guide says **BA, IB, AC only**; the Prime Booking guide says **BA, IB, AC, 6E, VY**. Use the superset and the *Features per carrier* spreadsheet as the authority.
- **Cash is exchange-only here:** "allowed for Voluntary Exchanges only" appears only in this guide. Don't expose `TypeCode` `CA` for plain new-order payment in a servicing context without carrier confirmation.
- **3DS/implicit FOP also work on Travel_OrderChange**, not just Travel_OrderPay — this is what makes *instant payment* possible. The Prime Booking guide only documents Travel_OrderPay.
- **"Bank card issuer" vs "payment provider"** as the party supplying 3DS details: the two guides word this differently; the practical requirement is unchanged — the seller must pass all relevant 3DS data through the Travel Platform.
- **FF update: never combine updates.** Sending an FF change plus a contact change in one `Travel_OrderChange` yields `MULTIPLE UPDATES NOT SUPPORTED BY THE AIRLINE. PLEASE RETRY WITH A SINGLE UPDATE`. Yet if the order already holds phone + email, those **must be echoed unchanged** in the reshop — omitting them triggers the *same* error. Echo, don't modify.
- **FF update requires all passengers** in the Travel_OrderChange input, not just the changed one.
- **Infant contact data is silently ignored** on contact-info updates — no error is raised; the change just doesn't happen.
- **`ContactRefusedInd ≠ FALSE` is the gate** for sharing contact data with the airline (source's exact phrasing; note the double negative).
- **Element name asymmetry:** reshop RQ uses `Phone/PhoneNumberText`, the OrderView RS returns `Phone/PhoneNumber`. Email is returned **upper-cased** by the airline.
- **Retain Credit returns a Reshop UseCase `"Unknown"`** — ignore it; it is slated for removal. Don't fail validation on it.
- **Reuse Credit ordering trap:** seats must be added **after** the reuse of credit, and an order paid with a retained ticket **cannot be exchanged** afterwards — one-way door.
- **Reuse Credit residual value is airline-discretionary** when the retained ticket exceeds the new Order value; don't compute or promise a refund of the leftover.
- **`SplitOrder` caps at 8 `PaxToNewOrder`** occurrences and each `PaxRefID` must be unique.
- **Several XML samples in this source range are `.emf` embedded objects** (Retain Credit, Reuse Credit, Split PNR request/response pairs) and contain no extractable text — field-level details for those three features must be taken from the WSDL/XSD, not from this guide's text.
