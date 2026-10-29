# NDC[X] Order Booking — Review Checklist (MET2-2422)

Review companion to [`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md) (the build
plan) for the `Travel_OrderCreate`/`Travel_OrderRetrieve` + shared OrderView-mapper step.
Repos: `api-aerial` (branch `deyra-met2-2422`), `front-reservation`. Written 2026-09-07
against the author's own brief plus a hands-on review of the diff (ran the builders
against a real captured `front-reservation` req.body, not just the synthetic fixtures).

**Status at time of writing:** two real defects found and fixed during this review (see
§1); one builder call was then disabled mid-review and is currently **not producing
`IdentityDoc` at all** (§2) — needs a decision before merge. Nothing in this file has run
against a live Amadeus host; that gate is unchanged from the plan's §9 Definition of Done.

---

## 1. Found during review, fixed — re-verify

Both confirmed by requiring `order.utils.js` directly and running
`createNdcxOrderCreatePayload()` against a real captured `req.body`
(`api-aerial/body.ts`), not the hand-written test fixture. The captured body reproduced
the actual `"Unable to proceed - Failed on provider side"` symptom's likely cause.

- [x] **`docTypeCode()` dead branch.** Switch matched the literal `"CNI"`, which nothing
      in the codebase ever produces — the app's own profile utils (`AMADEUS/profile.utils.js`,
      `SABRE/import.utils.js`) emit the French label `"Carte d'identité"` for a national ID
      card. Result: `IdentityDocTypeCode` silently came out `undefined` and was dropped
      from the wire entirely for exactly this (very common) document type, despite every
      real NDCX example message populating it as mandatory. Fixed: added the
      `"Carte d'identité"` case alongside `"CNI"`.
- [x] **`buildContactInfo()` scalar assumption.** `contactInfo.phoneNumber`/`emailAddress`
      arrive from the real front payload as arrays of profile records
      (`phoneNumber: [{ number, ... }]`, `emailAddress: [{ email, ... }]`), not the plain
      scalar the hand-written `REQ_BODY` test fixture uses. Before the fix this produced
      the literal string `"[objectObject]"` as `PhoneNumber` and a whole serialized object
      where `EmailAddressText` should be a string — sent to Amadeus as-is. Fixed: added
      `extractContactValue()` to pull `.number`/`.email` out of either shape.
- [x] Both fixes verified against the real captured body (clean output, no garbage
      strings) **and** against the existing hand-written fixtures (all passed unchanged).
      Two new regression tests added to `ndcx-order-create.utils.test.js` pinning both
      shapes.
- [ ] **Re-verify** the docTypeCode fix and the ContactInfo fix are still both present and
      correct at merge time — see §2, the file changed again after this fix landed.
- [ ] `AFKL/order/orderCreate.utils.js`'s `getDocType()` has the **exact same** `"CNI"`
      dead-branch bug (that's where NDCX's `docTypeCode()` was copied from, per its own
      comment). Out of scope for this branch, but worth its own ticket — same root cause,
      same silent-drop symptom, different provider.

## 2. ⚠️ Needs a decision before merge — IdentityDoc builder is currently disabled

`order.utils.js:132-133` (the two lines that call `buildIdentityDoc()` and attach its
result to `element.IdentityDoc`) are commented out on disk right now:

```js
// const identityDoc = buildIdentityDoc(pax);
// if (identityDoc) element.IdentityDoc = [identityDoc];
```

This was done mid-review, marked "it's the issue" — flagging for explicit follow-up
rather than silently accepting the disable:

- **Current effect:** `Travel_OrderCreate` now sends **no `IdentityDoc` at all**, for any
  passenger, regardless of document data quality. Every prime-booking example in
  `.agent/skills/ndcx/examples/` populates `IdentityDoc` on every passenger — this is a
  bigger regression than the two bugs in §1 (those produced a *malformed* doc; this
  produces *no* doc).
- **The two concrete defects actually found in this builder** (§1's `docTypeCode` +ContactInfo
  bugs live in the same function family, not literally inside `buildIdentityDoc`/
  `docTypeCode` isn't inside `buildContactInfo`, but `docTypeCode` **is** called from
  `buildIdentityDoc`) are already fixed and verified against the real captured body.
  `buildIdentityDoc()` itself produced a clean, correct `IdentityDoc` node once
  `docTypeCode()` was fixed (see the earlier verification run: `IdentityDocNumber`,
  `IdentityDocTypeCode: "I"`, `IssuingCountryCode`, `CitizenshipCountryCode`, names,
  `ExpiryDate` all populated correctly for the captured passenger).
- **Action needed:** either
  1. re-enable the two commented lines now that `docTypeCode` is fixed and re-run against
     a live host to confirm the provider error is actually resolved, or
  2. if disabling it did NOT clear the provider error, that's useful signal that the root
     cause is elsewhere (§4/§5) — but then `IdentityDoc` needs to come back before this
     ships, since omitting it entirely is very unlikely to be correct for most carriers/fare
     types, and untangling "no doc sent" from "wrong field elsewhere" makes future
     debugging harder.
- **Dead code left behind:** `buildIdentityDoc()` (`:177`) and `docTypeCode()` (`:215`)
  are now unreferenced from anywhere in the file — will be flagged as unused if a linter
  is run. Not a correctness issue, just noise while this is disabled.
- **Test impact:** the regression test added in §1 for `IdentityDocTypeCode` now fails
  (`Cannot read properties of undefined (reading '0')` — `element.IdentityDoc` is
  `undefined`). `node --test src/utils/__tests__/ndcx-order-create.utils.test.js` currently
  reports `5 pass / 1 fail`. Re-enable the builder or update the test to match the
  deliberate omission — don't leave a red test in the suite.

## 3. Corrections the author made to the plan text (spot-checked against code, hold up)

- [x] Redress is `Pax.RedressProgram[]`, its own top-level element — not a `Visa` entry.
      Confirmed in `order.utils.js:232-236` (`buildRedressProgram`), matches the file
      header's claim about `Pax.d.ts`.
- [x] Request-side field is `IdentityDocNumber`, not the reply-side `IdentityDocID`.
      Confirmed in `buildIdentityDoc()` (`:197`).
- [ ] Neither correction has an independent second source in this session (no access to
      the vendored `.d.ts` files was used in this review) — the WSDL-type citations
      couldn't be re-verified, only that the code is internally consistent with what the
      comments claim. Low risk, but note for whoever has WSDL access.

## 4. Flagged by the author, not fixed — carry into live testing (§7 of the plan)

Everything below is already called out in-code and in the plan; listed here as a flat
checklist so it isn't lost among the prose.

- [ ] No live capture exists for this step — nothing in `order.utils.js`,
      `orderViewReply.mapper.js`, or `penalty.utils.js` has run against a real Amadeus
      NDC[X] test-office host. This is the big one; everything else is downstream of it.
- [ ] Penalty merge (`mergeAndWrapPenalties`, `orderViewReply.mapper.js:206`) matches on
      `(TypeCode, AppCode)` only, not `+segList` — `OfferPriceRs.Fare[]` carries no
      segment refs to key on. Safe for single-fare-component itineraries; verify against a
      multi-segment fare component sharing a `(TypeCode, AppCode)` pair before trusting it
      for complex itineraries.
- [ ] `FareDetail.FarePriceType.Price` (Level-3 fee breakdown) is not populated — wire
      shape unconfirmed without a live capture. `pnr.totalPrice` (the highest-risk figure,
      ADR-10) does not depend on it, so this is lower priority, but any per-item surcharge
      display will show wrong/missing data until fixed.
- [ ] `TicketDocInfo` mapping (`orderViewReply.mapper.js:252`, `buildTicketDocInfo`) is
      best-effort — never exercised, since `OrderCreate` has no tickets yet
      (`isTicketed: false`). Must be verified against a real `Travel_OrderPay` or
      `Travel_OrderRetrieve` RS before a ticketed booking relies on it.
- [ ] Contact `LabelText` values `R`/`D` (postal address labels) from the plan text —
      author could not ground them in the WSDL types, so omitted rather than guessed.
      Confirm whether anything needs a postal-address contact before shipping, or drop the
      concern.
- [ ] **Blocking, still open (plan §8):** does `body.paxs` actually carry `Birthdate` and
      `GenderCode` end-to-end from the front? `createNdcxOrderCreatePayload` now throws a
      clear 400 at `OrderCreate` if either is missing (instead of silently failing later at
      `Travel_OrderPay`), which is strictly better, but the underlying question — does the
      front actually send these — is not verified. Needs a real front-to-back trace.

## 5. Other open questions carried from the plan (§8) — resolve while testing, don't assume

- [ ] **`available` semantics for penalties** (`dossier.utils.js:1404`,
      `available = !(DescText === "NAV")`). NDC[X]'s `RuleMetadata.Instruction` is
      `"Not allowed"`, which under that test yields `available: true` — the **opposite**
      of the intent. Confirm what the front actually renders from
      `conditions.CancellationPDE` before this ships — otherwise agents will be told a
      non-refundable fare is refundable. Highest-severity open question in the whole plan.
- [ ] Corporate/OSI (`ADR-14`) — `addOsion` will not fire for NDC[X] this pass. Decide
      whether that's acceptable for the pilot scope or needs the `CORPORATE_ID` →
      `CORPORATE` normalization.
- [ ] Is `Order/PaymentInfo` (the FOP catalogue) populated at create for the actual pilot
      carrier(s)? AF-OIN returns it, AF-Public doesn't until after pay. If the pilot
      carrier behaves like AF-Public, the front's payment step needs the catalogue from
      `Travel_OfferPrice`'s `Response/Payments` instead — itself still open in
      `NDCX-OFFERPRICE-PLAN.md` §8.
- [ ] `Order/OrderItem/StatusCode` values beyond `HK` — only `HK` appears in the captures
      used so far. Confirm the full NDC[X] vocabulary before cancel/change work starts.
- [ ] Duplicate-booking guard (rule ERR-04, look-to-book 1000:1 cap GEN-02/GEN-04) —
      `bookFlight()` has no in-flight guard yet. Decide MET2-2345 token pattern vs.
      something stronger before this is user-facing.
- [ ] SOAPAction version — confirm `NdcxClient.js` declares `Travel_OrderCreate_1.7` /
      `Travel_OrderRetrieve_1.7` per the guide's service list, before debugging what would
      otherwise look like a content rejection but is actually a version mismatch.

## 6. Definition of done (unchanged from the plan §9 — repeated here for one-stop tracking)

All unchecked; needs a live Amadeus NDC[X] test-office session + DB, neither available in
the session that wrote this code or in this review.

- [ ] `POST /orderCreateRQ` with `oras: ["AMADEUS_NDCX"]` and a real priced NDC offer
      creates an order and returns a populated `DossierCreate` payload.
- [ ] A dossier + pnr row exist, with `pnr.orderId = "NDCX-<OrderID>"`, `pnr.pnr` = the
      airline recloc, `pnr.status = 1` (held), `pnr.ownerCode = "AMADEUS_NDCX"`, and
      `pnr.pnrList` holding both reclocs.
- [ ] Two internal notes on the dossier: `PNR AF: …` and `PNR AMADEUS: …`.
- [ ] `pnr.totalPrice` matches the airline's total to the cent (ADR-10) — the 100× trap is
      the single highest-risk defect in this step.
- [ ] `pnr.journeys` is populated (ADR-8's widened gate).
- [ ] Segment `conditions` rows populated with non-null `PDE`/`ADE` values (ADR-11) —
      verifying the normalizer *and* the price carry-over.
- [ ] `POST /orderRetrieveRQ` on that dossier round-trips through the same mapper and
      updates it via `saveAfterRetreive` without creating a second dossier.
- [ ] Own-office RQ/RS captured for create **and** retrieve, committed as fixtures.
- [ ] `ndcx-orderview-reply.mapper.test.js` green, including the
      same-function-both-fixtures assertion.
- [ ] `offerPriceReply.mapper.js`'s `AppCode`/`TypeCode` fixed and covered.
- [ ] `NDCX-INTEGRATION.md` §3/§4 items ticked; Trap 1 corrected in
      `NDCX-OFFERPRICE-PLAN.md`.

## 7. Shared-code blast radius — review carefully, not NDC[X]-scoped

- [ ] `dossier.utils.js:1139` (`if (dataRS?.Order?.pnrList?.length) pnr.pnrList = ...`) —
      additive, but also starts populating `pnr.pnrList` for **classic AMADEUS retrieve**,
      which already sets `Order.pnrList` (`formatRetrieve.utils.js:34`). Confirmed benign
      (fills a column already typed, nothing else writes it today) but is a behavior change
      outside NDC[X] — call it out explicitly in the PR description, don't let it hide in a
      "two additive lines" summary.
- [ ] `dossier.utils.js:1123` — journeys gate widened to include `"AMADEUS_NDCX"` for the
      **create**-path only (`dossierCreate`); the retrieve-path gate
      (`saveAfterRetreive`, ~`:3811`) was deliberately **not** widened. Confirm this
      asymmetry is intentional and still holds — a fresh retrieve-time journeys recompute
      is skipped for NDC[X], relying on the value set at create persisting. Revisit if an
      orderChange re-quote ever changes the itinerary before retrieve.

## 8. Pre-merge checklist (roll-up)

- [ ] §2 decision made (re-enable `IdentityDoc` vs. confirmed-necessary removal) and the
      failing regression test in `ndcx-order-create.utils.test.js` is green again.
- [ ] `node --test src/utils/__tests__/*.test.js` fully green (currently 5 pass / 1 fail
      in the order-create suite because of §2).
- [ ] §1's two fixes (docTypeCode, ContactInfo) still present and unmodified.
- [ ] §7's two shared `dossier.utils.js` changes explicitly called out in the PR
      description (not buried as "two additive lines").
- [ ] §5's `available`/`"NAV"` question answered before this reaches an agent-facing
      environment — wrong-direction refundability messaging is a real user-facing risk,
      not just a code-quality note.
- [ ] A live-host pass against a real NDC[X] test office (§4, §6) scheduled — nothing here
      substitutes for it.
