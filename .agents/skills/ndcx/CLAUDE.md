# Amadeus NDC[X] — project context for Claude Code

This repo integrates the **Amadeus NDC[X] Travel APIs** (SOAP web services) to shop, book,
pay and service NDC airline content through the Amadeus Travel Platform.

Reference knowledge lives in `ndcx/` (adjust the path if you relocate it). It is distilled
from the Amadeus *WBS Implementation Guide NDC[X] v1.5* (Prime Booking, Refunds and Voids),
the *Ancillaries, Seats and Servicing v1.2* guide, the 2026-06-15 per-airline difference
table, and ~330 captured request/response messages.

## Read before writing NDC code

Open only what the task needs — `ndcx/references/` is ~9,000 lines.

| Task | File |
|---|---|
| Endpoint, credentials, Office ID, prerequisites, service versions | `ndcx/references/01-setup-and-connectivity.md` |
| Shopping / search, time limits, parsing NDC offers from the reply | `ndcx/references/02-shopping-masterpricer.md` |
| Booking chain: OfferPrice → OrderCreate → OrderPay → OrderRetrieve | `ndcx/references/03-prime-booking-flow.md` |
| Per-bound (VY), per-bound-per-PTC (QF), corporate repricing | `ndcx/references/04-carrier-specific-pricing.md` |
| Search options: frequent flyer, NDC-only, fare types, SAF bundles, PTCs | `ndcx/references/05-shopping-options-and-fares.md` |
| Payment: 3DS, cash, fraud checks, manual approval, implicit FOP, OB fees | `ndcx/references/06-payment-and-features.md` |
| Order retrieval, identifying NDC bookings in `PNR_Reply`, contacts, AIAN | `ndcx/references/07-order-retrieve-and-pnr.md` |
| Voids, refunds, cancellation, fare families, Amadeus Profiles | `ndcx/references/08-cancel-refunds-and-profiles.md` |
| Queues, sync, error messages, coupon codes, test cards & loyalty numbers | `ndcx/references/09-queues-sync-errors-testdata.md` |
| Certification / acceptance criteria | `ndcx/references/10-certification-and-testing.md` |
| Servicing setup deltas and process flows | `ndcx/references/11-servicing-overview.md` |
| Deferred vs instant payment, contact/FF updates, retain & reuse credit, split PNR | `ndcx/references/12-post-booking-modifications.md` |
| Ancillaries and seats (pre-booking / post-booking / post-issuance), bags | `ndcx/references/13-ancillaries-and-seats.md` |
| Voluntary fare driven exchange | `ndcx/references/14-exchange-fare-driven.md` |
| Voluntary schedule driven exchange, netting | `ndcx/references/15-exchange-schedule-driven.md` |
| Involuntary changes, waiver codes | `ndcx/references/16-involuntary-changes.md` |
| Servicing deltas on queues/errors/test data | `ndcx/references/17-servicing-queues-errors-faq.md` |
| "Does carrier X support feature Y?" | `ndcx/references/18-airline-capability-matrix.md` or grep `ndcx/references/airline-matrix.csv` |
| A real message on the wire | `ndcx/examples/INDEX.md`, then the scenario folder |

`ndcx/scripts/ndcx_search.py` is a working reference client (WS-Security header +
MasterPricer search + OfferID extraction). `--dry-run` needs no credentials.

## Rules that must hold in any code you write here

1. NDC calls are **stateless**. Stateful sessions only when mixing legacy APIs
   (`PNR_AddMultiElements`); commit order/PNR updates before the next call.
2. **SOAP Header 4.0** on every request: `wsa:MessageID`, `wsa:Action`, `wsa:To`,
   `TransactionFlowLink`, WS-Security `UsernameToken`/`PasswordDigest`,
   `AMA_SecurityHostedUser/UserID@PseudoCityCode`.
3. `PasswordDigest = base64(sha1(rawNonceBytes + createdString + sha1(password)))`.
4. NDC-only search requires `typeOfUnit=NDC` with `numberOfUnits=100` — **exactly 100**,
   or the criterion is silently ignored.
5. Children are `CNN`, not `CHD`. Infants are a separate `INF` `paxReference` bound to an
   adult `ref` with `infantIndicator=1`, excluded from the `PX` count.
6. NDC recommendations are identified by `priceType="N"` plus a `refQualifier="OI"`
   reference into `offersGroup`.
7. Carry **ShoppingResponseID + OfferID + OfferItemID(s) + OwnerCode** from shopping into
   `Travel_OfferPrice`. MasterPricer is a mandatory prior step.
8. Honour the **Offer Time Limit** (`OTL`, GMT, 15–30 min by carrier). Expired offers must
   be re-shopped, never repriced. MasterPricer dates are `DDMMYY`, times `HHMM`.
9. Use **city codes** when a carrier returns `QUERY NOT PROCESSABLE: NO ELIGIBLE NDC PROVIDER`.
10. Keep look-to-book at **1000 offers : 1 order**. No re-shop retry loops, no infinite
    loops against the Amadeus host, no redundant transactions.
11. **No duplicate bookings** — a confirmation step must not be re-submittable.
12. Validate inputs client-side (formats, date sequence) before sending; distinguish
    advisory from warning responses.
13. Check `18-airline-capability-matrix.md` before relying on a feature — support varies by
    carrier and by channel (use the **WBS** column for web services).

## Environment

```bash
NDCX_WSAP=https://noded5.test.webservices.amadeus.com/WSAP   # exact node from Amadeus
NDCX_USER=...        # WSAP username
NDCX_PASS=...        # WSAP password (plain; digest is computed per request)
NDCX_OFFICE=...      # NDC-activated Office ID / PseudoCityCode
```

Never commit credentials. Test-environment card numbers and loyalty numbers live in
`ndcx/references/09-queues-sync-errors-testdata.md` and are for the test environment only.

## Conventions

- Match the namespaces and element order of `ndcx/examples/` exactly — these services are
  schema-validated and the host rejects reordered children.
- Where a reference file says `(diagram in source: ...)`, the real XML is in `ndcx/examples/`;
  prefer it over reconstructing from prose.
- Amount formatting differs by service (plain integer vs integer + decimal place
  indicator). Check the reference file for the specific call.
- Files in `ndcx/examples/` have credentials replaced with placeholders, and large captures
  had repeating elements trimmed to 3 (flagged in a comment on line 1) — record counts in
  those files are not representative.
