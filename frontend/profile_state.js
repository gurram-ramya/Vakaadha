
// =============================================================
// profile_state.js — PROFILE COMPLETENESS GUARD (auth-first)
// -------------------------------------------------------------
// • Redirect to login.html ONLY if truly unauthenticated (no token or 401)
// • If /api/users/me is 404: POST /api/auth/register, then retry
// • If still incomplete: redirect to complete_profile.html
// • No Firebase SDK calls here beyond auth facade usage
// =============================================================
(function () {
  if (window.__profile_state_js_bound__) return;
  window.__profile_state_js_bound__ = true;

  const ME_ENDPOINT = "/api/users/me";
  const REGISTER_ENDPOINT = "/api/auth/register";

  // // A profile is considered complete if it has a name and any verified identity
  // function isProfileComplete(me) {
  //   if (!me || typeof me !== "object") return false;
  //   const hasName = typeof me.full_name === "string" && me.full_name.trim().length > 0;
  //   const identities = Array.isArray(me.auth_identities) ? me.auth_identities : [];
  //   const hasVerified = identities.some(i => i && i.is_verified === true);
  //   return hasName && hasVerified;
  // }
  // Prefer backend source of truth; fallback to legacy heuristic only if field absent
  function isProfileComplete(me) {
    if (!me || typeof me !== "object") return false;
    if (typeof me.profile_complete === "boolean") return me.profile_complete === true;

    // Fallback (legacy heuristic)
    const hasName = typeof me.full_name === "string" && me.full_name.trim().length > 0;
    const identities = Array.isArray(me.auth_identities) ? me.auth_identities : [];
    const hasVerified = identities.some(i => i && i.is_verified === true);
    return hasName && hasVerified;
  }

  // --- small helpers to align with your auth facade ---
  async function ensureAuthReady() {
    try { await window.auth?.initSession?.(); } catch {}
    try { await window.auth?.waitForReady?.(5000); } catch {}
  }

  async function getTokenSafe() {
    try {
      const t1 = await window.auth?.getToken?.({ forceRefresh: false });
      if (t1) return t1;
      await new Promise(r => setTimeout(r, 150));
      return await window.auth?.getToken?.({ forceRefresh: true });
    } catch { return null; }
  }

  // --- backend calls via client.js ---
  async function fetchMe() {
    return window.apiRequest(ME_ENDPOINT);
  }

  async function registerIf404() {
    try {
      await window.apiRequest(REGISTER_ENDPOINT, { method: "POST", body: {} });
      return true;
    } catch {
      return false;
    }
  }

  // Public guard: returns true if complete, otherwise navigates accordingly and returns false
  async function ensureProfileComplete() {
    // 1) Make sure auth facade is ready and a token exists
    await ensureAuthReady();
    const tok = await getTokenSafe();
    if (!tok) { window.location.href = "login.html"; return false; }

    // 2) Try to fetch current user view
    let me;
    try {
      me = await fetchMe();
    } catch (e) {
      if (e && e.status === 401) {
        window.location.href = "login.html";
        return false;
      }
      if (e && e.status === 404) {
        // First-time user: create backend row then retry
        const ok = await registerIf404();
        if (ok) {
          try { me = await fetchMe(); }
          catch { /* fall through to completeness check with undefined me */ }
        }
      }
      // Other errors: don't force-login here; let completeness logic decide.
    }

    // 3) Redirect to completion flow if incomplete
    if (!me || !isProfileComplete(me)) {
      window.location.href = "complete_profile.html";
      return false;
    }

    return true;
  }

  // Expose for pages to call
  window.profileState = { ensureProfileComplete };
})();

