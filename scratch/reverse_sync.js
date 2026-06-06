const fs = require('fs');

const jsxPath = 'Frontend and UI/climalogix_dashboard.jsx';
const htmlPath = 'Frontend and UI/index.html';

const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const scriptStartStr = '<script type="text/babel">';
const scriptEndStr = '  </script>\n  </body>';

const scriptStartIndex = htmlContent.indexOf(scriptStartStr);
const scriptEndIndex = htmlContent.lastIndexOf('</script>');

if (scriptStartIndex === -1 || scriptEndIndex === -1) {
  console.error("Could not find script tags in index.html");
  process.exit(1);
}

// Extract the React code block
let reactBody = htmlContent.substring(scriptStartIndex + scriptStartStr.length, scriptEndIndex);

// Standardize formatting
reactBody = reactBody.trim();

// Replace the React destructuring with ES6 import
const targetDestructure = 'const { useState, useEffect, useRef, useCallback, useMemo } = React;';
if (reactBody.startsWith(targetDestructure)) {
  reactBody = reactBody.substring(targetDestructure.length).trim();
}

const finalJsx = `import { useState, useEffect, useRef, useCallback, useMemo } from "react";\n\n` + reactBody;

fs.writeFileSync(jsxPath, finalJsx, 'utf8');
console.log("Successfully reverse-synced index.html into climalogix_dashboard.jsx");
