const fs = require('fs');
const path = require('path');

const dashPath = path.resolve(__dirname, 'Frontend and UI', 'climalogix_dashboard.jsx');
let content = fs.readFileSync(dashPath, 'utf8');

// Find the start of function AuthPanel
const startIdx = content.indexOf('function AuthPanel({');
if (startIdx !== -1) {
  // Find the end. The function is inside the file, so let's match brackets.
  let bracketCount = 0;
  let endIdx = -1;
  let started = false;
  
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === '{') {
      bracketCount++;
      started = true;
    } else if (content[i] === '}') {
      bracketCount--;
      if (started && bracketCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  
  if (endIdx !== -1) {
    const newContent = content.substring(0, startIdx) + content.substring(endIdx);
    fs.writeFileSync(dashPath, newContent);
    console.log('Removed internal AuthPanel from climalogix_dashboard.jsx');
  }
}

// Add AuthPanel.js to index.html
const indexPath = path.resolve(__dirname, 'Frontend and UI', 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
if (!indexContent.includes('<script src="./AuthPanel.js"></script>')) {
  indexContent = indexContent.replace('<script type="text/babel" src="./climalogix_dashboard.jsx"></script>', 
    '<script src="./AuthPanel.js"></script>\n    <script type="text/babel" src="./climalogix_dashboard.jsx"></script>');
  fs.writeFileSync(indexPath, indexContent);
  console.log('Added AuthPanel.js back to index.html');
}
