#!/usr/bin/env node

/**
 * setup_linear_worktree.js
 * 
 * Automates the process of setting up git worktrees for Linear issues across all Metis repositories.
 * Uses mcp-remote to communicate with Linear via JSON-RPC.
 * 
 * Usage: node scripts/setup_linear_worktree.js MET-123
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read remotes from the workspace file
const workspacePath = path.join(__dirname, '..', 'metis.code-workspace');
const workspaceRaw = fs.readFileSync(workspacePath, 'utf-8');
const workspaceData = JSON.parse(workspaceRaw.replace(/,\s*([\]}])/g, '$1').replace(/\/\/.*$/gm, ''));
const repos = {};
for (const folder of workspaceData.folders) {
  if (folder.gitRemote) repos[folder.name] = folder.gitRemote;
}

const LINEAR_MCP_URL = 'https://mcp.linear.app/mcp';
const WORKTREES_ROOT = 'worktrees';
const REPOS = Object.keys(repos);

async function main() {
  const issueIds = process.argv.slice(2);
  if (issueIds.length === 0) {
    console.error('Usage: node scripts/setup_linear_worktree.js <ISSUE-ID> [<ISSUE-ID>...]');
    process.exit(1);
  }

  const rootDir = process.cwd();

  try {
    // 1. Start mcp-remote bridge
    console.log(`Connecting to Linear MCP at ${LINEAR_MCP_URL}...`);
    const mcp = spawn('npx', ['-y', 'mcp-remote', LINEAR_MCP_URL], {
      shell: true
    });

    const rl = readline.createInterface({
      input: mcp.stdout,
      terminal: false
    });

    let requestId = 1;
    const pendingRequests = new Map();

    rl.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        if (response.id && pendingRequests.has(response.id)) {
          const { resolve, reject } = pendingRequests.get(response.id);
          pendingRequests.delete(response.id);
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.result);
          }
        }
      } catch (_e) {
        // Not a JSON line or other error
      }
    });

    const sendRequest = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const id = requestId++;
        pendingRequests.set(id, { resolve, reject });
        const payload = JSON.stringify({
          jsonrpc: '2.0',
          id,
          method,
          params
        });
        mcp.stdin.write(payload + '\n');
      });
    };

    // Process each issue
    for (const issueId of issueIds) {
      console.log(`\n🚀 Setting up worktrees for issue: ${issueId}...`);
      
      try {
        // Fetch issue details
        const result = await sendRequest('tools/call', {
          name: 'get_issue',
          arguments: { id: issueId }
        });

        if (!result || !result.content || result.content.length === 0) {
          throw new Error(`Issue ${issueId} not found or no content returned.`);
        }

        const issueData = JSON.parse(result.content[0].text);
        
        // Root folder for this issue's worktrees
        const issueRootDir = path.join(rootDir, WORKTREES_ROOT, issueId);
        if (!fs.existsSync(issueRootDir)) {
          fs.mkdirSync(issueRootDir, { recursive: true });
        }

        // Save issue data in the root of the task
        const issueJsonPath = path.join(issueRootDir, 'issue.json');
        fs.writeFileSync(issueJsonPath, JSON.stringify(issueData, null, 2));
        console.log(`✅ Issue data saved to ${issueJsonPath}`);

        // Iterate over all repositories
        for (const repo of REPOS) {
          const repoPath = path.join(rootDir, repo);
          if (!fs.existsSync(repoPath)) {
            console.warn(`⚠️ Repository ${repo} not found. Skipping.`);
            continue;
          }

          console.log(`\n📂 Processing repository: ${repo}`);

          // Construct branch name
          const linearBranchName = issueData.gitBranchName;
          const branchName = linearBranchName || `deyra-${issueId.toLowerCase()}`;
          const worktreePath = path.join(issueRootDir, repo);

          try {
            // Check if branch exists in this repo
            try {
              execSync(`git -C ${repo} rev-parse --verify ${branchName}`, { stdio: 'ignore' });
              console.log(`  - Branch ${branchName} already exists.`);
            } catch (_e) {
              console.log(`  - Creating branch ${branchName} in ${repo}...`);
              // Assuming 'development' is the base branch
              execSync(`git -C ${repo} branch ${branchName} development`, { stdio: 'inherit' });
            }

            // Add worktree
            if (fs.existsSync(worktreePath)) {
              console.log(`  - Worktree directory ${worktreePath} already exists. Skipping.`);
            } else {
              console.log(`  - Adding git worktree in ${worktreePath}...`);
              // We use absolute path for worktree to avoid confusion
              execSync(`git -C ${repo} worktree add "${path.resolve(worktreePath)}" ${branchName}`, { stdio: 'inherit' });
            }
          } catch (gitErr) {
            console.error(`  ❌ Git error in ${repo}: ${gitErr.message}`);
          }
        }

      } catch (err) {
        console.error(`❌ Error processing ${issueId}: ${err.message}`);
      }
    }

    // Cleanup
    mcp.kill();
    console.log('\n✨ All worktrees synchronized!');
    process.exit(0);

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
