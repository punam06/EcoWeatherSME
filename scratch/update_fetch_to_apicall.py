import re

filepath = r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace fetch in MarketplaceView
content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/products)`\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`);',
    content
)

# Replace fetch in SettingsView (GET)
content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/profile)`, \{\s*headers: \{ "Authorization": `Bearer \$\{token\}` \}\s*\}\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`);',
    content
)

# Replace fetch in SettingsView (PUT)
content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/profile)`, \{\s*method: "PUT",\s*headers: \{\s*"Content-Type": "application/json",\s*"Authorization": `Bearer \$\{token\}`\s*\},\s*(body: JSON\.stringify\(\{.*?\})\s*\}\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`, { method: "PUT", \2 });',
    content,
    flags=re.DOTALL
)

# Replace fetch in DeliveryView (GET)
content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/deliveries)`, \{\s*headers: \{ "Authorization": `Bearer \$\{token\}` \}\s*\}\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`);',
    content
)

# Replace fetch in DeliveryView (Optimize PUT)
content = re.sub(
    r'await fetch\(`\$\{BACKEND_URL\}(/api/deliveries/\$\{shipmentId\}/optimize)`, \{\s*method: "PUT",\s*headers: \{ "Authorization": `Bearer \$\{token\}` \}\s*\}\);',
    r'await window.apiCall(`\1`, { method: "PUT" });',
    content
)

# Replace fetch in DeliveryView (Acknowledge PUT)
content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/deliveries/\$\{shipmentId\}/acknowledge)`, \{\s*method: "PUT",\s*headers: \{ "Authorization": `Bearer \$\{token\}` \}\s*\}\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`, { method: "PUT" });',
    content
)

# Remove unused token definitions inside these handlers
content = re.sub(r'\s*const token = window\.SUPABASE_SESSION_TOKEN \|\| localStorage\.getItem\("sb-token"\);', '', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

filepath_html = r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html"
with open(filepath_html, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Replace fetch in MarketplaceView
html_content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/products)`\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`);',
    html_content
)

# Replace fetch in SettingsView (GET)
html_content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/profile)`, \{\s*headers: \{ "Authorization": `Bearer \$\{token\}` \}\s*\}\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`);',
    html_content
)

# Replace fetch in SettingsView (PUT)
html_content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/profile)`, \{\s*method: "PUT",\s*headers: \{\s*"Content-Type": "application/json",\s*"Authorization": `Bearer \$\{token\}`\s*\},\s*(body: JSON\.stringify\(\{.*?\})\s*\}\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`, { method: "PUT", \2 });',
    html_content,
    flags=re.DOTALL
)

# Replace fetch in DeliveryView (GET)
html_content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/deliveries)`, \{\s*headers: \{ "Authorization": `Bearer \$\{token\}` \}\s*\}\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`);',
    html_content
)

# Replace fetch in DeliveryView (Optimize PUT)
html_content = re.sub(
    r'await fetch\(`\$\{BACKEND_URL\}(/api/deliveries/\$\{shipmentId\}/optimize)`, \{\s*method: "PUT",\s*headers: \{ "Authorization": `Bearer \$\{token\}` \}\s*\}\);',
    r'await window.apiCall(`\1`, { method: "PUT" });',
    html_content
)

# Replace fetch in DeliveryView (Acknowledge PUT)
html_content = re.sub(
    r'const res = await fetch\(`\$\{BACKEND_URL\}(/api/deliveries/\$\{shipmentId\}/acknowledge)`, \{\s*method: "PUT",\s*headers: \{ "Authorization": `Bearer \$\{token\}` \}\s*\}\);\s*const json = await res\.json\(\);',
    r'const json = await window.apiCall(`\1`, { method: "PUT" });',
    html_content
)

html_content = re.sub(r'\s*const token = window\.SUPABASE_SESSION_TOKEN \|\| localStorage\.getItem\("sb-token"\);', '', html_content)

with open(filepath_html, 'w', encoding='utf-8') as f:
    f.write(html_content)

print("Done")
