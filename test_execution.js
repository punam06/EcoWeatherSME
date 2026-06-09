const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM("<!DOCTYPE html><html><head></head><body><div id='root'></div></body></html>", { runScripts: "dangerously" });
const window = dom.window;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;

window.React = require('react');
window.ReactDOM = require('react-dom/client');
window.useState = window.React.useState;
window.useEffect = window.React.useEffect;
window.useRef = window.React.useRef;
window.useCallback = window.React.useCallback;
window.useMemo = window.React.useMemo;

const fs = require('fs');
const babel = require('@babel/core');

function loadScript(path) {
  const code = fs.readFileSync(path, 'utf8');
  if (path.endsWith('.jsx')) {
    const compiled = babel.transformSync(code, { presets: ['@babel/preset-react'] }).code;
    window.eval(compiled);
  } else {
    window.eval(code);
  }
}

try {
  loadScript('Frontend and UI/AuthPanel.js');
  loadScript('Frontend and UI/climalogix_dashboard.jsx');
  console.log('CLimaLogixApp type:', typeof window.CLimaLogixApp);
} catch (e) {
  console.error('Execution error:', e);
}
