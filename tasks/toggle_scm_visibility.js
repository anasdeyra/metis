#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Toggle SCM Visibility Script
 * 
 * Works around a VS Code UI bug where repositories in a multi-root workspace
 * sometimes disappear after branch switching. Toggling scm.repositories.selectionMode
 * from 'multiple' to 'single' and back forces a UI refresh.
 */

const workspacePath = path.join(__dirname, '..', 'metis.code-workspace');

function updateSelectionMode(mode) {
    if (!fs.existsSync(workspacePath)) return;
    
    let content = fs.readFileSync(workspacePath, 'utf8');
    // Simple regex replacement to keep the rest of the file intact
    const regex = /"scm\.repositories\.selectionMode":\s*"[^"]*"/;
    const replacement = `"scm.repositories.selectionMode": "${mode}"`;
    
    if (regex.test(content)) {
        content = content.replace(regex, replacement);
        fs.writeFileSync(workspacePath, content, 'utf8');
        console.log(`SCM Selection Mode set to: ${mode}`);
    }
}

async function main() {
    console.log('🔄 Toggling SCM visibility to force UI refresh...');
    
    // Wait a 5-second buffer to let VS Code settle after checkout
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 1. Set to single
    updateSelectionMode('single');
    
    // 2. Wait a moment for VS Code to react
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Set back to multiple
    updateSelectionMode('multiple');
    
    console.log('✅ SCM visibility toggled successfully.');
}

main();
