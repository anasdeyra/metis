---
description: Comprehensive end-to-end workflow for an AI agent to set up, solve, commit, and push a Linear issue using isolated worktrees.
---

# Solve Linear Task (End-to-End Workflow)

This workflow defines the complete lifecycle for taking a Linear issue from the backlog to a pushed branch, ensuring isolated environments and minimal repository clutter.

When asked to "solve" or "work on" a Linear issue, follow these exact steps sequentially.

## 1. Prepare Workspace

Generate the isolated worktrees for all Metis repositories based on the issue ID.

// turbo
```bash
# Must be executed from the Metis root directory
node scripts/setup_linear_worktree.js <issue-id>
```

Wait for this script to complete successfully. It will create `worktrees/<issue-id>/` containing the repositories and `issue.json`.

## 2. Load Issue Context

Read the dumped issue details to understand the requirements and the branch name.

```javascript
// Internal Agent Action: View File
// View the contents of: worktrees/<issue-id>/issue.json
```
Review the title, description, and any acceptance criteria provided in the JSON file.

## 3. Solve the Issue

Implement the required changes. **Crucial Rule:** All file edits and script executions (like `npm run dev` or tests) must happen *exclusively* within `worktrees/<issue-id>/<target-repo>/`. Do not touch the root repositories.

> [!NOTE]
> do not npm install or npm install a packaged

### Committing Work

Prefer **frequent, small, and descriptive commits** as you make progress.
For each sub-project you modify:

// turbo
```bash
cd worktrees/<issue-id>/<target-repo>
git add .
git commit -m "feat(<component>): <descriptive message of what was solved>"
```

## 4. Prune Unchanged Worktrees

Before pushing, clean up any repositories that were generated but not modified. This guarantees that only the code you actually worked on is submitted.

// turbo
```bash
# Return to Metis root
cd ../../.. 
node scripts/prune_unchanged_worktrees.js <issue-id>
```

> [!NOTE]
> This command safely removes unchanged worktrees using `git worktree remove --force`. Only the repositories you modified will remain in the `worktrees/<issue-id>/` directory.

## 5. Push to Remote Branch

For every remaining repository in the `worktrees/<issue-id>/` directory, push your commits to the remote branch.

// turbo
```bash
# Execute this for EACH remaining repository in the worktree
cd worktrees/<issue-id>/<remaining-repo>
git push --force origin HEAD
```

## 6. Wrap Up

Inform the USER that the task is complete, the unchanged worktrees have been pruned, and the modified branches have been pushed to the remote.

**important do not open a merge request**