const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

try {
  // Read repos from the configuration file
  const reposData = require("../metis.repos.json");
  const remotes = {};
  for (const repo of reposData.repos) {
    remotes[repo.name] = repo.remote;
  }

  console.log("Fetching MRs for each repository...\n");
  fs.rmSync("mrs", { recursive: true, force: true });
  fs.mkdirSync("mrs", { recursive: true });

  // Loop over each entry
  let totalMRsFound = 0;
  const repoKeys = Object.keys(remotes);

  for (const repoKey of repoKeys) {
    const url = remotes[repoKey];
    console.log(`\x1b[36m[${repoKey}]\x1b[0m Checking for MRs...`);

    // Extract the REPO path (e.g. "git@gitlab.com:GroupeAdnenis/metis-connect/api-aerial" -> "GroupeAdnenis/metis-connect/api-aerial")
    let repoPath = url;
    if (repoPath.startsWith("git@gitlab.com:")) {
      repoPath = repoPath.substring("git@gitlab.com:".length);
    }

    // Support HTTPS urls just in case it changes later
    if (repoPath.startsWith("https://gitlab.com/")) {
      repoPath = repoPath.substring("https://gitlab.com/".length);
    }

    try {
      const command = `glab mr list --reviewer=@me --not-draft --repo ${repoPath} --output=json`;

      // Execute and capture the output as a string
      const outputRaw = execSync(command, { encoding: "utf-8" });
      const mrs = outputRaw.trim() ? JSON.parse(outputRaw) : [];

      if (!mrs.length) {
        console.log(`  - No assigned MRs found.`);
        continue;
      }

      const mappedMRs = [];
      for (const mr of mrs) {
        // Step 1: Check if already approved
        const approvalsRaw = execSync(
          `glab api projects/${mr.project_id}/merge_requests/${mr.iid}/approvals`,
          { encoding: "utf-8" },
        );
        const approvals = JSON.parse(approvalsRaw);
        if (approvals.approved_by.some((a) => a.user.username === "anasdoura607")) {
          continue;
        }

        // Step 2: Fetch full MR context to check comments and updates
        const MRViewCommand = `glab mr view ${mr.iid} --repo ${repoPath} --comments --output=json`;
        const mrDataRaw = execSync(MRViewCommand, { encoding: "utf-8" });
        const mrData = JSON.parse(mrDataRaw);

        // Analyze notes to see if we are waiting for author
        let lastNoteByMe = null;
        let lastNoteByOthers = null;

        const allNotes = (mrData.Discussions || [])
          .flatMap((d) => d.notes || [])
          .filter((n) => !n.system && n.author.username !== "Reouven");

        for (const note of allNotes) {
          const noteDate = new Date(note.created_at);
          if (note.author.username === "anasdoura607") {
            if (!lastNoteByMe || noteDate > new Date(lastNoteByMe.created_at)) {
              lastNoteByMe = note;
            }
          } else {
            if (!lastNoteByOthers || noteDate > new Date(lastNoteByOthers.created_at)) {
              lastNoteByOthers = note;
            }
          }
        }

        let isWaitingForAuthor = false;
        if (lastNoteByMe) {
          isWaitingForAuthor = true;
          const myNoteTime = new Date(lastNoteByMe.created_at);

          // If someone else commented after me, I need to check it
          if (lastNoteByOthers && new Date(lastNoteByOthers.created_at) > myNoteTime) {
            isWaitingForAuthor = false;
          }

          // If a new pipeline/commit was pushed after my last comment, I need to re-review
          if (mrData.pipeline && new Date(mrData.pipeline.created_at) > myNoteTime) {
            isWaitingForAuthor = false;
          }
        }

        if (isWaitingForAuthor) {
          console.log(`    \x1b[90m- !${mr.iid}: Already reviewed, waiting for author...\x1b[0m`);
          continue;
        }

        mappedMRs.push({
          id: mr.iid,
          repo: repoPath,
          title: mr.title,
          data: mrData,
        });
      }

      if (!mappedMRs.length) {
        console.log(`  - All MRs already approved or waiting for author.`);
        continue;
      }

      console.log(`  - Found ${mappedMRs.length} MR(s) needing review:`);
      totalMRsFound += mappedMRs.length;

      // Save MR context and diff
      for (const mr of mappedMRs) {
        console.log(`    \x1b[90m> Fetching !${mr.id}: ${mr.title.substring(0, 50)}${mr.title.length > 50 ? "..." : ""}\x1b[0m`);
        const dirPath = path.join("mrs", repoKey, mr.id.toString());
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

        const mrData = mr.data;

        // Filter out notes from "Reouven" (bot/automated comments)
        if (mrData.Discussions) {
          mrData.Discussions = mrData.Discussions.map((discussion) => {
            discussion.notes = (discussion.notes || []).filter(
              (note) => note.author.username !== "Reouven",
            );
            return discussion;
          }).filter((discussion) => discussion.notes.length > 0);
        }

        fs.writeFileSync(
          path.join(dirPath, `${mr.id}.json`),
          JSON.stringify(mrData, null, 2),
        );

        const diffCommand = `glab mr diff ${mr.id} -R ${mr.repo} > ${path.join(dirPath, `${mr.id}_diff.txt`)}`;
        execSync(diffCommand, { encoding: "utf-8" });
      }
    } catch (e) {
      console.error(
        `  \x1b[31mError fetching MRs for ${repoKey}.\x1b[0m`,
      );
    }
  }
  console.log(`\n\x1b[32mFinished! Total MRs to review: ${totalMRsFound}\x1b[0m\n`);
} catch (err) {
  console.error("Failed to read workspace config or execute script:", err);
}
