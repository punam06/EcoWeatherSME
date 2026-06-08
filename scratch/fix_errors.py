import re

filepath = r'd:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

bad_block = """      }
      return s;
    }));
    if (onUpdateTrustScore) onUpdateTrustScore(prev => Math.min(100, prev + 4));
    showToast(`Delivery acknowledged! BARI Trust Score increased due to chain-of-custody confirmation.`, "success");
  };"""

content = content.replace(bad_block, "")
content = content.replace("const json = await res.json();", "")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed")
