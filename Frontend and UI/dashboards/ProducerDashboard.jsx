(() => {


const ACCENT = {
  green: "#10B981",
  greenBg: "rgba(16, 185, 129, 0.1)",
  greenBorder: "rgba(16, 185, 129, 0.3)",
  blue: "#3B82F6",
  amber: "#F59E0B",
  red: "#EF4444"
};

const CHECKLIST_ITEMS = [
  { id: 'feedstock', en: 'Feedstock meets organic criteria', bn: 'কাঁচামাল জৈব মানদণ্ড পূরণ করে' },
  { id: 'sop', en: 'SOP compliance verified', bn: 'এসওপি কমপ্লায়েন্স যাচাই করা হয়েছে' },
  { id: 'chemicals', en: 'No prohibited chemicals used', bn: 'কোনো নিষিদ্ধ রাসায়নিক ব্যবহার করা হয়নি' },
  { id: 'logs', en: 'Batch temperature logs available', bn: 'ব্যাচ তাপমাত্রার লগ উপলব্ধ আছে' }
];

const STANDARDS_CONFIG = window.STANDARDS_CONFIG || {
  organic: {
    displayName: 'Organic Biofertilizer (BARI EM-1)',
    ph: { min: 3.0, max: 7.0, step: 0.1, label: "pH Level", unit: "", optimal: "3.5-7.5", default: 4.1 },
    ec: { min: 1.0, max: 6.0, step: 0.1, label: "Conductivity (EC)", unit: " mS/cm", optimal: "2.5-5.0 mS/cm", default: 3.4 },
    temp: { min: 20, max: 45, step: 0.5, label: "Storage Temperature", unit: "°C", optimal: "25-32°C", default: 28 },
    days: { min: 3, max: 21, step: 1, label: "Processing Days", unit: " days", optimal: "7-14 days", default: 9 },
    hasRatio: true
  }
};

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
      .catch(err => console.error("Dashboard fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  const totalBatches = data?.kpis?.totalBatches || 0;
  const certifiedBatches = data?.kpis?.certifiedBatches || 0;
  const pendingDispatch = data?.kpis?.pendingDispatch || 0;
  const carbonOffset = data?.kpis?.carbonOffset || 0;
  const recentBatches = data?.recentBatches || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeSlideIn 0.4s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.blue}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'মোট ব্যাচ' : 'Total Batches'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginTop: 8 }}>{totalBatches}</div>
        </Card>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.green}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'সার্টিফাইড ব্যাচ' : 'Certified Batches'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT.green, marginTop: 8 }}>{certifiedBatches}</div>
        </Card>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.amber}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'পেন্ডিং ডিসপ্যাচ' : 'Pending Dispatch'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT.amber, marginTop: 8 }}>{pendingDispatch}</div>
        </Card>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.green}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'কার্বন অফসেট (কেজি)' : 'Carbon Offset (kg)'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginTop: 8 }}>{carbonOffset}</div>
        </Card>
      </div>

      <Card>
        <h3 style={{ fontSize: 16, marginBottom: 16, color: "var(--text-primary)" }}>{lang === 'bn' ? 'সাম্প্রতিক কার্যকলাপ' : 'Recent Activity'}</h3>
        {recentBatches.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Batch ID</th>
                <th style={{ padding: "12px 8px" }}>Status</th>
                <th style={{ padding: "12px 8px" }}>Trust Score</th>
              </tr>
            </thead>
            <tbody>
              {recentBatches.map(b => (
                <tr key={b.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "12px 8px", color: "var(--text-primary)" }}>{b.batch_number || b.id}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <span style={{ padding: "4px 8px", borderRadius: 4, background: b.status === 'certified' ? ACCENT.greenBg : ACCENT.greenBg, color: b.status === 'certified' ? ACCENT.green : ACCENT.amber }}>
                      {b.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px", color: b.trust_score >= 85 ? ACCENT.green : ACCENT.amber }}>{b.trust_score || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: "center", color: "var(--text-dim)", padding: 24 }}>
            {lang === 'bn' ? 'কোন কার্যকলাপ নেই।' : 'No recent activity.'}
          </div>
        )}
      </Card>
    </div>
  );
}

function MyBatchesView({ lang, setTab }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.apiCall('/api/batches')
      .then(res => {
        if (res && res.success && res.data) {
          setBatches(res.data);
        }
      })
      .catch(err => console.error("Batches fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this batch?')) return;
    try {
      const res = await window.apiCall(`/api/batches/${id}`, 'DELETE');
      if (res && res.success) {
        setBatches(prev => prev.filter(b => b.id !== id));
        if (window.showToast) window.showToast('Batch deleted successfully', 'success');
      }
    } catch (error) {
      if (window.showToast) window.showToast('Failed to delete batch', 'error');
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'আমার ব্যাচসমূহ' : 'My Batches'}</h2>
          <button 
            onClick={() => setTab('create')}
            style={{ padding: "8px 16px", background: ACCENT.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            + {lang === 'bn' ? 'নতুন ব্যাচ তৈরি করুন' : 'Create Batch'}
          </button>
        </div>

        {loading ? (
          <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading...</div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
            <p>{lang === 'bn' ? 'এখনও কোন ব্যাচ নেই। আপনার প্রথম ব্যাচ তৈরি করুন।' : 'No batches yet. Create your first batch.'}</p>
            <button 
              onClick={() => setTab('create')}
              style={{ marginTop: 16, padding: "8px 24px", background: "transparent", border: `1px solid ${ACCENT.blue}`, color: ACCENT.blue, borderRadius: 8, cursor: "pointer" }}
            >
              {lang === 'bn' ? 'ব্যাচ তৈরি করুন' : 'Create Batch'}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px" }}>Batch ID</th>
                  <th style={{ padding: "12px 8px" }}>Product</th>
                  <th style={{ padding: "12px 8px" }}>Weight (kg)</th>
                  <th style={{ padding: "12px 8px" }}>Trust Score</th>
                  <th style={{ padding: "12px 8px" }}>DVS Score</th>
                  <th style={{ padding: "12px 8px" }}>Status</th>
                  <th style={{ padding: "12px 8px" }}>Created At</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 8px", color: "var(--text-primary)", fontWeight: 500 }}>{b.batch_number || b.id}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{b.product_name}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{b.weight_kg}</td>
                    <td style={{ padding: "12px 8px" }}>
                      {b.trust_score ? (
                        <span style={{ 
                          padding: "2px 6px", borderRadius: 4, fontWeight: 600,
                          background: b.trust_score >= 85 ? ACCENT.greenBg : b.trust_score >= 70 ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          color: b.trust_score >= 85 ? ACCENT.green : b.trust_score >= 70 ? ACCENT.amber : ACCENT.red 
                        }}>
                          {b.trust_score}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{b.dvs_score || '-'}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={{ 
                        padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: b.status === 'certified' ? ACCENT.greenBg : b.status === 'rejected' ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
                        color: b.status === 'certified' ? ACCENT.green : b.status === 'rejected' ? ACCENT.red : ACCENT.amber 
                      }}>
                        {b.status?.toUpperCase() || 'PENDING'}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", color: "var(--text-dim)" }}>
                      {b.created_at ? new Date(b.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right" }}>
                      <button style={{ background: "none", border: "none", color: ACCENT.blue, cursor: "pointer", marginRight: 12, fontSize: 12 }}>View</button>
                      <button onClick={() => handleDelete(b.id)} style={{ background: "none", border: "none", color: ACCENT.red, cursor: "pointer", fontSize: 12 }}>Delete</button>
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

function CreateBatchView({ lang, setTab }) {
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState("Bio-Slurry");
  const [weight, setWeight] = useState("100");
  const [destinationZone, setDestinationZone] = useState("Old Dhaka");
  const [category, setCategory] = useState("organic");
  const [qaSource, setQaSource] = useState("iot");
  const [checkedItems, setCheckedItems] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);



  const handleSubmit = async () => {
    if (!productName.trim()) {
      if (window.showToast) window.showToast('Product Name is required', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const localBatchNumber = `BCH-${Date.now().toString().slice(-6)}`;
      const result = await window.apiCall('/api/batches', 'POST', {
        batch_number: localBatchNumber,
        feedstock_type: productType,
        product_name: productName,
        trust_score: 0,
        destination_zone: destinationZone,
        weight_kg: parseFloat(weight) || 0,
        packaging_type: 'Standard'
      });

      if (result && result.success && result.data) {
        const newId = result.data.id || result.data.batch_number || localBatchNumber;
        if (window.showToast) window.showToast(`Batch ${newId} registered successfully!`, 'success');
        setTab('batches');
      } else {
        throw new Error(result?.error || "Failed to register batch");
      }
    } catch (err) {
      if (window.showToast) window.showToast(err.message || 'Error registering batch', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease", maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'নতুন ব্যাচ তৈরি করুন' : 'Create New Batch'}</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>{lang === 'bn' ? 'পণ্যের নাম' : 'Product Name'}</label>
            <input 
              type="text" 
              value={productName} 
              onChange={e => setProductName(e.target.value)}
              placeholder="e.g. Premium BARI EM-1"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>{lang === 'bn' ? 'ওজন (কেজি)' : 'Weight (kg)'}</label>
            <input 
              type="number" 
              value={weight} 
              onChange={e => setWeight(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>{lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }}
            >
              <option value="organic">Organic Biofertilizer (BARI EM-1)</option>
              <option value="retail">Retail FMCG / Packaged Goods</option>
              <option value="pharma">Pharmaceuticals (DGDA)</option>
            </select>
          </div>


        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 32 }}>
          <button 
            onClick={() => setTab('batches')}
            style={{ padding: "10px 20px", background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: 8, cursor: "pointer" }}
          >
            {lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ padding: "10px 24px", background: ACCENT.green, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? 'Registering...' : (lang === 'bn' ? 'নিবন্ধন করুন' : 'Register Batch')}
          </button>
        </div>
      </Card>
    </div>
  );
}

function DvsDispatchView({ lang }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.apiCall('/api/batches')
      .then(res => {
        if (res && res.success && res.data) {
          // Filter for pending dispatch or just show all active ones for demo
          setBatches(res.data.filter(b => b.status === 'certified' || b.status === 'pending_dispatch' || b.status === 'pending'));
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleDispatch = async (id) => {
    try {
      // POST /api/orders/:id/dispatch
      const res = await window.apiCall(`/api/orders/${id}/dispatch`, 'POST');
      if (res && res.success) {
        if (window.showToast) window.showToast('Dispatch requested successfully', 'success');
        setBatches(prev => prev.map(b => b.id === id ? { ...b, status: 'dispatched' } : b));
      }
    } catch (err) {
      if (window.showToast) window.showToast('Dispatch failed', 'error');
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease", display: "flex", flexDirection: "column", gap: 24 }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'DVS ডিসপ্যাচ' : 'DVS Dispatch'}</h2>
        
        {loading ? (
          <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading...</div>
        ) : batches.length === 0 ? (
          <div style={{ color: "var(--text-dim)", padding: 20, textAlign: "center" }}>No batches ready for dispatch.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {batches.map(b => (
              <div key={b.id} style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid var(--border-primary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{b.batch_number || b.id}</span>
                  <span style={{ 
                    padding: "2px 6px", borderRadius: 4, fontSize: 11,
                    background: b.dvs_score >= 60 ? ACCENT.greenBg : "rgba(239, 68, 68, 0.1)",
                    color: b.dvs_score >= 60 ? ACCENT.green : ACCENT.red 
                  }}>
                    DVS: {b.dvs_score || 'N/A'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  {b.product_name} • {b.weight_kg}kg
                </div>
                <button 
                  onClick={() => handleDispatch(b.id)}
                  disabled={b.status === 'dispatched'}
                  style={{ width: "100%", padding: "8px", background: b.status === 'dispatched' ? "var(--bg-input)" : ACCENT.blue, color: b.status === 'dispatched' ? "var(--text-dim)" : "#fff", border: "none", borderRadius: 6, cursor: b.status === 'dispatched' ? "not-allowed" : "pointer" }}
                >
                  {b.status === 'dispatched' ? 'Dispatched' : 'Request Dispatch'}
                </button>
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

function NotificationsView({ lang }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.apiCall('/api/notifications')
      .then(res => {
        if (res && res.success && res.data) {
          setNotifications(res.data);
        }
      })
      .catch(err => {
        console.warn("Notifications fetch error (expected if endpoint missing):", err);
      })
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

function DeliveriesView({ lang }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.apiCall('/api/deliveries')
      .then(res => {
        if (res && res.success && res.data) {
          setDeliveries(res.data);
        }
      })
      .catch(err => console.error("Deliveries fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'ডেলিভারি' : 'Deliveries'}</h2>
        {loading ? (
          <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading...</div>
        ) : deliveries.length === 0 ? (
          <div style={{ color: "var(--text-dim)", padding: 40, textAlign: "center" }}>
            {lang === 'bn' ? 'কোন ডেলিভারি পাওয়া যায়নি' : 'No deliveries found.'}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {deliveries.map((d, i) => (
              <div key={i} style={{ padding: 20, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid var(--border-primary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>Order: {d.id || d.order_id}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Destination: {d.destination || 'Unknown'}</div>
                </div>
                {window.OrderTimeline && (
                  <window.OrderTimeline status={d.status} language={lang} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ProducerDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [lang, setLang] = useState('en');

  // Handle language changes dynamically if LanguageSelector exists
  useEffect(() => {
    if (window.EcoLang) {
      setLang(window.EcoLang.getCurrentLanguage());
      const unsubscribe = window.EcoLang.onLanguageChange((newLang) => setLang(newLang));
      return () => unsubscribe();
    }
  }, []);

  const TABS = [
    { id: 'overview', label: lang === 'bn' ? 'ওভারভিউ' : 'Overview', icon: '📊' },
    { id: 'batches', label: lang === 'bn' ? 'আমার ব্যাচসমূহ' : 'My Batches', icon: '📦' },
    { id: 'create', label: lang === 'bn' ? 'ব্যাচ তৈরি করুন' : 'Create Batch', icon: '➕' },
    { id: 'iot', label: lang === 'bn' ? 'IoT রিডিংস' : 'IoT Readings', icon: '📡' },
    { id: 'dispatch', label: lang === 'bn' ? 'DVS ডিসপ্যাচ' : 'DVS Dispatch', icon: '🚚' },
    { id: 'deliveries', label: lang === 'bn' ? 'ডেলিভারি' : 'Deliveries', icon: '📍' },
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
      {/* Sidebar */}
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

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
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
            {/* Language Toggle Placeholder if global component not found */}
            {window.LanguageSelector ? <window.LanguageSelector /> : (
              <button onClick={() => setLang(lang === 'en' ? 'bn' : 'en')} style={{ background: "transparent", border: "1px solid var(--border-primary)", color: "var(--text-primary)", padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}>
                {lang === 'en' ? 'EN' : 'বাংলা'}
              </button>
            )}
            
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 20, borderLeft: "1px solid var(--border-primary)" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.user_metadata?.name || user?.name || "Producer"}</div>
                <div style={{ fontSize: 12, color: ACCENT.green }}>Producer</div>
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

        {/* Scrollable Content */}
        <main style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          {activeTab === 'overview' && <OverviewView lang={lang} setTab={setActiveTab} />}
          {activeTab === 'batches' && <MyBatchesView lang={lang} setTab={setActiveTab} />}
          {activeTab === 'create' && <CreateBatchView lang={lang} setTab={setActiveTab} />}
          {activeTab === 'dispatch' && <DvsDispatchView lang={lang} />}
          {activeTab === 'deliveries' && <DeliveriesView lang={lang} />}
          {activeTab === 'notifications' && <NotificationsView lang={lang} />}
          {activeTab === 'iot' && <div style={{ color: "var(--text-dim)", padding: 40, textAlign: "center" }}><Card>IoT Dashboard coming soon...</Card></div>}
        </main>
      </div>
    </div>
  );
}

window.ProducerDashboard = ProducerDashboard;

})();
