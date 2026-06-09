const fs = require('fs');
const path = require('path');

const scratchPath = path.resolve(__dirname, 'scratch_index.html');
const dashPath = path.resolve(__dirname, 'Frontend and UI', 'climalogix_dashboard.jsx');

const content = fs.readFileSync(scratchPath, 'utf8');

const marker = '// Inline LanguageSelector Component';
const startIndex = content.indexOf(marker);

if (startIndex === -1) {
  console.error("Marker not found!");
  process.exit(1);
}

// Find the start of the script tag that contains this marker
let scriptStart = content.lastIndexOf('<script type="text/babel">', startIndex);
if (scriptStart === -1) {
    scriptStart = content.lastIndexOf('<script type=\'text/babel\'>', startIndex);
}

// Extract everything from the marker down to the end of the script
let extracted = content.slice(startIndex);

// Find the first </script> after the marker
const scriptEnd = extracted.indexOf('</script>');
if (scriptEnd !== -1) {
  extracted = extracted.slice(0, scriptEnd);
}

// Write it to climalogix_dashboard.jsx
fs.writeFileSync(dashPath, extracted, 'utf8');
console.log("Successfully extracted 8000-line script to climalogix_dashboard.jsx");
console.log("Extracted length: " + extracted.length);
