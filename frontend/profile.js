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
  const ME_ENDPOINT = "/api/users/me";
  const REGISTER_ENDPOINT = "/api/auth/register";

  const els = {
    name: document.getElementById("p-name"),
    phone: document.getElementById("p-phone"),
    email: document.getElementById("p-email"),
    gender: document.getElementById("p-gender"),
    dob: document.getElementById("p-dob"),
    location: document.getElementById("p-location"),
    altMobile: document.getElementById("p-alt-mobile"),
    hint: document.getElementById("p-hint"),
    // optional placeholder for errors if you have one:
    error: document.getElementById("profile-error")
  };

  function safeText(el, value) {
    if (!el) return;
    el.textContent =
      value === null || value === undefined || String(value).trim() === ""
        ? "–"
        : String(value);
  }

  function showError(msg) {
    try {
      console.warn("[profile.js]", msg);
      if (els.error) {
        els.error.textContent = msg;
        els.error.style.display = "";
      }
    } catch {}
  }

  function redirectToLogin() {
    if (window.__PROFILE_NO_REDIRECT__) {
      console.warn("[profile.js] Suppressing redirect (debug mode enabled). Would have navigated to", LOGIN_URL);
      return;
    }
    try {
      if (!/login\.html$/i.test(String(window.location.pathname || ""))) {
        window.location.href = LOGIN_URL;
      }
    } catch {
      window.location.href = LOGIN_URL;
    }
  }

  async function ensureAuthReady() {
    try { await window.auth?.initSession?.(); } catch {}
    // give firebase a short window to mint a token
    try { await window.auth?.waitForReady?.(5000); } catch {}
  }

  async function getTokenSafe() {
    try {
      const t = await window.auth?.getToken?.({ forceRefresh: false });
      if (t) return t;
      // one small retry in case we raced the mint
      await new Promise(r => setTimeout(r, 200));
      return await window.auth?.getToken?.({ forceRefresh: true });
    } catch {
      return null;
    }
  }

  function normalizeProfile(me) {
    // Backend returns full_name, mobile, email, etc.
    // Keep tolerant mapping for older payloads.
    const gender = me?.gender ?? me?.profile?.gender ?? null;
    const dob = me?.dob ?? me?.profile?.dob ?? null;
    const location = me?.location ?? me?.profile?.location ?? null;
    const altMobile = me?.alt_mobile ?? me?.profile?.alt_mobile ?? null;
    const hint = me?.hint_name ?? me?.profile?.hint_name ?? null;

    return {
      name: me?.full_name ?? me?.name ?? null,
      phone: me?.mobile ?? me?.phone ?? null,
      email: me?.email ?? null,
      gender,
      dob,
      location,
      altMobile,
      hint
    };
  }

  async function fetchMe() {
    // window.apiRequest adds Authorization + X-Guest-Id automatically
    return window.apiRequest(ME_ENDPOINT);
  }

  async function registerUserIfNeeded() {
    // POST /api/auth/register (no body required; backend tolerates missing name)
    try {
      const res = await window.apiRequest(REGISTER_ENDPOINT, { method: "POST", body: {} });
      return res && res.status === "ok";
    } catch (e) {
      console.warn("[profile.js] registerUserIfNeeded failed:", e && e.status, e && e.message);
      return false;
    }
  }

  async function loadProfileWithMerge() {
    // 1) try get /me
    try {
      const me = await fetchMe();
      return me;
    } catch (e) {
      // If truly unauth → redirect
      if (e && e.status === 401) {
        redirectToLogin();
        throw e; // stop init
      }
      // First-time user: 404 → register, then retry once
      if (e && e.status === 404) {
        const ok = await registerUserIfNeeded();
        if (ok) {
          try {
            const me2 = await fetchMe();
            return me2;
          } catch (e2) {
            // Still failing after register → do not redirect, just surface
            showError("Could not load profile after registration. Please refresh.");
            throw e2;
          }
        } else {
          showError("Registration/merge failed. Please retry from profile page.");
          throw e;
        }
      }
      // Other errors (5xx/network) → do not redirect; surface error and keep placeholders
      showError(`Failed to load profile (status ${e && e.status || "?"}).`);
      throw e;
    }
  }

  async function initProfile() {
    // Only redirect when *not logged in*
    await ensureAuthReady();
    const token = await getTokenSafe();
    if (!token) {
      redirectToLogin();
      return;
    }

    // Load profile (and perform merge if needed)
    let me;
    try {
      me = await loadProfileWithMerge();
    } catch {
      // Already handled redirects/logs above where appropriate
      return;
    }

    // Render
    const p = normalizeProfile(me);
    safeText(els.name, p.name);
    safeText(els.phone, p.phone);
    safeText(els.email, p.email);
    safeText(els.gender, p.gender);
    safeText(els.dob, p.dob);
    safeText(els.location, p.location);
    safeText(els.altMobile, p.altMobile);
    safeText(els.hint, p.hint);

    // Optionally nudge navbar to refresh once we have canonical user
    try { window.refreshNavbarAuth?.(); } catch {}
  }

  document.addEventListener("DOMContentLoaded", initProfile);
})();

