// =============================================================
// profile.js — VAKAADHA USER PROFILE (READ-ONLY VIEW)
// -------------------------------------------------------------
// Responsibilities:
// • Ensure user is authenticated (via auth.js)
// • Fetch user profile from backend (via client.js)
// • Render profile fields into profile.html DOM
//
// Non-Responsibilities (intentional):
// • No Firebase calls
// • No token handling beyond auth.getToken()
// • No registration / reconciliation
// • No navbar manipulation
// • No logout logic
// • No credential linking
// =============================================================

(function () {
  if (window.__profile_js_bound__) return;
  window.__profile_js_bound__ = true;

  const LOGIN_URL = "login.html";

  // ------------------------------------------------------------
  // DOM references — MUST match profile.html exactly
  // ------------------------------------------------------------
  const els = {
    name: document.getElementById("p-name"),
    phone: document.getElementById("p-phone"),
    email: document.getElementById("p-email"),
    gender: document.getElementById("p-gender"),
    dob: document.getElementById("p-dob"),
    location: document.getElementById("p-location"),
    altMobile: document.getElementById("p-alt-mobile"),
    hint: document.getElementById("p-hint"),
  };

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function redirectToLogin() {
    try {
      if (!/login\.html$/i.test(String(window.location.pathname || ""))) {
        window.location.href = LOGIN_URL;
      }
    } catch {
      window.location.href = LOGIN_URL;
    }
  }

  function safeText(el, value) {
    if (!el) return;
    el.textContent =
      value === null || value === undefined || value === ""
        ? "–"
        : String(value);
  }

  function normalizeProfilePayload(me) {
    // Backend may evolve; tolerate missing fields and shape changes
    const profile = me?.profile && typeof me.profile === "object" ? me.profile : null;

    return {
      name: me?.name ?? null,
      phone: me?.phone ?? null,
      email: me?.email ?? null,
      gender: profile?.gender ?? null,
      dob: profile?.dob ?? null,
      location: profile?.location ?? null,
      altMobile: profile?.alt_mobile ?? null,
      hint: profile?.hint_name ?? null,
    };
  }

  function renderProfile(me) {
    const p = normalizeProfilePayload(me);

    safeText(els.name, p.name);
    safeText(els.phone, p.phone);
    safeText(els.email, p.email);
    safeText(els.gender, p.gender);
    safeText(els.dob, p.dob);
    safeText(els.location, p.location);
    safeText(els.altMobile, p.altMobile);
    safeText(els.hint, p.hint);
  }

  // ------------------------------------------------------------
  // Preconditions
  // ------------------------------------------------------------
  async function ensureAuthenticated() {
    // auth.js must be loaded and authoritative
    if (!window.auth || typeof window.auth.getToken !== "function") {
      redirectToLogin();
      return false;
    }

    const token = await window.auth.getToken();
    if (!token) {
      redirectToLogin();
      return false;
    }

    // client.js must expose apiRequest
    if (typeof window.apiRequest !== "function") {
      // catastrophic mis-load; fail closed
      redirectToLogin();
      return false;
    }

    return true;
  }

  // ------------------------------------------------------------
  // Load profile from backend (single source of truth)
  // ------------------------------------------------------------
  async function loadProfile() {
    try {
      const me = await window.apiRequest("/api/users/me");
      renderProfile(me);
    } catch (err) {
      // Fail closed on any backend auth/shape issues
      try {
        console.error("[profile.js] Failed to load profile:", err);
      } catch {}
      redirectToLogin();
    }
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------
  async function initProfile() {
    const ok = await ensureAuthenticated();
    if (!ok) return;
    await loadProfile();
  }

  document.addEventListener("DOMContentLoaded", initProfile);
})();
