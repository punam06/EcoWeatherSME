

function OrderTimeline({ status, language }) {
        const steps = [
          { id: 'pending', label: language === 'bn' ? 'a��a��a��a��a��a�+a��' : 'Pending' },
          { id: 'processing', label: language === 'bn' ? 'a��a��a��a�+a��a�+a�+a��' : 'Processing' },
          { id: 'completed', label: language === 'bn' ? 'a�+a��a��a��a��a��a��' : 'Completed' }
        ];
        
        const currentIndex = steps.findIndex(s => s.id === (status || 'pending'));

        return (
          <div className="order-timeline" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 8px 0", position: "relative" }}>
            <div style={{ position: "absolute", top: 10, left: 20, right: 20, height: 2, background: "rgba(16, 185, 129, 0.2)", zIndex: 0 }} />
            {steps.map((step, idx) => {
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              const color = isPast || isCurrent ? "#10B981" : "rgba(16, 185, 129, 0.3)";
              return (
                <div key={step.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, gap: 6 }}>
                  <div style={{ 
                    width: 20, height: 20, borderRadius: "50%", background: isCurrent ? "#10B981" : isPast ? "#10B981" : "rgba(17, 24, 39, 1)", 
                    border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center" 
                  }}>
                    {isPast && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0B0F19" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    {isCurrent && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0B0F19" }} />}
                  </div>
                  <span style={{ fontSize: 10, color: isCurrent ? "#10B981" : "var(--text-secondary)", fontWeight: isCurrent ? 600 : 400 }}>{step.label}</span>
                </div>
              );
            })}
          </div>
        );
      }
      window.OrderTimeline = OrderTimeline;


