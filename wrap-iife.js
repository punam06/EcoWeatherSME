const fs = require('fs');
const path = require('path');

const filesToFix = [
  'Frontend and UI/dashboards/SMEOwnerDashboard.jsx',
  'Frontend and UI/dashboards/ProducerDashboard.jsx',
  'Frontend and UI/dashboards/InspectorDashboard.jsx'
];

for (const file of filesToFix) {
  const fullPath = path.resolve(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if already wrapped
    if (!content.trim().startsWith('(() => {')) {
      // Wrap the content
      content = `(() => {\n${content}\n})();\n`;
      fs.writeFileSync(fullPath, content);
      console.log('Wrapped ' + file + ' in IIFE');
    }
  }
}
