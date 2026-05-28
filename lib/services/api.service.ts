/**
 * API Service Layer
 * Handles all communication with the backend server
 * Provides a clean, typed interface for frontend components
 */

const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.REACT_APP_API_URL || `http://localhost:${process.env.REACT_APP_API_PORT || 5000}`)
  : '';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export interface BatchData {
  id?: string;
  processor_id?: string;
  batch_number: string;
  feedstock_type: string;
  product_name?: string;
  trust_score: number;
  certificate_url?: string;
  qr_code_url?: string;
  created_at?: string;
}

export interface IOTReading {
  id?: string;
  batch_id: string;
  pH: number;
  EC: number;
  temperature: number;
  em1_ratio?: string;
  fermentation_days?: number;
  recorded_at?: string;
}

export interface ZoneProfile {
  id?: string;
  zone: string;
  uhi_offset: number;
  building_density?: number;
  vegetation_fraction?: number;
  wind_corridor_factor?: number;
  thermal_mass_coefficient?: number;
  created_at?: string;
}

export interface User {
  id?: string;
  email: string;
  name: string;
  role: 'processor' | 'buyer' | 'admin';
  created_at?: string;
}

/**
 * Fetch wrapper with error handling
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  try {
    const url = `${API_BASE_URL}/api${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Health & Diagnostics
 */
export const HealthAPI = {
  checkHealth: () => fetchAPI('/health'),
  testDatabase: () => fetchAPI('/test-db'),
};

/**
 * Zone/Microclimate Endpoints
 */
export const ZoneAPI = {
  getAllZones: () => fetchAPI<ZoneProfile[]>('/zones'),
  getZone: (zoneName: string) => fetchAPI<ZoneProfile>(`/zones/${zoneName}`),
  createZone: (data: ZoneProfile) =>
    fetchAPI<ZoneProfile>('/zones', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateZone: (zoneName: string, data: Partial<ZoneProfile>) =>
    fetchAPI<ZoneProfile>(`/zones/${zoneName}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

/**
 * Batch Management Endpoints
 */
export const BatchAPI = {
  getAllBatches: (processorId?: string) => {
    const query = processorId ? `?processor_id=${processorId}` : '';
    return fetchAPI<BatchData[]>(`/batches${query}`);
  },
  getBatch: (batchId: string) => fetchAPI<BatchData>(`/batches/${batchId}`),
  createBatch: (data: BatchData) =>
    fetchAPI<BatchData>('/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateBatch: (batchId: string, data: Partial<BatchData>) =>
    fetchAPI<BatchData>(`/batches/${batchId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteBatch: (batchId: string) =>
    fetchAPI(`/batches/${batchId}`, {
      method: 'DELETE',
    }),
};

/**
 * IoT Readings Endpoints
 */
export const IOTReadingAPI = {
  getReadings: (batchId: string) =>
    fetchAPI<IOTReading[]>(`/batches/${batchId}/readings`),
  recordReading: (batchId: string, data: Omit<IOTReading, 'batch_id'>) =>
    fetchAPI<IOTReading>(`/batches/${batchId}/readings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

/**
 * Trust Score Calculation
 */
export const TrustScoreAPI = {
  calculate: (params: {
    pH: number;
    EC: number;
    temperature: number;
    ratio?: string;
    days?: number;
  }) =>
    fetchAPI<{ trust_score: number; parameters: any }>('/calculate-trust-score', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

/**
 * Demand Forecast Endpoint
 */
export const ForecastAPI = {
  getDemandForecast: () => fetchAPI('/demand-forecast'),
};

/**
 * User Endpoints
 */
export const UserAPI = {
  getAllUsers: () => fetchAPI<User[]>('/users'),
  createUser: (data: User) =>
    fetchAPI<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

/**
 * Main API Client Object
 */
export const APIClient = {
  health: HealthAPI,
  zones: ZoneAPI,
  batches: BatchAPI,
  iotReadings: IOTReadingAPI,
  trustScore: TrustScoreAPI,
  forecast: ForecastAPI,
  users: UserAPI,
};

export default APIClient;
