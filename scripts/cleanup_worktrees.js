#!/usr/bin/env node

/**
 * cleanup_worktrees.js
 * 
 * Safely removes git worktrees created for Linear issues.
 * Ensures the main repositories are not affected.
 * 
 * Usage: 
 *   node scripts/cleanup_worktrees.js          # Cleanup ALL worktrees in the worktrees/ folder
 *   node scripts/cleanup_worktrees.js MET-123  # Cleanup worktrees only for a specific issue
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

const WORKTREES_ROOT = 'worktrees';
const REPOS = Object.keys(repos);

function main() {
  const targetIssueId = process.argv[2];
  const rootDir = process.cwd();
  const worktreesBaseDir = path.join(rootDir, WORKTREES_ROOT);

  if (!fs.existsSync(worktreesBaseDir)) {
    console.log('No worktrees directory found. Nothing to clean.');
    return;
  }

  console.log(targetIssueId 
    ? `🧹 Cleaning up worktrees for issue: ${targetIssueId}...` 
    : '🧹 Cleaning up ALL managed worktrees...');

  for (const repo of REPOS) {
    const repoPath = path.join(rootDir, repo);
    if (!fs.existsSync(repoPath)) continue;

    console.log(`\n🔍 Checking repository: ${repo}`);

    try {
      // Get list of worktrees for this repo
      const output = execSync(`git -C ${repo} worktree list --porcelain`, { encoding: 'utf8' });
      const worktreeInfos = output.split('\n\n').filter(block => block.trim());

      for (const block of worktreeInfos) {
        const lines = block.split('\n');
        const worktreePathLine = lines.find(l => l.startsWith('worktree '));
        if (!worktreePathLine) continue;

        const wtPath = worktreePathLine.replace('worktree ', '').trim();
        const absoluteWtPath = path.resolve(wtPath);
        const relativeToRoot = path.relative(rootDir, absoluteWtPath);

        // Check if this worktree is inside our managed worktrees folder
        if (relativeToRoot.startsWith(WORKTREES_ROOT + path.sep) || relativeToRoot === WORKTREES_ROOT) {
          const isTargetIssue = !targetIssueId || relativeToRoot.includes(path.join(WORKTREES_ROOT, targetIssueId));

          if (isTargetIssue) {
            console.log(`  - Removing worktree: ${wtPath}`);
            try {
              // Use --force to ensure cleanup even if there are local changes
              // (User should be careful, but these are transient worktrees)
              execSync(`git -C ${repo} worktree remove --force "${wtPath}"`, { stdio: 'inherit' });
            } catch (e) {
              console.error(`  ❌ Failed to remove worktree ${wtPath}: ${e.message}`);
            }
          }
        }
      }

      // Final prune just in case
      execSync(`git -C ${repo} worktree prune`, { stdio: 'ignore' });

    } catch (err) {
      console.error(`  ❌ Error processing ${repo}: ${err.message}`);
    }
  }

  // Cleanup the directory structure if empty
  if (targetIssueId) {
    const issueDir = path.join(worktreesBaseDir, targetIssueId);
    if (fs.existsSync(issueDir)) {
      try {
        fs.rmSync(issueDir, { recursive: true, force: true });
        console.log(`\nDeleted directory: ${issueDir}`);
      } catch (e) {
        console.error(`Failed to delete directory ${issueDir}: ${e.message}`);
      }
    }
  } else {
    // Cleanup all issue directories
    const issues = fs.readdirSync(worktreesBaseDir);
    for (const issue of issues) {
      const issueDir = path.join(worktreesBaseDir, issue);
      if (fs.lstatSync(issueDir).isDirectory()) {
         try {
          fs.rmSync(issueDir, { recursive: true, force: true });
          console.log(`Deleted directory: ${issueDir}`);
        } catch (e) {
          console.error(`Failed to delete directory ${issueDir}: ${e.message}`);
        }
      }
    }
  }

  // Remove worktrees root if empty
  if (fs.existsSync(worktreesBaseDir) && fs.readdirSync(worktreesBaseDir).length === 0) {
    fs.rmdirSync(worktreesBaseDir);
    console.log('Removed empty worktrees root directory.');
  }

  console.log('\n✨ Cleanup complete!');
}

main();
