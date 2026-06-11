(() => {
  const Card = window.Card || (({ children, style }) => (
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
  ));

  const ACCENT = {
    green: "#10B981",
    greenBg: "rgba(16, 185, 129, 0.08)",
    greenBorder: "rgba(16, 185, 129, 0.2)",
    amber: "#F59E0B",
    red: "#EF4444",
    blue: "#3B82F6"
  };

  function DeliveryView({ userRole, onUpdateTrustScore }) {
    const [deliveries, setDeliveries] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    const fetchDeliveries = () => {
      setLoading(true);
      if (window.apiCall) {
        window.apiCall('/api/deliveries')
          .then(res => {
            if (res && res.success && res.data) setDeliveries(res.data);
          })
          .catch(err => console.warn("Failed to load deliveries:", err))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    };

    React.useEffect(() => {
      fetchDeliveries();
    }, []);

    const handleAcknowledge = async (id) => {
      try {
        const res = await window.apiCall(`/api/deliveries/${id}/acknowledge`, 'PUT');
        if (res && res.success) {
          if (window.showToast) window.showToast("Delivery receipt acknowledged!", "success");
          fetchDeliveries();
        }
      } catch (err) {
        if (window.showToast) window.showToast("Failed to acknowledge receipt", "error");
      }
    };

    const handleOptimize = async (id) => {
      try {
        const res = await window.apiCall(`/api/deliveries/${id}/optimize`, 'PUT');
        if (res && res.success) {
          if (window.showToast) window.showToast("Route thermal optimization successfully applied!", "success");
          fetchDeliveries();
        }
      } catch (err) {
        if (window.showToast) window.showToast("Optimization failed", "error");
      }
    };

    return (
      <div style={{ animation: "fadeSlideIn 0.4s ease", display: "flex", flexDirection: "column", gap: 24 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ margin: 0, color: "var(--text-primary)" }}>Active Shipments & Deliveries</h2>
            <button onClick={fetchDeliveries} style={{ background: "transparent", border: "1px solid var(--border-primary)", color: "var(--text-primary)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ color: "var(--text-dim)", padding: 20 }}>Loading active deliveries...</div>
          ) : deliveries.length === 0 ? (
            <div style={{ color: "var(--text-dim)", padding: 20, textAlign: "center" }}>No active deliveries found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {deliveries.map((d) => (
                <div key={d.id || d.orderId} style={{ padding: 18, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid var(--border-primary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>ID: {d.id || d.orderId}</span>
                      {d.batchId && <span style={{ marginLeft: 12, fontSize: 11, background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", color: "var(--text-secondary)" }}>Batch: {d.batchId}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{
                        padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: d.status === 'delivered' ? ACCENT.greenBg : "rgba(59, 130, 246, 0.1)",
                        color: d.status === 'delivered' ? ACCENT.green : ACCENT.blue,
                        border: `1px solid ${d.status === 'delivered' ? ACCENT.greenBorder : "rgba(59, 130, 246, 0.3)"}`
                      }}>
                        {String(d.status).toUpperCase()}
                      </span>
                      {d.optimized && (
                        <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "rgba(245, 158, 11, 0.1)", color: ACCENT.amber, border: `1px solid rgba(245, 158, 11, 0.3)` }}>
                          ⚡ OPTIMIZED
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    <div>
                      <span style={{ color: "var(--text-dim)" }}>Route:</span> {d.origin || 'Intake Point'} ➔ {d.dest || d.destination || 'Delivery Zone'}
                    </div>
                    <div>
                      <span style={{ color: "var(--text-dim)" }}>ETA:</span> {d.eta || 'Calculating...'}
                    </div>
                    <div>
                      <span style={{ color: "var(--text-dim)" }}>Thermal Monitoring:</span> <span style={{ color: parseFloat(d.temp) > 29 ? ACCENT.red : ACCENT.green, fontWeight: "bold" }}>{d.temp || 'N/A'}</span>
                    </div>
                  </div>

                  {window.OrderTimeline && (
                    <div style={{ marginBottom: 16 }}>
                      <window.OrderTimeline status={d.status || 'processing'} />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    {!d.optimized && d.status !== 'delivered' && (
                      <button onClick={() => handleOptimize(d.id)} style={{ padding: "8px 16px", background: ACCENT.blue, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        ⚡ Optimize Route
                      </button>
                    )}
                    {d.status !== 'delivered' && (
                      <button onClick={() => handleAcknowledge(d.id)} style={{ padding: "8px 16px", background: ACCENT.green, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        ✓ Acknowledge Receipt
                      </button>
                    )}
                  </div>
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

  window.DeliveryView = DeliveryView;
})();
