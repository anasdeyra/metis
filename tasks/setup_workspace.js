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

  // 5. Write back with trailing commas (JSONC style VS Code expects)
  const output = addTrailingCommas(JSON.stringify(workspace, null, 2));
  fs.writeFileSync(workspacePath, output + '\n', 'utf8');

  // 6. Rebuild .gitignore sub-projects section
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    let gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const repoEntries = allRepos.map((r) => `${r.name}/`).join('\n');
    // Replace everything between the sub-projects header and the next blank line or section
    gitignore = gitignore.replace(
      /(# Sub-projects \(managed by scripts\))\n[\s\S]*?(\r?\n\r?\n)/,
      `$1\n${repoEntries}$2`,
    );
    fs.writeFileSync(gitignorePath, gitignore);
  }

  log(colors.bright + colors.green, `✅ metis.code-workspace & .gitignore updated`);
  log(colors.yellow, '   ⚠️  Reload VS Code window for changes to take effect (Ctrl+Shift+P → Reload)');
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
