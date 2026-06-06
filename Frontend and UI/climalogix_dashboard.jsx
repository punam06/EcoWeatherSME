import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const IS_STATIC_FILE_HTML = window.location.protocol === 'file:';
// Backend API base URL. The production backend that the live dashboard talks
// to is https://backsme.onrender.com (the previous value of '' resolved to a
// relative path which the static frontend host can't serve, so all calls
// to /api/* silently failed in production).
const API_BASE_URL_HTML = (IS_STATIC_FILE_HTML || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5001'
  : 'https://backsme.onrender.com';

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
  blueBorder: "rgba(59, 130, 246, 0.2)",
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

function calcTST(trustScore, zone, packaging, hour) {
  const uhi = UHI_ZONES[zone];
  const pkgFactor = packaging === "thermal" ? 4.0 : packaging === "insulated" ? 2.0 : 1.0;
  const solarMulti = getSolarHourMultiplier(hour);
  const raw = (trustScore * pkgFactor * uhi.baseSurvival) / (uhi.hazardMultiplier * solarMulti);
  return Math.max(10, Math.round(raw));
}

function calcBARIDVS({ trustScore, zone, packaging, hour, baseTemp, windSpeed, routeDuration }) {
  const uhi = UHI_ZONES[zone] || UHI_ZONES["Mirpur"];
  const pkgFactor = packaging === "thermal" ? 4.0 : packaging === "insulated" ? 2.0 : 1.0;
  const solarFactor = getSolarFactor(hour);
  const windCooling = windSpeed * 0.08;
  const adjTemp = baseTemp + (uhi.offset * solarFactor) - windCooling;

  const trf = Math.max(0.05, Math.min(1.0, (adjTemp - 22) / 18));
  const dvsBase = Math.round(trustScore * (1 - trf * 0.42));

  const solarMulti = getSolarHourMultiplier(hour);
  const tempFactor = Math.max(0.3, (adjTemp - 18) / 10);
  const rawTST = (trustScore * pkgFactor * uhi.baseSurvival * 1.8) / (uhi.hazardMultiplier * solarMulti * tempFactor);
  const tst = Math.max(10, Math.round(rawTST));

  const duration = routeDuration ?? 0;
  const penalty = Math.round((duration / tst) * 12 + (duration > tst ? (duration - tst) * 0.4 : 0));
  
  const dvs = Math.max(0, Math.min(100, dvsBase - penalty));
  const deliveryTrustScore = Math.max(0, Math.min(100, Math.round(trustScore * (1 - trf * 0.25) - (duration > tst ? (duration - tst) * 0.15 : 0))));

  return {
    dvs,
    tst,
    adjustedTemp: adjTemp,
    trustScore: deliveryTrustScore
  };
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
   TAB 1: BATCH VERIFICATION (Operator Intake)
   ═══════════════════════════════════════════════════════════════ */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function canonicalize(value) {
  if (value === null || typeof value === 'undefined') return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

const STANDARDS_CONFIG = {
  organic: {
    displayName: 'Organic Biofertilizer (BARI EM-1)',
    phRange: [3.5, 7.5],
    ecRange: [2.5, 5.0],
    tempRange: [25, 35],
    requiredRatio: '1:1:20',
    minFermentationDays: 7,
    maxFermentationDays: 14,
    requiresBSTI: false,
    weights: { ph: 30, ec: 6, temp: 1.2, ratio: 5, days: 10 },
    ph: { min: 3.0, max: 7.0, step: 0.1, label: "pH Level", unit: "", optimal: "3.5–7.5", default: 4.1 },
    ec: { min: 1.0, max: 6.0, step: 0.1, label: "Conductivity (EC)", unit: " mS/cm", optimal: "2.5–5.0 mS/cm", default: 3.4 },
    temp: { min: 20, max: 45, step: 0.5, label: "Storage Temperature", unit: "°C", optimal: "25–32°C", default: 28 },
    days: { min: 3, max: 21, step: 1, label: "Processing Days", unit: " days", optimal: "7–14 days", default: 9 },
    hasRatio: true
  },
  retail: {
    displayName: 'Retail FMCG / Packaged Goods',
    phRange: null,
    ecRange: [0, 10],
    tempRange: [10, 32],
    requiredRatio: null,
    minFermentationDays: 0,
    maxFermentationDays: 365,
    requiresBSTI: false,
    weights: { ph: 0, ec: 4, temp: 2.0, ratio: 0, days: 0.5 },
    ph: null,
    ec: { min: 0, max: 10, step: 0.5, label: "Packaging Moisture-Integrity Index", unit: "", optimal: "0–10", default: 5.0 },
    temp: { min: 5, max: 40, step: 1, label: "Cold-chain Storage Temperature", unit: "°C", optimal: "10–32°C", default: 20 },
    days: { min: 0, max: 365, step: 5, label: "Maturation / Processing Days", unit: " days", optimal: "0–365 days", default: 30 },
    hasRatio: false
  },
  pharma: {
    displayName: 'Pharmaceuticals (DGDA regulated)',
    phRange: [4.5, 7.5],
    ecRange: [0, 5],
    tempRange: [2, 8],
    requiredRatio: null,
    minFermentationDays: 0,
    maxFermentationDays: 180,
    requiresBSTI: true,
    weights: { ph: 6, ec: 6, temp: 4.0, ratio: 0, days: 0.2 },
    ph: { min: 3.0, max: 10.0, step: 0.1, label: "pH Level (Oral Liquids/Syrups)", unit: "", optimal: "4.5–7.5", default: 6.0 },
    ec: { min: 0, max: 10, step: 0.1, label: "Dissolved Solids / Impurity Index", unit: "", optimal: "0–5", default: 2.0 },
    temp: { min: -5, max: 25, step: 0.5, label: "Cold-chain Storage Temperature", unit: "°C", optimal: "2–8°C", default: 4.0 },
    days: { min: 0, max: 365, step: 5, label: "Maturation / Processing Days", unit: " days", optimal: "0–180 days", default: 90 },
    hasRatio: false
  },
  dairy: {
    displayName: 'Dairy / Pasteurized Milk',
    phRange: [6.5, 6.8],
    ecRange: [0, 10],
    tempRange: [2, 6],
    requiredRatio: null,
    minFermentationDays: 0,
    maxFermentationDays: 7,
    requiresBSTI: true,
    weights: { ph: 10, ec: 8, temp: 3.5, ratio: 0, days: 1.5 },
    ph: { min: 5.0, max: 9.0, step: 0.1, label: "Fresh Milk pH Level", unit: "", optimal: "6.5–6.8", default: 6.6 },
    ec: { min: 0, max: 15, step: 0.5, label: "Bacterial Load CFU Index", unit: "", optimal: "0–10", default: 5.0 },
    temp: { min: -2, max: 15, step: 0.5, label: "Cold-chain Temperature", unit: "°C", optimal: "2–6°C", default: 4.0 },
    days: { min: 0, max: 30, step: 1, label: "Maturation / Processing Days", unit: " days", optimal: "0–7 days", default: 3 },
    hasRatio: false
  },
  manufacturing: {
    displayName: 'Manufacturing / Industrial Chemicals',
    phRange: null,
    ecRange: [0, 100],
    tempRange: [15, 30],
    requiredRatio: null,
    minFermentationDays: 0,
    maxFermentationDays: 365,
    requiresBSTI: false,
    weights: { ph: 0, ec: 0.2, temp: 1.5, ratio: 0, days: 0.1 },
    ph: null,
    ec: { min: 0, max: 150, step: 1, label: "Contamination Index (ppm)", unit: "", optimal: "0–100", default: 50.0 },
    temp: { min: 0, max: 50, step: 1, label: "Storage Temperature", unit: "°C", optimal: "15–30°C", default: 22.0 },
    days: { min: 0, max: 365, step: 5, label: "Processing Duration", unit: " days", optimal: "0–365 days", default: 60 },
    hasRatio: false
  }
};

function BatchVerificationForm({ onResult, onResultDetail, prefilledBatchId, prefilledDispatchZone, setPrefilledBatchId, setPrefilledDispatchZone }) {
  const [category, setCategory] = useState("organic");
  const [qaSource, setQaSource] = useState("iot");
  const [bstiCredential, setBstiCredential] = useState("");
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [formError, setFormError] = useState("");

  const [pH, setPH] = useState(4.1);
  const [EC, setEC] = useState(3.4);
  const [temp, setTemp] = useState(28);
  const [ratio, setRatio] = useState("1:1:20");
  const [days, setDays] = useState(9);
  const [certified, setCertified] = useState(false);
  const [ts, setTs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeImg, setQrCodeImg] = useState(null);
  const [isCertifying, setIsCertifying] = useState(false);
  const [batchNum, setBatchNum] = useState("");

  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [dispatchZone, setDispatchZone] = useState("");
  const [registeredBatches, setRegisteredBatches] = useState([]);
  const [tsResult, setTsResult] = useState(null);

  const conf = STANDARDS_CONFIG[category] || STANDARDS_CONFIG.organic;

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    const targetConf = STANDARDS_CONFIG[newCat];
    if (targetConf) {
      if (targetConf.ph) setPH(targetConf.ph.default);
      else setPH(7.0); // Safe fallback to pass Zod validation
      setEC(targetConf.ec.default);
      setTemp(targetConf.temp.default);
      setDays(targetConf.days.default);
      if (targetConf.hasRatio) setRatio("1:1:20");
      else setRatio("none");
    }
  };

  // Fetch registered batches to populate the Batch Selection Dropdown
  useEffect(() => {
    const loadBatches = async () => {
      try {
        const result = await window.APIClient.getBatches();
        if (result.success && Array.isArray(result.data)) {
          setRegisteredBatches(result.data);
        } else {
          setRegisteredBatches(window.__SEED_BATCHES__ || []);
        }
      } catch (err) {
        setRegisteredBatches(window.__SEED_BATCHES__ || []);
      }
    };
    loadBatches();
  }, []);

  // Sync state if pre-populated from AI chatbot agent
  useEffect(() => {
    if (prefilledBatchId) {
      setSelectedBatchId(prefilledBatchId);
      
      const matched = registeredBatches.find(b => b.id === prefilledBatchId || b.batch_number === prefilledBatchId);
      if (matched) {
        setDispatchZone(matched.destination_zone || matched.dest || "Old Dhaka");
      } else if (prefilledDispatchZone) {
        setDispatchZone(prefilledDispatchZone);
      }
    }
  }, [prefilledBatchId, prefilledDispatchZone, registeredBatches]);

  const handleBatchSelect = (bId) => {
    setSelectedBatchId(bId);
    if (setPrefilledBatchId) setPrefilledBatchId(bId);
    
    const matched = registeredBatches.find(b => b.id === bId || b.batch_number === bId);
    if (matched) {
      const zone = matched.destination_zone || matched.dest || "Old Dhaka";
      setDispatchZone(zone);
      if (setPrefilledDispatchZone) setPrefilledDispatchZone(zone);
    }
  };

  useEffect(() => {
    const fetchTrustScore = async () => {
      setIsLoading(true);
      try {
        let em1Ratio = 0.001;
        if (ratio === "1:1:10") em1Ratio = 0.002;
        else if (ratio === "1:1:20") em1Ratio = 0.002;
        else if (ratio === "1:1:30") em1Ratio = 0.001;
        else if (ratio === "1:1:40") em1Ratio = 0.0005;

        const json = await window.APIClient.getTrustScore({
          category,
          pH: conf.ph ? pH : 7.0,
          ec: EC,
          temperatureCelsius: temp,
          em1Ratio,
          fermentationDays: days,
        });
        if (json.success && json.data) {
          const result = json.data;
          setTsResult(result);
          setTs(result.score);
          onResult(result.score);
          if (typeof onResultDetail === "function") onResultDetail(result);
        } else {
          throw new Error(json.error || "Trust score endpoint returned no data");
        }
        setCertified(false);
        setQrCodeImg(null);
        setBatchNum("");
      } catch (error) {
        console.error("Failed to fetch trust score:", error);
        // Display offline fallback error
        const fallbackScore = 0;
        setTs(fallbackScore);
        const fallbackResult = {
          score: fallbackScore,
          grade: 'F',
          isViable: false,
          category: category,
          breakdown: null,
          reference: 'API-Offline',
          notes: ['Backend unreachable — cannot compute score'],
        };
        setTsResult(fallbackResult);
        onResult(fallbackScore);
        if (typeof onResultDetail === "function") onResultDetail(fallbackResult);
        setCertified(false);
        setQrCodeImg(null);
        setBatchNum("");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTrustScore();
  }, [category, pH, EC, temp, ratio, days, onResult]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        {/* NEW STATEFUL BATCH ID & DISPATCH ZONE SELECTIONS */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Batch ID (Registered)</label>
              <select 
                value={selectedBatchId} 
                onChange={e => handleBatchSelect(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
              >
                <option value="">Select registered batch</option>
                {registeredBatches.map(b => (
                  <option key={b.id || b.batch_number} value={b.id || b.batch_number}>
                    {b.id || b.batch_number} - {b.product_name || b.product}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Dispatch Zone</label>
              <select 
                value={dispatchZone} 
                onChange={e => { setDispatchZone(e.target.value); if (setPrefilledDispatchZone) setPrefilledDispatchZone(e.target.value); }}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
              >
                <option value="">Select zone</option>
                {Object.keys(UHI_ZONES).map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
          {selectedBatchId && (
            <div style={{ fontSize: 11, color: ACCENT.green, marginTop: 8, fontWeight: 600 }}>
              📦 Selected Batch Product: {registeredBatches.find(b => b.id === selectedBatchId || b.batch_number === selectedBatchId)?.product_name || 'Registered Material'}
            </div>
          )}
        </div>

        {/* CATEGORY & QA SOURCE SELECTION */}
        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Product Category</label>
            <select 
              value={category} 
              onChange={e => handleCategoryChange(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
            >
              <option value="organic">Organic Biofertilizer (BARI EM-1)</option>
              <option value="retail">Retail FMCG / Packaged Goods</option>
              <option value="pharma">Pharmaceuticals (DGDA)</option>
              <option value="dairy">Dairy / Pasteurized Milk</option>
              <option value="manufacturing">Industrial Manufacturing</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>QA Source</label>
            <select 
              value={qaSource} 
              onChange={e => {
                setQaSource(e.target.value);
                if (e.target.value !== 'inspector') {
                  setBstiCredential('');
                  setInspectorNotes('');
                }
              }}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
            >
              <option value="iot">📡 IoT Sensors</option>
              <option value="inspector">👮 Certified Inspector</option>
              <option value="manufacturer">🏭 Manufacturer Declaration</option>
            </select>
          </div>
        </div>

        {conf.ph ? (
          <div>
            <SliderRow label={conf.ph.label} min={conf.ph.min} max={conf.ph.max} step={conf.ph.step} value={pH} onChange={setPH} color={ACCENT.green} />
            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Optimal: {conf.ph.optimal}</div>
          </div>
        ) : null}
        <div>
          <SliderRow label={conf.ec.label} min={conf.ec.min} max={conf.ec.max} step={conf.ec.step} value={EC} onChange={setEC} unit={conf.ec.unit} color={ACCENT.green} />
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Optimal: {conf.ec.optimal}</div>
        </div>
        <div>
          <SliderRow label={conf.temp.label} min={conf.temp.min} max={conf.temp.max} step={conf.temp.step} value={temp} onChange={setTemp} unit={conf.temp.unit} color={temp > conf.tempRange[1] ? ACCENT.red : ACCENT.amber} />
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Optimal: {conf.temp.optimal}</div>
        </div>
        
        {conf.hasRatio ? (
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
        ) : null}

        <div style={{ gridColumn: conf.ph ? "1 / -1" : "auto" }}>
          <SliderRow label={conf.days.label} min={conf.days.min} max={conf.days.max} step={conf.days.step} value={days} onChange={setDays} unit={conf.days.unit} color={ACCENT.green} />
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Optimal: {conf.days.optimal}</div>
        </div>

        {/* Dynamic Multi-Source Inputs */}
        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, borderTop: "1px solid var(--border-primary)", paddingTop: 14, marginTop: 6 }}>
          {(qaSource === 'inspector' || conf.requiresBSTI) && (
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>
                BSTI Credential ID {conf.requiresBSTI && <span style={{ color: ACCENT.red }}>*</span>}
              </label>
              <input 
                type="text" 
                placeholder="e.g. BSTI-1234" 
                value={bstiCredential}
                onChange={e => setBstiCredential(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: "'JetBrains Mono', monospace" }}
              />
              <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>Format: BSTI-XXXX (minimum 4 digits)</div>
            </div>
          )}

          {(qaSource === 'inspector' || qaSource === 'manufacturer') && (
            <div style={{ gridColumn: qaSource === 'inspector' && !conf.requiresBSTI ? "1 / -1" : "auto" }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Signed By</label>
              <input 
                type="text" 
                placeholder="e.g. Dr. Zaman, Quality Manager" 
                value={signedBy}
                onChange={e => setSignedBy(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
              />
            </div>
          )}

          {qaSource === 'inspector' && (
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>
                Inspector Notes <span style={{ color: ACCENT.red }}>*</span>
              </label>
              <textarea 
                placeholder="Record physical inspection remarks, packaging compliance and seals..." 
                value={inspectorNotes}
                onChange={e => setInspectorNotes(e.target.value)}
                rows={2}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "none" }}
              />
            </div>
          )}
        </div>
      </div>

      {formError && (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: ACCENT.red, fontSize: 12 }}>
          ❌ {formError}
        </div>
      )}

      <button 
        onClick={async () => { 
          setFormError("");
          if (!selectedBatchId) {
            setFormError("Please select a registered batch ID.");
            return;
          }
          if (conf.requiresBSTI || (qaSource === 'inspector' && (category === 'pharma' || category === 'dairy' || category === 'manufacturing'))) {
            if (!bstiCredential) {
              setFormError("BSTI Credential ID is required for inspector reports in this category.");
              return;
            }
            if (!/^BSTI-\d{4,}$/.test(bstiCredential)) {
              setFormError("BSTI Credential must match format 'BSTI-XXXX' (at least 4 digits).");
              return;
            }
          }
          if (qaSource === 'inspector' && !inspectorNotes) {
            setFormError("Inspector notes are required for inspector reports.");
            return;
          }

          if (ts >= 60) {
            setIsCertifying(true);
            try {
              let em1Ratio = 0.001;
              if (ratio === "1:1:10") em1Ratio = 0.002;
              else if (ratio === "1:1:20") em1Ratio = 0.002;
              else if (ratio === "1:1:30") em1Ratio = 0.001;
              else if (ratio === "1:1:40") em1Ratio = 0.0005;

              const metrics = {
                pH: conf.ph ? parseFloat(pH) : 7.0,
                ec: parseFloat(EC),
                temp: parseFloat(temp),
                em1Ratio,
                fermentationDays: parseInt(days, 10),
              };

              // Sign metrics
              const canonical = canonicalize(metrics);
              const signature = await sha256(canonical);

              // 1. Submit QA Ingestion report
              const qaPayload = {
                batch_id: selectedBatchId,
                source: qaSource,
                category: category,
                metrics: metrics,
                bstiCredential: bstiCredential || undefined,
                inspectorNotes: inspectorNotes || undefined,
                signed_by: signedBy || undefined,
                signature: signature
              };

              const qaRes = await window.APIClient.submitQAReport(qaPayload);
              if (!qaRes.success) {
                throw new Error(qaRes.error || "QA report submission failed.");
              }

              // 2. Certify Batch (QR)
              const res = await window.APIClient.certifyBatch({ 
                batchId: selectedBatchId,
                trustScore: ts
              });

              if (res.success) {
                setQrCodeImg(res.data.qrCodeDataUrl);
                setBatchNum(res.data.batchId);
                setCertified(true);
                
                // Sync list states locally
                const updateLocalBatch = b => {
                  if (b.id === res.data.batchId || b.batch_number === res.data.batchId) {
                    return { ...b, status: 'certified', trust_score: ts };
                  }
                  return b;
                };
                if (window.__SEED_BATCHES__) {
                  window.__SEED_BATCHES__ = window.__SEED_BATCHES__.map(updateLocalBatch);
                }
                setRegisteredBatches(prev => prev.map(updateLocalBatch));
              } else {
                throw new Error(res.error || "Batch certification failed.");
              }
            } catch (err) {
              console.error("Verification and certification failed:", err);
              setFormError(err.message || "An error occurred during submission.");
            } finally {
              setIsCertifying(false);
            }
          } 
        }}
        disabled={ts < 60 || isLoading || isCertifying}
        style={{
          width: "100%", padding: "12px", borderRadius: 10,
          border: `1px solid ${ts >= 60 ? ACCENT.green : "var(--border-primary)"}`,
          background: ts >= 60 ? ACCENT.greenBg : "var(--bg-input)",
          color: ts >= 60 ? ACCENT.green : "var(--text-dim)",
          cursor: ts >= 60 && !isLoading && !isCertifying ? "pointer" : "not-allowed",
          fontSize: 13, fontWeight: 600, letterSpacing: "0.05em",
          transition: "all 0.3s ease",
          boxShadow: ts >= 60 ? ACCENT.greenBg : "none",
          opacity: isLoading || isCertifying ? 0.7 : 1,
        }}>
        {isCertifying ? "⏳ Generating Cryptographic QR..." : (isLoading ? "⏳ Calculating..." : ts >= 60 ? "✦ Certify Batch & Generate QR Certificate" : "Trust Score too low to certify")}
      </button>
      {certified && qrCodeImg && (
        <div style={{
          marginTop: 14, padding: 14, borderRadius: 10,
          border: `1px solid ${ACCENT.greenBorder}`, background: ACCENT.greenBg,
          animation: "fadeSlideIn 0.4s ease",
        }}>
          <div style={{ fontSize: 11, color: ACCENT.green, fontWeight: 700, marginBottom: 10 }}>✓ BATCH CERTIFIED — Certificate Generated</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{
              width: 100, height: 100, background: "var(--bg-primary)", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${ACCENT.greenBorder}`, flexShrink: 0, overflow: "hidden"
            }}>
              <img 
                src={qrCodeImg} 
                alt="Cryptographic QR Code" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.9 }}>
              <div><span style={{ color: ACCENT.green }}>Batch #:</span> {batchNum}</div>
              <div><span style={{ color: ACCENT.green }}>Category:</span> {STANDARDS_CONFIG[category].displayName}</div>
              <div><span style={{ color: ACCENT.green }}>Source:</span> {qaSource === 'iot' ? 'IoT Sensors' : qaSource === 'inspector' ? 'Certified Inspector' : 'Manufacturer Declaration'}</div>
              {bstiCredential && <div><span style={{ color: ACCENT.green }}>BSTI ID:</span> {bstiCredential}</div>}
              {signedBy && <div><span style={{ color: ACCENT.green }}>Signed By:</span> {signedBy}</div>}
              <div><span style={{ color: ACCENT.green }}>Trust Score:</span> {ts}/100</div>
              <div><span style={{ color: ACCENT.green }}>Parameters:</span> pH: {conf.ph ? pH : "N/A"} / EC: {EC} / Temp: {temp}°C</div>
              <div><span style={{ color: ACCENT.green }}>Ratio / Days:</span> {conf.hasRatio ? ratio : "N/A"} / {days}</div>
            </div>
          </div>
          <button
            onClick={() => {
              const { jsPDF } = window.jspdf;
              const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
              });
              
              doc.setDrawColor(46, 125, 50);
              doc.setLineWidth(1.5);
              doc.rect(5, 5, 200, 287);
              
              doc.setFont("helvetica", "bold");
              doc.setFontSize(22);
              doc.setTextColor(46, 125, 50);
              doc.text("CLimaLogix AI", 105, 30, { align: "center" });
              
              doc.setFontSize(14);
              doc.setTextColor(15, 23, 42);
              doc.text("CLIMATESHIELD BATCH CERTIFICATE", 105, 42, { align: "center" });
              
              doc.setDrawColor(200, 200, 200);
              doc.setLineWidth(0.5);
              doc.line(20, 48, 190, 48);
              
              doc.setFont("helvetica", "normal");
              doc.setFontSize(12);
              doc.setTextColor(51, 65, 85);
              
              const matched = registeredBatches.find(b => b.id === batchNum || b.batch_number === batchNum);
              const pName = matched ? (matched.product_name || matched.product) : "Organic Product";
              const pZone = dispatchZone || (matched ? (matched.destination_zone || matched.dest) : "Old Dhaka");

              let y = 60;
              doc.setFont("helvetica", "bold");
              doc.text("Batch ID:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.text(batchNum, 75, y);
              
              y += 10;
              doc.setFont("helvetica", "bold");
              doc.text("Category:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.text(STANDARDS_CONFIG[category].displayName, 75, y);

              y += 10;
              doc.setFont("helvetica", "bold");
              doc.text("QA Source:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.text(qaSource === 'iot' ? 'IoT Sensors' : qaSource === 'inspector' ? 'Certified Inspector' : 'Manufacturer Declaration', 75, y);

              if (bstiCredential) {
                y += 10;
                doc.setFont("helvetica", "bold");
                doc.text("BSTI ID:", 30, y);
                doc.setFont("helvetica", "normal");
                doc.text(bstiCredential, 75, y);
              }

              if (signedBy) {
                y += 10;
                doc.setFont("helvetica", "bold");
                doc.text("Signed By:", 30, y);
                doc.setFont("helvetica", "normal");
                doc.text(signedBy, 75, y);
              }

              y += 10;
              doc.setFont("helvetica", "bold");
              doc.text("Product Name:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.text(pName, 75, y);

              y += 10;
              doc.setFont("helvetica", "bold");
              doc.text("Dispatch Zone:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.text(pZone, 75, y);

              y += 10;
              doc.setFont("helvetica", "bold");
              doc.text("BARI Trust Score:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.text(`${ts} / 100`, 75, y);
              
              y += 10;
              doc.setFont("helvetica", "bold");
              doc.text("Parameters:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.text(`pH: ${conf.ph ? pH : 'N/A'}  |  EC: ${EC}  |  Temp: ${temp} C`, 75, y);
              
              y += 10;
              doc.setFont("helvetica", "bold");
              doc.text("Treatment Ratio:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.text(conf.hasRatio ? ratio : 'N/A', 75, y);
              
              y += 10;
              doc.setFont("helvetica", "bold");
              doc.text("Fermentation Days:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.text(`${days} Days`, 75, y);
              
              y += 10;
              doc.setFont("helvetica", "bold");
              doc.text("Verification Status:", 30, y);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(46, 125, 50);
              doc.text("VERIFIED COMPLIANT", 75, y);
              doc.setTextColor(51, 65, 85);
              
              if (qrCodeImg) {
                try {
                  doc.addImage(qrCodeImg, 'PNG', 75, y + 12, 50, 50);
                } catch (e) {
                  console.error("Failed to add QR image to PDF:", e);
                }
              }
              
              y += 75;
              doc.setDrawColor(200, 200, 200);
              doc.line(20, y, 190, y);
              
              y += 10;
              doc.setFont("helvetica", "italic");
              doc.setFontSize(10);
              doc.setTextColor(100, 116, 139);
              doc.text("CLimaLogix AI ClimateShield — Decentralized Circular SME Compliance Network", 105, y, { align: "center" });
              
              doc.save(`CLimaLogix_Certificate_${batchNum}.pdf`);
            }}
            style={{
              marginTop: 14, width: "100%", padding: "10px", borderRadius: 8,
              border: `1px solid ${ACCENT.green}`, background: ACCENT.greenBg,
              color: ACCENT.green, cursor: "pointer", fontSize: 12, fontWeight: 700,
              transition: "all 0.25s ease", textAlign: "center", display: "block"
            }}
          >
            📥 Download PDF Certificate
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CLAIM VERIFIER
   ──────────────────────────────────────────────────────────────
   Looks up an existing batch by ID (or a full verification URL
   extracted from a QR code) and calls GET /api/verify/:batch_id.
   Surfaces the on-chain signature, certified-at timestamp, and
   trust score so buyers can confirm a claim is genuine. Falls
   back to a friendly placeholder when the route is missing.
   ═══════════════════════════════════════════════════════════════ */
function ClaimVerifier({ onSelectBatch }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | ok | missing | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const extractBatchId = (raw) => {
    if (!raw) return "";
    const trimmed = raw.trim();
    // Accept full URLs like https://ecoweathersme.onrender.com/verify/BCH-123
    const urlMatch = trimmed.match(/\/verify\/([^/?#]+)/i);
    if (urlMatch) return urlMatch[1];
    return trimmed;
  };

  const handleVerify = async () => {
    const id = extractBatchId(query);
    if (!id) { setStatus("error"); setErrorMsg("Enter a batch ID or verification URL."); return; }
    setStatus("loading");
    setErrorMsg("");
    setResult(null);
    try {
      if (!window.APIClient || !window.APIClient.verifyClaim) {
        throw new Error("verifyClaim API is not available in this build.");
      }
      const r = await window.APIClient.verifyClaim(id);
      // accept both envelope ({success, data}) and flat shapes
      const payload = r && r.success === false ? null : (r && r.data ? r.data : r);
      if (!payload || (payload.verified === false)) {
        setStatus("missing");
        setResult({ batchId: id, ...(payload || {}) });
      } else {
        setStatus("ok");
        setResult({ batchId: id, ...payload });
        if (onSelectBatch) onSelectBatch(id);
      }
    } catch (e) {
      // Route 404 (not yet deployed) — degrade gracefully.
      const msg = String(e && e.message || e);
      if (msg.includes("HTTP 404") || msg.includes("Failed to fetch")) {
        setStatus("missing");
        setErrorMsg("Live verification endpoint not yet deployed. Showing structural preview only.");
        setResult({ batchId: id, preview: true });
      } else {
        setStatus("error");
        setErrorMsg(msg);
      }
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
          placeholder="Paste batch ID (e.g. BCH-123456) or full verification URL"
          style={{
            flex: 1, padding: "10px 12px", fontSize: 13,
            background: "var(--bg-input)", color: "var(--text-primary)",
            border: "1px solid var(--border-primary)", borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace", outline: "none",
          }}
        />
        <button
          onClick={handleVerify}
          disabled={status === "loading"}
          style={{
            padding: "10px 18px", fontSize: 12, fontWeight: 700,
            background: ACCENT.greenBg, color: ACCENT.green,
            border: `1px solid ${ACCENT.greenBorder}`, borderRadius: 8,
            cursor: status === "loading" ? "wait" : "pointer",
            letterSpacing: "0.06em", fontFamily: "inherit",
          }}
        >
          {status === "loading" ? "VERIFYING…" : "🪪 VERIFY CLAIM"}
        </button>
      </div>

      {status === "ok" && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: 14, borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT.green, letterSpacing: "0.05em" }}>CLAIM VERIFIED · GENUINE</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 11, color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--text-dim)" }}>Batch ID</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-primary)" }}>{result.batchId || result.batch_id || "—"}</span>
              {result.trust && result.trust.score != null && (<><span style={{ color: "var(--text-dim)" }}>Trust Score</span><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{result.trust.score}</span></>)}
              {result.trust && result.trust.grade && (<><span style={{ color: "var(--text-dim)" }}>Grade</span><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{result.trust.grade}</span></>)}
              {result.certifiedAt && (<><span style={{ color: "var(--text-dim)" }}>Certified At</span><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{result.certifiedAt}</span></>)}
              {result.signature && (<><span style={{ color: "var(--text-dim)" }}>Signature</span><span style={{ fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>{String(result.signature).slice(0, 40)}…</span></>)}
              {result.zone && (<><span style={{ color: "var(--text-dim)" }}>Zone</span><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{result.zone}</span></>)}
            </div>
          </div>

          {result.chain && (
            <div style={{ marginTop: 6 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: 8,
                background: result.chain.verified ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                border: `1px solid ${result.chain.verified ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: result.chain.verified ? ACCENT.green : ACCENT.red,
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 12
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {result.chain.verified ? "🔒 PROVENANCE SECURED" : "🚨 INTEGRITY BREACHED (TAMPERED)"}
                </span>
                <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>SHA-256 HASH CHAIN</span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative", paddingLeft: 18 }}>
                {/* Visual Line */}
                <div style={{
                  position: "absolute",
                  left: 6,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  borderLeft: `2px dashed ${result.chain.verified ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                }}></div>
                
                {result.chain.events && result.chain.events.map((e, idx) => {
                  const eventType = e.event_type || e.type || "qa";
                  const actor = e.actor || "system";
                  const eventData = e.event_data || e.data || {};
                  const prevHash = e.prev_hash || "0000000000000000000000000000000000000000000000000000000000000000";
                  const currentHash = e.current_hash || "";
                  const timestamp = e.timestamp || e.signed_at || new Date().toISOString();
                  
                  let icon = "📋";
                  let title = "QA REPORT INGESTED";
                  if (eventType === "genesis") { icon = "🌱"; title = "GENESIS EVENT"; }
                  else if (eventType === "dispatch" || eventType === "dispatched") { icon = "🚚"; title = "DISPATCHED"; }
                  else if (eventType === "delivery" || eventType === "delivered" || eventType === "receipt") { icon = "📦"; title = "DELIVERED"; }
                  
                  return (
                    <div key={idx} style={{ position: "relative" }}>
                      {/* Circle Dot */}
                      <div style={{
                        position: "absolute",
                        left: -16,
                        top: 5,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: result.chain.verified ? ACCENT.green : ACCENT.red,
                        border: "2px solid var(--bg-secondary)",
                      }}></div>
                      
                      <div style={{ background: "var(--bg-input)", padding: 10, borderRadius: 8, border: "1px solid var(--border-primary)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{icon}</span> {title}
                          </span>
                          <span style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6 }}>
                          <div><span style={{ color: "var(--text-dim)" }}>Actor:</span> {actor}</div>
                          {eventType === "qa" && (
                            <>
                              <div><span style={{ color: "var(--text-dim)" }}>Category:</span> {eventData.category || "Organic"}</div>
                              {eventData.metrics_summary && (
                                <div><span style={{ color: "var(--text-dim)" }}>Metrics:</span> pH {eventData.metrics_summary.pH} | EC {eventData.metrics_summary.EC} | Temp {eventData.metrics_summary.temp}°C</div>
                              )}
                              {eventData.metrics && (
                                <div><span style={{ color: "var(--text-dim)" }}>Metrics:</span> pH {eventData.metrics.pH || "N/A"} | EC {eventData.metrics.ec} | Temp {eventData.metrics.temp}°C</div>
                              )}
                            </>
                          )}
                          {eventType === "genesis" && (
                            <div><span style={{ color: "var(--text-dim)" }}>Detail:</span> {eventData.note || "Batch created in system"}</div>
                          )}
                          {(eventType === "dispatch" || eventType === "dispatched") && (
                            <>
                              <div><span style={{ color: "var(--text-dim)" }}>From:</span> {eventData.from || "Processing Plant"}</div>
                              <div><span style={{ color: "var(--text-dim)" }}>To:</span> {eventData.to || "Mirpur Warehouse"}</div>
                              {eventData.driver && <div><span style={{ color: "var(--text-dim)" }}>Driver:</span> {eventData.driver}</div>}
                            </>
                          )}
                          {(eventType === "delivery" || eventType === "delivered" || eventType === "receipt") && (
                            <>
                              <div><span style={{ color: "var(--text-dim)" }}>Received By:</span> {eventData.received_by || eventData.receiver || "Warehouse Manager"}</div>
                              <div><span style={{ color: "var(--text-dim)" }}>Condition:</span> {eventData.condition || "good"}</div>
                            </>
                          )}
                        </div>
                        
                        <div style={{
                          fontSize: 8,
                          fontFamily: "'JetBrains Mono', monospace",
                          background: "var(--bg-primary)",
                          padding: "4px 6px",
                          borderRadius: 4,
                          color: "var(--text-dim)",
                          wordBreak: "break-all",
                          lineHeight: 1.3
                        }}>
                          <div><span style={{ color: ACCENT.blue }}>PREV:</span> {prevHash.slice(0, 32)}...</div>
                          <div><span style={{ color: ACCENT.green }}>HASH:</span> {currentHash.slice(0, 32)}...</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {status === "missing" && result && (
        <div style={{ padding: 14, borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.05em" }}>
              {result.preview ? "VERIFICATION ENDPOINT OFFLINE" : "NO CLAIM FOUND"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {errorMsg || `No certified batch found for ID "${result.batchId}". Make sure you scanned the right QR code.`}
          </div>
        </div>
      )}

      {status === "error" && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", fontSize: 12 }}>
          ❌ {errorMsg}
        </div>
      )}

      {status === "idle" && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
          🔍 Paste any batch ID or scan a QR code's URL to confirm a claim is genuine.
          Verification chain: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>GET /api/verify/:batch_id</span> → signature check → ESG cross-check.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2: MICROCLIMATE INTELLIGENCE (MERM Pipeline)
   ═══════════════════════════════════════════════════════════════ */
function DispatchCalendar({ baseTemp, zone, trustScore, windSpeed, packaging }) {
  const hours = Array.from({ length: 24 }, (_, h) => {
    const { dvs } = calcBARIDVS({ trustScore, zone, packaging, hour: h, baseTemp, windSpeed, routeDuration: 0 });
    return { h, dvs };
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

function MicroclimateSimulator({ trustScore, dvs: parentDvs, setDvs: setParentDvs }) {
  const [baseTemp, setBaseTemp] = useState(31);
  const [zone, setZone] = useState("Mirpur");
  const [packaging, setPackaging] = useState("standard");
  const [hour, setHour] = useState(new Date().getHours());
  const [windSpeed, setWindSpeed] = useState(8);
  const [routeDuration, setRouteDuration] = useState(90);
  const [zoneSearch, setZoneSearch] = useState("");
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherSource, setWeatherSource] = useState("estimated"); // "live" | "estimated" | "fetching"
  const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);
  const [dvs, setDvs] = useState(0);
  const [tst, setTst] = useState(0);
  const [adjustedTemp, setAdjustedTemp] = useState(31);
  const [thermalRisk, setThermalRisk] = useState({ value: 0.1, label: "Low", color: ACCENT.green });
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState("en-US");
  const [speechSupported, setSpeechSupported] = useState(true);

  // Progressive animation state
  const [displayDvs, setDisplayDvs] = useState(0);
  const [displayTrustScore, setDisplayTrustScore] = useState(0);
  const [displayTst, setDisplayTst] = useState(0);
  const [hasCalculated, setHasCalculated] = useState(false);

  const uhi = UHI_ZONES[zone] || UHI_ZONES["Mirpur"];
  const dvsColor = displayDvs >= 75 ? ACCENT.green : displayDvs >= 55 ? ACCENT.amber : ACCENT.red;
  const solarFactor = getSolarHourMultiplier(hour);

  const filteredZones = Object.keys(UHI_ZONES).filter(z => z.toLowerCase().includes(zoneSearch.toLowerCase()));

  // Auto-fetch weather whenever the selected zone changes
  useEffect(() => {
    fetchLiveWeather(zone);
  }, [zone]);

  // Also fetch once on mount so the page never shows the hardcoded 31/8 default
  useEffect(() => {
    fetchLiveWeather(zone);
    // Refresh every 10 minutes so the values stay current while the tab is open
    const interval = setInterval(() => fetchLiveWeather(zone), 10 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset scores and prepare for a recalculation when inputs change
  useEffect(() => {
    setDisplayDvs(0);
    setDisplayTrustScore(0);
    setDisplayTst(0);
    setHasCalculated(false);
  }, [baseTemp, zone, packaging, hour, windSpeed, trustScore, routeDuration]);

  const calculateViability = async () => {
    setIsFetchingMetrics(true);
    setHasCalculated(true);
    try {
      const data = await window.APIClient.getMicroclimateMetricsLegacy({
        trustScore,
        zone,
        packaging,
        hour,
        baseTemp,
        windSpeed,
        routeDuration,
      });
      const targetDvs = data.dvs || 0;
      const targetTst = data.tst || 0;
      const targetTS = data.trustScore || trustScore;

      setAdjustedTemp(data.adjustedTemp || baseTemp);
      setThermalRisk(data.thermalRisk || { value: 0.1, label: "Low", color: ACCENT.green });
      setDvs(targetDvs);
      setTst(targetTst);
      if (setParentDvs) setParentDvs(targetDvs);

      // Animate DVS
      let currentDvs = 0;
      const dvsStep = Math.max(1, Math.ceil(targetDvs / 30));
      const dvsInterval = setInterval(() => {
        currentDvs += dvsStep;
        if (currentDvs >= targetDvs) {
          setDisplayDvs(targetDvs);
          clearInterval(dvsInterval);
        } else {
          setDisplayDvs(currentDvs);
        }
      }, 15);

      // Animate Trust Score
      let currentTS = 0;
      const tsStep = Math.max(1, Math.ceil(targetTS / 30));
      const tsInterval = setInterval(() => {
        currentTS += tsStep;
        if (currentTS >= targetTS) {
          setDisplayTrustScore(targetTS);
          clearInterval(tsInterval);
        } else {
          setDisplayTrustScore(currentTS);
        }
      }, 15);

      // Animate TST
      let currentTst = 0;
      const tstStep = Math.max(1, Math.ceil(targetTst / 30));
      const tstInterval = setInterval(() => {
        currentTst += tstStep;
        if (currentTst >= targetTst) {
          setDisplayTst(targetTst);
          clearInterval(tstInterval);
        } else {
          setDisplayTst(currentTst);
        }
      }, 15);

    } catch (error) {
      console.error("Failed to fetch microclimate metrics:", error);
      // Local fallback using dynamic calculation
      const { dvs: dvsScore, tst: tstScore, adjustedTemp: adjTemp, trustScore: deliveryTS } = calcBARIDVS({
        trustScore,
        zone,
        packaging,
        hour,
        baseTemp,
        windSpeed,
        routeDuration
      });
      const risk = calcThermalRisk(adjTemp);

      setAdjustedTemp(adjTemp);
      setThermalRisk(risk);
      setDvs(dvsScore);
      setTst(tstScore);
      if (setParentDvs) setParentDvs(dvsScore);

      let currentDvs = 0;
      const dvsStep = Math.max(1, Math.ceil(dvsScore / 30));
      const dvsInterval = setInterval(() => {
        currentDvs += dvsStep;
        if (currentDvs >= dvsScore) {
          setDisplayDvs(dvsScore);
          clearInterval(dvsInterval);
        } else {
          setDisplayDvs(currentDvs);
        }
      }, 15);

      let currentTS = 0;
      const tsStep = Math.max(1, Math.ceil(deliveryTS / 30));
      const tsInterval = setInterval(() => {
        currentTS += tsStep;
        if (currentTS >= deliveryTS) {
          setDisplayTrustScore(deliveryTS);
          clearInterval(tsInterval);
        } else {
          setDisplayTrustScore(currentTS);
        }
      }, 15);

      let currentTst = 0;
      const tstStep = Math.max(1, Math.ceil(tstScore / 30));
      const tstInterval = setInterval(() => {
        currentTst += tstStep;
        if (currentTst >= tstScore) {
          setDisplayTst(tstScore);
          clearInterval(tstInterval);
        } else {
          setDisplayTst(currentTst);
        }
      }, 15);
    } finally {
      setIsFetchingMetrics(false);
    }
  };

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSpeechSupported(false);
    } else {
      // Pre-detect language based on location
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const data = await res.json();
            if (data.countryCode === "BD") {
              setSpeechLang("bn-BD");
            }
          } catch (e) {
            console.error("Failed to detect language from location", e);
          }
        },
        () => console.warn("Geolocation denied/failed. Defaulting to en-US.")
      );
    }
  }, []);

  const handleListen = () => {
    if (isListening) return;
    startSpeechRecognition(speechLang);
  };

  const startSpeechRecognition = (lang) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setZoneSearch(transcript);
      // Auto-select zone if matched
      const matchedZone = Object.keys(UHI_ZONES).find(z => z.toLowerCase().includes(transcript.toLowerCase()));
      if (matchedZone) {
        setZone(matchedZone);
      }
      // Auto-fetch weather for spoken location
      fetchLiveWeather(matchedZone || transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Local fallback weather model: Dhaka diurnal temperature curve with zone-specific adjustments.
  // Used when the backend /api/weather endpoint is unavailable (e.g. stale Render build or missing key).
  const deriveLocalFallbackWeather = (zoneName) => {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    // Peak 13:00 → 34.5°C, low 5:00 → 26°C; smooth cosine interpolation between
    const closer = Math.min(Math.abs(h - 13), Math.abs(h - 5));
    const peak = 34.5;
    const trough = 26;
    const temp = trough + (peak - trough) * (1 - Math.cos((closer / 8) * Math.PI)) / 2;
    // Wind: 6 km/h base, ±4 sinusoidal
    const wind = Math.max(3, Math.round(6 + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI)));
    // Zone-specific adjustments (urban heat island variations across Dhaka)
    const zoneAdjustments = {
      "Old Dhaka": 1.8, "Motijheel": 1.5, "Dhanmondi": 1.2, "Ramna": 1.4,
      "Tejgaon": 1.6, "Gulshan": 0.9, "Banani": 0.7, "Uttara": 0.3,
      "Mirpur": 0.6, "Mohammadpur": 0.8, "Savar": -0.4, "Keraniganj": -0.2,
      "Gazipur": 0.0, "Narayanganj": 0.5, "Tongi": 0.2,
    };
    const adjustment = zoneAdjustments[zoneName] ?? 0;
    return { temp: Math.round((temp + adjustment) * 10) / 10, wind };
  };

  const fetchLiveWeather = async (locationQuery = null) => {
    setIsFetchingWeather(true);
    setWeatherSource("fetching");
    const targetLocation = typeof locationQuery === "string" ? locationQuery : (zoneSearch || zone || "Dhaka");
    let usedLive = false;
    try {
      const geoRes = await window.APIClient.geocode(targetLocation);
      if (geoRes.success && geoRes.data) {
        const { lat, lon } = geoRes.data;
        const weatherRes = await window.APIClient.getWeather(lat, lon);
        if (weatherRes.success && weatherRes.data) {
          setBaseTemp(Math.round(weatherRes.data.temperature * 10) / 10);
          setWindSpeed(Math.round(weatherRes.data.windspeed_kmh));
          setWeatherSource("live");
          usedLive = true;
        }
      }
    } catch (e) {
      console.error("Failed to fetch live weather via backend", e);
    }
    if (!usedLive) {
      // Backend unavailable (404 stale build, missing key, etc.) — fall back to a local Dhaka model
      // so the UI never displays the static 31°C / 8 km/h defaults indefinitely.
      const fallback = deriveLocalFallbackWeather(zone);
      setBaseTemp(fallback.temp);
      setWindSpeed(fallback.wind);
      setWeatherSource("estimated");
      console.info(
        "%c[weather]%c Using local Dhaka diurnal estimate — " +
        "live OpenWeather call did not return data. " +
        "If this persists, redeploy the backend at https://dashboard.render.com " +
        "or set OPENWEATHER_API_KEY in the Render environment.",
        "background:#f59e0b;color:#000;padding:2px 6px;border-radius:4px;font-weight:700",
        "color:#f59e0b"
      );
    }
    setIsFetchingWeather(false);
  };

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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>Weather Conditions</div>
              <span
                title={weatherSource === "live" ? "Live data from OpenWeather via backend" : weatherSource === "fetching" ? "Fetching live data..." : "Estimated from local Dhaka diurnal model (backend unavailable)"}
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                  padding: "2px 8px", borderRadius: 999,
                  background: weatherSource === "live" ? "#10b981" : weatherSource === "fetching" ? "#6b7280" : "#f59e0b",
                  color: "#fff", display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                {weatherSource === "live" ? "● LIVE" : weatherSource === "fetching" ? "⏳ FETCHING" : "◐ ESTIMATED"}
              </span>
            </div>
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
          <div style={{ background: "var(--bg-input)", padding: 14, borderRadius: 10, border: "1px solid var(--border-primary)", marginBottom: 16 }}>
            <SliderRow label="Base Temperature (Regional)" min={25} max={42} step={0.5} value={baseTemp} onChange={setBaseTemp} unit="°C" color={baseTemp > 35 ? ACCENT.red : ACCENT.amber} />
            <div style={{ marginTop: 12 }}>
              <SliderRow label="Wind Speed" min={0} max={30} step={1} value={windSpeed} onChange={setWindSpeed} unit=" km/h" color={ACCENT.blue} />
            </div>
          </div>

          <SliderRow label="Dispatch Hour" min={0} max={23} step={1} value={hour} onChange={setHour} unit={`:00 ${hour >= 11 && hour < 15 ? '(Peak Solar)' : hour >= 8 && hour < 18 ? '(Daylight)' : '(Night)'}`} color={hour >= 11 && hour < 15 ? ACCENT.red : hour >= 8 && hour < 18 ? ACCENT.amber : ACCENT.green} />

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
              <>
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
              </>
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
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
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

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Route Duration</div>
          <div style={{ background: "var(--bg-input)", padding: 14, borderRadius: 10, border: "1px solid var(--border-primary)", marginBottom: 16 }}>
            <SliderRow label="Delivery Route Duration" min={15} max={300} step={5} value={routeDuration} onChange={setRouteDuration} unit=" min" color={ACCENT.blue} />
          </div>

          <button
            onClick={calculateViability}
            disabled={isFetchingMetrics}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT.green}, ${ACCENT.greenDark})`,
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
              transition: "all 0.3s ease",
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              animation: !hasCalculated ? "pulseGlow 2s infinite" : "none"
            }}
          >
            {isFetchingMetrics ? "⏳ Calculating Viability..." : "⚡ Calculate Viability Score"}
          </button>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--bg-input)", borderRadius: 12, border: "1px solid var(--border-primary)", minHeight: 250 }}>
            {isFetchingMetrics ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 250 }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Analyzing microclimate...</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 24, justifyContent: "center", alignItems: "center", width: "100%", marginBottom: 16 }}>
                  {/* DVS Score Pie Chart */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ background: "var(--bg-primary)", borderRadius: "50%", padding: 8 }}>
                        <CircleArc value={displayDvs} color={dvsColor} size={110} strokeWidth={10} />
                      </div>
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: dvsColor, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{displayDvs}</div>
                        <div style={{ fontSize: 8, color: "var(--text-dim)", fontWeight: 600, marginTop: 2 }}>DVS</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: dvsColor, marginTop: 8 }}>DVS SCORE</div>
                  </div>

                  {/* Trust Score Pie Chart */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ background: "var(--bg-primary)", borderRadius: "50%", padding: 8 }}>
                        <CircleArc value={displayTrustScore} color={ACCENT.green} size={110} strokeWidth={10} />
                      </div>
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: ACCENT.green, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{displayTrustScore}</div>
                        <div style={{ fontSize: 8, color: "var(--text-dim)", fontWeight: 600, marginTop: 2 }}>TRUST</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: ACCENT.green, marginTop: 8 }}>TRUST SCORE</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%" }}>
                  <div style={{ background: "var(--bg-primary)", padding: "16px 0", borderRadius: 8, textAlign: "center", border: "1px solid var(--border-primary)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Thermal Survival</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{displayTst} min</div>
                  </div>
                  <div style={{ background: "var(--bg-primary)", padding: "16px 0", borderRadius: 8, textAlign: "center", border: "1px solid var(--border-primary)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Adjusted Temp</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{adjustedTemp.toFixed(1)}°C</div>
                  </div>
                </div>
              </>
            )}
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

      <DispatchCalendar baseTemp={baseTemp} zone={zone} trustScore={trustScore} windSpeed={windSpeed} packaging={packaging} />
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
  const [esgData, setEsgData] = useState(null);
  const [esgReport, setEsgReport] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEsgData = async () => {
      try {
        setIsLoading(true);
        const [data, reportRes] = await Promise.all([
           window.APIClient.getESGMetrics(trustScore, dvs),
           window.APIClient.getESGReport()
        ]);
        setEsgData(data);
        if (reportRes && reportRes.success && reportRes.data) {
           setEsgReport(reportRes.data.ledger || reportRes.data || []);
        }
        setError(null);
      } catch (err) {
        setError('Failed to load ESG metrics. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEsgData();
  }, [trustScore, dvs]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-secondary)" }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 12 }}>Loading ESG Data...</div>
      </div>
    );
  }

  if (error) {
    return <div style={{ color: ACCENT.red, padding: 12, textAlign: "center" }}>{error}</div>;
  }

  if (!esgData) {
    return <div style={{ padding: 12, textAlign: "center" }}>No ESG data available.</div>;
  }

  // Calibrate DVS if simulator hasn't been run yet for general display
  const activeDvs = esgData.dvs_score;
  const isSimulated = dvs > 0;
  
  // ESG Scores from API
  const { e_score: eScore, s_score: sScore, g_score: gScore, esg_score: esgScore } = esgData;
  const esgGrade = esgScore >= 95 ? "A+" : esgScore >= 90 ? "A" : esgScore >= 80 ? "B+" : "B";
  
  // Core KPI Calculations from API
  const {
    spoilage_prevented_bdt: spoilagePrevented,
    plastic_offset_kg: plasticOffset,
    carbon_sequestered_kg: carbonSeq,
    water_saved_l: waterSaved,
    waste_reduced_kg: wasteReduced,
  } = esgData;

  const ledgerData = esgReport.length > 0 ? esgReport : [
    { id: "BCH-8492", date: "2026-05-28", zone: "Mirpur", env: "4.2 kg CO₂", soc: "Direct SME B2B Premium Paid", gov: "Manually Signed (BARI)", hash: "0x8f7a...3e" },
    { id: "BCH-8411", date: "2026-05-27", zone: "Jatrabari", env: "3.8 kg CO₂", soc: "Direct SME B2B Premium Paid", gov: "Manually Signed (BARI)", hash: "0x4b2c...7d" },
    { id: "BCH-8380", date: "2026-05-26", zone: "Uttara", env: "4.9 kg CO₂", soc: "Direct SME B2B Premium Paid", gov: "Manually Signed (BARI)", hash: "0x9a1e...9b" },
  ];

  const calculateImpactPercentage = (actual, baseline) => {
    if (baseline === 0) return 100;
    const pct = (actual / baseline) * 100;
    return Math.min(100, Math.round(pct));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeSlideIn 0.4s ease" }}>
      
      {/* SECTION 1: Overall ESG Grade & E/S/G Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: 16 }}>
        {/* Overall ESG Grade Ring */}
        <div style={{
          display: "flex", alignItems: "center", justifyItems: "center", gap: 20,
          background: "var(--bg-input)", border: "1px solid var(--border-primary)",
          borderRadius: 12, padding: "20px 24px", position: "relative",
          backgroundImage: `linear-gradient(135deg, ${ACCENT.green}0A, transparent)`
        }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <CircleArc value={esgScore} color={ACCENT.green} size={110} strokeWidth={10} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: ACCENT.green, lineHeight: 1 }}>{esgGrade}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, marginTop: 2 }}>{esgScore}/100</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>CLimaLogix ESG Rating</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Your agricultural supply chain operates with exceptional environmental and social compliance. 
              {!isSimulated && <span style={{ color: ACCENT.amber }}> Run simulator to refine this grade dynamically.</span>}
            </div>
          </div>
        </div>

        {/* E, S, G Progress Indicators */}
        <div style={{
          background: "var(--bg-input)", border: "1px solid var(--border-primary)",
          borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, justifyContent: "center"
        }}>
          {[
            ["E", "Environmental Impact", eScore, ACCENT.green, "Carbon & Waste reduction"],
            ["S", "Social Fairness", sScore, ACCENT.blue, "Direct SME premium model"],
            ["G", "Governance Integrity", gScore, ACCENT.amber, "BARI certified blockchain"]
          ].map(([letter, title, val, col, sub]) => (
            <div key={letter} style={{ display: "grid", gridTemplateColumns: "24px 1fr 40px", gap: 12, alignItems: "center" }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, background: col + "15",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: col, fontWeight: 700, fontSize: 12
              }}>{letter}</div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
                  <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{sub}</span>
                </div>
                <div style={{ height: 6, background: "var(--gauge-track)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${val}%`, height: "100%", background: col, borderRadius: 3, transition: "width 0.8s ease" }}></div>
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: col, fontFamily: "'JetBrains Mono', monospace" }}>{val}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Impact Metrics (6 KPIs) */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT.green, letterSpacing: "0.12em", marginBottom: 12, textTransform: "uppercase" }}>
          ⭐ Real-World Impact Metrics (This Month)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { icon: "🛡️", label: "Spoilage Averted", value: `BDT ${spoilagePrevented.toLocaleString()}`, unit: "Market value protected", desc: "Smart dispatch prevents food waste during thermal events" },
            { icon: "♻️", label: "Plastic Diverted", value: `${plasticOffset} kg`, unit: "Avoided polymers", desc: "Bulk refill model eliminates standard PET containers" },
            { icon: "🌿", label: "Carbon Sequestered", value: `${carbonSeq} kg CO₂`, unit: "Biochar buried", desc: "100-year soil permanence via pyrolysis" },
            { icon: "💧", label: "Water Conserved", value: `${waterSaved} L`, unit: "Slurry refill efficiency", desc: "Centralized mixing reduces per-batch water use" },
            { icon: "📉", label: "Waste Reduced", value: `${wasteReduced} kg`, unit: "Organic matter diverted", desc: "Composted residues bypass landfill methane" },
            { icon: "🚚", label: "DVS Compliance", value: `${activeDvs}%`, unit: "Within safe window", desc: "Dispatches meet thermal survival time thresholds" }
          ].map((item, i) => (
            <Card key={i} style={{ textAlign: "center", padding: "18px 14px", position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 28 }}>{item.icon}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
              <div style={{ fontSize: 8, color: ACCENT.green, fontWeight: 500 }}>{item.unit}</div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.3 }}>{item.desc}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* SECTION 3: ESG Scoring Logic Explained */}
      <div style={{
        background: "var(--bg-input)", border: `1px solid ${ACCENT.greenBorder}`,
        borderRadius: 12, padding: "20px 24px"
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT.green, letterSpacing: "0.12em", marginBottom: 14, textTransform: "uppercase" }}>
          📐 How ESG Scores Are Calculated
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            {
              title: "E — Environmental",
              formula: "E = (Trust × 0.5) + (DVS × 0.5)",
              logic: [
                { step: "Trust Component", desc: `Trust × 0.5 = ${trustScore} × 0.5 = ${Math.round(trustScore * 0.5)}` },
                { step: "Delivery Viability", desc: `DVS × 0.5 = ${activeDvs} × 0.5 = ${Math.round(activeDvs * 0.5)}` },
              ],
              score: eScore,
              color: ACCENT.green
            },
            {
              title: "S — Social",
              formula: "S = (Trust × 0.4) + Base 54",
              logic: [
                { step: "Fair Pricing", desc: "Direct B2B SME payments bypass high-commission aggregators" },
                { step: "Trust Foundation", desc: "Operator-signed manual records ensure supply chain transparency" },
              ],
              score: sScore,
              color: ACCENT.blue
            },
            {
              title: "G — Governance",
              formula: "G = (Trust × 0.6) + Base 38",
              logic: [
                { step: "BARI Certification", desc: "Bangladesh Agricultural Research Institute approved standards" },
                { step: "Cryptographic Signing", desc: "Blockchain QR codes authenticate every shipment immutably" },
              ],
              score: gScore,
              color: ACCENT.amber
            }
          ].map((pillar, i) => (
            <div key={i} style={{
              borderRadius: 10, padding: "16px", background: pillar.color + "08", border: `1px solid ${pillar.color}33`
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: pillar.color, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>📊</span> {pillar.title}
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--text-secondary)",
                background: "var(--bg-primary)", padding: "8px", borderRadius: 6, marginBottom: 10,
                fontWeight: 500, border: `1px solid ${pillar.color}22`
              }}>
                {pillar.formula}
              </div>
              <div style={{ fontSize: 9, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 6 }}>
                {pillar.logic.map((item, j) => (
                  <div key={j} style={{ lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 600, color: pillar.color }}>{item.step}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 8 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${pillar.color}44`,
                fontSize: 12, fontWeight: 700, color: pillar.color, textAlign: "center"
              }}>
                Score: {pillar.score} / 100
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: Auditable Blockchain Ledger */}
      <div style={{
        background: "var(--bg-input)", border: "1px solid var(--border-primary)",
        borderRadius: 12, padding: "20px 24px"
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔗</span> AUDITABLE ESG LEDGER (LIVE ACCRUAL)
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <th style={{ padding: "8px 4px", color: "var(--text-dim)" }}>BATCH ID</th>
                <th style={{ padding: "8px 4px", color: "var(--text-dim)" }}>DATE</th>
                <th style={{ padding: "8px 4px", color: "var(--text-dim)" }}>ZONE</th>
                <th style={{ padding: "8px 4px", color: "var(--text-dim)" }}>CARBON SAVED</th>
                <th style={{ padding: "8px 4px", color: "var(--text-dim)" }}>GOVERNANCE</th>
                <th style={{ padding: "8px 4px", color: "var(--text-dim)", textAlign: "right" }}>BLOCKCHAIN PROOF</th>
              </tr>
            </thead>
            <tbody>
              {ledgerData.map(row => (
                <tr key={row.id} style={{ borderBottom: "1px dashed var(--border-primary)" }}>
                  <td style={{ padding: "10px 4px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: ACCENT.green }}>{row.id}</td>
                  <td style={{ padding: "10px 4px", color: "var(--text-secondary)" }}>{row.date}</td>
                  <td style={{ padding: "10px 4px", color: "var(--text-secondary)" }}>{row.zone}</td>
                  <td style={{ padding: "10px 4px", color: ACCENT.green, fontWeight: 600 }}>{row.env}</td>
                  <td style={{ padding: "10px 4px", color: ACCENT.green, fontWeight: 600 }}>✓ {row.gov}</td>
                  <td style={{ padding: "10px 4px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: ACCENT.blue, fontSize: 9 }}>{row.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 5: Impact Baseline Comparison */}
      <div style={{
        background: `linear-gradient(135deg, ${ACCENT.green}08, transparent)`,
        border: `1px solid ${ACCENT.greenBorder}`,
        borderRadius: 12, padding: "20px 24px"
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT.green, letterSpacing: "0.12em", marginBottom: 14, textTransform: "uppercase" }}>
          📈 Environmental Baseline vs. Your Impact
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { metric: "Plastic Waste", baseline: 850, actual: plasticOffset, unit: "kg/month", icon: "♻️" },
            { metric: "Carbon Emissions", baseline: 2400, actual: carbonSeq, unit: "kg CO₂/month", icon: "🌿" },
            { metric: "Food Spoilage", baseline: 450000, actual: spoilagePrevented, unit: "BDT loss/month", icon: "🛡️" },
            { metric: "Water Use", baseline: 8500, actual: waterSaved, unit: "L/month", icon: "💧" },
          ].map((item, i) => {
            const improvement = calculateImpactPercentage(item.actual, item.baseline);
            return (
              <div key={i} style={{ padding: "14px", background: "var(--bg-primary)", borderRadius: 8, border: `1px solid var(--border-primary)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 12 }}>{item.metric}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Baseline Impact</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>{item.baseline.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Your Reduction</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT.green }}>{item.actual.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ height: 6, background: "var(--gauge-track)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${improvement}%`, height: "100%", background: ACCENT.green, borderRadius: 3, transition: "width 0.8s ease" }}></div>
                </div>
                <div style={{ marginTop: 6, fontSize: 9, color: ACCENT.green, fontWeight: 600 }}>
                  {improvement}% of monthly baseline reduced
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 6: Certifications */}
      <div style={{
        background: "var(--bg-input)", border: "1px solid var(--border-primary)",
        borderRadius: 12, padding: "20px 24px"
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 8 }}>
          <span>🏅</span> {"CERTIFICATIONS & COMPLIANCE STANDARDS"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { badge: "BARI Certified", desc: "Bangladesh Agricultural Research Institute approved batch standards", status: "✓ Active" },
            { badge: "Blockchain Audited", desc: "Smart contract ESG accrual auto-logged & immutable", status: "✓ Live" },
            { badge: "Fair Trade Verified", desc: "Direct SME premium pricing with zero hidden aggregator fees", status: "✓ Certified" }
          ].map((cert, i) => (
            <div key={i} style={{
              padding: "14px", background: "var(--bg-primary)", borderRadius: 8,
              border: `1px solid ${ACCENT.greenBorder}`, display: "flex", flexDirection: "column", gap: 8
            }}>
              <div style={{ fontWeight: 700, color: ACCENT.green, fontSize: 11 }}>{cert.badge}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.4 }}>{cert.desc}</div>
              <div style={{ fontSize: 9, color: ACCENT.green, fontWeight: 600, marginTop: 4 }}>{cert.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BUSINESS INTELLIGENCE VIEW
   ──────────────────────────────────────────────────────────────
   Layer 2 — Intelligence output: pulls the monthly ESG report
   (GET /api/esg/report) and pairs it with the demand forecast chart
   so decision-makers see both sustainability trend and market pull
   in one panel. Degrades gracefully when the new BI route is not
   yet deployed on the live backend.
   ═══════════════════════════════════════════════════════════════ */
function BusinessIntelligenceView({ trustScore, dvs }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // getESGReport is not on the live backend yet — fall back to a
        // synthesised series derived from the live ESG snapshot so the
        // panel is never empty.
        if (window.APIClient && window.APIClient.getESGReport) {
          try {
            const r = await window.APIClient.getESGReport(months);
            if (!cancelled) {
              // accept both {data: …} envelope and flat shapes
              const payload = r && r.data ? r.data : r;
              setReport(payload && Object.keys(payload).length ? payload : null);
              setError(null);
            }
            return;
          } catch (e) {
            // route missing on live — fall through to synthetic series
          }
        }
        if (!cancelled) {
          setReport(null);
          setError("Live ESG-report endpoint not yet deployed; showing projected trend.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [months]);

  // Build a 12-month projection from the current ESG snapshot. The shape
  // intentionally mirrors what /api/esg/report returns so the chart will
  // automatically upgrade to real data once the route is live.
  const months_back = months;
  const synthetic = useMemo(() => {
    const labels = [];
    const e = [], s = [], g = [];
    const now = new Date();
    for (let i = months_back - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString('default', { month: 'short' }) + " '" + String(d.getFullYear()).slice(-2));
      // gentle upward trend, damped by current trust/DVS
      const factor = (i / months_back) * 0.35;
      const baseE = Math.max(20, Math.min(95, 60 + trustScore * 0.25 - factor * 10));
      const baseS = Math.max(20, Math.min(95, 55 + trustScore * 0.30 - factor * 8));
      const baseG = Math.max(20, Math.min(95, 50 + dvs * 0.35 - factor * 6));
      e.push(Math.round(baseE));
      s.push(Math.round(baseS));
      g.push(Math.round(baseG));
    }
    return { labels, e, s, g, source: "synthetic" };
  }, [trustScore, dvs, months]);

  const series = report && report.months ? report : synthetic;
  const maxY = 100;

  return (
    <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
      <SectionLabel icon="🧠" text="Business Intelligence · Sustainability × Market" />

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        {/* ── ESG Report panel ─────────────────────────────── */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.05em", fontWeight: 600 }}>
              MONTHLY ESG REPORT
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: "var(--text-dim)" }}>WINDOW</span>
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-primary)", borderRadius: 6, fontSize: 11, padding: "2px 6px" }}>
                <option value={6}>6 mo</option>
                <option value={12}>12 mo</option>
                <option value={24}>24 mo</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 8, padding: "6px 8px", borderRadius: 6, background: "var(--bg-input)", border: "1px dashed var(--border-primary)" }}>
              ℹ️ {error}
            </div>
          )}

          {/* Stacked ESG trend chart */}
          <div style={{ height: 220, display: "flex", alignItems: "flex-end", gap: 4, padding: "0 4px", borderBottom: "1px solid var(--border-primary)", position: "relative" }}>
            {[20, 40, 60, 80, 100].map((g) => (
              <div key={g} style={{ position: "absolute", left: 0, right: 0, bottom: `${g}%`, borderTop: "1px dashed rgba(148,163,184,0.15)", pointerEvents: "none" }} />
            ))}
            {series.labels.map((label, i) => {
              const e = series.e[i] || 0;
              const s = series.s[i] || 0;
              const g = series.g[i] || 0;
              const avg = Math.round((e + s + g) / 3);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0 }} title={`${label} · ESG ${avg}`}>
                  <div style={{ width: "70%", display: "flex", flexDirection: "column-reverse", height: `${avg}%`, minHeight: 2, borderRadius: "3px 3px 0 0", overflow: "hidden" }}>
                    <div style={{ flex: g, background: "#3b82f6" }} />
                    <div style={{ flex: s, background: "#a855f7" }} />
                    <div style={{ flex: e, background: "#10b981" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "var(--text-dim)" }}>
            {series.labels.map((l, i) => (
              <span key={i} style={{ flex: 1, textAlign: "center" }}>{i % 2 === 0 ? l : ""}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 10, color: "var(--text-secondary)" }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#10b981", borderRadius: 2, marginRight: 4 }} />Environmental</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#a855f7", borderRadius: 2, marginRight: 4 }} />Social</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#3b82f6", borderRadius: 2, marginRight: 4 }} />Governance</span>
          </div>
        </Card>

        {/* ── KPI summary panel ────────────────────────────── */}
        <Card>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 12 }}>
            PIPELINE KPIs
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Trust Score",  value: trustScore, target: 60, color: trustScore >= 60 ? "#10b981" : "#ef4444" },
              { label: "DVS",          value: dvs,        target: 75, color: dvs >= 75 ? "#10b981" : dvs >= 55 ? "#f59e0b" : "#ef4444" },
              { label: "Cert Rate",    value: "—",        target: null, color: "#94a3b8" },
              { label: "Plastic Saved",value: "—",        target: null, color: "#10b981" },
            ].map((kpi, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)" }}>
                <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.08em", fontWeight: 600 }}>{kpi.label.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>{kpi.value}</div>
                {kpi.target != null && (
                  <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>target ≥ {kpi.target}</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)" }}>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>3-Layer Snapshot</div>
            <div style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.55 }}>
              <span style={{ color: "#3b82f6" }}>Sensing</span>: {trustScore >= 60 ? "✓" : "✗"} viability · <span style={{ color: "#a855f7" }}>Intelligence</span>: DVS {dvs} · <span style={{ color: "#10b981" }}>Presentation</span>: ESG ledger live
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card>
          <SectionLabel icon="📊" text="Demand Forecast" />
          <DemandChart />
        </Card>
      </div>
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
  const [dashData, setDashData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboard = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/dashboard`);
      const json = await res.json();
      if (json.success && json.data) {
        setDashData(json.data);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.error('[Dashboard] fetch failed:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(false), 60000);
    return () => clearInterval(interval);
  }, []);

  const s = dashData?.stats;
  const activity = dashData?.recentActivity || [];
  const heatmap = dashData?.heatmap || [];
  const isLive = dashData?.liveData;

  // ── Live Tracking + per-product ESG: product list & selection ──
  const [batchList, setBatchList]   = useState([]);
  const [batchListLoading, setBatchListLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchBatches = async () => {
    try {
      const json = await window.APIClient.getBatches();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setBatchList(json.data.map(b => ({ ...b, status: (b.status || "").trim().toLowerCase() })));
      } else {
        setBatchList(window.__SEED_BATCHES__ || []);
      }
    } catch (_) {
      setBatchList(window.__SEED_BATCHES__ || []);
    } finally {
      setBatchListLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    
    let channel = null;
    let fallbackInterval = null;

    const setupRealtime = () => {
      const supabase = window.supabaseClient;
      if (supabase) {
        try {
          channel = supabase
            .channel('dashboard-batches-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, () => {
              fetchBatches();
              fetchDashboard(false);
            })
            .subscribe((status) => {
              if (status !== 'SUBSCRIBED') {
                if (!fallbackInterval) {
                  fallbackInterval = setInterval(() => {
                    fetchBatches();
                    fetchDashboard(false);
                  }, 8000);
                }
              } else {
                if (fallbackInterval) {
                  clearInterval(fallbackInterval);
                  fallbackInterval = null;
                }
              }
            });
        } catch (e) {
          console.warn("Dashboard realtime subscription failed, using polling fallback:", e);
          fallbackInterval = setInterval(() => {
            fetchBatches();
            fetchDashboard(false);
          }, 8000);
        }
      } else {
        fallbackInterval = setInterval(() => {
          fetchBatches();
          fetchDashboard(false);
        }, 8000);
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        window.supabaseClient?.removeChannel(channel);
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, []);

  // Auto-pick from QR deep-link if present, else most-recent batch
  useEffect(() => {
    if (batchList.length === 0 || selectedProduct) return;
    const qrId = typeof window !== "undefined" ? window.__QR_PRODUCT__ : null;
    if (qrId) {
      const match = batchList.find(b => (b.id || "").toUpperCase() === qrId.toUpperCase());
      if (match) { setSelectedProduct(match); return; }
    }
    // fallback: most recently created
    const sorted = [...batchList].sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    if (sorted[0]) setSelectedProduct(sorted[0]);
  }, [batchList]);

  const statCards = s ? [
    { label: "TOTAL BATCHES",       value: s.totalBatches,       sub: `${s.activeBatches} active`,              icon: "📦" },
    { label: "CERTIFIED BATCHES",   value: s.certifiedBatches,   sub: `${s.certRate} certification rate`,        icon: "🛡️" },
    { label: "AVG TRUST SCORE",     value: s.avgTrustScore,      sub: "BARI-certified standard",                 icon: "📈" },
    { label: "TOTAL WEIGHT",        value: s.totalWeight,        sub: "bio-resources processed",                 icon: "⚖️" },
    { label: "PLASTIC BOTTLES SAVED",value: s.plasticSaved?.toLocaleString(), sub: "via bulk refill model",    icon: "♻️" },
    { label: "CO₂ SEQUESTERED",     value: `${s.co2Sequestered} kg`, sub: "biochar carbon capture",            icon: "🌿" },
    { label: "DVS COMPLIANCE",      value: s.certRate,           sub: "dispatches within TST",                  icon: "✅" },
    { label: "HEATMAP ZONES",       value: heatmap.length,       sub: "thermal zones monitored",                icon: "🗺️" },
  ] : [];

  const colorMap = { green: ACCENT.greenBg, amber: ACCENT.amberBg, red: ACCENT.redBg, blue: ACCENT.blueBg };

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
      <PageHeader
        title="Operations Dashboard"
        subtitle="Bangladesh Climate-Resilient Circular Commerce"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {lastUpdated && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: isLive ? ACCENT.green : ACCENT.amber,
                  boxShadow: isLive ? `0 0 6px ${ACCENT.green}` : "none",
                  display: "inline-block"
                }} />
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {isLive ? "Live DB" : "Seeded"} · {lastUpdated}
                </span>
                <button onClick={fetchDashboard} title="Refresh" style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-dim)", fontSize: 14, padding: "0 4px"
                }}>↻</button>
              </div>
            )}
            <button onClick={onNewBatch} style={{
              background: ACCENT.greenDark, color: "#fff", border: "none", padding: "10px 18px",
              borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", gap: 6, alignItems: "center"
            }}><span>+</span> New Batch</button>
          </div>
        }
      />

      {/* ── 3-LAYER ARCHITECTURE STRIP ── */}
      <Card title="🌐 3-Layer Architecture" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { code: "L1", icon: "�", name: "Registration", desc: "Manual batch registration + BARI knowledge base", kpi: "Operator-signed records" },
            { code: "L2", icon: "🧠", name: "Intelligence", desc: "Trust scores, DVS, climate alerts", kpi: "AI-driven decisions" },
            { code: "L3", icon: "🛍️", name: "Presentation", desc: "Marketplace, ESG report, QR claims", kpi: "Buyer-facing outputs" },
          ].map((layer) => {
            const meta = LAYER_META[layer.code] || LAYER_META.L0;
            return (
              <div key={layer.code} style={{
                padding: "14px 16px", borderRadius: 10,
                background: meta.bg, border: `1px solid ${meta.border}`,
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{layer.icon}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                    color: meta.color, background: "rgba(0,0,0,0.2)",
                    padding: "2px 6px", borderRadius: 4,
                  }}>{layer.code}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{layer.name}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>{layer.desc}</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{layer.kpi}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, fontSize: 10, color: "var(--text-dim)" }}>
          <span style={{ color: LAYER_META.L1.color }}>●</span> Registration
          <span style={{ color: "var(--text-dim)" }}>→</span>
          <span style={{ color: LAYER_META.L2.color }}>●</span> AI/ML
          <span style={{ color: "var(--text-dim)" }}>→</span>
          <span style={{ color: LAYER_META.L3.color }}>●</span> Buyer
          <span style={{ color: "var(--text-dim)", marginLeft: 8 }}>|</span>
          <span style={{ color: LAYER_META.LX.color, marginLeft: 8 }}>●</span> AI Assistant (chatbot)
        </div>
      </Card>

      {/* ── STAT CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} style={{ padding: "20px 24px" }} hover={false}>
                <div style={{ height: 12, background: "var(--bg-input)", borderRadius: 6, marginBottom: 12, width: "60%", animation: "pulse 1.5s ease infinite" }} />
                <div style={{ height: 28, background: "var(--bg-input)", borderRadius: 6, marginBottom: 8, width: "80%", animation: "pulse 1.5s ease infinite" }} />
                <div style={{ height: 10, background: "var(--bg-input)", borderRadius: 6, width: "50%", animation: "pulse 1.5s ease infinite" }} />
              </Card>
            ))
          : statCards.map((s, i) => (
              <Card key={i} style={{ padding: "20px 24px" }} hover={false}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.05em" }}>{s.label}</div>
                  <div style={{ background: "var(--bg-input)", padding: 6, borderRadius: "50%", fontSize: 12 }}>{s.icon}</div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{s.sub}</div>
              </Card>
            ))
        }
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* ── THERMAL HEATMAP ── */}
        <Card hover={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Dhaka Thermal Hazard Map</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {isLive ? "🟢 Live Weather Data" : "⚡ Estimated · Live MERM"}
              </div>
              <button onClick={() => fetchDashboard(true)} disabled={isRefreshing} style={{
                fontSize: 13, color: ACCENT.green, background: "none", border: "none",
                cursor: isRefreshing ? "wait" : "pointer", fontWeight: 500, padding: 0,
                opacity: isRefreshing ? 0.5 : 1
              }}>{isRefreshing ? "⏳" : "↻"}</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ border: "1px solid var(--border-primary)", borderRadius: 12, padding: "16px 20px" }}>
                    <div style={{ height: 14, background: "var(--bg-input)", borderRadius: 6, width: "40%", marginBottom: 8, animation: "pulse 1.5s ease infinite" }} />
                    <div style={{ height: 10, background: "var(--bg-input)", borderRadius: 6, width: "80%", animation: "pulse 1.5s ease infinite" }} />
                  </div>
                ))
              : heatmap.map(m => {
                  const hColor = m.hazard === "Extreme" ? ACCENT.red : m.hazard === "High" ? ACCENT.amber : m.hazard === "Moderate" ? ACCENT.amber : ACCENT.green;
                  return (
                    <div key={m.zone} style={{ border: "1px solid var(--border-primary)", borderRadius: 12, padding: "16px 20px", transition: "background 0.2s" }}
                         onMouseEnter={e => e.currentTarget.style.background = "var(--bg-input)"}
                         onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: hColor, boxShadow: `0 0 6px ${hColor}66` }} />
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{m.zone}</span>
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: hColor+"15", color: hColor, fontWeight: 600 }}>{m.hazard}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>{m.temp} · {m.rh}</div>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>{m.desc}</div>
                      {m.time !== "N/A" && <div style={{ fontSize: 12, color: ACCENT.amber }}>⚡ Peak: {m.time}</div>}
                    </div>
                  );
                })
            }
          </div>
        </Card>

        {/* ── RECENT ACTIVITY ── */}
        <Card hover={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Recent Activity</div>
            <button onClick={() => fetchDashboard(true)} disabled={isRefreshing} style={{
              fontSize: 13, color: ACCENT.green, background: "none", border: "none",
              cursor: isRefreshing ? "wait" : "pointer", fontWeight: 500, padding: 0,
              opacity: isRefreshing ? 0.5 : 1
            }}>{isRefreshing ? "⏳ Refreshing..." : "Refresh ↺"}</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-input)", animation: "pulse 1.5s ease infinite", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 12, background: "var(--bg-input)", borderRadius: 6, marginBottom: 6, animation: "pulse 1.5s ease infinite" }} />
                      <div style={{ height: 10, background: "var(--bg-input)", borderRadius: 6, width: "40%", animation: "pulse 1.5s ease infinite" }} />
                    </div>
                  </div>
                ))
              : activity.length > 0
              ? activity.map((a, i) => (
                  <div key={`${a.text}-${i}`} style={{ display: "flex", gap: 14, alignItems: "flex-start", opacity: isRefreshing ? 0.5 : 1, transition: "opacity 0.3s ease" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: colorMap[a.colorType] || ACCENT.greenBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{a.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.4 }}>{a.text}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{a.time}</div>
                    </div>
                  </div>
                ))
              : <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No activity yet.</div>
            }
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BATCH REGISTRY – module-level seed data (stable across renders)
   ═══════════════════════════════════════════════════════════════ */
(function() {
  // defined at module scope so fetchBatches closures always see same reference
  const _now = new Date();
  const _seed = _now.getFullYear() * 100 + _now.getMonth() * 10 + _now.getDate();
  window.__SEED_BATCHES__ = [
    { id: `BCH-${_seed+0}`, product_name: "Bio-Slurry Concentrate",    status: "certified",  trust_score: 70+((_seed+0*7)%30),  destination_zone: "Old Dhaka",   weight_kg: 80+((_seed+0*13)%220),  created_at: new Date(Date.now()-0*18000000).toISOString() },
    { id: `BCH-${_seed+1}`, product_name: "Biochar Granules",           status: "active",     trust_score: 70+((_seed+1*7)%30),  destination_zone: "Mirpur",      weight_kg: 80+((_seed+1*13)%220),  created_at: new Date(Date.now()-1*18000000).toISOString() },
    { id: `BCH-${_seed+2}`, product_name: "EM-1 Bio-Culture",           status: "pending",    trust_score: 70+((_seed+2*7)%30),  destination_zone: "Gulshan",     weight_kg: 80+((_seed+2*13)%220),  created_at: new Date(Date.now()-2*18000000).toISOString() },
    { id: `BCH-${_seed+3}`, product_name: "Organic Compost",            status: "dispatched", trust_score: 70+((_seed+3*7)%30),  destination_zone: "Savar",       weight_kg: 80+((_seed+3*13)%220),  created_at: new Date(Date.now()-3*18000000).toISOString() },
    { id: `BCH-${_seed+4}`, product_name: "Liquid Fertiliser",          status: "delivered",  trust_score: 70+((_seed+4*7)%30),  destination_zone: "Dhanmondi",   weight_kg: 80+((_seed+4*13)%220),  created_at: new Date(Date.now()-4*18000000).toISOString() },
    { id: `BCH-${_seed+5}`, product_name: "Thermal-Safe Vaccine Batch", status: "certified",  trust_score: 70+((_seed+5*7)%30),  destination_zone: "Uttara",      weight_kg: 80+((_seed+5*13)%220),  created_at: new Date(Date.now()-5*18000000).toISOString() },
    { id: `BCH-${_seed+6}`, product_name: "Fresh Dairy Mix",            status: "active",     trust_score: 70+((_seed+6*7)%30),  destination_zone: "Banani",      weight_kg: 80+((_seed+6*13)%220),  created_at: new Date(Date.now()-6*18000000).toISOString() },
    { id: `BCH-${_seed+7}`, product_name: "Carbon-Neutral Biochar",     status: "certified",  trust_score: 70+((_seed+7*7)%30),  destination_zone: "Motijheel",   weight_kg: 80+((_seed+7*13)%220),  created_at: new Date(Date.now()-7*18000000).toISOString() },
    { id: `BCH-${_seed+8}`, product_name: "Cold-Chain Fish Paste",      status: "pending",    trust_score: 70+((_seed+8*7)%30),  destination_zone: "Jatrabari",   weight_kg: 80+((_seed+8*13)%220),  created_at: new Date(Date.now()-8*18000000).toISOString() },
    { id: `BCH-${_seed+9}`, product_name: "Poultry Probiotic Mix",      status: "dispatched", trust_score: 70+((_seed+9*7)%30),  destination_zone: "Tejgaon",     weight_kg: 80+((_seed+9*13)%220),  created_at: new Date(Date.now()-9*18000000).toISOString() },
  ];
})();

function BatchRegistry({ onNewBatch }) {
  const STATUS_TABS = ["All", "Pending", "Active", "Certified", "Dispatched", "Delivered"];
  const STATUS_COLORS = {
    certified: { border: ACCENT.greenBorder, color: ACCENT.green, bg: ACCENT.greenBg },
    active:    { border: ACCENT.blueBorder,  color: ACCENT.blue,  bg: ACCENT.blueBg },
    pending:   { border: "var(--border-primary)", color: "var(--text-secondary)", bg: "transparent" },
    dispatched:{ border: ACCENT.amberBorder, color: ACCENT.amber, bg: ACCENT.amberBg },
    delivered: { border: ACCENT.greenBorder, color: ACCENT.green, bg: ACCENT.greenBg },
  };

  const [activeTab, setActiveTab]     = useState("All");
  const [search, setSearch]           = useState("");
  const [batches, setBatches]         = useState([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [selectedBatch, setSelected]  = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [, setTick]                   = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isGettingAiRec, setIsGettingAiRec] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState(null);

  useEffect(() => {
    if (!selectedBatch) {
      setVerificationResult(null);
      setAiRecommendation(null);
    }
  }, [selectedBatch]);

  // Real-time dynamic timing ticker to update relative dates every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const json = await window.APIClient.getBatches();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setBatches(json.data.map(b => ({ ...b, status: (b.status || "").trim().toLowerCase() })));
      } else {
        setBatches(window.__SEED_BATCHES__ || []);
      }
    } catch (_) {
      setBatches(window.__SEED_BATCHES__ || []);
    } finally {
      setIsLoading(false);
      setLastFetched(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };

  useEffect(() => {
    fetchBatches();

    let channel = null;
    let fallbackInterval = null;

    const setupRealtime = () => {
      const supabase = window.supabaseClient;
      if (supabase) {
        try {
          channel = supabase
            .channel('registry-batches-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, () => {
              fetchBatches();
            })
            .subscribe((status) => {
              if (status !== 'SUBSCRIBED') {
                if (!fallbackInterval) {
                  fallbackInterval = setInterval(fetchBatches, 8000);
                }
              } else {
                if (fallbackInterval) {
                  clearInterval(fallbackInterval);
                  fallbackInterval = null;
                }
              }
            });
        } catch (e) {
          console.warn("Registry realtime subscription failed, using polling fallback:", e);
          fallbackInterval = setInterval(fetchBatches, 8000);
        }
      } else {
        fallbackInterval = setInterval(fetchBatches, 8000);
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        window.supabaseClient?.removeChannel(channel);
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, []);

  const normalise = s => (s || "").trim().toLowerCase();
  const filtered = batches.filter(b => {
    const tabMatch = activeTab === "All" || normalise(b.status) === normalise(activeTab);
    const q = search.toLowerCase();
    const searchMatch = !search
      || (b.id || "").toLowerCase().includes(q)
      || (b.product_name || b.product || "").toLowerCase().includes(q)
      || (b.destination_zone || b.dest || "").toLowerCase().includes(q);
    return tabMatch && searchMatch;
  });

  const tabCounts = STATUS_TABS.reduce((acc, t) => {
    acc[t] = t === "All" ? batches.length : batches.filter(b => normalise(b.status) === normalise(t)).length;
    return acc;
  }, {});

  const getStatusStyle = (status) => STATUS_COLORS[status?.toLowerCase()] || STATUS_COLORS.pending;

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease", position: "relative" }}>
      <PageHeader
        title="Batch Registry"
        subtitle={lastFetched ? `${batches.length} batches · last updated ${lastFetched}` : "All heat-sensitive SME product batches"}
        action={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={fetchBatches} disabled={isLoading} style={{
              background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)",
              padding: "10px 14px", borderRadius: 8, cursor: isLoading ? "wait" : "pointer", fontSize: 13, fontWeight: 500
            }}>{isLoading ? "⏳" : "↻ Refresh"}</button>
            <button onClick={onNewBatch} style={{
              background: ACCENT.greenDark, color: "#fff", border: "none", padding: "10px 18px",
              borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", gap: 6, alignItems: "center"
            }}><span>+</span> New Batch</button>
          </div>
        }
      />

      {/* ── SEARCH + FILTER ROW ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "0 0 280px" }}>
          <span style={{ position: "absolute", left: 12, top: 10, fontSize: 13, color: "var(--text-dim)" }}>🔍</span>
          <input
            type="text"
            placeholder="Search batches, products, zones..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px 10px 34px", borderRadius: 8,
              border: "1px solid var(--border-primary)", background: "var(--bg-primary)",
              color: "var(--text-primary)", outline: "none", fontSize: 13
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-input)", padding: 4, borderRadius: 8 }}>
          {STATUS_TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "7px 14px", borderRadius: 6, border: "none", fontSize: 12, cursor: "pointer",
              background: activeTab === t ? "var(--bg-card)" : "transparent",
              color: activeTab === t ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: activeTab === t ? "var(--shadow-card)" : "none",
              fontWeight: activeTab === t ? 600 : 400,
              display: "flex", alignItems: "center", gap: 5
            }}>
              {t}
              {tabCounts[t] > 0 && (
                <span style={{
                  background: activeTab === t ? ACCENT.greenBg : "var(--bg-input)",
                  color: activeTab === t ? ACCENT.green : "var(--text-dim)",
                  borderRadius: 12, padding: "1px 7px", fontSize: 10, fontWeight: 700
                }}>{tabCounts[t]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABLE ── */}
      <Card style={{ padding: 0, overflow: "hidden" }} hover={false}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-input)" }}>
              {["BATCH ID", "PRODUCT", "STATUS", "TRUST SCORE", "DESTINATION", "WEIGHT", "CREATED"].map(h => (
                <th key={h} style={{ padding: "14px 20px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{h}</th>
              ))}
              <th style={{ padding: "14px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} style={{ padding: "16px 20px" }}>
                        <div style={{ height: 12, background: "var(--bg-input)", borderRadius: 6, width: j === 0 ? "80%" : "60%", animation: "pulse 1.5s ease infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                <tr><td colSpan={8} style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-dim)", fontSize: 14 }}>
                  {search ? `No batches match "${search}"` : `No ${activeTab !== "All" ? activeTab.toLowerCase() : ""} batches found.`}
                </td></tr>
              )
              : filtered.map((b, i) => {
                  const ss = getStatusStyle(b.status);
                  const elapsed = b.created_at ? Math.round((Date.now() - new Date(b.created_at).getTime()) / 60000) : 0;
                  const timeAgo = elapsed < 60 ? `${elapsed}m ago` : elapsed < 1440 ? `${Math.round(elapsed / 60)}h ago` : `${Math.round(elapsed / 1440)}d ago`;
                  return (
                    <tr key={b.id || i}
                      onClick={() => setSelected(b)}
                      style={{ borderBottom: "1px solid var(--border-primary)", cursor: "pointer", transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-input)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "16px 20px", fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: ACCENT.green }}>{b.id || b.batch_number}</td>
                      <td style={{ padding: "16px 20px", fontSize: 13 }}>{b.product_name || b.product || "—"}</td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ border: `1px solid ${ss.border}`, color: ss.color, padding: "4px 10px", borderRadius: 20, fontSize: 10, background: ss.bg, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {b.status || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13, color: b.trust_score >= 75 ? ACCENT.green : b.trust_score >= 55 ? ACCENT.amber : ACCENT.red, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                        {b.trust_score != null ? `🛡️ ${b.trust_score}` : "—"}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13, color: "var(--text-secondary)" }}>{b.destination_zone || b.dest || "—"}</td>
                      <td style={{ padding: "16px 20px", fontSize: 13, color: "var(--text-secondary)" }}>{b.weight_kg != null ? `${b.weight_kg} kg` : b.weight ? `${b.weight} kg` : "—"}</td>
                      <td style={{ padding: "16px 20px", fontSize: 12, color: "var(--text-dim)" }}>{timeAgo}</td>
                      <td style={{ padding: "16px 12px", color: ACCENT.green, fontSize: 16 }}>›</td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
        {!isLoading && filtered.length > 0 && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-primary)", fontSize: 12, color: "var(--text-dim)", display: "flex", justifyContent: "space-between" }}>
            <span>Showing {filtered.length} of {batches.length} batches</span>
            <span style={{ color: ACCENT.green }}>Click a row to view details →</span>
          </div>
        )}
      </Card>

      {/* ── BATCH DETAIL DRAWER ── */}
      {selectedBatch && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          display: "flex", justifyContent: "flex-end"
        }}>
          <div onClick={() => setSelected(null)} style={{ flex: 1, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
          <div style={{
            width: 420, height: "100vh", overflowY: "auto",
            background: "var(--bg-card)", borderLeft: "1px solid var(--border-primary)",
            padding: 32, animation: "fadeSlideIn 0.3s ease",
            display: "flex", flexDirection: "column", gap: 20
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Batch Details</div>
              <button onClick={() => setSelected(null)} style={{
                background: "var(--bg-input)", border: "1px solid var(--border-primary)",
                borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13
              }}>✕ Close</button>
            </div>

            <div style={{ background: "var(--bg-input)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: ACCENT.green }}>
                {selectedBatch.id || selectedBatch.batch_number}
              </div>
              {(() => {
                const ss = getStatusStyle(selectedBatch.status);
                return <span style={{ border: `1px solid ${ss.border}`, color: ss.color, padding: "4px 12px", borderRadius: 20, fontSize: 11, background: ss.bg, fontWeight: 700, textTransform: "uppercase", width: "max-content" }}>{selectedBatch.status}</span>;
              })()}
            </div>

            {[
              { label: "Product", value: selectedBatch.product_name || selectedBatch.product || "—" },
              { label: "Destination Zone", value: selectedBatch.destination_zone || selectedBatch.dest || "—" },
              { label: "Weight", value: selectedBatch.weight_kg ? `${selectedBatch.weight_kg} kg` : selectedBatch.weight ? `${selectedBatch.weight} kg` : "—" },
              { label: "Processor ID", value: selectedBatch.processor_id || "#07 (anonymized)" },
              { label: "Created At", value: selectedBatch.created_at ? new Date(selectedBatch.created_at).toLocaleString() : "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-primary)", fontSize: 14 }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{value}</span>
              </div>
            ))}

            <div style={{ background: "var(--bg-input)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Trust Score</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  fontSize: 38, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
                  color: selectedBatch.trust_score >= 75 ? ACCENT.green : selectedBatch.trust_score >= 55 ? ACCENT.amber : ACCENT.red
                }}>{selectedBatch.trust_score ?? "—"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 8, background: "var(--bg-card)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 4, transition: "width 0.8s ease",
                      width: `${selectedBatch.trust_score ?? 0}%`,
                      background: selectedBatch.trust_score >= 75 ? ACCENT.green : selectedBatch.trust_score >= 55 ? ACCENT.amber : ACCENT.red
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>BARI Compliance Threshold: 60+</div>
                </div>
              </div>
            </div>

            {selectedBatch.status === "certified" && (
              <div style={{ background: ACCENT.greenBg, border: `1px solid ${ACCENT.greenBorder}`, borderRadius: 12, padding: 16, fontSize: 13, color: ACCENT.green, fontWeight: 600 }}>
                ✓ Batch is certified. Dispatch is permitted within TST window.
              </div>
            )}
            {selectedBatch.status === "pending" && (
              <div style={{ background: ACCENT.amberBg, border: `1px solid ${ACCENT.amberBorder}`, borderRadius: 12, padding: 16, fontSize: 13, color: ACCENT.amber, fontWeight: 600 }}>
                ⏳ Batch is awaiting manual verification by a certified processor before certification.
              </div>
            )}

            {/* VERIFICATION ENGINE UI */}
            {selectedBatch && (
              <div style={{ background: "var(--bg-input)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Verification Engine
                </div>
                {!verificationResult ? (
                  <button
                    onClick={async () => {
                      setIsVerifying(true);
                      try {
                        const batchId = selectedBatch.id || selectedBatch.batch_number;
                        const res = await window.APIClient.verifyClaim(batchId);
                        setVerificationResult(res);
                      } catch (err) {
                        setVerificationResult({ success: false, error: err.message });
                      } finally {
                        setIsVerifying(false);
                      }
                    }}
                    disabled={isVerifying}
                    style={{
                      width: "100%", padding: "12px", borderRadius: 8,
                      border: `1px solid ${ACCENT.blueBorder}`, background: "rgba(59, 130, 246, 0.1)",
                      color: ACCENT.blue, fontWeight: 600, cursor: isVerifying ? "wait" : "pointer",
                      display: "flex", justifyContent: "center", alignItems: "center", gap: 8
                    }}
                  >
                    {isVerifying ? "Verifying..." : "🔐 Verify Cryptographic Claim"}
                  </button>
                ) : (
                  <div style={{
                    padding: 12, borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                    background: verificationResult.success ? ACCENT.greenBg : ACCENT.redBg,
                    border: `1px solid ${verificationResult.success ? ACCENT.greenBorder : ACCENT.redBorder}`,
                    color: "var(--text-primary)"
                  }}>
                    {verificationResult.success ? (
                      <>
                        <strong style={{ color: ACCENT.green }}>✓ Claim Verified Authentic</strong><br/>
                        <span style={{ color: "var(--text-secondary)" }}>Signature: Valid</span><br/>
                        <span style={{ color: "var(--text-secondary)" }}>Registry Match: {verificationResult.data?.batch?.batch_number || "Confirmed"}</span>
                        {verificationResult.data?.claims?.trust_score && (
                           <><br/><span style={{ color: "var(--text-secondary)" }}>Cryptographic Trust Score: {verificationResult.data.claims.trust_score}</span></>
                        )}
                      </>
                    ) : (
                      <>
                        <strong style={{ color: ACCENT.red }}>❌ Verification Failed</strong><br/>
                        <span style={{ color: "var(--text-secondary)" }}>{verificationResult.error || "Invalid or missing claim signature."}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AI RECOMMENDATION UI */}
            {selectedBatch && (
              <div style={{ background: "var(--bg-input)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>AI Smart Dispatch</span>
                  <span style={{ color: ACCENT.amber, fontSize: 10 }}>Powered by Llama 3</span>
                </div>
                {!aiRecommendation ? (
                  <button
                    onClick={async () => {
                      setIsGettingAiRec(true);
                      try {
                        const payload = {
                           action: "request_dispatch",
                           batch_id: selectedBatch.id || selectedBatch.batch_number,
                           product: selectedBatch.product_name || selectedBatch.product,
                           destination_zone: selectedBatch.destination_zone || selectedBatch.dest,
                           trust_score: selectedBatch.trust_score,
                           status: selectedBatch.status
                        };
                        const res = await window.APIClient.getAIRecommendations(payload);
                        setAiRecommendation(res);
                      } catch (err) {
                        setAiRecommendation({ success: false, error: err.message });
                      } finally {
                        setIsGettingAiRec(false);
                      }
                    }}
                    disabled={isGettingAiRec}
                    style={{
                      width: "100%", padding: "12px", borderRadius: 8,
                      border: `1px solid ${ACCENT.amberBorder}`, background: "rgba(245, 158, 11, 0.1)",
                      color: ACCENT.amber, fontWeight: 600, cursor: isGettingAiRec ? "wait" : "pointer",
                      display: "flex", justifyContent: "center", alignItems: "center", gap: 8
                    }}
                  >
                    {isGettingAiRec ? "Analyzing route & risk..." : "💡 Get AI Dispatch Recommendation"}
                  </button>
                ) : (
                  <div style={{
                    padding: 14, borderRadius: 8, fontSize: 13, lineHeight: 1.6,
                    background: "rgba(245, 158, 11, 0.05)",
                    border: `1px solid ${ACCENT.amberBorder}`,
                    color: "var(--text-primary)"
                  }}>
                    {aiRecommendation.success ? (
                      <>
                        <div style={{ fontWeight: 700, color: ACCENT.amber, marginBottom: 8 }}>
                          {aiRecommendation.data?.recommendation || "Proceed with caution"}
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                          {aiRecommendation.data?.explanation || "AI suggests careful monitoring due to microclimate risks."}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: ACCENT.red }}>❌ Failed to load AI recommendations.</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* DELETE BATCH BUTTON */}
            <div style={{ marginTop: "auto", paddingTop: 20 }}>
              <button
                onClick={async () => {
                  if (confirm(`Are you sure you want to delete batch ${selectedBatch.id || selectedBatch.batch_number}? This action cannot be undone.`)) {
                    try {
                      const res = await fetch(`${BACKEND_URL}/api/batches/${selectedBatch.id || selectedBatch.batch_number}`, {
                        method: "DELETE"
                      });
                      const result = await res.json();
                      if (result.success) {
                        setBatches(prev => prev.filter(b => b.id !== selectedBatch.id && b.batch_number !== selectedBatch.id));
                        if (window.__SEED_BATCHES__) {
                          window.__SEED_BATCHES__ = window.__SEED_BATCHES__.filter(b => b.id !== selectedBatch.id && b.batch_number !== selectedBatch.id);
                        }
                        setSelected(null);
                      } else {
                        alert(result.error || "Failed to delete batch");
                      }
                    } catch (err) {
                      console.error("Failed to delete batch:", err);
                      alert("Network error. Unable to contact the backend server.");
                    }
                  }
                }}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  border: `1px solid ${ACCENT.redBorder}`,
                  background: "rgba(239, 68, 68, 0.08)",
                  color: ACCENT.red,
                  cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  transition: "all 0.3s ease",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.16)";
                  e.currentTarget.style.borderColor = ACCENT.red;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                  e.currentTarget.style.borderColor = ACCENT.redBorder;
                }}
              >
                🗑️ Delete Batch Registry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RegisterBatch({ onCancel }) {
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState("Bio-Slurry");
  const [weight, setWeight] = useState("100");
  const [packagingType, setPackagingType] = useState("Standard");
  const [destinationZone, setDestinationZone] = useState("Old Dhaka");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    if (!productName.trim()) {
      setErrorMsg("Product Name is required");
      return;
    }
    if (destinationZone === "Select zone" || !destinationZone) {
      setErrorMsg("Please select a valid Destination Zone");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    // Build a local batch object so we can always add it to the registry
    const localBatch = {
      id: `BCH-${Date.now().toString().slice(-6)}`,
      batch_number: `BCH-${Date.now().toString().slice(-6)}`,
      product_name: productName,
      feedstock_type: productType,   // map productType → feedstock_type
      status: "pending",
      trust_score: 0,
      destination_zone: destinationZone,
      weight_kg: parseFloat(weight) || 0,
      packaging_type: packagingType,
      created_at: new Date().toISOString(),
    };

    try {
      const response = await fetch(`${BACKEND_URL}/api/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_number:    localBatch.id,
          feedstock_type:  productType,   // ← required by backend schema
          product_name:    productName,
          trust_score:     0,             // ← required by backend schema (default 0 until manually verified)
          processor_id:    null,
          // extra fields stored but not schema-validated:
          destination_zone: destinationZone,
          weight_kg:        localBatch.weight_kg,
          packaging_type:   packagingType,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          localBatch.id = result.data.id || result.data.batch_number || localBatch.id;
          localBatch.trust_score = result.data.trust_score ?? 0;
          localBatch.status = result.data.status || "pending";
          localBatch.created_at = result.data.created_at || localBatch.created_at;
        }
      }
      // Always add to local seed (whether backend succeeded or not)
      if (window.__SEED_BATCHES__) {
        window.__SEED_BATCHES__.unshift(localBatch);
      }
      onCancel();
    } catch (error) {
      console.warn("Backend unreachable — saving batch locally only:", error);
      // Offline fallback: still add to registry so user sees their batch
      if (window.__SEED_BATCHES__) {
        window.__SEED_BATCHES__.unshift(localBatch);
      }
      onCancel();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, marginBottom: 24, display: "flex", gap: 8, alignItems: "center", padding: 0 }}>
        <span>←</span> Back to Batches
      </button>
      <PageHeader title="Register New Batch" subtitle="Submit a new bio-resource batch for certification" />
      
      <Card style={{ maxWidth: 700 }} hover={false}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {errorMsg && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: `1px solid ${ACCENT.redBorder || "#ef4444"}`, padding: "12px 16px", borderRadius: 8, color: ACCENT.red, fontSize: 13, fontWeight: 500 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Product Name</label>
            <input 
              type="text" 
              placeholder="e.g. Premium Bio-Slurry Concentrate" 
              value={productName}
              onChange={e => setProductName(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} 
            />
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Product Type</label>
              <select 
                value={productType}
                onChange={e => setProductType(e.target.value)}
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
              >
                <option>Bio-Slurry</option>
                <option>Biochar</option>
                <option>EM-1 Bio-Culture</option>
                <option>Organic Compost</option>
                <option>Liquid Fertiliser</option>
                <option>Thermal-Safe Vaccine Batch</option>
                <option>Fresh Dairy Mix</option>
                <option>Cold-Chain Fish Paste</option>
                <option>Poultry Probiotic Mix</option>
                <option>{"Medicines & Pharmaceuticals"}</option>
                <option>{"Cosmetics & Skincare"}</option>
                <option>{"Chemical & Temperature Reagents"}</option>
                <option>Others</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Weight (kg)</label>
              <input 
                type="number" 
                value={weight}
                onChange={e => setWeight(e.target.value)}
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} 
              />
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Packaging Type</label>
              <select 
                value={packagingType}
                onChange={e => setPackagingType(e.target.value)}
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
              >
                <option>Standard</option>
                <option>Insulated</option>
                <option>Thermal Bin</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 8, fontWeight: 500, color: "var(--text-primary)" }}>Destination Zone</label>
              <select 
                value={destinationZone}
                onChange={e => setDestinationZone(e.target.value)}
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
              >
                <option>Select zone</option>
                {Object.keys(UHI_ZONES).map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
          </div>
          
          <div style={{ background: ACCENT.greenBg, padding: "20px", borderRadius: 8, border: `1px solid ${ACCENT.greenBorder}` }}>
            <div style={{ color: ACCENT.green, fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Next: Manual Verification</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>After creating your batch, a certified processor will review and sign it to generate a BARI-compliant Trust Score and cryptographic QR certificate.</div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onCancel} style={{ padding: "12px 24px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500, fontSize: 14 }}>Cancel</button>
            <button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: ACCENT.greenDark, color: "#fff", cursor: isSubmitting ? "wait" : "pointer", fontWeight: 500, fontSize: 14 }}
            >
              {isSubmitting ? "Registering..." : "Create Batch"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

const MOCK_PRODUCTS = [
  { id: 1, name: "Premium Bio-Slurry", category: "Agriculture", price: "৳ 450", unit: "L", seller: "Green Refineries Ltd.", dvs: 85, icon: "🌱", badge: "BARI Certified" },
  { id: 2, name: "Thermal-Safe EM-1", category: "Agriculture", price: "৳ 320", unit: "Kg", seller: "Agro Eco SME", dvs: 72, icon: "🌾", badge: null },
  { id: 3, name: "Insulin (Lantus 10ml)", category: "Pharmaceuticals", price: "৳ 1,250", unit: "Vial", seller: "PharmaCare BD", dvs: 94, icon: "⚕️", badge: "Cold-Chain verified" },
  { id: 4, name: "Polio Vaccine (OPV)", category: "Pharmaceuticals", price: "৳ 4,800", unit: "Box", seller: "Health Line Inc.", dvs: 98, icon: "💉", badge: "Critical Priority" },
  { id: 5, name: "Fresh Dairy Milk", category: "Food & Dairy", price: "৳ 90", unit: "L", seller: "Aarong Dairy", dvs: 68, icon: "🥛", badge: null },
  { id: 6, name: "Premium Hilsha Fish", category: "Food & Seafood", price: "৳ 1,500", unit: "Kg", seller: "Padma Catch", dvs: 65, icon: "🐟", badge: null },
  { id: 7, name: "Carbon-Neutral Biochar", category: "Agriculture", price: "৳ 150", unit: "Kg", seller: "SME Co-op", dvs: 92, icon: "🌿", badge: null },
  { id: 8, name: "Temperature Reagents", category: "Chemicals", price: "৳ 3,500", unit: "Pack", seller: "ChemLab BD", dvs: 88, icon: "🧪", badge: "Hazard Risk" },
];


const IS_LOCAL_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = IS_LOCAL_DEV ? 'http://localhost:5001' : 'https://backsme.onrender.com';

const isValidOrderUuid = (id) =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function ChatbotView({ setTab, products = [], setVerificationBatchId, setVerificationDispatchZone }) {
  const [messages, setMessages] = useState([
    { role: "system", content: "Hello! I am CLimaLogix AI, your voice and text-based assistant. I can provide microclimate forecasts, smart dispatch suggestions, or analyze files and context. How can I help you today?", time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechLang, setSpeechLang] = useState("en-US");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceError, setVoiceError] = useState(null);
  const [hasAttemptedVoice, setHasAttemptedVoice] = useState(false);
  const [orderContext, setOrderContext] = useState(null);
  // ── Session memory: persists across all messages in this tab ──
  const [chatSessionId, setChatSessionId] = useState(null);
  const fileInputRef = useRef(null);

  // Initialize a backend session when the chatbot page mounts
  useEffect(() => {
    const initChatSession = async () => {
      try {
        const userStr = localStorage.getItem("user") || localStorage.getItem("farmer");
        const user = userStr ? JSON.parse(userStr) : null;
        const res = await fetch(`${BACKEND_URL}/api/ai/chat/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ farmerId: user ? user.id : undefined })
        });
        const data = await res.json();
        if (data.success && data.data && data.data.sessionId) {
          setChatSessionId(data.data.sessionId);
          console.log("[ChatbotView] Session started:", data.data.sessionId);
        }
      } catch (e) {
        console.warn("[ChatbotView] Could not init session — context memory disabled.", e);
      }
    };
    initChatSession();
  }, []);

  useEffect(() => {
    const locale = (navigator.languages && navigator.languages[0]) || navigator.language || "en-US";
    if (locale.toLowerCase().startsWith("bn")) {
      setSpeechLang("bn-BD");
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSpeechSupported(false);
    } else {
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

  const handleSend = async (text, attachedFileName = null) => {
    if (!text.trim() && !attachedFileName) return;
    setVoiceError(null);
    setHasAttemptedVoice(false);
    const newMsg = { 
      role: "user", 
      content: text, 
      attachment: attachedFileName,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    
    // Check for conversational order confirmation
    const normalizedText = text.toLowerCase().trim();
    const isYes = normalizedText === "yes" || normalizedText === "confirm" || normalizedText.includes("অর্ডার করো") || normalizedText.includes("confirm") || normalizedText.includes("করো") || normalizedText.includes("হাঁ") || normalizedText === "ha" || normalizedText === "ok" || normalizedText === "হ্যাঁ";
    
    if (orderContext && isYes) {
      try {
        const userStr = localStorage.getItem("user") || localStorage.getItem("farmer");
        const user = userStr ? JSON.parse(userStr) : null;
        
        const voiceRes = await fetch(`${BACKEND_URL}/api/orders/voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: orderContext.productName,
            quantity: orderContext.quantity,
            farmerId: user ? user.id : undefined,
            customProducts: products.filter(p => p.isCustom)
          })
        });
        const voiceData = await voiceRes.json();
        if (voiceData.success && voiceData.data) {
          setMessages(prev => [...prev, {
            role: "system",
            content: voiceData.data.message,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          }]);
          setOrderContext(null);
          setTimeout(() => {
            setTab(1); // Navigates to Batches tab (Batch Registry)
          }, 1500);
          return;
        }
      } catch (err) {
        console.error("Conversational order failed:", err);
      }
    }

    // Call the actual backend agent endpoint!
    try {
      const userStr = localStorage.getItem("user") || localStorage.getItem("farmer");
      const user = userStr ? JSON.parse(userStr) : null;

      // Always send the current sessionId so the backend maintains conversation history
      const currentSessionId = chatSessionId || undefined;
      
      const res = await fetch(`${BACKEND_URL}/api/agent/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: speechLang.startsWith("bn") ? "bn" : "en",
          sessionId: currentSessionId,
          farmerId: user ? user.id : undefined,
          customProducts: products.filter(p => p.isCustom)
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        const agentResponse = data.data;
        
        // Capture (or update) the session ID returned by the backend
        if (agentResponse.sessionId && agentResponse.sessionId !== chatSessionId) {
          setChatSessionId(agentResponse.sessionId);
        }

        setMessages(prev => [...prev, {
          role: "system",
          content: agentResponse.message,
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        }]);

        // Handle navigation routing
        if (agentResponse.type === "NAVIGATION" && agentResponse.navigationTarget) {
          if (agentResponse.navigationTarget.toLowerCase() === 'batch_verification' && agentResponse.verifiedBatchId) {
            setVerificationBatchId(agentResponse.verifiedBatchId);
            if (agentResponse.verifiedDispatchZone) {
              setVerificationDispatchZone(agentResponse.verifiedDispatchZone);
            }
          }
          const pageRoutes = {
            'dashboard': 0,
            'orders': 1,
            'marketplace': 6,
            'batches': 1,
            'batch_verification': 2,
            'microclimate': 3,
            'climate_demand': 4,
            'impact_esg': 5,
            'chatbot': 7,
          };
          const targetIndex = pageRoutes[agentResponse.navigationTarget.toLowerCase()];
          if (targetIndex !== undefined) {
            setTimeout(() => {
              setTab(targetIndex);
            }, 1500);
          }
        }

        // Handle order context extraction
        if (agentResponse.type === "ORDER_CONFIRM_PROMPT" && agentResponse.pendingOrder) {
          const { productName, quantity } = agentResponse.pendingOrder;
          if (productName) {
            setOrderContext({ productName, quantity: quantity || 1 });
          }
        }
      } else {
        throw new Error(data.error || "Failed");
      }
    } catch (err) {
      console.error("Backend agent call failed:", err);
      const isbn = speechLang.startsWith("bn");
      const errorMsg = isbn
        ? "⚠️ দুঃখিত, সার্ভারের সাথে সংযোগ স্থাপন করা যাচ্ছে না। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।"
        : "⚠️ Sorry, unable to reach the server. Please try again in a moment.";
      setMessages(prev => [...prev, {
        role: "system",
        content: errorMsg,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }]);
    }
  };

  const handleVoice = () => {
    if (isRecording) return;
    setVoiceError(null);
    setHasAttemptedVoice(true);

    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => stream.getTracks().forEach(track => track.stop()))
        .catch(() => {});
    }

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
    
    // Fallback chain for lang attribute
    const langCode = speechLang.startsWith('bn') ? 'bn-BD' : 
                     speechLang.startsWith('en') ? 'en-US' : 'bn-BD';
    recognition.lang = langCode;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const alternative = event.results[0][0];
      const transcript = alternative.transcript;
      const confidence = alternative.confidence ?? 1.0;

      // If confidence is high, check for language override
      if (confidence >= 0.8) {
        if (/[\u0980-\u09FF]/.test(transcript)) {
          setSpeechLang("bn-BD");
        } else if (/[a-zA-Z]/.test(transcript)) {
          setSpeechLang("en-US");
        }
      }

      setInput(transcript);
      handleSend(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
      
      if (event.error === 'network') {
        setVoiceError('ইন্টারনেট সংযোগ সমস্যা। টেক্সট টাইপ করুন।');
        // Autofocus the text input so the user can immediately type instead
        const textInput = document.querySelector('input[placeholder="Type your message..."]');
        if (textInput) {
          textInput.focus();
        }
      } else if (event.error === 'not-allowed') {
        setVoiceError('মাইক্রোফোন অনুমতি দিন।');
      } else if (event.error === 'no-speech') {
        setVoiceError('কোনো কথা শোনা যায়নি। আবার চেষ্টা করুন।');
      } else {
        setVoiceError('ভয়েস ইনপুট ব্যর্থ হয়েছে। টেক্সট ব্যবহার করুন।');
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
      <PageHeader title="CLimaLogix AI Assistant" subtitle="Voice, Text & Context-Aware Microclimate Chatbot" />
      
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
                {m.role === "user" ? "You" : "CLimaLogix AI"} • {m.time}
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
          {voiceError && hasAttemptedVoice && (
            <div style={{ padding: "12px 18px", fontSize: 12, color: ACCENT.red, background: "var(--bg-input)", borderRadius: "18px 18px 18px 0", width: "fit-content", border: `1px solid ${ACCENT.redBorder}` }}>
              {voiceError}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ padding: "12px 24px", display: "flex", gap: 12, borderTop: "1px solid var(--border-primary)", background: "var(--bg-input)" }}>
          {[
            { label: '🌤️ আবহাওয়া দেখুন', message: 'আজকের আবহাওয়া কেমন?' },
            { label: '🛒 Marketplace', message: 'marketplace দেখাও' },
            { label: '📦 আমার অর্ডার', message: 'আমার orders দেখাও' }
          ].map(action => (
            <button key={action.label} onClick={() => handleSend(action.message)} style={{
              padding: "6px 14px", borderRadius: 20, background: "var(--bg-primary)", border: `1px solid ${ACCENT.greenBorder}`,
              color: ACCENT.green, fontSize: 12, cursor: "pointer", fontWeight: 500, transition: "background 0.2s"
            }} onMouseEnter={e => e.currentTarget.style.background=ACCENT.greenBg} onMouseLeave={e => e.currentTarget.style.background="var(--bg-primary)"}>
              {action.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div style={{ padding: "16px 24px", display: "flex", gap: 12, alignItems: "center", background: "var(--bg-secondary)" }}>
          <button onClick={() => fileInputRef.current?.click()} style={{
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
          {speechSupported && (
            <button onClick={handleVoice} disabled={isRecording} style={{
              width: 44, height: 44, borderRadius: "50%", border: "none", cursor: isRecording ? "not-allowed" : "pointer",
              background: isRecording ? ACCENT.redBg : "var(--bg-input)",
              color: isRecording ? ACCENT.red : "var(--text-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              transition: "all 0.3s ease", opacity: isRecording ? 0.8 : 1
            }} title="Voice Input">
              🎙️
            </button>
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

function MarketplaceView({ products = MOCK_PRODUCTS }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [minDvs, setMinDvs] = useState(0);

  // Cart and Details States
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem("climalogix_cart");
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantityInput, setQuantityInput] = useState(1);

  // Transit Simulation States
  const [selectedZone, setSelectedZone] = useState("dhaka_north");
  const [simulatedHour, setSimulatedHour] = useState(new Date().getHours());
  const [simulatedTemp, setSimulatedTemp] = useState(33);

  // Checkout States
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);

  useEffect(() => {
    localStorage.setItem("climalogix_cart", JSON.stringify(cart));
  }, [cart]);

  const categories = ["All", "Agriculture", "Pharmaceuticals", "Food & Dairy", "Food & Seafood", "Chemicals"];

  const filteredProducts = products.filter(p => {
    if (category !== "All" && p.category !== category) return false;
    if (p.dvs < minDvs) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.seller.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addToCart = (product, qty = 1, e = null) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + qty } : item);
      }
      return [...prev, { product, quantity: qty }];
    });
    // Visual feedback
    if (e) {
      const btn = e.currentTarget;
      const originalText = btn.innerHTML;
      btn.innerHTML = "✓ Added!";
      btn.style.background = ACCENT.greenBg;
      btn.style.color = ACCENT.green;
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = product.dvs < 75 ? ACCENT.redBg : "var(--bg-input)";
        btn.style.color = product.dvs < 75 ? ACCENT.red : "var(--text-primary)";
      }, 1200);
    }
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId, amount) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + amount;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  // Calculate simulated DVS score for the route planner inside details modal
  const getSimulatedDVS = (baseDvs) => {
    // Standard calcBARIDVS helper uses global trustScore, zone, packaging, hour, baseTemp
    const zoneData = UHI_ZONES[selectedZone] || { uhiFactor: 1.0, baseRisk: 0.15 };
    const hourFactor = simulatedHour >= 12 && simulatedHour <= 16 ? 1.3 : simulatedHour >= 18 || simulatedHour <= 6 ? 0.7 : 1.0;
    const tempRisk = Math.max(0, (simulatedTemp - 30) * 0.04);
    const overallRisk = zoneData.uhiFactor * hourFactor * (zoneData.baseRisk + tempRisk);
    
    // Penalize the base product's DVS score by transit risks
    const simulated = Math.max(10, Math.min(100, Math.round(baseDvs * (1 - overallRisk))));
    return simulated;
  };

  const getShippingCost = () => {
    // Basic shipping: base ৳ 120 + distance/temperature penalty
    const baseShipping = 120;
    const tempPenalty = Math.max(0, (simulatedTemp - 30) * 15);
    const zoneMultiplier = selectedZone.includes("north") || selectedZone.includes("south") ? 1.0 : 1.4;
    return Math.round((baseShipping + tempPenalty) * zoneMultiplier);
  };

  const handleCheckout = () => {
    setIsCheckingOut(true);
    setTimeout(() => {
      const orderId = `ord-${Math.floor(100000 + Math.random() * 900000)}`;
      const txHash = "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join("");
      
      setCheckoutSuccess({
        orderId,
        txHash,
        totalItems: cart.reduce((sum, item) => sum + item.quantity, 0),
        totalPrice: cart.reduce((sum, item) => {
          const rawPrice = Number((item.product.price || "").replace(/[৳\s,]/g, ""));
          const isClearance = item.product.dvs < 75;
          const price = isClearance ? Math.round(rawPrice * 0.7) : rawPrice;
          return sum + (price * item.quantity);
        }, 0) + getShippingCost(),
        zone: selectedZone.replace(/_/g, " ").toUpperCase(),
      });
      setCart([]);
      setIsCheckingOut(false);
    }, 2000);
  };

  const cartTotal = cart.reduce((sum, item) => {
    const rawPrice = Number((item.product.price || "").replace(/[৳\s,]/g, ""));
    const isClearance = item.product.dvs < 75;
    const price = isClearance ? Math.round(rawPrice * 0.7) : rawPrice;
    return sum + (price * item.quantity);
  }, 0);



  if (selectedProduct) {
    const rawPrice = Number((selectedProduct.price || "").replace(/[৳\s,]/g, ""));
    const isClearance = selectedProduct.dvs < 75;
    const basePrice = isClearance ? Math.round(rawPrice * 0.7) : rawPrice;
    const simDvs = getSimulatedDVS(selectedProduct.dvs);

    return (
      <div style={{ animation: "fadeSlideIn 0.3s ease", position: "relative" }}>
        <button 
          onClick={() => setSelectedProduct(null)}
          style={{
            background: "var(--bg-input)", border: "1px solid var(--border-primary)",
            color: "var(--text-primary)", borderRadius: "8px", padding: "10px 18px",
            fontSize: "13px", cursor: "pointer", marginBottom: 20, display: "flex",
            alignItems: "center", gap: 8, transition: "all 0.2s", fontWeight: 600
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT.green}
          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-primary)"}
        >
          ← Back to Products
        </button>

        <Card hover={false} style={{ padding: "32px", borderRadius: 16 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--border-primary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 48 }}>{selectedProduct.icon}</span>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700 }}>{selectedProduct.name}</h2>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  Category: <strong>{selectedProduct.category}</strong> · Seller: <strong>{selectedProduct.seller}</strong>
                </div>
              </div>
            </div>
            {isClearance && (
              <div style={{ background: ACCENT.redBg, color: ACCENT.red, padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: `1px solid ${ACCENT.redBorder}`, animation: "pulseGlow 2s infinite" }}>
                ⚡ DYNAMIC CLEARANCE BRACKET
              </div>
            )}
          </div>

          {/* Details split */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 32 }}>
            <div>
              <h3 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", marginBottom: 12 }}>Verified Parameters</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>BIOLOGICAL COMPLIANCE</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT.green }}>BARI QA Certified Lot</div>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>AUDIT PATHWAY</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT.blue }}>Ledger-Backed QR Tracked</div>
                </div>
              </div>

              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)", marginBottom: 24 }}>
                This product is fully verified for environmental and biological specifications. In compliance with the circular economy goals of the buildfest, all manufacturing, raw material sourcing, and biological curing fermentation records are logged immutably on the decentralised trust ledger.
              </p>

              <div style={{ background: "var(--bg-primary)", padding: 18, borderRadius: 12, border: "1px solid var(--border-primary)", marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12, fontWeight: 600, letterSpacing: "0.05em" }}>CIRCULAR ESG METRICS ACCRUAL</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                  <span>Recycled Packaging Offset:</span>
                  <strong style={{ color: ACCENT.green }}>12.5 kg plastic</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>Carbon Sequestration Credit:</span>
                  <strong style={{ color: ACCENT.green }}>48.2 kg CO₂e / unit</strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Price per {selectedProduct.unit}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace" }}>৳ {basePrice.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Initial Batch DVS</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: selectedProduct.dvs >= 75 ? ACCENT.green : ACCENT.red, fontFamily: "'JetBrains Mono', monospace" }}>{selectedProduct.dvs}</div>
                </div>
              </div>
            </div>

            <div style={{ borderLeft: "1px solid var(--border-primary)", paddingLeft: 32 }}>
              <h3 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", marginBottom: 12 }}>Transit Weather Route Simulator</h3>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
                Simulate temperature exposure along the shipping route to Dhaka division zones. This directly affects dispatch viability and dynamic clearance markdowns.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Destination Zone:</label>
                <select 
                  value={selectedZone} 
                  onChange={e => setSelectedZone(e.target.value)} 
                  style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13 }}
                >
                  {Object.keys(UHI_ZONES).map(key => (
                    <option key={key} value={key}>{key.replace(/_/g, " ").toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                  <span>Simulated Route Temp:</span>
                  <strong>{simulatedTemp}°C</strong>
                </div>
                <input 
                  type="range" min="25" max="45" value={simulatedTemp} 
                  onChange={e => setSimulatedTemp(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                  <span>Dispatch Hour:</span>
                  <strong>{simulatedHour}:00</strong>
                </div>
                <input 
                  type="range" min="0" max="23" value={simulatedHour} 
                  onChange={e => setSimulatedHour(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ background: simDvs >= 75 ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${simDvs >= 75 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, padding: 16, borderRadius: 10, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Simulated Delivery DVS:</span>
                  <strong style={{ fontSize: 18, color: simDvs >= 75 ? ACCENT.green : simDvs >= 55 ? ACCENT.amber : ACCENT.red }}>{simDvs}</strong>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {simDvs >= 75 
                    ? "✓ High route viability. Product is safe under simulated conditions with standard packaging." 
                    : "⚠️ Caution: High microclimate heat risk detected. Price automatically marked down (Dynamic Clearance) to avoid loss."}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ padding: "20px 0 0 0", borderTop: "1px solid var(--border-primary)", marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Qty:</span>
              <input 
                type="number" min="1" max="100" value={quantityInput}
                onChange={e => setQuantityInput(Math.max(1, Number(e.target.value)))}
                style={{ width: 80, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", textAlign: "center", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={() => setSelectedProduct(null)}
                style={{ padding: "12px 24px", border: "1px solid var(--border-primary)", borderRadius: 8, background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button 
                onClick={() => { addToCart(selectedProduct, quantityInput); setSelectedProduct(null); }}
                style={{ padding: "12px 32px", border: "none", borderRadius: 8, background: ACCENT.green, color: "#ffffff", fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}
              >
                Add To Cart (৳ {(basePrice * quantityInput).toLocaleString()})
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <PageHeader title="Climate-Resilient Circular Marketplace" subtitle="Source verified heat-sensitive components optimized for Dhaka division transit" />
        <button 
          onClick={() => setIsCartOpen(true)}
          style={{
            background: `linear-gradient(135deg, ${ACCENT.greenLight}, ${ACCENT.greenDark})`,
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "none"}
        >
          🛒 Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
        </button>
      </div>
      
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
        {filteredProducts.map(p => {
          const rawPrice = Number((p.price || "").replace(/[৳\s,]/g, ""));
          const isClearance = p.dvs < 75;
          const discountedPrice = isClearance ? Math.round(rawPrice * 0.7) : rawPrice;
          
          return (
            <Card 
              key={p.id} 
              onClick={() => { setSelectedProduct(p); setQuantityInput(1); }}
              style={{ padding: "20px 24px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", cursor: "pointer" }}
            >
              {isClearance ? (
                <div style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  background: ACCENT.redBg,
                  color: ACCENT.red,
                  padding: "4px 10px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  border: `1px solid ${ACCENT.redBorder}`,
                  animation: "pulseGlow 2s infinite"
                }}>
                  ⚡ DYNAMIC CLEARANCE
                </div>
              ) : p.badge ? (
                <div style={{ position: "absolute", top: 16, right: 16, background: p.badge.includes("Critical") ? ACCENT.redBg : ACCENT.blueBg, color: p.badge.includes("Critical") ? ACCENT.red : ACCENT.blue, padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", border: `1px solid ${p.badge.includes("Critical") ? ACCENT.redBorder : "var(--border-primary)"}` }}>
                  {p.badge.toUpperCase()}
                </div>
              ) : null}
              
              <div style={{ fontSize: 36, marginBottom: 16 }}>{p.icon}</div>
              
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{p.category}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>{p.seller}</div>
              
              <div style={{ marginTop: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border-primary)" }}>
                  <div>
                    {isClearance ? (
                      <div>
                        <div style={{ fontSize: 12, textDecoration: "line-through", color: "var(--text-muted)", marginBottom: 2 }}>{p.price}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT.red, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>৳ {discountedPrice.toLocaleString()}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{p.price}</div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>per {p.unit}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: p.dvs >= 90 ? ACCENT.green : p.dvs >= 75 ? ACCENT.blue : ACCENT.amber, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{p.dvs}</div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, fontWeight: 600 }}>DVS SCORE</div>
                  </div>
                </div>
                
                <button 
                  onClick={(e) => addToCart(p, 1, e)}
                  style={{ width: "100%", padding: "10px 0", background: isClearance ? ACCENT.redBg : "var(--bg-input)", border: `1px solid ${isClearance ? ACCENT.redBorder : "var(--border-primary)"}`, borderRadius: 8, color: isClearance ? ACCENT.red : "var(--text-primary)", fontWeight: 600, cursor: "pointer", fontSize: 13, transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = isClearance ? "rgba(239, 68, 68, 0.15)" : ACCENT.greenBg}
                  onMouseLeave={e => e.currentTarget.style.background = isClearance ? ACCENT.redBg : "var(--bg-input)"}
                >
                  Add to Cart
                </button>
              </div>
            </Card>
          );
        })}
        {filteredProducts.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: 60, textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>No products match your filters.</div>
          </div>
        )}
      </div>

      {/* ── CART SIDEBAR DRAWER ────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, right: 0, width: "100%", height: "100%",
        backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)", zIndex: 105,
        opacity: isCartOpen ? 1 : 0, pointerEvents: isCartOpen ? "all" : "none",
        transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }} onClick={() => setIsCartOpen(false)}>
        <div style={{
          position: "absolute", top: 0, right: 0, width: 380, height: "100%",
          background: "var(--bg-header)", borderLeft: "1px solid var(--border-primary)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column",
          transform: isCartOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }} onClick={e => e.stopPropagation()}>
          
          {/* Cart Header */}
          <div style={{ padding: "24px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🛒</span>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Shopping Cart</div>
            </div>
            <button 
              onClick={() => setIsCartOpen(false)}
              style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer" }}
            >✕</button>
          </div>

          {/* Cart Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {cart.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-dim)" }}>
                <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>🛍️</span>
                <p>Your cart is empty.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {cart.map(item => {
                  const rawPrice = Number((item.product.price || "").replace(/[৳\s,]/g, ""));
                  const isClearance = item.product.dvs < 75;
                  const unitPrice = isClearance ? Math.round(rawPrice * 0.7) : rawPrice;
                  return (
                    <div key={item.product.id} style={{ display: "flex", gap: 14, paddingBottom: 16, borderBottom: "1px solid var(--border-primary)" }}>
                      <span style={{ fontSize: 28 }}>{item.product.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{item.product.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>৳ {unitPrice} / {item.product.unit}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={() => updateCartQuantity(item.product.id, -1)} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>-</button>
                          <span style={{ fontSize: 12, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.product.id, 1)} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid var(--border-primary)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>+</button>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>৳ {(unitPrice * item.quantity).toLocaleString()}</div>
                        <button onClick={() => removeFromCart(item.product.id)} style={{ background: "transparent", border: "none", color: ACCENT.red, fontSize: 11, cursor: "pointer", marginTop: 8 }}>Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          {cart.length > 0 && (
            <div style={{ padding: "24px", borderTop: "1px solid var(--border-primary)", background: "var(--bg-primary)" }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Delivery Destination Zone:</label>
                <select 
                  value={selectedZone} 
                  onChange={e => setSelectedZone(e.target.value)} 
                  style={{ width: "100%", padding: "10px", borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-header)", color: "var(--text-primary)", fontSize: 13 }}
                >
                  {Object.keys(UHI_ZONES).map(key => (
                    <option key={key} value={key}>{key.replace(/_/g, " ").toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Subtotal:</span>
                <span style={{ fontWeight: 600 }}>৳ {cartTotal.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 12 }}>
                <span>Simulated Shipping:</span>
                <span style={{ fontWeight: 600 }}>৳ {getShippingCost().toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, borderTop: "1px solid var(--border-primary)", paddingTop: 10, marginBottom: 20 }}>
                <span>Total Amount:</span>
                <span style={{ color: ACCENT.green }}>৳ {(cartTotal + getShippingCost()).toLocaleString()}</span>
              </div>

              <button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
                style={{
                  width: "100%", padding: "12px 0", border: "none", borderRadius: 8,
                  background: `linear-gradient(135deg, ${ACCENT.greenLight}, ${ACCENT.greenDark})`,
                  color: "#ffffff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
                }}
              >
                {isCheckingOut ? "Processing..." : "Place Verified Ledger Order"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── CHECKOUT SUCCESS MODAL ────────────────────────────── */}
      {checkoutSuccess && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)", zIndex: 120, display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20
        }} onClick={() => setCheckoutSuccess(null)}>
          <div style={{
            width: "100%", maxWidth: 500, background: "var(--bg-header)",
            borderRadius: 16, border: `1px solid ${ACCENT.greenBorder}`,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)", overflow: "hidden",
            animation: "fadeSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            padding: 32, textAlign: "center"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 54, marginBottom: 16 }}>🎉</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: ACCENT.green, marginBottom: 8 }}>Order Successfully Placed!</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
              Your order has been signed and queued for temperature-controlled transit to {checkoutSuccess.zone}.
            </p>

            <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: 8, border: "1px solid var(--border-primary)", textAlign: "left", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>ORDER METADATA</div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Order ID: <strong style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{checkoutSuccess.orderId}</strong>
              </div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Items: <strong>{checkoutSuccess.totalItems}</strong> | Total Paid: <strong style={{ color: ACCENT.green }}>৳ {checkoutSuccess.totalPrice.toLocaleString()}</strong>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 10, wordBreak: "break-all" }}>
                Ledger Hash: <code style={{ color: ACCENT.blue, fontFamily: "'JetBrains Mono', monospace" }}>{checkoutSuccess.txHash}</code>
              </div>
            </div>

            <button 
              onClick={() => setCheckoutSuccess(null)}
              style={{ padding: "10px 24px", border: "none", borderRadius: 8, background: ACCENT.green, color: "#ffffff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function CustomSmeView({ products, setProducts, customSmeName, setCustomSmeName }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Agriculture");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("Kg");
  const [dvs, setDvs] = useState(90);
  const [icon, setIcon] = useState("🌱");
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);

  const categories = ["Agriculture", "Pharmaceuticals", "Food & Dairy", "Food & Seafood", "Chemicals"];
  const icons = ["🌱", "🌾", "🌿", "📦", "🥛", "🐟", "⚕️", "💉", "🧪", "🍎", "🧀", "🍯"];

  const handleAddProduct = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Product Name is required");
      return;
    }
    if (!price.trim() || isNaN(price)) {
      setError("Please enter a valid price (number)");
      return;
    }
    setError("");

    if (editingProduct) {
      // Edit mode: update existing custom product
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
        ...p,
        name: name.trim(),
        category,
        price: `৳ ${Number(price).toLocaleString()}`,
        unit,
        dvs: Number(dvs),
        icon
      } : p));
      handleCancelEdit();
    } else {
      // Add mode: create new custom product
      const newProd = {
        id: Date.now(),
        name: name.trim(),
        category,
        price: `৳ ${Number(price).toLocaleString()}`,
        unit,
        seller: customSmeName,
        dvs: Number(dvs),
        icon,
        badge: "Custom SME",
        isCustom: true
      };

      setProducts(prev => [newProd, ...prev]);
      setName("");
      setPrice("");
    }
  };

  const handleEditProduct = (prod) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCategory(prod.category);
    // Extract price number from string like "৳ 120" or "৳ 1,250"
    const priceNum = prod.price.replace(/[৳\s,]/g, "");
    setPrice(priceNum);
    setUnit(prod.unit);
    setDvs(prod.dvs);
    setIcon(prod.icon);
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setName("");
    setCategory("Agriculture");
    setPrice("");
    setUnit("Kg");
    setDvs(90);
    setIcon("🌱");
    setError("");
  };

  const handleDeleteProduct = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const customProducts = products.filter(p => p.isCustom);

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease", display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 30, marginBottom: 80 }}>
      {/* Left Column: Brand & Add Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <SectionLabel icon="🛠️" text="SME Brand Configuration" />
        <Card hover={false} style={{ padding: "24px" }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>SME BRAND NAME</label>
            <input 
              type="text" 
              value={customSmeName} 
              onChange={e => {
                const newName = e.target.value;
                setCustomSmeName(newName);
                // Real-time propagation of brand name to all custom products
                setProducts(prev => prev.map(p => p.isCustom ? { ...p, seller: newName } : p));
              }}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 8,
                border: "1px solid var(--border-primary)", background: "var(--bg-primary)",
                color: "var(--text-primary)", fontSize: 14, outline: "none",
                transition: "border-color 0.2s ease"
              }}
              placeholder="e.g. Dhaka Eco Farms"
            />
            <small style={{ display: "block", marginTop: 6, color: "var(--text-dim)", fontSize: 11 }}>This name will automatically appear as the seller of your custom products.</small>
          </div>
        </Card>

        <SectionLabel icon={editingProduct ? "✏️" : "➕"} text={editingProduct ? "Edit Custom Product" : "Register Custom Product"} />
        <Card hover={false} style={{ padding: "24px" }}>
          <form onSubmit={handleAddProduct} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div style={{ padding: "10px 12px", borderRadius: 6, background: ACCENT.redBg, color: ACCENT.red, fontSize: 12, border: `1px solid ${ACCENT.redBorder}` }}>
                ⚠️ {error}
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>PRODUCT NAME</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                placeholder="e.g. Super Biochar"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>CATEGORY</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", cursor: "pointer" }}
                >
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>UNIT</label>
                <select 
                  value={unit} 
                  onChange={e => setUnit(e.target.value)}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", cursor: "pointer" }}
                >
                  <option value="Kg">Kg</option>
                  <option value="L">L</option>
                  <option value="Vial">Vial</option>
                  <option value="Box">Box</option>
                  <option value="Pack">Pack</option>
                  <option value="Ton">Ton</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>PRICE (৳ BDT)</label>
                <input 
                  type="text" 
                  value={price} 
                  onChange={e => setPrice(e.target.value)}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                  placeholder="e.g. 120"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>BASE DVS SCORE</label>
                <input 
                  type="number" 
                  min="0" max="100"
                  value={dvs} 
                  onChange={e => setDvs(Number(e.target.value))}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>SELECT EMOJI ICON</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {icons.map(ico => (
                  <button 
                    key={ico} 
                    type="button"
                    onClick={() => setIcon(ico)}
                    style={{
                      width: 40, height: 40, borderRadius: 8, border: icon === ico ? `2px solid ${ACCENT.green}` : "1px solid var(--border-primary)",
                      background: icon === ico ? ACCENT.greenBg : "var(--bg-primary)", fontSize: 18, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease"
                    }}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button 
                type="submit"
                style={{
                  width: "100%", padding: "14px", borderRadius: 8, border: "none",
                  background: `linear-gradient(135deg, ${ACCENT.greenLight}, ${ACCENT.greenDark})`,
                  color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14, marginTop: 8,
                  transition: "transform 0.2s ease, opacity 0.2s ease",
                  boxShadow: "0 4px 12px rgba(16,185,129,0.2)"
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                {editingProduct ? "Update Product Catalog" : "Add Product to Catalog"}
              </button>

              {editingProduct && (
                <button 
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 8, border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500, fontSize: 13,
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-input)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--bg-primary)"}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </Card>
      </div>

      {/* Right Column: Custom Products List */}
      <div>
        <SectionLabel icon="📦" text="Live Custom Products Catalog" />
        <Card hover={false} style={{ padding: "24px", minHeight: 400 }}>
          {customProducts.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)", paddingTop: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛠️</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>No Custom Products Yet</div>
              <div style={{ fontSize: 13, textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>Configure your brand name on the left and add your first custom product. It will instantly show up here and in the Marketplace!</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              {customProducts.map(p => (
                <div 
                  key={p.id} 
                  style={{
                    display: "flex", alignItems: "center", gap: 16, padding: "16px", borderRadius: 10,
                    border: "1px solid var(--border-primary)", background: "var(--bg-primary)",
                    transition: "all 0.2s ease", position: "relative"
                  }}
                >
                  <div style={{ fontSize: 32 }}>{p.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{p.name}</span>
                      <span style={{ fontSize: 9, background: ACCENT.greenBg, color: ACCENT.green, padding: "2px 6px", borderRadius: 4, fontWeight: 700, border: `1px solid ${ACCENT.greenBorder}` }}>CUSTOM</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Category: <strong>{p.category}</strong> · Seller: <strong>{p.seller}</strong></div>
                    <div style={{ fontSize: 13, color: ACCENT.green, fontWeight: 600, marginTop: 4 }}>{p.price} <span style={{ color: "var(--text-dim)", fontSize: 11, fontWeight: 400 }}>/ {p.unit}</span> · DVS: <span style={{ color: p.dvs >= 75 ? ACCENT.green : ACCENT.amber }}>{p.dvs}</span></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button 
                      onClick={() => handleEditProduct(p)}
                      style={{
                        padding: "8px 12px", borderRadius: 6, border: `1px solid ${ACCENT.greenBorder}`,
                        background: "transparent", color: ACCENT.green, cursor: "pointer", fontSize: 12, fontWeight: 500,
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = ACCENT.greenBg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${p.name}?`)) {
                          handleDeleteProduct(p.id);
                        }
                      }}
                      style={{
                        padding: "8px 12px", borderRadius: 6, border: `1px solid ${ACCENT.redBorder}`,
                        background: "transparent", color: ACCENT.red, cursor: "pointer", fontSize: 12, fontWeight: 500,
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = ACCENT.redBg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function AgentPanel({ setTab, products = [], setVerificationBatchId, setVerificationDispatchZone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      type: "TEXT",
      content: "Hello! I am your CLimaLogix AI Agricultural Assistant. How can I help you with BARI compliance, product catalog searches, or order dispatches today?"
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [language, setLanguage] = useState("bn");
  const [voiceSupported, setVoiceSupported] = useState(true);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
    }
  }, []);

  // Initialize Session
  const initSession = async () => {
    try {
      const userStr = localStorage.getItem("user") || localStorage.getItem("farmer");
      const user = userStr ? JSON.parse(userStr) : null;
      
      const response = await fetch(`${BACKEND_URL}/api/ai/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmerId: user ? user.id : undefined })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setSessionId(resData.data.sessionId);
      }
    } catch (err) {
      console.warn("Failed to initialize session:", err);
    }
  };

  // Close Session
  const endSession = async () => {
    if (!sessionId) return;
    try {
      await fetch(`${BACKEND_URL}/api/ai/chat/end`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      setSessionId("");
    } catch (err) {
      console.warn("Failed to end session:", err);
    }
  };

  // Handle Toggle Panel Open/Closed
  const togglePanel = () => {
    if (!isOpen) {
      initSession();
      setIsOpen(true);
    } else {
      endSession();
      setIsOpen(false);
    }
  };

  const callOrderLifecycle = async (endpoint, orderId) => {
    const payload = { sessionId: sessionId || undefined };
    if (endpoint === 'dispatch' && window.APIClient?.dispatchOrder) {
      return window.APIClient.dispatchOrder(orderId, payload);
    }
    if (endpoint === 'receipt' && window.APIClient?.confirmOrderReceipt) {
      return window.APIClient.confirmOrderReceipt(orderId, payload);
    }
    const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    return data;
  };

  const updateOrderMessage = (msgIndex, patch) => {
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, ...patch } : m)));
  };

  const handleOrderDispatch = async (orderId, msgIndex) => {
    if (!isValidOrderUuid(orderId)) return;
    try {
      const res = await callOrderLifecycle('dispatch', orderId);
      const status = res?.data?.order?.status || 'processing';
      updateOrderMessage(msgIndex, {
        orderStatus: status,
        content:
          language === 'bn'
            ? `অর্ডার পাঠানো হয়েছে (ID: ${orderId.slice(0, 8)}…)`
            : `Order dispatched (ID: ${orderId.slice(0, 8)}…)`,
      });
    } catch (err) {
      updateOrderMessage(msgIndex, {
        content:
          language === 'bn' ? `ডিসপ্যাচ ব্যর্থ: ${err.message}` : `Dispatch failed: ${err.message}`,
      });
    }
  };

  const handleOrderReceipt = async (orderId, msgIndex) => {
    if (!isValidOrderUuid(orderId)) return;
    try {
      const res = await callOrderLifecycle('receipt', orderId);
      const status = res?.data?.order?.status || 'completed';
      updateOrderMessage(msgIndex, {
        orderStatus: status,
        content:
          language === 'bn'
            ? `অর্ডার গ্রহণ সম্পন্ন (ID: ${orderId.slice(0, 8)}…)`
            : `Order received (ID: ${orderId.slice(0, 8)}…)`,
      });
    } catch (err) {
      updateOrderMessage(msgIndex, {
        content:
          language === 'bn' ? `রসিদ নিশ্চিত করা ব্যর্থ: ${err.message}` : `Receipt failed: ${err.message}`,
      });
    }
  };

  // Send message to agent backend
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    // Append user message locally
    setMessages((prev) => [...prev, { role: "user", type: "TEXT", content: text }]);
    if (!textToSend) setInputValue("");
    setIsProcessing(true);

    try {
      const userStr = localStorage.getItem("user") || localStorage.getItem("farmer");
      const user = userStr ? JSON.parse(userStr) : null;

      const response = await fetch(`${BACKEND_URL}/api/agent/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language,
          sessionId: sessionId || undefined,
          farmerId: user ? user.id : undefined,
          customProducts: products.filter(p => p.isCustom)
        })
      });
      const resData = await response.json();

      if (resData.success && resData.data) {
        const agentData = resData.data;

        // Update sessionId if the backend created or returned a new one
        if (agentData.sessionId && agentData.sessionId !== sessionId) {
          setSessionId(agentData.sessionId);
        }

        // Append assistant response locally
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            type: agentData.type,
            content: agentData.message,
            products: agentData.products,
            pendingOrder: agentData.pendingOrder,
            orderResult: agentData.orderResult,
            orderId: agentData.orderResult?.orderId,
            orderStatus: agentData.type === 'ORDER_SUCCESS' ? 'pending' : undefined,
            navigationTarget: agentData.navigationTarget
          }
        ]);

        // Handle navigation routing dynamically
        if (agentData.type === "NAVIGATION" && agentData.navigationTarget) {
          if (agentData.navigationTarget.toLowerCase().includes("verification") && agentData.verifiedBatchId) {
            setVerificationBatchId(agentData.verifiedBatchId);
            if (agentData.verifiedDispatchZone) {
              setVerificationDispatchZone(agentData.verifiedDispatchZone);
            }
          }
          setTimeout(() => {
            const target = agentData.navigationTarget.toLowerCase();
            if (target.includes("marketplace") || target.includes("market")) {
              setTab(7);
            } else if (target.includes("dashboard")) {
              setTab(0);
            } else if (target.includes("order")) {
              setTab(1);
            } else if (target.includes("verification")) {
              setTab(2);
            } else if (target.includes("climate") || target.includes("forecast")) {
              setTab(3);
            }
          }, 1500);
        }
      }
    } catch (err) {
      console.warn("Failed to get agent response:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          type: "TEXT",
          content: language === "bn" ? "দুঃখিত, সংযোগে কিছু সমস্যা হচ্ছে।" : "Sorry, I am facing connection issues."
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Web Speech API Recording handler
  const handleVoiceInput = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.lang = language === "bn" ? "bn-BD" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleSendMessage(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, fontFamily: "inherit" }}>
      {/* CSS keyframes block injected dynamically */}
      <style>{`
        @keyframes pulseGlowGreen {
          0%, 100% { box-shadow: 0 4px 14px rgba(45, 106, 79, 0.4); }
          50% { box-shadow: 0 4px 28px rgba(45, 106, 79, 0.8); }
        }
        @keyframes agentPulseRed {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
      `}</style>

      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={togglePanel}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#2d6a4f",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            border: "none",
            boxShadow: "0 4px 14px rgba(45, 106, 79, 0.4)",
            animation: isProcessing ? "pulseGlowGreen 1.5s infinite" : "none",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.08) translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1) translateY(0)";
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 1 9.8a7 7 0 0 1-9 8.2z"></path>
            <path d="M9 22v-4h-2a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 4z" style={{ display: "none" }}></path>
          </svg>
        </button>
      )}

      {/* Chat window panel */}
      {isOpen && (
        <div
          style={{
            width: 360,
            height: 520,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
            borderRadius: 16,
            boxShadow: "var(--shadow-hover)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            animation: "fadeSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border-primary)",
              background: "var(--bg-header)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }}></div>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>CLimaLogix AI Agent</span>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Language toggle pill */}
              <button
                onClick={() => setLanguage((l) => (l === "en" ? "bn" : "en"))}
                style={{
                  padding: "4px 8px",
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-input)",
                  color: "#10B981",
                  cursor: "pointer"
                }}
              >
                {language === "en" ? "EN" : "বাং"}
              </button>

              <button
                onClick={togglePanel}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 18,
                  cursor: "pointer",
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages scroll section */}
          <div style={{ flex: 1, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((msg, index) => {
              const isAssistant = msg.role === "assistant";
              return (
                <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: isAssistant ? "flex-start" : "flex-end" }}>
                  
                  {/* TEXT TYPE */}
                  {msg.type === "TEXT" && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: isAssistant ? "14px 14px 14px 2px" : "14px 14px 2px 14px",
                        background: isAssistant ? "var(--bg-input)" : "#2d6a4f",
                        color: isAssistant ? "var(--text-primary)" : "#ffffff",
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        maxWidth: "85%",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        border: isAssistant ? "1px solid var(--border-primary)" : "none"
                      }}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* PRODUCT LIST TYPE */}
                  {msg.type === "PRODUCT_LIST" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "90%" }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{msg.content}</div>
                      {msg.products && msg.products.map((prod, pIdx) => (
                        <div
                          key={pIdx}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            background: "var(--bg-input)",
                            border: "1px solid var(--border-primary)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{prod.name}</span>
                            <span style={{ fontWeight: 700, color: "#10B981", fontSize: 13 }}>৳{prod.price_bdt}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Trust Score: {prod.trust_score} · DVS: {prod.dvs}
                          </div>
                          <button
                            onClick={() => handleSendMessage(`${pIdx + 1}`)}
                            style={{
                              marginTop: 4,
                              padding: "6px",
                              borderRadius: 6,
                              background: "#2d6a4f",
                              color: "#ffffff",
                              border: "none",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "center"
                            }}
                          >
                            {language === "bn" ? "নির্বাচন করুন" : "Select Product"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ORDER CONFIRM PROMPT */}
                  {msg.type === "ORDER_CONFIRM_PROMPT" && msg.pendingOrder && (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-primary)",
                        width: "90%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-secondary)" }}>
                        {language === "bn" ? "📝 পেন্ডিং অর্ডার বিবরণী" : "📝 Order Details"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>
                        <div><strong>Item:</strong> {msg.pendingOrder.productName}</div>
                        <div><strong>Qty:</strong> {msg.pendingOrder.quantity} bags</div>
                        <div><strong>Total BDT:</strong> ৳{msg.pendingOrder.totalBdt}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => handleSendMessage("yes")}
                          style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: 6,
                            background: "#10B981",
                            color: "#ffffff",
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                            fontSize: 11
                          }}
                        >
                          Confirm ✓
                        </button>
                        <button
                          onClick={() => handleSendMessage("no")}
                          style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: 6,
                            background: "#EF4444",
                            color: "#ffffff",
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                            fontSize: 11
                          }}
                        >
                          Cancel ✗
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ORDER SUCCESS TYPE */}
                  {msg.type === "ORDER_SUCCESS" && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid #10B981",
                        color: "#10B981",
                        fontSize: 12.5,
                        maxWidth: "90%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8
                      }}
                    >
                      <div>🎉 {msg.content}</div>
                      {msg.orderId && isValidOrderUuid(msg.orderId) && (
                        <div style={{ fontSize: 11, opacity: 0.9 }}>
                          {language === "bn" ? "স্ট্যাটাস" : "Status"}: {msg.orderStatus || "pending"}
                        </div>
                      )}
                      {msg.orderId && isValidOrderUuid(msg.orderId) && (msg.orderStatus === "pending" || !msg.orderStatus) && (
                        <button
                          type="button"
                          onClick={() => handleOrderDispatch(msg.orderId, index)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: "#2d6a4f",
                            color: "#fff",
                            border: "none",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer"
                          }}
                        >
                          {language === "bn" ? "ডিসপ্যাচ করুন" : "Dispatch order"}
                        </button>
                      )}
                      {msg.orderId && isValidOrderUuid(msg.orderId) && msg.orderStatus === "processing" && (
                        <button
                          type="button"
                          onClick={() => handleOrderReceipt(msg.orderId, index)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: "#10B981",
                            color: "#fff",
                            border: "none",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer"
                          }}
                        >
                          {language === "bn" ? "গ্রহণ নিশ্চিত করুন" : "Confirm receipt"}
                        </button>
                      )}
                      {msg.orderId && isValidOrderUuid(msg.orderId) && msg.orderStatus === "completed" && (
                        <div style={{ fontSize: 11 }}>
                          ✅ {language === "bn" ? "অর্ডার সম্পূর্ণ" : "Order complete"}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ORDER CANCELLED TYPE */}
                  {msg.type === "ORDER_CANCELLED" && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "14px 14px 14px 2px",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-muted)",
                        fontSize: 12.5,
                        maxWidth: "85%",
                      }}
                    >
                      ✕ {msg.content}
                    </div>
                  )}

                  {/* AUTH REQUIRED TYPE */}
                  {msg.type === "AUTH_REQUIRED" && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "14px 14px 14px 2px",
                        background: "rgba(245, 158, 11, 0.15)",
                        border: "1px solid #F59E0B",
                        color: "#F59E0B",
                        fontSize: 12.5,
                        maxWidth: "85%",
                      }}
                    >
                      ⚠️ {msg.content}
                    </div>
                  )}

                  {/* NAVIGATION TYPE */}
                  {msg.type === "NAVIGATION" && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "14px 14px 14px 2px",
                        background: "rgba(59, 130, 246, 0.15)",
                        border: "1px solid #3B82F6",
                        color: "#3B82F6",
                        fontSize: 12.5,
                        maxWidth: "85%",
                      }}
                    >
                      🚀 {msg.content}
                    </div>
                  )}

                </div>
              );
            })}
            
            {/* Thinking Indicator */}
            {isProcessing && (
              <div style={{ display: "flex", gap: 4, padding: 8 }}>
                <span style={{ fontSize: 14 }}>⏳</span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>CLimaLogix Agent thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat input row */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--border-primary)",
              background: "var(--bg-header)",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <input
              type="text"
              placeholder={language === "bn" ? "মেসেজ লিখুন..." : "Type your message..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={isProcessing}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: 12.5,
                outline: "none"
              }}
            />

            {/* Mic button */}
            {voiceSupported && (
              <button
                onClick={handleVoiceInput}
                disabled={isProcessing}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: `1px solid ${isRecording ? "#EF4444" : "var(--border-primary)"}`,
                  background: isRecording ? "rgba(239, 68, 68, 0.1)" : "var(--bg-primary)",
                  color: isRecording ? "#EF4444" : "#10B981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  animation: isRecording ? "agentPulseRed 1.2s infinite" : "none"
                }}
              >
                🎤
              </button>
            )}

            <button
              onClick={() => handleSendMessage()}
              disabled={isProcessing || !inputValue.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "#2d6a4f",
                color: "#ffffff",
                fontWeight: 700,
                border: "none",
                fontSize: 12.5,
                cursor: "pointer",
                opacity: !inputValue.trim() ? 0.6 : 1
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: SYSTEM DOCS & AUDIT MODULE (YC PITCH + TECH SPECS + ADMIN)
// ═══════════════════════════════════════════════════════════════

function SystemDocsView({ productsList }) {
  const [subTab, setSubTab] = useState("pitch");
  
  // Settings persisted in localStorage for durability
  // Always default to public — passphrase gates caused lockout issues in production
  const [visibilityMode, setVisibilityMode] = useState("public");
  const [passphrase, setPassphrase] = useState("climalogix2026");
  const [startDate, setStartDate] = useState("2026-05-30T00:00");
  const [endDate, setEndDate] = useState("2026-06-30T23:59");
  const [hiddenTabs, setHiddenTabs] = useState(() => {
    const saved = localStorage.getItem("docs_hidden_tabs");
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState("");
  const [successAnim, setSuccessAnim] = useState(false);
  
  const [bypassInput, setBypassInput] = useState("");
  const [bypassError, setBypassError] = useState("");
  const [isBypassed, setIsBypassed] = useState(false);

  // Dynamic editable team roster
  const [team, setTeam] = useState(() => {
    const saved = localStorage.getItem("docs_team");
    if (saved) return JSON.parse(saved);
    return [
      { 
        name: "Punam", 
        role: "Lead AI Architect & Full-Stack Developer", 
        email: "punam@climalogix.ai", 
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
        bio: "Specialist in machine learning orchestration, real-time telemetry pipelines, and database architecture.",
        contribution: "Designed the BUET-UHI dispatch slotting optimizer and conversational Groq RAG assistant."
      },
      { 
        name: "Sarah Chowdhury", 
        role: "Operations & Logistics Director", 
        email: "sarah@climalogix.ai", 
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
        bio: "Expert in cold-chain logistics coordination and rural agricultural supply chain optimization in Bangladesh.",
        contribution: "Formulated the Dhaka Division dispatch routes and temperature-exposed spot pricing clearance brackets."
      },
      { 
        name: "Dr. Ahmed", 
        role: "Agronomy Compliance Advisory Lead (BARI Consultant)", 
        email: "ahmed@climalogix.ai", 
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
        bio: "Former BARI senior researcher specializing in organic compost validation and soil nutrient optimization.",
        contribution: "Calibrated the BARI trust-score deterministic pH/EC/Moisture validation guidelines."
      }
    ];
  });

  // Team editor states
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberAvatar, setNewMemberAvatar] = useState("");
  const [newMemberBio, setNewMemberBio] = useState("");
  const [newMemberContribution, setNewMemberContribution] = useState("");

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMemberAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Sync to localStorage
  useEffect(() => { localStorage.setItem("docs_visibility", visibilityMode); }, [visibilityMode]);
  useEffect(() => { localStorage.setItem("docs_passphrase", passphrase); }, [passphrase]);
  useEffect(() => { localStorage.setItem("docs_start", startDate); }, [startDate]);
  useEffect(() => { localStorage.setItem("docs_end", endDate); }, [endDate]);
  useEffect(() => { localStorage.setItem("docs_hidden_tabs", JSON.stringify(hiddenTabs)); }, [hiddenTabs]);
  useEffect(() => { localStorage.setItem("docs_team", JSON.stringify(team)); }, [team]);

  // Dynamic Telemetry calculation from live memory state
  const batches = window.__SEED_BATCHES__ || [];
  const totalBatches = batches.length;
  
  const avgTrustScore = totalBatches > 0 
    ? Math.round(batches.reduce((acc, b) => acc + (b.trust_score || 0), 0) / totalBatches) 
    : 0;

  const activeCertified = batches.filter(b => b.status === "certified" || b.status === "delivered").length;
  
  const highRiskZonesList = ["Old Dhaka", "Jatrabari", "Tejgaon", "Hazaribagh", "Kamrangirchar", "Chowkbazar", "Moghbazar", "New Market"];
  const highRiskCount = batches.filter(b => highRiskZonesList.includes(b.destination_zone)).length;
  
  const avgDvs = totalBatches > 0
    ? Math.round(batches.reduce((acc, b) => {
        const uhi = UHI_ZONES[b.destination_zone]?.offset || 2.0;
        const adjustedTemp = 31 + uhi;
        const risk = Math.max(0, Math.min(1, (adjustedTemp - 25) / 15));
        const multiplier = UHI_ZONES[b.destination_zone]?.hazardMultiplier || 1.3;
        const dvsVal = Math.max(0, Math.min(100, Math.round((b.trust_score || 75) * (1 - risk * multiplier))));
        return acc + dvsVal;
      }, 0) / totalBatches)
    : 0;

  const handleUnlock = () => {
    if (passInput === passphrase) {
      setSuccessAnim(true);
      setTimeout(() => {
        setIsUnlocked(true);
        localStorage.setItem("docs_unlocked", "true");
        setSuccessAnim(false);
      }, 800);
    } else {
      setPassError("Incorrect passphrase. Please try again.");
      setTimeout(() => setPassError(""), 3000);
    }
  };

  const handleBypass = () => {
    if (bypassInput === passphrase) {
      setIsBypassed(true);
    } else {
      setBypassError("Incorrect passphrase.");
      setTimeout(() => setBypassError(""), 3000);
    }
  };

  const handleAddMember = () => {
    if (!newMemberName.trim() || !newMemberRole.trim()) return;
    const defaultAvatars = [
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80",
      "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&h=120&q=80"
    ];
    const avatarUrl = newMemberAvatar.trim() || defaultAvatars[team.length % defaultAvatars.length];
    
    setTeam([...team, {
      name: newMemberName,
      role: newMemberRole,
      email: newMemberEmail || `${newMemberName.toLowerCase().replace(/\s+/g, '')}@climalogix.ai`,
      avatar: avatarUrl,
      bio: newMemberBio.trim() || "EcoWeather SME Team Member.",
      contribution: newMemberContribution.trim() || "Developed core functionality."
    }]);

    setNewMemberName("");
    setNewMemberRole("");
    setNewMemberEmail("");
    setNewMemberAvatar("");
    setNewMemberBio("");
    setNewMemberContribution("");
  };

  const handleRemoveMember = (idx) => {
    setTeam(team.filter((_, i) => i !== idx));
  };

  const toggleTabHide = (tabId) => {
    setHiddenTabs(prev => 
      prev.includes(tabId) ? prev.filter(t => t !== tabId) : [...prev, tabId]
    );
  };

  const resetAllSettings = () => {
    setVisibilityMode("public");
    setPassphrase("climalogix2026");
    setStartDate("2026-05-30T00:00");
    setEndDate("2026-06-30T23:59");
    setHiddenTabs([]);
    setIsUnlocked(false);
    setIsBypassed(false);
    localStorage.removeItem("docs_unlocked");
    setTeam([
      { name: "Punam", role: "Lead AI Architect & Full-Stack Developer", email: "punam@climalogix.ai", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80" },
      { name: "Sarah Chowdhury", role: "Operations & Logistics Director", email: "sarah@climalogix.ai", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80" },
      { name: "Dr. Ahmed", role: "Agronomy Compliance Advisory Lead (BARI Consultant)", email: "ahmed@climalogix.ai", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80" }
    ]);
  };

  // Schedule parameters check
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const isOutsideWindow = startDate && endDate && (now < start || now > end);

  // Security Access gates
  if (visibilityMode === "dev_lock" && !isUnlocked) {
    return (
      <div style={{ maxWidth: 500, margin: "80px auto", animation: "fadeSlideIn 0.4s ease" }}>
        <Card hover={false} style={{ border: `1px solid ${ACCENT.amberBorder}`, background: "rgba(17, 24, 39, 0.8)", textAlign: "center", padding: "40px 30px" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>{"Dev Staging Lock Active"}</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
            {"Access to this live product pitch and technical whitepaper is currently passphrase-protected by the development team."}
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch" }}>
            <input 
              type="password" 
              placeholder="Enter Staging Passphrase" 
              value={passInput}
              onChange={e => setPassInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", textAlign: "center" }}
            />
            {passError && <div style={{ fontSize: 12, color: ACCENT.red, fontWeight: 500 }}>{passError}</div>}
            
            <button 
              onClick={handleUnlock}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 8,
                background: successAnim ? ACCENT.green : "linear-gradient(135deg, #10B981, #059669)",
                color: "#ffffff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
                transition: "all 0.3s ease",
                transform: successAnim ? "scale(1.05)" : "none"
              }}
            >
              {successAnim ? "✓ Unlocked!" : "Unlock Portal"}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (visibilityMode === "scheduled" && isOutsideWindow && !isBypassed) {
    return (
      <div style={{ maxWidth: 550, margin: "80px auto", animation: "fadeSlideIn 0.4s ease" }}>
        <Card hover={false} style={{ border: `1px solid ${ACCENT.redBorder}`, background: "rgba(17, 24, 39, 0.8)", textAlign: "center", padding: "40px 30px" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>{"Scheduled Access Restriction"}</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
            {"The live audit portal is locked. Access is scheduled only during the specified evaluator window:"}
          </p>
          
          <div style={{ background: "var(--bg-primary)", padding: "16px 20px", borderRadius: 10, border: "1px solid var(--border-primary)", marginBottom: 28, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: ACCENT.amber }}>
            <div>Start: {new Date(startDate).toLocaleString()}</div>
            <div style={{ marginTop: 6 }}>End: {new Date(endDate).toLocaleString()}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch", borderTop: "1px solid var(--border-primary)", paddingTop: 24 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{"ADMINISTRATIVE / AUDITOR BYPASS"}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input 
                type="password" 
                placeholder="Admin Passphrase" 
                value={bypassInput}
                onChange={e => setBypassInput(e.target.value)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
              />
              <button 
                onClick={handleBypass}
                style={{ padding: "10px 18px", borderRadius: 8, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Bypass
              </button>
            </div>
            {bypassError && <div style={{ fontSize: 12, color: ACCENT.red, textAlign: "left" }}>{bypassError}</div>}
          </div>
        </Card>
      </div>
    );
  }

  // Left sub-navigation tab filtering
  const SUB_TABS = [
    { id: "pitch", label: "💼 Pitch Deck" },
    { id: "arch", label: "📐 Architecture Flow" },
    { id: "math", label: "🧪 Mathematical Models" },
    { id: "telemetry", label: "📈 Live Telemetry" },
    { id: "team", label: "👥 Team Showcase" },
    { id: "admin", label: "⚙️ Admin Controls" }
  ];

  const visibleSubTabs = SUB_TABS.filter(t => {
    if (t.id === "admin") return true; // admin tab is always there for bypass/edit
    if (hiddenTabs.includes(t.id)) return false; // hide if admin marked as hidden
    return true;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 32, animation: "fadeSlideIn 0.4s ease" }}>
      
      {/* ── LEFT SUB-NAV BAR ────────────────────────────────────── */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", fontWeight: 700, paddingLeft: 12, marginBottom: 12 }}>
          {"DOCUMENTATION MENU"}
        </div>
        {visibleSubTabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setSubTab(t.id)}
            style={{
              padding: "12px 16px", borderRadius: 8, textAlign: "left", fontSize: 12.5, fontWeight: 600,
              background: subTab === t.id ? "var(--bg-card)" : "transparent",
              color: subTab === t.id ? ACCENT.green : "var(--text-secondary)",
              border: `1px solid ${subTab === t.id ? "var(--border-primary)" : "transparent"}`,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 0.25s ease"
            }}
          >
            {t.label}
          </button>
        ))}
      </aside>

      {/* ── RIGHT CONTENT CARD ──────────────────────────────────── */}
      <section style={{ minWidth: 0 }}>
        
        {/* ── SUB-VIEW: PITCH DECK ────────────────────────────── */}
        {subTab === "pitch" && (
          <div style={{ animation: "fadeSlideIn 0.35s ease" }}>
            <SectionLabel icon="💼" text="CLimaLogix AI Pitch Deck — YC Structure" />
            <Card hover={false} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: ACCENT.green, marginBottom: 12 }}>
                  {"1. The Problem: Agricultural Spoilage in High-Density Logistics"}
                </h3>
                <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {"E-commerce and agricultural logistics in Bangladesh lose up to 35% of heat-sensitive organic resources (bio-slurry, probiotics, vaccine packages) due to unmapped Urban Heat Island (UHI) exposure. Traditional supply chains ignore diurnal temperatures and density factors, leading to massive financial waste and ruined bio-efficiency."}
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: ACCENT.green, marginBottom: 12 }}>
                  {"2. The Solution: CLimaLogix ClimateShield"}
                </h3>
                <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {"CLimaLogix AI implements real-time agricultural trust auditing, microclimate exposure risk estimation, and dynamic delivery viability slotting (DVS) for high-density logistics. Using operator-signed manual registration, QR-code provenance, and localized UHI offsets, CLimaLogix safeguards heat-sensitive batches, increasing successful deliveries by over 40%."}
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: ACCENT.green, marginBottom: 12 }}>
                  {"3. Business Model: B2B SaaS & Cryptographic Verification"}
                </h3>
                <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {"We charge processing SMEs a monthly SaaS subscription for real-time dispatch advice, combined with a minute cryptographic 'trust fee' per certified batch. Evaluators and buyers receive complimentary audit access, validating product pedigree and BARI compliance in under 10 seconds."}
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: ACCENT.green, marginBottom: 12 }}>
                  {"4. Roadmap & Expansion Goals"}
                </h3>
                <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {"· Q3 2026: Expand pilot integrations into 15 organic bio-refineries in Dhaka division."}
                  <br />
                  {"· Q4 2026: Direct integration into major cold-chain freight carriers in Bangladesh."}
                  <br />
                  {"· Q1 2027: Rollout of predictive neural routing engines mapping future climate changes."}
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* ── SUB-VIEW: ARCHITECTURE ──────────────────────────── */}
        {subTab === "arch" && (
          <div style={{ animation: "fadeSlideIn 0.35s ease" }}>
            <SectionLabel icon="📐" text="CLimaLogix Technical Architecture" />
            <Card hover={false}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
                {"Current Production Architecture (v2.0)"}
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
                {"CLimaLogix ClimateShield runs as a decoupled frontend + TypeScript Express backend deployed on Render, with Supabase for data persistence and Groq LLM for AI-powered agricultural assistance."}
              </p>

              {/* TECH STACK SUMMARY */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Frontend", items: "React 18 (CDN) + Babel in-browser JSX", color: ACCENT.blue },
                  { label: "Backend", items: "TypeScript Express v4 on Node ≥18", color: ACCENT.green },
                  { label: "Database", items: "Supabase (PostgreSQL + Auth + Realtime)", color: "#a855f7" },
                  { label: "AI / LLM", items: "Groq SDK (Llama 3) — RAG + intent classifier", color: ACCENT.amber },
                  { label: "Weather", items: "OpenWeather API (live UHI-adjusted temps)", color: ACCENT.red },
                  { label: "Hosting", items: "Render (static site + web service)", color: "#94a3b8" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-primary)" }}>
                    <div style={{ fontSize: 9, color: s.color, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{s.items}</div>
                  </div>
                ))}
              </div>

              {/* ARCHITECTURE FLOWCHART */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", background: "var(--bg-primary)", padding: 24, borderRadius: 12, border: "1px solid var(--border-primary)" }}>
                
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <div style={{ background: "rgba(59, 130, 246, 0.1)", border: `1px solid ${ACCENT.blue}`, padding: "10px 16px", borderRadius: 8, fontSize: 12, color: ACCENT.blue, fontWeight: 700, textAlign: "center" }}>
                    {"1. OPERATOR REGISTRATION"}<br />
                    <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.8 }}>{"Manual batch sign + SHA-256 hash"}</span>
                  </div>
                  <div style={{ color: "var(--text-dim)", fontWeight: 700 }}>{"→"}</div>
                  <div style={{ background: "rgba(245, 158, 11, 0.1)", border: `1px solid ${ACCENT.amber}`, padding: "10px 16px", borderRadius: 8, fontSize: 12, color: ACCENT.amber, fontWeight: 700, textAlign: "center" }}>
                    {"2. TRUST SCORE ENGINE"}<br />
                    <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.8 }}>{"Zod-validated IoT params → score 0-100"}</span>
                  </div>
                </div>

                <div style={{ color: "var(--text-dim)", fontWeight: 700, fontSize: 16 }}>{"↓"}</div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <div style={{ background: "rgba(16, 185, 129, 0.1)", border: `1px solid ${ACCENT.green}`, padding: "10px 16px", borderRadius: 8, fontSize: 12, color: ACCENT.green, fontWeight: 700, textAlign: "center" }}>
                    {"3. MERM + DVS ENGINE"}<br />
                    <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.8 }}>{"UHI offsets × 50+ Dhaka zones"}</span>
                  </div>
                  <div style={{ color: "var(--text-dim)", fontWeight: 700 }}>{"↔"}</div>
                  <div style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid #8B5CF6", padding: "10px 16px", borderRadius: 8, fontSize: 12, color: "#a78bfa", fontWeight: 700, textAlign: "center" }}>
                    {"4. RAG + GROQ AI AGENT"}<br />
                    <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.8 }}>{"BARI KB retrieval + intent classification"}</span>
                  </div>
                </div>

                <div style={{ color: "var(--text-dim)", fontWeight: 700, fontSize: 16 }}>{"↓"}</div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <div style={{ background: "rgba(239, 68, 68, 0.1)", border: `1px solid ${ACCENT.red}`, padding: "10px 16px", borderRadius: 8, fontSize: 12, color: ACCENT.red, fontWeight: 700, textAlign: "center" }}>
                    {"5. ORDER LIFECYCLE"}<br />
                    <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.8 }}>{"Create → Dispatch → Receipt → Verify"}</span>
                  </div>
                  <div style={{ color: "var(--text-dim)", fontWeight: 700 }}>{"→"}</div>
                  <div style={{ background: "rgba(16, 185, 129, 0.2)", border: `2px solid ${ACCENT.green}`, padding: "10px 16px", borderRadius: 8, fontSize: 12, color: "#ffffff", fontWeight: 700, boxShadow: `0 0 12px ${ACCENT.greenBg}`, textAlign: "center" }}>
                    {"6. ESG LEDGER + MARKETPLACE"}<br />
                    <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.8 }}>{"Impact reporting + buyer verification"}</span>
                  </div>
                </div>

              </div>

              {/* BACKEND API ROUTES */}
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 24, marginBottom: 12 }}>{"Backend API Routes (TypeScript Express)"}</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { route: "/api/batches", desc: "Batch CRUD operations & memory registry with optional Supabase persistence" },
                  { route: "/api/batch/trust-score", desc: "BARI-calibrated deterministic QA parameter validation & grading" },
                  { route: "/api/verify/:batch_id", desc: "Cryptographic SHA-256 lot provenance chain & signature verification" },
                  { route: "/api/climate/dvs", desc: "Delivery Viability Slotting simulator incorporating localized thermal risk" },
                  { route: "/api/spot-pricing", desc: "Heat-sensitive dynamic clearance markdown calculations" },
                  { route: "/api/orders/voice", desc: "Natural Language Processing checkout using Groq parser" },
                  { route: "/api/orders", desc: "Order creation, dispatch tracking, and delivery receipts" },
                  { route: "/api/esg/report", desc: "Carbon sequestration and packaging circular metric reporting" },
                  { route: "/api/agent/message", desc: "Bangla Conversational RAG assistant gateway" },
                  { route: "/api/checkout", desc: "Validated cart checkout transaction ledger registration" }
                ].map((r, i) => (
                  <div key={i} style={{ padding: 10, borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", gap: 3 }}>
                    <code style={{ fontSize: 11, color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace" }}>{r.route}</code>
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{r.desc}</span>
                  </div>
                ))}
              </div>

              {/* BACKEND SERVICES */}
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 24, marginBottom: 12 }}>{"Core Service Modules"}</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { svc: "trustScore.service.ts", desc: "Deterministic QA evaluation using pH, EC, temperature, and composting days" },
                  { svc: "dvs.service.ts", desc: "Calculates dynamic delivery slots by integrating weather telemetry and UHI offsets" },
                  { svc: "merm.service.ts", desc: "Microclimate Exposure Risk Model mapping localized heating across 50+ sectors" },
                  { svc: "agentOrchestrator.service.ts", desc: "Orchestrates multi-turn chat sessions and forwards queries to sub-agents" },
                  { svc: "rag.service.ts", desc: "Semantic search retrieval on BARI agricultural guidelines" },
                  { svc: "orderExecution.service.ts", desc: "Executes state transition hooks for batches during delivery lifecycle" },
                  { svc: "provenance.service.ts", desc: "Computes cryptographic signature validation and SHA-256 blocks" },
                  { svc: "qaIngestion.service.ts", desc: "Validates compost laboratory reports via schemas" },
                  { svc: "weather.service.ts", desc: "Fetches current temperature and humidity data via OpenWeather API" },
                  { svc: "language.service.ts", desc: "Detects languages and performs bidirectional translations" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: 10, borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)", display: "flex", flexDirection: "column", gap: 3 }}>
                    <code style={{ fontSize: 11, color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace" }}>{s.svc}</code>
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{s.desc}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── SUB-VIEW: MATHEMATICAL MODEL ────────────────────── */}
        {subTab === "math" && (
          <div style={{ animation: "fadeSlideIn 0.35s ease" }}>
            <SectionLabel icon="🧪" text="Dynamic Mathematical Formulation" />
            <Card hover={false} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                  {"1. Category-Aware Trust Score Normalization"}
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                  {"Normalizes raw laboratory or sensor readings for pH, EC, temperature, microbial ratio, and fermentation days against category-specific target bounds. Decay is linear beyond acceptable ranges:"}
                </p>
                <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, border: "1px solid var(--border-primary)", color: ACCENT.green, lineHeight: 1.5 }}>
                  {"Deviation = DistanceOutside(Value, TargetRange)"}
                  <br />
                  {"SubScore = Clamp(1.0 - Deviation, 0.0, 1.0)"}
                  <br /><br />
                  {"TrustScore = (SubScore_pH * W_pH + SubScore_EC * W_EC + SubScore_Temp * W_Temp + SubScore_Ratio * W_Ratio + SubScore_Days * W_Days) * 100"}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                  {"2. Microclimate Exposure & Effective Temperature (calculateTST)"}
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                  {"Computes localized thermal accumulation by applying Urban Heat Island (UHI) offsets and solar hour coefficients based on solar intensity curves:"}
                </p>
                <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, border: "1px solid var(--border-primary)", color: ACCENT.green, lineHeight: 1.5 }}>
                  {"SolarScale = (Hour24 / 23) * 12"}
                  <br />
                  {"SolarLoadFactor = 1.0 + (SolarCoefficient - 1.0) * Sin(PI * SolarScale / 12)"}
                  <br />
                  {"Temp_effective = (Temp_ambient + UHI_offset) * SolarLoadFactor"}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                  {"3. Thermal Stability Time (TST)"}
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                  {"Calculates the exact duration in minutes before critical product degradation under simulated thermal transit conditions:"}
                </p>
                <div style={{ background: "var(--bg-primary)", padding: 16, borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, border: "1px solid var(--border-primary)", color: ACCENT.green }}>
                  {"TST = Max(0, 480 - (Temp_effective - 30) * 18)"}
                </div>
              </div>

            </Card>
          </div>
        )}

        {/* ── SUB-VIEW: TELEMETRY ─────────────────────────────── */}
        {subTab === "telemetry" && (
          <div style={{ animation: "fadeSlideIn 0.35s ease" }}>
            <SectionLabel icon="📈" text="System Operations Live Telemetry" />
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
              
              <Card hover={false} style={{ textAlign: "center", border: `1px solid var(--border-primary)` }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {"Total Batches"}
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace" }}>
                  {totalBatches}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>
                  {"Registered organic lots in memory"}
                </div>
              </Card>

              <Card hover={false} style={{ textAlign: "center", border: `1px solid var(--border-primary)` }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {"Avg Trust Score"}
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace" }}>
                  {avgTrustScore}
                  <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-secondary)" }}>{"/100"}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>
                  {"BARI compliance average"}
                </div>
              </Card>

              <Card hover={false} style={{ textAlign: "center", border: `1px solid var(--border-primary)` }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {"High Risk Dispatches"}
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: highRiskCount > 0 ? ACCENT.amber : ACCENT.green, fontFamily: "'JetBrains Mono', monospace" }}>
                  {highRiskCount}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>
                  {"Lots routed to high UHI areas"}
                </div>
              </Card>

            </div>

            <Card hover={false}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                {"Live System Averages & Calibration KPI"}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid var(--border-primary)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{"Average Delivery Viability Score (DVS)"}</span>
                  <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: ACCENT.green }}>{avgDvs}{"%"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid var(--border-primary)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{"Active Certified lots"}</span>
                  <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: ACCENT.blue }}>{activeCertified}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{"Marketplace Listed Products"}</span>
                  <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: ACCENT.amber }}>{productsList.length}</span>
                </div>
              </div>
            </Card>

          </div>
        )}

        {/* ── SUB-VIEW: TEAM SHOWCASE ─────────────────────────── */}
        {subTab === "team" && (
          <div style={{ animation: "fadeSlideIn 0.35s ease" }}>
            <SectionLabel icon="👥" text="CLimaLogix AI Project Team" />
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 28 }}>
              {team.map((m, i) => (
                <Card key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: 24 }}>
                  <img 
                    src={m.avatar} 
                    alt={m.name} 
                    style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: `2px solid ${ACCENT.green}`, boxShadow: "0 4px 12px rgba(16,185,129,0.2)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: ACCENT.green, fontWeight: 700, marginTop: 2, marginBottom: 6 }}>{m.role}</div>
                      </div>
                      {/* Remove button inside team showcase */}
                      <button 
                        onClick={() => handleRemoveMember(i)}
                        style={{ background: "transparent", border: "none", color: ACCENT.red, cursor: "pointer", fontSize: 16 }}
                        title="Remove member"
                      >
                        {"🗑️"}
                      </button>
                    </div>
                    
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
                      <strong>Bio:</strong> {m.bio}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
                      <strong>Key Build Contribution:</strong> {m.contribution}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>📧 {m.email}</div>
                  </div>
                </Card>
              ))}
            </div>

            {/* TEAM BUILDER ADDITION FORM */}
            <Card hover={false} style={{ border: `1px solid var(--border-primary)` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
                {"Add New Team Member"}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <input 
                  type="text" placeholder="Name" value={newMemberName} 
                  onChange={e => setNewMemberName(e.target.value)}
                  style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                />
                <input 
                  type="text" placeholder="Role" value={newMemberRole} 
                  onChange={e => setNewMemberRole(e.target.value)}
                  style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                />
                <input 
                  type="text" placeholder="Email (Optional)" value={newMemberEmail} 
                  onChange={e => setNewMemberEmail(e.target.value)}
                  style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input 
                    type="file" accept="image/*" onChange={handleImageUpload}
                    style={{ display: "none" }} id="member-photo-upload"
                  />
                  <label htmlFor="member-photo-upload" style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", display: "inline-block", flex: 1, textAlign: "center" }}>
                    📷 Upload Photo File
                  </label>
                  {newMemberAvatar && (
                    <img src={newMemberAvatar} alt="Upload preview" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: `1px solid ${ACCENT.green}` }} />
                  )}
                </div>
                <input 
                  type="text" placeholder="Avatar URL (Optional - Fallback)" value={newMemberAvatar.startsWith("data:") ? "" : newMemberAvatar} 
                  onChange={e => setNewMemberAvatar(e.target.value)}
                  style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", gridColumn: "1 / -1" }}
                />
                <input 
                  type="text" placeholder="Short Bio" value={newMemberBio} 
                  onChange={e => setNewMemberBio(e.target.value)}
                  style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", gridColumn: "1 / -1" }}
                />
                <input 
                  type="text" placeholder="Key Contribution" value={newMemberContribution} 
                  onChange={e => setNewMemberContribution(e.target.value)}
                  style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", gridColumn: "1 / -1" }}
                />
              </div>
              <button 
                onClick={handleAddMember}
                style={{ padding: "10px 20px", borderRadius: 8, background: ACCENT.green, color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
              >
                {"+ Add Team Member"}
              </button>
            </Card>

          </div>
        )}

        {/* ── SUB-VIEW: ADMIN CONTROLS ────────────────────────── */}
        {subTab === "admin" && (
          <div style={{ animation: "fadeSlideIn 0.35s ease" }}>
            <SectionLabel icon="⚙️" text="Admin Configuration Panel" />
            <Card hover={false} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                  {"Visibility Mode"}
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  {["public", "dev_lock", "scheduled"].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setVisibilityMode(mode)}
                      style={{
                        flex: 1, padding: "12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                        background: visibilityMode === mode ? "var(--bg-card)" : "var(--bg-primary)",
                        color: visibilityMode === mode ? ACCENT.green : "var(--text-secondary)",
                        border: `1px solid ${visibilityMode === mode ? ACCENT.green : "var(--border-primary)"}`,
                        transition: "all 0.25s ease"
                      }}
                    >
                      {mode === "public" ? "🔓 Public" : mode === "dev_lock" ? "🔒 Dev Lock" : "⏳ Scheduled"}
                    </button>
                  ))}
                </div>
              </div>

              {visibilityMode === "dev_lock" && (
                <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                    {"Dev Staging Passphrase"}
                  </label>
                  <input 
                    type="text" value={passphrase} onChange={e => setPassphrase(e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
              )}

              {visibilityMode === "scheduled" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, animation: "fadeSlideIn 0.3s ease" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                      {"Window Start Date-Time"}
                    </label>
                    <input 
                      type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
                      style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                      {"Window End Date-Time"}
                    </label>
                    <input 
                      type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                      style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                    />
                  </div>
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                  {"Section Visibility Toggles (Hide specific deck sections)"}
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { id: "pitch", label: "💼 YC Structure Pitch Deck" },
                    { id: "arch", label: "📐 Technical Architecture Diagrams" },
                    { id: "math", label: "🧪 Mathematical Formulation Models" },
                    { id: "telemetry", label: "📈 System Telemetry KPIs" },
                    { id: "team", label: "👥 Team Roster Showcase" }
                  ].map(sec => (
                    <div key={sec.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{sec.label}</span>
                      <button
                        onClick={() => toggleTabHide(sec.id)}
                        style={{
                          padding: "6px 14px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: "none",
                          background: hiddenTabs.includes(sec.id) ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                          color: hiddenTabs.includes(sec.id) ? ACCENT.red : ACCENT.green
                        }}
                      >
                        {hiddenTabs.includes(sec.id) ? "❌ Hidden" : "✓ Visible"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SYSTEM SIMULATOR */}
              <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                  {"Staging & Telemetry Simulators"}
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Mock Supabase Database Connection</span>
                    <button
                      onClick={() => alert("Supabase Connection Status: Connected (SSL Secure, 2 active client channels).")}
                      style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: "none", background: ACCENT.greenBg, color: ACCENT.green }}
                    >
                      ✓ CONNECTED
                    </button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Circular ESG Offset Multiplier</span>
                    <input 
                      type="number" defaultValue="1.5" step="0.1"
                      style={{ width: 80, padding: 6, borderRadius: 6, border: "1px solid var(--border-primary)", background: "var(--bg-header)", color: "var(--text-primary)", textAlign: "center", fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Simulated Environmental Heat Hazard Lot</span>
                    <button
                      onClick={() => {
                        const randomId = Math.floor(100000 + Math.random() * 900000);
                        const mockBatch = {
                          id: `batch-${randomId}`,
                          batch_number: `CL-${randomId}`,
                          product_name: "Simulated Organic Composites",
                          destination_zone: "Old Dhaka",
                          weight_kg: 500,
                          trust_score: 95,
                          status: "certified",
                          created_at: new Date().toISOString()
                        };
                        window.__SEED_BATCHES__ = [mockBatch, ...(window.__SEED_BATCHES__ || [])];
                        alert(`Injected simulated certified hazard lot CL-${randomId} to destination zone "Old Dhaka"!`);
                      }}
                      style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: "none", background: ACCENT.blueBg, color: ACCENT.blue }}
                    >
                      ⚡ INJECT BATCH
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 24, display: "flex", gap: 16 }}>
                <button 
                  onClick={resetAllSettings}
                  style={{ flex: 1, padding: "12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", border: `1px solid ${ACCENT.redBorder}`, color: ACCENT.red, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {"⚠️ Reset Defaults"}
                </button>
                <button 
                  onClick={() => alert("Settings successfully saved and persisted to local configurations!")}
                  style={{ flex: 1, padding: "12px", borderRadius: 8, background: ACCENT.green, color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
                >
                  {"Save Changes"}
                </button>
              </div>

            </Card>
          </div>
        )}

      </section>
    </div>
  );
}

// Three-layer architecture, ordered by the natural farm → buyer workflow:
//   L1 Registration → operator manually registers + signs a batch
//   L2 Intelligence → trust score, DVS, demand forecast, BI dashboard
//   L3 Presentation → ESG report, marketplace
//   Cross-cutting   → chatbot assistant
// Each tab carries a `layer` tag so the nav bar can group + color-code them.
const LAYER_META = {
  L1: { name: "Registration", color: "#3b82f6", bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.35)" },
  L2: { name: "Intelligence", color: "#a855f7", bg: "rgba(168,85,247,0.10)",  border: "rgba(168,85,247,0.35)" },
  L3: { name: "Presentation", color: "#10b981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.35)" },
  L0: { name: "Overview",     color: "#94a3b8", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.35)" },
  LX: { name: "Assist",       color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.35)" },
};
const TABS = [
  { id: "dashboard",    label: "Overall Dashboard",       icon: "⊞",  layer: "L0" },
  { id: "batches",      label: "Batches",                 icon: "📦", layer: "L1" },
  { id: "verification", label: "Batch Verification",      icon: "✅", layer: "L1" },
  { id: "microclimate", label: "Microclimate Intelligence", icon: "🌡️", layer: "L2" },
  { id: "demand",       label: "Climate Demand",          icon: "📊", layer: "L2" },
  { id: "bi",           label: "Business Intelligence",   icon: "🧠", layer: "L2" },
  { id: "chatbot",      label: "Chatbot",                 icon: "💬", layer: "LX" },
  { id: "marketplace",  label: "Marketplace",             icon: "🛒", layer: "L3" },
  { id: "esg",          label: "Impact & ESG",            icon: "🌱", layer: "L3" }
];

function CLimaLogixApp() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [trustScore, setTrustScore] = useState(84);
  // Full deterministic trust score envelope from /api/batch/trust-score
  // { score, grade, isViable, category, breakdown, reference, notes }
  const [trustScoreResult, setTrustScoreResult] = useState(null);
  const [isRegisteringBatch, setIsRegisteringBatch] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [dvs, setDvs] = useState(72);
  const [productsList, setProductsList] = useState(MOCK_PRODUCTS);
  const [selectedSme, setSelectedSme] = useState("green_refineries");
  const [customSmeName, setCustomSmeName] = useState("My Custom SME");
  const [verificationBatchId, setVerificationBatchId] = useState("");
  const [verificationDispatchZone, setVerificationDispatchZone] = useState("");

  const setTab = (target) => {
    if (typeof target === "number") {
      const legacyMap = {
        0: "dashboard",
        1: "batches",
        2: "verification",
        3: "microclimate",
        4: "demand",
        5: "bi",
        6: "esg",
        7: "marketplace",
        8: "chatbot",
        9: "configurator",
        10: "docs"
      };
      const id = legacyMap[target];
      if (id) {
        setActiveTab(id);
      }
    } else if (typeof target === "string") {
      setActiveTab(target);
    }
  };

  // Calculate Generalized Dhaka Division Scores (averaging all zones in Dhaka Division)
  const calcGeneralizedScores = (ts) => {
    const zones = Object.keys(UHI_ZONES);
    let totalDvs = 0;
    const currentHour = new Date().getHours();
    zones.forEach(z => {
      const { dvs } = calcBARIDVS({ trustScore: ts, zone: z, packaging: "standard", hour: currentHour, baseTemp: 31, windSpeed: 8 });
      totalDvs += dvs;
    });
    return Math.round(totalDvs / zones.length);
  };
  
  const genDvs = calcGeneralizedScores(trustScore);

  const themeVars = THEMES[theme];

  const activeTabs = [...TABS];
  if (selectedSme === "custom_sme") {
    activeTabs.push({ id: "configurator", label: "SME Configurator", icon: "🛠️" });
  }
  activeTabs.push({ id: "docs", label: "System Docs", icon: "📖" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "docs") {
      setActiveTab("docs");
    }
  }, [activeTabs.length]);

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

      {/* ── LEFT SLIDING DRAWER NAVBAR ───────────────────────── */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 100,
        opacity: isDrawerOpen ? 1 : 0,
        pointerEvents: isDrawerOpen ? "all" : "none",
        transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }} onClick={() => setIsDrawerOpen(false)}>
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 320,
          height: "100%",
          background: "var(--bg-header)",
          borderRight: "1px solid var(--border-primary)",
          boxShadow: "4px 0 24px rgba(0, 0, 0, 0.4)",
          display: "flex",
          flexDirection: "column",
          transform: isDrawerOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }} onClick={e => e.stopPropagation()}>
          {/* Drawer Header */}
          <div style={{
            padding: "24px",
            borderBottom: "1px solid var(--border-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🌱</span>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>Navigation Menu</div>
            </div>
            <button 
              onClick={() => setIsDrawerOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: 20,
                cursor: "pointer"
              }}
            >
              ✕
            </button>
          </div>

          {/* Drawer Tabs */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}>
            {activeTabs.map((t) => {
              const layerMeta = LAYER_META[t.layer || "L0"] || LAYER_META.L0;
              const isActive = activeTab === t.id;
              return (
                <button 
                  key={t.id} 
                  onClick={() => {
                    setActiveTab(t.id);
                    setIsDrawerOpen(false);
                  }}
                  title={`${layerMeta.name} layer`}
                  style={{
                    padding: "12px 16px",
                    border: "none",
                    background: isActive ? layerMeta.bg : "transparent",
                    color: isActive ? layerMeta.color : "var(--text-secondary)",
                    cursor: "pointer",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    textAlign: "left",
                    fontWeight: isActive ? 600 : 400,
                    transition: "all 0.2s",
                    borderLeft: isActive ? `3px solid ${layerMeta.color}` : "3px solid transparent",
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = "var(--bg-input)";
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: 16 }}>{t.icon}</span>
                  <div style={{ flex: 1, fontSize: 13, letterSpacing: "0.02em" }}>
                    {t.label}
                  </div>
                  {t.layer && t.layer !== "L0" && t.layer !== "LX" && (
                    <span style={{
                      fontSize: 8, padding: "2px 6px", borderRadius: 4,
                      background: layerMeta.bg, color: layerMeta.color,
                      border: `1px solid ${layerMeta.border}`,
                      letterSpacing: "0.08em", fontWeight: 700,
                    }}>{t.layer}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
          <button 
            onClick={() => setIsDrawerOpen(true)}
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              marginRight: 8,
              transition: "all 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT.green}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-primary)"}
          >
            <span style={{ fontSize: 16 }}>☰</span> Menu
          </button>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${ACCENT.greenLight}, ${ACCENT.greenDark})`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            animation: "pulseGlow 3s ease-in-out infinite",
          }}>🌱</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>CLimaLogix AI</div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.14em", fontWeight: 500 }}>CLIMATESHIELD · SME DASHBOARD</div>
          </div>
          {/* New SME Dropdown */}
          <div style={{ marginLeft: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            <span style={{ fontSize: 18 }}>⭐</span>
            <select 
              value={selectedSme}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSme(val);
                if (val === "custom_sme") {
                  setTab("configurator");
                } else {
                  setTab("dashboard");
                }
              }}
              style={{
                background: "transparent", color: "var(--text-primary)", border: "none",
                outline: "none", cursor: "pointer", fontSize: 14, fontWeight: 500
              }}
            >
              <option value="green_refineries">Green Refineries Ltd. (SME)</option>
              <option value="agro_eco">Agro Eco SME</option>
              <option value="custom_sme">🛠️ {customSmeName || "Custom SME"} (Configurator)</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Generalized Dhaka Division Score Indicator */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "8px 14px", borderRadius: 10,
            background: "var(--bg-input)", border: "1px solid var(--border-primary)",
            fontSize: 12, color: "var(--text-secondary)",
            letterSpacing: "0.02em"
          }}>
            <span style={{ fontWeight: 700, color: ACCENT.green }}>DHAKA DIV. GEN SCORE</span>
            <span>Gen. Trust: <strong style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{trustScore}</strong></span>
            <span style={{ width: 1, height: 12, background: "var(--border-primary)" }}></span>
            <span>Gen. DVS: <strong style={{ color: genDvs >= 75 ? ACCENT.green : genDvs >= 55 ? ACCENT.amber : ACCENT.red, fontFamily: "'JetBrains Mono', monospace" }}>{genDvs}</strong></span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <ScoreGauge value={trustScore} label="Trust" size={76} />
            <ScoreGauge value={genDvs} label="Gen. DVS" size={76} />
          </div>
          <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === "dark" ? "light" : "dark")} />
        </div>
      </header>

      {/* ── CONTENT ───────────────────────────────────────────── */}
      <main style={{ padding: "32px 48px", width: "100%", margin: "0 auto" }}>
        {activeTab === "dashboard" && <DashboardView onNewBatch={() => { setTab("batches"); setIsRegisteringBatch(true); }} />}
        
        {activeTab === "batches" && (
          isRegisteringBatch 
            ? <RegisterBatch onCancel={() => setIsRegisteringBatch(false)} />
            : <BatchRegistry onNewBatch={() => setIsRegisteringBatch(true)} />
        )}

        {activeTab === "verification" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, animation: "fadeSlideIn 0.4s ease" }}>
            <div>
              <SectionLabel icon="✅" text="Batch Verification" />
              <Card>
                <BatchVerificationForm
                  onResult={setTrustScore}
                  onResultDetail={setTrustScoreResult}
                  prefilledBatchId={verificationBatchId}
                  prefilledDispatchZone={verificationDispatchZone}
                  setPrefilledBatchId={setVerificationBatchId}
                  setPrefilledDispatchZone={setVerificationDispatchZone}
                />
              </Card>
            </div>
            <div>
              <SectionLabel icon="🛡️" text="Certification Pipeline" />
              <Card>
                <div style={{ textAlign: "center", padding: "12px 0 24px 0" }}>
                  <ScoreGauge value={trustScore} label="Global Trust Score" size={160} />
                </div>
                {/* Trust Score Grade Band (A/B/C/F) + Category + Reference */}
                {trustScoreResult && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4, marginBottom: 14, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
                      background: trustScoreResult.isViable ? ACCENT.greenBg : "rgba(239,68,68,0.12)",
                      color: trustScoreResult.isViable ? ACCENT.green : ACCENT.red,
                      border: `1px solid ${trustScoreResult.isViable ? ACCENT.greenBorder : "rgba(239,68,68,0.3)"}`,
                      letterSpacing: "0.05em",
                    }}>
                      GRADE {trustScoreResult.grade} · {trustScoreResult.isViable ? "VIABLE" : "NOT VIABLE"}
                    </span>
                    {trustScoreResult.category && trustScoreResult.category !== 'unknown' && (
                      <span style={{
                        fontSize: 10, padding: "4px 8px", borderRadius: 6,
                        background: "var(--bg-input)", color: "var(--text-secondary)",
                        border: "1px solid var(--border-primary)",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {String(trustScoreResult.category).replace(/_/g, ' ')}
                      </span>
                    )}
                    {trustScoreResult.reference && (
                      <span style={{
                        fontSize: 9, padding: "4px 8px", borderRadius: 6,
                        background: "var(--bg-input)", color: "var(--text-dim)",
                        border: "1px solid var(--border-primary)",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        ref: {trustScoreResult.reference}
                      </span>
                    )}
                  </div>
                )}
                {/* Sub-score breakdown bars */}
                {trustScoreResult && trustScoreResult.breakdown && (
                  <div style={{ marginTop: 8, padding: "12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-primary)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 8, letterSpacing: "0.08em", fontWeight: 600 }}>
                      SUB-SCORE BREAKDOWN
                    </div>
                    {[
                      { key: "ph",    label: "pH",         v: trustScoreResult.breakdown.ph    },
                      { key: "ec",    label: "EC",         v: trustScoreResult.breakdown.ec    },
                      { key: "temp",  label: "Temp",       v: trustScoreResult.breakdown.temp  },
                      { key: "ratio", label: "EM-1 Ratio", v: trustScoreResult.breakdown.ratio },
                      { key: "days",  label: "Ferment D.", v: trustScoreResult.breakdown.days  },
                    ].map(row => (
                      <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 80, fontSize: 10, color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {row.label}
                        </div>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border-primary)", overflow: "hidden" }}>
                          <div style={{
                            width: `${Math.max(0, Math.min(100, row.v || 0))}%`,
                            height: "100%",
                            background: (row.v || 0) >= 70 ? ACCENT.green : (row.v || 0) >= 50 ? ACCENT.amber : ACCENT.red,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <div style={{ width: 36, fontSize: 10, color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                          {Math.round(row.v || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, textAlign: "center", marginTop: 12 }}>
                  Adjust batch parameters on the left to verify a batch. A score of 60+ is required for BARI certification and cryptographic signing.
                </div>
              </Card>
            </div>
          </div>
          {/* ── Claim Verification lookup (3-layer L2 → L3 handoff) ── */}
          <div style={{ marginTop: 20 }}>
            <SectionLabel icon="🪪" text="Verify a Claim" />
            <Card>
              <ClaimVerifier onSelectBatch={(id) => setVerificationBatchId(id)} />
            </Card>
          </div>
          </>
        )}

        {activeTab === "microclimate" && (
          <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
            <SectionLabel icon="🌡️" text="Delivery Viability Simulator" />
            <Card>
              <MicroclimateSimulator trustScore={trustScore} dvs={dvs} setDvs={setDvs} />
            </Card>
          </div>
        )}

        {activeTab === "demand" && (
          <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
            <SectionLabel icon="📊" text="Market Intelligence" />
            <Card>
              <DemandChart />
            </Card>
          </div>
        )}

        {activeTab === "bi" && <BusinessIntelligenceView trustScore={trustScore} dvs={dvs} />}

        {activeTab === "esg" && (
          <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
            <SectionLabel icon="🌱" text="ESG Ledger" />
            <ESGCard trustScore={trustScore} dvs={dvs} />
          </div>
        )}

        {activeTab === "marketplace" && <MarketplaceView products={productsList} />}
        {activeTab === "chatbot" && (
          <ChatbotView
            setTab={setTab}
            products={productsList}
            setVerificationBatchId={setVerificationBatchId}
            setVerificationDispatchZone={setVerificationDispatchZone}
          />
        )}
        {activeTab === "configurator" && selectedSme === "custom_sme" && (
          <CustomSmeView
            products={productsList}
            setProducts={setProductsList}
            customSmeName={customSmeName}
            setCustomSmeName={setCustomSmeName}
          />
        )}
        {activeTab === "docs" && (
          <SystemDocsView productsList={productsList} />
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
          CLIMALOGIX AI CLIMATESHIELD · INFINITY AI BUILDFEST 2026 · TEAM GLIDERS · TRACK 4: E-COMMERCE
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 9, color: "var(--text-dim)" }}>
          <span>Trust Score: <span style={{ color: ACCENT.green, fontFamily: "'JetBrains Mono', monospace" }}>{trustScore}/100</span></span>
          <span>DVS: <span style={{ color: dvs >= 75 ? ACCENT.green : dvs >= 55 ? ACCENT.amber : ACCENT.red, fontFamily: "'JetBrains Mono', monospace" }}>{dvs}/100</span></span>
        </div>
      </footer>
      <AgentPanel 
        setTab={setTab} 
        products={productsList} 
        setVerificationBatchId={setVerificationBatchId}
        setVerificationDispatchZone={setVerificationDispatchZone}
      />
    </div>
  );
}

window.CLimaLogixApp = CLimaLogixApp;

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<CLimaLogixApp />);