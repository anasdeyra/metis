# Metis Workspace Orchestrator

This repository is a central "shell" for the Metis monorepo. It manages a unified VS Code development environment for multiple independent services and frontend applications using a configuration-driven approach.

## 🚀 Quick Start

To set up your development environment:

1.  **Configure your workspace**:
    Edit `metis.repos.json` and set `"enabled": true` for the repositories you want to work on.

2.  **Apply configuration**:
    Run the setup script to update VS Code settings and `.gitignore`:
    ```bash
    node tasks/setup_workspace.js
    ```
    *(Or run the **"Setup Workspace"** task via `Ctrl+Shift+P` -> `Tasks: Run Task`)*

3.  **Initialize/Sync repositories**:
    Clone missing repositories and pull the latest changes:
    ```bash
    node tasks/sync_all.js
    ```
    *(Or run the **"Git: pull from dev"** task)*

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

## 🛠️ Developer Tools

### Unified VS Code Environment
Open `metis.code-workspace` to access:
- **Dynamic Multi-Root Folders**: Only your enabled repositories appear in the sidebar.
- **Shared Debugging**: Launch multiple APIs and frontends simultaneously using compiled compounds.
- **Selective Search**: Search results automatically exclude disabled repository directories.
- **Integrated Tasks**: Common git and environment operations are available via the Command Palette.

### Integrated Scripts (`tasks/`)
- **`setup_workspace.js`**: The core orchestrator. it reads `metis.repos.json` and dynamically patches:
    - `folders` in the VS Code workspace.
    - `files.exclude` in settings.
    - Path options for the `Hard Reset` task input.
    - `.gitignore` entry to prevent tracking sub-projects in the root repo.
- **`sync_all.js`**: Reads enabled projects and ensures they are cloned locally and switched to the `development` branch.
- **`hard_reset.js`**: Resets a specific repository's local branch to `origin/development`, discarding all local changes and synchronizing with the remote.

---
*Maintained by the Metis Platform Team.*
