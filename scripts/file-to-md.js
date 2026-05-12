/**
 * Converts any file into a .md file with a title, metadata table, and
 * the original file content inside a fenced code block.
 *
 * Usage (CLI):
 *   node file-to-md.js <file> [file2 ...] [--out <dir>]
 *
 * Usage (API):
 *   const { fileToMd } = require('./file-to-md');
 *   fileToMd('path/to/schema.xsd');                      // writes alongside source
 *   fileToMd('path/to/schema.xsd', 'path/to/out/');      // writes to given dir
 */

const fs   = require('fs');
const path = require('path');

const LANG_MAP = {
  js:   'javascript',
  ts:   'typescript',
  jsx:  'jsx',
  tsx:  'tsx',
  json: 'json',
  xml:  'xml',
  xsd:  'xml',
  yaml: 'yaml',
  yml:  'yaml',
  sh:   'bash',
  bash: 'bash',
  py:   'python',
  rb:   'ruby',
  go:   'go',
  rs:   'rust',
  java: 'java',
  cs:   'csharp',
  cpp:  'cpp',
  c:    'c',
  h:    'c',
  php:  'php',
  html: 'html',
  css:  'css',
  scss: 'scss',
  sql:  'sql',
  md:   'markdown',
  txt:  'text',
};

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/**
 * Converts a single file to a .md file.
 * @param {string} srcPath   - absolute or relative path to the source file
 * @param {string} [outDir]  - output directory; defaults to same dir as source
 * @returns {string}           path of the written .md file
 */
function fileToMd(srcPath, outDir) {
  srcPath = path.resolve(srcPath);

  const stat      = fs.statSync(srcPath);
  const filename  = path.basename(srcPath);
  const ext       = path.extname(filename).replace('.', '').toLowerCase();
  const lang      = LANG_MAP[ext] ?? ext ?? 'text';
  const lineCount = countLines(srcPath);
  const content   = fs.readFileSync(srcPath, 'utf8');

  const title = filename;

  const meta = [
    '| Field | Value |',
    '|---|---|',
    `| **File** | \`${filename}\` |`,
    `| **Type** | ${ext ? ext.toUpperCase() : 'unknown'} |`,
    `| **Size** | ${formatBytes(stat.size)} |`,
    `| **Lines** | ${lineCount.toLocaleString()} |`,
    `| **Modified** | ${formatDate(stat.mtime)} |`,
  ].join('\n');

  const md = `# ${title}\n\n${meta}\n\n\`\`\`${lang}\n${content}\n\`\`\`\n`;

  const destDir  = outDir ? path.resolve(outDir) : path.dirname(srcPath);
  fs.mkdirSync(destDir, { recursive: true });

  const destPath = path.join(destDir, filename.replace(new RegExp(`\\.${ext}$`, 'i'), '') + '.md');
  fs.writeFileSync(destPath, md, 'utf8');
  return destPath;
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').length;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  const outIdx = args.indexOf('--out');
  const outDir = outIdx !== -1 ? args.splice(outIdx, 2)[1] : null;

  if (args.length === 0) {
    console.error('Usage: node file-to-md.js <file> [file2 ...] [--out <dir>]');
    process.exit(1);
  }

  let ok = 0, fail = 0;
  for (const arg of args) {
    try {
      const dest = fileToMd(arg, outDir);
      console.log(`  wrote: ${dest}`);
      ok++;
    } catch (err) {
      console.error(`  error: ${arg} — ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone. ${ok} written, ${fail} failed.`);
}

module.exports = { fileToMd };
