const fs = require('fs');
const path = require('path');

/**
 * Update README Repositories Table
 * 
 * Reads `metis.repos.json` and updates the markdown table in `README.md`.
 */

function updateReadme() {
    const rootDir = path.resolve(__dirname, '..');
    const configPath = path.join(rootDir, 'metis.repos.json');
    const readmePath = path.join(rootDir, 'README.md');

    if (!fs.existsSync(configPath) || !fs.existsSync(readmePath)) {
        console.error('❌ Error: metis.repos.json or README.md not found.');
        return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const repos = config.repos || [];

    // Generate Markdown Table
    let table = '| Repo Name | Role | Technology |\n| :--- | :--- | :--- |\n';
    repos.forEach(repo => {
        table += `| \`${repo.name}\` | ${repo.description || 'N/A'} | ${repo.stack || 'N/A'} |\n`;
    });

    // Replace table in README
    let readme = fs.readFileSync(readmePath, 'utf8');
    
    // Regex matches the table between the header and a following section or end of file
    // Assumes the table starts with | Repo Name | Role | Technology |
    const tableRegex = /\| Repo Name \| Role \| Technology \|\n\| :--- \| :--- \| :--- \|\n(?:\|.*\|\n)*/;
    
    if (tableRegex.test(readme)) {
        const updatedReadme = readme.replace(tableRegex, table);
        fs.writeFileSync(readmePath, updatedReadme, 'utf8');
        console.log('\x1b[32m✅ README.md repositories table updated.\x1b[0m');
    } else {
        console.error('\x1b[31m❌ Error: Could not find repositories table in README.md\x1b[0m');
    }
}

updateReadme();
