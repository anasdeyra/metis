## metis

### What this is
- This is a **meta-repo / workspace orchestrator** for the "metis" project — a multi-service booking platform.
- Two operating modes:
  - **Travel Agent (TA) mode** — back-office flow for travel agents.
  - **OBT / SBT (self-booking) mode** — the agency's client books for itself: either the client user logs in, or an agent impersonates the client via the SBT toggle at shopping. See `docs/business/concepts/obt-mode.md`.
- It does not contain product code. It orchestrates the sub-repos below.

### Sub-repos
Declared in `metis.repos.json`, toggled via `"enabled"`.

| Repo | Role |
|---|---|
| `api-aerial` | Flight booking API (Node.js / Express) |
| `api-car` | Car rental booking API (Node.js / Express) |
| `api-hotel` | Hotel booking API (Node.js / Express) |
| `api-rail` | Rail booking API (Node.js / Express) |
| `api-dashboard` | Back-office API (Node.js / Express) |
| `front-dashboard` | Admin dashboard UI (Nuxt 3 / Vue 3) |
| `front-reservation` | Booking engine UI (Nuxt 3 / Vue 3) |
| `obsidian-brain` | Shared Obsidian vault (notes, ADRs) |

### How to work here
- Product code lives in the sub-repos. **Operate inside the relevant sub-repo directory, not in the meta-repo root.**
- Do not commit product code into this meta-repo. The meta-repo only tracks orchestration files.
- **Adding or toggling a sub-repo**: edit `metis.repos.json` and clone the repo.
- **Keeping a feature branch current**: `./metis pull [repo...]` merges `origin/development` into each enabled repo's current branch (fast-forwards on `development`; skips dirty repos; leaves conflicts for you to resolve). `--dry-run` previews it.
- **Default branch**: `development`. Do not commit to `main` from this workspace.
- **Dev servers**: `./metis dev` opens the tmux session `metis` with `api-aerial`, `api-dashboard` and `front-reservation`. Manage it with `./metis attach | stop | restart <aerial|dashboard|front> | status`. `./metis help` lists every command.
- For sub-repo internals, defer to the sub-repo's own `AGENTS.md` / `CLAUDE.md` if present.

### Business domain knowledge
Business vocabulary lives in `docs/business/` (workspace root). It is loaded on demand, never in bulk.

- Unfamiliar or French term (dossier, émission, PDV, ora, TTL, MCTO…) → `docs/business/glossary.md` first, then the linked page under `concepts/` or `workflows/`.
- Never infer a business meaning from a variable name. Check the glossary's "Don't confuse with" column: booking mode ≠ PNR status ≠ approval state, PNR ≠ Order ≠ dossier ≠ ticket, cancel ≠ void ≠ refund ≠ retain, canal ≠ booking mode.
- Entries marked ⚠️ are inferred, not confirmed. Treat them as hints.
- **Gate for business-rule changes**: before implementing or changing a business rule (statuses, issuance, payment, cancellation/refund, approvals, routing), or when a term is ambiguous, state your interpretation in one or two lines, cite the glossary page or code path it rests on, and ask if it is still uncertain. Trivial tasks skip this.
- Never invent a business rule or treat two similar terms as interchangeable. If the docs and code don't settle it, ask.
- Keep it current: a change that introduces a business concept or changes a rule updates `docs/business/` in the same change. The MR checklist is in `docs/business/README.md`.
- NDC[X] protocol detail: `.agents/skills/ndcx/`. Engineering history of MET2-2422: `docs/archive/ndcx/`.
