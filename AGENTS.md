## metis

### What this is
- This is a **meta-repo / workspace orchestrator** for the "metis" project — a multi-service booking platform.
- Two operating modes:
  - **Travel Agent (TA) mode** — back-office flow for travel agents.
  - **OBT (Online Booking Tool) mode** — self-service booking flow.
- It does not contain product code. It orchestrates the sub-repos below.

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
- For codebase questions, prefer `graphify` (see below). It indexes this meta-repo; for sub-repo internals, defer to the sub-repo's own `AGENTS.md` / `CLAUDE.md` if present.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
