import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove __SEED_BATCHES__ IIFE
    content = re.sub(r'/\* ═══════════════════════════════════════════════════════════════\n   BATCH REGISTRY – module-level seed data.*?\}\)\(\);\n', '', content, flags=re.DOTALL)
    
    # 2. Replace window.__SEED_BATCHES__ || [] with []
    content = content.replace('window.__SEED_BATCHES__ || []', '[]')

    # 3. Remove window.__SEED_BATCHES__ update in fetchBatches
    content = re.sub(r'if \(window\.__SEED_BATCHES__\) \{.*?\}', '', content, flags=re.DOTALL)
    
    # 4. Remove MOCK_PRODUCTS definition
    content = re.sub(r'const MOCK_PRODUCTS = \[.*?\];\n', 'const MOCK_PRODUCTS = [];\n', content, flags=re.DOTALL)

    # 5. Remove Seed Injection Button
    content = re.sub(r'<button[^>]*>\s*🚀 Inject Seed Batch.*?</button>', '', content, flags=re.DOTALL)
    
    # 6. Remove Mock database connection button (if any)
    # Actually wait, the instruction says "Remove Seed Injection button and __SEED_BATCHES__".
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx")
process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html")
print("Done")
