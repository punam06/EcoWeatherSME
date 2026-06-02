const fs = require('fs');

const content = fs.readFileSync('Frontend and UI/ecosortha_dashboard.jsx', 'utf8');
const lines = content.split('\n');

let unifiedStack = [];
let inString = false;
let stringChar = '';
let inComment = false;
let commentType = ''; // 'single' or 'multi'

const MATCHING = {
  '}': '{',
  ')': '(',
  ']': '['
};

for (let l = 0; l < lines.length; l++) {
  const line = lines[l];
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    const nextChar = line[c + 1];

    if (inComment) {
      if (commentType === 'single') {
        break;
      } else if (commentType === 'multi' && char === '*' && nextChar === '/') {
        inComment = false;
        c++;
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

    // Comments
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

    // Strings
    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }

    // Brackets check
    if (char === '{' || char === '(' || char === '[') {
      unifiedStack.push({ type: char, line: l + 1, col: c + 1 });
    } else if (char === '}' || char === ')' || char === ']') {
      if (unifiedStack.length === 0) {
        console.error(`ERROR: Extra closing '${char}' at Line ${l + 1}, Col ${c + 1}`);
      } else {
        const top = unifiedStack.pop();
        const expected = MATCHING[char];
        if (top.type !== expected) {
          console.error(`ERROR: Mismatched closing '${char}' at Line ${l + 1}, Col ${c + 1}. Expected match for '${top.type}' from Line ${top.line}, Col ${top.col}`);
        }
      }
    }
  }

  if (inComment && commentType === 'single') {
    inComment = false;
  }
}

console.log('--- Nesting Check Complete ---');
if (unifiedStack.length > 0) {
  console.log(`ERROR: There are ${unifiedStack.length} unclosed brackets!`);
  console.log('Last 5 unclosed:', unifiedStack.slice(-5));
} else {
  console.log('SUCCESS: All brackets are perfectly nested and balanced!');
}
