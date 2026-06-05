const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'Frontend and UI', 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

if (!html.includes('@supabase/supabase-js')) {
  html = html.replace(
    '<!-- React + Babel (browser) -->',
    '<!-- Supabase -->\n    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n\n    <!-- React + Babel (browser) -->'
  );
}

if (!html.includes('AuthPanel.jsx')) {
  html = html.replace(
    '<script type="text/babel">',
    '<script type="text/babel" src="./AuthPanel.jsx"></script>\n    <script type="text/babel">'
  );
}

const clAppStart = html.indexOf('function CLimaLogixApp() {');
if (clAppStart !== -1 && !html.includes('supabase.auth.onAuthStateChange')) {
  const injectionPoint = html.indexOf('const [isLoading, setIsLoading] = useState(true);', clAppStart);
  if (injectionPoint !== -1) {
    const injection = `
      // SUPABASE AUTH GLOBAL STATE
      useEffect(() => {
        if (!window.supabase) return;
        const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        window.supabaseClient = sb;
        
        sb.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            setCurrentUser(session.user);
            setAuthToken(session.access_token);
          }
        });

        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
          if (session) {
            setCurrentUser(session.user);
            setAuthToken(session.access_token);
          } else {
            setCurrentUser(null);
            setAuthToken(null);
          }
        });

        return () => subscription.unsubscribe();
      }, []);
    `;
    
    // Inject it right after the useState(true);
    const endOfLine = html.indexOf('\n', injectionPoint);
    html = html.slice(0, endOfLine + 1) + injection + html.slice(endOfLine + 1);
    
    // Replace login button action
    // Currently, how does it show AuthPanel? It probably doesn't. Or maybe there is `setShowAuthPanel`?
    // Let's add states if they don't exist
    if (!html.includes('const [showAuthPanel, setShowAuthPanel] = useState(false);')) {
      const stateInjection = `\n        const [showAuthPanel, setShowAuthPanel] = useState(false);\n`;
      html = html.slice(0, endOfLine + 1) + stateInjection + html.slice(endOfLine + 1);
    }
  }
}

fs.writeFileSync(indexPath, html, 'utf-8');
console.log('Update complete.');
