const fs = require('fs');

const indexPath = 'd:/user_jabu/hackathon-ev/Frontend and UI/index.html';
let content = fs.readFileSync(indexPath, 'utf-8');

// The scripts are currently loaded somewhere around line 380-400
// <script src="./api-integration.js"></script>
// <script src="./api-client.js"></script>
// ...
// <script type="text/babel">
// ... giant block ...
// </script>

const startTag = '<script type="text/babel">';
const endTag = '</script>';

// Find the last <script type="text/babel">
// Actually it's probably the one that contains the Dashboard. Let's find "function App" or "ReactDOM.createRoot"
const reactDomIndex = content.lastIndexOf('ReactDOM.createRoot');
if (reactDomIndex !== -1) {
    const blockStart = content.lastIndexOf(startTag, reactDomIndex);
    const blockEnd = content.indexOf(endTag, reactDomIndex) + endTag.length;
    
    if (blockStart !== -1 && blockEnd !== -1) {
        // We found the inline script. We should remove it.
        // Wait! The user asked to fix the script loading order.
        // Let's replace the whole scripts block with the correct order.
        // We should just replace the giant inline script with nothing, and then rewrite the script tags above.
        
        // Remove the giant inline script
        content = content.substring(0, blockStart) + content.substring(blockEnd);
    }
}

// Now we need to insert the script tags in the right order just before </body>
// First, remove existing script tags that we are going to re-order, to avoid duplicates.
// The list is:
// dhaka-zones.js (if it exists)
// api-integration.js
// components/DhakaRouteMicroMap.jsx
// components/ZoneDetailPanel.jsx
// components/RouteExposureMapCard.jsx
// components/OrderTimeline.jsx
// components/CheckoutDialog.jsx
// climalogix_dashboard.jsx

// Let's just locate </body> and insert the correct script block right before it
const scriptBlock = `
    <!-- Utility / Helper scripts -->
    <script src="./api-integration.js"></script>
    
    <!-- Component scripts in dependency order -->
    <script type="text/babel" src="./components/DhakaRouteMicroMap.jsx"></script>
    <script type="text/babel" src="./components/ZoneDetailPanel.jsx"></script>
    <script type="text/babel" src="./components/RouteExposureMapCard.jsx"></script>
    <script type="text/babel" src="./components/OrderTimeline.jsx"></script>
    <script type="text/babel" src="./components/CheckoutDialog.jsx"></script>
    
    <!-- Main Dashboard -->
    <script type="text/babel" src="./climalogix_dashboard.jsx"></script>
`;

content = content.replace('</body>', scriptBlock + '\n</body>');

fs.writeFileSync(indexPath, content, 'utf-8');
console.log('Fixed index.html script order');
