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
      const approvedFileExists = files.some(f => f.includes('approved'));

      console.log(`Publishing review for MR ${mrId} (file: ${reviewArtifact}) in ${repoKey}...`);

      try {
        // Resolve any previous review discussions left by us before posting a new one
        resolvePreviousReviewDiscussions(repoPath, mrId);

        if (approvedFileExists) {
          // Approved: post as a regular note (non-blocking)
          execFileSync('glab', ['mr', 'note', mrId, '--repo', repoPath, '-m', content], { encoding: 'utf-8', stdio: 'inherit' });
          execFileSync('glab', ['mr', 'approve', mrId, '--repo', repoPath], { encoding: 'utf-8', stdio: 'inherit' });
          console.log(`✅ MR !${mrId} approved.`);
        } else {
          // Needs changes: post as a resolvable discussion thread (blocking)
          postBlockingDiscussion(repoPath, mrId, content);
          console.log(`🔴 MR !${mrId} — blocking discussion created (needs changes).`);
        }
      } catch (err) {
        console.error(`❌ Failed to process MR ${mrId} in ${repoKey}:`, err.message);
      }
    }
  }
} catch (err) {
  console.error('Failed to run publish script:', err.message);
}

/**
 * Post a review as a resolvable discussion thread using the GitLab Discussions API.
 * Discussions created via this endpoint are resolvable by default on MRs,
 * making them blocking — the author must resolve them before merge.
 */
function postBlockingDiscussion(repoPath, mrId, body) {
  // We need the project ID. Fetch it from the MR metadata.
  const mrViewRaw = execFileSync('glab', ['mr', 'view', mrId, '--repo', repoPath, '--output', 'json'], { encoding: 'utf-8' });
  const mrData = JSON.parse(mrViewRaw);
  const projectId = mrData.project_id;

  // Use glab api to create a discussion (resolvable thread)
  // POST /projects/:id/merge_requests/:merge_request_iid/discussions
  const apiPath = `projects/${projectId}/merge_requests/${mrId}/discussions`;

  execFileSync('glab', ['api', apiPath, '-X', 'POST', '-f', `body=${body}`], {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
}

/**
 * Resolve any previous unresolved discussions that were started by us (the reviewer).
 * This prevents stacking up old blocking discussions when re-reviewing an MR.
 */
function resolvePreviousReviewDiscussions(repoPath, mrId) {
  try {
    const mrViewRaw = execFileSync('glab', ['mr', 'view', mrId, '--repo', repoPath, '--output', 'json'], { encoding: 'utf-8' });
    const mrData = JSON.parse(mrViewRaw);
    const projectId = mrData.project_id;

    // Fetch all discussions for this MR
    const discussionsRaw = execFileSync('glab', ['api', `projects/${projectId}/merge_requests/${mrId}/discussions`], { encoding: 'utf-8' });
    const discussions = JSON.parse(discussionsRaw);

    for (const discussion of discussions) {
      // Only resolve discussions that are:
      // 1. Resolvable (i.e., actual threads, not system notes)
      // 2. Not yet resolved
      // 3. Started by us (check first note's author)
      const firstNote = discussion.notes?.[0];
      if (!firstNote) continue;

      const isResolvable = firstNote.resolvable === true;
      const isUnresolved = firstNote.resolved === false;
      const isOurs = firstNote.author?.username === 'anasdoura607';

      // Also check if the note body looks like a review (starts with "## 📌 Summary")
      const isReviewNote = firstNote.body?.includes('## 📌 Summary');

      if (isResolvable && isUnresolved && isOurs && isReviewNote) {
        console.log(`  ↻ Resolving previous review discussion ${discussion.id}...`);
        execFileSync('glab', [
          'api',
          `projects/${projectId}/merge_requests/${mrId}/discussions/${discussion.id}`,
          '-X', 'PUT',
          '-f', 'resolved=true',
        ], { encoding: 'utf-8', stdio: 'inherit' });
      }
    }
  } catch (err) {
    // Non-fatal: if we can't resolve old discussions, still proceed with posting
    console.warn(`  ⚠ Could not resolve previous discussions: ${err.message}`);
  }
}
