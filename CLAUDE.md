## metis

### What this is
- This is a **meta-repo / workspace orchestrator** for the "metis" project — a multi-service booking platform.
- Two operating modes:
  - **Travel Agent (TA) mode** — back-office flow for travel agents.
  - **OBT / SBT (self-booking) mode** — the agency's client books for itself: either the client user logs in, or an agent impersonates the client via the SBT toggle at shopping. See `docs/business/concepts/obt-mode.md`.
- It does not contain product code. It orchestrates the sub-repos below.
- **All actual work happens in the sub-repos** — feature branches, commits, bug fixes, everything. This meta-repo root has no feature/ticket branches (only `master`/`dashboard`); never try to commit or branch here for product work.

### Sub-repos
Declared in `metis.repos.json`, toggled via `"enabled"`. Enabled repos appear in `metis.code-workspace`.

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
- **Adding or toggling a sub-repo**: edit `metis.repos.json`, clone the repo, and update `metis.code-workspace` by hand.
- **Keeping a feature branch current**: `./metis pull [repo...]` merges `origin/development` into each enabled repo's current branch (fast-forwards on `development`; skips dirty repos; leaves conflicts for you to resolve). `--dry-run` previews it.
- **Default branch**: `development`. Do not commit to `main` from this workspace.
- **Dev servers**: `./metis dev` opens the tmux session `metis` with `api-aerial`, `api-dashboard` and `front-reservation` (it may prompt for `sudo` to bring the VPN up). Manage it with `./metis attach | stop | restart <aerial|dashboard|front> | status`. `./metis help` lists every command, including `vpn`.
- The VS Code tasks and launch configs were removed from `metis.code-workspace`; `./metis` replaces them.
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
