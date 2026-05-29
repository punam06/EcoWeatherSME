const fs = require('fs');
const path = require('path');

const htmlPath = '/Users/punam/Desktop/Internship or Courses/Competitions/Current/2026/participation/AI buildfest/Frontend and UI/index.html';
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const startTag = '<script type="text/babel">';
const endTag = '</script>';

const startIndex = htmlContent.indexOf(startTag);
const endIndex = htmlContent.lastIndexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find Babel script tags!");
  process.exit(1);
}

const jsContent = htmlContent.substring(startIndex + startTag.length, endIndex);

// We need to declare some global React types or simple variables so tsc won't complain about undefined globals
const preBlock = `
declare var React: any;
declare var ReactDOM: any;
declare var ACCENT: any;
declare var UHI_ZONES: any;
declare var calcBARIDVS: any;
declare var getSolarHourMultiplier: any;
declare var API_BASE_URL: any;
`;

const outputDir = '/Users/punam/Desktop/Internship or Courses/Competitions/Current/2026/participation/AI buildfest/scratch';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(path.join(outputDir, 'temp_extracted.tsx'), preBlock + jsContent, 'utf8');
console.log("Extracted script block to scratch/temp_extracted.tsx successfully!");
