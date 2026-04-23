const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

async function main() {
  let name, remote;

  if (args.length === 1 || (args.length >= 2 && !args[1])) {
    remote = args[0];
    // Infer name from remote: git@gitlab.com:user/repo.git -> repo
    const parts = remote.split('/');
    const lastPart = parts[parts.length - 1];
    name = lastPart.replace(/\.git$/, '');
  } else if (args.length >= 2) {
    [remote, name] = args;
  } else {
    console.log('Usage: node tasks/add_repo.js <remote> [name]');
    process.exit(1);
  }

  const rootDir = path.resolve(__dirname, '..');
  const workspacePath = path.join(rootDir, 'metis.code-workspace');
  const gitignorePath = path.join(rootDir, '.gitignore');

  // 1. Update metis.code-workspace
  try {
    const rawContent = fs.readFileSync(workspacePath, 'utf8');
    const foldersMatch = rawContent.match(/"folders":\s*\[([\s\S]*?)\]/);
    
    if (foldersMatch) {
      const newFolderEntry = `    {
      "name": "${name}",
      "path": "${name}",
      "gitRemote": "${remote}"
    }`;
      
      const updatedFolders = foldersMatch[1].trim() + ',\n' + newFolderEntry;
      const updatedContent = rawContent.replace(foldersMatch[1], '\n' + updatedFolders + '\n  ');
      
      fs.writeFileSync(workspacePath, updatedContent);
      console.log(`✅ Added ${name} to metis.code-workspace`);
    }
  } catch (error) {
    console.error(`❌ Error updating workspace: ${error.message}`);
  }

  // 2. Update .gitignore
  try {
    let gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes(`${name}/`)) {
      if (gitignore.includes('# Sub-projects')) {
        gitignore = gitignore.replace('# Sub-projects (managed by scripts)', `# Sub-projects (managed by scripts)\n${name}/`);
      } else {
        gitignore += `\n${name}/`;
      }
      fs.writeFileSync(gitignorePath, gitignore);
      console.log(`✅ Added ${name} to .gitignore`);
    }
  } catch (error) {
    console.error(`❌ Error updating .gitignore: ${error.message}`);
  }

  process.stdout.write(`\n🚀 Run 'Sync All' task to clone the new repository.\n`);
}

main().catch(err => {
  console.error(`❌ Fatal error: ${err.message}`);
  process.exit(1);
});
