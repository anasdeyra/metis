# Graph Report - .  (2026-08-05)

## Corpus Check
- 3 files · ~13,012 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 232 nodes · 207 edges · 36 communities (24 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.73)
- Token cost: 0 input · 90,784 output

## Community Hubs (Navigation)
- [[_COMMUNITY_ADR & Context Templates|ADR & Context Templates]]
- [[_COMMUNITY_GitLab CLI (glab) Skill|GitLab CLI (glab) Skill]]
- [[_COMMUNITY_Vue 3 & Nuxt Frontend Skill|Vue 3 & Nuxt Frontend Skill]]
- [[_COMMUNITY_Code Review Dimensions|Code Review Dimensions]]
- [[_COMMUNITY_Review Severity Tags & Verdicts|Review Severity Tags & Verdicts]]
- [[_COMMUNITY_OpenCode Config|OpenCode Config]]
- [[_COMMUNITY_Linear Worktree Setup Script|Linear Worktree Setup Script]]
- [[_COMMUNITY_Solve Linear Task Workflow|Solve Linear Task Workflow]]
- [[_COMMUNITY_Worktree Cleanup Script|Worktree Cleanup Script]]
- [[_COMMUNITY_Unchanged Worktree Pruning Script|Unchanged Worktree Pruning Script]]
- [[_COMMUNITY_Workspace Setup Script|Workspace Setup Script]]
- [[_COMMUNITY_Review All MRs Workflow|Review All MRs Workflow]]
- [[_COMMUNITY_File-to-Markdown Converter|File-to-Markdown Converter]]
- [[_COMMUNITY_Git Bash Skill (Windows)|Git Bash Skill (Windows)]]
- [[_COMMUNITY_Workspace README|Workspace README]]
- [[_COMMUNITY_Sub-repo Sync Script|Sub-repo Sync Script]]
- [[_COMMUNITY_Orchestrator Docs (AGENTS.md)|Orchestrator Docs (AGENTS.md)]]
- [[_COMMUNITY_Orchestrator Docs (CLAUDE.md)|Orchestrator Docs (CLAUDE.md)]]
- [[_COMMUNITY_MR Review Publisher Script|MR Review Publisher Script]]
- [[_COMMUNITY_SCM Visibility Toggle Script|SCM Visibility Toggle Script]]
- [[_COMMUNITY_Agent-Browser Skill|Agent-Browser Skill]]
- [[_COMMUNITY_Hard Reset Script|Hard Reset Script]]
- [[_COMMUNITY_Reviewer MR Fetch Script|Reviewer MR Fetch Script]]
- [[_COMMUNITY_README Repo List Updater|README Repo List Updater]]
- [[_COMMUNITY_OpenCode Plugin Dependency|OpenCode Plugin Dependency]]
- [[_COMMUNITY_Positive Feedback Tag|Positive Feedback Tag]]
- [[_COMMUNITY_api-aerial Sub-project|api-aerial Sub-project]]
- [[_COMMUNITY_Readability Review Dimension|Readability Review Dimension]]
- [[_COMMUNITY_front-reservation Sub-project|front-reservation Sub-project]]
- [[_COMMUNITY_glab mr approve Command|glab mr approve Command]]
- [[_COMMUNITY_glab mr diff Command|glab mr diff Command]]
- [[_COMMUNITY_glab mr note Command|glab mr note Command]]
- [[_COMMUNITY_glab mr view Command|glab mr view Command]]
- [[_COMMUNITY_Graphify Tool Reference|Graphify Tool Reference]]
- [[_COMMUNITY_Review Summary Section|Review Summary Section]]

## God Nodes (most connected - your core abstractions)
1. `GitLab CLI (glab) Skill` - 11 edges
2. `Metis Frontend — Nuxt 3 / Vue 3 Skill` - 8 edges
3. `During the session` - 7 edges
4. `Solve Linear Task (End-to-End Workflow)` - 7 edges
5. `Review Scorecard` - 7 edges
6. `AI Agent Skill: Git Operations in Git Bash (Windows)` - 6 edges
7. `main()` - 5 edges
8. `Core Workflows` - 5 edges
9. `Common Patterns` - 5 edges
10. `ADR Format` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Severity Tag Taxonomy (CRITICAL/IMPORTANT/SUGGESTION/QUESTION/GOOD)** — agent_skills_mr_review_skill_severity_critical, agent_skills_mr_review_skill_severity_important, agent_skills_mr_review_skill_severity_suggestion, agent_skills_mr_review_skill_severity_question, agent_skills_mr_review_skill_severity_good [EXTRACTED 1.00]
- **Verdict Decision System (Approve/Approve with Comments/Request Changes)** — agent_skills_mr_review_skill_verdict_approve, agent_skills_mr_review_skill_verdict_approve_with_comments, agent_skills_mr_review_skill_verdict_request_changes [EXTRACTED 1.00]
- **glab CLI MR Review Workflow (view/diff/note/approve)** — agent_skills_mr_review_skill_glab_mr_view, agent_skills_mr_review_skill_glab_mr_diff, agent_skills_mr_review_skill_glab_mr_note, agent_skills_mr_review_skill_glab_mr_approve [EXTRACTED 1.00]

## Communities (36 total, 12 thin omitted)

### Community 0 - "ADR & Context Templates"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, CONTEXT.md Format, Rules (+11 more)

### Community 1 - "GitLab CLI (glab) Skill"
Cohesion: 0.10
Nodes (19): Authentication Quick Start, Automation and Scripting, Best Practices, Common Commands Quick Reference, Common Issues Quick Fixes, Common Patterns, Core Workflows, Creating a Merge Request (+11 more)

### Community 2 - "Vue 3 & Nuxt Frontend Skill"
Cohesion: 0.13
Nodes (14): 1. Project Architecture (Nuxt 3 CSR), 2.1 script setup, 2.2 Component Design, 2.3 Local State Sync, 2. Vue 3 & Component Development, 3. Vuetify 3 Usage, 4.1 Store Structure, 4.2 Guidelines (+6 more)

### Community 3 - "Code Review Dimensions"
Cohesion: 0.15
Nodes (13): Architecture Review Dimension (MVCS compliance, separation of concerns, circular deps), Correctness Review Dimension (logic errors, missing edge cases, off-by-one, null/undefined access), Error Handling Review Dimension (missing try/catch, swallowed errors, incorrect status codes), Naming & Style Review Dimension (conventions from metis.md, ESLint rules, TypeScript strictness), Performance Review Dimension (N+1 queries, unnecessary re-renders, missing indexes), Security Review Dimension (secrets in code, SQL injection, XSS, unvalidated input), Tests Review Dimension (missing test coverage, migration down() methods), ESLint Rules (+5 more)

### Community 4 - "Review Severity Tags & Verdicts"
Cohesion: 0.20
Nodes (11): Critical Issues Template Section, Important Issues Template Section, Questions for the Author Template Section, CRITICAL Severity Tag, IMPORTANT Severity Tag, QUESTION Severity Tag, SUGGESTION Severity Tag, Suggestions & Improvements Template Section (+3 more)

### Community 5 - "OpenCode Config"
Cohesion: 0.20
Nodes (9): GITLAB_TOKEN, command, enabled, environment, type, mcp, glab, plugin (+1 more)

### Community 6 - "Linear Worktree Setup Script"
Cohesion: 0.20
Nodes (8): fs, path, readline, repos, { spawn, execSync }, workspaceData, workspacePath, workspaceRaw

### Community 7 - "Solve Linear Task Workflow"
Cohesion: 0.22
Nodes (8): 1. Prepare Workspace, 2. Load Issue Context, 3. Solve the Issue, 4. Prune Unchanged Worktrees, 5. Push to Remote Branch, 6. Wrap Up, Committing Work, Solve Linear Task (End-to-End Workflow)

### Community 8 - "Worktree Cleanup Script"
Cohesion: 0.22
Nodes (7): { execSync }, fs, path, repos, workspaceData, workspacePath, workspaceRaw

### Community 9 - "Unchanged Worktree Pruning Script"
Cohesion: 0.22
Nodes (7): { execSync }, fs, path, repos, workspaceData, workspacePath, workspaceRaw

### Community 10 - "Workspace Setup Script"
Cohesion: 0.36
Nodes (8): addTrailingCommas(), colors, configureGitHooks(), fs, log(), main(), parseJsonc(), path

### Community 11 - "Review All MRs Workflow"
Cohesion: 0.25
Nodes (7): 1. use predefined script to output all MRs that need a review into mrs directory, 2. Review Merge Requests using the json file & diff file, 3. post reviews, 4. Summary, Metis Fetch & Review MRs Workflow, Prerequisites, Steps

### Community 12 - "File-to-Markdown Converter"
Cohesion: 0.36
Nodes (7): countLines(), fileToMd(), formatBytes(), formatDate(), fs, LANG_MAP, path

### Community 13 - "Git Bash Skill (Windows)"
Cohesion: 0.29
Nodes (6): 1. CLI Execution & Interactive Escaping in Git Bash, 2. Windows-Specific Environment Variables & Handling, 3. Essential Core Commands (Porcelain), 4. Advanced Scripting (Plumbing Commands), 5. Symbolic Identifiers, AI Agent Skill: Git Operations in Git Bash (Windows)

### Community 14 - "Workspace README"
Cohesion: 0.29
Nodes (6): 🛠️ Developer Tools, Integrated Scripts (`tasks/`), Metis Workspace Orchestrator, 🚀 Quick Start, 📁 Repository Structure, Unified VS Code Environment

### Community 15 - "Sub-repo Sync Script"
Cohesion: 0.33
Nodes (6): colors, { execSync }, fs, log(), path, syncAll()

### Community 16 - "Orchestrator Docs (AGENTS.md)"
Cohesion: 0.33
Nodes (5): graphify, How to work here, metis, Sub-repos, What this is

### Community 17 - "Orchestrator Docs (CLAUDE.md)"
Cohesion: 0.33
Nodes (5): graphify, How to work here, metis, Sub-repos, What this is

### Community 18 - "MR Review Publisher Script"
Cohesion: 0.33
Nodes (3): { execFileSync }, fs, path

### Community 19 - "SCM Visibility Toggle Script"
Cohesion: 0.40
Nodes (5): fs, main(), path, updateSelectionMode(), workspacePath

### Community 20 - "Agent-Browser Skill"
Cohesion: 0.40
Nodes (4): agent-browser, Specialized skills, Start here, Why agent-browser

### Community 21 - "Hard Reset Script"
Cohesion: 0.40
Nodes (3): { execSync }, fs, path

### Community 22 - "Reviewer MR Fetch Script"
Cohesion: 0.50
Nodes (3): { execSync }, fs, path

## Knowledge Gaps
- **146 isolated node(s):** `@opencode-ai/plugin`, `{ execSync }`, `fs`, `path`, `workspacePath` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `Review Scorecard` (e.g. with `Naming & Style Review Dimension (conventions from metis.md, ESLint rules, TypeScript strictness)` and `Tests Review Dimension (missing test coverage, migration down() methods)`) actually correct?**
  _`Review Scorecard` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@opencode-ai/plugin`, `{ execSync }`, `fs` to the rest of the system?**
  _148 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ADR & Context Templates` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `GitLab CLI (glab) Skill` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Vue 3 & Nuxt Frontend Skill` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._