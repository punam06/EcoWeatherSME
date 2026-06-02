/**
 * CLimaLogix AI Dashboard - Frontend Integration Layer
 * Handles API communication with backend
 * Browser-based React component
 */

// API Client - Simple fetch wrapper for backend communication
const IS_STATIC_FILE = window.location.protocol === 'file:';
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
const API_BASE_URL = IS_LOCAL
  ? 'http://localhost:5001'
  : 'https://ecosortha.onrender.com';

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
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
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

  // ESG Metrics
  getESGMetrics: (trustScore, dvs) => {
    const query = (trustScore !== undefined && dvs !== undefined) ? `?trustScore=${trustScore}&dvs=${dvs}` : '';
    return APIClient.request(`/esg${query}`);
  },

  // Forecast
  getDemandForecast: () => APIClient.request('/demand-forecast'),

  // Users
  getUsers: () => APIClient.request('/users'),
  createUser: (data) => APIClient.request('/users', { method: 'POST', body: JSON.stringify(data) }),

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
  
  try {
    // Test backend health
    const healthResponse = await APIClient.health();
    if (healthResponse.success) {
      console.log('✅ Backend server connected');
    }

    // Test database connection
    const dbResponse = await APIClient.testDB();
    if (dbResponse.success) {
      console.log('✅ Database connected');
    }

    // Load zones
    const zonesResponse = await APIClient.getZones();
    if (zonesResponse.success) {
      console.log(`✅ Loaded ${zonesResponse.count || zonesResponse.data.length} zones`);
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
