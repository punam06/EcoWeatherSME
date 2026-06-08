import re
for fname in ['Frontend and UI/index.html', 'Frontend and UI/climalogix_dashboard.jsx']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace("style={ accentColor: '#10B981', width: 16, height: 16 }", "style={{ accentColor: '#10B981', width: 16, height: 16 }}")
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(content)
