(() => {

// Helpers defined in DhakaRouteMicroMap.jsx — available via global scope
// Since we are loading this component via script tag sequentially, DhakaRouteMicroMap and ZoneDetailPanel are available on window if they register themselves. 
// Wait, the prompt says: "wraps DhakaRouteMicroMap and ZoneDetailPanel in a glass-card div with a title, manages activeZone state"
// If it's loaded as a Babel script in browser, we can just use DhakaRouteMicroMap and ZoneDetailPanel as standard JSX elements since they will be in global scope from previous scripts.

function RouteExposureMapCard() {
  const [activeZone, setActiveZone] = useState("Mirpur");

  return (
    <div style={{
      background: "rgba(10,25,15,0.6)",
      borderRadius: "16px",
      padding: "24px",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(16,185,129,0.2)",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      width: "100%",
      maxWidth: "500px"
    }}>
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px", marginBottom: "4px" }}>
        <h3 style={{ margin: 0, color: "#10B981", fontSize: "18px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>🗺️</span> Microclimate Exposure Risk Map
        </h3>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
          Real-time thermal exposure analysis along supply routes
        </p>
      </div>

      <div style={{ height: "220px", width: "100%", overflow: "hidden", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
        {/* We assume DhakaRouteMicroMap is globally available because it was loaded first */}
        {window.DhakaRouteMicroMap ? <window.DhakaRouteMicroMap /> : (typeof DhakaRouteMicroMap !== 'undefined' ? <DhakaRouteMicroMap /> : null)}
      </div>

      {/* We assume ZoneDetailPanel is globally available because it was loaded right before this */}
      {window.ZoneDetailPanel ? <window.ZoneDetailPanel activeZone={activeZone} setActiveZone={setActiveZone} /> : (typeof ZoneDetailPanel !== 'undefined' ? <ZoneDetailPanel activeZone={activeZone} setActiveZone={setActiveZone} /> : null)}
    </div>
  );
}



window.RouteExposureMapCard = RouteExposureMapCard;

})();
