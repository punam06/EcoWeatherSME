import re

def update_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add isVoiceProcessing state to ChatbotView
    state_injection = '''    const [hasAttemptedVoice, setHasAttemptedVoice] = useState(false);
    const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);'''
    content = content.replace('    const [hasAttemptedVoice, setHasAttemptedVoice] = useState(false);', state_injection, 1)

    # 2. Modify voiceRes fetch in ChatbotView
    old_fetch = '''        const voiceRes = await fetch(`${BACKEND_URL}/api/orders/voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: orderContext.productName,
            quantity: orderContext.quantity,
            farmerId: user ? user.id : undefined,
            customProducts: products.filter(p => p.isCustom)
          })
        });'''
    new_fetch = '''        setIsVoiceProcessing(true);
        const voiceRes = await fetch(`${BACKEND_URL}/api/checkout/voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcript })
        });'''
    content = content.replace(old_fetch, new_fetch, 1)

    # Add finally block to reset isVoiceProcessing
    if 'setIsVoiceProcessing(false)' not in content:
        content = content.replace('      } catch (err) {', '      } catch (err) {\n        setIsVoiceProcessing(false);', 1)
        content = content.replace('        setOrderContext(null);\n      }', '        setOrderContext(null);\n        setIsVoiceProcessing(false);\n      }', 1)

    # 3. Add spinner and disable mic button in ChatbotView
    old_mic = '''        {voiceSupported && (
          <button 
            onClick={handleVoice} 
            style={{
              background: isRecording ? ACCENT.red : "transparent",
              border: "none", color: isRecording ? "#fff" : "var(--text-secondary)", fontSize: 20, cursor: "pointer",
              padding: "8px 12px", borderRadius: 8, transition: "all 0.2s"
            }}
          >
            {isRecording ? "dY"-" : "dY""}
          </button>
        )}'''
    new_mic = '''        {voiceSupported && (
          isVoiceProcessing ? (
            <div id="voice-order-spinner" className="glass-spinner" style={{ width: 24, height: 24, border: "3px solid rgba(16,185,129,0.3)", borderTopColor: "#10B981", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
          ) : (
            <button 
              onClick={handleVoice} 
              disabled={isVoiceProcessing}
              style={{
                background: isRecording ? ACCENT.red : "transparent",
                border: "none", color: isRecording ? "#fff" : "var(--text-secondary)", fontSize: 20, cursor: isVoiceProcessing ? "wait" : "pointer",
                padding: "8px 12px", borderRadius: 8, transition: "all 0.2s",
                opacity: isVoiceProcessing ? 0.5 : 1
              }}
            >
              {isRecording ? "dY"-" : "dY""}
            </button>
          )
        )}'''
    content = content.replace(old_mic, new_mic, 1)

    # 4. Add Order Timeline to MarketplaceView checkoutSuccess
    old_order_meta = '''              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>ORDER METADATA</div>
              Order ID: <strong style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{checkoutSuccess.orderId}</strong>'''
    new_order_meta = '''              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>ORDER METADATA</div>
              Order ID: <strong style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{checkoutSuccess.orderId}</strong>
              
              <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1, height: 4, background: "#10B981", borderRadius: 2 }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: "#10B981", textTransform: "uppercase" }}>Pending</div>
                <div style={{ flex: 1, height: 4, background: "var(--border-primary)", borderRadius: 2 }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Processing</div>
                <div style={{ flex: 1, height: 4, background: "var(--border-primary)", borderRadius: 2 }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Completed</div>
              </div>'''
    content = content.replace(old_order_meta, new_order_meta, 1)

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

for fname in ['Frontend and UI/index.html', 'Frontend and UI/climalogix_dashboard.jsx']:
    update_file(fname)

print("Block 2 completed programmatically.")
