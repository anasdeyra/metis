const fs = require('fs');
const path = require('path');

/**
 * Setup Workspace Script
 *
 * Reads `metis.repos.json` and patches `metis.code-workspace` to update
 * only the `folders` and `settings.files.exclude` fields based on enabled repos.
 * All other workspace properties (launch, tasks, settings, etc.) are preserved as-is.
 *
 * Usage: node tasks/setup_workspace.js
 */

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const log = (color, message) => console.log(`${color}${message}${colors.reset}`);

/**
 * Parse a JSONC string (handles trailing commas and comments).
 * @param {string} raw
 * @returns {Record<string, unknown>}
 */
function parseJsonc(raw) {
  // Strip comments while preserving strings (handles // inside URLs)
  let clean = raw.replace(
    /("(?:[^"\\]|\\.)*")|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
    (match, strGroup) => (strGroup ? strGroup : ''),
  );
  // Strip trailing commas before } or ]
  clean = clean.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(clean);
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const configPath = path.join(rootDir, 'metis.repos.json');
  const workspacePath = path.join(rootDir, 'metis.code-workspace');

  // 1. Read config
  if (!fs.existsSync(configPath)) {
    log(colors.red, '❌ Error: metis.repos.json not found.');
    process.exit(1);
  }
  if (!fs.existsSync(workspacePath)) {
    log(colors.red, '❌ Error: metis.code-workspace not found.');
    process.exit(1);
  }

  /** @type {{ repos: Array<{ name: string; remote: string; enabled: boolean }> }} */
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const allRepos = config.repos || [];
  const enabledRepos = allRepos.filter((r) => r.enabled);

  log(colors.bright + colors.cyan, `📋 Found ${allRepos.length} repos, ${enabledRepos.length} enabled\n`);
  enabledRepos.forEach((r) => log(colors.green, `  ✔ ${r.name}`));
  allRepos
    .filter((r) => !r.enabled)
    .forEach((r) => log(colors.yellow, `  ○ ${r.name} (disabled)`));
  console.log();

  // 2. Read & parse existing workspace
  const workspaceRaw = fs.readFileSync(workspacePath, 'utf8');
  const workspace = parseJsonc(workspaceRaw);

  // 3. Rebuild folders — enabled repos + metis root
  workspace.folders = [
    ...enabledRepos.map((r) => ({
      name: r.name,
      path: r.name,
      gitRemote: r.remote,
    })),
    { name: 'metis', path: '.' },
  ];

  // 4. Rebuild files.exclude — all repo dirs (enabled or disabled)
  if (!workspace.settings) workspace.settings = {};
  const filesExclude = {};
  for (const r of allRepos) {
    filesExclude[r.name] = true;
  }
  workspace.settings['files.exclude'] = filesExclude;

  // 5. Configure Git to automatically detect repositories, but ignore disabled ones
  workspace.settings['git.autoRepositoryDetection'] = true;
  workspace.settings['git.repositoryScanIgnoredFolders'] = allRepos
    .filter((r) => !r.enabled)
    .map((r) => r.name);
  workspace.settings['git.ignoredRepositories'] = [];
  
  // SCM and Repository visibility settings
  workspace.settings['scm.repositories.selectionMode'] = 'multiple';
  workspace.settings['scm.repositories.explorer'] = true;
  workspace.settings['scm.repositories.visible'] = 5;
  workspace.settings['scm.repositories.sortOrder'] = 'name';
  workspace.settings['scm.alwaysShowRepositories'] = true;
  workspace.settings['scm.defaultViewMode'] = 'tree';

  // 6. Rebuild tasks.inputs "repoName" options
  if (workspace.tasks && workspace.tasks.inputs) {
    const repoNameInput = workspace.tasks.inputs.find((i) => i.id === 'repoName');
    if (repoNameInput) {
      repoNameInput.options = enabledRepos.map((r) => r.name);
    }
  }

  // 6. Write back with trailing commas (JSONC style VS Code expects)
  const output = addTrailingCommas(JSON.stringify(workspace, null, 2));
  fs.writeFileSync(workspacePath, output + '\n', 'utf8');

  // 7. Rebuild .gitignore sub-projects section
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    let gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const repoEntries = allRepos.map((r) => `${r.name}/`).join('\n');
    // Replace everything between the sub-projects header and the next blank line or section
    gitignore = gitignore.replace(
      /(# Sub-projects \(managed by scripts\))\r?\n[\s\S]*?(\r?\n\r?\n)/,
      `$1\n${repoEntries}$2`,
    );
    fs.writeFileSync(gitignorePath, gitignore);
  }

  // 8. Update README repositories table
  try {
    require('./update_readme_repos.js');
  } catch (err) {
    log(colors.red, `⚠️ Warning: Failed to update README table: ${err.message}`);
  }

  // 9. Configure Git Hooks (NEW)
  configureGitHooks(rootDir, allRepos);

  log(colors.bright + colors.green, `✅ metis.code-workspace & .gitignore updated`);
  log(colors.yellow, '   ⚠️  Reload VS Code window for changes to take effect (Ctrl+Shift+P → Reload)');
}

/**
 * Configures Git repositories to use the version-controlled hooks in tasks/hooks.
 * @param {string} rootDir
 * @param {Array<{ name: string; enabled: boolean }>} allRepos
 */
function configureGitHooks(rootDir, allRepos) {
  const { execSync } = require('child_process');
  log(colors.bright + colors.cyan, '⚓ Configuring Git hooks...');

  // Configuration for root repository
  try {
    execSync('git config core.hooksPath tasks/hooks', { cwd: rootDir });
    log(colors.green, '  ✔ Root repository hooks configured');
  } catch (err) {
    log(colors.red, `  ✖ Failed to configure root hooks: ${err.message}`);
  }

  // Ensure sub-repositories do NOT use custom hooks path (per user request)
  allRepos.forEach(repo => {
    const repoPath = path.join(rootDir, repo.name);
    if (fs.existsSync(path.join(repoPath, '.git'))) {
      try {
        execSync('git config --unset core.hooksPath', { cwd: repoPath });
      } catch (err) {
        // Ignore if it was not set
      }
    }
  });
  console.log();
}

/**
 * Add trailing commas to JSON output so it matches the JSONC style
 * VS Code uses for .code-workspace files.
 * @param {string} json
 * @returns {string}
 */
function addTrailingCommas(json) {
  return json.replace(/(["\d\w}\\])\n(\s*[}\]])/g, '$1,\n$2');
}

main();
