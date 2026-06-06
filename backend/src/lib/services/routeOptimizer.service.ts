/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — ROUTE OPTIMIZER SERVICE
 * File: src/lib/services/routeOptimizer.service.ts
 *
 * Computes the optimal (lowest Thermal Risk Score) delivery path
 * through a sequence of Dhaka zones using:
 *
 *  1. Per-segment Adjusted Temperature = base_temp + UHI_offset
 *                                        × solar_factor − wind_cooling
 *  2. ThermalRiskScore (TRS) per segment [0..100]
 *  3. A greedy nearest-neighbor heuristic for multi-stop ordering
 *  4. Safe delivery windows based on adjusted temperature thresholds
 *
 * Output is an ordered list of stops with per-stop risk data and a
 * combined route TRS used by the frontend to colour-code the map.
 * ═══════════════════════════════════════════════════════════════
 */

import { getZoneProfile } from './merm.service';

// ── Type Definitions ─────────────────────────────────────────────────────────

export interface RouteStop {
  zone: string;
  latitude: number;
  longitude: number;
}

export interface OptimizedStop extends RouteStop {
  adjustedTempC: number;
  trs: number;            // 0-100 Thermal Risk Score (lower = better)
  riskLabel: 'Safe' | 'Moderate' | 'High' | 'Critical';
  riskColor: string;
  safeWindowStart: number; // hour (0-23)
  safeWindowEnd: number;   // hour (0-23)
  tst_minutes: number;     // Thermal Stability Time estimate
}

export interface RouteOptimizerResult {
  orderedStops: OptimizedStop[];
  combinedTRS: number;       // Average TRS across all stops
  totalDistanceKm: number;   // Haversine approximation
  safeToDispatchNow: boolean;
  optimizationAdvice: string;
}

// ── Zone Coordinate Map ───────────────────────────────────────────────────────

const ZONE_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'Old Dhaka':        { lat: 23.7083, lon: 90.4075 },
  'Mirpur':           { lat: 23.8041, lon: 90.3625 },
  'Savar':            { lat: 23.8529, lon: 90.2668 },
  'Gulshan':          { lat: 23.7925, lon: 90.4078 },
  'Dhanmondi':        { lat: 23.7461, lon: 90.3742 },
  'Motijheel':        { lat: 23.7330, lon: 90.4172 },
  'Tejgaon':          { lat: 23.7612, lon: 90.3994 },
  'Uttara':           { lat: 23.8759, lon: 90.3795 },
  'Banani':           { lat: 23.7940, lon: 90.4043 },
  'Mohammadpur':      { lat: 23.7610, lon: 90.3571 },
  'Gazipur':          { lat: 23.9999, lon: 90.4203 },
  'Badda':            { lat: 23.7797, lon: 90.4253 },
  'Rampura':          { lat: 23.7659, lon: 90.4297 },
  'Khilgaon':         { lat: 23.7466, lon: 90.4261 },
  'Jatrabari':        { lat: 23.7194, lon: 90.4339 },
  'Hazaribagh':       { lat: 23.7222, lon: 90.3706 },
  'Kamrangirchar':    { lat: 23.7150, lon: 90.3833 },
  'Lalbagh':          { lat: 23.7194, lon: 90.3881 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Haversine distance between two lat/lon points in kilometres. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns a 0–1 solar intensity factor for a given hour (0-23). */
function solarFactor(hour: number): number {
  if (hour >= 11 && hour < 15) return 1.0;
  if ((hour >= 8 && hour < 11) || (hour >= 15 && hour < 18)) return 0.6;
  return 0.2;
}

/**
 * Computes adjusted temperature for a zone-hour combination.
 * UHI_offset comes from the merm.service zone profile.
 */
function adjustedTemp(
  zoneName: string,
  baseTemp: number,
  hour: number,
  windSpeed: number,
): number {
  const profile = getZoneProfile(zoneName);
  const sf = solarFactor(hour);
  const windCooling = windSpeed * 0.08;
  return baseTemp + profile.uhiOffset * sf - windCooling;
}

/**
 * Converts an adjusted temperature to a Thermal Risk Score [0–100].
 * Lower score = lower thermal danger.
 */
function tempToTRS(adjTemp: number): { trs: number; riskLabel: OptimizedStop['riskLabel']; riskColor: string } {
  if (adjTemp > 40) return { trs: 95, riskLabel: 'Critical', riskColor: '#DC2626' };
  if (adjTemp > 37) return { trs: 75, riskLabel: 'High',     riskColor: '#F59E0B' };
  if (adjTemp > 34) return { trs: 45, riskLabel: 'Moderate', riskColor: '#FBBF24' };
  return { trs: 15, riskLabel: 'Safe', riskColor: '#10B981' };
}

/**
 * Simple TST estimate (minutes) based on adjusted temperature.
 * Higher temperature → shorter safe delivery window.
 */
function estimateTST(adjTemp: number, trustScore: number, packagingType: string): number {
  const pkgFactor = packagingType === 'thermal' ? 4.0 : packagingType === 'insulated' ? 2.0 : 1.0;
  const tempFactor = Math.max(0.3, (adjTemp - 18) / 10);
  return Math.max(10, Math.round((trustScore * pkgFactor * 1.8) / (1.1 * 1.0 * tempFactor)));
}

/** Returns the safest delivery hours for a given zone/baseTemp combination. */
function safeWindow(zoneName: string, baseTemp: number, windSpeed: number): { start: number; end: number } {
  // Check each hour and find the first and last "safe" hour
  let start = 0;
  let end = 23;
  for (let h = 0; h <= 23; h++) {
    const adj = adjustedTemp(zoneName, baseTemp, h, windSpeed);
    if (adj <= 34) {
      start = h;
      break;
    }
  }
  for (let h = 23; h >= 0; h--) {
    const adj = adjustedTemp(zoneName, baseTemp, h, windSpeed);
    if (adj <= 34) {
      end = h;
      break;
    }
  }
  // Swap if end < start (shouldn't happen but guard)
  if (end < start) { const t = start; start = end; end = t; }
  return { start, end };
}

// ── Main Optimizer ────────────────────────────────────────────────────────────

/**
 * Optimizes a delivery route through the specified zones.
 *
 * @param stops       - Array of RouteStop (zone names + optional lat/lon overrides)
 * @param baseTemp    - Ambient base temperature in °C
 * @param solarHour   - Current hour (0-23) for solar factor calculation
 * @param windSpeed   - Wind speed km/h
 * @param trustScore  - Bio-asset trust score (used for TST estimation)
 * @param packaging   - Packaging type: 'standard' | 'insulated' | 'thermal'
 */
export function optimizeRoute(
  stops: RouteStop[],
  baseTemp: number,
  solarHour: number,
  windSpeed: number,
  trustScore: number = 80,
  packaging: string = 'standard',
): RouteOptimizerResult {
  if (stops.length === 0) {
    return {
      orderedStops: [],
      combinedTRS: 0,
      totalDistanceKm: 0,
      safeToDispatchNow: true,
      optimizationAdvice: 'No stops provided.',
    };
  }

  // Enrich stops with coordinates if not provided
  const enriched = stops.map((s) => {
    const coords = ZONE_COORDINATES[s.zone] ?? { lat: 23.8103, lon: 90.4125 };
    return {
      ...s,
      latitude: s.latitude ?? coords.lat,
      longitude: s.longitude ?? coords.lon,
    };
  });

  // Per-stop risk computation
  const scored: OptimizedStop[] = enriched.map((s) => {
    const adjTemp = adjustedTemp(s.zone, baseTemp, solarHour, windSpeed);
    const { trs, riskLabel, riskColor } = tempToTRS(adjTemp);
    const window = safeWindow(s.zone, baseTemp, windSpeed);
    const tst = estimateTST(adjTemp, trustScore, packaging);
    return {
      ...s,
      adjustedTempC: parseFloat(adjTemp.toFixed(1)),
      trs,
      riskLabel,
      riskColor,
      safeWindowStart: window.start,
      safeWindowEnd: window.end,
      tst_minutes: tst,
    };
  });

  // Greedy nearest-neighbour re-ordering (starting from origin stop[0])
  const origin = scored[0];
  const remaining = scored.slice(1);
  const ordered: OptimizedStop[] = [origin];
  let curLat = origin.latitude;
  let curLon = origin.longitude;

  while (remaining.length > 0) {
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(curLat, curLon, remaining[i].latitude, remaining[i].longitude);
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    }
    const next = remaining.splice(minIdx, 1)[0];
    ordered.push(next);
    curLat = next.latitude;
    curLon = next.longitude;
  }

  // Total distance (haversine sum)
  let totalDistanceKm = 0;
  for (let i = 1; i < ordered.length; i++) {
    totalDistanceKm += haversineKm(
      ordered[i - 1].latitude,
      ordered[i - 1].longitude,
      ordered[i].latitude,
      ordered[i].longitude,
    );
  }
  totalDistanceKm = parseFloat(totalDistanceKm.toFixed(2));

  const combinedTRS = parseFloat(
    (ordered.reduce((sum, s) => sum + s.trs, 0) / ordered.length).toFixed(1)
  );

  const safeToDispatchNow = ordered.every((s) => s.riskLabel !== 'Critical');

  // Advice generation
  const criticalZones = ordered.filter((s) => s.riskLabel === 'Critical').map((s) => s.zone);
  const highZones = ordered.filter((s) => s.riskLabel === 'High').map((s) => s.zone);

  let optimizationAdvice = '';
  if (criticalZones.length > 0) {
    optimizationAdvice = `⚠️ Critical thermal zones detected: ${criticalZones.join(', ')}. Dispatch after 5:00 PM to reduce UHI exposure by ~2.8°C.`;
  } else if (highZones.length > 0) {
    optimizationAdvice = `⚡ High thermal risk in: ${highZones.join(', ')}. Pre-cool cargo to ≤18°C. Avoid 11AM–3PM peak solar window.`;
  } else {
    optimizationAdvice = `✅ Route is thermally safe. All zones within acceptable temperature range. Maintain standard packaging.`;
  }

  return {
    orderedStops: ordered,
    combinedTRS,
    totalDistanceKm,
    safeToDispatchNow,
    optimizationAdvice,
  };
}

/** Returns a list of all known zone names with their coordinates. */
export function getKnownZones(): Array<{ zone: string; lat: number; lon: number }> {
  return Object.entries(ZONE_COORDINATES).map(([zone, coords]) => ({
    zone,
    lat: coords.lat,
    lon: coords.lon,
  }));
}
