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

  // Compile climalogix_dashboard.jsx -> climalogix_dashboard.js
  const dashboardPath = path.join(frontendDir, 'climalogix_dashboard.jsx');
  if (fs.existsSync(dashboardPath)) {
    const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
    const compiledDashboard = compileJSX(dashboardCode, 'climalogix_dashboard.jsx');
    fs.writeFileSync(path.join(frontendDir, 'climalogix_dashboard.js'), compiledDashboard);
    console.log('Saved compiled dashboard to climalogix_dashboard.js');
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

  // Compile ErrorBoundary.jsx -> ErrorBoundary.js
  // IMPORTANT: ErrorBoundary must be pre-compiled to a plain <script> so that
  // window.ErrorBoundary is defined synchronously by the time the pre-compiled
  // climalogix_dashboard.js calls React.createElement(window.ErrorBoundary, ...).
  // If we leave it as type="text/babel", Babel-standalone processes it
  // asynchronously, and the dashboard renders <undefined> -> React #130.
  const errorBoundaryPath = path.join(frontendDir, 'ErrorBoundary.jsx');
  if (fs.existsSync(errorBoundaryPath)) {
    const ebCode = fs.readFileSync(errorBoundaryPath, 'utf8');
    const compiledEb = compileJSX(ebCode, 'ErrorBoundary.jsx');
    fs.writeFileSync(path.join(frontendDir, 'ErrorBoundary.js'), compiledEb);
    console.log('Saved compiled ErrorBoundary to ErrorBoundary.js');
  }

  // 3. Update script tags in index.html
  html = html.replace('<script type="text/babel" src="./ThreeScene.js"></script>', '<script src="./ThreeScene.compiled.js"></script>');
  html = html.replace('<script type="text/babel" src="./AuthPanel.jsx"></script>', '<script src="./AuthPanel.js"></script>');
  html = html.replace('<script type="text/babel" src="./ErrorBoundary.jsx"></script>', '<script src="./ErrorBoundary.js"></script>');
  
  // Also link climalogix_dashboard.js if not already linked
  if (!html.includes('src="./climalogix_dashboard.js"')) {
    html = html.replace('<script type="text/babel" src="./climalogix_dashboard.jsx"></script>', '<script src="./climalogix_dashboard.js"></script>');
    // If it was inline, it might have been replaced already by the previous run, which is fine
  }

  // 4. Remove Babel Standalone CDN script
  // Removed this optimization because we now have many other JSX files (dashboards, components) 
  // that rely on runtime Babel compilation.
  // const babelCdnRegex = /<script [^>]*src="[^"]*babel\.min\.js"[^>]*><\/script>/i;
  // html = html.replace(babelCdnRegex, '<!-- Babel Standalone removed for optimization -->');

  fs.writeFileSync(indexPath, html);
  console.log('Successfully optimized index.html!');
}

main();
