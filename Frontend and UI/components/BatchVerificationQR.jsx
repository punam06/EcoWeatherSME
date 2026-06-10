(() => {
  const ACCENT = {
    green: "#10B981",
    greenBg: "rgba(16, 185, 129, 0.1)",
    greenBorder: "rgba(16, 185, 129, 0.3)",
    amber: "#F59E0B",
    amberBg: "rgba(245, 158, 11, 0.1)",
    amberBorder: "rgba(245, 158, 11, 0.3)",
    blue: "#3B82F6",
    blueBg: "rgba(59, 130, 246, 0.1)",
    blueBorder: "rgba(59, 130, 246, 0.3)",
    red: "#EF4444"
  };

  const STATUS_COLORS = {
    certified: { border: ACCENT.greenBorder, color: ACCENT.green, bg: ACCENT.greenBg },
    active:    { border: ACCENT.blueBorder,  color: ACCENT.blue,  bg: ACCENT.blueBg },
    pending:   { border: "var(--border-primary)", color: "var(--text-secondary)", bg: "transparent" },
    dispatched:{ border: ACCENT.amberBorder, color: ACCENT.amber, bg: ACCENT.amberBg },
    delivered: { border: ACCENT.greenBorder, color: ACCENT.green, bg: ACCENT.greenBg },
  };

  function BatchVerificationQR() {
    const [batches, setBatches] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      // Fetch live batch data or fallback to demo data if API fails
      const fetchBatches = async () => {
        try {
          if (window.APIClient && window.APIClient.getBatches) {
            const res = await window.APIClient.getBatches();
            if (res && res.success && res.data) {
              setBatches(res.data);
            } else if (Array.isArray(res)) {
              setBatches(res);
            }
          }
        } catch (err) {
          console.error("Failed to fetch batches for QR verification:", err);
          // Demo fallback data if API is down
          setBatches([
            { id: 'DEMO-1', batch_number: 'BCH-DEMO-1', product_name: 'Bio-Slurry Concentrate', status: 'certified', trust_score: 85, destination_zone: 'Old Dhaka' },
            { id: 'DEMO-2', batch_number: 'BCH-DEMO-2', product_name: 'Organic Compost', status: 'pending', trust_score: 60, destination_zone: 'Mirpur' },
            { id: 'DEMO-3', batch_number: 'BCH-DEMO-3', product_name: 'Biochar Granules', status: 'certified', trust_score: 92, destination_zone: 'Savar' }
          ]);
        } finally {
          setLoading(false);
        }
      };

      fetchBatches();
    }, []);

    const PageHeader = window.PageHeader || (({ title, subtitle }) => (
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{title}</h2>
        {subtitle && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{subtitle}</div>}
      </div>
    ));

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

    return (
      <div style={{ animation: "fadeSlideIn 0.3s ease", position: "relative" }}>
        <PageHeader 
          title="Batch Verification & QR" 
          subtitle="Cryptographically verifiable batch QR codes for transparency and traceability."
        />

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-input)" }}>
                  <th style={{ padding: "14px 20px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>BATCH ID</th>
                  <th style={{ padding: "14px 20px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>PRODUCT</th>
                  <th style={{ padding: "14px 20px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>STATUS</th>
                  <th style={{ padding: "14px 20px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>TRUST SCORE</th>
                  <th style={{ padding: "14px 20px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>QR CODE</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>
                      Loading batches...
                    </td>
                  </tr>
                ) : batches.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>
                      No batches available for verification.
                    </td>
                  </tr>
                ) : batches.map(batch => {
                  const statusStyle = STATUS_COLORS[batch.status?.toLowerCase()] || STATUS_COLORS.pending;
                  const qrUrl = batch.qr_code_url || `https://api.qrserver.com/v1/create-qr-code/?data=verify-batch-${batch.batch_number || batch.id}&size=100x100`;
                  
                  return (
                    <tr key={batch.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "16px 20px", color: "var(--text-primary)", fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
                        {batch.batch_number || batch.id}
                      </td>
                      <td style={{ padding: "16px 20px", color: "var(--text-secondary)" }}>
                        {batch.product_name || "Unknown Product"}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{
                          padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
                          background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`
                        }}>
                          {batch.status?.toUpperCase() || "PENDING"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        {batch.trust_score ? (
                          <span style={{ 
                            padding: "2px 6px", borderRadius: 4, fontWeight: 600,
                            background: batch.trust_score >= 85 ? ACCENT.greenBg : batch.trust_score >= 70 ? ACCENT.amberBg : "rgba(239, 68, 68, 0.1)",
                            color: batch.trust_score >= 85 ? ACCENT.green : batch.trust_score >= 70 ? ACCENT.amber : ACCENT.red 
                          }}>
                            {batch.trust_score}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        {batch.status === 'certified' || batch.qr_code_url ? (
                           <img 
                             src={qrUrl} 
                             alt={`QR for ${batch.batch_number}`} 
                             style={{ width: 64, height: 64, borderRadius: 8, border: "2px solid rgba(255,255,255,0.1)" }} 
                           />
                        ) : (
                          <div style={{ 
                            width: 64, height: 64, borderRadius: 8, background: "var(--bg-input)", 
                            display: "flex", alignItems: "center", justifyContent: "center", 
                            color: "var(--text-dim)", fontSize: 10, textAlign: "center", padding: 4,
                            border: "1px dashed var(--border-primary)"
                          }}>
                            No QR<br/>(Not Certified)
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  window.BatchVerificationQR = BatchVerificationQR;
})();
