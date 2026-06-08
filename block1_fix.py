import os

def update_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. State changes
    state_injection = '''    const [formError, setFormError] = useState("");
    const [checkedItems, setCheckedItems] = useState({});
    
    const CHECKLIST_ITEMS = [
      { id: 'feedstock', en: 'Feedstock meets organic criteria', bn: 'ফিডস্টক জৈব মানদণ্ড পূরণ করে' },
      { id: 'sop', en: 'SOP compliance verified', bn: 'এসওপি সম্মতি যাচাই করা হয়েছে' },
      { id: 'chemicals', en: 'No prohibited chemicals used', bn: 'কোনো নিষিদ্ধ রাসায়নিক ব্যবহার করা হয়নি' },
      { id: 'logs', en: 'Batch temperature logs available', bn: 'ব্যাচ তাপমাত্রা লগ পাওয়া যাচ্ছে' }
    ];

    const toggleItem = (id) => {
      setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };
'''
    if 'const [checkedItems' not in content:
        content = content.replace('    const [formError, setFormError] = useState("");', state_injection, 1)

    # 2. Trust Score Calculation Update
    trust_score_injection = '''          let checkedCount = 0;
          if (qaSource === 'manufacturer') {
            checkedCount = Object.values(checkedItems).filter(Boolean).length;
            if (checkedCount < 3) {
              const lang = window.languageManager ? window.languageManager.getLanguage() : 'en';
              if (window.showToast) {
                window.showToast(
                  lang === 'bn'
                    ? 'সতর্কতা: সব সম্মতি আইটেম চেক করা হয়নি।'
                    : 'Warning: Not all compliance items are checked.',
                  'warning'
                );
              }
            }
          }

          const json = await window.APIClient.getTrustScore({
            category,
            pH: conf.ph ? pH : 7.0,
            ec: EC,
            temperatureCelsius: temp,
            em1Ratio,
            fermentationDays: days,
            manufacturerCheckedCount: checkedCount,
            qaSource: qaSource
          });'''
    
    # We replace the getTrustScore call:
    import re
    if 'manufacturerCheckedCount' not in content:
        content = re.sub(r'const json = await window\.APIClient\.getTrustScore\(\{[\s\S]*?fermentationDays: days,?\s*\}\);', trust_score_injection, content, count=1)

    # 3. Dependencies update
    content = content.replace('}, [category, pH, EC, temp, ratio, days, onResult]);', '}, [category, pH, EC, temp, ratio, days, onResult, qaSource, checkedItems]);', 1)

    # 4. Wrap Sliders and Inject Checklist
    # I need to match everything from `{conf.ph ? (` to the end of the days slider
    slider_start = '''          {conf.ph ? ('''
    slider_end = '''            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Optimal: {conf.days.optimal}</div>
          </div>'''

    if '{qaSource === \'iot\' && (' not in content:
        start_idx = content.find(slider_start)
        end_idx = content.find(slider_end, start_idx) + len(slider_end)

        slider_block = content[start_idx:end_idx]

        lang = "window.languageManager ? window.languageManager.getLanguage() : 'en'"
        
        replacement = f'''
          {{qaSource === 'manufacturer' && (
            <div style={{ gridColumn: "1 / -1", background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)", marginBottom: 16 }}>
              <p style={{ color: "#F9FAFB", fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>
                {{{lang} === 'bn' ? 'সম্মতি যাচাইতালিকা' : 'Compliance Checklist'}}
              </p>
              {{CHECKLIST_ITEMS.map(item => (
                <label key={{item.id}} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={{checkedItems[item.id] || false}}
                    onChange={{() => toggleItem(item.id)}}
                    style={{ accentColor: '#10B981', width: 16, height: 16 }}
                  />
                  <span style={{ color: '#9CA3AF', fontSize: 13 }}>{{{lang} === 'bn' ? item.bn : item.en}}</span>
                </label>
              ))}}
            </div>
          )}}

          {{qaSource === 'iot' && (
            <div className="iot-sliders-group" style={{ display: 'contents' }}>
{slider_block}
            </div>
          )}}
'''
        content = content[:start_idx] + replacement + content[end_idx:]

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

for fname in ['Frontend and UI/index.html', 'Frontend and UI/climalogix_dashboard.jsx']:
    update_file(fname)

print("Block 1 completed programmatically.")
