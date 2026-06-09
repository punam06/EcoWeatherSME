const fs = require('fs');
const path = require('path');

const dashPath = path.resolve(__dirname, 'Frontend and UI', 'climalogix_dashboard.jsx');
let content = fs.readFileSync(dashPath, 'utf8');

// 1. Remove the const React destructuring line
content = content.replace(/const\s+\{\s*useState,\s*useEffect,\s*useRef,\s*useCallback,\s*useMemo\s*\}\s*=\s*(?:window\.)?React(?:\s*\|\|\s*React)?\s*;/g, '');
content = content.replace(/var\s+\{\s*useState,\s*useEffect,\s*useRef,\s*useCallback,\s*useMemo\s*\}\s*=\s*(?:window\.)?React(?:\s*\|\|\s*React)?\s*;/g, '');

// 2. Remove internal AuthPanel
const sig = 'function AuthPanel({ onClose, onAuthSuccess }) {';
const startIdx = content.indexOf(sig);
if (startIdx !== -1) {
  let bodyStart = startIdx + sig.length - 1; // points to the '{' at the end of sig
  let bracketCount = 0;
  let endIdx = -1;
  let started = false;
  
  for (let i = bodyStart; i < content.length; i++) {
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
    // Also remove the `// Inline AuthPanel Component` comment
    const beforeSig = content.lastIndexOf('// Inline AuthPanel Component', startIdx);
    const sliceStart = beforeSig !== -1 ? beforeSig : startIdx;
    
    content = content.substring(0, sliceStart) + content.substring(endIdx);
    fs.writeFileSync(dashPath, content);
    console.log('Removed internal AuthPanel correctly.');
  }
} else {
  fs.writeFileSync(dashPath, content);
  console.log('AuthPanel not found, updated react hooks.');
}
