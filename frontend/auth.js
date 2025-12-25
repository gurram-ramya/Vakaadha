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

// frontend\auth.js

// frontend/auth.js — session & lifecycle manager (Firebase-first, backend-agnostic)
(function () {
  const TOKEN_KEY = "auth_token";
  const GUEST_KEY = "guest_id";

  // Public API contract that must remain stable
  // • window.auth.initSession()
  // • window.auth.getToken()
  // • window.auth.logout()
  // • Global Firebase initialization
  // • Writing localStorage.auth_token

  if (window.__auth_js_bound__) return;
  window.__auth_js_bound__ = true;

  let _initStarted = false;
  let _unsub = null;
  let _refreshTimer = null;
  let _logoutInProgress = false;
  let _lastNotifiedUid = null;

  /* -------------------------------------------------------
   * Firebase initialization (contract preserved)
   * ----------------------------------------------------- */
  if (!window.firebase?.apps?.length) {
    const firebaseConfig = {
      apiKey: "AIzaSyCT9uxZZQehx7zChiUDRX3_KugzoMCks8U",
      authDomain: "vakaadha-c412d.firebaseapp.com",
      projectId: "vakaadha-c412d",
      storageBucket: "vakaadha-c412d.firebasestorage.app",
      messagingSenderId: "457234189424",
      appId: "1:457234189424:web:8f699d1b82fae8c699b8b5",
      measurementId: "G-61TWVP3GDZ"
    };
    firebase.initializeApp(firebaseConfig);
  }
  


  try {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch {}

  /* -------------------------------------------------------
   * Utilities
   * ----------------------------------------------------- */
  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  function clearLocalSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  function applyNavbarState(state) {
    // navbar.js should treat:
    // null => logged out
    // { state:"firebase_only" } => logged in at Firebase, backend unresolved
    // { state:"loading" } => transitional
    // { state:"ready", user:<backend_user> } => optional (if some other file sets it)
    if (window.updateNavbarUser) window.updateNavbarUser(state);
    if (window.updateNavbarCounts) window.updateNavbarCounts(true);
  }

  function stopRefreshScheduler() {
    try {
      if (_refreshTimer) clearTimeout(_refreshTimer);
    } catch {}
    _refreshTimer = null;
  }

  function scheduleProactiveRefresh(firebaseUser) {
    stopRefreshScheduler();
    if (!firebaseUser) return;

    // We never trust token presence in localStorage for expiry.
    // We refresh based on Firebase-stated token expiry.
    firebaseUser
      .getIdTokenResult()
      .then((res) => {
        const expMs = new Date(res.expirationTime).getTime();
        const now = Date.now();

        // Refresh 2 minutes before expiry, with sane bounds.
        let delay = expMs - now - 2 * 60 * 1000;
        if (!Number.isFinite(delay)) delay = 5 * 60 * 1000;
        if (delay < 30 * 1000) delay = 30 * 1000;
        if (delay > 55 * 60 * 1000) delay = 55 * 60 * 1000;

        _refreshTimer = setTimeout(async () => {
          try {
            await getFreshToken({ force: true });
            // reschedule again for the same user
            const u = firebase.auth().currentUser;
            if (u && u.uid === firebaseUser.uid) scheduleProactiveRefresh(u);
          } catch {
            // getFreshToken handles hard logout on fatal errors
          }
        }, delay);
      })
      .catch(() => {
        // If we can't read token result, fallback to periodic refresh
        _refreshTimer = setTimeout(async () => {
          try {
            await getFreshToken({ force: true });
            const u = firebase.auth().currentUser;
            if (u && u.uid === firebaseUser.uid) scheduleProactiveRefresh(u);
          } catch {}
        }, 5 * 60 * 1000);
      });
  }

  function isRevocationLikeError(err) {
    const code = err?.code || "";
    const msg = String(err?.message || "").toLowerCase();

    // Firebase JS SDK can surface different errors depending on environment.
    // We treat these as hard failures (require full logout).
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

  /* -------------------------------------------------------
   * Token acquisition
   * ----------------------------------------------------- */
  async function getFreshToken(opts = {}) {
    const { force = true } = opts;
    const user = firebase.auth().currentUser;
    if (!user) return null;

    try {
      const token = await user.getIdToken(!!force);
      setToken(token);
      return token;
    } catch (err) {
      clearLocalSession();

      // Never swallow revocation or invalid state errors.
      // Hard logout is the only safe outcome.
      if (isRevocationLikeError(err)) {
        await hardLogout({ reason: "revoked_or_invalid_token" });
        return null;
      }

      // Unknown token error: still fail closed (production-safe default).
      await hardLogout({ reason: "token_refresh_failed" });
      return null;
    }
  }

  /* -------------------------------------------------------
   * Backend logout call (kept)
   * ----------------------------------------------------- */
  async function backendLogout(token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
  }

  /* -------------------------------------------------------
   * Hard logout (single gate)
   * ----------------------------------------------------- */
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

      applyNavbarState(null);

      // Avoid redirect loops if already on index
      const path = String(window.location.pathname || "");
      if (!/index\.html$/i.test(path)) {
        window.location.href = "index.html";
      }
    } finally {
      _logoutInProgress = false;
    }
  }

  /* -------------------------------------------------------
   * Session lifecycle
   * ----------------------------------------------------- */
  async function initSession() {
    if (_initStarted) return;
    _initStarted = true;

    // Preserve guest continuity
    try {
      const ck = getCookie(GUEST_KEY);
      if (ck) localStorage.setItem(GUEST_KEY, ck);
    } catch {}

    if (!(window.firebase && firebase.auth)) {
      applyNavbarState(null);
      return;
    }

    // Ensure we only bind one listener
    try {
      if (_unsub) _unsub();
    } catch {}
    _unsub = null;

    _unsub = firebase.auth().onAuthStateChanged(async (user) => {
      // Logout event
      if (!user) {
        _lastNotifiedUid = null;
        stopRefreshScheduler();
        clearLocalSession();
        applyNavbarState(null);
        return;
      }

      // Login event
      // Notify navbar: Firebase-authenticated but backend unresolved.
      // Never claim "no user" here.
      if (_lastNotifiedUid !== user.uid) {
        _lastNotifiedUid = user.uid;
        applyNavbarState({ state: "firebase_only" });
      } else {
        // Still keep a consistent state if the page reloads
        applyNavbarState({ state: "firebase_only" });
      }

      const token = await getFreshToken({ force: true });
      if (!token) return;

      // Schedule proactive refresh
      scheduleProactiveRefresh(user);

      // IMPORTANT:
      // Backend sync is not performed here.
      // login.js / auth_core.js must explicitly reconcile backend.
      // This file only guarantees Firebase session and token lifecycle.
    });
  }

  /* -------------------------------------------------------
   * Public API (contract preserved)
   * ----------------------------------------------------- */
  async function getToken() {
    // Prefer Firebase currentUser token, fallback to localStorage only
    // for transitional states (page load before auth state resolves).
    try {
      const user = firebase.auth().currentUser;
      if (user) {
        const token = await getFreshToken({ force: false });
        if (token) return token;
      }
    } catch {}

    try {
      const t = localStorage.getItem(TOKEN_KEY);
      return t && String(t).trim() ? t : null;
    } catch {
      return null;
    }
  }

  async function getCurrentUser() {
    // Backend-agnostic by design.
    // If some other module stores backend user info, it should expose its own accessor.
    return null;
  }

  async function logout() {
    // Full logout = backend logout + firebase signOut + local cleanup
    const token = await getToken();
    await backendLogout(token);
    await hardLogout({ reason: "user_initiated" });
  }

  /* -------------------------------------------------------
   * Expose API
   * ----------------------------------------------------- */
  window.auth = {
    initSession,
    getToken,
    getCurrentUser,
    logout,
  };

  document.addEventListener("DOMContentLoaded", initSession);
})();
