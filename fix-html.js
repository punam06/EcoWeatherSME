const fs = require('fs');

const file = 'd:/user_jabu/hackathon-ev/Frontend and UI/index.html';
let html = fs.readFileSync(file, 'utf-8');

// Find the giant inline script block
const startTag = '<script type="text/babel">';
let startIdx = html.indexOf(startTag);

// Because there are smaller babel scripts before it (like AuthPanel.jsx), let's find the one that doesn't have a src
let searchIdx = 0;
while (true) {
    const idx = html.indexOf(startTag, searchIdx);
    if (idx === -1) break;
    // Check if it has a src attribute. Actually we are searching for exactly <script type="text/babel"> with no other attributes
    const substr = html.substring(idx, idx + 50);
    if (substr.startsWith('<script type="text/babel">')) {
        startIdx = idx;
        break;
    }
    searchIdx = idx + 1;
}

const endTag = '</script>';
const endIdx = html.lastIndexOf(endTag);

if (startIdx !== -1 && endIdx !== -1) {
    // The giant inline script starts at startIdx and ends at endIdx.
    // Wait! Let's be safer: find the endTag immediately following the inline script contents (the last one in the file).
    const blockEnd = html.indexOf(endTag, startIdx) + endTag.length;
    // Actually, since it's a huge file, maybe the last script tag is the right one.
    // Let's just find where `root.render` is.
    const rootRenderIdx = html.lastIndexOf('root.render');
    const finalEndIdx = html.indexOf(endTag, rootRenderIdx) + endTag.length;

    // We will replace this entire giant block with the new script tags!
    // But wait, the prompt says "placed before the dashboard script tag".
    // AND "Main dashboard script last: climalogix_dashboard.jsx"
    // Which means we should remove the inline code entirely and just use the external climalogix_dashboard.jsx file!
    
    // BUT what about the ReactRouterDOM initialization? That was inline.
    // Is it in climalogix_dashboard.jsx?
    // In our grep earlier, climalogix_dashboard.jsx HAS `root.render(<CLimaLogixApp />);`
    // However, the inline script has:
    /*
    const AppWithRouter = window.ReactRouterDOM ? <window.ReactRouterDOM.BrowserRouter><window.ErrorBoundary><CLimaLogixApp /></window.ErrorBoundary></window.ReactRouterDOM.BrowserRouter> : <window.ErrorBoundary><CLimaLogixApp /></window.ErrorBoundary>;
      root.render(AppWithRouter);
    */
    // If we just use climalogix_dashboard.jsx as it is, we lose the router wrapper. But the instructions say "Main dashboard script last: - climalogix_dashboard.jsx", implying we should just load that.
    
    // Let's look at what we currently have in the html right before the inline script:
    //     <script type="text/babel" src="./ThreeScene.js"></script>
    //     <script type="text/babel" src="./AuthPanel.jsx"></script>
    //     <script src="https://unpkg.com/react-router-dom@6/umd/react-router-dom.production.min.js"></script>
    //     <script type="text/babel" src="./ErrorBoundary.jsx"></script>
    
    // We should replace the inline script block with the requested sequence:
    const newScripts = `
    <!-- Component files in dependency order -->
    <script type="text/babel" src="./components/DhakaRouteMicroMap.jsx"></script>
    <script type="text/babel" src="./components/ZoneDetailPanel.jsx"></script>
    <script type="text/babel" src="./components/RouteExposureMapCard.jsx"></script>
    <script type="text/babel" src="./components/OrderTimeline.jsx"></script>
    <script type="text/babel" src="./components/CheckoutDialog.jsx"></script>
    
    <!-- Main dashboard script last -->
    <script type="text/babel" src="./climalogix_dashboard.jsx"></script>

    <!-- Keep the initialization logic that was at the bottom of the inline script -->
    <script type="text/babel">
      const initializeAndMount = async () => {
        if (!window.SUPABASE_ANON_KEY) {
          window.SUPABASE_ANON_KEY = 'sb_publishable_H-_gcEncBp26k2iCHKOb_g_3RDQSr_M';
        }
        if (window.supabase && !window.supabaseClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
          window.supabaseClient = window.supabase.createClient(
            window.SUPABASE_URL,
            window.SUPABASE_ANON_KEY
          );
        }
        const root = ReactDOM.createRoot(document.getElementById("root"));
        const AppWithRouter = window.ReactRouterDOM ? <window.ReactRouterDOM.BrowserRouter><window.ErrorBoundary><CLimaLogixApp /></window.ErrorBoundary></window.ReactRouterDOM.BrowserRouter> : <window.ErrorBoundary><CLimaLogixApp /></window.ErrorBoundary>;
        root.render(AppWithRouter);
      };
      initializeAndMount();
    </script>
`;

    html = html.substring(0, startIdx) + newScripts + html.substring(finalEndIdx);
    
    // Also remove the old AuthPanel.jsx if it's there (since we deleted it in the previous step)
    html = html.replace('<script type="text/babel" src="./AuthPanel.jsx"></script>', '');
    
    fs.writeFileSync(file, html, 'utf-8');
    console.log("Successfully updated index.html");
} else {
    console.log("Could not find inline script block!");
}
