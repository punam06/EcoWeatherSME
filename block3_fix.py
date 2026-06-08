import re

def update_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add checkoutStage state
    if 'const [checkoutStage, setCheckoutStage] = useState(0);' not in content:
        content = content.replace('const [isCheckingOut, setIsCheckingOut] = useState(false);', 
                                  'const [isCheckingOut, setIsCheckingOut] = useState(false);\n  const [checkoutStage, setCheckoutStage] = useState(0);')

    # 2. Modify handleCheckout behavior in Cart Drawer
    # Wait, handleCheckout previously did the setTimeout directly. 
    # Let's rename the original handleCheckout to processFinalCheckout.
    
    old_handle_checkout = '''  const handleCheckout = () => {
    setIsCheckingOut(true);
    setTimeout(() => {
      setIsCheckingOut(false);
      setCheckoutSuccess({
        orderId: `ord-${Math.floor(100000 + Math.random() * 900000)}`,
        txHash: `0x${Math.random().toString(16).substring(2, 10).padStart(8, '0')}`,
        zone: userZone,
        totalItems: cart.reduce((sum, item) => sum + item.quantity, 0),
        totalPrice: cart.reduce((sum, item) => {
          const basePrice = item.product.isClearance ? item.product.price * 0.7 : item.product.price;
          return sum + (basePrice * item.quantity);
        }, 0) + getShippingCost()
      });
      setCart([]);
    }, 1500);
  };'''

    new_handle_checkout = '''  const startCheckoutModal = () => {
    setIsCartOpen(false);
    setCheckoutStage(1);
  };

  const processFinalCheckout = () => {
    setCheckoutStage(2);
    setTimeout(() => {
      setCheckoutSuccess({
        orderId: `ord-${Math.floor(100000 + Math.random() * 900000)}`,
        txHash: `0x${Math.random().toString(16).substring(2, 10).padStart(8, '0')}`,
        zone: userZone,
        totalItems: cart.reduce((sum, item) => sum + item.quantity, 0),
        totalPrice: cartTotal + getShippingCost()
      });
      setCart([]);
      setCheckoutStage(3);
    }, 2000);
  };
  
  const handleCheckout = startCheckoutModal;'''
    
    content = content.replace(old_handle_checkout, new_handle_checkout, 1)

    # 3. Add the 3-stage modal code right before the checkoutSuccess rendering
    old_success_modal = '''      {/* Success Modal */}
      {checkoutSuccess && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "var(--bg-secondary)", padding: 40, borderRadius: 16, border: `1px solid ${ACCENT.greenBorder}`, maxWidth: 500, width: "90%", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: ACCENT.greenBg, color: ACCENT.green, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 32, margin: "0 auto 24px" }}>
              ✓
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: ACCENT.green, marginBottom: 8 }}>Order Successfully Placed!</h3>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
              Your order has been signed and queued for temperature-controlled transit to {checkoutSuccess.zone}.
            </p>
            <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: 8, border: "1px solid var(--border-primary)", textAlign: "left", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>ORDER METADATA</div>
              Order ID: <strong style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{checkoutSuccess.orderId}</strong>
              
              <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1, height: 4, background: "#10B981", borderRadius: 2 }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: "#10B981", textTransform: "uppercase" }}>Pending</div>
                <div style={{ flex: 1, height: 4, background: "var(--border-primary)", borderRadius: 2 }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Processing</div>
                <div style={{ flex: 1, height: 4, background: "var(--border-primary)", borderRadius: 2 }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Completed</div>
              </div>
              <br/>Items: <strong>{checkoutSuccess.totalItems}</strong> | Total Paid: <strong style={{ color: ACCENT.green }}>৳ {checkoutSuccess.totalPrice.toLocaleString()}</strong>
              <br/>Ledger Hash: <code style={{ color: ACCENT.blue, fontFamily: "'JetBrains Mono', monospace" }}>{checkoutSuccess.txHash}</code>
            </div>
            <button 
              onClick={() => { setCheckoutSuccess(null); setCheckoutStage(0); }}
              style={{ padding: "10px 24px", border: "none", borderRadius: 8, background: ACCENT.green, color: "#ffffff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
            >
              Return to Marketplace
            </button>
          </div>
        </div>
      )}'''

    new_dialog_logic = '''      {/* 3-Stage Checkout Dialog */}
      {checkoutStage > 0 && checkoutStage < 3 && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "var(--bg-secondary)", padding: 40, borderRadius: 16, border: "1px solid var(--border-primary)", maxWidth: 500, width: "90%" }}>
            {checkoutStage === 1 && (
              <>
                <h3 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, borderBottom: "1px solid var(--border-primary)", paddingBottom: 16 }}>Order Summary (Invoice)</h3>
                <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 20, background: "var(--bg-primary)", padding: 16, borderRadius: 8, border: "1px solid var(--border-primary)" }}>
                  {cart.map(item => (
                    <div key={item.product.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, borderBottom: "1px dashed var(--border-primary)", paddingBottom: 8 }}>
                      <span>{item.quantity}x {item.product.name}</span>
                      <strong>৳ {((item.product.isClearance ? item.product.price * 0.7 : item.product.price) * item.quantity).toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
                  <span>Subtotal + Shipping:</span>
                  <span style={{ color: ACCENT.green }}>৳ {(cartTotal + getShippingCost()).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => setCheckoutStage(0)} style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                  <button onClick={processFinalCheckout} style={{ flex: 2, padding: "12px", borderRadius: 8, border: "none", background: ACCENT.green, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Proceed to Validation</button>
                </div>
              </>
            )}
            
            {checkoutStage === 2 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div className="glass-spinner" style={{ margin: "0 auto 24px", width: 48, height: 48, border: `4px solid ${ACCENT.blueBg}`, borderTopColor: ACCENT.blue, borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: ACCENT.blue, marginBottom: 8 }}>Validating BSTI Hash & Microclimate Telemetry</h3>
                <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Connecting to secure ledger...</p>
              </div>
            )}
          </div>
        </div>
      )}

''' + old_success_modal.replace('setCheckoutSuccess(null);', 'setCheckoutSuccess(null); setCheckoutStage(0);')

    if 'checkoutStage > 0' not in content:
        content = content.replace(old_success_modal, new_dialog_logic, 1)

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

for fname in ['Frontend and UI/index.html', 'Frontend and UI/climalogix_dashboard.jsx']:
    update_file(fname)

print("Block 3 completed programmatically.")
