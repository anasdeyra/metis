# Queues, Synchronization, Errors, Coupon Statuses, Test Data & FAQ

> Source: WBS Implementation Guide NDC[X] v1.5, sections: Queues; Synchronization between Amadeus and Airline Records; Airline Error Messages; Coupon Status Codes; Test Credit Cards and Loyalty Numbers; Issue and solution (FAQ)

## Queues

When an airline notifies Amadeus of an involuntary change in the Order by sending an Order Change Notification (OCN), the Amadeus PNR is updated and queued in queues 0, 1 and 7, categories 256 to 259, depending on the use case.

Dedicated queue categories for NDC Order change notifications: `Q0C256`, `Q1C256/257/258/259/260/261`, `Q7C256/257/258`.

Queues must be created in your office ID queue bank with these cryptic entries:

- `QAC0C256`
- `QAC1C256-261`
- `QAC7C256-258`

Monitoring pattern: `Queue_List` to monitor the queues/categories above, then `Travel_OrderRetrieve` using the 1A record locator (see "Retrieving an order from an Amadeus PNR").

## Synchronization between Amadeus and Airline Records

Purpose: keep the TravelOrder PNR up to date for voluntary or involuntary changes happening in the airline order.

Reference: Amadeus Service Hub — https://servicehub.amadeus.com/c/portal/view-solution/751518744/new-distribution-capability-ndc-how-to-manage-the-synchronization-process-and-queues

### Synchronization using OCN as trigger

The Offer Responsible Airline (ORA) notifies Amadeus (as aggregator) about unsolicited and solicited changes done in the Order using the `OrderChangeNotif` (OCN) XML message. Synchronization of the record is initiated on reception of OCN.

How it works:

1. OCN received from airline triggers synchronization of the TravelOrder PNR.
2. Amadeus compares the TravelOrder PNR against the airline Order to detect de-synchronizations — not limited to the change the airline notified about. Scope of the de-synchro check is limited to the supported use cases below.
3. The record is updated for all de-synchros detected.
4. The updated PNR is queued into a dedicated queue/category per use case, to notify the travel agent.

### Supported use cases (OCN-triggered)

| Use case | PNR effect | Queue |
|---|---|---|
| Flight Time Change | Flight segment time updated, status changed to `TK` | Q7C257 |
| Involuntary flight schedule change | Cancelled segment status updated to `UN`; new flight segment added with `TK` | Q7C257 |
| Involuntary schedule cancellation | Cancelled segment status updated to `UN` | Q7C257 |
| Voluntary exchange/cancellation | Few airlines notify this case, and the reason of change is not clearly communicated; therefore synchronized like involuntary: cancelled segment `UN`, newly added segment `TK` | Q7C257 |
| Cancellation due to Payment Time Limit expiry | Few airlines notify; reason not clearly stated in OCN; therefore synchronized like involuntary cancellation: cancelled segment `UN` | Q7C257 |
| Ancillary Services (incl. seat) status change | Status updated when changed waitlisted/pending → confirmed; pending → waitlisted; pending/waitlisted/confirmed → cancelled. Supported status codes: `HK`, `HD`, `HI`, `KK`, `KD`, `HN`, `UN` | Q1C257 |
| Ancillary Services (incl. seat) addition/update/cancellation | Cancelled ancillary services status updated to `UN`; newly added or updated service status `KK` | Q1C257 |

### No Show synchronization

A no-show on one of the itinerary legs of an NDC booking triggers a provider notification. TravelOrder PNR synchronization:

- When the airline cancels the downline itinerary segments:
  - Status of cancelled segments changes to `HX`. Associated ancillaries and tickets are also cancelled.
  - A warning message is added in the PNR to inform about the reason for cancellation.
  - PNR is queued in Q1C261.
- When the airline does NOT cancel the downline itinerary segments (as requested by traveler):
  - No change to the flight booking in the TravelOrder PNR.
  - PNR is queued in Q1C261.
- Out of scope: if a PNR contains multiple passengers and only one (or fewer pax) doesn't show up, the TravelOrder PNR will NOT be synchronized — only a generic warning message is sent.

### Synchronization during retrieval

Most airlines notify about unsolicited changes only, which prevents the record from being updated for other changes in the Order. Synchronization triggered at retrieval keeps the record up to date for all kinds of changes supported by the Amadeus Travel Platform (including ones not supported by airlines).

A PNR containing an NDC booking can be pushed to any queue/category depending on the use case below. **These categories must be created prior to going live in production.**

### Queuing matrix (default behavior: same queue as EDIFACT, with a new category)

| Scenario | When PNR synchro is successful | When PNR synchro is failed |
|---|---|---|
| Involuntary Flight time change | Q7C257 | Q7C257 |
| Involuntary schedule change | Q7C257 | Q7C256 |
| Involuntary cancellation | Q7C257 | Q7C258 |
| When payment time limit is reached | FLX: Q1 C256 (segment remains active in PNR — no synchro); AlteaNDC: Q1 C256 & Q7C257 (segment status updated to `UN`); AF/KL: Q1C256 (segment removed from PNR) | Q7C0 |
| Voluntary change/cancellation on airline side | AlteaNDC: Q7 C257 (limitation: segment status updated as `UN`) | Q7C0 |
| Voluntary Change when notified with dedicated notification | AF/KL: Q1 C259 | Q1 C259 |
| Services and Seat Status / Chargeable Ancillary–Seat synchro (addition/deletion/update) | Q1C257 | Q0C256 |
| When TK element is added, EMD associated to ancillaries | Q8 256 | NA |
| No Show | Q1C261 (airline cancels segments = `HX`; airline does not cancel = no change) | NA |

## Airline Error Messages

### Error message enhancement in Master Pricer response

Gives travel sellers a better understanding of why no NDC offers are received from an airline. Enhanced information is given in the airlines' error messages and Amadeus internal errors in the Master Pricer Travel Board response.

Structure — errors are carried in repeated `<warningInfo>` nodes of `Fare_MasterPricerTravelBoardSearchReply` (namespace `http://xml.amadeus.com/FMPTBR_23_1_1A`):

```xml
<Fare_MasterPricerTravelBoardSearchReply xmlns="http://xml.amadeus.com/FMPTBR_23_1_1A">
  .....
  </recommendation>
  <warningInfo>
    <globalMessageMarker></globalMessageMarker>
    <applicationErrorDetail>
      <error>500</error>
      <codeListQualifier>EC</codeListQualifier>
      <agency>6X</agency>
      <priceType>N</priceType>
    </applicationErrorDetail>
    <globalMessage>
      <description>No offer for requested itinerary</description>
    </globalMessage>
  </warningInfo>
  <warningInfo>
    <globalMessageMarker></globalMessageMarker>
    <applicationErrorDetail>
      <error>9002</error>
      <codeListQualifier>WEC</codeListQualifier>
      <agency>1A</agency>
      <priceType>N</priceType>
    </applicationErrorDetail>
    <globalMessage>
      <description>Time out for 6X</description>
    </globalMessage>
  </warningInfo>
  ......
</Fare_MasterPricerTravelBoardSearchReply>
```

Field legend:

| Element | Meaning |
|---|---|
| `error` | Error code |
| `codeListQualifier` | Error or warning indicator: `WEC` for a warning, `EC` for an error |
| `agency` | Owner of the message: `1A` for Amadeus, `6X` dummy airline (for example) |
| `priceType` | Content type impacted: `N` for NDC |

List of error messages when no offers for an airline are returned in the Master Pricer Travel Board reply:

| Message string | Cause | Action |
|---|---|---|
| `Time out for airline xx` | Airline xx does not reply in time | Retry / do not treat as no availability |
| `Max capacity reached for airline xx` | The maximum capacity is reached with airline xx | Retry later; capacity is contractual with airline |
| The error message returned by airline xx | Functional or technical error message returned by the airline | Decode and surface the airline text (owner code = airline) |
| `No NDC offer kept from airline xx` | All offers returned by the airline are discarded because, for example, they do not match the search criteria or are too expensive compared to other recommendations (EDIFACT or NDC from other carriers) | Informational; offers intentionally filtered out |
| `No NDC offer due to internal process error` | Airline returns offers but the Amadeus internal process encounters problems resulting in no NDC offers returnable to travel sellers | Amadeus-side issue; report/retry |
| `No offer for requested itinerary` | Example message accompanying error `500` / qualifier `EC` / owner `6X` / priceType `N` | Informational |

### Travel Order View Response

Airline error messages are displayed in `Travel_OrderViewRS` in a dedicated error node, identifiable by the **owner code of the airline**. The error code and Amadeus error message are still displayed in a dedicated error node identified with owner code `1A`. Customers building their own UI/front-end may need to decode the new error node to display the airline error messages.

## Coupon Status Codes

Reference (latest code updates and additional statuses such as Involuntary statuses): https://servicehub.amadeus.com/c/portal/view-solution/879101/en_US/amadeus-electronic-ticketing-e-ticket-coupon-status-code

Existing e-ticket statuses:

| Coupon status | Description |
|---|---|
| A | Airport control |
| C | Checked in |
| E | Exchanged/Reissued |
| F | Flown/Used **(a)** |
| G | Converted to FIM **(g)** |
| I | Irregular operations **(a)** |
| L | Lifted/Boarded **(a)** |
| N | Notified |
| O | Open for use **(i)** |
| P | Printed **(c)** |
| R | Refunded **(c)** |
| S | Suspended **(a)** |
| T | Paper Ticket **(c)** |
| U | Unavailable **(d)** |
| V | Void **(c)** |
| Y | Refund Taxes/Fees/Charges only **(e)** |
| X | Print Exchange **(a)** |
| Z | Closed **(f)** |
| 1 | Ground Transportation Voucher |

(The parenthesised letters are footnote markers present in the source table; the footnote text is not reproduced in this section of the guide.)

## Test Credit Cards and Loyalty Numbers

List of credit cards and loyalty numbers usable in the **test environment**. Card columns in the source are: type, card number, expiry (MMYY), CVV. Loyalty holder name given as `SURNAME / NAME`.

| Carrier | Loyalty number | Loyalty holder name | Loyalty status | Card type | Card number | Expiry | Notes |
|---|---|---|---|---|---|---|---|
| AA | 208TFK6 | TESTFENIX / REGULAR | EXECUTIVE PLATINUM EMERALD | CA | 5577810000000004 | 0139 | CVV 123 |
| AA | 208TFK6 | TESTFENIX / REGULAR | EXECUTIVE PLATINUM EMERALD | VI | 4434260000000008 | 0139 | CVV 123 |
| AC | 570482083 | CANADIAN / ELITEFPON | 50K | CA | 2222400010000008 | 0330 | CVV 737 |
| AC | 570482083 | CANADIAN / ELITEFPON | 50K | VI | 4988438843884305 | 0330 | CVV 737 |
| AF | 1161179680 | GOLD / EASTER MRS | ELITE | CA | 2222410700000002 | 0330 | CVV 737 |
| AF | 1161179680 | GOLD / EASTER MRS | ELITE | VI | 4000020000000000 | 0330 | CVV 000 |
| AV | 81625789000 | CONTENIDO / FATIMA | DIAMOND | CA | 5500000000000004 | 0325 | CVV 159. The user should enter an approval code (manual approval codes from the bank) |
| AV | 81625789000 | CONTENIDO / FATIMA | DIAMOND | VI | 4513076106055348 | 0325 | CVV 159. The user should enter an approval code (manual approval codes from the bank) |
| AY | 686779067 | TESTER / APP MR | (none given) | CA | 2222410700000002 | 0330 | CVV 123 |
| AY | 686779067 | TESTER / APP MR | (none given) | VI | 4000000000000002 | 0330 | CVV 000. OB Fees Information: https://www.finnair.com/en/info/payment-methods/payment-method-processing-fees |
| BA | 45764815 | BACKSTROM / ECHO MR | EMERALD | VI (cc fee) | 4273000000005803 | 0330 | CVV 123 |
| BA | 45764815 | BACKSTROM / ECHO MR | EMERALD | VI (no cc fee) | 4263930000007395 | 0330 | CVV 123. OB Fees Information: https://ndc.ba.com/faq/commercial/payments/Can%20an%20agent%20redeem%20a%20voucher%20issued%20to%20a%20passenger%20on%20BA.com%20via%20NDC |
| BR | 3323294144 | (none given) | DIAMOND | CA | 5200000000000007 | 0127 | CVV 100 |
| BR | 3323294144 | (none given) | DIAMOND | VI | 4456530000000007 | 0127 | CVV 100 |
| EY | 520000123580 | MOHANTY / RISHAV | ETIHAD GUEST EXCLUSIVE | CA | 2223000000000007 | 0139 | CVV 100 |
| EY | 520000123580 | MOHANTY / RISHAV | ETIHAD GUEST EXCLUSIVE | VI | 4012000033330026 | 0139 | CVV 100 |
| IB | 28033504 | FERNANDEZ MARTINEZ / FERNANDO MR | (none given) | VI | 4263930000007395 | 0330 | CVV 123 |
| IB | 28033504 | FERNANDEZ MARTINEZ / FERNANDO MR | (none given) | VI | 4507990000004905 | 0326 | CVV 123 — Argentina |
| IB | 28033504 | FERNANDEZ MARTINEZ / FERNANDO MR | (none given) | VI | 4988438843884305 | 0330 | CVV 737 — Mexico |
| IB | 28033504 | FERNANDEZ MARTINEZ / FERNANDO MR | (none given) | VI | 4507990000004905 | 0326 | CVV 123 — Brazil |
| IB | 28033504 | FERNANDEZ MARTINEZ / FERNANDO MR | (none given) | VI (OB fee) | 4273000000005803 | 0330 | CVV 123 |
| LH | 222012064590497 | NELKE / BERND | SENATOR | CA | 5123450000000008 | 0139 | CVV 000 |
| LH | 222012064590497 | NELKE / BERND | SENATOR | AX | 345678000000007 | 0139 | CID 4111. OB Fees Information: https://www.lufthansa.com/ge/en/opc |
| LO | 222012797259832 | WARSAW / TEST MRS | SENATOR | VI | 4646464646464644 | 0330 | CVV 737 |
| LO | 222012797259832 | WARSAW / TEST MRS | SENATOR | AX | 370000000100018 | 0330 | CID 7373 |
| MH | 311397542 | PLAT P / ENRICH | Platinum (PLAT) | CA | 5239380090095108 | 0139 | CVV 069 |
| MH | 311397542 | PLAT P / ENRICH | Platinum (PLAT) | VI | 4553889000171206 | 0139 | CVV 793 |
| QF | 1900007004 | LOYTEST / SEVENHUNDRED MRS | Platinum One (Emerald) | CA | 5577810000000004 | 0139 | CVV 123 |
| QF | 1900007004 | LOYTEST / SEVENHUNDRED MRS | Platinum One (Emerald) | VI | 4434260000000008 | 0139 | CVV 456. OB Fees Information: AU / NZ markets only |
| QR | 100095908 | SIX / CODESHARE | Platinum | CASH | NON-BSP MARKET | — | Cash payment, non-BSP market |
| QR | 100095908 | SIX / CODESHARE | Platinum | CA | 5123450000000008 | 0139 | CVV 123 |
| QR | 100095908 | SIX / CODESHARE | Platinum | VI | 4012888888881881 | 0139 | CVV 123. OB Fees Information: Australia, New Zealand, Netherlands, Belgium, France, Cyprus, Czech Republic, Hungary, Poland and Spain |
| SK | EBD544309230 | DIAMOND / ROSE | Diamond | CA | 5200000000000007 | 1030 | CVV 737 |
| SK | EBD544309230 | DIAMOND / ROSE | Diamond | VI (no OB fee) | 4000000000000002 | 0330 | CVV 123 |
| SK | EBD544309230 | DIAMOND / ROSE | Diamond | VI (with OB fee) "YR Fee" | 4001590000000001 | 0330 | CVV 123 |
| SQ | 8987005605 | TESTINGS / LEE MS | (none given) | CA | 5123450000000008 | 0139 | CVV 123 |
| SQ | 8987005605 | TESTINGS / LEE MS | (none given) | JCB | 3545350099995560 | 0139 | CVV 123. OB Fees Information: applies only Australia, Belgium, Netherlands, New Zealand and the United Kingdom |
| TU | 123458888 | GOLD /NDC | GOLD | CA | 5555555555554444 | 03/30 | CVV 737 (expiry printed as `03/30` in source) |
| TU | 123458888 | GOLD /NDC | GOLD | VI | 4005550000000001 | 0330 | CVV 000 |
| UA | CE953661 | TEST / NDCGOLD | Gold MileagePlus member US POS | AX | 371307196801005 | 0139 | CID 0000. Entitlements: $0.00 Economy Plus for traveler plus one companion, should not receive Economy Plus, paid baggage, Premier Access, Priority Boarding Offers |
| VY | 3081470009182222 | GALLARDO / EDUARDO | Vueling Club with Avios | CA | 2222400070000005 | 0330 | CVV 737. Contact email in source: Eduardo.gallardo@col.vueling.com |
| VY | 3081470009182222 | GALLARDO / EDUARDO | Vueling Club with Avios | VI | 4035501000000008 | 0330 | CVV 737 |

Card type codes used: `CA` = Mastercard, `VI` = Visa, `AX` = American Express, `JCB` = JCB, `CASH` = cash form of payment.

## Issue and solution (FAQ)

### Duplicate Names

- Symptom: booking rejected at OrderCreate for duplicate names.
- Cause: duplicate names are blocked at `OrderCreate`.
- Fix: add a title, or concatenate a middle initial with the first name.

### Secure Flight Data Needed error returned at Travel_OrderPay response

- Symptom: "Secure Flight Data Needed" error in the `Travel_OrderPay` response.
- Cause: missing TSA information (gender and date of birth).
- Fix: supply gender and DOB in `Travel_OrderCreate` (see section 5.1.3.5 Travel_OrderCreate RQ).
- (screenshot in source: Travel_OrderPay response showing the Secure Flight Data Needed error node.)

### Middle Name

- Symptom: middle name supplied in the dedicated middle-name field disappears.
- Cause: the separate middle name field is not mapped today — Amadeus ignores it.
- Fix: concatenate the middle name into the `GivenName` field; it is forwarded as such, with no additional logic on the Amadeus side.

### Ticket Limit is Reached at Travel_OrderPay

- Symptom: ticket limit reached error at `Travel_OrderPay`.
- Cause: the ticket (limit) is managed directly between the travel seller and the airline.
- Fix: the travel seller should contact their airline account manager.

### Retrieve a cancelled order is not possible

- Symptom: cannot retrieve an order after cancellation.
- Cause: retrieval of a cancelled order is not supported.
- Fix: use `PNR_Retrieve` — it is the only retrieval possible after the order has been cancelled.

### Name length

Restriction inherited from the Amadeus PNR limit. Maximum allowed length of the name field is **59**, but that includes all other characters composing the corresponding cryptic command: slashes, parenthesis, date of birth and PTC. It does not matter how characters are distributed between first name and surname, or between adult and infant — only the total number is relevant, so the customer can decide to truncate in any way.

- The name element entry length must not exceed **59 characters**, including: transaction code, number in party, last name, first name (or initial, can also include title), Structured title, passenger type code(s), Date Of Birth, Age, passenger age, Identification code (ID or CR), and separators `/ , ( )`.
- When entering multiple passengers with the same last name in one single entry, the entry length including transaction code, number in party, one last name — and for each passenger: first name (or initial, can also include title), Structured title, passenger type code(s), Date Of Birth, Age, passenger age, identification code (ID or CR), and separators `/ , ( )` — must not exceed **62 characters**.

Summary (excluding transaction code and number in party):

- If the number in party is on 1 digit, the whole name(s) length in the input must not exceed **59 characters**.
- If the number in party is on 2 digits, the whole name(s) length in the input must not exceed **58 characters**.

Note: space, parenthesis, comma and slash are counted in the name length calculation.

**Name length optimization** feature: allows an additional **8 characters** when the gender code is present, because it removes the need to include the date of birth in the name string (`/ddmmmyy`). Best practice: always include the gender code in the `Travel_OrderCreate` request to maximize allowable name length. If a title is included (e.g. Mr., Mrs.), it counts toward the total name length regardless of whether the gender code is present. Customers should evaluate whether to consistently include the gender code to optimize name length, even when `SecureFlightInd = true`.

### Soap: fault Server 18 Application

- Symptom:

```xml
<soap:Body>
  <soap:Fault>
    <faultcode>soap:Server</faultcode>
    <faultstring>18|Application|</faultstring>
  </soap:Fault>
</soap:Body>
```

- Cause: likely a namespace problem.
- Fix: the namespace needs to be explicitly provided on the request root element, e.g.

```xml
<AMA_TravelSeatAvailabilityRQ xmlns="http://xml.amadeus.com/2010/06/Travel_SeatAvailabilityRQ_v1">
  ...truncated
</AMA_TravelSeatAvailabilityRQ>
```

In the examples throughout the guide the namespace is never provided, for the sake of readability.

### Travel Agency section

- Symptom/question: what to put in the `TravelAgency` section.
- Cause: the section is present but is not used. The Travel Agency is identified within Amadeus thanks to their OID and LSS. When Amadeus forwards the message to the provider on behalf of the TA, the values are properly filled by Amadeus. It cannot be overridden.
- Fix: leave it unused:

```xml
<TravelAgency>
  <AgencyID>unused</AgencyID>
  <PseudoCityID>unused</PseudoCityID>
</TravelAgency>
```

### Amount as integer vs amount as integer with decimalPlace

- In the response for each call, the amounts are returned as an **integer**.
- When the payment is sent via `Travel_OrderPay`, the **decimal is mandatory** (if applicable).
- The source shows an example of a response received as an integer, and an example of `Travel_OrderPay` with the decimal place.

## Gotchas

- Queue categories are NOT auto-created: `QAC0C256`, `QAC1C256-261`, `QAC7C258` etc. must exist in the office ID queue bank **before going live in production**, otherwise synchronization notifications are lost.
- Failed-synchro queuing differs from successful-synchro queuing: involuntary schedule change fails to Q7C256, involuntary cancellation fails to Q7C258, while flight time change goes to Q7C257 in both cases. Do not assume one category per scenario.
- Payment-time-limit behavior is provider-specific: FLX keeps the segment active with no synchro (Q1C256), AlteaNDC sets it to `UN` (Q1C256 + Q7C257), AF/KL removes the segment from the PNR (Q1C256).
- Voluntary changes made on the airline side are synchronized as if involuntary (segment status `UN`, new segment `TK`) because most OCNs do not clearly convey the reason — do not infer voluntariness from the resulting PNR statuses.
- No-show synchro only works when all passengers no-show; partial no-show in a multi-pax PNR yields only a generic warning and an unsynchronized PNR.
- A `Fare_MasterPricerTravelBoardSearchReply` with no NDC offers is not necessarily "no availability" — inspect every `warningInfo/applicationErrorDetail` where `priceType = N`, and check `agency` to tell an Amadeus (`1A`) error from an airline error.
- `codeListQualifier` distinguishes warning (`WEC`) from error (`EC`); a `WEC` such as `9002` "Time out for 6X" is retryable.
- Airline error messages in `Travel_OrderViewRS` sit in a separate error node keyed by the airline owner code — a UI that only reads the `1A` node will silently drop the airline's actual reason.
- All the credit cards, loyalty numbers and expiries above are TEST-environment only. Several expiries are already in the past relative to 2026 (e.g. BR `0127`, AV `0325`, AA/LH/QF/QR/SQ/UA/EY `0139` is Jan 2039 but `0127` is Jan 2027) — check validity before assuming a decline is a code bug.
- AV requires a manual approval code from the bank to be entered by the user; QR supports a `CASH` form of payment for non-BSP markets.
- TU's Mastercard expiry is written `03/30` in the source (all others are unseparated `MMYY`); send it in the format your schema requires (`0330`).
- IB has market-specific Visa numbers (Argentina/Brazil `4507990000004905`, Mexico `4988438843884305`) plus a separate OB-fee card `4273000000005803`; picking the wrong one changes fee behavior. Note `4263930000007395` and `4273000000005803` are shared with BA (no-fee vs fee card).
- The middle-name field is silently dropped — concatenating into `GivenName` is the only working option, and it consumes the 59-character name budget.
- Including the gender code buys 8 extra name characters (no `/ddmmmyy` needed); a title always costs characters. Number in party on 2 digits costs 1 character (58 max).
- `soap:Fault` `18|Application|` is usually a missing XML namespace, not an application/business error — the guide's examples omit namespaces for readability, so copy-pasting them fails.
- Response amounts are integers but `Travel_OrderPay` requires the decimal place; naively echoing the response amount into the payment will send the wrong value.
- A cancelled order cannot be retrieved with `Travel_OrderRetrieve`; only `PNR_Retrieve` works afterwards.
