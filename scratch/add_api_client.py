import re

filepath = r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<script src="./toast.js"></script>', '<script src="./api-client.js"></script>\n    <script src="./toast.js"></script>')

# Add react-router-dom scripts right before React and ReactDOM scripts
react_scripts = """  <!-- React Router DOM -->
  <script src="https://unpkg.com/@remix-run/router@1.6.2/dist/router.umd.min.js"></script>
  <script src="https://unpkg.com/react-router@6.11.2/dist/umd/react-router.production.min.js"></script>
  <script src="https://unpkg.com/react-router-dom@6.11.2/dist/umd/react-router-dom.production.min.js"></script>
"""
if "react-router" not in content:
    content = content.replace('<!-- React & ReactDOM -->', react_scripts + '\n    <!-- React & ReactDOM -->')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
