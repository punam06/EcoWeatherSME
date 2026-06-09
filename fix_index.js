const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, 'Frontend and UI', 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

const lines = content.split('\n');

const startIdx = lines.findIndex((l, i) => i > 410 && l.includes('<script type="text/babel">'));
const endIdx = lines.length - 1; // End of file

if (startIdx !== -1) {
  // Find the last </script>
  let lastScriptEnd = -1;
  for (let i = endIdx; i >= 0; i--) {
    if (lines[i].includes('</script>')) {
      lastScriptEnd = i;
      break;
    }
  }
  
  if (lastScriptEnd !== -1) {
    lines.splice(startIdx, lastScriptEnd - startIdx + 1);
    fs.writeFileSync(indexPath, lines.join('\n'));
    console.log('Removed massive duplicate inline script from index.html.');
  }
}
