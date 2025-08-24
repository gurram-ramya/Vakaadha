// ==============================
// frontend/api/client.js
// Centralized API client for frontend
// ==============================

export const API_BASE = "/"; // change if backend runs on another port

// Helper to get stored token
function getToken() {
  const stored = JSON.parse(localStorage.getItem("loggedInUser"));
  return stored ? stored.idToken : null;
}

// Generic API request
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = options.headers || {};

  // Always send JSON
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Attach auth token if available
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  const res = await fetch(API_BASE + endpoint, {
    ...options,
    headers
  });

  // Handle unauthorized globally
  if (res.status === 401) {
    localStorage.removeItem("loggedInUser");
    window.location.href = "/"; // force logout
    throw new Error("Unauthorized, please log in again.");
  }

  // Parse JSON or throw
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API request failed");
  }

  return res.json();
}

// Exported API methods
export const apiClient = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: "POST", body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: "PUT", body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: "DELETE" })
};
