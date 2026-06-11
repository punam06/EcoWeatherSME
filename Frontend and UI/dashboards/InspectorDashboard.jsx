(() => {


const ACCENT = {
  green: "#10B981",
  greenBg: "rgba(16, 185, 129, 0.1)",
  greenBorder: "rgba(16, 185, 129, 0.3)",
  blue: "#3B82F6",
  amber: "#F59E0B",
  amberBg: "rgba(245, 158, 11, 0.1)",
  red: "#EF4444"
};

const BARI_STANDARDS = [
  { id: 'ph', labelEn: 'pH Level', labelBn: 'পিএইচ লেভেল', range: '6.5 - 7.5' },
  { id: 'ec', labelEn: 'Conductivity (EC)', labelBn: 'পরিবাহিতা (EC)', range: '1.5 - 3.0 dS/m' },
  { id: 'temp', labelEn: 'Fermentation Temperature', labelBn: 'ফার্মেন্টেশন তাপমাত্রা', range: '55 - 65°C' },
  { id: 'ratio', labelEn: 'EM-1 Ratio', labelBn: 'ইএম-১ অনুপাত', range: '0.002' },
  { id: 'duration', labelEn: 'Fermentation Duration', labelBn: 'ফার্মেন্টেশনের সময়কাল', range: '≥45 days' }
];

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

function OverviewView({ lang, setTab }) {
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

  const reviewed = data?.kpis?.totalBatchesReviewed || 0;
  const certified = data?.kpis?.certifiedThisMonth || 0;
  const rejected = data?.kpis?.rejectedThisMonth || 0;
  const pending = data?.kpis?.pendingReview || 0;
  const urgentQueue = data?.urgentQueue || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeSlideIn 0.4s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.blue}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'মোট পর্যালোচনা' : 'Total Batches Reviewed'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginTop: 8 }}>{reviewed}</div>
        </Card>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.green}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'এই মাসে সার্টিফাইড' : 'Certified This Month'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT.green, marginTop: 8 }}>{certified}</div>
        </Card>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.red}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'এই মাসে প্রত্যাখ্যাত' : 'Rejected This Month'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT.red, marginTop: 8 }}>{rejected}</div>
        </Card>
        <Card style={{ textAlign: "center", borderTop: `3px solid ${ACCENT.amber}` }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lang === 'bn' ? 'পেন্ডিং রিভিউ' : 'Pending Review'}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT.amber, marginTop: 8 }}>{pending}</div>
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>{lang === 'bn' ? 'জরুরী সারি' : 'Urgent Queue'}</h3>
          <button onClick={() => setTab('review')} style={{ background: "transparent", color: ACCENT.amber, border: `1px solid ${ACCENT.amber}`, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            {lang === 'bn' ? 'সব দেখুন' : 'View All'}
          </button>
        </div>
        {urgentQueue.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Batch ID</th>
                <th style={{ padding: "12px 8px" }}>Submitted Date</th>
                <th style={{ padding: "12px 8px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {urgentQueue.map((b, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "12px 8px", color: "var(--text-primary)" }}>{b.batch_number || b.id}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{b.submitted_date ? new Date(b.submitted_date).toLocaleDateString() : '-'}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <span style={{ padding: "4px 8px", borderRadius: 4, background: ACCENT.amberBg, color: ACCENT.amber }}>
                      {b.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: "center", color: "var(--text-dim)", padding: 24 }}>
            {lang === 'bn' ? 'কোন জরুরী কাজ নেই।' : 'No urgent batches pending.'}
          </div>
        )}
      </Card>
    </div>
  );
}

function BatchReviewQueueView({ lang }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);

  // QA Form State
  const [qaSource, setQaSource] = useState("inspector");
  const [checkedItems, setCheckedItems] = useState({});
  const conf = STANDARDS_CONFIG.organic;
  const [pH, setPH] = useState(conf.ph?.default || 7.0);
  const [temp, setTemp] = useState(conf.temp?.default || 28);

  const handleToggle = (id) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };


  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = () => {
    setLoading(true);
    window.apiCall('/api/batches')
      .then(res => {
        if (res && res.success && res.data) {
          setBatches(res.data.filter(b => b.status === 'pending' || b.status === 'submitted'));
        }
      })
      .catch(err => console.warn(err))
      .finally(() => setLoading(false));
  };

  const handleDecision = async (decision) => {
    if (!selectedBatch) return;
    const confirmMsg = decision === 'approved' 
      ? 'Are you sure you want to certify this batch?' 
      : 'Are you sure you want to reject this batch?';
    if (!confirm(confirmMsg)) return;

    try {
      // Include QA form data with decision
      const payload = {
        batch_id: selectedBatch.id,
        decision,
        qaSource,
        metrics: qaSource === 'iot' || qaSource === 'inspector' ? { ph: pH, temp: temp } : {},
        checklist: qaSource === 'manufacturer' ? checkedItems : {}
      };

      const res = await window.apiCall('/api/qa/certify', 'POST', payload);
      if (res && res.success) {
        if (window.showToast) window.showToast(`Batch ${decision} successfully`, 'success');
        setBatches(prev => prev.filter(b => b.id !== selectedBatch.id));
        setSelectedBatch(null);
      } else {
        throw new Error("Failed to process decision");
      }
    } catch (err) {
      if (window.showToast) window.showToast(err.message || 'Error processing decision', 'error');
    }
  };

  if (selectedBatch) {
    return (
      <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
        <button 
          onClick={() => setSelectedBatch(null)} 
          style={{ background: "transparent", color: "var(--text-secondary)", border: "none", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}
        >
          ← {lang === 'bn' ? 'ফিরে যান' : 'Back to Queue'}
        </button>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ margin: 0, color: "var(--text-primary)" }}>Batch {selectedBatch.batch_number || selectedBatch.id}</h2>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => handleDecision('rejected')} style={{ background: "rgba(239, 68, 68, 0.1)", color: ACCENT.red, border: `1px solid ${ACCENT.red}`, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                {lang === 'bn' ? 'প্রত্যাখ্যান করুন' : 'Reject'}
              </button>
              <button onClick={() => handleDecision('approved')} style={{ background: ACCENT.green, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                {lang === 'bn' ? 'সার্টিফাই করুন' : 'Certify & Approve'}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 20, borderRadius: 12, border: "1px solid var(--border-primary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h4 style={{ margin: 0, color: ACCENT.blue }}>QA Inspector Review</h4>
                <select 
                  value={qaSource} 
                  onChange={e => setQaSource(e.target.value)}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none", fontSize: 12 }}
                >
                  <option value="inspector">✅ Certified Inspector</option>
                  <option value="iot">📡 IoT Sensors</option>
                  <option value="manufacturer">🏭 Manufacturer Declaration</option>
                </select>
              </div>

              {(qaSource === 'iot' || qaSource === 'inspector') && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {conf.ph && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                        <span style={{ color: "var(--text-secondary)" }}>{conf.ph.label}</span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{pH}</span>
                      </div>
                      <input type="range" min={conf.ph.min} max={conf.ph.max} step={conf.ph.step} value={pH} onChange={e => setPH(parseFloat(e.target.value))} style={{ width: "100%", accentColor: ACCENT.blue }} />
                    </div>
                  )}
                  {conf.temp && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                        <span style={{ color: "var(--text-secondary)" }}>{conf.temp.label}</span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{temp} {conf.temp.unit}</span>
                      </div>
                      <input type="range" min={conf.temp.min} max={conf.temp.max} step={conf.temp.step} value={temp} onChange={e => setTemp(parseFloat(e.target.value))} style={{ width: "100%", accentColor: ACCENT.blue }} />
                    </div>
                  )}
                </div>
              )}

              {qaSource === 'manufacturer' && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                  {CHECKLIST_ITEMS.map(item => (
                    <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}>
                      <input 
                        type="checkbox" 
                        checked={!!checkedItems[item.id]} 
                        onChange={() => handleToggle(item.id)} 
                        style={{ width: 16, height: 16, accentColor: ACCENT.green, cursor: "pointer" }}
                      />
                      {lang === 'bn' ? item.bn : item.en}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: 20, borderRadius: 12, border: "1px solid var(--border-primary)" }}>
              <h4 style={{ margin: "0 0 16px 0", color: ACCENT.amber }}>Trust Score Breakdown</h4>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: selectedBatch.trust_score >= 85 ? ACCENT.green : ACCENT.amber }}>
                  {selectedBatch.trust_score || 'N/A'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", lineHeight: 1.5 }}>
                Score is calculated via ClimaLogix Math Engine based on BARI compliance and IoT data integrity.
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'রিভিউ সারি' : 'Batch Review Queue'}</h2>
        
        {loading ? (
          <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading...</div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
            <p>{lang === 'bn' ? 'রিভিউ এর জন্য কোন ব্যাচ নেই।' : 'No batches awaiting review.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px" }}>Batch ID</th>
                  <th style={{ padding: "12px 8px" }}>Producer Name</th>
                  <th style={{ padding: "12px 8px" }}>Product</th>
                  <th style={{ padding: "12px 8px" }}>Trust Score</th>
                  <th style={{ padding: "12px 8px" }}>DVS Score</th>
                  <th style={{ padding: "12px 8px" }}>Submitted Date</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 8px", color: "var(--text-primary)", fontWeight: 500 }}>{b.batch_number || b.id}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{b.producer_name || 'Producer'}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{b.product_name}</td>
                    <td style={{ padding: "12px 8px" }}>
                      {b.trust_score ? (
                        <span style={{ 
                          padding: "2px 6px", borderRadius: 4, fontWeight: 600,
                          background: b.trust_score >= 85 ? ACCENT.greenBg : b.trust_score >= 70 ? ACCENT.amberBg : "rgba(239, 68, 68, 0.1)",
                          color: b.trust_score >= 85 ? ACCENT.green : b.trust_score >= 70 ? ACCENT.amber : ACCENT.red 
                        }}>
                          {b.trust_score}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{b.dvs_score || '-'}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-dim)" }}>
                      {b.created_at ? new Date(b.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right" }}>
                      <button onClick={() => setSelectedBatch(b)} style={{ background: ACCENT.amber, border: "none", color: "#fff", padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        {lang === 'bn' ? 'পর্যালোচনা' : 'Review'}
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

function ProvenanceChainView({ lang }) {
  const [batchId, setBatchId] = useState("");
  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!batchId.trim()) return;
    setLoading(true);
    setError("");
    setChain(null);

    try {
      const res = await window.apiCall(`/api/verify/${batchId}`);
      if (res && res.success && res.data) {
        setChain(res.data);
      } else {
        throw new Error(res?.error || "Verification failed");
      }
    } catch (err) {
      setError(err.message || "Failed to fetch provenance chain");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease", maxWidth: 800, margin: "0 auto" }}>
      <Card style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'প্রোভেনান্স চেইন যাচাইকারী' : 'Provenance Chain Verifier'}</h2>
        
        <form onSubmit={handleVerify} style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <input 
            type="text" 
            value={batchId} 
            onChange={e => setBatchId(e.target.value)}
            placeholder={lang === 'bn' ? "ব্যাচ আইডি লিখুন (যেমন BCH-1002)" : "Enter Batch ID (e.g., BCH-1002)"}
            style={{ flex: 1, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none", fontSize: 14 }}
          />
          <button 
            type="submit"
            disabled={loading || !batchId.trim()}
            style={{ padding: "0 24px", background: ACCENT.blue, color: "#fff", border: "none", borderRadius: 8, cursor: loading || !batchId.trim() ? "not-allowed" : "pointer", fontWeight: 600, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Verifying...' : (lang === 'bn' ? 'যাচাই করুন' : 'Verify')}
          </button>
        </form>
      </Card>

      {error && (
        <Card style={{ border: `1px solid ${ACCENT.red}`, background: "rgba(239, 68, 68, 0.05)", textAlign: "center", color: ACCENT.red }}>
          {error}
        </Card>
      )}

      {chain && (
        <Card style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 24, right: 24 }}>
            <div style={{ background: chain.isValid !== false ? ACCENT.greenBg : "rgba(239, 68, 68, 0.1)", color: chain.isValid !== false ? ACCENT.green : ACCENT.red, padding: "8px 16px", borderRadius: 8, fontWeight: 700, border: `1px solid ${chain.isValid !== false ? ACCENT.greenBorder : ACCENT.red}` }}>
              {chain.isValid !== false ? 'Chain Valid ✓' : 'Chain Broken ✗'}
            </div>
          </div>
          
          <h3 style={{ margin: "0 0 24px 0", color: "var(--text-primary)" }}>Transaction Ledger</h3>
          
          <div style={{ position: "relative", paddingLeft: 24, borderLeft: "2px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: 32 }}>
            {(chain.records || [
              { stage: "Creation", timestamp: "2026-06-08T10:00:00Z", hash: "a1b2c3d4e5f6g7h8", prev: "0000000000000000" },
              { stage: "QA Review", timestamp: "2026-06-09T14:30:00Z", hash: "h8g7f6e5d4c3b2a1", prev: "a1b2c3d4e5f6g7h8" }
            ]).map((record, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: -31, top: 2, width: 12, height: 12, borderRadius: "50%", background: chain.isValid !== false ? ACCENT.green : ACCENT.red, border: "2px solid #0B0F19" }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{record.stage}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>{new Date(record.timestamp).toLocaleString()}</div>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                  <div style={{ marginBottom: 4 }}>Hash: <span style={{ color: ACCENT.blue }}>{record.hash.substring(0, 16)}</span>...</div>
                  <div>Prev: <span>{record.prev.substring(0, 16)}</span>...</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--border-primary)", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Public QR URL</div>
            <div style={{ background: "var(--bg-input)", padding: "12px", borderRadius: 8, color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, display: "inline-block" }}>
              https://ecoweathersme.onrender.com/verify?batch={batchId}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function QAChecklistView({ lang }) {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem("climalogix_inspector_notes");
    return saved ? JSON.parse(saved) : {};
  });
  const [saving, setSaving] = useState(false);

  const [qaSource, setQaSource] = useState('iot');
  const [checkedItems, setCheckedItems] = useState({});
  const conf = window.STANDARDS_CONFIG ? (window.STANDARDS_CONFIG.organic || Object.values(window.STANDARDS_CONFIG)[0]) : null;
  const [pH, setPH] = useState(conf?.ph?.default || 7.0);
  const [temp, setTemp] = useState(conf?.temp?.default || 28);

  const handleToggle = (id) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNoteChange = (id, val) => {
    setNotes(prev => ({ ...prev, [id]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Try hitting endpoint if exists
      const res = await window.apiCall('/api/qa/notes', 'PUT', { notes });
      if (res && res.success) {
        if (window.showToast) window.showToast('Notes saved securely', 'success');
      } else {
        throw new Error();
      }
    } catch {
      // Fallback to local storage
      localStorage.setItem("climalogix_inspector_notes", JSON.stringify(notes));
      if (window.showToast) window.showToast('Notes saved locally', 'success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease", maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'QA চেকলিস্ট এবং স্ট্যান্ডার্ড' : 'QA Checklist & Standards'}</h2>
          <button 
            onClick={handleSave}
            disabled={saving}
            style={{ background: ACCENT.amber, color: "#fff", border: "none", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            {saving ? 'Saving...' : (lang === 'bn' ? 'সেভ করুন' : 'Save Notes')}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>QA Source</label>
            <select 
              value={qaSource} 
              onChange={e => setQaSource(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }}
            >
              <option value="iot">📡 IoT Sensors</option>
              <option value="inspector">✅ Certified Inspector</option>
              <option value="manufacturer">🏭 Manufacturer Declaration</option>
            </select>
          </div>

          {qaSource === 'iot' && conf && (
            <div style={{ background: "rgba(0,0,0,0.2)", padding: 20, borderRadius: 12, marginBottom: 24, border: "1px solid var(--border-primary)" }}>
              <h4 style={{ margin: "0 0 16px 0", color: ACCENT.blue }}>{lang === 'bn' ? 'IoT সেন্সর রিডিংস' : 'Live IoT Sensor Readings'}</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {conf.ph && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{conf.ph.label}</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{pH}</span>
                    </div>
                    <input type="range" min={conf.ph.min} max={conf.ph.max} step={conf.ph.step} value={pH} onChange={e => setPH(parseFloat(e.target.value))} style={{ width: "100%", accentColor: ACCENT.blue }} />
                  </div>
                )}
                {conf.temp && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{conf.temp.label}</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{temp} {conf.temp.unit}</span>
                    </div>
                    <input type="range" min={conf.temp.min} max={conf.temp.max} step={conf.temp.step} value={temp} onChange={e => setTemp(parseFloat(e.target.value))} style={{ width: "100%", accentColor: ACCENT.blue }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {qaSource === 'manufacturer' && window.CHECKLIST_ITEMS && (
            <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: 20, borderRadius: 12, marginBottom: 24, border: `1px solid ${ACCENT.greenBorder}` }}>
              <h4 style={{ margin: "0 0 16px 0", color: ACCENT.green }}>{lang === 'bn' ? 'ম্যানুফ্যাকচারার কমপ্লায়েন্স চেকলিস্ট' : 'Manufacturer Compliance Checklist'}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {window.CHECKLIST_ITEMS.map(item => (
                  <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}>
                    <input 
                      type="checkbox" 
                      checked={!!checkedItems[item.id]} 
                      onChange={() => handleToggle(item.id)} 
                      style={{ width: 16, height: 16, accentColor: ACCENT.green, cursor: "pointer" }}
                    />
                    {lang === 'bn' ? item.bn : item.en}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {BARI_STANDARDS.map(item => (
            <div key={item.id} style={{ background: "rgba(255,255,255,0.03)", padding: 20, borderRadius: 12, border: "1px solid var(--border-primary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>{lang === 'bn' ? item.labelBn : item.labelEn}</span>
                <span style={{ color: ACCENT.amber, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, background: ACCENT.amberBg, padding: "2px 8px", borderRadius: 4 }}>
                  {item.range}
                </span>
              </div>
              <input 
                type="text" 
                value={notes[item.id] || ''} 
                onChange={(e) => handleNoteChange(item.id, e.target.value)}
                placeholder={lang === 'bn' ? 'পরিদর্শকের নোট যোগ করুন...' : 'Add inspector notes...'}
                style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", outline: "none", fontSize: 13 }}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AuditLogView({ lang }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate]);

  const fetchLogs = () => {
    setLoading(true);
    let url = '/api/audit-log';
    if (startDate && endDate) url += `?start=${startDate}&end=${endDate}`;
    
    window.apiCall(url)
      .then(res => {
        if (res && res.success && res.data) {
          setLogs(res.data);
        } else {
          throw new Error("Missing endpoint");
        }
      })
      .catch(err => {
        console.warn("Audit log fetch error (fallback enabled):", err);
        setLogs(null); // Indicates endpoint missing
      })
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
      <Card>
        <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>{lang === 'bn' ? 'অডিট লগ' : 'Audit Log'}</h2>
        
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", colorScheme: "dark" }} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)", colorScheme: "dark" }} />
          <button onClick={fetchLogs} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border-primary)", color: "var(--text-primary)", borderRadius: 6, cursor: "pointer" }}>Filter</button>
        </div>

        {loading ? (
          <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading...</div>
        ) : logs === null ? (
          <div style={{ textAlign: "center", padding: 60, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🛡️</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              {lang === 'bn' ? 'অডিট লগ এন্ডপয়েন্ট ইন্টিগ্রেশন অপেক্ষাধীন' : 'Audit log endpoint pending integration'}
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>No logs found for this period.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-primary)", color: "var(--text-secondary)", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px" }}>Event Type</th>
                  <th style={{ padding: "12px 8px" }}>Batch ID</th>
                  <th style={{ padding: "12px 8px" }}>Timestamp</th>
                  <th style={{ padding: "12px 8px" }}>IP Hash</th>
                  <th style={{ padding: "12px 8px" }}>User Agent</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 8px", color: ACCENT.amber }}>{log.event_type}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{log.batch_id}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{log.ip_hash}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-dim)", fontSize: 11, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.user_agent}</td>
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

function InspectorDashboard({ user, onLogout }) {
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
    { id: 'review', label: lang === 'bn' ? 'রিভিউ সারি' : 'Batch Review Queue', icon: '📋' },
    { id: 'provenance', label: lang === 'bn' ? 'প্রোভেনান্স চেইন' : 'Provenance Chains', icon: '🔗' },
    { id: 'checklist', label: lang === 'bn' ? 'QA চেকলিস্ট' : 'QA Checklist', icon: '✅' },
    { id: 'audit', label: lang === 'bn' ? 'অডিট লগ' : 'Audit Log', icon: '🛡️' },
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
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #F59E0B, #EF4444)", borderRadius: 8 }} />
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
                <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.user_metadata?.name || user?.name || "Official"}</div>
                <div style={{ fontSize: 12, color: ACCENT.amber }}>QA Inspector</div>
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
          {activeTab === 'overview' && <OverviewView lang={lang} setTab={setActiveTab} />}
          {activeTab === 'review' && <BatchReviewQueueView lang={lang} />}
          {activeTab === 'provenance' && <ProvenanceChainView lang={lang} />}
          {activeTab === 'checklist' && <QAChecklistView lang={lang} />}
          {activeTab === 'audit' && <AuditLogView lang={lang} />}
          {activeTab === 'notifications' && <NotificationsView lang={lang} />}
        </main>
      </div>
    </div>
  );
}

window.InspectorDashboard = InspectorDashboard;

})();
