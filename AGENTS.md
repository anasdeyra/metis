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
- **Adding or toggling a sub-repo**: edit `metis.repos.json`, then run `node tasks/setup_workspace.js` and reload `metis.code-workspace`.
- **Cloning / syncing sub-repos to `development`**: `node tasks/sync_all.js`.
- **Discarding local changes in one sub-repo**: `node tasks/hard_reset.js <repo-name>`.
- **Default branch**: `development`. Do not commit to `main` from this workspace.
- VS Code tasks (via `Ctrl+Shift+P` → `Tasks: Run Task`): "Setup Workspace", "Git: pull from dev", "Git: Hard Reset".
- **Multi-service debug**: `metis.code-workspace` exposes launch compounds that start multiple APIs + the booking UI together.
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
