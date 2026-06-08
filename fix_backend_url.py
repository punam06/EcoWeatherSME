import re

for filename in ['Frontend and UI/index.html', 'Frontend and UI/climalogix_dashboard.jsx']:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove IS_LOCAL_DEV
    content = re.sub(r'const IS_LOCAL_DEV = window\.location\.hostname === "localhost" \|\| window\.location\.hostname === "127\.0\.0\.1";\s*', '', content)
    
    # Remove BACKEND_URL
    content = re.sub(r'const BACKEND_URL = IS_LOCAL_DEV \? \'http://localhost:5001\' : \'https://backsme\.onrender\.com\';\s*', '', content)
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
print("Removed BACKEND_URL duplicates")
