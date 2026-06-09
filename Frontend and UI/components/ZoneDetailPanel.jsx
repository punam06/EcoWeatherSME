const { useState } = React;

const UHI_ZONES = {
  "Old Dhaka":      { offset: 3.4, hazardClass: "A", color: "#EF4444" },
  "Mirpur":         { offset: 2.1, hazardClass: "C", color: "#F59E0B" },
  "Gulshan":        { offset: 1.3, hazardClass: "D", color: "#10B981" },
  "Savar":          { offset: 2.8, hazardClass: "B", color: "#EF4444" }
};

function getUHILabel(offset) {
  if (offset >= 3.0) return "Critical (Class A)";
  if (offset >= 2.5) return "High (Class B)";
  if (offset >= 2.0) return "Moderate (Class C)";
  return "Low (Class D)";
}

export default function ZoneDetailPanel({ activeZone, setActiveZone }) {
  const baseTemp = 32; // Default base
  const zone = UHI_ZONES[activeZone] || UHI_ZONES["Mirpur"];
  const adjustedTemp = baseTemp + zone.offset;
  const exposureLevel = getUHILabel(zone.offset);
  const tstMinutes = Math.max(10, Math.round(90 / (zone.offset * 0.5)));

  return (
    <div style={{
      padding: "16px",
      borderRadius: "12px",
      background: "rgba(0,0,0,0.2)",
      border: `1px solid ${zone.color}`,
      color: "white"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
        <h4 style={{ margin: 0, fontSize: "16px" }}>Zone Details</h4>
        <select 
          value={activeZone} 
          onChange={(e) => setActiveZone(e.target.value)}
          style={{ background: "#222", color: "white", border: "1px solid #444", borderRadius: "4px", padding: "4px" }}
        >
          {Object.keys(UHI_ZONES).map(z => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "14px" }}>
        <div>
          <div style={{ color: "#888", marginBottom: "4px" }}>UHI Offset</div>
          <div style={{ color: zone.color, fontWeight: "bold", fontSize: "16px" }}>+{zone.offset.toFixed(1)}°C</div>
        </div>
        <div>
          <div style={{ color: "#888", marginBottom: "4px" }}>Adjusted Temp</div>
          <div style={{ fontWeight: "bold", fontSize: "16px" }}>{adjustedTemp.toFixed(1)}°C</div>
        </div>
        <div>
          <div style={{ color: "#888", marginBottom: "4px" }}>Thermal Survival Time</div>
          <div style={{ fontWeight: "bold", fontSize: "16px" }}>{tstMinutes} min</div>
        </div>
        <div>
          <div style={{ color: "#888", marginBottom: "4px" }}>Exposure Level</div>
          <div style={{ color: zone.color, fontWeight: "bold", fontSize: "16px" }}>{exposureLevel}</div>
        </div>
      </div>
    </div>
  );
}

