const fs = require('fs');
const https = require('https');
const vm = require('vm');

const babelUrl = 'https://unpkg.com/@babel/standalone@7.29.7/babel.min.js';
const htmlPath = '/Users/punam/Desktop/Internship or Courses/Competitions/Current/2026/participation/AI buildfest/Frontend and UI/index.html';

console.log("Fetching Babel Standalone from unpkg...");
https.get(babelUrl, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Babel Standalone fetched successfully. Running in VM...");
    
    // Set up a VM context to run Babel Standalone
    const context = {
      window: {},
      navigator: {},
      document: {},
      console: console
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(data, context);
    
    const Babel = context.Babel;
    if (!Babel) {
      console.error("Failed to load Babel in VM!");
      process.exit(1);
    }
    
    console.log("Babel Standalone loaded in VM. Reading index.html...");
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const startTag = '<script type="text/babel">';
    const endTag = '</script>';
    
    const startIndex = htmlContent.indexOf(startTag);
    const endIndex = htmlContent.lastIndexOf(endTag);
    
    if (startIndex === -1 || endIndex === -1) {
      console.error("Could not find Babel script tags in index.html!");
      process.exit(1);
    }
    
    const code = htmlContent.substring(startIndex + startTag.length, endIndex);
    
    console.log("Compiling code with Babel Standalone...");
    try {
      const output = Babel.transform(code, {
        presets: ['react'],
        plugins: []
      });
      console.log("🎉 SUCCESS! No compilation/syntax errors in Babel standalone!");
    } catch (err) {
      console.error("❌ BABEL COMPILATION ERROR DETECTED:");
      console.error(err.message);
      console.error(err.stack);
      process.exit(2);
    }
  });
}).on('error', (err) => {
  console.error("Failed to fetch Babel Standalone:", err);
});
