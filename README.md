# Metis Workspace Orchestrator

This repository provides a unified development environment inside VSCode for multiple independent services and frontend applications.

## 🚀 Quick Start

To set up the entire development environment from scratch:

1.  **Clone this repository**:
    ```bash
    git clone <this-repo-url> metis
    cd metis
    ```

2.  **Initialize all sub-projects**:
    Run the sync task (via VS Code or terminal):
    ```bash
    node tasks/sync_all.js
    ```
    This script will read the `metis.code-workspace` configuration and automatically clone any missing repositories and pull the latest changes for existing ones.

## 📁 Repository Structure

This is a **monorepo shell** that orchestrates the following services:

| Name | Role | Technology |
| :--- | :--- | :--- |
| `api-aerial` | Flight Booking API | Node.js / Express |
| `api-dashboard` | Back-office API | Node.js / Express |
| `api-hotel` | Hotel Booking API | Node.js / Express |
| `api-rail` | Rail Booking API | Node.js / Express |
| `front-dashboard` | Admin Dashboard | Nuxt 3 / Vue 3 |
| `front-reservation` | Booking Engine | Nuxt 3 / Vue 3 |

## 🛠️ Developer Tools

### Unified Workspace
Open `metis.code-workspace` in VS Code to get a multi-root view of all projects. This enables:
- **Shared Debugging**: Launch multiple APIs and frontends simultaneously.
- **Global Search**: Search across all repositories at once.
- **Custom Tasks**: Access specialized Metis scripts directly from the Command Palette (`Ctrl+Shift+P` -> `Tasks: Run Task`).

### Key Scripts
- **Sync All** (`tasks/sync_all.js`): Clones missing repos and updates all projects to the latest `development` branch.
- **Hard Reset** (`tasks/hard_reset.js`): Quickly reset any repository to the latest development state, discarding local changes.

## ⚙️ Adding a New Repository

To add a new repository to this workspace:
1.  Run the "Add Repo" task (accessible via VS Code tasks).
2.  Or manually add an entry to the `folders` array in `metis.code-workspace` and add the directory name to `.gitignore`.
3.  Run `Sync All` to download the new repository.

---
*Maintained by Anas Deyra.*
