# Graph Report - .  (2026-07-02)

## Corpus Check
- Corpus is ~24,976 words - fits in a single context window. You may not need a graph.

## Summary
- 227 nodes · 251 edges · 27 communities (19 shown, 8 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_QA Test Planner Skill|QA Test Planner Skill]]
- [[_COMMUNITY_MR Review & GitLab CLI|MR Review & GitLab CLI]]
- [[_COMMUNITY_Metis Workspace & Monorepo|Metis Workspace & Monorepo]]
- [[_COMMUNITY_Vue Frontend Conventions|Vue Frontend Conventions]]
- [[_COMMUNITY_grill-with-docs Skill|grill-with-docs Skill]]
- [[_COMMUNITY_Git Skill & Linear Task Workflow|Git Skill & Linear Task Workflow]]
- [[_COMMUNITY_Setup Linear Worktree Script|Setup Linear Worktree Script]]
- [[_COMMUNITY_Cleanup Worktrees Script|Cleanup Worktrees Script]]
- [[_COMMUNITY_Prune Unchanged Worktrees Script|Prune Unchanged Worktrees Script]]
- [[_COMMUNITY_Setup Workspace Task|Setup Workspace Task]]
- [[_COMMUNITY_Agent Browser Skill|Agent Browser Skill]]
- [[_COMMUNITY_File-to-Markdown Script|File-to-Markdown Script]]
- [[_COMMUNITY_JSTS Jest Testing Skill|JS/TS Jest Testing Skill]]
- [[_COMMUNITY_Sync All Task|Sync All Task]]
- [[_COMMUNITY_Publish Review Script|Publish Review Script]]
- [[_COMMUNITY_Toggle SCM Visibility Task|Toggle SCM Visibility Task]]
- [[_COMMUNITY_Hard Reset Task|Hard Reset Task]]
- [[_COMMUNITY_Amadeus Integration & Error Handling|Amadeus Integration & Error Handling]]
- [[_COMMUNITY_Fetch Reviewer MRs Script|Fetch Reviewer MRs Script]]
- [[_COMMUNITY_Update README Repos Task|Update README Repos Task]]
- [[_COMMUNITY_Create Bug Report Script|Create Bug Report Script]]
- [[_COMMUNITY_Generate Test Cases Script|Generate Test Cases Script]]
- [[_COMMUNITY_OpenCode Package Config|OpenCode Package Config]]
- [[_COMMUNITY_DB Migration Conventions|DB Migration Conventions]]
- [[_COMMUNITY_Environment Variables Policy|Environment Variables Policy]]
- [[_COMMUNITY_ESLint Style Rules|ESLint Style Rules]]
- [[_COMMUNITY_Backend Naming Conventions|Backend Naming Conventions]]

## God Nodes (most connected - your core abstractions)
1. `QA Test Planner README` - 13 edges
2. `Metis Workspace Orchestrator README` - 13 edges
3. `grill-with-docs Skill` - 8 edges
4. `Test Case Templates Reference` - 8 edges
5. `Metis Monorepo Structure` - 7 edges
6. `agent-browser CLI` - 7 edges
7. `GitLab CLI (glab) Skill` - 7 edges
8. `qa-test-planner Skill` - 7 edges
9. `Bug Report Templates Reference` - 7 edges
10. `Figma Design Validation Reference` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Nuxt 3 CSR Project Architecture` --semantically_similar_to--> `Nuxt 3 / Vue 3 CSR Frontend Architecture`  [INFERRED] [semantically similar]
  .agent/skills/frontend-vue/SKILL.md → .agent/rules/metis.md
- `API Interaction via Axios (frontend-vue skill)` --semantically_similar_to--> `Frontend API Calls via Proxy (Axios)`  [INFERRED] [semantically similar]
  .agent/skills/frontend-vue/SKILL.md → .agent/rules/metis.md
- `Standard Test Case Format` --semantically_similar_to--> `Test Case Templates Reference`  [INFERRED] [semantically similar]
  .agent/skills/qa-test-planner/SKILL.md → .agent/skills/qa-test-planner/references/test_case_templates.md
- `Figma MCP Integration Workflow` --semantically_similar_to--> `Figma Design Validation Reference`  [INFERRED] [semantically similar]
  .agent/skills/qa-test-planner/SKILL.md → .agent/skills/qa-test-planner/references/figma_validation.md
- `Regression Testing Deep Dive (SKILL.md)` --semantically_similar_to--> `Regression Testing Guide Reference`  [INFERRED] [semantically similar]
  .agent/skills/qa-test-planner/SKILL.md → .agent/skills/qa-test-planner/references/regression_testing.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Metis Monorepo Six Sub-Projects** — agent_rules_metis_api_aerial, agent_rules_metis_api_dashboard, agent_rules_metis_api_hotel, agent_rules_metis_api_rail, agent_rules_metis_front_dashboard, agent_rules_metis_front_reservation [EXTRACTED 1.00]
- **QA Test Planner Reference Documentation Set** — agent_skills_qa_test_planner_skill, agent_skills_qa_test_planner_references_test_case_templates, agent_skills_qa_test_planner_references_bug_report_templates, agent_skills_qa_test_planner_references_regression_testing, agent_skills_qa_test_planner_references_figma_validation [EXTRACTED 1.00]
- **GitLab MR Review Automation Flow** — agent_workflows_review_all_mrs, agent_skills_mr_review_skill, agent_skills_glab_skill, agent_workflows_review_all_mrs_approved_file_gate [INFERRED 0.85]

## Communities (27 total, 8 thin omitted)

### Community 0 - "QA Test Planner Skill"
Cohesion: 0.06
Nodes (40): QA Test Planner README, Bug Report Documentation Feature, create_bug_report.sh, Figma Design Validation Feature, generate_test_cases.sh, Regression Test Suites Feature, Manual Test Case Creation Feature, Test Plan Generation Feature (+32 more)

### Community 1 - "MR Review & GitLab CLI"
Cohesion: 0.12
Nodes (20): Metis AI Agent Rules, GitLab CLI (glab) Skill, glab api Command, glab Authentication Quick Start, glab CI/CD Monitoring, glab Issue Management, glab Merge Request Workflow (create/review), glab Reference Docs (commands-detailed, quick-reference, troubleshooting) (+12 more)

### Community 2 - "Metis Workspace & Monorepo"
Cohesion: 0.21
Nodes (18): api-aerial (Aerial booking API), Frontend API Calls via Proxy (Axios), api-dashboard (Dashboard/back-office API), api-hotel (Hotel booking API), api-rail (Rail booking API), front-dashboard (Back-office frontend), front-reservation (Booking/reservation frontend), Metis Monorepo Structure (+10 more)

### Community 3 - "Vue Frontend Conventions"
Cohesion: 0.16
Nodes (15): base.controller.js, Common Pitfalls to Avoid, Frontend Component Architecture, Backend Logging Policy (no logRequest), Pinia State Management Convention, TypeScript Conventions (no any), Vue & Template Conventions (script setup), frontend-vue Skill (+7 more)

### Community 4 - "grill-with-docs Skill"
Cohesion: 0.19
Nodes (13): ADR Format, ADR Template, When to Offer an ADR (3-criteria rule), CONTEXT.md Format, CONTEXT-MAP.md (multi-context repos), CONTEXT.md Structure (Language, Relationships, Example dialogue), grill-with-docs Skill, Challenge Against the Glossary (+5 more)

### Community 5 - "Git Skill & Linear Task Workflow"
Cohesion: 0.22
Nodes (11): Git Operations in Git Bash (Windows) Skill, CLI Execution & Interactive Escaping in Git Bash, Advanced Scripting (Plumbing Commands), Essential Core Commands (Porcelain), Symbolic Identifiers (HEAD, tags, heads), Windows-Specific Environment Variables & Handling, Solve Linear Task Workflow, issue.json (dumped issue context) (+3 more)

### Community 6 - "Setup Linear Worktree Script"
Cohesion: 0.20
Nodes (8): fs, path, readline, repos, { spawn, execSync }, workspaceData, workspacePath, workspaceRaw

### Community 7 - "Cleanup Worktrees Script"
Cohesion: 0.22
Nodes (7): { execSync }, fs, path, repos, workspaceData, workspacePath, workspaceRaw

### Community 8 - "Prune Unchanged Worktrees Script"
Cohesion: 0.22
Nodes (7): { execSync }, fs, path, repos, workspaceData, workspacePath, workspaceRaw

### Community 9 - "Setup Workspace Task"
Cohesion: 0.36
Nodes (8): addTrailingCommas(), colors, configureGitHooks(), fs, log(), main(), parseJsonc(), path

### Community 10 - "Agent Browser Skill"
Cohesion: 0.25
Nodes (8): agent-browser Skill, agent-browser agentcore skill (AWS Bedrock), agent-browser CLI, agent-browser skills get core, agent-browser dogfood skill, agent-browser electron skill, agent-browser slack skill, agent-browser vercel-sandbox skill

### Community 11 - "File-to-Markdown Script"
Cohesion: 0.36
Nodes (7): countLines(), fileToMd(), formatBytes(), formatDate(), fs, LANG_MAP, path

### Community 12 - "JS/TS Jest Testing Skill"
Cohesion: 0.29
Nodes (7): javascript-typescript-jest Skill, Testing Async Code, Common Jest Matchers, Effective Mocking (jest.mock, jest.spyOn), Testing React Components (React Testing Library), Snapshot Testing, Jest Test Structure Conventions

### Community 13 - "Sync All Task"
Cohesion: 0.33
Nodes (6): colors, { execSync }, fs, log(), path, syncAll()

### Community 14 - "Publish Review Script"
Cohesion: 0.33
Nodes (3): { execFileSync }, fs, path

### Community 15 - "Toggle SCM Visibility Task"
Cohesion: 0.40
Nodes (5): fs, main(), path, updateSelectionMode(), workspacePath

### Community 16 - "Hard Reset Task"
Cohesion: 0.40
Nodes (3): { execSync }, fs, path

### Community 17 - "Amadeus Integration & Error Handling"
Cohesion: 0.50
Nodes (4): AMADEUS SOAP Integration Pattern, amadeusServiceFactory.js (createAmadeusService), Backend Error Handling Convention, writeLogsIncremental

### Community 18 - "Fetch Reviewer MRs Script"
Cohesion: 0.50
Nodes (3): { execSync }, fs, path

## Knowledge Gaps
- **105 isolated node(s):** `@opencode-ai/plugin`, `{ execSync }`, `fs`, `path`, `workspacePath` (+100 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Metis Monorepo Structure` connect `Metis Workspace & Monorepo` to `MR Review & GitLab CLI`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `Metis AI Agent Rules` connect `MR Review & GitLab CLI` to `Metis Workspace & Monorepo`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `@opencode-ai/plugin`, `{ execSync }`, `fs` to the rest of the system?**
  _114 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `QA Test Planner Skill` be split into smaller, more focused modules?**
  _Cohesion score 0.06025641025641026 - nodes in this community are weakly interconnected._
- **Should `MR Review & GitLab CLI` be split into smaller, more focused modules?**
  _Cohesion score 0.11578947368421053 - nodes in this community are weakly interconnected._