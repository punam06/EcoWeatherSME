import re

filepath = r'd:\user_jabu\hackathon-ev\Frontend and UI\index.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<script type="text/babel" src="./climalogix_dashboard.jsx"></script>', '<script type="text/babel" src="./ErrorBoundary.jsx"></script>\n    <script type="text/babel" src="./climalogix_dashboard.jsx"></script>')
content = content.replace('<CLimaLogixApp />', '<window.ErrorBoundary><CLimaLogixApp /></window.ErrorBoundary>')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
