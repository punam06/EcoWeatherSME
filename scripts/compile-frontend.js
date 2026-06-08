const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const frontendDir = path.join(__dirname, '../Frontend and UI');
const indexPath = path.join(frontendDir, 'index.html');

function compileJSX(sourceCode, filename) {
  console.log(`Compiling ${filename}...`);
  const result = babel.transformSync(sourceCode, {
    filename,
    presets: ['@babel/preset-react'],
    compact: false,
    minified: false,
    comments: true
  });
  return result.code;
}

function main() {
  if (!fs.existsSync(indexPath)) {
    console.error(`index.html not found at ${indexPath}`);
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  // 1. Extract the massive inline <script type="text/babel">
  const inlineBabelRegex = /<script type="text\/babel">([\s\S]*?)<\/script>/;
  const match = html.match(inlineBabelRegex);

  if (match) {
    const inlineCode = match[1];
    const compiledInline = compileJSX(inlineCode, 'climalogix_dashboard.jsx');
    
    // Save compiled file
    fs.writeFileSync(path.join(frontendDir, 'climalogix_dashboard.js'), compiledInline);
    console.log('Saved compiled dashboard to climalogix_dashboard.js');

    // Replace in HTML
    html = html.replace(inlineBabelRegex, '<script src="./climalogix_dashboard.js"></script>');
  }

  // 2. Compile external JSX files referenced in index.html
  // Compile AuthPanel.jsx -> AuthPanel.js
  const authPanelPath = path.join(frontendDir, 'AuthPanel.jsx');
  if (fs.existsSync(authPanelPath)) {
    const authCode = fs.readFileSync(authPanelPath, 'utf8');
    const compiledAuth = compileJSX(authCode, 'AuthPanel.jsx');
    fs.writeFileSync(path.join(frontendDir, 'AuthPanel.js'), compiledAuth);
    console.log('Saved compiled AuthPanel to AuthPanel.js');
  }

  // Compile ThreeScene.js -> ThreeScene.compiled.js (or just ThreeScene.js compiled)
  const threeScenePath = path.join(frontendDir, 'ThreeScene.js');
  if (fs.existsSync(threeScenePath)) {
    const threeCode = fs.readFileSync(threeScenePath, 'utf8');
    const compiledThree = compileJSX(threeCode, 'ThreeScene.js');
    fs.writeFileSync(path.join(frontendDir, 'ThreeScene.compiled.js'), compiledThree);
    console.log('Saved compiled ThreeScene to ThreeScene.compiled.js');
  }

  // 3. Update script tags in index.html
  html = html.replace('<script type="text/babel" src="./ThreeScene.js"></script>', '<script src="./ThreeScene.compiled.js"></script>');
  html = html.replace('<script type="text/babel" src="./AuthPanel.jsx"></script>', '<script src="./AuthPanel.js"></script>');

  // 4. Remove Babel Standalone CDN script
  const babelCdnRegex = /<script [^>]*src="[^"]*babel\.min\.js"[^>]*><\/script>/i;
  html = html.replace(babelCdnRegex, '<!-- Babel Standalone removed for optimization -->');

  fs.writeFileSync(indexPath, html);
  console.log('Successfully optimized index.html!');
}

main();
