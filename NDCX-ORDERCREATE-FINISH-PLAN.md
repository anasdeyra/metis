# NDC[X] OrderCreate — Finish Plan (MET2-2422)

Closes out [`NDCX-ORDERCREATE-PLAN.md`](./NDCX-ORDERCREATE-PLAN.md) (the build plan) and
[`NDCX-ORDERCREATE-REVIEW.md`](./NDCX-ORDERCREATE-REVIEW.md) (the review checklist, written
2026-09-07, now stale in places) into one sequenced, re-verified plan. Scope is exactly
what those two files scope: `Travel_OrderCreate` + `Travel_OrderRetrieve` + the shared
OrderView mapper. **`Travel_OrderPay` stays out of scope**, per the original plan's
explicit boundary — it's the next step, not this one.

Written 2026-09-23 from a fresh read of the actual code (`order.controller.js`,
`order.utils.js`, `orderViewReply.mapper.js`, `penalty.utils.js`) and a live test run, not
just the plan/review prose. Revised same day after a scoping pass: **IdentityDoc is
deliberately deferred** (trivial, will be resolved later, not blocking), **GenderCode is
resolved by design** (title-derivation is the only source that exists, and that's fine),
and **live-host verification is handled manually outside this plan**, not tracked here as
a gating phase.

---

## 1. Assessment — what's actually true right now

- **Tests are green.** `node --test src/utils/__tests__/ndcx-order-create.utils.test.js
  src/utils/__tests__/ndcx-orderview-reply.mapper.test.js`: 14/14 pass (12 pre-existing +
  2 new, see §2). `NDCX-ORDERCREATE-REVIEW.md` §2/§8's "5 pass / 1 fail" is stale — the
  failing `IdentityDoc` assertion was removed from the test file rather than the builder
  being re-enabled. Not revisiting that call here — see the deferral note above.
- **The `available`/`"NAV"` penalty bug — fixed, and it was worse than it looked.**
  `penalty.utils.js`'s `buildPenalties` passed `RuleMetadata.Instruction` straight through
  as `DescText` with no translation. `dossier.utils.js` (shared, ~5 call sites, e.g.
  `:1487-1489`) computes `available = !(DescText === "NAV")`, so NDC[X]'s real value
  (`"Not Allowed"`, confirmed in the real capture) always yielded `available: true` — a
  non-refundable fare reading as refundable. **Fixed in this session** — see §2.
  - **While fixing it, found the actual reason it never worked at all**:
    `Response/Metadata/Other/OtherMetadata` is an **array** on real captures
    (`[{ CurrencyMetadatas }, { RuleMetadatas }]`), not one object carrying both as
    sibling keys. `indexRuleMetadata` read `OtherMetadata.RuleMetadatas` directly, which
    is `undefined` on an array — so the `@refs` → `RuleMetadata` lookup resolved
    **nothing**, on every reply, regardless of the translation bug above.
  - **The exact same array-shape bug was silently breaking `readCurrencyDecimals`
    (ADR-10)** — the fix ADR-10 describes as closing "the single highest-risk defect in
    this step" was never actually reading real decimals metadata; it always fell back to
    the ISO-4217 table, which only "worked" by coincidence because EUR's ISO fallback (2)
    matches its real `Decimals` value. Fixed alongside, same root cause.
  - **Not fixed, found as a byproduct, out of scope for this pass**: `Detail/Application`
    is not always a single digit — the real fixture has values like `"13"`/`"12"`
    (composite: digit `1` = No-Show, `2`/`3` = before/after departure, combined), which
    `normalizePenaltyAppCode`'s `{1,2,3}` table doesn't parse, so those entries' `AppCode`
    comes out `null` instead of `NOS`/`PDE`/`ADE`. This doesn't block the NAV fix (a
    penalty with `AppCode: null` still carries the correct `TypeCode`/`DescText`), but it
    does mean some penalties won't land in the specific `CancellationPDE`/`CancellationADE`
    condition buckets `dossier.utils.js` names — flagging for whoever picks this up next,
    not fixing now.
  - **`front-reservation`'s `AmadeusNdcxAdapter.ts:104` (`getOfferCondition`) has its own,
    independent copy of the same `DescText === "NAV"` check** — but on inspection it reads
    it off the *OfferPriceRs* penalty (pre-booking), and `offerPriceReply.mapper.js` never
    passes `ruleMetadataByKey` into `buildPenalties` for that reply, so its `DescText` is
    always empty regardless of this fix. That's a **different, smaller gap** (no
    restriction signal at all pre-booking, not a mistranslation) — not fixed here, not the
    same bug as the backend one despite looking identical at a glance.
- **IdentityDoc stays disabled, on purpose (per this session's call).** `order.utils.js:
  132-133` — dead code, deferred, not blocking. Not part of this plan's remaining work.
- **GenderCode derivation from title is accepted as-is (per this session's call).**
  `front-reservation`'s pax type has no `gender` field at all, so `deriveGenderFromTitle`
  is the only source there is — not treated as an open risk going forward.
- **Live-host verification is handled manually, outside this plan.** Not tracked here as a
  gating phase; whoever runs it should still use §3 below as the checklist of what to
  confirm once a real session happens.
- **Everything else in `NDCX-ORDERCREATE-REVIEW.md` §4/§5 is still accurate and still
  open**: Level-3 fee breakdown unpopulated, `TicketDocInfo` mapping unexercised (no
  ticketed fixture exists), penalty merge keys on `(TypeCode, AppCode)` only (not
  `+segList`), SOAPAction version unverified, duplicate-booking guard missing in
  `bookFlight()`, Corporate/OSI deferred (ADR-14), FOP-catalogue-at-create behavior
  unconfirmed for the pilot carrier.
- **The two `dossier.utils.js` shared-code changes (pnrList write, journeys-gate widen)
  are still in place, additive, and still need an explicit PR-description callout** — not
  a correctness problem, a review-hygiene one.

---

## 2. Done this session

- `penalty.utils.js`: added `normalizePenaltyDescText()` — translates a `"Not Allowed"`
  `RuleMetadata.Instruction` into the `"NAV"` sentinel `dossier.utils.js` actually checks
  for; anything else (e.g. `"Allowed with Restriction"`) maps to `null`, matching the
  classic providers' "absent DescText → available" default. Exported for testing.
- `penalty.utils.js`'s `indexRuleMetadata` and `amount.utils.js`'s `readCurrencyDecimals`:
  fixed to find `CurrencyMetadatas`/`RuleMetadatas` inside the `OtherMetadata` **array**
  instead of assuming a single object (`findOtherMetadata` helper added to
  `amount.utils.js`, inlined equivalently in `penalty.utils.js`).
- Two new regression tests in `ndcx-orderview-reply.mapper.test.js`, against the real
  captured fixture: a `"Not Allowed"` penalty now maps to `DescText: "NAV"`; an
  `"Allowed with Restriction"` one maps to `DescText: null`.
- Verified against the real fixture directly (`node -e`, not just the test suite):
  `readCurrencyDecimals(fixture.Response)` now returns `{ EUR: 2 }` from real metadata,
  not the ISO fallback.
- Full suite still green: `ndcx-order-create.utils.test.js` +
  `ndcx-orderview-reply.mapper.test.js` = 14/14 pass. Confirmed the one pre-existing
  failure elsewhere (`AMADEUS_NDCX/__tests__/*` fareFamily test) predates this change
  (reproduced with these edits stashed) — unrelated, not touched.

---

## 3. What's left (not blocking, informational — do opportunistically or leave for the next pass)

- SOAPAction version constants (`Travel_OrderCreate_1.7`/`Travel_OrderRetrieve_1.7`) —
  quick grep-and-compare against `NdcxClient.js`, cheap insurance.
- Duplicate-booking guard for `bookFlight()` — decide MET2-2345 token reuse vs. something
  else; small, front-only.
- Corporate/OSI (ADR-14) — explicit accept-as-is-for-pilot call, or scope the
  `CORPORATE_ID`→`CORPORATE` normalization.
- The composite `Detail/Application` codes (`"13"`/`"12"`) found above — extend
  `normalizePenaltyAppCode` to fan out multi-digit codes if/when the missing
  `CancellationPDE`/`CancellationADE` buckets turn out to matter in practice.
- Manual live-host pass (owner's own process, not tracked step-by-step here) — once it
  happens, worth confirming: `pnr.totalPrice` to the cent, `pnr.journeys` populated,
  segment `conditions` now populated with correct `available` values (this fix), both
  reclocs in `pnr.pnrList`, retrieve updates rather than duplicates the dossier.
- PR description should explicitly call out the two shared `dossier.utils.js` changes
  (`pnrList` write, journeys-gate widen) — not buried as "two additive lines."
- Flip the relevant Definition-of-Done boxes in `NDCX-ORDERCREATE-PLAN.md` §9 /
  `NDCX-ORDERCREATE-REVIEW.md` §6 and `NDCX-INTEGRATION.md`'s checklist once this merges.

---

## 4. What this plan deliberately does not cover

- `Travel_OrderPay`, `/orderPayRQ` routing — next step, tracked in `NDCX-INTEGRATION.md`.
- `orderCancelRQ` / `orderChangeRQ` / `orderReshopRQ`, service list, seat availability —
  all still greenfield, unaffected by this plan.
- IdentityDoc re-enable, GenderCode source field — explicitly deferred per this session.
- Any fix to `AFKL/order/orderCreate.utils.js`'s identical `"CNI"` dead-branch bug
  (`NDCX-ORDERCREATE-REVIEW.md` §1) — flagged there as its own ticket, different provider.
