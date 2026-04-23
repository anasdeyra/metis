const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m"
};

const log = (color, message) => console.log(`${color}${message}${colors.reset}`);

function syncAll() {
  const rootDir = process.cwd();
  const workspacePath = path.join(rootDir, 'metis.code-workspace');
  
  if (!fs.existsSync(workspacePath)) {
    log(colors.red, `❌ Error: metis.code-workspace not found in ${rootDir}`);
    return;
  }

  // Read and parse workspace file (handling potential comments and trailing commas)
  let workspace;
  try {
    const rawContent = fs.readFileSync(workspacePath, 'utf8');
    // Strip comments
    let cleanContent = rawContent.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
    // Strip trailing commas
    cleanContent = cleanContent.replace(/,\s*([\]}])/g, '$1');
    workspace = JSON.parse(cleanContent);
  } catch (error) {
    log(colors.red, `❌ Error parsing metis.code-workspace: ${error.message}`);
    return;
  }

  const projects = (workspace.folders || []).filter(f => f.gitRemote);

  log(colors.bright + colors.cyan, `🚀 Starting sync for ${projects.length} repositories...\n`);

  for (const project of projects) {
    const dir = project.path === '.' ? null : project.path;
    if (!dir) continue; // Skip root

    const fullPath = path.join(rootDir, dir);
    const remote = project.gitRemote;

    // 1. Check if directory exists
    if (!fs.existsSync(fullPath)) {
      log(colors.bright + colors.yellow, `📂 Cloning ${project.name} from ${remote}...`);
      try {
        execSync(`git clone ${remote} ${dir}`, { cwd: rootDir, stdio: 'inherit' });
        log(colors.green, `   ✅ Successfully cloned.`);
      } catch (error) {
        log(colors.red, `   ❌ Error cloning ${project.name}: ${error.message}`);
        continue;
      }
    } else {
      log(colors.bright + colors.blue, `📂 Updating ${project.name}...`);
    }

    // 2. Sync existing repo
    try {
      const targetBranch = 'development';

      // Check if it's a git repo
      if (!fs.existsSync(path.join(fullPath, '.git'))) {
        log(colors.yellow, `   ⚠️ Warning: ${dir} exists but is not a git repository. Skipping sync.`);
        continue;
      }

      log(colors.cyan, `   🔄 Switching to ${targetBranch}...`);
      execSync(`git checkout ${targetBranch}`, { cwd: fullPath, stdio: 'ignore' });

      log(colors.cyan, `   📥 Fetching and pulling latest changes...`);
      execSync('git fetch', { cwd: fullPath, stdio: 'ignore' });
      const pullResult = execSync('git pull', { cwd: fullPath }).toString();
      
      if (pullResult.includes('Already up to date')) {
        log(colors.green, `   ✅ Already up to date.`);
      } else {
        log(colors.green, `   ✨ Successfully pulled updates.`);
      }
    } catch (error) {
      log(colors.red, `   ❌ Error updating ${project.name}: ${error.message.split('\n')[0]}`);
    }
    console.log();
  }

  log(colors.bright + colors.green, `🏁 Finished sync process.`);
}

syncAll();
