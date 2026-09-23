# NDC[X] Working Context

Quick-start guardrail doc for any session (human or Claude) picking up NDC[X]
work in `api-aerial` (branch `deyra-met2-2422`, ticket MET2-2422). This file
does **not** replace [`NDCX-INTEGRATION.md`](./NDCX-INTEGRATION.md) — that
remains the single source of truth for status + remaining work. This file is
the thing to read *first*, in under two minutes, before touching code: which
skill to load, the one credentials rule that was just fixed, and the list of
mistakes already made once so nobody makes them twice.

## 1. Start here: use the ndcx skill

Reference knowledge for Amadeus NDC[X] (SOAP shapes, per-service versions,
per-carrier capability matrix, ~330 captured request/response messages) lives
at `.agents/skills/ndcx/`. It is **not** wired into `.claude/skills`, so it
won't show up in the normal Skill-tool listing — load it manually:

1. Read `.agents/skills/ndcx/SKILL.md` first (it's a routing table, not the
   content) — it tells you which single `references/*.md` file answers your
   specific question. Don't read the whole `references/` folder (~9,000 lines).
2. `.agents/skills/ndcx/CLAUDE.md` has the condensed non-negotiables (stateless
   calls, SOAP Header 4.0, PasswordDigest formula, NDC-only search = exactly
   `100`, `CNN` not `CHD`, Offer Time Limit, look-to-book 1000:1, no duplicate
   bookings, no retry/polling loops).
3. For a real wire example, use `.agents/skills/ndcx/examples/INDEX.md` before
   reconstructing a payload from prose — these are schema-validated services;
   the host rejects reordered or misnamespaced children.
4. `scripts/ndcx_search.py` is a working reference client (WS-Security header +
   MasterPricer search) — `--dry-run` needs no credentials.

## 2. Party / credentials — always use the real sales point, never a placeholder

**Just fixed (commit `c76416134`):** every `Travel_*` request builder
(`offer.utils.js`, `order.utils.js` ×2, `orderPay.utils.js`) was sending
`Party.Sender.TravelAgency: { AgencyID: "unused", PseudoCityID: "unused" }` —
copy-pasted 4 times. The Amadeus guide *does* call this element "not used but
mandatory" and ships `"unused"` in its own examples, but that's not a license
to skip real values when a sales point is known.

**The rule going forward:** every controller already has `req.salesPoint`
(populated by `amadeusServiceFactory.js`'s `getSalesPoint`, same one classic
AMADEUS uses). Any new NDC[X] request builder must:

- Build `Party` via `buildNdcxParty(salesPoint)` in
  `src/utils/AMADEUS_NDCX/party.utils.js` — **do not** inline a new
  `{ AgencyID, PseudoCityID }` literal anywhere else. If a new field belongs on
  `Party` (Contacts, Participants — see IBERIA's fuller `getParty()` for the
  shape), extend that one function.
- Never hardcode a credential-shaped value ("unused", a test office ID, a
  placeholder IATA number) as a fallback for production paths. `buildNdcxParty`
  throws a clear, named error when a required sales-point attribute is missing
  — the MET2-2584 discipline (fail loud with a message that names the missing
  attribute, not a silent wrong value or an illegible `TypeError`) — rather
  than defaulting quietly. Match that pattern for any other credential-bearing
  field you add.
- `PseudoCityID` = `salesPoint["Amadeus-officeId"]` (same value already used as
  `PseudoCityCode` in the classic Amadeus SOAP header). `AgencyID` =
  `salesPoint.iata` (added to the fetch allowlist in this fix; same attribute
  IBERIA/TURKISHA already read for their own agency identity fields). If a
  future requirement needs a *different* agency id than the IATA number,
  don't reuse `iata` silently — add a dedicated attribute (`Amadeus-agencyId`,
  following the `ib-agencyId`/`tk-agencyId` convention) instead of overloading
  an existing one.
- Test coverage lives in `ndcx-party.utils.test.js` plus a Party-wiring case in
  each of `ndcx-offer-price`, `ndcx-order-create`, `ndcx-order-retrieve`,
  `ndcx-order-pay` `.utils.test.js`. Add one there for any new builder.

## 3. Mistakes already made — do not repeat

Distilled from `NDCX-INTEGRATION.md` and the five companion plan/review docs
(`NDCX-OFFERPRICE-PLAN.md`, `NDCX-ORDERCREATE-PLAN.md`,
`NDCX-ORDERCREATE-REVIEW.md`, `NDCX-ORDERCREATE-FINISH-PLAN.md`,
`NDCX-ORDERPAY-PLAN.md`, `NDCX-ORDERCANCEL-PLAN.md`). Each doc has the full
writeup; this is the "don't step here again" index. Some items are flagged
**unresolved as of last write** below — verify current code state before
assuming they're still true.

### Amounts / currency

- Reusing shopping's `toNumber(amount)` in the offerPrice mapper inflates every
  price **100×** — MasterPricer replies use decimal major units,
  `Travel_OfferPrice`/`Travel_OrderCreate` etc. use integer minor units. Two
  conventions in one flow; don't assume shopping's helper carries over.
- `Response/Metadata/Other/OtherMetadata` is an **array** on real captures
  (`[{CurrencyMetadatas}, {RuleMetadatas}]`), not one object with both as
  sibling keys. A lookup assuming the object shape silently resolves nothing —
  it "worked" for EUR only by coincidence (ISO fallback of 2 decimals matches
  EUR's real `Decimals`). Always read the actual `Decimals` metadata, ISO-4217
  table as fallback only, and iterate the array.
- A hardcoded `* 100` rounding in `sumNdcxAmounts` truncates 3-decimal
  currencies (BHD, JOD, KWD, OMR, TND, LYD) — use the per-currency `Decimals`
  value, not a fixed multiplier.
- `RuleMetadata.Instruction` (`"Not Allowed"`) must be translated to the
  `"NAV"` sentinel `dossier.utils.js` checks — passing the raw instruction
  text through as `DescText` makes a non-refundable fare read as refundable.

### Element naming / WSDL shape

- `PaxRefID` cardinality is **per service**: OfferPrice wants one
  space-separated element (`<PaxRefID>T1 T2</PaxRefID>`), OrderCreate wants
  repeated elements. `node-soap` serializes a JS array as repeated elements —
  OfferPrice's builder must `.join(" ")` explicitly.
- Element order is schema-enforced; JS object key insertion order **is** the
  XML element order. Match the captured example's order exactly.
- The generated `.d.ts` types under `src/types/NDCX/` are not authoritative for
  shape — `AmaTravelOfferPriceRq` and friends resolve to one generic, fully
  optional `Request` interface shared across all 9 Travel operations. The
  captured XML in `.agents/skills/ndcx/examples/` is the only real authority.
- Redress is its own top-level `Pax.RedressProgram[]`, **not** a `Visa` entry —
  only KTN is a `Visa` entry.
- Request-side field is `IdentityDocNumber`; the reply-side equivalent is
  `IdentityDocID` — don't reuse the reply name on the request.
- `Order.BookingRef` can be **2–3 entries** on a reply; select the one with
  `BookingEntity/Carrier` present explicitly, never by array index.

### PTC / passenger codes

- Children are `CNN`, never `CHD`.
- GenderCode has no independent source on front-reservation's pax type —
  derive from title (`MR`→M, `MRS`→F, …). This is an accepted permanent
  limitation, not something to "fix" by adding a new field.

### Docs / identity documents

- `docTypeCode()` had a dead branch matching literal `"CNI"` — nothing emits
  that; the app's profile utils emit the French label `"Carte d'identité"`.
  Result: `IdentityDocTypeCode` came out `undefined` and the whole
  `IdentityDoc` was silently dropped. Fixed in NDC[X]'s copy — **the identical
  bug still exists, unfixed, in `AFKL/order/orderCreate.utils.js`'s
  `getDocType()`** (separate ticket).
- ⚠️ **Verify current state**: as of `NDCX-ORDERCREATE-REVIEW.md`,
  `buildIdentityDoc()` was commented out in `order.utils.js`, so
  `Travel_OrderCreate` sent **no `IdentityDoc` at all** for any passenger —
  every prime-booking example treats it as mandatory. A regression test was
  left red pending this decision. Check whether this has since been resolved
  before assuming identity docs are being sent.
- `buildContactInfo()` must not assume `phoneNumber`/`emailAddress` are plain
  scalars — the real front payload sends profile-shaped record arrays
  (`phoneNumber: [{ number, ... }]`). Extract the scalar explicitly; the bug
  version sent the literal string `"[objectObject]"` to Amadeus.

### SOAP version

- `NdcxClient.js` declares `Travel_OfferPrice_1.3`; a captured AF reference
  example was taken against `1.2`. Keep `1.3` — if the host ever rejects a
  message, check this first before assuming the payload shape is wrong.

### OrderCreate

- `Order.OwnerCode` must be the literal `"AMADEUS_NDCX"` (matches the shopping
  mapper / classic-AMADEUS provider-name convention) — **not** the airline.
  The airline lives in `Order.BookingRef.BookingEntity.Carrier.AirlineDesigCode`
  and `Order.pnrList[]`. Getting this backwards silently bypasses every
  carrier-keyed branch in shared `dossier.utils.js` (AF/KL card encryption,
  journey-building, …) — each consumer must be checked individually, not
  assumed safe.
- `buildJourneys()`'s carrier gate (`dossier.utils.js`) had to be widened to
  include `"AMADEUS_NDCX"` or journeys are silently skipped despite a full
  reply.
- `Order.OrderID` needs an `"NDCX-"` prefix (SABRE-style), applied by metis —
  the host does not prefix it. Forgetting this collides NDC[X] orders with
  classic AMADEUS dossiers in the same office on lookup. Strip the prefix
  before every host call (once, right before the wire call — see
  `stripNdcxOrderIdPrefix`).
- `dossierCreate()` must run **exactly once per booking** (create/hold only).
  Pay and retrieve use `saveAfterRetreive`/`updateIssuance` — never call
  `dossierCreate()` again on those paths.

### OrderPay

- `AmadeusNdcxAdapter.bookFlight()` originally sent no `payment` key at all,
  so every dossier silently defaulted to `Cash`/`"NAV"` with no card — source
  `payment` the same way SABRE's adapter does.
- There is **no host FOP catalogue** for the pilot carriers (AC, LO) — mint
  `PaymentInfoID` yourself (`"PAY1"`); don't assume a catalogue-lookup pattern
  from another provider applies here.
- 🔒 **Security-relevant, deliberate, must be called out in review every time
  it's touched**: the AF/KL host-public-key card-encryption path only fires
  for `OwnerCode === "AF"||"KL"`. NDC[X] sets `Order.OwnerCode =
  "AMADEUS_NDCX"`, so that path never fires — NDC[X] sends the raw PAN in the
  SOAP body over TLS only, same as classic AMADEUS. Name this explicitly in
  any PR touching payment; don't let it be discovered in review.
- OrderPay calls `updateIssuance` **only** — checked against every other
  provider (AFKL, EK, ACCELYA, IBERIA, TURKISHA, TRANSAVIA, BA), none pair it
  with `saveAfterRetreive`. `saveAfterRetreive` stays retrieve's job.
- 🔴 **Live, currently-shipped hazard** (front-reservation, `BaseAdapter`):
  `issueOrder()` is one of the few `BaseAdapter` methods that does **not**
  throw for an unimplemented provider — it POSTs straight to
  `/aerial/${getControllerByOra(ora)}/order/orderChangeRQ`, and
  `getControllerByOra` **falls back to `"AFKL"`** for any ora it doesn't
  recognize. `AMADEUS_NDCX` has no `CONTROLLERS` entry today, so pressing
  "émettre" on an NDC[X] folder silently POSTs a live issuance payload to
  **AFKL's** controller instead of erroring. Override `issueOrder()` for
  NDC[X] in `BaseAdapter`/its subclass before this ships to real users.

### OrderCancel

- SABRE's cancel model (retrieve → dedicated quote op → branch on
  voidable/refundable) **does not exist for NDC[X]** —
  `AMA_TravelOrderCancelRQ` has no dry-run/quote flag, and
  `Travel_OrderReshop` only reprices/rebooks; it is not a cancel quote. Don't
  assume a quote step is available.
- VOID/REFUND classification must come **post-hoc from the cancel reply's
  coupon statuses** (`CouponStatusCode === "V"`), not inferred pre-hoc from
  `ChangeFees`/`PenaltyAmount === 0` (an inference, not a documented signal).
  Do not ship the ticketed VOID/REFUND branch until a real ticketed-cancel
  capture confirms the shape — a wrong classification writes the wrong
  `pnr.status`, `refundedAmount`, and accounting record.
- 🔴 **Live-host hazard, must land with cancel**: NDC[X] always writes a
  `"PNR AMADEUS: <recloc>"` note (two `pnrList` entries: carrier + `1A`).
  `updateCancel`'s existing guard against firing a live Amadeus
  passive-PNR cancellation checks `!NDCSabres.includes(pnr.ownerCode)` — and
  `"AMADEUS_NDCX"` is not in that list, so **the guard does not protect
  NDC[X]**. Without widening it, every NDC[X] cancel opens a live stateful
  Amadeus session against the airline's own real order and writes a status
  remark onto it. Fix this in the same change that ships cancel, not after.

### Shared code / process

- Dossier persistence (`dossier.utils.js`, `pnr.service.js`) is shared across
  every provider — prefer adding NDC[X]-specific call sites over editing
  shared function bodies, and name every shared-file touch explicitly in the
  PR description (this is now the third such change: the `pnrList` write, the
  journeys-gate widening, and the cancel guard widening).
- Adding a new NDC[X] operation only requires dropping a correctly-shaped
  `*.controller.js` into `src/controllers/AMADEUS_NDCX/` —
  `getControllerFiles()` merges by folder name already. Don't add unneeded
  dispatcher edits in `global.controller.js`.
- There is **no generic `/orderPayRQ` route** — it's a dedicated
  `POST /AMADEUS_NDCX/order/orderPayRQ`, not an extension of the shared
  dispatcher (which `?.`-guards the module, not the method — a generic route
  would 500 for every provider lacking `orderPayRQ`).
- `/offerPriceRQ` is dispatched through a wrapper that expects the controller
  to *return* the response object; `/orderCreateRQ`/`/orderRetrieveRQ`/
  `/orderPayRQ` are dispatched with real `(req, res, next)` and the controller
  owns the HTTP response directly. Don't copy `offer.controller.js`'s
  `sendError`-returns-an-object override into `order.controller.js`.

## 4. Where the full detail lives

This file is intentionally short. For anything beyond a one-line reminder:

- [`NDCX-INTEGRATION.md`](./NDCX-INTEGRATION.md) — status, locked decisions, open questions (source of truth)
- [`NDCX-OFFERPRICE-PLAN.md`](./NDCX-OFFERPRICE-PLAN.md) — Travel_OfferPrice traps in full
- [`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md) — ADRs 1-12
- [`NDCX-ORDERCREATE-REVIEW.md`](./NDCX-ORDERCREATE-REVIEW.md) — the identity-doc / contact-info bug writeup
- [`NDCX-ORDERCREATE-FINISH-PLAN.md`](./NDCX-ORDERCREATE-FINISH-PLAN.md) — the currency-metadata array bug
- [`NDCX-ORDERPAY-PLAN.md`](./NDCX-ORDERPAY-PLAN.md) — ADRs 15-20
- [`NDCX-ORDERCANCEL-PLAN.md`](./NDCX-ORDERCANCEL-PLAN.md) — ADRs 21-26
- `.agents/skills/ndcx/` — Amadeus protocol reference (skill), not project-specific decisions
