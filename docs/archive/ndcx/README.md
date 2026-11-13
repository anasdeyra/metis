# Archived: NDC[X] integration ticket docs (MET2-2422)

Working docs from the Amadeus NDC[X] integration in `api-aerial` (branch
`deyra-met2-2422`) and `front-reservation`. They moved here from the
workspace root on 2026-11-13. Filenames are unchanged, so bare-name mentions
in `api-aerial` code comments (e.g. "NDCX-ORDERPAY-PLAN.md ADR-18") still
resolve with a filename search.

**Start somewhere else.** Durable vocabulary and rules from these files were
distilled into [`docs/business/`](../../business/README.md). Protocol detail
lives in the `.agents/skills/ndcx/` skill. Come here for the engineering
history: ADRs, superseded decisions and why they were superseded, plus
per-operation plans.

| File | Content |
|---|---|
| `NDCX-INTEGRATION.md` | Overall status, locked decisions, open questions |
| `NDCX-CONTEXT.md` | Guardrails and traps found along the way |
| `NDCX-OFFERPRICE-PLAN.md` | ADR-1…5 — pricing |
| `NDCX-ORDERCREATE-PLAN.md`, `-FINISH-PLAN.md`, `-REVIEW.md` | ADR-6…14 — hold and retrieve |
| `NDCX-ORDERPAY-PLAN.md`, `NDCX-PAYMENT-PLAN.md` | ADR-15…20 and the payment follow-ups — pay and issuance |
| `NDCX-ORDERCANCEL-PLAN.md` | ADR-21…30 — cancel, void, refund (ADR-27/28 supersede 22/24) |
| `NDCX-FLIGHTMODIFICATION-PLAN.md` | Exchanges and flight changes |
| `NDCX-SERVICELIST-PLAN.md`, `NDCX-ANCILLARIES-PLAN.md`, `NDCX-SEATMAP-PLAN.md`, `NDCX-UPSELL-PLAN.md`, `NDCX-UPDATEPAX-PLAN.md` | Ancillaries, seats, upsell, passenger update |
| `NDCX-CHECKLIST-AMADEUS.md`, `NDCX-REPONSE-DEYRA-2026-10-18.md` | Amadeus certification checklist and the reply draft |

ADR numbers are allocated per file. Do not renumber them.
