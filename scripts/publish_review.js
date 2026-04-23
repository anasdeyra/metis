const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

try {
  // Read repos from the configuration file
  const reposData = require("../metis.repos.json");
  const remotes = {};
  for (const repo of reposData.repos) {
    remotes[repo.name] = repo.remote;
  }

  const mrsDir = 'mrs';

  if (!fs.existsSync(mrsDir)) {
    console.error(`Directory "${mrsDir}" does not exist. Please run the fetch script and generate reviews first.`);
    process.exit(1);
  }

  const repoKeys = fs.readdirSync(mrsDir).filter(f => fs.statSync(path.join(mrsDir, f)).isDirectory());

  for (const repoKey of repoKeys) {
    if (!remotes[repoKey]) {
      console.warn(`Warning: Directory "${repoKey}" not found in workspace config. Skipping...`);
      continue;
    }

    let repoPath = remotes[repoKey];
    if (repoPath.startsWith('git@gitlab.com:')) repoPath = repoPath.substring('git@gitlab.com:'.length);
    if (repoPath.startsWith('https://gitlab.com/')) repoPath = repoPath.substring('https://gitlab.com/'.length);

    const repoPathDir = path.join(mrsDir, repoKey);
    const mrIds = fs.readdirSync(repoPathDir).filter(f => fs.statSync(path.join(repoPathDir, f)).isDirectory());

    for (const mrId of mrIds) {
      const mrDirPath = path.join(repoPathDir, mrId);
      const files = fs.readdirSync(mrDirPath);

      // Look for any .md file that contains "review" or is the base ID
      // Prefer review.md for the comment content
      const reviewArtifact = files.find(f => f === 'review.md') || files.find(f => f.endsWith('.md') && !f.includes('approved'));

      if (!reviewArtifact) {
        console.warn(`Warning: No review artifact found for MR ${mrId} in ${repoKey}. Skipping...`);
        continue;
      }

      const filePath = path.join(mrDirPath, reviewArtifact);
      const content = fs.readFileSync(filePath, 'utf-8');

      console.log(`Publishing review for MR ${mrId} (file: ${reviewArtifact}) in ${repoKey}...`);

      try {
        // 1. Post the review comment
        execFileSync('glab', ['mr', 'note', mrId, '--repo', repoPath, '-m', content], { encoding: 'utf-8', stdio: 'inherit' });
        console.log(`✅ Successfully posted review for ${mrId}.`);

        // 2. Check for approval
        const approvedFileExists = files.some(f => f.includes('approved'));

        if (approvedFileExists) execFileSync('glab', ['mr', 'approve', mrId, '--repo', repoPath], { encoding: 'utf-8', stdio: 'inherit' });
      } catch (err) {
        console.error(`❌ Failed to process MR ${mrId} in ${repoKey}:`, err.message);
      }
    }
  }
} catch (err) {
  console.error('Failed to run publish script:', err.message);
}
