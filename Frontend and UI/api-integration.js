/**
 * CLimaLogix AI Dashboard - Frontend Integration Layer
 * Handles API communication with backend
 * Browser-based React component
 */

// API Client - Simple fetch wrapper for backend communication
const IS_STATIC_FILE = window.location.protocol === 'file:';
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
// IMPORTANT: The production backend that the live dashboard talks to is
// https://backsme.onrender.com. The previous value
// (https://climalogix.onrender.com) is a dead host that 404s on every route
// and was the root cause of the "ESG page failed to load" bug.
const API_BASE_URL = IS_LOCAL
  ? 'http://localhost:5001'
  : 'https://backsme.onrender.com';

// Helper: some backends return { success, data: {...} } envelopes, others
// return the payload flat. The bulk of the React code (IoTForm, BatchRegistry,
// the zone loader, the order flow, …) reads `res.success && res.data` on the
// response, so we keep the envelope intact by default. Methods that return
// FLAT payloads (ESG, health) call `unwrap()` on their own response.
function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

function getAuthHeaders() {
  const token = localStorage.getItem('climalogix_token') || sessionStorage.getItem('climalogix_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function apiCall(path, method = 'GET', body = null) {
  try {
    const BASE_URL = window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://backsme.onrender.com';

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(${BASE_URL}, options);

    if (response.status === 401) {
      localStorage.removeItem('climalogix_token');
      sessionStorage.removeItem('climalogix_token');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }

    const json = await response.json();
    if (!json.success) throw new Error(json.message || json.error || 'API request failed');
    return json;
  } catch (err) {
    console.error('API Call Failed:', err);
    return Promise.reject(err);
  }
}

const APIClient = {
  async request(endpoint, options = {}) {
    try {
      const url = `${API_BASE_URL}/api${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(window.SUPABASE_SESSION_TOKEN ? { 'Authorization': `Bearer ${window.SUPABASE_SESSION_TOKEN}` } : {}),
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      // Return the raw JSON so callers that expect the {success, data} envelope
      // (certifyBatch, getBatches, getZones, …) keep working. Methods that
      // expect a flat payload (getESGMetrics, health) call `unwrap()` on
      // their own response.
      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Health checks — health returns a flat {status, message, ...} payload,
  // not an envelope, so we unwrap defensively (no-op for the real shape).
  health: async () => unwrap(await APIClient.request('/health')),
  testDB: () => APIClient.request('/test-db'),

  // Zone operations
  getZones: () => APIClient.request('/zones'),
  getZone: (zone) => APIClient.request(`/zones/${zone}`),
  createZone: (data) => APIClient.request('/zones', { method: 'POST', body: JSON.stringify(data) }),

  // Batch operations
  getBatches: (processorId) => {
    const query = processorId ? `?processor_id=${processorId}` : '';
    return APIClient.request(`/batches${query}`);
  },
  getBatch: (id) => APIClient.request(`/batches/${id}`),
  createBatch: (data) => APIClient.request('/batches', { method: 'POST', body: JSON.stringify(data) }),
  updateBatch: (id, data) => APIClient.request(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  certifyBatch: (data) => APIClient.request('/batches/certify', { method: 'POST', body: JSON.stringify(data) }),

  // IoT readings
  getReadings: (batchId) => APIClient.request(`/batches/${batchId}/readings`),
  recordReading: (batchId, data) => APIClient.request(`/batches/${batchId}/readings`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // QA Ingestion
  submitQAReport: (data) => APIClient.request('/qa/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getQAReports: (batchId) => APIClient.request(`/qa/${encodeURIComponent(batchId)}`),
  getQACategories: () => APIClient.request('/qa/categories'),

  // Trust score
  calculateTrustScore: (params) => APIClient.request('/calculate-trust-score', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // Direct trust score (new route, returns {success, data: {score, grade, breakdown, ...}})
  getTrustScore: (params) =>
    APIClient.request('/batch/trust-score', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Direct DVS (new route)
  getDVS: (params) =>
    APIClient.request('/climate/dvs', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // ── Legacy clever-responder helpers (used by current index.html) ──
  // Legacy trust-score uses action='trust-score' and accepts {pH, EC, temp, ratio, days}
  calculateTrustScoreLegacy: (params) => {
    const { ec, ...rest } = params;
    return APIClient.request('/clever-responder', {
      method: 'POST',
      body: JSON.stringify({
        action: 'trust-score',
        EC: ec,
        ...rest,
      }),
    });
  },

  // Legacy microclimate metrics uses action='microclimate-metrics'
  getMicroclimateMetricsLegacy: (params) =>
    APIClient.request('/clever-responder', {
      method: 'POST',
      body: JSON.stringify({
        action: 'microclimate-metrics',
        ...params,
      }),
    }),

  // Claim verification (new route)
  verifyClaim: (batchId) => APIClient.request(`/verify/${encodeURIComponent(batchId)}`),

  // ESG Metrics — backend returns a FLAT object (e_score, s_score, g_score, ...).
  // ESGCard reads those flat fields directly, so we strip the envelope.
  getESGMetrics: async (trustScore, dvs) => {
    const query = (trustScore !== undefined && dvs !== undefined) ? `?trustScore=${trustScore}&dvs=${dvs}` : '';
    return unwrap(await APIClient.request(`/esg${query}`));
  },

  // Monthly ESG report (new route, used by the ESGCard panel)
  getESGReport: (months = 12) => APIClient.request(`/esg/report?months=${months}`),

  // Business Intelligence aggregation (sustainability + market)
  getBI: () => APIClient.request('/bi'),

  // QR scan history for a batch
  getBatchScans: (batchId) => APIClient.request(`/batches/${encodeURIComponent(batchId)}/scans`),

  // SME inventory intake — QR claim + climate sale-window advisory
  claimSMEInventory: (batchId, data = {}) =>
    APIClient.request(`/qr/sme-claim/${encodeURIComponent(batchId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Forecast
  getDemandForecast: () => APIClient.request('/demand-forecast'),

  // AI Recommend
  getAIRecommendations: (payload) => APIClient.request('/ai/recommend', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Users
  getUsers: () => APIClient.request('/users'),
  createUser: (data) => APIClient.request('/users', { method: 'POST', body: JSON.stringify(data) }),

  // Order lifecycle (dispatch / receipt)
  dispatchOrder: (orderId, payload = {}) =>
    APIClient.request(`/orders/${orderId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  confirmOrderReceipt: (orderId, payload = {}) =>
    APIClient.request(`/orders/${orderId}/receipt`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // External APIs (Weather & Geocoding)
  geocode: (query) => APIClient.request(`/geocode?q=${encodeURIComponent(query)}`),
  getWeather: (lat, lon) => APIClient.request(`/weather?lat=${lat}&lon=${lon}`),
};

// Utility function to initialize database connections on page load
async function initializeConnections() {
  if (IS_STATIC_FILE) {
    console.log('ℹ️ Static file mode detected, skipping backend initialization');
    return false;
  }

  console.log('🔄 Initializing connections...');

  // After `unwrap()` the envelope is gone. We treat a response as "ok" if:
  //   - the call didn't throw, AND
  //   - the payload doesn't have a `success: false` flag, AND
  //   - if it has a `status` field, that field is "ok".
  const isOk = (r) => {
    if (r == null || r instanceof Error) return false;
    if (r.success === false) return false;
    if (typeof r.status === 'string' && r.status !== 'ok') return false;
    return true;
  };

  try {
    const healthResponse = await APIClient.health();
    if (isOk(healthResponse)) {
      console.log('✅ Backend server connected');
    } else {
      console.warn('⚠️ Backend health check returned non-ok payload:', healthResponse);
    }

    const dbResponse = await APIClient.testDB();
    if (isOk(dbResponse)) {
      console.log('✅ Database connected');
    } else {
      console.warn('⚠️ Database check failed (this is expected in production where DATABASE_URL is not set):', dbResponse);
    }

    const zonesResponse = await APIClient.getZones();
    if (isOk(zonesResponse)) {
      const zones = Array.isArray(zonesResponse)
        ? zonesResponse
        : (zonesResponse.data || zonesResponse.zones || []);
      const count = zonesResponse.count != null ? zonesResponse.count : (Array.isArray(zones) ? zones.length : 0);
      console.log(`✅ Loaded ${count} zones`);
    } else {
      console.warn('⚠️ Failed to load zones (DATABASE_URL may not be set in this environment):', zonesResponse);
    }

    return true;
  } catch (error) {
    console.error('❌ Connection initialization failed:', error);
    return false;
  }
}

// Export for use in React components
window.APIClient = APIClient;
window.initializeConnections = initializeConnections;
window.apiCall = apiCall;

// Auto-initialize on load
if (!IS_STATIC_FILE) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeConnections);
  } else {
    initializeConnections();
  }
}

