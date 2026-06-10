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

  function DeliveryTrackingView({ lang }) {
    const [deliveries, setDeliveries] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
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

  window.DeliveryTrackingView = DeliveryTrackingView;
})();
