const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const htmlPath = path.resolve(__dirname, 'Frontend and UI/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const dom = new JSDOM(htmlContent, {
  url: "http://localhost/",
  runScripts: "dangerously",
  resources: "usable" // Load external scripts!
});

dom.window.addEventListener("error", (event) => {
  console.error("JSDOM Error:", event.error);
});

// We need to wait for scripts to load and execute
setTimeout(() => {
  console.log("JSDOM Output after 5s...");
  // Check if root has anything
  const root = dom.window.document.getElementById('root');
  console.log('Root HTML length:', root ? root.innerHTML.length : 'No root');
}, 5000);
