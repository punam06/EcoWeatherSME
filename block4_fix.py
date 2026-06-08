import re

def update_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Define DhakaRouteMicroMap component
    micro_map_component = '''
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
    </div>
  );
};
'''

    # Insert DhakaRouteMicroMap before DeliveryView component
    if 'const DhakaRouteMicroMap = () =>' not in content:
        content = content.replace('function DeliveryView', micro_map_component + '\nfunction DeliveryView')

    # Replace placeholder map SVG in DeliveryView
    old_placeholder_svg = '''            <div style={{
              height: "180px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-primary)",
              borderRadius: "10px", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
                {/* Simulated routes and nodes */}
                <circle cx="50" cy="50" r="5" fill="#EF4444" />
                <text x="60" y="54" fill="#6B7280" fontSize="10">Gazipur (Origin)</text>
                <circle cx="150" cy="120" r="5" fill="#3B82F6" />
                <text x="160" y="124" fill="#6B7280" fontSize="10">Mirpur (Dest)</text>
                
                <circle cx="280" cy="80" r="5" fill="#10B981" />
                <text x="290" y="84" fill="#6B7280" fontSize="10">Savar (Origin)</text>
                
                <path d="M 50 50 Q 100 80 150 120" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4" />
                <path d="M 50 50 Q 70 120 150 120" fill="none" stroke="#3B82F6" strokeWidth="2" />
                
                <path d="M 280 80 Q 200 100 150 120" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4" />
              </svg>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", zIndex: 10, textAlign: "center" }}>
                Interactive GIS Overlay: Dhaka Division Grid
              </div>
            </div>'''

    new_map_svg = '''            <div style={{
              height: "180px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-primary)",
              borderRadius: "10px", position: "relative", overflow: "hidden"
            }}>
              <DhakaRouteMicroMap />
            </div>'''

    content = content.replace(old_placeholder_svg, new_map_svg, 1)

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

for fname in ['Frontend and UI/index.html', 'Frontend and UI/climalogix_dashboard.jsx']:
    update_file(fname)

print("Block 4 completed programmatically.")
