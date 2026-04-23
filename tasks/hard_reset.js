const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hard Reset Script for current local branch to development (remote branch as well)
 * 
 * Usage: node tasks/hard_reset.js <repo-name>
 * Example: node tasks/hard_reset.js api-aerial
 */

async function main() {
  // 1. Get repo from args
  const repoKey = process.argv[2];
  if (!repoKey) {
    console.error('\x1b[31mError: Missing repository name.\x1b[0m');
    console.log('Usage: node tasks/hard_reset.js <repo-name>');
    process.exit(1);
  }

  // 2. Validate repo using workspace config
  const workspacePath = path.join(__dirname, '..', 'metis.code-workspace');
  if (!fs.existsSync(workspacePath)) {
    console.error('\x1b[31mError: metis.code-workspace not found.\x1b[0m');
    process.exit(1);
  }

  const workspaceRaw = fs.readFileSync(workspacePath, 'utf-8');
  const workspaceData = JSON.parse(workspaceRaw.replace(/,\s*([\]}])/g, '$1').replace(/\/\/.*$/gm, ''));
  const remotes = {};
  for (const folder of workspaceData.folders) {
    if (folder.gitRemote) remotes[folder.name] = folder.gitRemote;
  }

  if (!remotes[repoKey]) {
    console.error(`\x1b[31mError: Repo key "${repoKey}" not found in workspace config\x1b[0m`);
    console.log('Available repos:', Object.keys(remotes).join(', '));
    process.exit(1);
  }

  const repoPath = path.join(__dirname, '..', repoKey);
  if (!fs.existsSync(repoPath)) {
    console.error(`\x1b[31mError: Directory "${repoPath}" does not exist locally.\x1b[0m`);
    process.exit(1);
  }

  console.log(`\x1b[34m[${repoKey}]\x1b[0m Starting hard reset process...`);

  try {
    // 3. Detect current branch
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();
    console.log(`\x1b[34m[${repoKey}]\x1b[0m Current branch detected: \x1b[33m${branch}\x1b[0m`);

    // 4. Safety Guard: Prevent resetting core branches
    const protectedBranches = ['development', 'master', 'main', 'production', 'staging'];
    if (protectedBranches.includes(branch)) {
      console.error(`\x1b[31mError: Branch "${branch}" is protected. Resetting it to development is not allowed.\x1b[0m`);
      process.exit(1);
    }

    // 5. Look for open MRs for this branch
    let gitRepoPath = remotes[repoKey];
    if (gitRepoPath.startsWith('git@gitlab.com:')) gitRepoPath = gitRepoPath.substring('git@gitlab.com:'.length);
    if (gitRepoPath.startsWith('https://gitlab.com/')) gitRepoPath = gitRepoPath.substring('https://gitlab.com/'.length);

    console.log(`\x1b[34m[${repoKey}]\x1b[0m Checking for open Merge Requests...`);
    try {
      const mrOutput = execSync(`glab mr list --source-branch=${branch} --repo=${gitRepoPath} --output=json`, { encoding: 'utf-8' });
      const mrs = mrOutput.trim() ? JSON.parse(mrOutput) : [];
      
      if (mrs.length > 0) {
        console.log(`\x1b[32mFound ${mrs.length} open MR(s) associated with this branch:\x1b[0m`);
        mrs.forEach(mr => console.log(`  - !${mr.iid}: ${mr.title}`));
      } else {
        console.log(`  - No open MRs found for branch "${branch}".`);
      }
    } catch (_mrError) {
      console.warn(`\x1b[31mWarning: Could not fetch MR list for ${repoKey}.\x1b[0m`);
    }

    // 6. Discard local changes and untracked files
    console.log(`\x1b[34m[${repoKey}]\x1b[0m Discarding uncommitted changes and untracked files...`);
    execSync('git reset --hard HEAD', { cwd: repoPath, stdio: 'inherit' });
    execSync('git clean -fd', { cwd: repoPath, stdio: 'inherit' });

    // 7. Hard Reset locally
    console.log(`\x1b[34m[${repoKey}]\x1b[0m Fetching latest development...`);
    execSync('git fetch origin development', { cwd: repoPath, stdio: 'inherit' });

    console.log(`\x1b[34m[${repoKey}]\x1b[0m Resetting \x1b[33m${branch}\x1b[0m to \x1b[32morigin/development\x1b[0m...`);
    execSync('git reset --hard origin/development', { cwd: repoPath, stdio: 'inherit' });

    // 8. Check if branch exists on remote to reset it as well
    console.log(`\x1b[34m[${repoKey}]\x1b[0m Checking if branch exists on remote...`);
    const remoteBranchExists = execSync(`git ls-remote --heads origin ${branch}`, { cwd: repoPath, encoding: 'utf-8' }).trim();

    if (remoteBranchExists) {
      console.log(`\x1b[34m[${repoKey}]\x1b[0m Branch exists on remote. Force pushing to synchronize...`);
      execSync(`git push origin HEAD --force`, { cwd: repoPath, stdio: 'inherit' });
      console.log(`\n\x1b[32m✔ Successfully reset "${branch}" locally and on remote for ${repoKey}.\x1b[0m`);
    } else {
      console.log(`\x1b[33mRemote branch "${branch}" does not exist. Skipping remote sync.\x1b[0m`);
      console.log(`\n\x1b[32m✔ Successfully reset "${branch}" locally for ${repoKey}.\x1b[0m`);
    }

  } catch (err) {
    console.error(`\n\x1b[31m✖ Failed during reset process for ${repoKey}:\x1b[0m`, err.message);
    process.exit(1);
  }
}

main();
