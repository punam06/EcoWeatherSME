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
  // Dense Commercial / Old Dhaka (High UHI)
  "Old Dhaka":      { offset: 3.4, hazardClass: "A",  hazardMultiplier: 1.80, baseSurvival: 0.90, color: ACCENT.red },
  "Motijheel":      { offset: 3.1, hazardClass: "A",  hazardMultiplier: 1.70, baseSurvival: 0.92, color: ACCENT.red },
  "Tejgaon":        { offset: 3.2, hazardClass: "A",  hazardMultiplier: 1.75, baseSurvival: 0.91, color: ACCENT.red },
  "Hazaribagh":     { offset: 3.5, hazardClass: "A+", hazardMultiplier: 1.85, baseSurvival: 0.88, color: ACCENT.red },
  "Kamrangirchar":  { offset: 3.3, hazardClass: "A",  hazardMultiplier: 1.78, baseSurvival: 0.90, color: ACCENT.red },
  "Chowkbazar":     { offset: 3.4, hazardClass: "A",  hazardMultiplier: 1.80, baseSurvival: 0.90, color: ACCENT.red },
  "Lalbagh":        { offset: 3.2, hazardClass: "A",  hazardMultiplier: 1.75, baseSurvival: 0.91, color: ACCENT.red },
  "Jatrabari":      { offset: 3.3, hazardClass: "A",  hazardMultiplier: 1.78, baseSurvival: 0.90, color: ACCENT.red },
  "Sutrapur":       { offset: 3.1, hazardClass: "A",  hazardMultiplier: 1.70, baseSurvival: 0.92, color: ACCENT.red },
  "Bangshal":       { offset: 3.3, hazardClass: "A",  hazardMultiplier: 1.78, baseSurvival: 0.90, color: ACCENT.red },
  "Kotwali":        { offset: 3.4, hazardClass: "A",  hazardMultiplier: 1.80, baseSurvival: 0.90, color: ACCENT.red },

  // Dense Residential / Mixed (Medium-High UHI)
  "Mirpur":         { offset: 2.1, hazardClass: "B-", hazardMultiplier: 1.40, baseSurvival: 1.02, color: ACCENT.amber },
  "Mohammadpur":    { offset: 2.3, hazardClass: "B",  hazardMultiplier: 1.48, baseSurvival: 1.02, color: ACCENT.amber },
  "Badda":          { offset: 2.5, hazardClass: "B+", hazardMultiplier: 1.52, baseSurvival: 1.00, color: ACCENT.amber },
  "Rampura":        { offset: 2.6, hazardClass: "B+", hazardMultiplier: 1.55, baseSurvival: 0.99, color: ACCENT.amber },
  "Malibagh":       { offset: 2.8, hazardClass: "B+", hazardMultiplier: 1.60, baseSurvival: 0.95, color: ACCENT.amber },
  "Khilgaon":       { offset: 2.7, hazardClass: "B+", hazardMultiplier: 1.58, baseSurvival: 0.98, color: ACCENT.amber },
  "Moghbazar":      { offset: 2.9, hazardClass: "A-", hazardMultiplier: 1.65, baseSurvival: 0.94, color: ACCENT.red },
  "Azimpur":        { offset: 2.4, hazardClass: "B",  hazardMultiplier: 1.50, baseSurvival: 1.01, color: ACCENT.amber },
  "Shantinagar":    { offset: 2.8, hazardClass: "B+", hazardMultiplier: 1.60, baseSurvival: 0.95, color: ACCENT.amber },
  "Kakrail":        { offset: 2.7, hazardClass: "B+", hazardMultiplier: 1.58, baseSurvival: 0.98, color: ACCENT.amber },
  "Paltan":         { offset: 3.0, hazardClass: "A-", hazardMultiplier: 1.68, baseSurvival: 0.93, color: ACCENT.red },
  "Mugda":          { offset: 2.6, hazardClass: "B+", hazardMultiplier: 1.55, baseSurvival: 0.99, color: ACCENT.amber },
  "Sabujbagh":      { offset: 2.5, hazardClass: "B+", hazardMultiplier: 1.52, baseSurvival: 1.00, color: ACCENT.amber },
  "Demra":          { offset: 2.4, hazardClass: "B",  hazardMultiplier: 1.50, baseSurvival: 1.05, color: ACCENT.amber },
  "Kadamtali":      { offset: 2.6, hazardClass: "B+", hazardMultiplier: 1.55, baseSurvival: 0.99, color: ACCENT.amber },
  "Shyampur":       { offset: 2.7, hazardClass: "B+", hazardMultiplier: 1.58, baseSurvival: 0.98, color: ACCENT.amber },
  "Gendaria":       { offset: 2.8, hazardClass: "B+", hazardMultiplier: 1.60, baseSurvival: 0.95, color: ACCENT.amber },
  "Mohakhali":      { offset: 2.8, hazardClass: "B+", hazardMultiplier: 1.60, baseSurvival: 0.95, color: ACCENT.amber },
  "Pallabi":        { offset: 2.0, hazardClass: "B-", hazardMultiplier: 1.35, baseSurvival: 1.05, color: ACCENT.amber },
  "Rupnagar":       { offset: 2.1, hazardClass: "B-", hazardMultiplier: 1.40, baseSurvival: 1.02, color: ACCENT.amber },
  "Shah Ali":       { offset: 2.2, hazardClass: "B",  hazardMultiplier: 1.45, baseSurvival: 1.00, color: ACCENT.amber },
  "Darus Salam":    { offset: 2.3, hazardClass: "B",  hazardMultiplier: 1.48, baseSurvival: 1.02, color: ACCENT.amber },
  "Adabor":         { offset: 2.2, hazardClass: "B",  hazardMultiplier: 1.45, baseSurvival: 1.00, color: ACCENT.amber },
  "Kalabagan":      { offset: 2.5, hazardClass: "B+", hazardMultiplier: 1.52, baseSurvival: 1.00, color: ACCENT.amber },
  "New Market":     { offset: 2.9, hazardClass: "A-", hazardMultiplier: 1.65, baseSurvival: 0.94, color: ACCENT.red },
  "Shahbagh":       { offset: 2.6, hazardClass: "B+", hazardMultiplier: 1.55, baseSurvival: 0.99, color: ACCENT.amber },
  "Ramna":          { offset: 2.5, hazardClass: "B+", hazardMultiplier: 1.52, baseSurvival: 1.00, color: ACCENT.amber },
  "Shahjahanpur":   { offset: 2.7, hazardClass: "B+", hazardMultiplier: 1.58, baseSurvival: 0.98, color: ACCENT.amber },
  "Bhatara":        { offset: 2.4, hazardClass: "B",  hazardMultiplier: 1.50, baseSurvival: 1.01, color: ACCENT.amber },
  "Bhashantek":     { offset: 2.2, hazardClass: "B",  hazardMultiplier: 1.45, baseSurvival: 1.00, color: ACCENT.amber },
  "Kafrul":         { offset: 2.3, hazardClass: "B",  hazardMultiplier: 1.48, baseSurvival: 1.02, color: ACCENT.amber },
  "Sher-e-Bangla":  { offset: 2.0, hazardClass: "B-", hazardMultiplier: 1.35, baseSurvival: 1.05, color: ACCENT.amber },

  // Planned Residential / Wealthy (Medium-Low UHI)
  "Dhanmondi":      { offset: 2.2, hazardClass: "B",  hazardMultiplier: 1.45, baseSurvival: 1.00, color: ACCENT.amber },
  "Gulshan":        { offset: 1.3, hazardClass: "C",  hazardMultiplier: 1.10, baseSurvival: 1.20, color: ACCENT.green },
  "Banani":         { offset: 1.5, hazardClass: "C",  hazardMultiplier: 1.15, baseSurvival: 1.18, color: ACCENT.green },
  "Baridhara":      { offset: 1.2, hazardClass: "C",  hazardMultiplier: 1.08, baseSurvival: 1.22, color: ACCENT.green },
  "Niketan":        { offset: 1.6, hazardClass: "C",  hazardMultiplier: 1.18, baseSurvival: 1.15, color: ACCENT.green },
  "Uttara":         { offset: 1.8, hazardClass: "B-", hazardMultiplier: 1.30, baseSurvival: 1.10, color: ACCENT.amber },
  "Bashundhara RA": { offset: 1.4, hazardClass: "C",  hazardMultiplier: 1.12, baseSurvival: 1.19, color: ACCENT.green },

  // Peripheral / Developing / Green (Low UHI)
  "Purbachal":      { offset: 0.8, hazardClass: "C+", hazardMultiplier: 1.02, baseSurvival: 1.28, color: ACCENT.green },
  "Cantonment":     { offset: 1.0, hazardClass: "C+", hazardMultiplier: 1.05, baseSurvival: 1.25, color: ACCENT.green },
  "Turag":          { offset: 1.5, hazardClass: "C",  hazardMultiplier: 1.15, baseSurvival: 1.18, color: ACCENT.green },
  "Khilkhet":       { offset: 1.7, hazardClass: "C",  hazardMultiplier: 1.20, baseSurvival: 1.14, color: ACCENT.green },
  "Bimanbandar":    { offset: 1.6, hazardClass: "C",  hazardMultiplier: 1.18, baseSurvival: 1.15, color: ACCENT.green },
  "Uttar Khan":     { offset: 1.4, hazardClass: "C",  hazardMultiplier: 1.12, baseSurvival: 1.19, color: ACCENT.green },
  "Dakshinkhan":    { offset: 1.5, hazardClass: "C",  hazardMultiplier: 1.15, baseSurvival: 1.18, color: ACCENT.green },
  "Savar":          { offset: 2.8, hazardClass: "B+", hazardMultiplier: 1.55, baseSurvival: 1.00, color: ACCENT.amber },
  "Gazipur":        { offset: 2.4, hazardClass: "B",  hazardMultiplier: 1.50, baseSurvival: 1.05, color: ACCENT.amber },
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
  score += ratioMap[ratio] !== undefined ? ratioMap[ratio] : 0;
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
  const [ts, setTs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchTrustScore = async () => {
      setIsLoading(true);
      setTimeout(() => {
        const score = calcTrustScore({ pH, EC, temp, ratio, days });
        setTs(score);
        onResult(score);
        setCertified(false);
        setIsLoading(false);
      }, 400); 
    };
    fetchTrustScore();
  }, [pH, EC, temp, ratio, days, onResult]);

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
        disabled={ts < 60 || isLoading}
        style={{
          width: "100%", padding: "12px", borderRadius: 10,
          border: `1px solid ${ts >= 60 ? ACCENT.green : "var(--border-primary)"}`,
          background: ts >= 60 ? ACCENT.greenBg : "var(--bg-input)",
          color: ts >= 60 ? ACCENT.green : "var(--text-dim)",
          cursor: ts >= 60 && !isLoading ? "pointer" : "not-allowed",
          fontSize: 13, fontWeight: 600, letterSpacing: "0.05em",
          transition: "all 0.3s ease",
          boxShadow: ts >= 60 ? ACCENT.greenBg : "none",
          opacity: isLoading ? 0.7 : 1,
        }}>
        {isLoading ? "⏳ Calculating..." : ts >= 60 ? "✦ Certify Batch & Generate QR Certificate" : "Trust Score too low to certify"}
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

function MicroclimateSimulator({ trustScore, dvs, setDvs }) {
  const [baseTemp, setBaseTemp] = useState(31);
  const [zone, setZone] = useState("Mirpur");
  const [packaging, setPackaging] = useState("standard");
  const [hour, setHour] = useState(new Date().getHours());
  const [windSpeed, setWindSpeed] = useState(8);
  const [routeDuration, setRouteDuration] = useState(90);
  const [zoneSearch, setZoneSearch] = useState("");
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [tst, setTst] = useState(0);
  const [adjustedTemp, setAdjustedTemp] = useState(31);
  const [thermalRisk, setThermalRisk] = useState({ value: 0.1, label: "Low", color: ACCENT.green });
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState("en-US");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [weatherStatus, setWeatherStatus] = useState("");
  const recognitionRef = useRef(null);

  const uhi = UHI_ZONES[zone] || UHI_ZONES["Mirpur"];
  const solarFactor = getSolarFactor(hour);
  const dvsColor = dvs >= 75 ? ACCENT.green : dvs >= 55 ? ACCENT.amber : ACCENT.red;
  const trustColor = trustScore >= 75 ? ACCENT.green : trustScore >= 55 ? ACCENT.amber : ACCENT.red;

  const filteredZones = Object.keys(UHI_ZONES).filter(z => z.toLowerCase().includes(zoneSearch.toLowerCase()));

  // Calculate scores only when the button is clicked or on initial mount
  const handleCalculate = () => {
    const adjTemp = calcAdjustedTemp(baseTemp, zone, hour, windSpeed);
    const risk = calcThermalRisk(adjTemp);
    const tstScore = calcTST(trustScore, zone, packaging, hour);
    // Penalise DVS if route duration exceeds thermal survival time
    const routePenalty = routeDuration > tstScore ? Math.min(0.5, (routeDuration - tstScore) / tstScore) : 0;
    const baseDvs = calcDVS(trustScore, adjTemp);
    const finalDvs = Math.max(0, Math.round(baseDvs * (1 - routePenalty)));
    setAdjustedTemp(adjTemp);
    setThermalRisk(risk);
    setDvs(finalDvs);
    setTst(tstScore);
  };

  // Run calculation in real-time as inputs change
  useEffect(() => {
    handleCalculate();
  }, [trustScore, baseTemp, zone, hour, windSpeed, routeDuration, packaging]);

  // On mount: fetch live Dhaka weather automatically
  useEffect(() => {
    fetchLiveWeather("Dhaka");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount: detect speech language from browser locale
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSpeechSupported(false);
    } else {
      const locale = (navigator.languages && navigator.languages[0]) || navigator.language || "en-US";
      if (locale.toLowerCase().startsWith("bn")) setSpeechLang("bn-BD");
    }
  }, []);

  const handleListen = async () => {
    if (isListening) {
      if (recognitionRef.current && recognitionRef.current.state === "recording") {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recognitionRef.current = mediaRecorder;
      let audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunks.length === 0) return;
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        try {
          // Use Groq Whisper transcription
          const res = await window.APIClient.transcribeAudio(audioBlob, speechLang);
          if (res.success && res.text) {
            const transcript = res.text.trim();
            setZoneSearch(transcript);
            
            // Auto-select zone if matched
            const matchedZone = Object.keys(UHI_ZONES).find(z => z.toLowerCase().includes(transcript.toLowerCase()));
            if (matchedZone) {
              setZone(matchedZone);
            }
            // Auto-fetch weather for spoken location
            fetchLiveWeather(matchedZone || transcript);
          }
        } catch (err) {
          console.error("Transcription error:", err);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      setIsListening(false);
      setSpeechSupported(false); // If they deny permission
    }
  };

  // Auto-detect: use browser GPS -> /api/weather by lat/lon (no Google Maps key needed)
  // Also auto-sets dispatch hour to current local time
  async function fetchLiveWeather(locationQuery) {
    setIsFetchingWeather(true);
    setWeatherStatus("Detecting...");
    setHour(new Date().getHours());

    if (typeof locationQuery === "string") {
      // Called from speech recognition with a zone/city name
      try {
        const weatherRes = await window.APIClient.getWeatherByCity(locationQuery);
        if (weatherRes.success && weatherRes.data) {
          setBaseTemp(Math.round(weatherRes.data.temperature * 10) / 10);
          setWindSpeed(Math.round(weatherRes.data.windspeed_kmh));
          setWeatherStatus("Live: " + (weatherRes.data.name || locationQuery));
        }
      } catch (e) {
        console.error("Weather by city failed", e);
        setWeatherStatus("Failed.");
      }
      setIsFetchingWeather(false);
      return;
    }

    // Auto-detect button: use browser GPS
    if (!navigator.geolocation) {
      setWeatherStatus("GPS not supported.");
      setIsFetchingWeather(false);
      return;
    }
    setWeatherStatus("Getting GPS...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setWeatherStatus("Fetching weather...");
          const weatherRes = await window.APIClient.getWeather(latitude, longitude);
          if (weatherRes.success && weatherRes.data) {
            setBaseTemp(Math.round(weatherRes.data.temperature * 10) / 10);
            setWindSpeed(Math.round(weatherRes.data.windspeed_kmh));
            setWeatherStatus("Live: " + (weatherRes.data.name || "your location"));
          }
        } catch (e) {
          console.error("GPS weather fetch failed", e);
          setWeatherStatus("Failed.");
        }
        setIsFetchingWeather(false);
      },
      async () => {
        // GPS denied — fall back to Dhaka
        setWeatherStatus("GPS denied, loading Dhaka...");
        try {
          const weatherRes = await window.APIClient.getWeather(23.8103, 90.4125);
          if (weatherRes.success && weatherRes.data) {
            setBaseTemp(Math.round(weatherRes.data.temperature * 10) / 10);
            setWindSpeed(Math.round(weatherRes.data.windspeed_kmh));
            setWeatherStatus("Live: Dhaka (fallback)");
          }
        } catch (e) { setWeatherStatus("Weather unavailable."); }
        setIsFetchingWeather(false);
      },
      { timeout: 3000, maximumAge: 60000 }
    );
  }

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>Weather Conditions</div>
            <button 
              onClick={fetchLiveWeather}
              disabled={isFetchingWeather}
              style={{
                padding: "6px 12px", borderRadius: 8, border: `1px solid ${ACCENT.blueBorder}`,
                background: isFetchingWeather ? "var(--bg-input)" : ACCENT.blueBg,
                color: ACCENT.blue, fontSize: 11, fontWeight: 600, cursor: isFetchingWeather ? "wait" : "pointer",
                display: "flex", gap: 6, alignItems: "center"
              }}>
              {isFetchingWeather ? "⏳ Fetching..." : "📡 Auto-Detect (Live)"}
            </button>
          </div>
          {weatherStatus ? (
            <div style={{ fontSize: 10, color: ACCENT.blue, marginBottom: 8, marginTop: -4 }}>
              {weatherStatus}
            </div>
          ) : null}
          <div style={{ background: "var(--bg-input)", padding: 14, borderRadius: 10, border: "1px solid var(--border-primary)", marginBottom: 16 }}>
            <SliderRow label="Base Temperature (Regional)" min={25} max={42} step={0.5} value={baseTemp} onChange={setBaseTemp} unit="°C" color={baseTemp > 35 ? ACCENT.red : ACCENT.amber} />
            <div style={{ marginTop: 12 }}>
              <SliderRow label="Wind Speed" min={0} max={30} step={1} value={windSpeed} onChange={setWindSpeed} unit=" km/h" color={ACCENT.blue} />
            </div>
          </div>

          <SliderRow label="Dispatch Hour" min={0} max={23} step={1} value={hour} onChange={setHour} unit={`:00 ${hour >= 11 && hour < 15 ? '(Peak Solar)' : hour >= 8 && hour < 18 ? '(Daylight)' : '(Night)'}`} color={hour >= 11 && hour < 15 ? ACCENT.red : hour >= 8 && hour < 18 ? ACCENT.amber : ACCENT.green} />

          <div style={{ marginTop: 14 }}>
            <SliderRow
              label="Route Duration"
              min={15} max={240} step={15}
              value={routeDuration}
              onChange={setRouteDuration}
              unit={` min${routeDuration > tst && tst > 0 ? ' ⚠ Exceeds TST!' : ''}`}
              color={routeDuration > tst && tst > 0 ? ACCENT.red : routeDuration > tst * 0.8 && tst > 0 ? ACCENT.amber : ACCENT.green}
            />
          </div>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, marginTop: 16, fontWeight: 500 }}>Delivery Zone (Dhaka)</div>
          
          <div style={{ position: "relative", marginBottom: 8, display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: 9, fontSize: 13 }}>🔍</span>
              <input 
                type="text" 
                placeholder="Search zones..." 
                value={zoneSearch}
                onChange={e => setZoneSearch(e.target.value)}
                style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", fontSize: 13 }}
              />
            </div>
            {speechSupported && (
              <React.Fragment>
                <select 
                  value={speechLang} 
                  onChange={e => setSpeechLang(e.target.value)}
                  style={{
                    padding: "0 8px", borderRadius: 8, border: "1px solid var(--border-primary)",
                    background: "var(--bg-input)", color: "var(--text-secondary)", fontSize: 11, outline: "none"
                  }}
                  title="Override Speech Language"
                >
                  <option value="en-US">EN</option>
                  <option value="bn-BD">BN</option>
                </select>
                <button 
                  onClick={handleListen}
                  title={isListening ? "Listening..." : "Speak location"}
                  style={{
                    width: 40, height: 40, borderRadius: 8, border: `1px solid ${isListening ? ACCENT.red : ACCENT.blueBorder}`,
                    background: isListening ? ACCENT.redBg : "var(--bg-input)",
                    color: isListening ? ACCENT.red : ACCENT.blue,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  {isListening ? "🔴" : "🎤"}
                </button>
              </React.Fragment>
            )}
          </div>
          {speechSupported && isListening && (
            <div style={{ fontSize: 10, color: ACCENT.red, marginBottom: 8, marginTop: -4 }}>
              Listening ({speechLang})... Please speak a zone name.
            </div>
          )}
          {!speechSupported && (
             <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 8, marginTop: -4 }}>
              Microphone not supported in this browser.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16, maxHeight: "160px", overflowY: "auto", paddingRight: 4 }}>
            {filteredZones.map(z => {
              const d = UHI_ZONES[z];
              return (
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
              )
            })}
            {filteredZones.length === 0 && <div style={{ fontSize: 11, color: "var(--text-dim)", gridColumn: "1/-1", padding: 8 }}>No zones match your search.</div>}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Packaging Type</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
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

          <button
            onClick={handleCalculate}
            style={{
              width: "100%", padding: "12px", borderRadius: 10, border: "none",
              background: ACCENT.blue, color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: "pointer", transition: "all 0.2s ease",
              boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)"
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = 0.9}
            onMouseOut={(e) => e.currentTarget.style.opacity = 1}
          >
            📊 Calculate Viability Scores
          </button>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "var(--bg-input)", borderRadius: 12, border: "1px solid var(--border-primary)", padding: "20px 24px" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 16, letterSpacing: "0.06em" }}>VIABILITY SCORES</div>
            <div style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 16 }}>
              {/* DVS Arc */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ background: "var(--bg-primary)", borderRadius: "50%", padding: 10 }}>
                    <CircleArc value={dvs} color={dvsColor} size={120} strokeWidth={12} />
                  </div>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: dvsColor, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{dvs}</div>
                    <div style={{ fontSize: 8, color: "var(--text-dim)", fontWeight: 600, marginTop: 2 }}>/ 100</div>
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: dvsColor }}>DVS</div>
                  <div style={{ fontSize: 9, color: "var(--text-dim)" }}>Delivery Viability</div>
                </div>
              </div>
              {/* Trust Score Arc */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ background: "var(--bg-primary)", borderRadius: "50%", padding: 10 }}>
                    <CircleArc value={trustScore} color={trustColor} size={120} strokeWidth={12} />
                  </div>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: trustColor, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{trustScore}</div>
                    <div style={{ fontSize: 8, color: "var(--text-dim)", fontWeight: 600, marginTop: 2 }}>/ 100</div>
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: trustColor }}>TRUST</div>
                  <div style={{ fontSize: 9, color: "var(--text-dim)" }}>IoT Batch Score</div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
              <div style={{ background: "var(--bg-primary)", padding: "12px 0", borderRadius: 8, textAlign: "center", border: "1px solid var(--border-primary)" }}>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>Thermal Survival</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: tst > routeDuration ? ACCENT.green : ACCENT.red, fontFamily: "'JetBrains Mono', monospace" }}>{tst} min</div>
              </div>
              <div style={{ background: "var(--bg-primary)", padding: "12px 0", borderRadius: 8, textAlign: "center", border: `1px solid ${routeDuration > tst && tst > 0 ? ACCENT.redBorder : "var(--border-primary)"}` }}>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>Route Duration</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: routeDuration > tst && tst > 0 ? ACCENT.red : "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{routeDuration} min</div>
              </div>
            </div>
          </div>

          <div style={{ padding: "20px 24px", background: "var(--bg-input)", borderRadius: 12, border: "1px solid var(--border-primary)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16, letterSpacing: "0.05em" }}>TST FORMULA (MERM)</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--text-primary)", lineHeight: 1.8 }}>
              <div style={{ color: "var(--text-secondary)" }}>TST = (Trust × Insulation)</div>
              <div style={{ color: "var(--text-secondary)", marginLeft: 24 }}>÷ (Hazard × Solar)</div>
              <div style={{ borderBottom: "1px solid var(--border-primary)", margin: "12px 0" }}></div>
              <div>= ({trustScore} × {(packaging==="thermal"?4:packaging==="insulated"?2:1).toFixed(1)})</div>
              <div>÷ ({uhi.hazardMultiplier.toFixed(1)} × {solarFactor.toFixed(1)})</div>
              <div style={{ color: ACCENT.green, fontWeight: 600 }}>≈ {tst} min</div>
            </div>
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

      <DispatchCalendar baseTemp={baseTemp} zone={zone} trustScore={trustScore} windSpeed={windSpeed} routeDuration={routeDuration} />
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

function CircleArc({ value, max = 100, color, size = 140, strokeWidth = 12 }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const dash = circumference * pct;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--gauge-track)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }}
      />
    </svg>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, padding: "0 4px" }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px 0", color: "var(--text-primary)" }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function DashboardView({ onNewBatch }) {
  const stats = [
    { label: "TOTAL BATCHES", value: "142", sub: "9 active", icon: "📦" },
    { label: "CERTIFIED BATCHES", value: "118", sub: "83% certification rate", icon: "🛡️" },
    { label: "AVG TRUST SCORE", value: "82.4", sub: "BARI-certified standard", icon: "📈" },
    { label: "TOTAL WEIGHT", value: "8.6 t", sub: "bio-resources processed", icon: "⚖️" },
    { label: "PLASTIC BOTTLES SAVED", value: "34,560", sub: "via bulk refill model", icon: "♻️" },
    { label: "CO2 SEQUESTERED", value: "2,180 kg", sub: "biochar carbon capture", icon: "🌿" },
    { label: "REVENUE", value: "BDT 12.5L", sub: "this month", icon: "📈" },
    { label: "DVS COMPLIANCE", value: "96.2%", sub: "dispatches within TST", icon: "✅" },
  ];

  const hazardMaps = [
    { zone: "Old Dhaka", hazard: "Extreme", temp: "41.2°C", rh: "74%", desc: "Class A thermal accumulation zone. Narrow concrete corridors trap heat.", time: "11:00 AM – 4:00 PM" },
    { zone: "Mirpur", hazard: "High", temp: "38.7°C", rh: "68%", desc: "Dense residential concrete with limited canopy cover.", time: "12:00 PM – 3:00 PM" },
    { zone: "Savar", hazard: "Moderate", temp: "36.1°C", rh: "62%", desc: "Mixed urban with partial green canopy. Moderate risk window.", time: "1:00 PM – 3:00 PM" },
    { zone: "Gulshan", hazard: "Safe", temp: "34.2°C", rh: "58%", desc: "High green canopy coverage and lake proximity reduce thermal load.", time: "N/A" }
  ];

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
      <PageHeader 
        title="Operations Dashboard" 
        subtitle="Bangladesh Climate-Resilient Circular Commerce" 
        action={
          <button onClick={onNewBatch} style={{
            background: ACCENT.greenDark, color: "#fff", border: "none", padding: "10px 18px",
            borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", gap: 6, alignItems: "center"
          }}><span>+</span> New Batch</button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <Card key={i} style={{ padding: "20px 24px" }} hover={false}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.05em" }}>{s.label}</div>
              <div style={{ background: "var(--bg-input)", padding: 6, borderRadius: "50%", fontSize: 12 }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        <Card hover={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Dhaka Thermal Hazard Map</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Live MERM Classification</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {hazardMaps.map(m => {
              const hColor = m.hazard === "Extreme" ? ACCENT.red : m.hazard === "High" ? ACCENT.amber : m.hazard === "Moderate" ? ACCENT.amber : ACCENT.green;
              return (
                <div key={m.zone} style={{ border: "1px solid var(--border-primary)", borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: hColor }}></span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{m.zone}</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: hColor+"15", color: hColor, fontWeight: 600 }}>{m.hazard}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.temp} · {m.rh}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>{m.desc}</div>
                  {m.time !== "N/A" && <div style={{ fontSize: 12, color: ACCENT.amber }}>Peak: {m.time}</div>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card hover={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Recent Activity</div>
            <a href="#" style={{ fontSize: 13, color: ACCENT.green, textDecoration: "none", fontWeight: 500 }}>View all →</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { icon: "🛡️", text: "Batch ECO-2025-142 certified — Trust Score 91", time: "2 min ago", bg: ACCENT.greenBg },
              { icon: "📈", text: "DVS simulation for Old Dhaka route — Score 63 (Caution)", time: "18 min ago", bg: ACCENT.amberBg },
              { icon: "🚚", text: "Batch ECO-2025-140 dispatched to Mirpur", time: "1 hr ago", bg: ACCENT.greenBg },
              { icon: "⚠️", text: "High thermal hazard in Old Dhaka — delay dispatches until 5 PM", time: "2 hr ago", bg: ACCENT.redBg },
              { icon: "📦", text: "New biochar batch ECO-2025-141 created (180 kg)", time: "3 hr ago", bg: ACCENT.blueBg },
            ].map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{a.icon}</div>
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.4 }}>{a.text}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BatchRegistry({ onNewBatch }) {
  const [activeTab, setActiveTab] = useState("All");
  const tabs = ["All", "Pending", "Certified", "Dispatched", "Delivered"];
  const batches = [
    { id: "BCH-142", product: "Bio-Slurry", status: "Certified", trust: 91, dvs: null, dest: "—", weight: 180 },
    { id: "BCH-141", product: "Biochar", status: "Active", trust: 85, dvs: null, dest: "—", weight: 100 }
  ];

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
      <PageHeader title="Batch Registry" subtitle="All bio-resource batches with certification status" action={
        <button onClick={onNewBatch} style={{
          background: ACCENT.greenDark, color: "#fff", border: "none", padding: "10px 18px",
          borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", gap: 6, alignItems: "center"
        }}><span>+</span> New Batch</button>
      } />
      
      <div style={{ display: "flex", gap: 4, background: "var(--bg-input)", padding: 4, borderRadius: 8, width: "max-content", marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "8px 18px", borderRadius: 6, border: "none", fontSize: 13, cursor: "pointer",
            background: activeTab === t ? "var(--bg-card)" : "transparent",
            color: activeTab === t ? "var(--text-primary)" : "var(--text-secondary)",
            boxShadow: activeTab === t ? "var(--shadow-card)" : "none", fontWeight: activeTab === t ? 600 : 400
          }}>{t}</button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }} hover={false}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-input)" }}>
              {["BATCH", "PRODUCT", "STATUS", "TRUST SCORE", "DVS SCORE", "DESTINATION", "WEIGHT"].map(h => (
                <th key={h} style={{ padding: "14px 24px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{h}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-primary)", cursor: "pointer", transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--bg-input)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <td style={{ padding: "18px 24px", fontSize: 13, fontWeight: 500 }}>{b.id}</td>
                <td style={{ padding: "18px 24px", fontSize: 13, color: "var(--text-secondary)" }}>{b.product}</td>
                <td style={{ padding: "18px 24px" }}>
                  <span style={{ border: `1px solid ${b.status==="Certified"?ACCENT.greenBorder:"var(--border-primary)"}`, color: b.status==="Certified"?ACCENT.green:"var(--text-secondary)", padding: "4px 12px", borderRadius: 20, fontSize: 11, background: b.status==="Certified"?ACCENT.greenBg:"transparent", fontWeight: 600 }}>
                    {b.status}
                  </span>
                </td>
                <td style={{ padding: "18px 24px", fontSize: 13, color: ACCENT.green, fontWeight: 600 }}>{b.trust ? `🛡️ ${b.trust}` : "—"}</td>
                <td style={{ padding: "18px 24px", fontSize: 13, color: "var(--text-secondary)" }}>{b.dvs || "—"}</td>
                <td style={{ padding: "18px 24px", fontSize: 13, color: "var(--text-secondary)" }}>{b.dest}</td>
                <td style={{ padding: "18px 24px", fontSize: 13, color: "var(--text-secondary)" }}>{b.weight} kg</td>
                <td style={{ padding: "18px 24px", color: "var(--text-muted)", fontSize: 16 }}>›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function RegisterBatch({ onCancel }) {
  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, marginBottom: 24, display: "flex", gap: 8, alignItems: "center", padding: 0 }}>
        <span>←</span> Back to Batches
      </button>
      <PageHeader title="Register New Batch" subtitle="Submit a new bio-resource batch for certification" />
      
      <Card style={{ maxWidth: 700 }} hover={false}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Product Name</label>
            <input type="text" placeholder="e.g. Premium Bio-Slurry Concentrate" style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Product Type</label>
              <select style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}>
                <option>Bio-Slurry</option>
                <option>Biochar</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Weight (kg)</label>
              <input type="number" defaultValue="100" style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Packaging Type</label>
              <select style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}>
                <option>Standard</option>
                <option>Insulated</option>
                <option>Thermal Bin</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Destination Zone</label>
              <select style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}>
                <option>Select zone</option>
                {Object.keys(UHI_ZONES).map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
          </div>
          
          <div style={{ background: ACCENT.greenBg, padding: "20px", borderRadius: 8, border: `1px solid ${ACCENT.greenBorder}` }}>
            <div style={{ color: ACCENT.green, fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Next: IoT Certification</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>After creating your batch, submit IoT sensor readings to generate a BARI-compliant Trust Score and cryptographic QR certificate.</div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onCancel} style={{ padding: "12px 24px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500, fontSize: 14 }}>Cancel</button>
            <button onClick={onCancel} style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: ACCENT.greenDark, color: "#fff", cursor: "pointer", fontWeight: 500, fontSize: 14 }}>Create Batch</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

const MOCK_PRODUCTS = [
  { id: 1, name: "Premium Bio-Slurry", category: "Agriculture", price: "৳ 450", unit: "L", seller: "Green Refineries Ltd.", dvs: 85, icon: "🌱", badge: "BARI Certified" },
  { id: 2, name: "Thermal-Safe EM-1", category: "Agriculture", price: "৳ 320", unit: "Kg", seller: "Agro Eco SME", dvs: 78, icon: "🌾", badge: null },
  { id: 3, name: "Insulin (Lantus 10ml)", category: "Pharmaceuticals", price: "৳ 1,250", unit: "Vial", seller: "PharmaCare BD", dvs: 94, icon: "⚕️", badge: "Cold-Chain verified" },
  { id: 4, name: "Polio Vaccine (OPV)", category: "Pharmaceuticals", price: "৳ 4,800", unit: "Box", seller: "Health Line Inc.", dvs: 98, icon: "💉", badge: "Critical Priority" },
  { id: 5, name: "Fresh Dairy Milk", category: "Food & Dairy", price: "৳ 90", unit: "L", seller: "Aarong Dairy", dvs: 82, icon: "🥛", badge: null },
  { id: 6, name: "Premium Hilsha Fish", category: "Food & Seafood", price: "৳ 1,500", unit: "Kg", seller: "Padma Catch", dvs: 70, icon: "🐟", badge: null },
  { id: 7, name: "Carbon-Neutral Biochar", category: "Agriculture", price: "৳ 150", unit: "Kg", seller: "SME Co-op", dvs: 92, icon: "🌿", badge: null },
  { id: 8, name: "Temperature Reagents", category: "Chemicals", price: "৳ 3,500", unit: "Pack", seller: "ChemLab BD", dvs: 88, icon: "🧪", badge: "Hazard Risk" },
];


function ChatbotView() {
  const [messages, setMessages] = useState([
    { role: "system", content: "Hello! I am EcoSortha AI, your voice and text-based assistant. I can provide microclimate forecasts, smart dispatch suggestions, or analyze files and context. How can I help you today?", time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechLang, setSpeechLang] = useState("en-US");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSpeechSupported(false);
    } else {
      const locale = (navigator.languages && navigator.languages[0]) || navigator.language || "en-US";
      if (locale.toLowerCase().startsWith("bn")) {
        setSpeechLang("bn-BD");
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const data = await res.json();
            if (data.countryCode === "BD") {
              setSpeechLang("bn-BD");
            } else if (!locale.toLowerCase().startsWith("bn")) {
              setSpeechLang("en-US");
            }
          } catch (e) {
            console.error("Failed to detect language from location", e);
          }
        },
        () => console.warn("Geolocation denied/failed. Defaulting to en-US.")
      );
    }
  }, []);

  const handleSend = (text, attachedFileName = null) => {
    if (!text.trim() && !attachedFileName) return;
    const newMsg = { 
      role: "user", 
      content: text, 
      attachment: attachedFileName,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    
    // Call actual backend API
    const fetchReply = async () => {
      try {
        const response = await window.APIClient.chat(text);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: response.reply || "I couldn't generate a response.",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      } catch (error) {
        console.error("Chat API error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: "Sorry, I am having trouble connecting to the AI server.",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      }
    };
    
    fetchReply();
  };

  const handleVoice = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    setVoiceError("");

    try {
      startSpeechRecognition(speechLang);
    } catch (error) {
      console.error("Speech recognition start error", error);
      setVoiceError("Microphone access is blocked. Check Safari site permissions for this page.");
      setIsRecording(false);
    }
  };

  const startSpeechRecognition = (lang) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceError("Safari blocked speech input. Re-enable microphone and speech permissions for this site.");
      } else {
        setVoiceError(`Voice input failed: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleSend("Please analyze this document context.", file.name);
    }
    // reset input
    e.target.value = null;
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease", height: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
      <PageHeader title="EcoSortha AI Assistant" subtitle="Voice, Text & Context-Aware Microclimate Chatbot" />
      
      <Card hover={false} style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        
        {/* Chat History */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "70%",
                padding: "12px 18px",
                borderRadius: m.role === "user" ? "18px 18px 0 18px" : "18px 18px 18px 0",
                background: m.role === "user" ? ACCENT.greenDark : "var(--bg-input)",
                color: m.role === "user" ? "#fff" : "var(--text-primary)",
                border: m.role === "user" ? "none" : "1px solid var(--border-primary)",
                fontSize: 14, lineHeight: 1.5
              }}>
                {m.attachment && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                    background: "rgba(255,255,255,0.15)", borderRadius: 8, marginBottom: 8,
                    fontSize: 12, fontWeight: 600
                  }}>
                    <span>📎</span> {m.attachment}
                  </div>
                )}
                {m.content}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6, padding: "0 4px" }}>
                {m.role === "user" ? "You" : "EcoSortha AI"} • {m.time}
              </div>
            </div>
          ))}
          {isRecording && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", background: "var(--bg-input)", borderRadius: "18px 18px 18px 0", width: "fit-content", border: "1px solid var(--border-primary)" }}>
              <div style={{ width: 8, height: 8, background: ACCENT.red, borderRadius: "50%", animation: "breathe 1s infinite" }}></div>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Listening ({speechLang})...</span>
            </div>
          )}
          {!speechSupported && (
            <div style={{ padding: "12px 18px", fontSize: 12, color: ACCENT.amber, background: "var(--bg-input)", borderRadius: "18px 18px 18px 0", width: "fit-content", border: `1px solid ${ACCENT.amberBorder}` }}>
              Microphone not supported in this browser.
            </div>
          )}
          {voiceError && (
            <div style={{ padding: "12px 18px", fontSize: 12, color: ACCENT.red, background: "var(--bg-input)", borderRadius: "18px 18px 18px 0", width: "fit-content", border: `1px solid ${ACCENT.redBorder}` }}>
              {voiceError}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ padding: "12px 24px", display: "flex", gap: 12, borderTop: "1px solid var(--border-primary)", background: "var(--bg-input)" }}>
          {["Climate Forecast", "Dispatch Suggestions", "Submit Feedback"].map(action => (
            <button key={action} onClick={() => handleSend(`Show me ${action.toLowerCase()}`)} style={{
              padding: "6px 14px", borderRadius: 20, background: "var(--bg-primary)", border: `1px solid ${ACCENT.greenBorder}`,
              color: ACCENT.green, fontSize: 12, cursor: "pointer", fontWeight: 500, transition: "background 0.2s"
            }} onMouseEnter={e => e.currentTarget.style.background=ACCENT.greenBg} onMouseLeave={e => e.currentTarget.style.background="var(--bg-primary)"}>
              {action}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div style={{ padding: "16px 24px", display: "flex", gap: 12, alignItems: "center", background: "var(--bg-secondary)" }}>
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{
            width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "var(--bg-input)", color: "var(--text-secondary)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            transition: "all 0.3s ease", position: "relative"
          }} title="Attach file or context">
            📎
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              style={{ display: "none" }} 
            />
          </button>
          {speechSupported && (
            <React.Fragment>
              <select 
                value={speechLang} 
                onChange={e => setSpeechLang(e.target.value)}
                style={{
                  padding: "0 10px", borderRadius: 24, border: "1px solid var(--border-primary)",
                  background: "var(--bg-input)", color: "var(--text-secondary)", fontSize: 12, outline: "none", height: 44
                }}
                title="Language"
              >
                <option value="en-US">EN</option>
                <option value="bn-BD">BN</option>
              </select>
              <button onClick={handleVoice} disabled={isRecording} style={{
                width: 44, height: 44, borderRadius: "50%", border: "none", cursor: isRecording ? "not-allowed" : "pointer",
                background: isRecording ? ACCENT.redBg : "var(--bg-input)",
                color: isRecording ? ACCENT.red : "var(--text-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                transition: "all 0.3s ease", opacity: isRecording ? 0.8 : 1
              }} title="Voice Input">
                🎙️
              </button>
            </React.Fragment>
          )}
          <input 
            type="text" 
            placeholder="Type your message..." 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend(input)}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 24, border: "1px solid var(--border-primary)",
              background: "var(--bg-input)", color: "var(--text-primary)", outline: "none", fontSize: 14
            }}
          />
          <button onClick={() => handleSend(input)} style={{
            width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
            background: ACCENT.greenDark, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
          }}>
            ↑
          </button>
        </div>
      </Card>
    </div>
  );
}

function MarketplaceView() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [minDvs, setMinDvs] = useState(0);

  const categories = ["All", "Agriculture", "Pharmaceuticals", "Food & Dairy", "Food & Seafood", "Chemicals"];

  const filteredProducts = MOCK_PRODUCTS.filter(p => {
    if (category !== "All" && p.category !== category) return false;
    if (p.dvs < minDvs) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.seller.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease", position: "relative" }}>
      <PageHeader title="Climate-Resilient Marketplace" subtitle="Source verified heat-sensitive products optimized for DVS delivery" />
      
      {/* Filters Bar */}
      <Card style={{ padding: "16px 24px", marginBottom: 24 }} hover={false}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 250px", position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: 12, fontSize: 16 }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search products or sellers..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "12px 16px 12px 42px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", fontSize: 14 }}
            />
          </div>
          
          <div style={{ flex: "0 0 180px" }}>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", fontSize: 14, cursor: "pointer" }}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ flex: "0 0 200px" }}>
            <select value={minDvs} onChange={e => setMinDvs(Number(e.target.value))} style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", fontSize: 14, cursor: "pointer" }}>
              <option value={0}>Any DVS Score</option>
              <option value={75}>DVS 75+ (High Reliability)</option>
              <option value={90}>DVS 90+ (Critical Transit)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Product Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginBottom: 80 }}>
        {filteredProducts.map(p => (
          <Card key={p.id} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            {p.badge && (
              <div style={{ position: "absolute", top: 16, right: 16, background: p.badge.includes("Critical") ? ACCENT.redBg : ACCENT.blueBg, color: p.badge.includes("Critical") ? ACCENT.red : ACCENT.blue, padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", border: `1px solid ${p.badge.includes("Critical") ? ACCENT.redBorder : "var(--border-primary)"}` }}>
                {p.badge.toUpperCase()}
              </div>
            )}
            
            <div style={{ fontSize: 36, marginBottom: 16 }}>{p.icon}</div>
            
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{p.category}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>{p.seller}</div>
            
            <div style={{ marginTop: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border-primary)" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{p.price}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>per {p.unit}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: p.dvs >= 90 ? ACCENT.green : p.dvs >= 75 ? ACCENT.blue : ACCENT.amber, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{p.dvs}</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, fontWeight: 600 }}>DVS SCORE</div>
                </div>
              </div>
              
              <button style={{ width: "100%", padding: "10px 0", background: "var(--bg-input)", border: "1px solid var(--border-primary)", borderRadius: 8, color: "var(--text-primary)", fontWeight: 600, cursor: "pointer", fontSize: 13, transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = ACCENT.greenBg}
                      onMouseLeave={e => e.currentTarget.style.background = "var(--bg-input)"}>
                Add to Cart
              </button>
            </div>
          </Card>
        ))}
        {filteredProducts.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: 60, textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>No products match your filters.</div>
          </div>
        )}
      </div>
    </div>
  );
}


const TABS = [
  { label: "Overall Dashboard", icon: "⊞" },
  { label: "Batches", icon: "📦" },
  { label: "Batch Verification", icon: "📡" },
  { label: "Microclimate Intelligence", icon: "🌡️" },
  { label: "Climate Demand", icon: "📊" },
  { label: "Impact & ESG", icon: "🌱" },
  { label: "Marketplace", icon: "🛒" },
  { label: "Chatbot", icon: "💬" }
];

function EcoSorthaApp() {
  const [tab, setTab] = useState(0);
  const [trustScore, setTrustScore] = useState(84);
  const [isRegisteringBatch, setIsRegisteringBatch] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [dvs, setDvs] = useState(() => {
    const adjustedTemp = calcAdjustedTemp(31, "Mirpur", 12, 8);
    return calcDVS(84, adjustedTemp);
  });

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
          {/* New SME Dropdown */}
          <div style={{ marginLeft: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            <span style={{ fontSize: 18 }}>⭐</span>
            <select style={{
              background: "transparent", color: "var(--text-primary)", border: "none",
              outline: "none", cursor: "pointer", fontSize: 14, fontWeight: 500
            }}>
              <option>Green Refineries Ltd. (SME)</option>
              <option>Agro Eco SME</option>
            </select>
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
      <main style={{ padding: "32px 48px", width: "100%", margin: "0 auto" }}>
        {tab === 0 && <DashboardView onNewBatch={() => { setTab(1); setIsRegisteringBatch(true); }} />}
        
        {tab === 1 && (
          isRegisteringBatch 
            ? <RegisterBatch onCancel={() => setIsRegisteringBatch(false)} />
            : <BatchRegistry onNewBatch={() => setIsRegisteringBatch(true)} />
        )}

        {tab === 2 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, animation: "fadeSlideIn 0.4s ease" }}>
            <div>
              <SectionLabel icon="📡" text="Batch Sensor Verification" />
              <Card>
                <IoTForm onResult={setTrustScore} />
              </Card>
            </div>
            <div>
              <SectionLabel icon="🛡️" text="Certification Pipeline" />
              <Card>
                <div style={{ textAlign: "center", padding: "12px 0 24px 0" }}>
                  <ScoreGauge value={trustScore} label="Global Trust Score" size={160} />
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, textAlign: "center", marginTop: 12 }}>
                  Adjust IoT parameters on the left to simulate a batch. A score of 60+ is required for BARI certification and cryptographic signing.
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === 3 && (
          <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
            <SectionLabel icon="🌡️" text="Delivery Viability Simulator" />
            <Card>
              <MicroclimateSimulator trustScore={trustScore} dvs={dvs} setDvs={setDvs} />
            </Card>
          </div>
        )}

        {tab === 4 && (
          <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
            <SectionLabel icon="📊" text="Market Intelligence" />
            <Card>
              <DemandChart />
            </Card>
          </div>
        )}

        {tab === 5 && (
          <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
            <SectionLabel icon="🌱" text="ESG Ledger" />
            <ESGCard trustScore={trustScore} dvs={dvs} />
          </div>
        )}

        {tab === 6 && <MarketplaceView />}
        {tab === 7 && <ChatbotView />}
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

window.EcoSorthaApp = EcoSorthaApp;

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<EcoSorthaApp />);
  
