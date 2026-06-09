const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dashPath = path.resolve(__dirname, 'Frontend and UI', 'climalogix_dashboard.jsx');

// Use git directly to get the file contents as UTF-8
const content = execSync('git show "9dc6201:Frontend and UI/index.html"', { encoding: 'utf8' });

const marker = 'function LanguageSelector()';
const startIndex = content.indexOf(marker);

if (startIndex === -1) {
  console.error("Marker not found in git output!");
  process.exit(1);
}

// Find the <script type="text/babel"> right before the marker
const searchArea = content.slice(0, startIndex);
let scriptStart = searchArea.lastIndexOf('<script type="text/babel">');

if (scriptStart === -1) {
    scriptStart = searchArea.lastIndexOf("<script type='text/babel'>");
}

if (scriptStart === -1) {
    console.log("Could not find script tag, dumping from marker");
    scriptStart = startIndex;
}

// Start from the content inside the script
let extracted = content.slice(startIndex);

// Find the closing </script> after this content
const scriptEnd = extracted.indexOf('</script>');
if (scriptEnd !== -1) {
  extracted = extracted.slice(0, scriptEnd);
}

fs.writeFileSync(dashPath, extracted, 'utf8');
console.log("Successfully extracted to climalogix_dashboard.jsx");
console.log("Extracted length: " + extracted.length);
