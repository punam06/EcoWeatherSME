const fs = require('fs');

const content = fs.readFileSync('Frontend and UI/ecosortha_dashboard.jsx', 'utf8');
const lines = content.split('\n');

let braceDepth = 0;
let parenDepth = 0;
let bracketDepth = 0;

let inString = false;
let stringChar = '';
let inComment = false;
let commentType = ''; // 'single' or 'multi'

let braceStack = [];
let parenStack = [];
let bracketStack = [];

for (let l = 0; l < lines.length; l++) {
  const line = lines[l];
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    const nextChar = line[c + 1];

    if (inComment) {
      if (commentType === 'single') {
        // Single-line comment ends at the end of the line
        break;
      } else if (commentType === 'multi' && char === '*' && nextChar === '/') {
        inComment = false;
        c++; // skip '/'
      }
      continue;
    }

    if (inString) {
      if (char === '\\') {
        c++; // skip escaped char
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    // Check for comments
    if (char === '/' && nextChar === '/') {
      inComment = true;
      commentType = 'single';
      c++;
      continue;
    }
    if (char === '/' && nextChar === '*') {
      inComment = true;
      commentType = 'multi';
      c++;
      continue;
    }

    // Check for strings (double, single, or backticks)
    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }

    // Depth checks
    if (char === '{') {
      braceDepth++;
      braceStack.push({ line: l + 1, col: c + 1 });
    } else if (char === '}') {
      braceDepth--;
      if (braceStack.length > 0) {
        braceStack.pop();
      } else {
        console.error(`ERROR: Unmatched '}' at Line ${l + 1}, Col ${c + 1}`);
      }
    } else if (char === '(') {
      parenDepth++;
      parenStack.push({ line: l + 1, col: c + 1 });
    } else if (char === ')') {
      parenDepth--;
      if (parenStack.length > 0) {
        parenStack.pop();
      } else {
        console.error(`ERROR: Unmatched ')' at Line ${l + 1}, Col ${c + 1}`);
      }
    } else if (char === '[') {
      bracketDepth++;
      bracketStack.push({ line: l + 1, col: c + 1 });
    } else if (char === ']') {
      bracketDepth--;
      if (bracketStack.length > 0) {
        bracketStack.pop();
      } else {
        console.error(`ERROR: Unmatched ']' at Line ${l + 1}, Col ${c + 1}`);
      }
    }
  }

  // End of line single-line comment reset
  if (inComment && commentType === 'single') {
    inComment = false;
  }
}

console.log('--- Depth Summary ---');
console.log('Brace Depth:', braceDepth);
console.log('Parenthesis Depth:', parenDepth);
console.log('Bracket Depth:', bracketDepth);

if (braceStack.length > 0) {
  console.log('Unclosed `{` locations (first 5):', braceStack.slice(-5));
}
if (parenStack.length > 0) {
  console.log('Unclosed `(` locations (first 5):', parenStack.slice(-5));
}
if (bracketStack.length > 0) {
  console.log('Unclosed `[` locations (first 5):', bracketStack.slice(-5));
}
