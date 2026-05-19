---
name: mr-review
description: Gold-standard Merge Request code review skill. Produces consistent, actionable, and highly readable reviews using a strict template. Use this skill whenever reviewing MR diffs, providing code feedback, or auditing code quality.
---

# 🔍 Merge Request Code Review Skill

Produces **gold-standard, consistent code reviews** using a strict template. Every review follows the same structure so authors always know what to expect.

---

## When to Use This Skill

- Reviewing any MR diff (via `glab mr diff` or pasted code)
- Providing structured code feedback on changes
- Auditing code quality before merge

---

## Review Execution Steps

### Step 1 — Gather Context

```bash
# Fetch MR metadata
glab mr view <MR_ID> -R <repo>

# Fetch the full diff
glab mr diff <MR_ID> -R <repo>
```

- Read the MR **title**, **description**, and **linked issues** to understand intent.
- Identify which sub-project(s) are affected (`api-aerial`, `front-reservation`, etc.).
- Load the relevant project rules from `metis.md` (backend MVCS, frontend Nuxt/Vue conventions).

### Step 2 — Analyze the Diff

Walk through **every changed file** and evaluate against these dimensions:

| Dimension | What to Check |
|---|---|
| **Correctness** | Logic errors, missing edge cases, off-by-one, null/undefined access |
| **Security** | Secrets in code, SQL injection, XSS, unvalidated input |
| **Architecture** | MVCS compliance, separation of concerns, circular deps |
| **Error Handling** | Missing try/catch, swallowed errors, incorrect status codes |
| **Performance** | N+1 queries, unnecessary re-renders, missing indexes |
| **Naming & Style** | Conventions from `metis.md`, ESLint rules, TypeScript strictness |
| **Tests** | Missing test coverage, migration `down()` methods |
| **Readability** | Complex logic without comments, magic numbers, dead code |

### Step 3 — Classify Findings

Every finding gets a severity tag:

| Tag | Meaning | Blocks Merge? |
|---|---|---|
| 🚨 **CRITICAL** | Bug, security flaw, data loss risk, crash | ✅ Yes |
| ⚠️ **IMPORTANT** | Logic concern, missing error handling, convention violation | ✅ Yes |
| 💡 **SUGGESTION** | Improvement idea, refactor opportunity, readability tweak | ❌ No |
| ❓ **QUESTION** | Needs clarification from the author | ❌ No |
| ✅ **GOOD** | Well-done pattern, clean implementation (keep brief) | — |

### Step 4 — Write the Review Using the Template

Use the **exact template below** to generate an MR review artifact. Do not skip sections. If a section has no findings, write "None."

---

## 📋 Review Output Template

````markdown
## 📌 Summary

> {2-3 sentence high-level summary of what this MR does and overall quality assessment.}

---

## 🚨 Critical Issues

> Must be resolved before merge. These are bugs, security vulnerabilities, or data-loss risks.

{If none: "None."}

### {N}. {Short title}
- **File:** `{path/to/file.js}`  •  **Line(s):** `{L42-L58}`
- **Problem:** {Clear description of the bug or flaw.}
- **Impact:** {What breaks, what data is at risk, who is affected.}
- **Suggested fix:**
```{lang}
// Before
{problematic code}

// After
{suggested fix}
```

---

## ⚠️ Important Issues

> Should be addressed before or shortly after merge. Convention violations, missing error handling, architectural concerns.

{If none: "None."}

### {N}. {Short title}
- **File:** `{path/to/file.js}`  •  **Line(s):** `{L12-L20}`
- **Problem:** {What's wrong and why it matters.}
- **Suggested fix:**
```{lang}
{code suggestion}
```

---

## 💡 Suggestions & Improvements

> Non-blocking. Nice-to-have improvements, refactors, readability wins.

{If none: "None."}

- **`{file}`** — {suggestion}
- **`{file}`** — {suggestion}

---

## ❓ Questions for the Author

> Clarifications needed to complete the review.

{If none: "None."}

- **`{file}:{line}`** — {question}

---

## ✅ What's Done Well

> Brief acknowledgment of good patterns. Keep this short (3-5 bullet points max).

- {praise}
- {praise}

---

## 📊 Review Scorecard

| Dimension | Rating | Notes |
|---|---|---|
| Correctness | {🟢🟡🔴} | {one-liner} |
| Security | {🟢🟡🔴} | {one-liner} |
| Architecture | {🟢🟡🔴} | {one-liner} |
| Error Handling | {🟢🟡🔴} | {one-liner} |
| Performance | {🟢🟡🔴} | {one-liner} |
| Code Style | {🟢🟡🔴} | {one-liner} |
| Test Coverage | {🟢🟡🔴} | {one-liner} |
````

---

## ⚙️ Operational Rules

1. **Template is mandatory** — Never skip or reorder sections. Consistency is the point.
2. **Critical & Important first** — The reader's attention goes to blockers immediately.
3. **Praise is brief and last** — Acknowledgment matters but shouldn't bury issues.
4. **Always provide code suggestions** — Don't just say "this is wrong"; show the fix.
5. **Reference exact files & lines** — Every finding must point to a specific location.
6. **Verdict logic:**
   - 🟢 **Approve** — Zero critical or important issues
   - 🟡 **Approve with comments** — Only suggestions/questions, or minor important issues the author can self-fix
   - 🔴 **Request changes** — Any critical issue, or multiple important issues

### Step 5 — Post the Review
The automated workflow handles posting based on the presence of the `approved` file:

1. **Request Changes** (Default): Posted as a **resolvable discussion thread** using the GitLab API. This makes the review **blocking** — the author cannot merge until the discussion is resolved.
2. **Approve**: Posted as a regular note and followed by a formal `glab mr approve`.

Manual fallback commands:
```bash
# Submit a formal review as a comment (non-blocking)
glab mr note <MR_ID> -R <repo> -m "$(cat <review_artifact>)"

# For approval with feedback
glab mr approve <MR_ID> -R <repo>
```

If the review is too long for a single comment, split into:
1. **Summary + Critical + Important** (first comment)
2. **Suggestions + Questions + Praise + Scorecard** (second comment)
