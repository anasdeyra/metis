# Metis Workspace Orchestrator

This repository is a central "shell" for the Metis monorepo. It manages a unified VS Code development environment for multiple independent services and frontend applications using a configuration-driven approach.

## 🚀 Quick Start

To set up your development environment:

1.  **Configure your workspace**:
    Edit `metis.repos.json` and set `"enabled": true` for the repositories you want to work on, clone them next to this file, then reload `metis.code-workspace`.

2.  **Start the dev servers**:
    Opens a tmux session with `api-aerial`, `api-dashboard` and `front-reservation`:
    ```bash
    ./metis dev
    ```

## 📁 Repository Structure

The workspace orchestrates the following core Metis projects:

| Repo Name | Role | Technology |
| :--- | :--- | :--- |
| `api-car` | Car Rental Booking API | Node.js / Express |
| `api-aerial` | Flight Booking API | Node.js / Express |
| `api-dashboard` | Back-office API | Node.js / Express |
| `api-hotel` | Hotel Booking API | Node.js / Express |
| `api-rail` | Rail Booking API | Node.js / Express |
| `front-dashboard` | Admin Dashboard | Nuxt 3 / Vue 3 |
| `front-reservation` | Booking Engine | Nuxt 3 / Vue 3 |
| `obsidian-brain` | Shared Obsidian vault — product & engineering notes, runbooks, and ADRs | Obsidian / Markdown |

## 🛠️ Developer Tools

### The `./metis` CLI
A single bash entry point (Linux) for everyday work. Run it from the repo root; `./metis help` lists everything.
Requires `bash`, `node`, `tmux` >= 3.2 and `ss`; the VPN commands also need `sudo`.

| Command | What it does |
| :--- | :--- |
| `./metis dev [--vpn] [--restart] [--detach] [--dry-run]` | Start `api-aerial` (`:8080`), `api-dashboard` (`:8081`) and `front-reservation` (`:3000`) in the tmux session `metis`. |
| `./metis attach` | Attach to the running session (switches client when already inside tmux). |
| `./metis stop [--dry-run]` | Kill the session, then report any process still listening on the server ports. |
| `./metis restart <aerial\|dashboard\|front> [--dry-run]` | Restart a single pane without touching the others. |
| `./metis status` | Show the session, the VPN tunnel and the state of each server port. |
| `./metis pull [repo...] [--dry-run]` | Merge `origin/development` into the current branch of each enabled repo (or the named ones) to keep feature branches up to date. Fast-forwards when on `development`; skips repos with uncommitted changes; leaves conflicts in place to resolve. |
| `./metis vpn setup\|up\|down\|status` | Manage the FortiGate IKEv1 VPN (strongSwan, see `scripts/vpn/`). |

**The dev session** is a single tmux window: the two APIs side by side on top, `front-reservation` as a thin strip below, each pane labelled with its repo name. Every pane runs `npm run dev` with the Node version active in your shell, and drops to an interactive shell in the service folder when the server exits. Before starting, `dev` checks that the sub-repos are cloned with `node_modules` installed and that the ports are free, and brings the VPN up if the tunnel is not established (this asks for your `sudo` password). If the session already exists you are asked whether to attach or restart. Tmux settings are scoped to the `metis` session; nothing global is changed.

### Unified VS Code Environment
Open `metis.code-workspace` to access:
- **Dynamic Multi-Root Folders**: Only your enabled repositories appear in the sidebar.
- **Selective Search**: Search results automatically exclude disabled repository directories.

---
*Maintained by the Metis Platform Team.*
