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
// (https://ecosortha.onrender.com) is a dead host that 404s on every route
// and was the root cause of the "ESG page failed to load" bug.
const API_BASE_URL = IS_LOCAL
  ? 'http://localhost:5001'
  : 'https://backsme.onrender.com';

// Helper: some backends return { success, data: {...} } envelopes, others
// return the payload flat. Normalize to the flat shape that the React
// components (ESGCard, IoTForm, BatchRegistry, …) actually read.
function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

const APIClient = {
  async request(endpoint, options = {}) {
    try {
      const url = `${API_BASE_URL}/api${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      const payload = await response.json();
      return unwrap(payload);
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Health checks
  health: () => APIClient.request('/health'),
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

  // Trust score
  calculateTrustScore: (params) => APIClient.request('/calculate-trust-score', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // Direct trust score (new route, returns {score, grade, breakdown, ...})
  getTrustScore: (params) => APIClient.request('/batch/trust-score', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // Direct DVS (new route)
  getDVS: (params) => APIClient.request('/climate/dvs', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // Claim verification (new route)
  verifyClaim: (batchId) => APIClient.request(`/verify/${encodeURIComponent(batchId)}`),

  // ESG Metrics — returns the FLAT shape (e_score, s_score, g_score, ...) that
  // ESGCard reads, regardless of whether the live backend wraps it in
  // {success, data} or sends it raw.
  getESGMetrics: (trustScore, dvs) => {
    const query = (trustScore !== undefined && dvs !== undefined) ? `?trustScore=${trustScore}&dvs=${dvs}` : '';
    return APIClient.request(`/esg${query}`);
  },

  // Monthly ESG report (new route, used by the ESGCard panel)
  getESGReport: (months = 12) => APIClient.request(`/esg/report?months=${months}`),

  // Forecast
  getDemandForecast: () => APIClient.request('/demand-forecast'),

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

// Auto-initialize on load
if (!IS_STATIC_FILE) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeConnections);
  } else {
    initializeConnections();
  }
}
