const fs = require('fs');

const jsxPath = 'Frontend and UI/climalogix_dashboard.jsx';
const htmlPath = 'Frontend and UI/index.html';

const jsxContent = fs.readFileSync(jsxPath, 'utf8');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// The jsx file starts with `import ...`. We remove that and replace it with `const { ... } = React;`
const jsxLines = jsxContent.split('\n');
const firstLine = jsxLines[0];
let reactBody = jsxContent;
if (firstLine.startsWith('import')) {
  reactBody = jsxLines.slice(1).join('\n');
}

// In index.html, find the <script type="text/babel"> and the ending </script>
const scriptStartStr = '<script type="text/babel">';
const scriptEndStr = '  </script>\n</body>';

const scriptStartIndex = htmlContent.indexOf(scriptStartStr);
const scriptEndIndex = htmlContent.lastIndexOf('</script>');

if (scriptStartIndex === -1 || scriptEndIndex === -1) {
  console.error("Could not find script tags in index.html");
  process.exit(1);
}

const htmlStart = htmlContent.substring(0, scriptStartIndex + scriptStartStr.length);
const htmlEnd = htmlContent.substring(scriptEndIndex);

const reactImports = '\n    const { useState, useEffect, useRef, useCallback } = React;\n';

const newHtmlContent = htmlStart + reactImports + reactBody + '\n  ' + htmlEnd;

fs.writeFileSync(htmlPath, newHtmlContent);
console.log("Successfully synced climalogix_dashboard.jsx into index.html");

