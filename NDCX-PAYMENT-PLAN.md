# NDC[X] Payment Methods — gap analysis & extension plan (credit cards) — MET2-2422

Extends [`NDCX-ORDERPAY-PLAN.md`](./NDCX-ORDERPAY-PLAN.md) (ADR-15…20) — it does **not** replace
it. Read that file first: `Travel_OrderPay` routing, the `updateIssuance` bridge and the
`issueOrder()` override are decided there and are not re-decided here. Context:
[`NDCX-CONTEXT.md`](./NDCX-CONTEXT.md) (mistakes already made — all respected below),
[`NDCX-CHECKLIST-AMADEUS.md`](./NDCX-CHECKLIST-AMADEUS.md) (certification state, due **2026-11-08**),
[`NDCX-INTEGRATION.md`](./NDCX-INTEGRATION.md) (stale — state below was verified from code).

Repos: `api-aerial` and `front-reservation`, both on `deyra-met2-2422`.
Written 2026-10-13. Design doc only: no source file was touched.

> **ADR numbering — read before merging.** Highest ADR in use across all `NDCX-*-PLAN.md` is
> **ADR-59** (`NDCX-FLIGHTCHANGE-PLAN.md`; verified by scanning every file). This plan takes
> **ADR-70…77**. **ADR-60…69 are deliberately left free** for the sibling
> `NDCX-UPSELL-PLAN.md`, which was being drafted concurrently and had not landed when this was
> written. If the upsell plan ends up using a different block, nothing here needs renumbering;
> if it overflows past 69, it must not touch 70-77.

---

## 0. Headline

1. **Credit-card payment already exists** and is wired end to end: front sends `payment` at
   hold (`AmadeusNdcxAdapter.ts:244,283-292`), the controller turns it into a card blob
   (`order.controller.js:330` -> `orderPay.utils.js:24-33`), pay reads it back and emits
   `PaymentMethod.PaymentCard` (`orderPay.utils.js:134-150`). So this is a **gap analysis**.
2. **`NDCX-ORDERPAY-PLAN.md` is out of date** on four points (§1). Notably the
   `issueOrder()` -> AFKL hazard is **fixed**, and the amount-units "100x" question is **settled**
   (decimal major units; six own-office captures prove it).
3. **No card payment has ever been sent to the host from our office.** All ten own-office
   `Travel_OrderPay` captures are **SQ cash**; two of them (`…8209828736833`, `…8209829349967`)
   are the old `TypeCode=CC` + `CashInd` defect, rejected with **11881 "MANDATORY FIELDS IN FOP
   ELEMENT MISSING"**. The card branch is therefore **untested against the real host**, and has
   three suspected wire defects (§4, ADR-73).
4. **Real blockers for the two certification card cases:** (a) an *ad-hoc* card cannot be paid
   at all (§5, ADR-74); (b) the card branch's element order, `CardIssuerName` and cardholder
   address handling deviate from every real card capture (ADR-73); (c) **PAN and CVV are written
   in clear to the request log** by `NdcxClient` -> `ndcxLogger` (ADR-72) — the single most urgent
   item, because certification evidence capture is exactly when it will fire.
5. **Raw-PAN-over-TLS** is kept for certification (ADR-71) with conditions, and is named openly
   in §3. It must be in the PR description.

---

## 1. Corrections to `NDCX-ORDERPAY-PLAN.md` (verified from code, 2026-10-13)

| ORDERPAY-PLAN claim | Current reality | Evidence |
|---|---|---|
| ADR-20: `issueOrder()` mis-routes to **AFKL** | **Fixed.** `AmadeusNdcxAdapter.issueOrder()` overrides and posts to `/aerial/AMADEUS_NDCX/order/orderPayRQ`; `CONTROLLERS` now has an `AMADEUS_NDCX` entry so every *other* `getControllerByOra` consumer no longer falls through to `"AFKL"`. The fallback itself is unchanged for genuinely unknown oras (`?? "AFKL"`). | `AmadeusNdcxAdapter.ts:851-864`; `BaseAdapter.ts:83-86,123-124` |
| §9: `PaymentInfo/Amount` — minor or major units? (100x risk) | **Settled: decimal major units** with `CurCode`. Own captures send `1010.02`, `1313.76`, `1169.87` …; host accepted all cash ones. Builder sends `$value: amount` (decimal) with `$attributes.CurCode`. | `use cases/NDCX/8208708693725-…-Travel_OrderPayAsync-RQ.xml`; `orderPay.utils.js:168`; spec `06-payment-and-features.md:52-53,420` |
| §4.2: "`PaymentCard6` has **no** holder-name field — name goes in `PayerContactInfo`" | **Wrong.** `PaymentCard.CardIssuerName` carries the cardholder name in every real card capture (BA, AF-Subscriber), *in addition to* `PayerContactInfo`. | `BA-Redress-Passport-CC-Pymt/4-Query-Travel-OrderPay.xml`; `AF-Subscriber-Card/04.Travel-OrderPay.q.xml`; `PaymentCard6.d.ts:20` |
| ADR-18/§4.2: card read from `pnr.EncCardNumber`/`EncCvv` | **Not what shipped.** Card travels as a base64-JSON blob in `pnr.EnrollmentStatusText`, built by `applyNdcxEnrollmentStatusText`, decoded by `decodeNdcxCardFromEnrollment`. (Same pattern as `GOKYTE_LEGACY`.) | `orderPay.utils.js:24-65`; `order.controller.js:330`; `dossier.utils.js:1178-1186` |
| §9: duplicate-pay guard open | **Done** for the persisted case (`pnr.status === 2` -> 400). Not a true idempotency key (a pay whose reply is lost, status still 1, can be re-submitted). | `order.controller.js:428-430` |
| §9: `ndcxLogger` + card data — "decide before the first live call" | **Still undecided and still unsafe** — see ADR-72. | `NdcxClient.js:300-318`; `ndcxLogger.js:54-57` |

Also shipped since that plan and relevant here: `TicketDocInfo`-less pay replies are now refused
before `updateIssuance` (`order.controller.js:524`), the amount comes from a live
`Travel_OrderRetrieve` rather than `pnr.totalPrice` (`:471`), `Party` comes from
`buildNdcxParty(salesPoint)` (`orderPay.utils.js:153`) — consistent with `NDCX-CONTEXT.md` §2.

---

## 2. What the code does today for cards (verified)

```
front: PaymentMethod.vue builds `payment` {Payment:"PaymentCard", CardNumber, CardCvv,
       CardHolderName, ExpirationDate, CardBrandCode, EncCardNumber/EncCvv (vault only), payerInfo{…}}
  -> bookFlight(): payment.paymentTypeCode = "CC" | "CA"            AmadeusNdcxAdapter.ts:283-292
  -> POST /AMADEUS_NDCX/order/orderCreateRQ
api: handleOrderCreate -> applyNdcxEnrollmentStatusText(body)       order.controller.js:330
       payerInfo.CardNumber = payment.EncCardNumber ; payerInfo.cvv = payment.EncCvv   (ONLY if vault)
       payment.EnrollmentStatusText = btoa(JSON(payerInfo))          orderPay.utils.js:24-33
     dossierCreate persists pnr.{paymentMethod, paymentTypeCode, CardHolderName, CardBrandCode,
       ExpirationDate (MMYY via extractYearAndMonth), EnrollmentStatusText}   dossier.utils.js:1178-1182,1296-1327
       -- AF/KL host-public-key encryption NOT executed (gate is OwnerCode "AF"|"KL")  dossier.utils.js:1135-1140
agent clicks "émettre" -> emitCard.vue -> ora.issueOrder()           emitCard.vue:301-304
  -> POST /AMADEUS_NDCX/order/orderPayRQ  (buildIssuancePayload body; card data is NOT used by the backend)
api: handleOrderPay: pnr guard -> live Travel_OrderRetrieve -> amount -> createNdcxOrderPayPayload(pnr…)
       card = decryptData(blob.CardNumber / blob.cvv)                orderPay.utils.js:55,60
       PaymentCard{CardNumber, SeriesCode?, ExpirationDate?, CreditCardVendorCode?}  :142-149
     -> travelOrderPay -> map reply -> require TicketDocInfo -> updateIssuance
```

Two facts that shape everything below:

- The backend pay handler **ignores any payment data in the pay request body**; it only trusts
  the persisted `pnr` row (`order.controller.js:424,475-483`). Changing the FOP at emission time
  in `PaymentDetail.vue` is therefore not honoured for NDC[X]. (Code-read only — not exercised.)
- `PaymentInfoID` is minted `"PAY1"` and **is** sent (`orderPay.utils.js:162`); the own cash
  captures confirm the host accepts it (`PaymentInfoID` is first in the `PaymentInfoType`
  sequence, `AMA_TravelOrderPayRQ.xsd` 2022L).

---

## 3. 🔒 Raw PAN in the SOAP body — stated openly

**The fact.** AF/KL card data is encrypted with a host-supplied public key
(`dossier.utils.js:640-680`, key taken from `PaymentInfo/PaymentMethod/PaymentCard/SecureProgram/
EnrollmentStatusText`), and that whole path is gated on `OwnerCode === "AF" || "KL"`
(`dossier.utils.js:607,644-645,1135-1140`). NDC[X] stamps `Order.OwnerCode = "AMADEUS_NDCX"`
(ADR-8), so the path **never fires**. `createNdcxOrderPayPayload` puts the **decrypted PAN and
CVV in the SOAP body** (`orderPay.utils.js:143-145`), protected by TLS to the Amadeus WSAP endpoint
and nothing else. This is the same posture as classic `AMADEUS`. It was a consequence of ADR-8, not
an oversight (`NDCX-ORDERPAY-PLAN.md` ADR-18) — but it has never been *assessed*. This section does.

**Is there any host-side alternative for NDC[X]?** Checked, not assumed:

- No NDC[X] capture — own or vendored — contains a `SecureProgram` / public-key element
  (`grep SecureProgram` over `examples/` and `use cases/NDCX/`: **zero hits**). The AF/KL scheme
  depends on an AF-OIN-style `PaymentInfo` catalogue, which NDC[X] does not return for our
  carriers (ADR-18). **There is no key to encrypt with.**
- The vendored schema exposes `MaskedCardID` / `TokenizedCardID` on `PaymentCard`
  (`PaymentCard6.d.ts:12-14`) but **no reference document describes a tokenisation flow**, and
  no carrier row mentions it. Not usable on evidence.
- Amadeus' own reference examples (BA, AF-Subscriber) send the **PAN in clear** in the body. The
  protocol's intended transport protection is TLS + the WS-Security header. Raw PAN is the
  documented contract for card payment on this interface, not a shortcut we invented.

**Assessment.** Keep it — **for certification and a pilot** — because the protocol offers nothing
better and every certification card case needs it. But "TLS only" is *transport* security; the
real exposure is **everywhere else the PAN touches**, and that is where the code is currently weak:

| Where PAN/CVV can leak | State today | Action |
|---|---|---|
| Request XML log, dev (`use cases/NDCX/*.xml`) and prod (`NEXTCLOUD=true` -> `LogStorageService.uploadAerialLog`) | 🔴 **Full RQ logged, unredacted**, success *and* error paths | **ADR-72 — blocker** |
| `pnr.EnrollmentStatusText` | Vault card only: PAN + CVV stored **encrypted** (reversible `encryptData`/`decryptData`, key in env), persisted until the pnr is deleted, **never purged after authorisation** | ADR-72/74 |
| Process memory / error objects | `NdcxError.fromSoapFault(err, lastResponse, lastRequest)` (`NdcxClient.js:~312`) carries the **request XML** inside the error object; any generic error logger that serialises it re-leaks the PAN | ADR-72 |
| Front -> API | PAN in JSON body over the proxy, ad-hoc card only | out of scope (shared with every provider) |

**When must it change?** If any of the following becomes true, raw PAN is no longer acceptable
and the design moves to a PSP/tokenised flow (new ADR, not an amendment):
1. Amadeus or a carrier documents a token/`MaskedCardID` flow for WBS.
2. A pilot carrier requires **online 3DS** (§4 ADR-75) — then the PSP that performs 3DS is the
   system of record for the card, and metis passes authentication data, not a PAN it collected.
3. Metis's PCI scope assessment (not done in this plan — open question Q6) says storing even
   encrypted CVV between hold and pay is out of policy. Per PCI DSS, sensitive authentication
   data (CVV) may not be retained after authorisation; today it is never deleted.
4. Production volume moves card entry from agency-vault cards to traveller-typed cards (OBT mode)
   — then the PAN is *traveller-supplied* and the risk profile changes.

**What this plan will not do:** quietly add an encryption layer nobody asked for, or quietly
design around the issue. The decision is ADR-71; the PR must say, verbatim: *"NDC[X] sends the
raw PAN (and CVV when held) in the SOAP body over TLS only; the AF/KL host-public-key path is
bypassed by construction (ADR-8)."*

---

## 4. Feature-by-feature gap table

Source of truth: `.agents/skills/ndcx/references/06-payment-and-features.md` (WBS Implementation
Guide v1.5), cross-checked with the WBS columns of `18-airline-capability-matrix.md`. "Cert" =
needed for the 2026-11-08 checklist. Effort: **S** < ½ day, **M** 1-2 days, **L** 3+ days.

| # | Spec feature | Supported today? | Evidence | Needed for cert? | Effort | ADR |
|---|---|---|---|---|---|---|
| 1 | **Cash** (`TypeCode=CA`, `Cash/CashInd=true`) | **Yes — proven.** 8 own captures, SQ, accepted. | `orderPay.utils.js:132-133`; own captures `…Travel_OrderPayAsync-RQ.xml` | **Yes** (test case 1) | — | — |
| 2 | **Card, raw PAN** (`TypeCode=CC`, `PaymentCard`) | **Partial.** Built, unit-tested, **never sent to host**. Wire order / `CardIssuerName` / address deviate from real captures. Ad-hoc card cannot reach pay time. | `orderPay.utils.js:134-150`; tests `ndcx-order-pay.utils.test.js:125-152` | **Yes** (test cases 2 & 3) | **M** | 73, 74 |
| 3 | `PaymentCard` field order vs schema/captures | **Suspect.** Builder emits `CardNumber, SeriesCode, ExpirationDate, CreditCardVendorCode`. Vendored XSD sequence (2022L) is `…CreditCardVendorCode, EffectiveDate, ExpirationDate…`; BA/AF captures put `CreditCardVendorCode` **first**. Two sources disagree with each other *and* with us. | `orderPay.utils.js:143-148`; `AMA_TravelOrderPayRQ.xsd` (2022L) `PaymentCardType`; BA capture `4-Query-Travel-OrderPay.xml` | **Yes** (a rejected card = test fails) | **S** (code) + capture | 73 |
| 4 | Cardholder name on wire | **Partial.** Only `PayerContactInfo.Individual`; `CardIssuerName` omitted. | `orderPay.utils.js:176-177`; BA/AF captures | Yes | **S** | 73 |
| 5 | Cardholder **address / email** (fraud checks AC, BA, IB, 6E, VY; UA P08 for AMEX) | **No — worse than absent.** A *hardcoded agency address* (`163 Avenue Gallieni, PAR, FR`) is sent as the payer address for every card, and `payerInfo` email/address (collected by the front, decoded at `orderPay.utils.js:64`) is discarded. A fraud engine would score a fake address. | `orderPay.utils.js:176-181`; `PaymentMethod.vue:955-961` | Not in the 6 cases; **correctness** for AC/UA | **M** | 76 |
| 6 | **3DS offline** (`SecurePaymentVersion2/PaymentTrxChannelCode=MO`) | **No.** Not emitted anywhere in `AMADEUS_NDCX/`. (EK sends it: `EK/orderPayment.utils.js:98`.) Required only for agencies exempted from 3DS via WS. **Whether Metis is exempt is unknown.** | grep `PaymentTrxChannelCode` — no hit in `utils/AMADEUS_NDCX` | **Probably** — unknown, Q1 | **S** (code, config-gated) | 75 |
| 7 | **3DS online** (`SecurePaymentVersion2/*`, base64 token/DS-trx-id for P06 carriers) | **No.** Needs a 3DS-capable PSP; none integrated for NDC[X]. | — | **No** unless Q1/Q2 come back "3DS mandatory" | **L** (+ PSP) | 71, 75 |
| 8 | **Fraud-check data** in `OrderPay`/`OrderChange` (BA, IB, AC, 6E, VY only) | **No.** Reply `Warning` is mapped (`orderViewReply.mapper.js:76,572`) but nothing reads it to ask the agent for the data. | `orderViewReply.mapper.js:572-575` | No (pilot-dependent: AC only) | **M** | 76 |
| 9 | **Manual approval code** (`ApprovalCode`) | **No.** Offline process (some carriers/markets). `PaymentCard.ApprovalCode` exists in schema. | `PaymentCard6.d.ts:18` | No | **M** + UX | 77 (deferred) |
| 10 | **Implicit FOP** (`TypeCode=FROM_PNR`, `OtherPaymentMethod/Remark/RemarkText=<FP tattoo>`) | **No.** Needs an `FP` element in the Amadeus PNR = a legacy PNR session. Conflicts with SEM-01 (strictly stateless NDC[X]; checklist declines the stateful services). | `NDCX-CHECKLIST-AMADEUS.md` §Services | No | n/a | 77 (rejected) |
| 11 | **OB fees at pricing** (`OfferPrice` `ShoppingCriteria/PaymentCardCriteria{CardTypeCode, IssuerIdentificationNumber}`) | **No.** No `PaymentCardCriteria` in `offer.utils.js`; the BIN is not known before pricing in the current UI order (payment is chosen *after* price). Cert criterion **OB Fees_01** is *Mandatory*, *if* we claim OB fees. Per spec, for some airlines **no BIN -> OrderCreate fails**. | `grep PaymentCardCriteria offer.utils.js` — none; `10-certification-and-testing.md:206` | Only if declared; **a pilot carrier with mandatory BIN would hard-fail every card booking** | **L** (UI flow change) | 77 |
| 12 | **Airline surcharge reading** (`Price/Surcharges`, `Fees/Breakdown` `AggregatorFee`/`T02`) | **Unverified.** `OrderView` amounts are mapped; whether `Fees` flow into `pnr.totalPrice`/`paymentFees` is not checked here. Pay amount is the live retrieve `TotalAmount`, so the **charge is right regardless** (Payment_01). | `order.controller.js:471` | No (display only) | **S** to verify | open Q8 |
| 13 | **Commissions** (percentage, auto FM element) | **No / out of payment scope.** No computation allowed on FM. | spec `:9-13` | No | n/a | 77 |
| 14 | **Combined/Joint invoice (US)** (`Parameters/Invoice`) | **No.** US market, no consumer. | `NDCX-ORDERPAY-PLAN.md` §1 | No | n/a | 77 |
| 15 | **Voucher** (`Voucher/VoucherID`) | **Built, unspecified.** Branch exists; **no NDC[X] carrier row or reference documents vouchers.** Dormant code that can be reached by a mis-selected FOP. | `orderPay.utils.js:128-131` | No | **S** (guard) | 77 |
| 16 | **Retained credit / installments / lodge card / EasyPay** | **No.** Retained credit: AA, UA only; installments: IB(WBS)/BR note only; EasyPay (EP): EY, AY, LO, SQ, TU. | matrix `Payment (OrderPay)` | No | n/a | 77 |
| 17 | **Single FOP per pay** (Payment_07) | **Yes.** Exactly one `PaymentInfo` entry is ever built (voucher+BSP split is not ported). | `orderPay.utils.js:160-185` | Yes | — | — |
| 18 | **Amount = full total, with decimals, valid currency** (Payment_01/03/08) | **Yes for amount**; **currency has a silent `"EUR"` fallback.** | amount `order.controller.js:471`, `orderPay.utils.js:121`; currency `:125` | Yes | **S** | 73 |
| 19 | **Vueling must pay by card; cash unsupported** (Payment_09; matrix VY cash = not supported) | **No guard.** Nothing stops a Cash pay on VY. | no per-carrier payment capability table (only ancillary one: `carrierCapabilities.js`) | Only if VY is a pilot | **S** | 70 |
| 20 | **`OwnerCode` correctness on pay** (Payment_06) | **Latent defect for UA-type carriers.** `resolveNdcxAirlineOwnerCode(pnr.pnrList)` returns the *provider designator* (`UAD`) for UA, not `UA`; cash/card pay is sent with the wrong `OwnerCode`. Identical for AF, SQ, IB, QF, VY — **UA is the first pilot where it differs.** Not fixed in this plan (separate ticket, `NDCX-FLIGHTCHANGE-PLAN.md` §6) but **it blocks a UA payment**. | `NDCX-FLIGHTCHANGE-PLAN.md:315-323`; `order.controller.js:432` | Yes **if** UA is the cert carrier | **S** | 70 |
| 21 | **Error mapping (two layers)** — log the provider error, not just 1A canned text | **Partial.** Refusals surface as 400 with the host `DescText` (`11881` visible in own RS). Provider-level code/message not separately extracted. | `order.controller.js:~495-505` (`sendNdcxRejection`) | No (diagnostic) | **S** | 73 |

---

## 5. The ad-hoc card problem (the real functional gap)

`applyNdcxEnrollmentStatusText` copies a card into the blob **only when `payment.EncCardNumber`
exists** (`orderPay.utils.js:28-31`), i.e. an agency-vault card from `AgencePaymentMethods`. For a
card typed by hand the front sends the plain PAN in `payment.CardNumber`, but that is *not* copied
(`payerInfo` holds only payer name/address/email/phone/zip — `PaymentMethod.vue:949-960`). At pay
time `decodeNdcxCardFromEnrollment` returns `cardNumber: null` and the builder throws
*"No decryptable card number on file … ad-hoc cards … cannot be recovered at pay time"*
(`orderPay.utils.js:136-141`; locked in by the unit test at `ndcx-order-pay.utils.test.js:143`).
The comment at `:15-20` acknowledges it as a "limitation, not something this step fixes".

For certification this matters directly: **test cards from `09-queues-sync-errors-testdata.md`
are not in the agency vault**, and the workflow is hold-at-booking, issue-later-from-the-folder.
Unless the vault is pre-seeded, test cases 2 and 3 cannot be ticketed. Note too that the vault
CVV is stored (encrypted) in the pnr row between hold and pay — the opposite of the PCI default.

Three ways out, decided in ADR-74.

---

## 6. Per-carrier payment support (WBS channel only)

From `18-airline-capability-matrix.md` / `airline-matrix.csv`, `channel = WBS`. **Do not plan a
feature a carrier does not support.** The pilot list is not tracked
(`NDCX-INTEGRATION.md:237`); the carriers below are the ones with evidence in the repo (own
captures: SQ cash, AC, LO create; matrix rows) plus those the checklist cases could use.

| Carrier | Cash | Card (FOP) | Card no. + expiry as input | CVV | Holder name / address | 3DS (WBS) | Notes |
|---|---|---|---|---|---|---|---|
| **SQ** | yes (**own cash captures**) | yes | **not supported** | not supp. | not supp. / not supp. | P06 (base64) | Card number input "not supported" yet card FOP "supported" -> almost certainly a 3DS/PSP-only path. **Raw-PAN builder may be rejected.** Q2. |
| **LO** | yes | yes | **not supported** | not supp. | not supp. / not supp. | P06 | Same as SQ. Test card exists (VI, test data file) but may be unusable raw. |
| **AC** | yes | yes | yes | not supp. | **yes / yes** | P06 | In fraud-check list -> name + address matter (ADR-76). But AC is in `DIRECTLY_INTEGRATED` (`carrierCapabilities.js`) -> "never routed through NDC[X]". Contradiction with the AC captures — Q3. |
| **UA** | yes (P01: EU/ME/Africa/US POS only) | yes | yes | "not required, highly recommended" (P09) | yes / P08 (mandatory for AMEX & MX POS) | no | Retained credit supported. `OwnerCode` is `UA`, we send `UAD` (row 20). EMDs not BSP-reported (P07). |
| **QF** | yes | yes | yes | not supp. | to be clarified | no | Neutral stock. |
| **LH** | yes | yes | yes | not supp. | to be clarified | no | Neutral stock. |
| **VY** | **no** | yes (**required**, Payment_09) | to be clarified | not supp. | yes (name only) / yes | no | Fraud-check carrier; matrix: "VY requires only the cardholder's name". |
| AF/KL, BA, IB, AA, EK | — | — | — | — | — | — | In `DIRECTLY_INTEGRATED`: **not** NDC[X]-routed. Listed in the spec for fraud-check/3DS only; ignore for planning. |

**Reading for the plan.** Carriers where the raw-card path is *documented as supported*
(card number + expiry accepted as input, no mandatory 3DS) and that are **not** directly
integrated: **UA, QF, LH**. **SQ/LO/AC-with-P06** sit behind a 3DS note that, if it means "3DS
required over WBS", puts them out of reach for a raw-PAN card test. This is the single biggest
unknown for certification and is the question to send Amadeus first (Q2) — it decides which
carrier the two card cases are run on. Pick the certification carrier **before** writing code
(ADR-70).

---

## 7. Certification: payment-related criteria — met / not met

Criteria from `10-certification-and-testing.md:176-190` (Payment) and `:206` (OB Fees). Status is
from code today.

| Criterion | Level | Status | Why |
|---|---|---|---|
| Payment_01 — full trip total | Mandatory | **Met** | amount from live `Travel_OrderRetrieve` `TotalAmount` (`order.controller.js:471`) |
| Payment_02 — OrderCreate precedes OrderPay | Mandatory | **Met** | pay requires a persisted pnr (`:424-427`) |
| Payment_03 — valid currency | Mandatory | **Met, fragile** | `CurCode` always sent; silent `"EUR"` fallback (`orderPay.utils.js:125`) is wrong for non-EUR if `pnr.currency` is null |
| Payment_04 — `CashInd` for cash | Mandatory | **Met** | own captures |
| Payment_05 — valid TypeCode (no Cash for CC) | Mandatory | **Met for cash; unproven for card.** The CC+`CashInd` defect (own captures `…736833`, `…349967`) is fixed in the builder (card branch has no `Cash` node), but no card RQ has ever succeeded |
| Payment_06 — OrderID & OwnerCode | Mandatory | **Met for AF/SQ/IB/QF/VY; broken for UA** (`UAD`) | row 20 |
| Payment_07 — no multiple FOPs | Mandatory | **Met** | one `PaymentInfo` |
| Payment_08 — decimal amount | Mandatory | **Met** | `…1169.87` etc. Floating-point formatting should be asserted (S) |
| Payment_09 — VY card required | Mandatory | **Not met if VY is a pilot** | no guard |
| OB Fees_01 — BIN in OfferPrice | Mandatory (if claimed) | **Not met** | not implemented; **do not claim OB fees** on the checklist unless ADR-77 is reversed |
| Test case 1 — 2 ADT domestic OW direct **cash** | — | **Met** (proven pattern, SQ cash x8) — but needs re-run on the cert carrier | |
| Test case 2 — 2 ADT+1 CHD+1 INF intl RT direct, **upsell**, **card** | — | **Not met** — *both* upsell (separate plan) *and* card (this plan) | `NDCX-CHECKLIST-AMADEUS.md` ticks it ✅ for card on code reading alone; this plan shows the card branch is unproven |
| Test case 3 — 2 ADT+1 CHD+1 INF intl RT connecting, **card** | — | **Not met until ADR-73/74 land and a real card RQ/RS exists** | |

> ⚠️ `NDCX-CHECKLIST-AMADEUS.md` marks the connecting-card case ✅ because
> "`orderPay.utils.js` builds `PaymentMethod.PaymentCard`". Per the above that is *builds*, not
> *works*. Do not leave that tick in the document returned to Amadeus until a card RS with
> `TicketDocInfos` has been captured.

---

## 8. Decisions (ADR-70 … 77)

### ADR-70 — Extend the existing builder; pick the certification carrier first; add a per-carrier payment capability table

**Decision.** Keep `createNdcxOrderPayPayload` and the `EnrollmentStatusText` blob as the
mechanism; add only what §4 marks as a gap. Before any code, **choose the certification carrier
for the two card cases** (§6: UA, QF or LH are the candidates the matrix supports without 3DS).
Add a small hardcoded `paymentCapabilities` table next to `carrierCapabilities.js`
(WBS channel only, same refresh-date stamp discipline) holding, per carrier:
`cash`, `card`, `cardNumberInput`, `cvv`, `holderName`, `holderAddress`, `threeDS`,
`fraudChecks`, `ownerCodeOverride`. It drives (a) a **client-side reject** of unsupported FOPs
(VY+cash; any card on a carrier whose matrix says card input unsupported), and (b) which optional
fields to send (ADR-76).

**Alternatives rejected.**
- *Per-carrier `if (ownerCode === "UA")` branches inside the builder.* Scatters carrier knowledge
  through payment code; exactly what `carrierCapabilities.js`'s header argues against.
- *DB-driven table.* The matrix is a quarterly Amadeus document; a change is a reviewed code
  change, not an ops toggle (same reasoning as ADR-30).
- *No guard, let the host reject.* A rejected card pay is expensive: it may leave the order in an
  ambiguous state and burns look-to-book (`NDCX-CONTEXT.md` rule 10).

**Consequence.** `ownerCodeOverride` is where the `UAD` -> `UA` fix for payment lives *if* the
`pnrList.ownerIataCode` ticket has not landed; otherwise it stays empty.

### ADR-71 — Raw PAN over TLS is retained for certification; it is a conditional decision, with explicit exit triggers

**Decision.** Keep sending the PAN (and CVV when held) in `PaymentCard` over TLS. Do **not**
introduce application-layer encryption, a token flow or a PSP now. The four exit triggers in §3
convert this to a new ADR. The PR description carries the verbatim sentence from §3.

**Alternatives rejected.**
- *Port the AF/KL host-public-key path.* Impossible: no NDC[X] reply carries a key (zero
  `SecureProgram` hits). Widening the `OwnerCode === "AF"|"KL"` gate to include `AMADEUS_NDCX`
  would just execute it against a missing key and silently fall to the plain branch — the worst
  outcome (*looks* encrypted in code review, isn't).
- *`MaskedCardID` / `TokenizedCardID`.* Present in the schema, absent from every guide, capture
  and carrier row. A guess on a schema-validated, certification-gated interface.
- *Make raw PAN the carrier-agnostic permanent design.* No: P06/3DS carriers (SQ, LO, AC, EY, AY,
  KQ, QR, SK, TP, TU) may make it unavailable (Q2), and the exposure is dominated by storage and
  logs, not the wire (ADR-72).

### ADR-72 — Redact card data at the single logging choke point, and stop retaining the vault CVV after pay

**Decision (two parts).**

1. **Redact in `NdcxClient`/`ndcxLogger`, not per operation.** Every request goes through
   `NdcxClient.js:300-305` (success) and `:312-318` (error); both pass `this.client.lastRequest`
   straight to `writeNdcxCallLogs`, which writes it to disk (`ndcxLogger.js:54-57`, dev) and
   uploads it (`:41-52`, `NEXTCLOUD=true`). Mask `CardNumber` (keep first 6 + last 4, same shape
   as `maskCardNumber`, `dossier.utils.js:~308`) and **blank `SeriesCode`** in the request XML
   *before* it is handed to either sink, and ensure the `lastRequest` copy placed inside
   `NdcxError.fromSoapFault` is the redacted one. Redaction is by element local-name regex on the
   already-serialised string, namespace-prefix agnostic (own captures use
   `ama_2010_06_Travel_OrderPayRQ_v1:` prefixes; BA uses `ns6:`). **This lands before the first
   live card call.** It is the only item in this plan that cannot wait for capture.
2. **Purge the CVV once the order is ticketed.** After a successful `updateIssuance`, rewrite
   `pnr.EnrollmentStatusText` without `cvv` (and without the full `CardNumber`). Out of scope here
   is deleting the *vault's* stored CVV — it is the agency vault's policy, not this feature's.

**Alternatives rejected.**
- *Suppress request logging for `Travel_OrderPay` only.* Loses the RQ the certification evidence
  needs and the 11881-class diagnostics we rely on; also misses `OrderChange` (which takes the same
  `PaymentCard`, `NDCX-EXCHANGE`/`orderChange.utils.js`).
- *Redact only at certification time.* Certification capture is dev-mode, but production
  (`NEXTCLOUD=true`) logs identically; leaving it makes the first real card sale a PAN-in-logs
  incident.
- *Encrypt the log.* Pushes key management into a debugging aid.

### ADR-73 — Make the `PaymentCard` node match a real capture; capture before declaring done

**Decision.** Following the NDCX-CONTEXT rule that a real capture beats prose or a `.d.ts`:

1. Reorder `PaymentCard` children to the order of the **capture that the host accepted for our
   endpoint version**. Today the three candidates disagree (builder; vendored 2022L XSD; BA/AF
   captures — `CreditCardVendorCode` first). Resolve by capturing, not by choosing: step 1 of §9.
2. Add `CardIssuerName` = holder name (every real card capture has it).
3. `ExpirationDate` stays `MMYY` (matches `0330` in BA/AF captures and `extractYearAndMonth`,
   `dossier.utils.js:393-419`); add a builder-side assertion that it matches `/^\d{4}$/` and
   reject early with a named error rather than let a bad date read as a generic host error.
4. Currency: replace `pnr?.currency || "EUR"` (`orderPay.utils.js:125`) with the currency from
   the live retrieve's `TotalAmount` `Code` attribute, and **throw** if neither is present — no
   silent default (NDCX-CONTEXT §2's "no placeholder fallback" principle applied to money).
5. Format the amount to the order's `Decimals` (`toFixed`) so Payment_08 cannot regress to
   `768.5` or `768.5200000001`.
6. Extract the host's provider-level error code/message alongside the 1A text (spec Gotchas, last
   bullet) into the 400 body.

**Alternatives rejected.**
- *Trust the `.d.ts` order* — `NDCX-CONTEXT.md` §3 already records these as non-authoritative.
- *Trust the 2022L XSD blindly* — the BA capture (a real, accepted message) contradicts it for
  `SecurePaymentVersion2` placement too; the XSD in the repo may not be the version `_1.7` binds.

### ADR-74 — The card is supplied to the pay call, not rehydrated from storage; vault-only is the certification fallback

**Decision.** Three options against §5:

| Option | What | Verdict |
|---|---|---|
| A. **Vault-only** | Reject ad-hoc cards for NDC[X] client-side; seed the agency vault with the Amadeus test cards for the cert run. | **Chosen as the certification path.** Zero new storage, ~S. Honest about the existing limitation. |
| B. **Card supplied at emission** | `emitCard` already runs `PaymentDetail.initializeForEmission()` (`emitCard.vue:141`); send the card entered/selected there in the `orderPayRQ` body (new `payment` object), use it for that call only, **never persist it**. Backend prefers `body.payment` over the blob. | **Chosen as the target design.** Removes CVV-at-rest between hold and pay and makes "change FOP at emission" real. ~M-L (touches `buildIssuancePayload` consumers; front `issueOrder()` for NDC[X] only). |
| C. **Persist ad-hoc PAN encrypted in the blob** | Extend `applyNdcxEnrollmentStatusText` to encrypt `payment.CardNumber`/`CardCvv` | **Rejected.** Retains CVV (and an ad-hoc PAN) in the pnr for days; contradicts ADR-72 and PCI posture; also makes the front change unnecessary only in the least safe way. |

**Sequencing.** A now (needs no code — only a vault seed and the client-side reject), B after
certification unless the cert run proves vault cards unusable.

**Open item.** Whether a card sitting in the vault can really be the *test* card of the cert
carrier (name on card, 3DS exemption) — Q4.

### ADR-75 — 3DS: offline (`MO`) only, config-gated, default off; online 3DS is out of scope

**Decision.** Add `SecurePaymentVersion2/PaymentTrxChannelCode = "MO"` to the card `PaymentInfo`
**only when** the sales point has an explicit attribute declaring it 3DS-exempt
(naming per `NDCX-CONTEXT.md` §2: a dedicated `Amadeus-3ds-exempt`-style attribute, *never*
overloading an existing one), validated with the same fail-loud pattern as `buildNdcxParty`.
Default **off**. Online 3DS (`EC`, `AuthenticationTokenValue`, `DirectoryServerTrxID`, base64 for
P06 carriers) is **not** built.

**Alternatives rejected.**
- *Always send `MO`.* The spec says it is valid only for TAs actually exempted; declaring an
  exemption we do not hold is a false statement to the acquirer.
- *Never send `MO`.* Breaks card payment outright for a carrier that requires 3DS and for an
  exempt agency (it is the *enabler* in the spec, not an option).
- *Build online 3DS now.* Needs a PSP and a UX redirect; ~L; and only justified if Q1/Q2 say
  Amadeus will not exempt us (then see §3 trigger 2).

**Where `MO` goes.** The BA capture places `SecurePaymentVersion2` *before* `PaymentMethod`
whereas the vendored 2022L XSD places it *after* — resolved by capture (ADR-73), not here.

### ADR-76 — Send real cardholder name/address/email; replace the hardcoded agency address

**Decision.** For carriers whose capability row says holder name and/or address are supported
(AC, UA, VY, BA, IB, 6E per the matrix), build `PayerContactInfo`/`CardholderContactInfo` from the
**decoded `payerInfo`** (`payerFirstName/LastName`, `payerEmail`, `payerAddress`, `payerCity`,
`payerZip`, `payerCountry`) that `decodeNdcxCardFromEnrollment` already returns (`:64`) and the
builder currently throws away. Remove the hardcoded `163 Avenue Gallieni` literal
(`orderPay.utils.js:179`; same literal at `BaseAdapter.ts` `buildIssuancePayload`). When the
carrier requires the data and `payerInfo` is empty, **fail loud before the host call** naming the
missing field, instead of sending a plausible fake. `UA` + AMEX or MX POS: address mandatory (P08).
Where a reply `Warning` says "For credit card payment enter card holder name…", surface it
(`orderViewReply.mapper.js:572`) so the agent is asked, rather than first learning from a refusal.
The data is **not persisted by the host** (spec) — it must be re-sent on every pay/change.

**Alternatives rejected.**
- *Keep the agency address as payer address.* It is untruthful to a fraud engine and a false
  statement about who the cardholder is; harmless only until a carrier actually scores it.
- *Always send all fields.* Several carriers list holder name/address as "not supported"
  (SQ, LO, many); sending unsupported nodes is a schema-validated-host risk. The ADR-70 table
  gates it.

### ADR-77 — Deferred or rejected payment features

| Feature | Decision | Reason |
|---|---|---|
| Implicit FOP (`FROM_PNR`) | **Rejected** | Requires a legacy PNR `FP` element and a stateful session; contradicts SEM-01 (NDC[X] flow is stateless — the checklist deliberately declines `PNR_AddMultiElements` etc.). |
| OB fees / BIN at pricing | **Deferred; do not claim on the checklist** | Needs the card BIN *before* pricing, i.e. a UI ordering change (payment is chosen after price today). If the cert carrier makes the BIN mandatory (spec: no BIN -> OrderCreate fails), this stops being optional — Q5. |
| Manual approval code | **Deferred** | Offline process, some carriers/markets (e.g. AV in the test data); `ApprovalCode` field exists, no UX. |
| Commissions | **Out of scope** | Not a payment feature; FM element must not be recomputed. |
| US combined/joint invoice | **Out of scope** | US market, no consumer. |
| Voucher | **Dormant branch guarded** | Reject client-side unless the carrier's payment capability row says voucher-capable (none documented). Prevents a mis-selected FOP reaching the wire. |
| Retained credit, installments, lodge card, EasyPay | **Out of scope** | Carrier-narrow (AA/UA; IB; EY/AY/LO/SQ/TU); none on the checklist. |
| Split FOP (voucher+cash) | **Rejected** | Payment_07: no multiple FOPs. |

---

## 9. Build and verification order

Same principle as `NDCX-ORDERPAY-PLAN.md` §8 — capture, then freeze.

1. **Decide the certification carrier** (ADR-70) and send the Q1/Q2 question to Amadeus
   **now** (technical questions are due **2026-10-28**, one e-mail per subject, subject containing
   "Metis Digital" — `NDCX-CHECKLIST-AMADEUS.md`).
2. **ADR-72 part 1 — log redaction.** Ship first; add a test that feeds a fixture RQ containing a
   PAN/CVV and asserts neither survives in what `writeNdcxLogEntry` receives.
3. Seed a vault test card (ADR-74 A) and add the client-side rejects (ADR-70/74/77).
4. **First real card pay**, low-value fare, vault test card from the cert carrier
   (`09-queues-sync-errors-testdata.md`, TEST ONLY: e.g. UA/QF/LH rows — note some expiries are
   past, and a decline on an expired test card is not a code bug). Run in `NODE_ENV=development`
   so the RQ/RS land in `use cases/NDCX/` (redacted per step 2).
5. From that real RQ/RS: lock ADR-73's element order and ADR-75's `SecurePaymentVersion2`
   placement; commit the redacted capture as a fixture; extend
   `ndcx-order-pay.utils.test.js` with a **byte-for-element-order** assertion against it
   (the existing test only checks values, `:125-141`).
6. ADR-76 for the cert carrier only if its row requires holder data.
7. Re-run the three payment cases on the cert carrier; capture RQ/RS for the checklist evidence.
8. Fix the checklist document's card tick (§7) to match reality *before* it goes to Amadeus.

### Tests to add (no code written here — specifications)

- Builder: card node child order equals the fixture; `CardIssuerName` present; `ExpirationDate`
  matches `^\d{4}$`; no `Cash` node alongside `PaymentCard`; currency throws when absent;
  amount string has exactly `Decimals` places; carrier gating per the capability table.
- Logger: PAN/CVV absent from both sinks on success **and** error paths, for both namespace
  prefixes seen in captures.
- Controller: ad-hoc card -> 400 with the named reason (A); VY + cash -> 400; UA `OwnerCode`
  resolves to `UA`.
- Post-pay: `pnr.EnrollmentStatusText` has no `cvv` after `updateIssuance` (ADR-72 part 2).
- Existing: keep `ndcx-order-pay.utils.test.js` cases at `:125-152` green; the ad-hoc-rejection
  test (`:143`) stays valid under option A.

---

## 10. Effort against 2026-11-08

Today is 2026-10-13; **26 days**, **Amadeus technical questions by 2026-10-28 (15 days)**.

| Block | Effort | Notes |
|---|---|---|
| ADR-72 log redaction (+ post-pay CVV purge) | 1 day | Blocker; do first |
| ADR-70 capability table + guards | 1 day | Needs the carrier choice |
| ADR-73 builder fidelity (order, `CardIssuerName`, currency, decimals, error layers) | 1-1.5 days + capture | Cannot be closed without step 4/5 |
| ADR-74 A (vault seed, ad-hoc reject) | 0.5 day | B (card at emission) post-certification, 3-4 days |
| ADR-75 `MO` config gate | 0.5 day | Hinges on Q1 |
| ADR-76 holder/address | 1-1.5 days | Only if the cert carrier needs it |
| Live capture sessions + fixtures + re-run 3 cases | 2 days | External dependency: Amadeus test host, card validity |
| **Total (card path to certifiable)** | **~7-9 working days** | **Feasible** *provided* the carrier/3DS answer arrives in time |

**Risk.** The estimate is dominated by a single unknown: whether the chosen cert carrier accepts
a raw-PAN card at all over WBS (SQ/LO/AC rows say "card number input: not supported" next to a
3DS-WBS note). If the answer is "3DS required", the card cases cannot be certified with raw PAN
and the plan becomes ADR-75's online 3DS + a PSP — **~3+ weeks, not achievable by 2026-11-08**;
in that case the realistic course is to certify the carrier set where raw card is supported
(UA/QF/LH) and say so to Amadeus. The upsell requirement of test case 2 is a separate
workstream (`NDCX-UPSELL-PLAN.md`) and is not costed here.

---

## 11. Open questions — resolve, do not assume

- **Q1.** Is Metis (office/agency) **exempt from 3DS via web services**? Determines whether `MO`
  (ADR-75) is mandatory on every card pay and whether card payment is certifiable at all.
- **Q2.** For SQ, LO, AC, EY, AY, KQ, QR, SK, TP, TU (3DSv2 WBS note P06) the matrix shows
  *"card number and expiry date — not supported"* alongside *"FOP credit card — supported"*.
  Does that mean **raw-PAN card payment is rejected on these carriers over WBS** and 3DS-only is
  required? The matrix does not say; only Amadeus can.
- **Q3.** `carrierCapabilities.js` puts **AC** in `DIRECTLY_INTEGRATED` ("never routed through
  NDC[X]") yet our own create captures and the pilot notes name AC. Which is true for the pilot?
- **Q4.** Can the cert test card be stored in the agency vault (`AgencePaymentMethods`) with a
  holder name the carrier accepts? Vault CVV semantics for AMEX (CID, e.g. LH/UA rows) untested.
- **Q5.** Does the cert carrier make the BIN mandatory at `OfferPrice` (OB Fees)? If yes,
  ADR-77's deferral is invalid for it.
- **Q6.** Metis PCI-DSS scope: is retaining an encrypted vault CVV between hold and pay
  acceptable to the business? Not assessed here; ADR-72 part 2 is the conservative default.
- **Q7.** Which XSD does the `Travel_OrderPay_1.7` endpoint actually validate against? The
  vendored `2022L` sequence and the BA capture disagree on `PaymentCard` and
  `SecurePaymentVersion2` placement. (Resolved by capture, ADR-73.)
- **Q8.** Do OB fee / `AggregatorFee` surcharges flow into `pnr.totalPrice`/`paymentFees` at
  OrderCreate? (Pay is unaffected — amount is the live total — but displayed margin may be.)
- **Q9.** Does the `emitCard` FOP change at emission persist anywhere for NDC[X]? Code-read says
  no (handler trusts only the pnr row, `order.controller.js:475-483`); not exercised end to end.
- **Q10.** `OrderChange` (exchange, ancillary add) also takes `PaymentInfo`/`PaymentCard`
  (`orderChange.utils.js`, spec `06:132`). This plan covers `OrderPay` only; whether the same
  builder/redaction applies to those paths must be checked when the exchange plan is built.

---

## 12. Definition of done

- [ ] No PAN or CVV in any file/upload the NDC[X] logger produces (test + manual grep of
      `use cases/NDCX/` after a card run).
- [ ] One **real, host-accepted card `Travel_OrderPay` RQ/RS** captured (redacted) and committed
      as a fixture; builder test asserts child order against it.
- [ ] Test cases 1 and 3 (and the card half of 2) ticketed on the cert carrier: non-null
      `ticketNumber`, `pnr.status 1 -> 2`, amount charged equals `TotalAmount` to the cent.
- [ ] Ad-hoc card refused client-side with a clear message (A), or supported by B.
- [ ] `NDCX-CHECKLIST-AMADEUS.md` card tick reflects reality; OB fees **not** claimed.
- [ ] PR description names: raw-PAN-over-TLS and why (ADR-71); the logger change touching a
      shared client (ADR-72); any shared-file touch (`dossier.utils.js` if the CVV purge needs it).
- [ ] `NDCX-ORDERPAY-PLAN.md` §9 items marked resolved/superseded as per §1 of this file.
