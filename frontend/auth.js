

/**
 * Session & lifecycle manager (Firebase-first, backend-agnostic)
 *
 * Contracts preserved (DO NOT BREAK):
 * - window.auth.initSession()
 * - window.auth.getToken()
 * - window.auth.logout()
 * - window.auth.getCurrentUser()   // may return null (same as before)
 * - Global Firebase initialization
 * - Writes localStorage.auth_token
 *
 * Additions (non-breaking; safe to ignore by consumers that don't use them):
 * - window.auth.setToken(token)          // bridge for login -> auth -> client
 * - window.auth.getFirebaseUser()
 * - window.auth.onSessionStateChange(cb) // emits {state, uid, tokenReady, error}
 * - window.auth.onAuthChanged(cb)        // alias for onSessionStateChange
 * - window.auth.waitForReady(ms?)        // resolves when TOKEN_READY observed
 *
 * States emitted:
 *   SIGNED_OUT | FIREBASE_SIGNED_IN | TOKEN_READY | ERROR
 *
 * Navbar mapping (unchanged):
 *   SIGNED_OUT/ERROR -> updateNavbarUser(null)
 *   FIREBASE_SIGNED_IN/TOKEN_READY -> updateNavbarUser({ state: "firebase_only" })
 */
(function () {
  const TOKEN_KEY = "auth_token";
  const GUEST_KEY = "guest_id";

  if (window.__auth_js_bound__) return;
  window.__auth_js_bound__ = true;

  // -------------------------------------------------------
  // Internal state
  // -------------------------------------------------------
  let _initStarted = false;
  let _unsubIdToken = null;
  let _refreshTimer = null;
  let _logoutInProgress = false;

  let _lastUid = null;
  let _bootstrapStartedAt = 0;

  // Cached token bridge (critical): client.js trusts window.auth.getToken()
  let _cachedToken = null;

  // Session state machine (emitted)
  // SIGNED_OUT | FIREBASE_SIGNED_IN | TOKEN_READY | ERROR
  let _sessionState = { state: "SIGNED_OUT", uid: null, tokenReady: false, error: null };
  const _listeners = new Set();

  // -------------------------------------------------------
  // Firebase initialization (contract preserved)
  // -------------------------------------------------------
  function ensureFirebaseInitialized() {
    if (!window.firebase || !firebase.initializeApp || !firebase.auth) {
      throw new Error("Firebase Auth not available (firebase/auth not loaded)");
    }

    if (!window.firebase.apps || !window.firebase.apps.length) {
      const firebaseConfig = {
        apiKey: "AIzaSyCT9uxZZQehx7zChiUDRX3_KugzoMCks8U",
        authDomain: "vakaadha-c412d.firebaseapp.com",
        projectId: "vakaadha-c412d",
        storageBucket: "vakaadha-c412d.firebasestorage.app",
        messagingSenderId: "457234189424",
        appId: "1:457234189424:web:8f699d1b82fae8c699b8b5",
        measurementId: "G-61TWVP3GDZ",
      };
      firebase.initializeApp(firebaseConfig);
    }

    // Persist session across tabs/refreshes
    try {
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch {}
  }

  // -------------------------------------------------------
  // Utilities
  // -------------------------------------------------------
  const nowMs = () => Date.now();

  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function _writeTokenToStorage(token) {
    try {
      if (token && String(token).trim()) localStorage.setItem(TOKEN_KEY, String(token).trim());
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  function _readTokenFromStorage() {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      return t && String(t).trim() ? String(t).trim() : null;
    } catch {
      return null;
    }
  }

  function setToken(token) {
    // Internal setter: updates both cache and storage
    const t = token && String(token).trim() ? String(token).trim() : null;
    _cachedToken = t;
    _writeTokenToStorage(t);
  }

  function clearLocalSession() {
    setToken(null);
  }

  function stopRefreshScheduler() {
    try {
      if (_refreshTimer) clearTimeout(_refreshTimer);
    } catch {}
    _refreshTimer = null;
  }

  // Maintain existing navbar mapping semantics
  function applyNavbarState(state) {
    // navbar.js should treat:
    // null => logged out
    // { state:"firebase_only" } => logged in at Firebase, backend unresolved/display-only
    try {
      if (window.updateNavbarUser) window.updateNavbarUser(state);
      if (window.updateNavbarCounts) window.updateNavbarCounts(true);
    } catch {}
  }

  function emitSessionState(next) {
    _sessionState = next;

    // Preserve your existing navbar mapping behavior
    if (next.state === "SIGNED_OUT" || next.state === "ERROR") {
      applyNavbarState(null);
    } else {
      applyNavbarState({ state: "firebase_only" });
    }

    // Notify subscribers
    try {
      _listeners.forEach((fn) => {
        try { fn({ ..._sessionState }); } catch {}
      });
    } catch {}
  }

  function isRevocationLikeError(err) {
    const code = err?.code || "";
    const msg = String(err?.message || "").toLowerCase();
    return (
      code === "auth/id-token-revoked" ||
      code === "auth/user-token-expired" ||
      code === "auth/user-disabled" ||
      code === "auth/invalid-user-token" ||
      code === "auth/invalid-auth-event" ||
      msg.includes("id token revoked") ||
      msg.includes("token is expired") ||
      msg.includes("user-disabled") ||
      msg.includes("invalid user token")
    );
  }

  // -------------------------------------------------------
  // Token acquisition (single authority)
  // -------------------------------------------------------
  async function getFreshToken(opts = {}) {
    const { force = false } = opts;

    let auth;
    try {
      auth = firebase.auth();
    } catch {
      return null;
    }

    const user = auth.currentUser;
    if (!user) return null;

    try {
      const token = await user.getIdToken(!!force);
      if (token && String(token).trim()) setToken(token);
      return token && String(token).trim() ? String(token).trim() : null;
    } catch (err) {
      // Ensure we don't keep stale tokens around
      clearLocalSession();

      if (isRevocationLikeError(err)) {
        await hardLogout({ reason: "revoked_or_invalid_token" });
        return null;
      }

      // Any other refresh failures: logout to a clean state
      await hardLogout({ reason: "token_refresh_failed" });
      return null;
    }
  }

  function scheduleProactiveRefresh(firebaseUser) {
    stopRefreshScheduler();
    if (!firebaseUser) return;

    firebaseUser
      .getIdTokenResult()
      .then((res) => {
        const expMs = new Date(res.expirationTime).getTime();
        const now = nowMs();

        // Refresh 2 minutes early; clamp for safety
        let delay = expMs - now - 2 * 60 * 1000;
        if (!Number.isFinite(delay)) delay = 5 * 60 * 1000;
        if (delay < 30 * 1000) delay = 30 * 1000;
        if (delay > 55 * 60 * 1000) delay = 55 * 60 * 1000;

        _refreshTimer = setTimeout(async () => {
          try {
            await getFreshToken({ force: true });
            const u = firebase.auth().currentUser;
            if (u && u.uid === firebaseUser.uid) scheduleProactiveRefresh(u);
          } catch {}
        }, delay);
      })
      .catch(() => {
        // If we failed to read expiration, still refresh periodically
        _refreshTimer = setTimeout(async () => {
          try {
            await getFreshToken({ force: true });
            const u = firebase.auth().currentUser;
            if (u && u.uid === firebaseUser.uid) scheduleProactiveRefresh(u);
          } catch {}
        }, 5 * 60 * 1000);
      });
  }

  // -------------------------------------------------------
  // Backend logout call (kept for user-initiated logout only)
  // -------------------------------------------------------
  async function backendLogout(token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
  }

  // -------------------------------------------------------
  // Hard logout (single gate)
  // -------------------------------------------------------
  async function hardLogout(meta = {}) {
    if (_logoutInProgress) return;
    _logoutInProgress = true;

    try {
      stopRefreshScheduler();
      clearLocalSession();

      try {
        const u = firebase.auth().currentUser;
        if (u) await firebase.auth().signOut();
      } catch {}

      _lastUid = null;
      emitSessionState({ state: "SIGNED_OUT", uid: null, tokenReady: false, error: null });

      const path = String(window.location.pathname || "");
      if (!/index\.html$/i.test(path)) {
        window.location.href = "index.html";
      }
    } finally {
      _logoutInProgress = false;
    }
  }

  // -------------------------------------------------------
  // Session lifecycle (single listener)
  // Uses onIdTokenChanged to keep localStorage.auth_token current
  // -------------------------------------------------------
  async function initSession() {
    if (_initStarted) return;
    _initStarted = true;
    _bootstrapStartedAt = nowMs();

    // Seed cache from storage immediately (critical for login.js -> client.js bridge)
    try {
      const seeded = _readTokenFromStorage();
      if (seeded) _cachedToken = seeded;
    } catch {}

    // Preserve guest continuity (auth.js does not use guest beyond persistence)
    try {
      const ck = getCookie(GUEST_KEY);
      if (ck) localStorage.setItem(GUEST_KEY, ck);
    } catch {}

    try {
      ensureFirebaseInitialized();
    } catch (e) {
      clearLocalSession();
      emitSessionState({ state: "ERROR", uid: null, tokenReady: false, error: e });
      return;
    }

    try {
      if (_unsubIdToken) _unsubIdToken();
    } catch {}
    _unsubIdToken = null;

    const auth = firebase.auth();

    // Initial state before first callback
    emitSessionState({ state: "SIGNED_OUT", uid: null, tokenReady: false, error: null });

    _unsubIdToken = auth.onIdTokenChanged(async (user) => {
      if (!user) {
        _lastUid = null;
        stopRefreshScheduler();
        clearLocalSession();
        emitSessionState({ state: "SIGNED_OUT", uid: null, tokenReady: false, error: null });
        return;
      }

      if (_lastUid !== user.uid) _lastUid = user.uid;

      // Firebase session exists; token may still be minting
      emitSessionState({ state: "FIREBASE_SIGNED_IN", uid: user.uid, tokenReady: false, error: null });

      // Force-refresh to ensure we capture a fresh JWT and write to storage
      const token = await getFreshToken({ force: true });
      if (!token) return;

      scheduleProactiveRefresh(user);
      emitSessionState({ state: "TOKEN_READY", uid: user.uid, tokenReady: true, error: null });
    });
  }

  // -------------------------------------------------------
  // Public API (contract preserved + safe additions)
  // -------------------------------------------------------
  async function getToken(opts = {}) {
    // opts: { forceRefresh?: boolean }
    const forceRefresh = !!opts.forceRefresh;

    // 1) Fast path: explicit bridge token / cached
    if (!forceRefresh && _cachedToken && String(_cachedToken).trim()) {
      return String(_cachedToken).trim();
    }

    // 2) If Firebase user exists, mint/refresh token from Firebase
    try {
      const user = firebase.auth().currentUser;
      if (user) {
        const token = await getFreshToken({ force: forceRefresh });
        if (token) return token;
      }
    } catch {}

    // 3) Storage fallback (works even if auth.js listener not ready yet)
    const stored = _readTokenFromStorage();
    if (stored) {
      _cachedToken = stored;
      return stored;
    }

    // 4) Short bootstrap grace (kept for backward compatibility)
    try {
      const age = nowMs() - _bootstrapStartedAt;
      if (_initStarted && age >= 0 && age <= 10000) {
        return _cachedToken || stored || null;
      }
    } catch {}

    return null;
  }

  // Optional utility for pages that must wait until TOKEN_READY
  async function waitForReady(timeoutMs = 8000) {
    const t0 = nowMs();
    while (nowMs() - t0 < timeoutMs) {
      if (_sessionState.state === "TOKEN_READY") return true;
      await new Promise((r) => setTimeout(r, 120));
    }
    return false;
  }

  async function getCurrentUser() {
    // We remain backend-agnostic here; return Firebase user snapshot if available.
    try {
      const u = firebase?.auth?.().currentUser || null;
      if (!u) return null;
      return {
        uid: u.uid,
        email: u.email || null,
        phone: u.phoneNumber || null,
        providerIds: Array.isArray(u.providerData) ? u.providerData.map(p => p?.providerId).filter(Boolean) : [],
      };
    } catch {
      return null;
    }
  }

  function onSessionStateChange(handler) {
    if (typeof handler !== "function") return function () {};
    _listeners.add(handler);
    try {
      handler({ ..._sessionState });
    } catch {}
    return function unsubscribe() {
      try { _listeners.delete(handler); } catch {}
    };
  }

  // Back-compat alias many UIs expect
  const onAuthChanged = onSessionStateChange;

  async function logout() {
    const token = await getToken({ forceRefresh: false });
    await backendLogout(token);
    await hardLogout({ reason: "user_initiated" });
  }

  // Explicit bridge setter: login.js calls this immediately after Firebase auth
  function publicSetToken(token) {
    setToken(token);
  }

  // Public surface (contracts preserved)
  window.auth = {
    initSession,
    getToken,
    getCurrentUser,
    logout,

    // Additions (non-breaking)
    setToken: publicSetToken,
    getFirebaseUser: () => (firebase?.auth?.().currentUser || null),
    onSessionStateChange,
    onAuthChanged,        // alias
    waitForReady,
  };

  document.addEventListener("DOMContentLoaded", initSession);
})();

