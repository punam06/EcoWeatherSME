import os

for filename in ['Frontend and UI/index.html', 'Frontend and UI/climalogix_dashboard.jsx']:
    filepath = os.path.join(r'd:\user_jabu\hackathon-ev', filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace('gpsError={gpsError} gpsError={gpsError}', 'gpsError={gpsError}')
    
    # Also I should check for the same duplicate block in index.html that I removed from climalogix_dashboard.jsx
    bad_block = '''      }
      return s;
    }));
    if (onUpdateTrustScore) onUpdateTrustScore(prev => Math.min(100, prev + 4));
    showToast(`Delivery acknowledged! BARI Trust Score increased due to chain-of-custody confirmation.`, "success");
  };'''
    content = content.replace(bad_block, '')
    content = content.replace('const json = await res.json();', '')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
print('Fixed duplicate attributes and bad blocks')
