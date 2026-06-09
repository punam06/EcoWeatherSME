const fs = require('fs');
const path = require('path');

const scratchPath = path.resolve(__dirname, 'scratch_index.html');
const dashPath = path.resolve(__dirname, 'Frontend and UI', 'climalogix_dashboard.jsx');

const content = fs.readFileSync(scratchPath, 'utf8');

const marker = 'function LanguageSelector() {';
const startIndex = content.indexOf(marker);

if (startIndex === -1) {
  console.error("Marker not found!");
  process.exit(1);
}

// Find the start of the script tag
let extracted = content.slice(startIndex);

// The script might be prefixed with some whitespace or comments, let's just dump from function LanguageSelector
const scriptEnd = extracted.indexOf('</script>');
if (scriptEnd !== -1) {
  extracted = extracted.slice(0, scriptEnd);
}

fs.writeFileSync(dashPath, extracted, 'utf8');
console.log("Successfully extracted to climalogix_dashboard.jsx");
console.log("Extracted length: " + extracted.length);
