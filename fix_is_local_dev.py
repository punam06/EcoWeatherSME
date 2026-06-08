for filename in ['Frontend and UI/index.html', 'Frontend and UI/climalogix_dashboard.jsx']:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace("const IS_LOCAL_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';\n", '')
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
print("Done")
