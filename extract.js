const fs = require('fs');
const path = require('path');

const srcFile = 'd:/user_jabu/hackathon-ev/Frontend and UI/climalogix_dashboard.jsx';
const componentsDir = 'd:/user_jabu/hackathon-ev/Frontend and UI/components';

if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
}

let content = fs.readFileSync(srcFile, 'utf-8');

function extractFunction(name, isArrow=false) {
    let startIdx = -1;
    if (isArrow) {
        startIdx = content.indexOf(`const ${name} =`);
    } else {
        startIdx = content.indexOf(`function ${name}(`);
    }
    
    if (startIdx === -1) return null;

    let braceCount = 0;
    let endIdx = -1;
    let started = false;

    for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            started = true;
        } else if (content[i] === '}') {
            braceCount--;
            if (started && braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }

    if (endIdx !== -1) {
        const body = content.substring(startIdx, endIdx + 1);
        content = content.substring(0, startIdx) + content.substring(endIdx + 1);
        return body;
    }
    return null;
}

const comps = [
    { name: 'OrderTimeline', isArrow: false },
    { name: 'CheckoutDialog', isArrow: false },
    { name: 'DhakaRouteMicroMap', isArrow: true }
];

let imports = '';

for (const c of comps) {
    const code = extractFunction(c.name, c.isArrow);
    if (code) {
        const fileContent = `const { useState, useEffect } = React;\n\n${code}\n\nexport default ${c.name};\n`;
        fs.writeFileSync(path.join(componentsDir, `${c.name}.jsx`), fileContent, 'utf-8');
        imports += `import ${c.name} from './components/${c.name}.jsx';\n`;
        console.log(`Extracted ${c.name}`);
        
        // Remove the window assignment if any
        content = content.replace(new RegExp(`\\n\\s*window\\.${c.name}\\s*=\\s*${c.name};\\s*\\n`, 'g'), '\n');
    } else {
        console.log(`Could not find ${c.name}`);
    }
}

// Add imports to the top of the file
// But wait, the file doesn't have imports at the top! It's a babel script!
// "replace each extracted component's definition with an import statement at the top of the file"
content = imports + '\n' + content;

fs.writeFileSync(srcFile, content, 'utf-8');
console.log('Extraction complete');
