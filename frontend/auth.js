
// // // ✅ Use Firebase app initialized in profile.html
// // const auth = firebase.auth();

// // // ==============================
// // // Helpers
// // // ==============================

// // // API base (adjust if backend is on another port)
// // const API_BASE = "/";

// // // Save user+token to localStorage
// // function saveUser(user, idToken) {
// //   const userInfo = {
// //     uid: user.uid,
// //     name: user.displayName || user.email,
// //     email: user.email,
// //     idToken: idToken
// //   };
// //   localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
// //   return userInfo;
// // }

// // // Read current logged user from storage
// // function getStoredUser() {
// //   return JSON.parse(localStorage.getItem("loggedInUser"));
// // }

// // // Send token to backend to sync/create user
// // async function syncWithBackend(idToken) {
// //   const res = await fetch(API_BASE + "signup", {
// //     method: "POST",
// //     headers: { "Authorization": "Bearer " + idToken }
// //   });
// //   return await res.json();
// // }

// // // Display user in navbar/header (stub: implement in your layout)
// // function showUser(nameOrEmail) {
// //   const userDisplay = document.getElementById("user-display");
// //   if (userDisplay) {
// //     userDisplay.textContent = "Hello, " + nameOrEmail;
// //   }
// // }

// // // ==============================
// // // Auto login on page reload
// // // ==============================
// // window.onload = async () => {
// //   const stored = getStoredUser();
// //   const userDisplay = document.getElementById("user-display");
// //   const authLink = document.getElementById("auth-link");
// //   const loggedInLinks = document.getElementById("logged-in-links");

// //   if (stored && stored.idToken) {
// //     try {
// //       const res = await fetch(API_BASE + "me", {
// //         headers: { "Authorization": "Bearer " + stored.idToken }
// //       });
// //       if (res.ok) {
// //         const user = await res.json();
// //         userDisplay.textContent = "Hello, " + (user.name || user.email);
// //         if (authLink) authLink.classList.add("hidden");
// //         if (loggedInLinks) loggedInLinks.classList.remove("hidden");
// //       } else {
// //         logout();
// //       }
// //     } catch {
// //       logout();
// //     }
// //   } else {
// //     // Not logged in
// //     if (userDisplay) userDisplay.textContent = "Login / Signup";
// //     if (authLink) authLink.classList.remove("hidden");
// //     if (loggedInLinks) loggedInLinks.classList.add("hidden");
// //   }
// // };


// // // ==============================
// // // Google Login
// // // ==============================
// // const googleLoginBtn = document.getElementById("google-login");
// // if (googleLoginBtn) {
// //   googleLoginBtn.addEventListener("click", () => {
// //     const provider = new firebase.auth.GoogleAuthProvider();
// //     auth.signInWithPopup(provider)
// //       .then(async result => {
// //         const user = result.user;
// //         const idToken = await user.getIdToken();
// //         saveUser(user, idToken);
// //         await syncWithBackend(idToken);
// //         showUser(user.displayName || user.email);
// //         window.location.href = "/";
// //       })
// //       .catch(err => alert("Google login failed: " + err.message));
// //   });
// // }

// // // ==============================
// // // Email/Password Login
// // // ==============================
// // const loginForm = document.getElementById("email-login-form");
// // if (loginForm) {
// //   loginForm.addEventListener("submit", async e => {
// //     e.preventDefault();
// //     const email = document.getElementById("login-email").value;
// //     const password = document.getElementById("login-password").value;
// //     try {
// //       const result = await auth.signInWithEmailAndPassword(email, password);
// //       const user = result.user;
// //       const idToken = await user.getIdToken();
// //       saveUser(user, idToken);
// //       await syncWithBackend(idToken);
// //       showUser(user.email);
// //       window.location.href = "/";
// //     } catch (err) {
// //       alert("Login failed: " + err.message);
// //     }
// //   });
// // }

// // // ==============================
// // // Email/Password Signup
// // // ==============================
// // const signupForm = document.getElementById("email-signup-form");
// // if (signupForm) {
// //   signupForm.addEventListener("submit", async e => {
// //     e.preventDefault();
// //     const email = document.getElementById("signup-email").value;
// //     const password = document.getElementById("signup-password").value;
// //     try {
// //       const result = await auth.createUserWithEmailAndPassword(email, password);
// //       const user = result.user;
// //       const idToken = await user.getIdToken();
// //       saveUser(user, idToken);
// //       await syncWithBackend(idToken);
// //       showUser(user.email);
// //       window.location.href = "/";
// //     } catch (err) {
// //       alert("Signup failed: " + err.message);
// //     }
// //   });
// // }

// // // ==============================
// // // Logout
// // // ==============================
// // const logoutBtn = document.getElementById("logout");
// // if (logoutBtn) {
// //   logoutBtn.addEventListener("click", () => logout());
// // }

// // function logout() {
// //   auth.signOut().finally(() => {
// //     localStorage.removeItem("loggedInUser");
// //     window.location.href = "/"; // back to homepage
// //   });
// // }


// // frontend/auth.js — unified guest/user continuity (final aligned)
// (function () {
//   const TOKEN_KEY = "auth_token";
//   const USER_KEY  = "user_info";
//   const GUEST_KEY = "guest_id"; // backend cookie source of truth

//   if (window.__auth_js_bound__) return;
//   window.__auth_js_bound__ = true;

//   // ---------------- Cookie ----------------
//   function getCookie(name) {
//     const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
//     return m ? decodeURIComponent(m[2]) : null;
//   }

//   // ---------------- Storage ----------------
//   function setToken(t) {
//     try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
//   }
//   function getToken() {
//     try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
//   }
//   function setUserCached(user) {
//     try { user ? localStorage.setItem(USER_KEY, JSON.stringify(user)) : localStorage.removeItem(USER_KEY); } catch {}
//   }
//   function clearSession() { setToken(null); setUserCached(null); }

//   // ---------------- Backend ----------------
//   async function fetchMe(token) {
//     return fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` } });
//   }
//   async function backendLogout(token) {
//     try {
//       await fetch("/api/auth/logout", {
//         method: "POST",
//         headers: token ? { Authorization: `Bearer ${token}` } : {},
//       });
//     } catch {}
//   }

//   // ---------------- UI ----------------
//   function applyNavbar(userOrNull) {
//     if (typeof window.updateNavbarUser === "function") window.updateNavbarUser(userOrNull || null);
//     if (typeof window.updateNavbarCounts === "function") window.updateNavbarCounts();
//   }

//   // ---------------- Firebase token ----------------
//   async function getFreshToken() {
//     if (!window.firebase?.auth?.currentUser) return null;
//     try {
//       const tok = await firebase.auth().currentUser.getIdToken(true);
//       setToken(tok);
//       return tok;
//     } catch {
//       clearSession();
//       return null;
//     }
//   }

//   // ---------------- Init session ---------------

//   async function initSession() {
//     // Mirror backend guest cookie to localStorage before auth logic
//     const g = getCookie(GUEST_KEY);
//     if (g) try { localStorage.setItem(GUEST_KEY, g); } catch {}

//     if (!(window.firebase && firebase.auth)) {
//       applyNavbar(null);
//       return;
//     }

//     await new Promise(resolve => {
//       const unsub = firebase.auth().onAuthStateChanged(async (user) => {
//         unsub();

//         // --- Anonymous guest path ---
//         if (!user) {
//           clearSession();
//           applyNavbar(null);
//           return resolve();
//         }

//         // --- Authenticated user path ---
//         const token = await getFreshToken();
//         if (!token) {
//           clearSession();
//           applyNavbar(null);
//           return resolve();
//         }

//         try {
//           // always send current guest_id (may be null if backend already rotated)
//           const guest_id = localStorage.getItem(GUEST_KEY);
//           const regRes = await fetch("/api/auth/register", {
//             method: "POST",
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

//           // --- FIX: remove guest_id for authenticated sessions ---
//           try { localStorage.removeItem(GUEST_KEY); } catch {}

//           // backend may still rotate a new guest cookie; clean local copy if present
//           const newGuest = getCookie(GUEST_KEY);
//           if (newGuest && !token) {
//             try { localStorage.setItem(GUEST_KEY, newGuest); } catch {}
//           }

//         } catch (err) {
//           console.error("[auth.js] register/login flow failed", err);
//           clearSession();
//           applyNavbar(null);
//         }

//         resolve();
//       });
//     });
//   }


//   // ---------------- Current user ----------------
//   async function getCurrentUser() {
//     try {
//       const cached = JSON.parse(localStorage.getItem(USER_KEY) || "null");
//       if (cached) return cached;
//     } catch {}
//     const t = getToken();
//     if (!t) return null;
//     try {
//       const res = await fetchMe(t);
//       if (!res.ok) return null;
//       const me = await res.json();
//       setUserCached(me);
//       return me;
//     } catch { return null; }
//   }

//   // ---------------- Logout ----------------
//   async function logout() {
//     const t = getToken();
//     await backendLogout(t);
//     clearSession();

//     if (window.firebase?.auth?.currentUser) {
//       try { await firebase.auth().signOut(); } catch {}
//     }

//     // server reissues new guest_id cookie; mirror locally
//     const newGuest = getCookie(GUEST_KEY);
//     if (newGuest) try { localStorage.setItem(GUEST_KEY, newGuest); } catch {}

//     applyNavbar(null);
//     window.location.href = "index.html";
//   }

//   // ---------------- Export ----------------
//   window.auth = { initSession, getCurrentUser, getToken, logout };

//   document.addEventListener("DOMContentLoaded", initSession);
// })();

// -----------------------------------------------------------------------------------------------


// frontend/auth.js — unified guest/user continuity (corrected async + token persistence)
(function () {
  const TOKEN_KEY = "auth_token";
  const USER_KEY  = "user_info";
  const GUEST_KEY = "guest_id"; // backend cookie source of truth

  if (window.__auth_js_bound__) return;
  window.__auth_js_bound__ = true;

  /* ---------------- Firebase initialization ---------------- */
  if (!window.firebase?.apps?.length) {
    const firebaseConfig = {
      apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
      authDomain: "vakaadha.firebaseapp.com",
      projectId: "vakaadha",
      storageBucket: "vakaadha.appspot.com",
      messagingSenderId: "395786980107",
      appId: "1:395786980107:web:6678e452707296df56b00e",
    };
    firebase.initializeApp(firebaseConfig);
  }

  try {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (e) {
    console.warn("[auth.js] Firebase persistence setup failed:", e);
  }

  // ---------------- Cookie ----------------
  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  // ---------------- Storage ----------------
  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      console.error("[auth.js] setToken failed:", err);
    }
  }

  // function getToken() {
  //   try {
  //     return localStorage.getItem(TOKEN_KEY) || null;
  //   } catch {
  //     return null;
  //   }
  // }
  // ---------------- Firebase token fetch ----------------
  async function getToken() {
    try {
      const user = window.firebase?.auth?.currentUser;
      if (user) {
        // Always ensure a valid token
        const token = await user.getIdToken(true);
        if (token) {
          localStorage.setItem("auth_token", token);
          return token;
        }
      }

      // fallback for pre-existing token cache
      return localStorage.getItem("auth_token") || null;
    } catch (err) {
      console.error("[auth.js] getToken() failed:", err);
      return null;
    }
  }

  function setUserCached(user) {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch (err) {
      console.error("[auth.js] setUserCached failed:", err);
    }
  }

  function clearSession() {
    setToken(null);
    setUserCached(null);
  }

  // ---------------- Backend ----------------
  // async function fetchMe(token) {
  //   return fetch("/api/users/me", {
  //     headers: { Authorization: `Bearer ${token}` },
  //   });
  // }

  async function fetchMe(token) {
    try {
      const res = await fetch("/api/users/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      // explicit error handling
      if (!res.ok) {
        const text = await res.text();
        console.error("[auth.js] fetchMe failed:", res.status, text);
        throw new Error(`fetchMe failed: ${res.status}`);
      }

      const data = await res.json();
      if (!data || typeof data !== "object") throw new Error("Invalid user payload");

      return data;
    } catch (err) {
      console.error("[auth.js] fetchMe exception:", err);
      return null;
    }
  }



  async function backendLogout(token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      console.error("[auth.js] backendLogout failed:", err);
    }
  }

  // ---------------- UI ----------------
  function applyNavbar(userOrNull) {
    if (typeof window.updateNavbarUser === "function")
      window.updateNavbarUser(userOrNull || null);
    if (typeof window.updateNavbarCounts === "function")
      window.updateNavbarCounts();
  }

  // ---------------- Firebase token ----------------
  async function getFreshToken() {
    if (!window.firebase?.auth?.currentUser) return null;
    try {
      const tok = await firebase.auth().currentUser.getIdToken(true);
      setToken(tok);
      return tok;
    } catch (err) {
      console.error("[auth.js] getFreshToken failed:", err);
      clearSession();
      return null;
    }
  }

  // ---------------- Init session ---------------
  async function initSession() {
    try {
      const g = getCookie(GUEST_KEY);
      if (g) localStorage.setItem(GUEST_KEY, g);
    } catch {}

    if (!(window.firebase && firebase.auth)) {
      applyNavbar(null);
      return;
    }

    await new Promise((resolve) => {
      const unsub = firebase.auth().onAuthStateChanged(async (user) => {
        unsub();

        // --- Anonymous guest path ---
        if (!user) {
          clearSession();
          applyNavbar(null);
          return resolve();
        }

        // --- Authenticated user path ---
        const token = await getFreshToken();
        if (!token) {
          clearSession();
          applyNavbar(null);
          return resolve();
        }

        // ensure token stored before register
        setToken(token);

        try {
          const guest_id = localStorage.getItem(GUEST_KEY);
          const regRes = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ guest_id }),
          });

          if (!regRes.ok) throw new Error("register failed");
          const data = await regRes.json();

          if (data?.user) setUserCached(data.user);
          applyNavbar(data.user || null);

          // --- remove old guest_id when authenticated ---
          try {
            localStorage.removeItem(GUEST_KEY);
          } catch {}

          // backend may issue rotated guest cookie → sync it
          const newGuest = getCookie(GUEST_KEY);
          if (newGuest && !token) {
            try {
              localStorage.setItem(GUEST_KEY, newGuest);
            } catch {}
          }
        } catch (err) {
          console.error("[auth.js] register/login flow failed", err);
          clearSession();
          applyNavbar(null);
        }

        resolve();
      });
    });
  }

  // ---------------- Current user ----------------
  async function getCurrentUser() {
    try {
      const cached = JSON.parse(localStorage.getItem(USER_KEY) || "null");
      if (cached) return cached;
    } catch {}
    const t = getToken();
    if (!t) return null;
    try {
      const res = await fetchMe(t);
      if (!res.ok) return null;
      const me = await res.json();
      setUserCached(me);
      return me;
    } catch (err) {
      console.error("[auth.js] getCurrentUser failed:", err);
      return null;
    }
  }

  // ---------------- Logout ----------------
  async function logout() {
    const t = getToken();
    await backendLogout(t);
    clearSession();

    if (window.firebase?.auth?.currentUser) {
      try {
        await firebase.auth().signOut();
      } catch (err) {
        console.error("[auth.js] Firebase signOut failed:", err);
      }
    }

    try {
      const newGuest = getCookie(GUEST_KEY);
      if (newGuest) localStorage.setItem(GUEST_KEY, newGuest);
    } catch {}

    applyNavbar(null);
    window.location.href = "index.html";
  }

  // ---------------- Export ----------------
  window.auth = { initSession, getCurrentUser, getToken, logout };
  document.addEventListener("DOMContentLoaded", initSession);
})();
