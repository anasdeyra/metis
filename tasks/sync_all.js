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
  const dirs = fs.readdirSync(rootDir).filter(file => {
    const fullPath = path.join(rootDir, file);
    return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, '.git'));
  });

  log(colors.bright + colors.cyan, `🚀 Starting sync for ${dirs.length} repositories...\n`);

  for (const dir of dirs) {
    const fullPath = path.join(rootDir, dir);
    log(colors.bright + colors.blue, `📂 Updating ${dir}...`);
    
    try {
      const targetBranch = 'development';

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
      log(colors.red, `   ❌ Error updating ${dir}: ${error.message.split('\n')[0]}`);
    }
    console.log(); // Add spacing between repos
  }

  log(colors.bright + colors.green, `🏁 Finished sync process.`);
}

syncAll();
