const { useState, useEffect, useRef } = React;

const ACCENT = {
  green: "#10B981",
  greenBg: "rgba(16, 185, 129, 0.1)",
  greenBorder: "rgba(16, 185, 129, 0.3)",
  blue: "#3B82F6",
  amber: "#F59E0B",
  red: "#EF4444"
};

const DHAKA_ZONES = [
  "Mirpur", "Uttara", "Gulshan", "Banani", "Dhanmondi", "Motijheel", "Old Dhaka", "Badda"
];

const Card = ({ children, style }) => (
  <div style={{
    background: "rgba(17, 24, 39, 0.7)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "24px",
    ...style
  }}>
    {children}
  </div>
);

function OverviewView({ lang }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.apiCall('/api/dashboard')
      .then(res => {
        if (res && res.success) setData(res.data);
      })
      .catch(err => console.warn("Dashboard fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  const totalOrders = data?.kpis?.totalOrders || 0;
  const pendingDeliveries = data?.kpis?.pendingDeliveries || 0;
  const totalSpent = data?.kpis?.totalSpent || 0;
  const certifiedProducts = data?.kpis?.certifiedProducts || 0;
  const recentOrders = data?.recentOrders || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeSlideIn 0.4s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.blue}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'মোট অর্ডার' : 'Total Orders'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginTop: 8 }}>{totalOrders}</div>
        </Card>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.amber}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'পেন্ডিং ডেলিভারি' : 'Pending Deliveries'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT.amber, marginTop: 8 }}>{pendingDeliveries}</div>
        </Card>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.green}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'মোট খরচ (BDT)' : 'Total Spent (BDT)'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT.green, marginTop: 8 }}>৳ {totalSpent}</div>
        </Card>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.blue}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'সার্টিফাইড পণ্য কেনা' : 'Certified Products Bought'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginTop: 8 }}>{certifiedProducts}</div>
        </Card>
      </div>

      <Card>
        <h3 style={{ fontSize: 16, marginBottom: 16, color: "var(--text-primary)" }}>{lang === 'bn' ? 'সাম্প্রতিক অর্ডার' : 'Recent Orders'}</h3>
        {recentOrders.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Order ID</th>
                <th style={{ padding: "12px 8px" }}>Status</th>
                <th style={{ padding: "12px 8px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "12px 8px", color: "var(--text-primary)" }}>{o.id || o.order_id}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <span style={{ padding: "4px 8px", borderRadius: 4, background: "rgba(16, 185, 129, 0.1)", color: ACCENT.green }}>
                      {o.status || 'Pending'}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>৳ {o.total_price || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: "center", color: "var(--text-dim)", padding: 24 }}>
            {lang === 'bn' ? 'কোন সাম্প্রতিক অর্ডার নেই।' : 'No recent orders.'}
          </div>
        )}
      </Card>
    </div>
  );
}

function MarketplaceView({ lang, onCheckoutComplete }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    window.apiCall('/api/products')
      .then(res => {
        if (res && res.success && res.data) setProducts(res.data);
      })
      .catch(err => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
      <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'মার্কেটপ্লেস' : 'Marketplace'}</h2>
      
      {loading ? (
        <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading...</div>
      ) : products.length === 0 ? (
        <div style={{ color: "var(--text-dim)", padding: 20 }}>No products available at the moment.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {products.map(p => (
            <Card key={p.id} style={{ display: "flex", flexDirection: "column" }}>
              <h3 style={{ margin: "0 0 8px 0", color: "var(--text-primary)" }}>{p.name || p.product_name}</h3>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>{p.seller || "Certified Producer"}</div>
              
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{ background: ACCENT.greenBg, color: ACCENT.green, padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                  Trust: {p.trust_score || 'N/A'}
                </div>
                <div style={{ background: "rgba(59, 130, 246, 0.1)", color: ACCENT.blue, padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                  DVS: {p.dvs_score || 'N/A'}
                </div>
              </div>

              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                  ৳{p.price_per_kg || 150} <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 400 }}>/ kg</span>
                </div>
                <button 
                  onClick={() => setSelectedProduct(p)}
                  style={{ background: ACCENT.green, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
                >
                  {lang === 'bn' ? 'এখন কিনুন' : 'Buy Now'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedProduct && window.CheckoutDialog && (
        <window.CheckoutDialog 
          orderData={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onComplete={() => {
            setSelectedProduct(null);
            onCheckoutComplete();
          }}
          totalItems={1}
          totalPrice={selectedProduct.price_per_kg || 150}
          zone="Mirpur"
        />
      )}
    </div>
  );
}

function VoiceOrderView({ lang }) {
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef(null);

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (window.showToast) window.showToast("Speech Recognition not supported in this browser.", "error");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = lang === "bn" ? "bn-BD" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript("");
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      submitVoiceOrder(text);
    };

    recognition.onerror = (e) => {
      setIsRecording(false);
      console.warn("Speech error:", e);
      if (window.showToast) window.showToast("Voice capture failed. Try again.", "error");
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const submitVoiceOrder = async (text) => {
    setIsProcessing(true);
    try {
      const res = await window.apiCall('/api/checkout/voice', 'POST', { transcript: text });
      if (res && res.success) {
        if (window.showToast) window.showToast(`Order created successfully: ${res.data.order_id || 'OK'}`, 'success');
      } else {
        throw new Error(res?.error || "Voice order failed");
      }
    } catch (err) {
      if (window.showToast) window.showToast(err.message || "Failed to process voice order", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease", maxWidth: 600, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'ভয়েস অর্ডার পোর্টাল' : 'Voice Order Portal'}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 40 }}>
          {lang === 'bn' ? 'অর্ডার করতে মাইক্রোফোনে আলতো চাপুন। উদাহরণস্বরূপ: "10 কেজি বায়ো-স্লারি অর্ডার করুন মিরপুর জোনে"' : 'Tap the microphone to place an order. Example: "Order 10kg of Bio-Slurry to Mirpur zone"'}
        </p>

        <button 
          onClick={startVoice}
          disabled={isRecording || isProcessing}
          style={{ 
            width: 100, height: 100, borderRadius: "50%", 
            background: isRecording ? ACCENT.red : isProcessing ? "var(--bg-input)" : ACCENT.green,
            color: "#fff", border: "none", cursor: (isRecording || isProcessing) ? "not-allowed" : "pointer",
            fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto",
            boxShadow: isRecording ? `0 0 20px ${ACCENT.red}` : "none",
            transition: "all 0.3s ease"
          }}
        >
          {isProcessing ? '⏳' : isRecording ? '🎙️' : '🎤'}
        </button>

        {transcript && (
          <div style={{ marginTop: 32, padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 8, fontStyle: "italic", color: "var(--text-primary)" }}>
            "{transcript}"
          </div>
        )}

        {isProcessing && (
          <div style={{ marginTop: 16, color: ACCENT.blue }}>
            {lang === 'bn' ? 'প্রক্রিয়াকরণ করা হচ্ছে...' : 'Processing your order...'}
          </div>
        )}
      </Card>
    </div>
  );
}

function MyOrdersView({ lang, setTab }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.apiCall('/api/orders')
      .then(res => {
        if (res && res.success && res.data) setOrders(res.data);
      })
      .catch(err => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'আমার অর্ডারসমূহ' : 'My Orders'}</h2>
        
        {loading ? (
          <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
            <p>{lang === 'bn' ? 'কোন অর্ডার নেই।' : 'No orders found.'}</p>
            <button onClick={() => setTab('marketplace')} style={{ padding: "8px 24px", background: "transparent", border: `1px solid ${ACCENT.green}`, color: ACCENT.green, borderRadius: 8, cursor: "pointer", marginTop: 12 }}>
              {lang === 'bn' ? 'মার্কেটপ্লেস দেখুন' : 'Browse Marketplace'}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px" }}>Order ID</th>
                  <th style={{ padding: "12px 8px" }}>Product</th>
                  <th style={{ padding: "12px 8px" }}>Qty (kg)</th>
                  <th style={{ padding: "12px 8px" }}>Total (BDT)</th>
                  <th style={{ padding: "12px 8px" }}>Status</th>
                  <th style={{ padding: "12px 8px" }}>Date</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 8px", color: "var(--text-primary)", fontWeight: 500 }}>{o.id || o.order_id}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{o.product_name || 'Product'}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{o.quantity || o.weight_kg || 0}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>৳ {o.total_price || 0}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={{ padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "rgba(16, 185, 129, 0.1)", color: ACCENT.green }}>
                        {o.status?.toUpperCase() || 'PENDING'}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", color: "var(--text-dim)" }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right" }}>
                      <button onClick={() => setTab('tracking')} style={{ background: ACCENT.blue, border: "none", color: "#fff", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                        {lang === 'bn' ? 'ট্র্যাক' : 'Track'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function DeliveryTrackingView({ lang }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.apiCall('/api/deliveries')
      .then(res => {
        if (res && res.success && res.data) setDeliveries(res.data);
      })
      .catch(err => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease", display: "flex", flexDirection: "column", gap: 24 }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'ডেলিভারি ট্র্যাকিং' : 'Delivery Tracking'}</h2>
        {loading ? (
          <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading...</div>
        ) : deliveries.length === 0 ? (
          <div style={{ color: "var(--text-dim)", padding: 20, textAlign: "center" }}>No active deliveries found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {deliveries.map((d, i) => (
              <div key={i} style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid var(--border-primary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>Order: {d.order_id || d.id}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>ETA: {d.estimated_arrival || 'Unknown'}</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  {d.origin || 'Warehouse'} → {d.destination || 'Delivery Zone'}
                </div>
                {window.OrderTimeline && (
                  <window.OrderTimeline status={d.status || 'processing'} language={lang} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      
      {window.RouteExposureMapCard && (
        <window.RouteExposureMapCard />
      )}
    </div>
  );
}

function SMEConfiguratorView({ lang }) {
  const [zone, setZone] = useState("Mirpur");
  const [defaultQty, setDefaultQty] = useState(50);
  const [notifications, setNotifications] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await window.apiCall('/api/profile', 'PUT', {
        pref_zone: zone,
        default_qty: defaultQty,
        notifications_enabled: notifications
      });
      if (res && res.success) {
        if (window.showToast) window.showToast('Profile updated successfully', 'success');
      } else {
        throw new Error("Save failed");
      }
    } catch (err) {
      if (window.showToast) window.showToast('Error saving profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease", maxWidth: 600, margin: "0 auto" }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'এসএমই কনফিগারেশন' : 'SME Configurator'}</h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 24 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>{lang === 'bn' ? 'পছন্দের ডেলিভারি জোন' : 'Preferred Delivery Zone'}</label>
            <select 
              value={zone} 
              onChange={e => setZone(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }}
            >
              {DHAKA_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>{lang === 'bn' ? 'ডিফল্ট অর্ডার পরিমাণ (কেজি)' : 'Default Order Quantity (kg)'}</label>
            <input 
              type="number" 
              value={defaultQty} 
              onChange={e => setDefaultQty(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", color: "var(--text-primary)", fontSize: 14 }}>
            <input 
              type="checkbox" 
              checked={notifications} 
              onChange={e => setNotifications(e.target.checked)} 
              style={{ width: 16, height: 16, accentColor: ACCENT.green, cursor: "pointer" }}
            />
            {lang === 'bn' ? 'এসএমএস/ইমেইল নোটিফিকেশন চালু করুন' : 'Enable SMS/Email Notifications'}
          </label>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            style={{ padding: "12px", background: ACCENT.green, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, marginTop: 16, opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? 'Saving...' : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Preferences')}
          </button>
        </div>
      </Card>
    </div>
  );
}

function NotificationsView({ lang }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.apiCall('/api/notifications')
      .then(res => {
        if (res && res.success && res.data) setNotifications(res.data);
      })
      .catch(err => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}</h2>
        {loading ? (
          <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={{ color: "var(--text-dim)", padding: 40, textAlign: "center" }}>
            {lang === 'bn' ? 'নোটিফিকেশন সিস্টেম শীঘ্রই আসছে' : 'Notification system coming soon'}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notifications.map((n, i) => (
              <div key={i} style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                {n.message}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function SMEOwnerDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [lang, setLang] = useState('en');

  useEffect(() => {
    if (window.EcoLang) {
      setLang(window.EcoLang.getCurrentLanguage());
      const unsubscribe = window.EcoLang.onLanguageChange((newLang) => setLang(newLang));
      return () => unsubscribe();
    }
  }, []);

  const TABS = [
    { id: 'overview', label: lang === 'bn' ? 'ওভারভিউ' : 'Overview', icon: '📊' },
    { id: 'marketplace', label: lang === 'bn' ? 'মার্কেটপ্লেস' : 'Marketplace', icon: '🛒' },
    { id: 'orders', label: lang === 'bn' ? 'আমার অর্ডারসমূহ' : 'My Orders', icon: '📋' },
    { id: 'voice', label: lang === 'bn' ? 'ভয়েস অর্ডার' : 'Voice Order', icon: '🎙️' },
    { id: 'tracking', label: lang === 'bn' ? 'ডেলিভারি ট্র্যাকিং' : 'Delivery Tracking', icon: '🚚' },
    { id: 'configurator', label: lang === 'bn' ? 'এসএমই কনফিগারেশন' : 'SME Configurator', icon: '⚙️' },
    { id: 'notifications', label: lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications', icon: '🔔' }
  ];

  return (
    <div style={{ 
      display: "flex", 
      height: "100vh", 
      background: "#0B0F19", 
      fontFamily: "Inter, sans-serif",
      color: "#F3F4F6",
      overflow: "hidden"
    }}>
      <aside style={{ 
        width: 260, 
        background: "rgba(17, 24, 39, 0.8)", 
        borderRight: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        zIndex: 10
      }}>
        <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #10B981, #3B82F6)", borderRadius: 8 }} />
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>ClimaLogix AI</div>
        </div>

        <nav style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", background: activeTab === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
                color: activeTab === tab.id ? "#fff" : "var(--text-secondary)",
                border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500,
                textAlign: "left", transition: "all 0.2s ease"
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ 
          height: 72, 
          background: "rgba(17, 24, 39, 0.6)", 
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0 32px",
          zIndex: 10
        }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </h1>
          
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {window.LanguageSelector ? <window.LanguageSelector /> : (
              <button onClick={() => setLang(lang === 'en' ? 'bn' : 'en')} style={{ background: "transparent", border: "1px solid var(--border-primary)", color: "var(--text-primary)", padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}>
                {lang === 'en' ? 'EN' : 'বাংলা'}
              </button>
            )}
            
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 20, borderLeft: "1px solid var(--border-primary)" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.user_metadata?.name || user?.name || "SME Owner"}</div>
                <div style={{ fontSize: 12, color: ACCENT.green }}>Buyer</div>
              </div>
              <button 
                onClick={onLogout}
                style={{ background: "rgba(239, 68, 68, 0.1)", color: ACCENT.red, border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          {activeTab === 'overview' && <OverviewView lang={lang} />}
          {activeTab === 'marketplace' && <MarketplaceView lang={lang} onCheckoutComplete={() => setActiveTab('orders')} />}
          {activeTab === 'orders' && <MyOrdersView lang={lang} setTab={setActiveTab} />}
          {activeTab === 'voice' && <VoiceOrderView lang={lang} />}
          {activeTab === 'tracking' && <DeliveryTrackingView lang={lang} />}
          {activeTab === 'configurator' && <SMEConfiguratorView lang={lang} />}
          {activeTab === 'notifications' && <NotificationsView lang={lang} />}
        </main>
      </div>
    </div>
  );
}

window.SMEOwnerDashboard = SMEOwnerDashboard;
