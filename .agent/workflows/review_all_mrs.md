---
description: Workflow to fetch and review Merge Requests from all Metis repos.
---

# Metis Fetch & Review MRs Workflow

This workflow automates the process of finding and reviewing Merge Requests (MRs) across all Metis sub-projects. It is particularly useful for reviewing contributions from specific team members (e.g., Mariem, Emna).

## Prerequisites
- `glab` CLI authenticated and installed.
- Access to the `GroupeAdnenis/metis-connect` repositories.

## Steps

### 1. use predefined script to output all MRs that need a review into mrs directory
// turbo 
```
node scripts/fetch_reviewer_mrs.js
```
> !NOTE
> if no merge request to review found stop at this step

### 2. Review Merge Requests using the json file & diff file
- each MR that need a review is listed in the mrs folder recursvly traverse every json file found there.
- Leverage the merge request review skill and always adhere to the template to be always consistant & create the review artifact in the same directory as the json file named review.md and also generate a file called approved if the final verdict is approveed.

### 3. post reviews
// turbo 
```
node scripts/publish_review.js
```

### 4. Summary
Report the status of the review (Approved, Commented, or Needs Changes) to the user.
Give well presented very brief report with links to Merge request

> !NOTE
> if no merge request to review found at step 1 top complete execution & report back to user