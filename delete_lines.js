const fs = require('fs');
const path = require('path');

const dashPath = path.resolve(__dirname, 'Frontend and UI', 'climalogix_dashboard.jsx');
let content = fs.readFileSync(dashPath, 'utf8');

const lines = content.split('\n');

// 0-indexed, so line 88 is index 87, line 692 is index 691.
// We want to delete index 87 through 691 inclusive.
// So we splice starting at index 87, removing (691 - 87 + 1) = 605 lines.

lines.splice(87, 605);

// Also let's check if the react hooks destructuring is there at the top and remove it
if (lines[0].includes('const { useState') && lines[0].includes('React')) {
  lines[0] = '';
}

fs.writeFileSync(dashPath, lines.join('\n'));
console.log('Deleted lines 88 to 692.');
