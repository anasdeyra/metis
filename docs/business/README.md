# Business Domain Knowledge Base

Canonical business vocabulary for the metis platform. Target audience: AI coding
agents (and new humans) working in the sub-repos. Goal: nobody re-explains what
OBT, dossier, or pre-issuance means in a session, and nobody *guesses*.

## How to consult (agents: follow this order)

1. Unfamiliar term → [`glossary.md`](glossary.md) (definition, aliases incl.
   French, "don't confuse with", code anchors).
2. Task touches an area → the matching page under
   [`concepts/`](concepts/) or [`workflows/`](workflows/) (deep dives, links to
   implementation).
3. NDC[X] / Amadeus protocol detail → `.agents/skills/ndcx/` (skill, ~9,000
   lines of reference) and captured messages in `api-aerial/use cases/`.
4. Architectural decisions → [`../adr/`](../adr/).

## Layering (progressive context loading)

| Layer | What | Loaded |
|---|---|---|
| 1 — index & rules | root `AGENTS.md` / `CLAUDE.md` | always |
| 2 — business knowledge | this folder | on demand, start at glossary |
| 3 — implementation | sub-repo source + `.agents/skills/ndcx/` + `use cases/` | on demand |

## Coverage (v1)

- **Cross-cutting core** — operating modes (TA / OBT / SBT), actors, dossier,
  PNR/Order/ticket, booking lifecycle.
- **Aerial / Amadeus NDC** — providers, shopping→booking chain, NDC traps.
- **Payments & financials** — payment methods, facturation, margins, refunds.

Out of scope for now: hotel / car / rail specifics, obsidian-brain.

## Conventions

- **Canonical term** is the bold name; aliases (including French) follow it.
  Code identifiers appear in backticks.
- ⚠️ **Verify** — drafted from code/docs inference, not confirmed by the domain
  owner. Treat as a hint, not truth, and help correct it.
- Every entry anchors to code (`repo/path`) so agents start exploration in the
  right place. Paths are relative to the workspace root.
- Don't duplicate detail: glossary = one-liners; depth lives in concepts /
  workflows; protocol depth lives in the ndcx skill.

## Maintenance rules

1. New business concept → add a glossary row (and a concept/workflow page if
   it's load-bearing) **in the same change** that introduces it.
2. Changed business rule → update the matching page.
3. PR checklist for business-logic changes:

```markdown
## Business domain changes
- [ ] New business concept introduced? → documented in docs/business/
- [ ] Existing business rule modified? → matching doc updated
- [ ] Glossary rows still accurate (incl. "don't confuse with")?
- [ ] Code anchors still point at the right files?
```

## Index

**Concepts** ([concepts/](concepts/))
- [OBT mode & SBT mode](concepts/obt-mode.md) — operating modes, roles
- [Dossier](concepts/dossier.md) — the internal booking record
- [PNR, Order, ticket, dossier](concepts/pnr-order-ticket.md) — the four record layers
- [Provider, ora, canal](concepts/provider-ora.md) — multi-provider dispatch, distribution channel
- [Sales point (PDV)](concepts/sales-point.md) — offices, credentials, WSAP
- [Issuance](concepts/issuance.md) — émission, pre/post-issuance

**Workflows** ([workflows/](workflows/))
- [Booking lifecycle](workflows/booking-lifecycle.md) — search → hold → pay → service, PNR status codes
- [Cancellation, void, refund](workflows/cancellation-void-refund.md)
- [Approbation flow](workflows/approbation-flow.md) — reservation approvals

**Archived ticket docs** — the NDCX-* working docs for MET2-2422 live in
[`../archive/ndcx/`](../archive/ndcx/); their durable terminology has been
distilled here, full engineering detail stays there.
