const fs = require('fs');
const path = require('path');

const dashPath = path.resolve(__dirname, 'Frontend and UI', 'climalogix_dashboard.jsx');
let content = fs.readFileSync(dashPath, 'utf8');

const lines = content.split('\n');

const startLineIdx = lines.findIndex(l => l.includes('// Inline AuthPanel Component'));
const endLineIdx = lines.findIndex(l => l.startsWith('function CLimaLogixApp()'));

if (startLineIdx !== -1 && endLineIdx !== -1) {
  // Remove lines from startLineIdx to endLineIdx - 1
  lines.splice(startLineIdx, endLineIdx - startLineIdx);
  fs.writeFileSync(dashPath, lines.join('\n'));
  console.log('Removed broken AuthPanel fragment successfully.');
} else {
  console.log('Could not find start or end index.');
}
