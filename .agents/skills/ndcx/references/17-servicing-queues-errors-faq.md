# Queues, Sync, Errors, Coupon Statuses, Test Data & FAQ — Servicing guide deltas

> Source: WBS Implementation Guide NDC[X] Ancillaries, Seats and Servicing v1.2, sections: Queues; Synchronization between Amadeus and Airline Records; Airline Error Messages; Coupon Status Codes; Test Credit Cards and Loyalty Numbers; Issue and solution (FAQ)

This file is a DIFF against `09-queues-sync-errors-testdata.md` (Prime Booking guide v1.5). Anything not mentioned here is identical in both guides — use the sibling file as the base reference.

## Deltas vs the Prime Booking guide

### Queues

Identical to the Prime Booking guide: same OCN-triggered queueing (queues 0/1/7, categories 256-259), same dedicated categories `Q0C256`, `Q1C256/257/258/259/260/261`, `Q7C256/257/258`, same queue-bank creation entries `QAC0C256` / `QAC1C256-261` / `QAC7C256-258`, same `Queue_List` → `Travel_OrderRetrieve` (1A record locator) monitoring pattern. No servicing-specific queue behaviour is added: OrderChangeNotification, PTL-expiry and disruption queuing are described in exactly the same terms as in v1.5, with no extra categories, no ancillary/seat servicing-only queue, and no reference to servicing flows (`Travel_OrderChange`, EMD reissue) affecting queuing.

### Synchronization between Amadeus and Airline Records

Identical: same Service Hub link (`https://servicehub.amadeus.com/c/portal/view-solution/751518744/new-distribution-capability-ndc-how-to-manage-the-synchronization-process-and-queues`), same OCN-as-trigger description, same seven supported use cases with the same statuses (`TK`, `UN`, `KK`, and ancillary status set `HK, HD, HI, KK, KD, HN, UN`), same No Show synchronization rules (`HX`, Q1C261, partial-no-show out of scope), same "synchronization during retrieval" text and the same queuing matrix (including FLX / AlteaNDC / AF-KL payment-time-limit split, failure queues Q7C256 / Q7C258 / Q7C0 / Q0C256, `Q8 256` for TK+EMD).

### Airline Error Messages

**Content unique to this guide:** none — this guide's section is a strict subset.

**Missing here (present only in the Prime Booking guide):** the entire "Error message enhancement in Master Pricer response" subsection — the `Fare_MasterPricerTravelBoardSearchReply` (`http://xml.amadeus.com/FMPTBR_23_1_1A`) `warningInfo` / `applicationErrorDetail` structure, the `error` / `codeListQualifier` (`EC` vs `WEC`) / `agency` (`1A` vs airline) / `priceType` (`N`) legend, and the list of no-offer messages (`Time out for airline xx`, `Max capacity reached for airline xx`, `No NDC offer kept from airline xx`, `No NDC offer due to internal process error`, `No offer for requested itinerary`).

The "Travel Order View Response" paragraph is identical: airline error messages appear in `Travel_OrderViewRS` in a dedicated error node identified by the **airline owner code**; Amadeus error code/message stay in a node identified with owner code `1A`; custom front-ends must decode the new node.

### Coupon Status Codes

Identical — same Service Hub link (`https://servicehub.amadeus.com/c/portal/view-solution/879101/en_US/amadeus-electronic-ticketing-e-ticket-coupon-status-code`) and the same 19-row status table (A, C, E, F, G, I, L, N, O, P, R, S, T, U, V, Y, X, Z, 1) with the same descriptions and the same footnote markers.

### Test Credit Cards and Loyalty Numbers

Same purpose statement (test environment only) and same column layout (carrier, loyalty number + `SURNAME/NAME`, loyalty status, then card type / card number / expiry MMYY / CVV). Differences below are character-exact from v1.2.

Carriers present in v1.5 but **absent from v1.2**: `BR`, `TU`. No carrier is present in v1.2 and absent from v1.5.

Rows unique to v1.2:

| Carrier | Field | v1.2 value |
|---|---|---|
| LH | Second loyalty holder (extra) | `992221296706650` / `MUHLE / HANS` / status `FREQUENT TRAVELLER` (v1.5 lists only `222012064590497` / `NELKE / BERND` / `SENATOR`; v1.2 lists both, cards shared) |
| UA | Extra card | `VI` `4508750015741019` exp `0139` CVV `123` (v1.5 lists only the `AX` card) |
| IB | Card label | `VI - AR market` `4507990000004905` exp `0326` CVV `123` — the market is labelled explicitly in the table |

Contradictions:

| Carrier | Field | v1.2 (this guide) | v1.5 (Prime Booking) |
|---|---|---|---|
| AC | Loyalty number | `354395774` | `570482083` — **Discrepancy:** different AC loyalty number for the same holder `CANADIAN/ELITEFPON` / `50K`. |
| AC | Visa card | `4330280595759276` exp `0525` CVV `000` | `4988438843884305` exp `0330` CVV `737` — **Discrepancy:** entirely different Visa, expiry and CVV. |
| AY | Visa card | `4579720504949062` exp `0330` CVV `000` | `4000000000000002` exp `0330` CVV `000` — **Discrepancy:** different Visa number. |
| SQ | Loyalty number / holder / status | `8987009665` / `TESTING/EIGHT MISS` / `TPPS` | `8987005605` / `TESTINGS / LEE MS` / no status — **Discrepancy:** different loyalty number, holder name and status. |
| AF | Loyalty status / holder | status `AFKL-ELITE`, holder `MRS GOLD/EASTER MRS` | status `ELITE`, holder `GOLD / EASTER MRS` — **Discrepancy:** cosmetic but the status string differs; cards identical. |

Subsets (v1.2 omits cards that v1.5 lists; no contradiction — prefer v1.5 for completeness):

| Carrier | Cards in v1.2 | Omitted vs v1.5 |
|---|---|---|
| IB | `VI 4263930000007395 0330 123`, `VI - AR market 4507990000004905 0326 123` | Mexico `4988438843884305`, Brazil `4507990000004905`, OB-fee `4273000000005803` |
| SK | `CA 5200000000000007 1030 737`, `VI 4000000000000002 0330 123` | OB-fee "YR Fee" Visa `4001590000000001 0330 123` |
| BA | `VI 4273000000005803 0330 123`, `VI 4263930000007395 0330 123` | The fee / no-fee labelling and the BA NDC FAQ link |
| QR, QF, SQ, AY, LH, BA | cards as listed | All "OB Fees Information" URLs/market lists (Finnair, BA, Lufthansa OPC, QF AU/NZ, QR market list, SQ market list) are absent from v1.2 |

v1.2 also omits the card-type legend (`CA` = Mastercard, `VI` = Visa, `AX` = American Express, `JCB` = JCB, `CASH` = cash) — that legend was derived in the sibling file and still applies. Identical rows (no delta): AA, AV, EY, LO, QF, QR, VY, and the LH card pair.

### Issue and solution (FAQ)

Same eight entries in the same order, same wording in substance: Duplicate Names (blocked at `OrderCreate`; add a title or concatenate a middle initial with first name); Secure Flight Data Needed at `Travel_OrderPay` (missing TSA gender + DOB, cross-ref "5.1.3.5 Travel_OrderCreate RQ", screenshot in source showing the error); Middle Name (separate middle-name field is not mapped and is ignored; concatenate into `GivenName`, forwarded as-is with no Amadeus-side logic); Ticket Limit Reached at `Travel_OrderPay` (managed between travel seller and airline; contact the airline account manager); Retrieving a cancelled order is not possible (only `PNR_Retrieve` works after cancellation); Name length (59 / 62 / 58 rules, same inclusion lists, same note that space, parenthesis, comma and slash count); `soap:Fault` `18|Application|` (namespace problem — must be provided explicitly); Travel Agency section (unused, filled by Amadeus from OID + LSS, cannot be overridden); Amount as integer vs amount with decimal place.

Exact strings confirmed character-identical in v1.2:

```xml
<soap:Body>
  <soap:Fault>
    <faultcode>soap:Server</faultcode>
    <faultstring>18|Application|</faultstring>
  </soap:Fault>
</soap:Body>
```

```xml
<AMA_TravelSeatAvailabilityRQ xmlns="http://xml.amadeus.com/2010/06/Travel_SeatAvailabilityRQ_v1">
  ...truncated
</AMA_TravelSeatAvailabilityRQ>
```

```xml
<TravelAgency>
  <AgencyID>unused</AgencyID>
  <PseudoCityID>unused</PseudoCityID>
</TravelAgency>
```

**Missing here (present only in the Prime Booking guide):** the **Name length optimization** paragraph — the +8 characters granted when the gender code is present (removes the need for `/ddmmmyy` in the name string), the best practice of always sending the gender code in `Travel_OrderCreate`, the note that a title always counts toward the total, and the `SecureFlightInd = true` consideration. v1.2 states the 59/62/58 limits only.

No FAQ entry exists in v1.2 that is absent from v1.5. Section heading wording differs trivially ("Retrieving a cancelled order is not possible." vs "Retrieve a cancelled order is not possible").

## Gotchas

- Do not treat this guide as an authoritative refresh of the test-data table: v1.2 is older (fewer carriers, no OB-fee links) yet it contradicts v1.5 on AC, AY and SQ. For AC/AY/SQ, try the v1.5 values first and fall back to the v1.2 values listed above if the provider rejects them; the loyalty holder name must match the loyalty number you send.
- `AC` differs on both the loyalty number and the Visa card. Mixing v1.5's loyalty number with v1.2's Visa (or vice versa) is a plausible source of unexplained test failures.
- LH has two valid test loyalty profiles (`992221296706650` MUHLE / HANS = FREQUENT TRAVELLER, `222012064590497` NELKE / BERND = SENATOR) sharing the same two cards — use the FREQUENT TRAVELLER profile when testing tier-differentiated ancillary/seat entitlements.
- UA has a working Visa (`4508750015741019` `0139` CVV `123`) in addition to the AX card, useful when a test needs a non-Amex BIN.
- v1.2's Airline Error Messages section covers only `Travel_OrderViewRS`; all Master Pricer `warningInfo` / `codeListQualifier` decoding rules must be taken from the Prime Booking reference.
- The name-length optimization (+8 chars with gender code) is not documented in v1.2 — but it is a platform behaviour, not a guide-specific one; keep applying it.
- Queues, synchronization, and coupon status codes are duplicated verbatim between the two guides; there is no servicing-only queue category, so do not expect a distinct queue for servicing-initiated (voluntary agent) changes — those reuse Q1C257 / Q7C257 / Q0C256 as in the shared matrix.
