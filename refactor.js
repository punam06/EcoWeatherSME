const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'Frontend and UI', 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

// 1. Add Supabase CDN
if (!html.includes('@supabase/supabase-js')) {
  html = html.replace(
    '<!-- React + Babel (browser) -->',
    '<!-- Supabase -->\n    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n\n    <!-- React + Babel (browser) -->'
  );
}

// 2. Add <script type="text/babel" src="./AuthPanel.jsx"></script>
if (!html.includes('AuthPanel.jsx')) {
  html = html.replace(
    '<script type="text/babel">',
    '<script type="text/babel" src="./AuthPanel.jsx"></script>\n    <script type="text/babel">'
  );
}

// 3. Extract AuthPanel component
const authPanelStart = html.indexOf('function AuthPanel({ onClose, onAuthSuccess }) {');
if (authPanelStart !== -1) {
  // Find the end of the AuthPanel function
  // We'll use a simple approach: find "return (" and count braces, or just find the closing brace that aligns with function
  // But wait, it's easier to just use regex or match the exact lines if we know them.
  // The component is large, let's find the `function AuthPanel` and its closing brace.
  
  let braceCount = 0;
  let inFunction = false;
  let authPanelEnd = -1;
  for (let i = authPanelStart; i < html.length; i++) {
    if (html[i] === '{') {
      braceCount++;
      inFunction = true;
    } else if (html[i] === '}') {
      braceCount--;
      if (inFunction && braceCount === 0) {
        authPanelEnd = i;
        break;
      }
    }
  }

  if (authPanelEnd !== -1) {
    const authPanelCode = html.substring(authPanelStart, authPanelEnd + 1);
    
    // Now we need to update AuthPanel to use Supabase Auth instead of our custom backend API.
    let modifiedAuthPanel = authPanelCode;
    modifiedAuthPanel = modifiedAuthPanel.replace(
      /const handleSubmit = async \(e\) => \{[\s\S]*?finally \{\s*setIsLoading\(false\);\s*\}\s*\};/,
      `const handleSubmit = async (e) => {
          e.preventDefault();
          setError("");
          setIsLoading(true);
          try {
            const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            let result;
            if (mode === "login") {
              result = await supabase.auth.signInWithPassword({ email, password });
            } else {
              result = await supabase.auth.signUp({
                email, password, options: { data: { name, role } }
              });
            }
            if (result.error) {
              setError(result.error.message || "Authentication failed");
              return;
            }
            if (onAuthSuccess) {
              onAuthSuccess(result.data.user, result.data.session?.access_token);
            }
            onClose();
          } catch (err) {
            setError("Connection failed. Please try again.");
          } finally {
            setIsLoading(false);
          }
        };`
    );

    fs.writeFileSync(path.join(__dirname, 'Frontend and UI', 'AuthPanel.jsx'), modifiedAuthPanel, 'utf-8');
    
    // Remove AuthPanel from index.html
    html = html.substring(0, authPanelStart) + html.substring(authPanelEnd + 1);
  }
}

// 4. Update CLimaLogixApp Root Auth Logic
// Replace the old user logic with Supabase
let clAppStart = html.indexOf('function CLimaLogixApp() {');
if (clAppStart !== -1) {
  // We need to inject Supabase setup and onAuthStateChange inside CLimaLogixApp
  const injectionPoint = html.indexOf('const [isLoading, setIsLoading] = useState(true);', clAppStart);
  if (injectionPoint !== -1) {
    if (!html.includes('supabase.auth.onAuthStateChange')) {
      const injection = `
        useEffect(() => {
          if (!window.supabase) return;
          const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
          
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
      // Replace the old checkAuth logic if it exists, or just insert.
      // The old logic probably uses useEffect to check localStorage.
      const oldUseEffectMatch = html.match(/useEffect\(\(\) => \{[\s\S]*?const token = localStorage\.getItem\("climalogix_access_token"\);[\s\S]*?\}, \[\]\);/);
      if (oldUseEffectMatch) {
        html = html.replace(oldUseEffectMatch[0], injection);
      }
      
      const oldHandleAuthSuccess = html.match(/const handleAuthSuccess = \(user, token\) => \{[\s\S]*?\};/);
      if (oldHandleAuthSuccess) {
        html = html.replace(oldHandleAuthSuccess[0], `const handleAuthSuccess = (user, token) => {};`); // Supabase handles this via event
      }
      
      const oldHandleLogout = html.match(/const handleLogout = \(\) => \{[\s\S]*?\};/);
      if (oldHandleLogout) {
        html = html.replace(oldHandleLogout[0], `
        const handleLogout = async () => {
          if (window.supabase) {
            const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            await sb.auth.signOut();
          }
          setCurrentUser(null);
          setAuthToken(null);
          setTab(0);
        };`);
      }
    }
  }
}

fs.writeFileSync(indexPath, html, 'utf-8');
console.log('Refactoring complete.');
