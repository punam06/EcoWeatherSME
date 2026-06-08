const BACKEND_URL = "http://localhost:3000";

const apiCall = async (endpoint, options = {}) => {
  const token = window.SUPABASE_SESSION_TOKEN || localStorage.getItem("sb-token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    console.warn("[API] Unauthorized: 401");
    // Optionally trigger a logout or show a toast
    if (window.showToast) window.showToast("Session expired. Please log in again.", "error");
    // Clean up local token
    localStorage.removeItem("sb-token");
    window.SUPABASE_SESSION_TOKEN = null;
  }

  return response.json();
};

window.apiCall = apiCall;
