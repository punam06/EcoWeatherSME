import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   THEME SYSTEM — CSS Custom Properties
   ═══════════════════════════════════════════════════════════════ */
const THEMES = {
  dark: {
    "--bg-primary": "#0B0F19",
    "--bg-secondary": "#111827",
    "--bg-card": "rgba(17, 24, 39, 0.7)",
    "--bg-card-hover": "rgba(17, 24, 39, 0.9)",
    "--bg-input": "rgba(255, 255, 255, 0.04)",
    "--bg-header": "rgba(11, 15, 25, 0.85)",
    "--border-primary": "rgba(255, 255, 255, 0.06)",
    "--border-hover": "rgba(255, 255, 255, 0.12)",
    "--text-primary": "#F1F5F9",
    "--text-secondary": "#94A3B8",
    "--text-muted": "#64748B",
    "--text-dim": "#475569",
    "--gauge-track": "#1E293B",
    "--shadow-card": "0 4px 24px rgba(0,0,0,0.3)",
    "--shadow-hover": "0 8px 32px rgba(0,0,0,0.5)",
    "--glow-primary": "0 0 20px rgba(52,211,153,0.15)",
    "--backdrop-blur": "blur(16px)",
  },
  light: {
    "--bg-primary": "#F1F5F9",
    "--bg-secondary": "#FFFFFF",
    "--bg-card": "rgba(255, 255, 255, 0.75)",
    "--bg-card-hover": "rgba(255, 255, 255, 0.95)",
    "--bg-input": "rgba(0, 0, 0, 0.03)",
    "--bg-header": "rgba(241, 245, 249, 0.88)",
    "--border-primary": "rgba(0, 0, 0, 0.08)",
    "--border-hover": "rgba(0, 0, 0, 0.15)",
    "--text-primary": "#0F172A",
    "--text-secondary": "#475569",
    "--text-muted": "#64748B",
    "--text-dim": "#94A3B8",
    "--gauge-track": "#E2E8F0",
    "--shadow-card": "0 4px 24px rgba(0,0,0,0.06)",
    "--shadow-hover": "0 8px 32px rgba(0,0,0,0.12)",
    "--glow-primary": "0 0 20px rgba(16,185,129,0.1)",
    "--backdrop-blur": "blur(16px)",
  },
};

const ACCENT = {
  green: "#10B981",
  greenLight: "#34D399",
  greenDark: "#065F46",
  greenBg: "rgba(16, 185, 129, 0.08)",
  greenBorder: "rgba(16, 185, 129, 0.2)",
  amber: "#F59E0B",
  amberLight: "#FBBF24",
  amberBg: "rgba(245, 158, 11, 0.08)",
  amberBorder: "rgba(245, 158, 11, 0.2)",
  red: "#EF4444",
  redLight: "#F87171",
  redBg: "rgba(239, 68, 68, 0.08)",
  redBorder: "rgba(239, 68, 68, 0.2)",
  blue: "#3B82F6",
  blueBg: "rgba(59, 130, 246, 0.08)",
};

/* ═══════════════════════════════════════════════════════════════
   BUET-CALIBRATED ZONE DATA (from master prompt)
   ═══════════════════════════════════════════════════════════════ */
const UHI_ZONES = {
  "Mirpur":    { offset: 2.1, hazardClass: "B-", hazardMultiplier: 1.40, baseSurvival: 1.02, color: ACCENT.amber },
  "Old Dhaka": { offset: 3.4, hazardClass: "A",  hazardMultiplier: 1.80, baseSurvival: 0.90, color: ACCENT.red },
  "Gulshan":   { offset: 1.3, hazardClass: "C",  hazardMultiplier: 1.10, baseSurvival: 1.20, color: ACCENT.green },
  "Savar":     { offset: 2.8, hazardClass: "B+", hazardMultiplier: 1.55, baseSurvival: 1.00, color: ACCENT.amber },
  "Gazipur":   { offset: 2.4, hazardClass: "B",  hazardMultiplier: 1.50, baseSurvival: 1.05, color: ACCENT.amber },
};

/* ═══════════════════════════════════════════════════════════════
   CALCULATION ENGINES
   ═══════════════════════════════════════════════════════════════ */
function calcTrustScore({ pH, EC, temp, ratio, days }) {
  let score = 100;
  const pHOpt = 4.0, ECOpt = 3.5, tempOpt = 28;
  score -= Math.abs(pH - pHOpt) * 8;
  score -= Math.abs(EC - ECOpt) * 6;
  score -= Math.abs(temp - tempOpt) * 1.2;
  const ratioMap = { "1:1:10": -5, "1:1:20": 0, "1:1:30": -3, "1:1:40": -8 };
  score += ratioMap[ratio] ?? 0;
  if (days < 7) score -= (7 - days) * 4;
  else if (days > 14) score -= (days - 14) * 2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getSolarFactor(hour) {
  if (hour >= 11 && hour < 15) return 1.0;
  if ((hour >= 8 && hour < 11) || (hour >= 15 && hour < 18)) return 0.6;
  return 0.2;
}

function getSolarHourMultiplier(hour) {
  if (hour >= 11 && hour < 15) return 1.5;
  if ((hour >= 8 && hour < 11) || (hour >= 15 && hour < 18)) return 1.0;
  return 0.4;
}

function calcAdjustedTemp(baseTemp, zone, hour, windSpeed) {
  const uhi = UHI_ZONES[zone];
  const solarFactor = getSolarFactor(hour);
  const windCooling = windSpeed > 15 ? 1.0 : 0.0;
  return baseTemp + (uhi.offset * solarFactor) - windCooling;
}

function calcThermalRisk(adjustedTemp) {
  if (adjustedTemp > 35) return { value: 1.0, label: "Critical", color: ACCENT.red };
  if (adjustedTemp > 32) return { value: 0.5, label: "Moderate", color: ACCENT.amber };
  return { value: 0.1, label: "Low", color: ACCENT.green };
}

function calcDVS(trustScore, adjustedTemp) {
  const trf = adjustedTemp > 38 ? 1.0 : adjustedTemp > 35 ? 0.5 : 0.1;
  return Math.max(0, Math.min(100, Math.round(trustScore * (1 - trf * 0.42))));
}

function calcTST(trustScore, zone, packaging, hour) {
  const uhi = UHI_ZONES[zone];
  const pkgFactor = packaging === "thermal" ? 4.0 : packaging === "insulated" ? 2.0 : 1.0;
  const solarMulti = getSolarHourMultiplier(hour);
  const raw = (trustScore * pkgFactor * uhi.baseSurvival) / (uhi.hazardMultiplier * solarMulti) * 60;
  return Math.max(10, Math.round(raw));
}

/* ═══════════════════════════════════════════════════════════════
   REUSABLE UI COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function GaugeArc({ value, max = 100, color, size = 140, strokeWidth = 10 }) {
  const r = (size - strokeWidth * 2) / 2;
  const circumference = Math.PI * r;
  const pct = Math.min(value / max, 1);
  const dash = circumference * pct;
  return (
    <svg width={size} height={size / 2 + strokeWidth} viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`} style={{ overflow: "visible" }}>
      <path
        d={`M ${strokeWidth} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${size / 2}`}
        fill="none" stroke="var(--gauge-track)" strokeWidth={strokeWidth} strokeLinecap="round"
      />
      <path
        d={`M ${strokeWidth} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${size / 2}`}
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }}
      />
    </svg>
  );
}

function ScoreGauge({ value, label, size = 140 }) {
  const color = value >= 75 ? ACCENT.green : value >= 55 ? ACCENT.amber : ACCENT.red;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: size, height: size / 2 + 20 }}>
        <GaugeArc value={value} color={color} size={size} />
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
          <div style={{ fontSize: size * 0.22, fontWeight: 700, color, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace", transition: "color 0.4s" }}>{value}</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>/ 100</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function StatusBadge({ value, type = "dvs" }) {
  const isTS = type === "trust";
  const safe = isTS ? value >= 80 : value >= 75;
  const caution = isTS ? value >= 60 : value >= 55;
  const [bg, text, label] = safe
    ? [ACCENT.greenBg, ACCENT.green, "SAFE"]
    : caution
    ? [ACCENT.amberBg, ACCENT.amber, "CAUTION"]
    : [ACCENT.redBg, ACCENT.red, "HIGH RISK"];
  return (
    <span style={{
      background: bg, color: text, border: `1px solid ${text}33`, borderRadius: 20,
      padding: "3px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
      transition: "all 0.3s ease",
    }}>
      {label}
    </span>
  );
}

function Card({ children, style = {}, hover = true }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        background: hovered ? "var(--bg-card-hover)" : "var(--bg-card)",
        backdropFilter: "var(--backdrop-blur)",
        WebkitBackdropFilter: "var(--backdrop-blur)",
        borderRadius: 14,
        padding: 20,
        border: `1px solid ${hovered ? "var(--border-hover)" : "var(--border-primary)"}`,
        boxShadow: hovered ? "var(--shadow-hover)" : "var(--shadow-card)",
        transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        transform: hovered && hover ? "translateY(-2px)" : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <div style={{
      fontSize: 11, color: ACCENT.green, letterSpacing: "0.12em", marginBottom: 16,
      fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
      textTransform: "uppercase",
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {text}
    </div>
  );
}

function SliderRow({ label, min, max, step = 0.1, value, onChange, unit = "", color = ACCENT.green }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: color, height: 4, cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)", marginTop: 3 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color, icon }) {
  return (
    <div style={{
      background: "var(--bg-input)", borderRadius: 10, padding: "10px 12px",
      border: "1px solid var(--border-primary)",
      transition: "all 0.3s ease",
    }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
        {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  );
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      id="theme-toggle"
      onClick={onToggle}
      style={{
        width: 40, height: 40, borderRadius: 12, border: "1px solid var(--border-primary)",
        background: "var(--bg-input)", cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 18,
        transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
        transform: `rotate(${theme === "dark" ? 0 : 180}deg)`,
      }}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 1: BATCH VERIFICATION (IoT Intake)
   ═══════════════════════════════════════════════════════════════ */
function IoTForm({ onResult }) {
  const [pH, setPH] = useState(4.1);
  const [EC, setEC] = useState(3.4);
  const [temp, setTemp] = useState(28);
  const [ratio, setRatio] = useState("1:1:20");
  const [days, setDays] = useState(9);
  const [certified, setCertified] = useState(false);

  const ts = calcTrustScore({ pH, EC, temp, ratio, days });

  useEffect(() => { onResult(ts); setCertified(false); }, [pH, EC, temp, ratio, days]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div>
          <SliderRow label="pH Level" min={3.0} max={7.0} step={0.1} value={pH} onChange={setPH} color={ACCENT.green} />
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Optimal: 3.8–4.2</div>
        </div>
        <div>
          <SliderRow label="Conductivity (EC)" min={1.0} max={6.0} step={0.1} value={EC} onChange={setEC} unit=" mS/cm" color={ACCENT.green} />
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Optimal: 3.1–3.9 mS/cm</div>
        </div>
        <div>
          <SliderRow label="Storage Temperature" min={20} max={45} step={0.5} value={temp} onChange={setTemp} unit="°C" color={temp > 35 ? ACCENT.red : ACCENT.amber} />
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Optimal: 25–32°C</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Treatment Ratio</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {["1:1:10", "1:1:20", "1:1:30", "1:1:40"].map(v => (
              <button key={v} onClick={() => setRatio(v)}
                style={{
                  padding: "7px 4px", borderRadius: 8,
                  border: `1px solid ${ratio === v ? ACCENT.green : "var(--border-primary)"}`,
                  background: ratio === v ? ACCENT.greenBg : "var(--bg-input)",
                  color: ratio === v ? ACCENT.green : "var(--text-muted)",
                  fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: ratio === v ? 600 : 400,
                  transition: "all 0.25s ease",
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <SliderRow label="Processing Days" min={3} max={21} step={1} value={days} onChange={setDays} unit=" days" color={ACCENT.green} />
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Optimal: 7–14 days</div>
        </div>
      </div>
      <button onClick={() => { if (ts >= 60) setCertified(true); }}
        disabled={ts < 60}
        style={{
          width: "100%", padding: "12px", borderRadius: 10,
          border: `1px solid ${ts >= 60 ? ACCENT.green : "var(--border-primary)"}`,
          background: ts >= 60 ? ACCENT.greenBg : "var(--bg-input)",
          color: ts >= 60 ? ACCENT.green : "var(--text-dim)",
          cursor: ts >= 60 ? "pointer" : "not-allowed",
          fontSize: 13, fontWeight: 600, letterSpacing: "0.05em",
          transition: "all 0.3s ease",
          boxShadow: ts >= 60 ? ACCENT.greenBg : "none",
        }}>
        {ts >= 60 ? "✦ Certify Batch & Generate QR Certificate" : "Trust Score too low to certify"}
      </button>
      {certified && (
        <div style={{
          marginTop: 14, padding: 14, borderRadius: 10,
          border: `1px solid ${ACCENT.greenBorder}`, background: ACCENT.greenBg,
          animation: "fadeSlideIn 0.4s ease",
        }}>
          <div style={{ fontSize: 11, color: ACCENT.green, fontWeight: 700, marginBottom: 10 }}>✓ BATCH CERTIFIED — Certificate Generated</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{
              width: 56, height: 56, background: "var(--bg-input)", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, color: ACCENT.green, border: `1px solid ${ACCENT.greenBorder}`, flexShrink: 0,
            }}>
              <div style={{ textAlign: "center", lineHeight: 1.4 }}>QR<br/>CODE<br/>▦</div>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.9 }}>
              <div><span style={{ color: ACCENT.green }}>Batch #:</span> BCH-{Date.now().toString().slice(-6)}</div>
              <div><span style={{ color: ACCENT.green }}>Trust Score:</span> {ts}/100</div>
              <div><span style={{ color: ACCENT.green }}>pH / EC / Temp:</span> {pH} / {EC} / {temp}°C</div>
              <div><span style={{ color: ACCENT.green }}>Ratio / Days:</span> {ratio} / {days}</div>
              <div><span style={{ color: ACCENT.green }}>Processor:</span> #07 (anonymized)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2: MICROCLIMATE INTELLIGENCE (MERM Pipeline)
   ═══════════════════════════════════════════════════════════════ */
function DispatchCalendar({ baseTemp, zone, trustScore, windSpeed }) {
  const hours = Array.from({ length: 24 }, (_, h) => {
    const adjTemp = calcAdjustedTemp(baseTemp, zone, h, windSpeed);
    const dvs = calcDVS(trustScore, adjTemp);
    return { h, dvs, temp: Math.round(adjTemp * 10) / 10 };
  });
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 500 }}>24-Hour Dispatch Safety Window</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 2, height: 36 }}>
        {hours.map(({ h, dvs }) => {
          const col = dvs >= 75 ? ACCENT.green : dvs >= 55 ? ACCENT.amber : ACCENT.red;
          return (
            <div key={h} title={`${h}:00 — DVS ${dvs}`}
              style={{
                background: col + "33", border: `1px solid ${col}55`, borderRadius: 4,
                cursor: "default", transition: "all 0.3s ease",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>
        {[0, 6, 12, 18, 23].map(h => <span key={h}>{h}:00</span>)}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11 }}>
        {[[ACCENT.green, "Safe (DVS≥75)"], [ACCENT.amber, "Caution (55–74)"], [ACCENT.red, "High Risk (<55)"]].map(([c, l]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c }}></span>{l}
          </span>
        ))}
      </div>
    </div>
  );
}

function MicroclimateSimulator({ trustScore }) {
  const [baseTemp, setBaseTemp] = useState(31);
  const [zone, setZone] = useState("Mirpur");
  const [packaging, setPackaging] = useState("standard");
  const [hour, setHour] = useState(12);
  const [windSpeed, setWindSpeed] = useState(8);

  const uhi = UHI_ZONES[zone];
  const solarFactor = getSolarFactor(hour);
  const windCooling = windSpeed > 15 ? 1.0 : 0.0;
  const adjustedTemp = calcAdjustedTemp(baseTemp, zone, hour, windSpeed);
  const thermalRisk = calcThermalRisk(adjustedTemp);
  const dvs = calcDVS(trustScore, adjustedTemp);
  const tst = calcTST(trustScore, zone, packaging, hour);
  const dvsColor = dvs >= 75 ? ACCENT.green : dvs >= 55 ? ACCENT.amber : ACCENT.red;

  const advice = dvs >= 75
    ? `${zone} zone — DVS ${dvs} is SAFE. Adjusted temp ${adjustedTemp.toFixed(1)}°C. Products can be dispatched safely. TST: ${tst} min.`
    : dvs >= 55
    ? `CAUTION: ${zone} reaches ${adjustedTemp.toFixed(1)}°C. Dispatch heat-sensitive items before 08:00 AM only. TST: ${tst} min. Consider insulated packaging.`
    : `HIGH RISK: ${zone} at ${adjustedTemp.toFixed(1)}°C. TST only ${tst} min. Delay dispatch or upgrade to thermal-insulated bins for perishable goods.`;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* LEFT: Controls */}
        <div>
          <SliderRow label="Base Temperature (Regional)" min={25} max={42} step={0.5} value={baseTemp} onChange={setBaseTemp} unit="°C" color={baseTemp > 35 ? ACCENT.red : ACCENT.amber} />
          <SliderRow label="Wind Speed" min={0} max={30} step={1} value={windSpeed} onChange={setWindSpeed} unit=" km/h" color={ACCENT.blue} />
          <SliderRow label="Dispatch Hour" min={0} max={23} step={1} value={hour} onChange={setHour} unit={`:00 ${hour >= 11 && hour < 15 ? '(Peak Solar)' : hour >= 8 && hour < 18 ? '(Daylight)' : '(Night)'}`} color={hour >= 11 && hour < 15 ? ACCENT.red : hour >= 8 && hour < 18 ? ACCENT.amber : ACCENT.green} />

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, marginTop: 4, fontWeight: 500 }}>Delivery Zone</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
            {Object.entries(UHI_ZONES).map(([z, d]) => (
              <button key={z} onClick={() => setZone(z)}
                style={{
                  padding: "8px 8px", borderRadius: 8, textAlign: "left",
                  border: `1px solid ${zone === z ? d.color : "var(--border-primary)"}`,
                  background: zone === z ? d.color + "15" : "var(--bg-input)",
                  color: zone === z ? d.color : "var(--text-muted)",
                  fontSize: 11, cursor: "pointer",
                  transition: "all 0.25s ease",
                }}>
                <div style={{ fontWeight: 600 }}>{z}</div>
                <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>+{d.offset}°C · Class {d.hazardClass}</div>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Packaging Type</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["standard", "Standard"], ["insulated", "Insulated"], ["thermal", "Thermal Bin"]].map(([v, l]) => (
              <button key={v} onClick={() => setPackaging(v)}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 8,
                  border: `1px solid ${packaging === v ? ACCENT.green : "var(--border-primary)"}`,
                  background: packaging === v ? ACCENT.greenBg : "var(--bg-input)",
                  color: packaging === v ? ACCENT.green : "var(--text-muted)",
                  fontSize: 10, cursor: "pointer", fontWeight: packaging === v ? 600 : 400,
                  transition: "all 0.25s ease",
                }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Results */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 14 }}>
          {/* DVS Gauge */}
          <div style={{ position: "relative", marginBottom: 4 }}>
            <svg width={170} height={105} viewBox="0 0 170 105">
              <path d="M 14 95 A 71 71 0 0 1 156 95" fill="none" stroke="var(--gauge-track)" strokeWidth={13} strokeLinecap="round" />
              <path d="M 14 95 A 71 71 0 0 1 156 95" fill="none" stroke={dvsColor} strokeWidth={13} strokeLinecap="round"
                strokeDasharray={`${(dvs / 100) * Math.PI * 71} ${Math.PI * 71}`}
                style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }} />
              <text x="85" y="80" textAnchor="middle" fill={dvsColor} fontSize="28" fontWeight="700" fontFamily="'JetBrains Mono', monospace"
                style={{ transition: "fill 0.4s" }}>{dvs}</text>
              <text x="85" y="96" textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontWeight="500">DELIVERY VIABILITY</text>
            </svg>
            <div style={{ position: "absolute", top: -6, right: -6 }}>
              <StatusBadge value={dvs} type="dvs" />
            </div>
          </div>

          {/* MERM Pipeline Breakdown */}
          <div style={{
            width: "100%", padding: 14, borderRadius: 10,
            background: "var(--bg-input)", border: "1px solid var(--border-primary)",
          }}>
            <div style={{ fontSize: 10, color: ACCENT.green, fontWeight: 600, marginBottom: 10, letterSpacing: "0.08em" }}>
              MICROCLIMATE PIPELINE (MERM)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["Base Temp", `${baseTemp}°C`, "var(--text-primary)"],
                ["+ UHI Offset × Solar", `+${(uhi.offset * solarFactor).toFixed(1)}°C`, ACCENT.amber],
                ["− Wind Cooling", `−${windCooling.toFixed(1)}°C`, ACCENT.blue],
                ["= Adjusted Temp", `${adjustedTemp.toFixed(1)}°C`, thermalRisk.color],
                ["→ Thermal Risk", thermalRisk.label, thermalRisk.color],
              ].map(([l, v, c], i) => (
                <div key={l} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "4px 0",
                  borderTop: i === 3 ? `1px solid var(--border-primary)` : "none",
                  marginTop: i === 3 ? 2 : 0,
                  paddingTop: i === 3 ? 8 : 4,
                }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c, fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
            <MetricBox label="Thermal Survival" value={`${tst} min`} color={tst < 30 ? ACCENT.red : tst < 60 ? ACCENT.amber : ACCENT.green} icon="⏱" />
            <MetricBox label="Hazard Multiplier" value={`×${uhi.hazardMultiplier}`} color={uhi.color} icon="⚡" />
            <MetricBox label="Solar Factor" value={`×${solarFactor}`} color={solarFactor >= 1.0 ? ACCENT.red : solarFactor >= 0.6 ? ACCENT.amber : ACCENT.green} icon="☀" />
            <MetricBox label="Zone Class" value={`Class ${uhi.hazardClass}`} color={uhi.color} icon="📍" />
          </div>
        </div>
      </div>

      {/* Advisory */}
      <div style={{
        marginTop: 14, padding: 14, borderRadius: 10,
        border: `1px solid ${dvsColor}33`, background: dvsColor + "0A",
        transition: "all 0.4s ease",
      }}>
        <div style={{ fontSize: 11, color: dvsColor, fontWeight: 700, marginBottom: 5 }}>
          {dvs >= 75 ? "✓ Smart Dispatch Advice" : dvs >= 55 ? "⚠ Smart Dispatch Advice" : "✕ High Risk Advisory"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.7 }}>{advice}</div>
      </div>

      <DispatchCalendar baseTemp={baseTemp} zone={zone} trustScore={trustScore} windSpeed={windSpeed} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3: CLIMATE DEMAND INTELLIGENCE
   ═══════════════════════════════════════════════════════════════ */
function DemandChart() {
  const canvasRef = useRef();
  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    const ctx = canvasRef.current.getContext("2d");
    const labels = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const base = [42,38,45,40,37,43,48,52,55,58,62,78,95,110,118,105,88,75,68,65,70,72,68,66,64,60,58,55,52,50];

    const rootStyles = getComputedStyle(document.documentElement);
    const gridColor = rootStyles.getPropertyValue("--gauge-track").trim() || "#1E293B";
    const tickColor = rootStyles.getPropertyValue("--text-dim").trim() || "#64748B";

    const chart = new window.Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Demand Forecast",
          data: base,
          borderColor: ACCENT.green,
          backgroundColor: "rgba(16,185,129,0.08)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: base.map((v, i) => i === 11 ? 6 : 0),
          pointBackgroundColor: base.map((v, i) => i === 11 ? ACCENT.amber : ACCENT.green),
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.parsed.y} units` },
            backgroundColor: "var(--bg-secondary)", titleColor: ACCENT.green,
            bodyColor: "#F1F5F9", borderColor: "var(--border-primary)", borderWidth: 1,
          },
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 9 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 8 } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 } } },
        },
      },
    });
    return () => chart.destroy();
  }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          [ACCENT.amber, "Heatwave event (+40% demand in 5 days)"],
          [ACCENT.green, "Demand forecast (Prophet ML)"],
        ].map(([c, l]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0 }}></span>{l}
          </span>
        ))}
      </div>
      <div style={{ position: "relative", width: "100%", height: 200 }}>
        <canvas ref={canvasRef} role="img" aria-label="30-day demand forecast chart showing heatwave-driven spike">30-day demand forecast with climate event markers</canvas>
      </div>
      <div style={{
        marginTop: 14, padding: 14, borderRadius: 10,
        border: `1px solid ${ACCENT.amberBorder}`, background: ACCENT.amberBg,
        display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>
          <div style={{ fontSize: 12, color: ACCENT.amber, fontWeight: 700 }}>Climate Demand Alert</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.6 }}>
            Heatwave forecast in 5 days → expect +40% demand for cold-chain sensitive products. Prepare additional inventory and upgrade packaging for perishable goods.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 4: IMPACT & ESG LEDGER
   ═══════════════════════════════════════════════════════════════ */
function ESGCard({ trustScore, dvs }) {
  const spoilagePrevented = Math.round(trustScore * 2.1 * (dvs / 100) * 40);
  const plasticOffset = Math.round(trustScore * 0.8);
  const carbonSeq = Math.round(trustScore * 1.4);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      {[
        ["🛡️", "Spoilage Prevented", `BDT ${spoilagePrevented.toLocaleString()}`, ACCENT.green],
        ["♻️", "Plastic Offset", `${plasticOffset} kg`, ACCENT.green],
        ["🌿", "Carbon Sequestered", `${carbonSeq} kg CO₂`, ACCENT.green],
      ].map(([icon, l, v, c]) => (
        <Card key={l} style={{ textAlign: "center", padding: "16px 12px" }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6, lineHeight: 1.4 }}>{l}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: c, fontFamily: "'JetBrains Mono', monospace" }}>{v}</div>
        </Card>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APPLICATION
   ═══════════════════════════════════════════════════════════════ */
const TABS = [
  { label: "Batch Verification", icon: "📡" },
  { label: "Microclimate Intelligence", icon: "🌡️" },
  { label: "Climate Demand", icon: "📊" },
  { label: "Impact & ESG", icon: "🌱" },
];

export default function EcoSorthaApp() {
  const [tab, setTab] = useState(0);
  const [trustScore, setTrustScore] = useState(84);
  const [theme, setTheme] = useState("dark");

  const adjustedTemp = calcAdjustedTemp(31, "Mirpur", 12, 8);
  const dvs = calcDVS(trustScore, adjustedTemp);

  const themeVars = THEMES[theme];

  return (
    <div style={{
      ...themeVars,
      background: "var(--bg-primary)",
      minHeight: "100vh",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "var(--text-primary)",
      padding: 0,
      transition: "background 0.5s cubic-bezier(0.4,0,0.2,1), color 0.4s ease",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(16,185,129,0.3); }
          50% { box-shadow: 0 0 16px rgba(16,185,129,0.5); }
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: var(--gauge-track);
          border-radius: 4px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid rgba(255,255,255,0.2);
          transition: transform 0.2s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: rgba(16,185,129,0.3); }
      `}</style>

      {/* ── HEADER ────────────────────────────────────────────── */}
      <header style={{
        borderBottom: "1px solid var(--border-primary)",
        padding: "14px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-header)",
        backdropFilter: "var(--backdrop-blur)",
        WebkitBackdropFilter: "var(--backdrop-blur)",
        position: "sticky", top: 0, zIndex: 50,
        backgroundImage: `linear-gradient(to right, ${ACCENT.green}08, transparent 50%)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${ACCENT.greenLight}, ${ACCENT.greenDark})`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            animation: "pulseGlow 3s ease-in-out infinite",
          }}>🌱</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>EcoSortha AI</div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.14em", fontWeight: 500 }}>CLIMATESHIELD · SME DASHBOARD</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <ScoreGauge value={trustScore} label="Trust" size={76} />
            <ScoreGauge value={dvs} label="DVS" size={76} />
          </div>
          <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === "dark" ? "light" : "dark")} />
        </div>
      </header>

      {/* ── TAB BAR ───────────────────────────────────────────── */}
      <nav style={{
        display: "flex", gap: 2,
        borderBottom: "1px solid var(--border-primary)",
        background: "var(--bg-header)",
        backdropFilter: "var(--backdrop-blur)",
        WebkitBackdropFilter: "var(--backdrop-blur)",
        paddingLeft: 28,
      }}>
        {TABS.map((t, i) => (
          <button key={t.label} onClick={() => setTab(i)}
            style={{
              padding: "12px 18px", border: "none",
              background: tab === i ? "var(--bg-input)" : "transparent",
              color: tab === i ? ACCENT.green : "var(--text-dim)",
              fontSize: 11, cursor: "pointer",
              borderBottom: tab === i ? `2px solid ${ACCENT.green}` : "2px solid transparent",
              fontFamily: "inherit", letterSpacing: "0.06em", fontWeight: tab === i ? 600 : 400,
              transition: "all 0.3s ease",
              borderRadius: "8px 8px 0 0",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* ── CONTENT ───────────────────────────────────────────── */}
      <main style={{ padding: "24px 28px", maxWidth: 1000, margin: "0 auto" }}>

        {tab === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, animation: "fadeSlideIn 0.4s ease" }}>
            <div>
              <SectionLabel icon="📡" text="Batch Sensor Verification" />
              <Card><IoTForm onResult={setTrustScore} /></Card>
            </div>
            <div>
              <SectionLabel icon="🔒" text="Trust Score Engine" />
              <Card>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                  <div style={{ textAlign: "center" }}>
                    <GaugeArc value={trustScore} color={trustScore >= 75 ? ACCENT.green : trustScore >= 55 ? ACCENT.amber : ACCENT.red} size={200} strokeWidth={14} />
                    <div style={{
                      fontSize: 44, fontWeight: 700,
                      color: trustScore >= 75 ? ACCENT.green : trustScore >= 55 ? ACCENT.amber : ACCENT.red,
                      fontFamily: "'JetBrains Mono', monospace", marginTop: -6,
                      transition: "color 0.4s ease",
                    }}>
                      {trustScore}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>/ 100 TRUST SCORE</div>
                    <div style={{ marginTop: 10 }}><StatusBadge value={trustScore} type="trust" /></div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    ["Batch ID", `BCH-${(trustScore * 847).toString().slice(-5)}`],
                    ["Processor", "#07 (anon)"],
                    ["Product Type", "Heat-Sensitive Goods"],
                    ["Certified At", new Date().toLocaleTimeString()],
                  ].map(([l, v]) => (
                    <MetricBox key={l} label={l} value={v} color="var(--text-secondary)" />
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
            <SectionLabel icon="🌡️" text="Microclimate Exposure Risk Model (MERM)" />
            <Card><MicroclimateSimulator trustScore={trustScore} /></Card>
          </div>
        )}

        {tab === 2 && (
          <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
            <SectionLabel icon="📊" text="Climate Demand Intelligence (Prophet ML)" />
            <Card><DemandChart /></Card>
          </div>
        )}

        {tab === 3 && (
          <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
            <SectionLabel icon="🌱" text="Impact & ESG Ledger" />
            <ESGCard trustScore={trustScore} dvs={dvs} />
            <div style={{ marginTop: 18 }}>
              <Card>
                <div style={{ fontSize: 12, color: ACCENT.green, marginBottom: 12, fontWeight: 600 }}>Monthly Impact Summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    ["SMEs Served", "500+"],
                    ["Batches Certified", `${trustScore * 3}`],
                    ["Dispatch Alerts Issued", `${Math.round(dvs * 0.4)}`],
                    ["Circular Economy Value", "BDT 6.3L ARR"],
                  ].map(([l, v]) => (
                    <div key={l} style={{
                      display: "flex", justifyContent: "space-between", padding: "8px 0",
                      borderBottom: "1px solid var(--border-primary)",
                    }}>
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{l}</span>
                      <span style={{ fontSize: 12, color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

      </main>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid var(--border-primary)",
        padding: "12px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "var(--bg-header)",
        backdropFilter: "var(--backdrop-blur)",
        WebkitBackdropFilter: "var(--backdrop-blur)",
      }}>
        <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", fontWeight: 500 }}>
          ECOSORTHA AI CLIMATESHIELD · INFINITY AI BUILDFEST 2026 · TEAM GLIDERS · TRACK 4: E-COMMERCE
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 9, color: "var(--text-dim)" }}>
          <span>Trust Score: <span style={{ color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace" }}>{trustScore}/100</span></span>
          <span>DVS: <span style={{ color: dvs >= 75 ? ACCENT.green : dvs >= 55 ? ACCENT.amber : ACCENT.red, fontFamily: "'JetBrains Mono', monospace" }}>{dvs}/100</span></span>
        </div>
      </footer>
    </div>
  );
}
