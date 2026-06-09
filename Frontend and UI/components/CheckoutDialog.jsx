

function CheckoutDialog({ onClose, onComplete, totalItems, totalPrice, zone }) {
        const [stage, setStage] = useState(1);
        const [method, setMethod] = useState('');
        
        useEffect(() => {
          if (stage === 3) {
            const timer = setTimeout(() => {
              onComplete();
            }, 2000);
            return () => clearTimeout(timer);
          }
        }, [stage, onComplete]);

        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(11, 15, 25, 0.8)", backdropFilter: "blur(4px)" }}>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 16, width: "90%", maxWidth: 480, border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)", overflow: "hidden", animation: "fadeSlideIn 0.3s ease" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-primary)" }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Secure Checkout</h3>
                {stage < 3 && <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 20 }}>+�</button>}
              </div>
              
              <div style={{ padding: 24 }}>
                {/* Stage indicators */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32, position: "relative" }}>
                  <div style={{ position: "absolute", top: 12, left: 20, right: 20, height: 2, background: "var(--border-primary)", zIndex: 0 }} />
                  {['Delivery', 'Payment', 'Processing'].map((s, i) => (
                    <div key={s} style={{ zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <div style={{ 
                        width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600,
                        background: stage > i ? "#10B981" : stage === i + 1 ? "var(--bg-primary)" : "var(--bg-secondary)",
                        color: stage > i ? "#0B0F19" : stage === i + 1 ? "#10B981" : "var(--text-secondary)",
                        border: `2px solid ${stage >= i + 1 ? "#10B981" : "var(--border-primary)"}`
                      }}>
                        {stage > i ? "G��" : i + 1}
                      </div>
                      <span style={{ fontSize: 11, color: stage >= i + 1 ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: stage === i + 1 ? 600 : 400 }}>{s}</span>
                    </div>
                  ))}
                </div>

                {stage === 1 && (
                  <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Delivery Zone</div>
                      <div style={{ padding: 16, background: "var(--bg-primary)", color: "var(--text-primary)", borderRadius: 8, border: "1px solid var(--border-primary)", fontWeight: 600 }}>{zone}</div>
                    </div>
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Order Summary</div>
                      <div style={{ padding: 16, background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border-primary)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                          <span>Items ({totalItems})</span>
                          <span style={{ color: "var(--text-primary)" }}>a�� {totalPrice.toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, borderTop: "1px dashed var(--border-primary)", paddingTop: 8, color: "var(--text-primary)" }}>
                          <span>Total</span>
                          <span style={{ color: "#10B981" }}>a�� {totalPrice.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setStage(2)} style={{ width: "100%", padding: 14, background: "#10B981", color: "#0B0F19", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 15, transition: "background 0.2s" }}>Continue to Payment</button>
                  </div>
                )}

                {stage === 2 && (
                  <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Select Payment Method</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                      {['bKash', 'Nagad', 'Card', 'Ledger Credit'].map(m => (
                        <button 
                          key={m} 
                          onClick={() => setMethod(m)}
                          style={{ 
                            padding: 16, borderRadius: 8, textAlign: "left", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
                            background: method === m ? "rgba(16, 185, 129, 0.1)" : "var(--bg-primary)", 
                            border: `1px solid ${method === m ? "#10B981" : "var(--border-primary)"}`,
                            color: method === m ? "#10B981" : "var(--text-primary)",
                            display: "flex", alignItems: "center", justifyContent: "space-between"
                          }}
                        >
                          {m}
                          {method === m && <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#10B981", border: "2px solid #0B0F19" }} />}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => setStage(3)} 
                      disabled={!method}
                      style={{ width: "100%", padding: 14, background: method ? "#10B981" : "var(--bg-input)", color: method ? "#0B0F19" : "var(--text-secondary)", border: "none", borderRadius: 8, fontWeight: 700, cursor: method ? "pointer" : "not-allowed", fontSize: 15, transition: "all 0.2s" }}
                    >
                      Confirm Payment
                    </button>
                  </div>
                )}

                {stage === 3 && (
                  <div style={{ animation: "fadeSlideIn 0.3s ease", textAlign: "center", padding: "32px 0" }}>
                    <div style={{ width: 48, height: 48, border: "4px solid var(--border-primary)", borderTopColor: "#10B981", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 24px" }} />
                    <h4 style={{ margin: "0 0 8px", fontSize: 16, color: "var(--text-primary)" }}>Processing Transaction</h4>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Verifying ledger commitment and generating receipt...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
      window.CheckoutDialog = CheckoutDialog;


