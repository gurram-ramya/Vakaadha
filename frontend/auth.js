// // frontend/auth.js — corrected guest continuity + backend merge alignment
// // frontend/auth.js — corrected guest cleanup after login
// (function () {
//   const TOKEN_KEY = "auth_token";
//   const USER_KEY  = "user_info";
//   const GUEST_KEY = "guest_id";

//   if (window.__auth_js_bound__) return;
//   window.__auth_js_bound__ = true;

//   if (!window.firebase?.apps?.length) {
//     const firebaseConfig = {
//       apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
//       authDomain: "vakaadha.firebaseapp.com",
//       projectId: "vakaadha",
//       storageBucket: "vakaadha.appspot.com",
//       messagingSenderId: "395786980107",
//       appId: "1:395786980107:web:6678e452707296df56b00e",
//     };
//     firebase.initializeApp(firebaseConfig);
//   }

//   try {
//     firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
//   } catch {}

//   function getCookie(name) {
//     const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
//     return m ? decodeURIComponent(m[2]) : null;
//   }

//   function setToken(t) {
//     try {
//       if (t) localStorage.setItem(TOKEN_KEY, t);
//       else localStorage.removeItem(TOKEN_KEY);
//     } catch {}
//   }

//   async function getToken() {
//     try {
//       const user = window.firebase?.auth?.currentUser;
//       if (user) {
//         const token = await user.getIdToken(true);
//         if (token) {
//           localStorage.setItem(TOKEN_KEY, token);
//           return token;
//         }
//       }
//       return localStorage.getItem(TOKEN_KEY) || null;
//     } catch {
//       return null;
//     }
//   }

//   function setUserCached(u) {
//     try {
//       if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
//       else localStorage.removeItem(USER_KEY);
//     } catch {}
//   }

//   function clearSession() {
//     setToken(null);
//     setUserCached(null);
//   }

//   async function fetchMe(token) {
//     return fetch("/api/users/me", {
//       headers: { Authorization: `Bearer ${token}` },
//       credentials: "include",
//     });
//   }

//   async function backendLogout(token) {
//     try {
//       await fetch("/api/auth/logout", {
//         method: "POST",
//         headers: token ? { Authorization: `Bearer ${token}` } : {},
//         credentials: "include",
//       });
//     } catch {}
//   }

//   function applyNavbar(userOrNull) {
//     if (window.updateNavbarUser) window.updateNavbarUser(userOrNull);
//     if (window.updateNavbarCounts) window.updateNavbarCounts();
//   }

//   async function getFreshToken() {
//     const u = window.firebase?.auth?.currentUser;
//     if (!u) return null;
//     try {
//       const t = await u.getIdToken(true);
//       setToken(t);
//       return t;
//     } catch {
//       clearSession();
//       return null;
//     }
//   }

//   async function initSession() {
//     try {
//       const ck = getCookie(GUEST_KEY);
//       if (ck) localStorage.setItem(GUEST_KEY, ck);
//     } catch {}

//     if (!(window.firebase && firebase.auth)) {
//       applyNavbar(null);
//       return;
//     }

//     await new Promise((resolve) => {
//       const unsub = firebase.auth().onAuthStateChanged(async (user) => {
//         unsub();

//         if (!user) {
//           clearSession();
//           applyNavbar(null);
//           return resolve();
//         }

//         const token = await getFreshToken();
//         if (!token) {
//           clearSession();
//           applyNavbar(null);
//           return resolve();
//         }

//         setToken(token);

//         try {
//           const guest_id = localStorage.getItem(GUEST_KEY);

//           const regRes = await fetch("/api/auth/register", {
//             method: "POST",
//             credentials: "include",
//             headers: {
//               "Content-Type": "application/json",
//               Authorization: `Bearer ${token}`,
//             },
//             body: JSON.stringify({ guest_id }),
//           });

//           if (!regRes.ok) throw new Error("register failed");
//           const data = await regRes.json();

//           if (data?.user) setUserCached(data.user);
//           applyNavbar(data.user || null);

//           try { localStorage.removeItem(GUEST_KEY); } catch {}

//           // clear guest cookie after merge
//           document.cookie =
//             "guest_id=; Path=/; Max-Age=0; SameSite=None; Secure";

//         } catch {
//           clearSession();
//           applyNavbar(null);
//         }

//         resolve();
//       });
//     });
//   }

//   async function getCurrentUser() {
//     try {
//       const cached = JSON.parse(localStorage.getItem(USER_KEY) || "null");
//       if (cached) return cached;
//     } catch {}

//     const t = await getToken();
//     if (!t) return null;

//     try {
//       const res = await fetchMe(t);
//       if (!res.ok) return null;

//       const me = await res.json();
//       setUserCached(me);
//       return me;
//     } catch {
//       return null;
//     }
//   }

//   async function logout() {
//     const tok = await getToken();
//     await backendLogout(tok);
//     clearSession();

//     if (window.firebase?.auth?.currentUser) {
//       try { await firebase.auth().signOut(); } catch {}
//     }

//     applyNavbar(null);
//     window.location.href = "index.html";
//   }

//   window.auth = {
//     initSession,
//     getCurrentUser,
//     getToken,
//     logout,
//   };

//   document.addEventListener("DOMContentLoaded", initSession);
// })();

// ---------------------------------------------------------------------------------

// frontend/auth.js
// Session & lifecycle manager (Firebase-first, backend-agnostic)
//
// Contract preserved:
// - window.auth.initSession()
// - window.auth.getToken()
// - window.auth.logout()
// - Global Firebase initialization
// - Writes localStorage.auth_token
//
// Additions (non-breaking):
// - window.auth.setToken(token)  // explicit bridge for login.js -> auth.js -> client.js
// - window.auth.getFirebaseUser()
// - window.auth.onSessionStateChange(handler)
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

    try {
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch {}
  }

  // -------------------------------------------------------
  // Utilities
  // -------------------------------------------------------
  function nowMs() {
    return Date.now();
  }

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

  function applyNavbarState(state) {
    // navbar.js should treat:
    // null => logged out
    // { state:"firebase_only" } => logged in at Firebase, backend unresolved
    // { state:"loading" } => transitional
    // { state:"ready", user:<backend_user> } => optional (if some other file sets it)
    try {
      if (window.updateNavbarUser) window.updateNavbarUser(state);
      if (window.updateNavbarCounts) window.updateNavbarCounts(true);
    } catch {}
  }

  function emitSessionState(next) {
    _sessionState = next;

    // Navbar mapping (kept compatible with existing navbar.js expectations)
    if (next.state === "SIGNED_OUT") applyNavbarState(null);
    else if (next.state === "FIREBASE_SIGNED_IN" || next.state === "TOKEN_READY") {
      applyNavbarState({ state: "firebase_only" });
    } else if (next.state === "ERROR") {
      applyNavbarState(null);
    }

    try {
      _listeners.forEach((fn) => {
        try {
          fn({ ..._sessionState });
        } catch {}
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
      clearLocalSession();

      if (isRevocationLikeError(err)) {
        await hardLogout({ reason: "revoked_or_invalid_token" });
        return null;
      }

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

      emitSessionState({ state: "FIREBASE_SIGNED_IN", uid: user.uid, tokenReady: false, error: null });

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

    // 1) Fast path: explicit bridge token (login.js injects this)
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

  async function getCurrentUser() {
    return null;
  }

  function getFirebaseUser() {
    try {
      return firebase.auth().currentUser || null;
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
      try {
        _listeners.delete(handler);
      } catch {}
    };
  }

  async function logout() {
    const token = await getToken({ forceRefresh: false });
    await backendLogout(token);
    await hardLogout({ reason: "user_initiated" });
  }

  // Explicit bridge setter: login.js calls this immediately after Firebase auth
  function publicSetToken(token) {
    setToken(token);
  }

  window.auth = {
    initSession,
    getToken,
    getCurrentUser,
    logout,

    // Additions (non-breaking)
    setToken: publicSetToken,
    getFirebaseUser,
    onSessionStateChange,
  };

  document.addEventListener("DOMContentLoaded", initSession);
})();
