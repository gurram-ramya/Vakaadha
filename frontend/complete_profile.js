// =============================================================
// complete_profile.js — INITIAL PROFILE COMPLETION (frontend)
// Responsibilities:
// • Ensure backend user (POST /api/auth/register)
// • Update profile (PUT /api/users/me/profile)
// • Optional identity link flow (email/phone) via login.html
// • No direct Firebase calls; relies on auth.js + api/client.js
// =============================================================
(function () {
  if (window.__complete_profile_js_bound__) return;
  window.__complete_profile_js_bound__ = true;

  const FLOW_KEY = "__vakaadha_auth_flow__";

  // ---- DOM (matches complete_profile.html) ----
  const els = {
    form:  document.getElementById("complete-profile-form"),
    name:  document.getElementById("cp-name"),
    email: document.getElementById("cp-email"),
    phone: document.getElementById("cp-phone"),
    submit: document.getElementById("cp-submit"),
    error: document.getElementById("cp-error"),
    skip:  document.getElementById("cp-skip"),
  };

  // ----- Utilities -----
  function norm(v) { return v && String(v).trim() ? String(v).trim() : null; }

  function showError(msg) {
    console.warn("[complete_profile] error:", msg);
    if (!els.error) return alert(msg || "Something went wrong");
    els.error.textContent = msg || "Something went wrong";
    els.error.style.display = "block";
  }
  function clearError() {
    if (!els.error) return;
    els.error.textContent = "";
    els.error.style.display = "none";
  }

  async function waitForToken(timeoutMs = 7000) {
    console.log("[complete_profile] waitForToken:start");
    const start = Date.now();
    try { if (window.auth?.initSession) await window.auth.initSession(); } catch {}
    while (Date.now() - start < timeoutMs) {
      try {
        const t = await window.auth?.getToken?.({ forceRefresh: false });
        if (t && String(t).trim()) {
          console.log("[complete_profile] waitForToken:got token");
          return String(t).trim();
        }
      } catch {}
      await new Promise(r => setTimeout(r, 150));
    }
    console.warn("[complete_profile] waitForToken:timeout");
    return null;
  }

  function triggerLink(type, value) {
    console.log("[complete_profile] triggerLink", { type, value });
    try {
      sessionStorage.setItem(
        FLOW_KEY,
        JSON.stringify({
          mode: "LINK",        // tells login.js we're linking, not logging in
          type,                // "EMAIL" | "PHONE"
          value,               // raw email or phone input
          returnTo: "complete_profile.html",
          initiatedAt: Date.now(),
        })
      );
    } catch {}
    window.location.href = "login.html";
  }

  // ----- Actions -----
  async function saveProfileImpl() {
    console.log("[complete_profile] saveProfile:click");
    clearError();

    const name  = norm(els.name && els.name.value);
    const email = norm(els.email && els.email.value);
    const phone = norm(els.phone && els.phone.value);

    if (!name) {
      showError("Name is required");
      return;
    }

    // prevent double submit
    if (els.submit) els.submit.disabled = true;

    try {
      // Ensure auth.js has a token; don't pin Authorization header so apiRequest
      // can auto-refresh on 401 with its built-in retry.
      const token = await waitForToken();
      if (!token) {
        showError("Session not ready. Please try again.");
        return;
      }

      if (typeof window.apiRequest !== "function") {
        showError("API client not available");
        return;
      }

      // 1) Ensure backend user + merge guest (idempotent)
      console.log("[complete_profile] POST /api/auth/register");
      await window.apiRequest("/api/auth/register", {
        method: "POST",
        body: { name }, // backend treats as providedName (optional)
      });

      // 2) Update profile fields (maps 'name' → full_name server-side)
      console.log("[complete_profile] PUT /api/users/me/profile");
      await window.apiRequest("/api/users/me/profile", {
        method: "PUT",
        body: { name },
      });

      // 3) If user provided identity, go to link flow
      if (email) { triggerLink("EMAIL", email); return; }
      if (phone) { triggerLink("PHONE", phone); return; }

      // 4) Done
      console.log("[complete_profile] complete -> index.html");
      window.location.href = "index.html";
    } catch (err) {
      console.error("[complete_profile] failed:", err);
      showError(err?.payload?.message || err?.message || "Failed to complete profile. Try again.");
    } finally {
      if (els.submit) els.submit.disabled = false;
    }
  }

  async function skipProfileImpl() {
    console.log("[complete_profile] skipProfile:click");
    clearError();

    if (els.submit) els.submit.disabled = true;
    try {
      const token = await waitForToken();
      if (!token) {
        showError("Session not ready. Please try again.");
        return;
      }

      if (typeof window.apiRequest !== "function") {
        showError("API client not available");
        return;
      }

      // Ensure a proper backend user exists even if skipping name
      console.log("[complete_profile] POST /api/auth/register (skip)");
      await window.apiRequest("/api/auth/register", { method: "POST", body: {} });

      window.location.href = "index.html";
    } catch (err) {
      console.error("[complete_profile] skip failed:", err);
      showError(err?.payload?.message || err?.message || "Could not continue. Try again.");
    } finally {
      if (els.submit) els.submit.disabled = false;
    }
  }

  async function prefillIfAvailable() {
    try {
      const token = await waitForToken();
      if (!token) return; // first-time users will 404 anyway

      if (typeof window.apiRequest !== "function") return;

      console.log("[complete_profile] GET /api/users/me (prefill)");
      const me = await window.apiRequest("/api/users/me");
      if (me) {
        if (me.full_name && els.name)  els.name.value  = me.full_name;
        if (me.email && els.email)     els.email.value = me.email;
        if (me.mobile && els.phone)    els.phone.value = me.mobile;
      }
    } catch (e) {
      // 404 -> expected for first-time users
    }
  }

  // ----- Wiring -----
  function wireEvents() {
    if (els.form) {
      els.form.addEventListener("submit", function (e) {
        try { e.preventDefault(); } catch {}
        saveProfileImpl();
      });
    }
    if (els.skip) {
      els.skip.addEventListener("click", function (e) {
        try { e.preventDefault(); } catch {}
        skipProfileImpl();
      });
    }

    // Also export globals in case markup uses inline handlers elsewhere
    window.saveProfile = saveProfileImpl;
    window.skipProfile = skipProfileImpl;
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireEvents();
    prefillIfAvailable();
    console.log("[complete_profile] ready; handlers wired");
  });
})();
