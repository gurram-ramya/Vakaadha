

// -------------------------------------------------------------------

// frontend/navbar.js 

/**
 * Auth-aware navbar (robust, aligned with auth.js + client.js)
 * - Decides guest vs authed using token + /api/auth/session (+/api/users/me fallback)
 * - Shows/Hides Login/Logout correctly and sets profile icon target
 * - Keeps cart / wishlist counts in sync with throttling
 * - Reacts to auth state changes, cross-tab storage changes, and page visibility
 *
 * DOM it expects (from your index.html):
 *   #loginLink, #navbar-logout, #user-display, #cartCount, #wishlistCount
 *   Profile icon anchor: the first <a> inside .dropdown (no id)
 */
(function () {
  if (window.__navbar_js_bound__) return;
  window.__navbar_js_bound__ = true;

  const CART_ENDPOINT = "/api/cart";
  const WISHCOUNT_ENDPOINT = "/api/wishlist/count";
  const AUTH_SESSION_ENDPOINT = "/api/auth/session";
  const ME_ENDPOINT = "/api/users/me";

  // Cache + throttling
  window.appState = window.appState || { cartCount: 0, wishlistCount: 0, lastFetch: 0 };

  // ---------- DOM ----------
  const els = {
    userDisplay: document.getElementById("user-display"),
    loginLink:   document.getElementById("loginLink"),
    logoutLink:  document.getElementById("navbar-logout"),
    profileAnchor:
      document.querySelector('.dropdown > a[aria-label="Profile"]') ||
      document.querySelector('.dropdown > a[href="./profile.html"]') ||
      document.querySelector('.dropdown > a[href="profile.html"]') ||
      document.querySelector('.dropdown > a'),
    cartBadge:  document.getElementById("cartCount"),
    wishBadge:  document.getElementById("wishlistCount"),
  };

  function setText(el, txt) { if (el) el.textContent = txt; }
  function show(el, yes)   { if (el) el.style.display = yes ? "" : "none"; }

  // ---------- Counts ----------
  function withinThrottle() {
    return (Date.now() - window.appState.lastFetch) < 60000;
  }

  async function fetchCartCount(force = false) {
    if (!force && withinThrottle()) return window.appState.cartCount;
    try {
      const data = await window.apiRequest(CART_ENDPOINT);
      const items = Array.isArray(data.items) ? data.items : [];
      const count = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
      window.appState.cartCount = count;
      window.appState.lastFetch = Date.now();
      return count;
    } catch {
      window.appState.cartCount = 0;
      return 0;
    }
  }

  async function fetchWishlistCount(force = false) {
    if (!force && withinThrottle()) return window.appState.wishlistCount;
    try {
      const res = await window.apiRequest(WISHCOUNT_ENDPOINT);
      const count = typeof res?.count === "number" ? res.count : 0;
      window.appState.wishlistCount = count;
      window.appState.lastFetch = Date.now();
      return count;
    } catch {
      window.appState.wishlistCount = 0;
      return 0;
    }
  }

  async function updateNavbarCounts(force = false) {
    const [c, w] = await Promise.all([fetchCartCount(force), fetchWishlistCount(force)]);
    if (els.cartBadge) els.cartBadge.textContent = c || 0;
    if (els.wishBadge) els.wishBadge.textContent = w || 0;
  }

  // ---------- Render ----------
  // PATCH: safety — never regress to guest if a token exists (prevents flicker/race)
  async function renderGuest() {
    try {
      const tok = await window.auth?.getToken?.();
      if (tok) return; // token present => do not render guest
    } catch {}
    if (els.profileAnchor) els.profileAnchor.setAttribute("href", "login.html");
    show(els.loginLink, true);
    show(els.logoutLink, false);
    setText(els.userDisplay, "");
  }

  function renderUser(me) {
    if (els.profileAnchor) els.profileAnchor.setAttribute("href", "profile.html");
    show(els.loginLink, false);
    show(els.logoutLink, true);

    const display =
      (me?.full_name || me?.name) ||
      (me?.email || me?.mobile) ||
      "My Account";
    setText(els.userDisplay, display);
  }

  // ---------- Auth decision helpers ----------
  async function backendSessionSnapshot() {
    try {
      // apiRequest adds Authorization automatically; no guest_id when auth header present
      const s = await window.apiRequest(AUTH_SESSION_ENDPOINT);
      // normalize common shapes
      return {
        ok: true,
        isAuthenticated: !!(s?.is_authenticated || s?.authenticated || s?.user_id),
        raw: s
      };
    } catch (e) {
      return { ok: false, status: e?.status || 0, error: e };
    }
  }

  async function fetchMeTolerant() {
    try {
      const me = await window.apiRequest(ME_ENDPOINT);
      return { ok: true, me };
    } catch (e) {
      if (e?.status === 404) {
        // First-time user: backend user row not created yet but token is valid. Treat as authed.
        return { ok: true, me: { full_name: null, email: null, mobile: null } };
      }
      return { ok: false, status: e?.status || 0, error: e };
    }
  }

  async function decideAuthState() {
    // 1) Ensure auth.js finished bootstrapping and token exists
    try { await window.auth?.initSession?.(); } catch {}
    const ready = (await window.auth?.waitForReady?.(6000)) || false; // keep contract
    const token = await window.auth?.getToken?.({ forceRefresh: false });
    if (!token) return { state: "guest" };

    // 2) Ask backend for the current server-side session
    const sess = await backendSessionSnapshot();
    if (sess.ok && sess.isAuthenticated) {
      // Backend recognizes the token/session; decorate display
      const meRes = await fetchMeTolerant();
      if (meRes.ok) return { state: "user", me: meRes.me };
      return { state: "user", me: null };
    }

    // 3) Fallback: even if /session was inconclusive (500, gateway, etc),
    //    try /api/users/me. If 200/404, still treat as authenticated for UI.
    const meRes = await fetchMeTolerant();
    if (meRes.ok) return { state: "user", me: meRes.me };

    // Otherwise treat as guest (likely 401 or severe backend error)
    return { state: "guest" };
  }

  // ---------- Public refresh (used by other pages too) ----------
  async function refreshNavbarAuth() {
    const decision = await decideAuthState();

    if (decision.state === "user") {
      renderUser(decision.me);
      await updateNavbarCounts(true);
      try {
        document.dispatchEvent(new CustomEvent("auth:ready", { detail: { me: decision.me || null } }));
      } catch {}
      return true;
    }

    await renderGuest();
    await updateNavbarCounts(true);
    return false;
  }

  // ---------- Logout ----------
  async function handleLogout(ev) {
    ev?.preventDefault?.();
    try {
      try { await window.apiRequest("/api/auth/logout", { method: "POST" }); } catch {}
      await window.auth?.logout?.();
    } finally {
      window.appState = { cartCount: 0, wishlistCount: 0, lastFetch: 0 };
      await renderGuest();
      window.location.href = "index.html";
    }
  }

  // ---------- Wiring & reactive hooks ----------
  function wire() {
    if (els.logoutLink) els.logoutLink.addEventListener("click", handleLogout);

    // PATCH: Guard against transient SIGNED_OUT during refresh
    if (typeof window.auth?.onSessionStateChange === "function") {
      window.auth.onSessionStateChange(async (s) => {
        try {
          if (s?.state === "TOKEN_READY") {
            await refreshNavbarAuth();
            return;
          }
          if (s?.state === "SIGNED_OUT" || s?.state === "ERROR") {
            const tok = await window.auth.getToken({ forceRefresh: false }).catch(() => null);
            if (tok) {
              await refreshNavbarAuth();
            } else {
              await renderGuest();
              await updateNavbarCounts(true);
            }
            return;
          }
          // For FIREBASE_SIGNED_IN or any interim, do nothing (avoid flicker)
        } catch (e) {
          console.warn("[navbar] onSessionStateChange error", e);
        }
      });
    } else if (typeof window.auth?.onAuthChanged === "function") {
      // Back-compat just in case
      window.auth.onAuthChanged(async () => {
        await refreshNavbarAuth();
      });
    }

    // First render
    refreshNavbarAuth();

    // Periodic counts refresh
    setInterval(() => updateNavbarCounts(false), 60000);

    // Cross-tab: reflect auth_token changes
    window.addEventListener("storage", (e) => {
      if (e?.key === "auth_token") {
        // short debounce
        setTimeout(() => refreshNavbarAuth(), 120);
      }
    });

    // Page visibility changes (wake up counts)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        updateNavbarCounts(true);
      }
    });

    // Expose helpers for other scripts
    window.refreshNavbarAuth = refreshNavbarAuth;
    window.updateNavbarCounts = updateNavbarCounts;

    // PATCH: Always decide destination at click time (ignores stale href)
    if (els.profileAnchor) {
      els.profileAnchor.addEventListener("click", async (e) => {
        e.preventDefault(); // always decide dynamically
        let ok = false;
        try { ok = await refreshNavbarAuth(); } catch {}
        window.location.href = ok ? "profile.html" : "login.html";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", wire);
})();
