var { useState, useEffect } = window.React || React;

const DhakaRouteMicroMap = () => {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Route SVG Map */}
      <svg width="100%" height="100%" viewBox="0 0 400 180" style={{ background: "rgba(10,25,15,0.4)", borderRadius: "8px" }}>
        {/* Style keyframe animation for glowing waypoints */}
        <style>{`
          @keyframes pulse-glow {
            0% { r: 4; opacity: 0.6; }
            50% { r: 9; opacity: 0.9; }
            100% { r: 4; opacity: 0.6; }
          }
          @keyframes dash {
            to {
              stroke-dashoffset: -20;
            }
          }
        `}</style>
        
        {/* Grids / Background Lines */}
        <path d="M 0 30 H 400 M 0 60 H 400 M 0 90 H 400 M 0 120 H 400 M 0 150 H 400" stroke="rgba(16,185,129,0.03)" strokeWidth="1" />
        <path d="M 80 0 V 180 M 160 0 V 180 M 240 0 V 180 M 320 0 V 180" stroke="rgba(16,185,129,0.03)" strokeWidth="1" />

        {/* stylized route polyline from Savar IoT Hub (50, 140) to Gulshan Central Ledger (350, 40) */}
        <polyline
          points="50,140 130,120 220,70 350,40"
          fill="none"
          stroke="#10B981"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeDasharray: "8,4", animation: "dash 1.5s linear infinite" }}
        />

        {/* Start Hub node */}
        <circle cx="50" cy="140" r="6" fill="#10B981" />
        <text x="40" y="160" fill="#10B981" fontSize="9" fontWeight="700" fontFamily="sans-serif">Savar IoT Hub</text>

        {/* End Hub node */}
        <circle cx="350" cy="40" r="6" fill="#3B82F6" />
        <text x="270" y="30" fill="#3B82F6" fontSize="9" fontWeight="700" fontFamily="sans-serif">Gulshan Central Ledger</text>

        {/* Animated waypoint 1 */}
        <circle cx="130" cy="120" r="5" fill="#F59E0B" />
        <circle cx="130" cy="120" r="8" fill="none" stroke="#F59E0B" strokeWidth="1.5" style={{ animation: "pulse-glow 2s infinite" }} />
        <text x="140" y="124" fill="var(--text-dim)" fontSize="8" fontFamily="sans-serif">Waypoint Alpha</text>

        {/* Animated waypoint 2 */}
        <circle cx="220" cy="70" r="5" fill="#EF4444" />
        <circle cx="220" cy="70" r="8" fill="none" stroke="#EF4444" strokeWidth="1.5" style={{ animation: "pulse-glow 1.5s infinite" }} />
        <text x="230" y="74" fill="var(--text-dim)" fontSize="8" fontFamily="sans-serif">Waypoint Beta (Warning)</text>
      </svg>

      {/* Zone Detail Panel Overlay */}
      <div style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        background: "rgba(17, 34, 17, 0.75)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(16, 185, 129, 0.2)",
        borderRadius: "8px",
        padding: "8px 12px",
        zIndex: 5,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", color: "#10B981", background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: "4px" }}>SECURE TRANSIT</span>
          <span style={{ fontSize: "9px", color: "var(--text-dim)" }}>ID: BCH-201</span>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-primary)" }}>
          ETA: <strong style={{ color: "#3B82F6" }}>34 Mins</strong>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-primary)" }}>
          Health: <strong style={{ color: "#F59E0B" }}>Warning (Temp Spikes)</strong>
        </div>
      </div>

      {/* UHI Scale Overlay */}
      <div style={{
        position: "absolute",
        bottom: "10px",
        right: "10px",
        background: "rgba(17, 34, 17, 0.75)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(16, 185, 129, 0.2)",
        borderRadius: "8px",
        padding: "8px",
        zIndex: 5,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "4px"
      }}>
        <div style={{ fontSize: "9px", color: "var(--text-dim)", fontWeight: 700, marginBottom: "2px" }}>UHI HEAT SCALE</div>
        <div style={{ display: "flex", gap: "2px" }}>
          <div style={{ width: "12px", height: "8px", background: "#10B981", borderRadius: "2px" }} title="Low"></div>
          <div style={{ width: "12px", height: "8px", background: "#F59E0B", borderRadius: "2px" }} title="Moderate"></div>
          <div style={{ width: "12px", height: "8px", background: "#EF4444", borderRadius: "2px" }} title="High"></div>
          <div style={{ width: "12px", height: "8px", background: "#7F1D1D", borderRadius: "2px" }} title="Severe"></div>
        </div>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", fontSize: "8px", color: "var(--text-secondary)", marginTop: "2px" }}>
          <span>Low</span>
          <span>Severe</span>
        </div>
      </div>
    </div>
  );
}

window.DhakaRouteMicroMap = DhakaRouteMicroMap;


