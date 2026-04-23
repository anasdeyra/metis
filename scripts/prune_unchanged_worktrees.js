#!/usr/bin/env node

/**
 * prune_unchanged_worktrees.js
 * 
 * Scans a specific issue's worktrees and removes any repository that hasn't been modified.
 * A repo is considered "modified" if it has local changes OR commits not present in 'development'.
 * 
 * Usage: node scripts/prune_unchanged_worktrees.js <ISSUE-ID>
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read remotes from the workspace file
const workspacePath = path.join(__dirname, '..', 'metis.code-workspace');
const workspaceRaw = fs.readFileSync(workspacePath, 'utf-8');
const workspaceData = JSON.parse(workspaceRaw.replace(/,\s*([\]}])/g, '$1').replace(/\/\/.*$/gm, ''));
const repos = {};
for (const folder of workspaceData.folders) {
  if (folder.gitRemote) repos[folder.name] = folder.gitRemote;
}

const REPOS = Object.keys(repos);
const WORKTREES_ROOT = 'worktrees';

function main() {
  const issueId = process.argv[2];
  if (!issueId) {
    console.error('Usage: node scripts/prune_unchanged_worktrees.js <ISSUE-ID>');
    process.exit(1);
  }

  const rootDir = process.cwd();
  const issueDir = path.join(rootDir, WORKTREES_ROOT, issueId);

  if (!fs.existsSync(issueDir)) {
    console.error(`Error: Issue directory not found: ${issueDir}`);
    process.exit(1);
  }

  console.log(`🔍 Inspecting worktrees for issue ${issueId} to find unchanged repos...`);

  for (const repo of REPOS) {
    const worktreePath = path.join(issueDir, repo);
    const mainRepoPath = path.join(rootDir, repo);

    if (!fs.existsSync(worktreePath)) continue;

    try {
      // 1. Check for local changes (staged or unstaged)
      const status = execSync(`git -C "${worktreePath}" status --porcelain`, { encoding: 'utf8' }).trim();
      const hasLocalChanges = status.length > 0;

      // 2. Check for commits on the branch that aren't in development
      // We assume 'development' is the base branch
      const commitCount = execSync(`git -C "${worktreePath}" rev-list --count development..HEAD`, { encoding: 'utf8' }).trim();
      const hasNewCommits = parseInt(commitCount, 10) > 0;

      if (!hasLocalChanges && !hasNewCommits) {
        console.log(`  - 🗑️ Pruning unchanged repo: ${repo}`);
        execSync(`git -C "${mainRepoPath}" worktree remove --force "${path.resolve(worktreePath)}"`, { stdio: 'inherit' });
      } else {
        const changesDesc = [
          hasLocalChanges ? 'local changes' : null,
          hasNewCommits ? `${commitCount} new commits` : null
        ].filter(Boolean).join(' and ');
        
        console.log(`  - ✅ Keeping ${repo} (${changesDesc})`);
      }

    } catch (err) {
      console.error(`  ❌ Error inspecting ${repo}: ${err.message}`);
    }
  }

  console.log('\n✨ Done! Only active repositories remain in the task folder.');
}

main();
