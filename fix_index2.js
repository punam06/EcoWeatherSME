const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, 'Frontend and UI', 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// The file might be truncated or messed up at the end. We will just append the correct ending.
// Let's find where AuthPanel.js is included.
const authIndex = content.indexOf('<script src="./AuthPanel.js"></script>');
if (authIndex !== -1) {
    content = content.substring(0, authIndex + '<script src="./AuthPanel.js"></script>'.length);
    content += `
    <script type="text/babel" src="./climalogix_dashboard.jsx"></script>
    <script type="text/babel">
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(<window.ErrorBoundary><CLimaLogixApp /></window.ErrorBoundary>);
    </script>
  </body>
</html>
`;
    fs.writeFileSync(indexPath, content);
    console.log("Fixed index.html ending!");
} else {
    console.log("AuthPanel not found");
}
