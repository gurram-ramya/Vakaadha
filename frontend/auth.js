
// // ✅ Use Firebase app initialized in profile.html
// const auth = firebase.auth();

// // ==============================
// // Helpers
// // ==============================

// // API base (adjust if backend is on another port)
// const API_BASE = "/";

// // Save user+token to localStorage
// function saveUser(user, idToken) {
//   const userInfo = {
//     uid: user.uid,
//     name: user.displayName || user.email,
//     email: user.email,
//     idToken: idToken
//   };
//   localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
//   return userInfo;
// }

// // Read current logged user from storage
// function getStoredUser() {
//   return JSON.parse(localStorage.getItem("loggedInUser"));
// }

// // Send token to backend to sync/create user
// async function syncWithBackend(idToken) {
//   const res = await fetch(API_BASE + "signup", {
//     method: "POST",
//     headers: { "Authorization": "Bearer " + idToken }
//   });
//   return await res.json();
// }

// // Display user in navbar/header (stub: implement in your layout)
// function showUser(nameOrEmail) {
//   const userDisplay = document.getElementById("user-display");
//   if (userDisplay) {
//     userDisplay.textContent = "Hello, " + nameOrEmail;
//   }
// }

// // ==============================
// // Auto login on page reload
// // ==============================
// window.onload = async () => {
//   const stored = getStoredUser();
//   const userDisplay = document.getElementById("user-display");
//   const authLink = document.getElementById("auth-link");
//   const loggedInLinks = document.getElementById("logged-in-links");

//   if (stored && stored.idToken) {
//     try {
//       const res = await fetch(API_BASE + "me", {
//         headers: { "Authorization": "Bearer " + stored.idToken }
//       });
//       if (res.ok) {
//         const user = await res.json();
//         userDisplay.textContent = "Hello, " + (user.name || user.email);
//         if (authLink) authLink.classList.add("hidden");
//         if (loggedInLinks) loggedInLinks.classList.remove("hidden");
//       } else {
//         logout();
//       }
//     } catch {
//       logout();
//     }
//   } else {
//     // Not logged in
//     if (userDisplay) userDisplay.textContent = "Login / Signup";
//     if (authLink) authLink.classList.remove("hidden");
//     if (loggedInLinks) loggedInLinks.classList.add("hidden");
//   }
// };


// // ==============================
// // Google Login
// // ==============================
// const googleLoginBtn = document.getElementById("google-login");
// if (googleLoginBtn) {
//   googleLoginBtn.addEventListener("click", () => {
//     const provider = new firebase.auth.GoogleAuthProvider();
//     auth.signInWithPopup(provider)
//       .then(async result => {
//         const user = result.user;
//         const idToken = await user.getIdToken();
//         saveUser(user, idToken);
//         await syncWithBackend(idToken);
//         showUser(user.displayName || user.email);
//         window.location.href = "/";
//       })
//       .catch(err => alert("Google login failed: " + err.message));
//   });
// }

// // ==============================
// // Email/Password Login
// // ==============================
// const loginForm = document.getElementById("email-login-form");
// if (loginForm) {
//   loginForm.addEventListener("submit", async e => {
//     e.preventDefault();
//     const email = document.getElementById("login-email").value;
//     const password = document.getElementById("login-password").value;
//     try {
//       const result = await auth.signInWithEmailAndPassword(email, password);
//       const user = result.user;
//       const idToken = await user.getIdToken();
//       saveUser(user, idToken);
//       await syncWithBackend(idToken);
//       showUser(user.email);
//       window.location.href = "/";
//     } catch (err) {
//       alert("Login failed: " + err.message);
//     }
//   });
// }

// // ==============================
// // Email/Password Signup
// // ==============================
// const signupForm = document.getElementById("email-signup-form");
// if (signupForm) {
//   signupForm.addEventListener("submit", async e => {
//     e.preventDefault();
//     const email = document.getElementById("signup-email").value;
//     const password = document.getElementById("signup-password").value;
//     try {
//       const result = await auth.createUserWithEmailAndPassword(email, password);
//       const user = result.user;
//       const idToken = await user.getIdToken();
//       saveUser(user, idToken);
//       await syncWithBackend(idToken);
//       showUser(user.email);
//       window.location.href = "/";
//     } catch (err) {
//       alert("Signup failed: " + err.message);
//     }
//   });
// }

// // ==============================
// // Logout
// // ==============================
// const logoutBtn = document.getElementById("logout");
// if (logoutBtn) {
//   logoutBtn.addEventListener("click", () => logout());
// }

// function logout() {
//   auth.signOut().finally(() => {
//     localStorage.removeItem("loggedInUser");
//     window.location.href = "/"; // back to homepage
//   });
// }


// auth.js
(function () {
  // -------- Storage keys (must match existing frontend contract) --------
  const TOKEN_KEY = "auth_token";
  const USER_KEY  = "user_info";
  const GUEST_KEY = "guest_id"; // not modified here

  if (window.__auth_js_bound__) return;
  window.__auth_js_bound__ = true;

  // ---------------------- Helpers ----------------------
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
  }
  function setToken(t) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
  }
  function getUserCached() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  }
  function setUserCached(user) {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {}
  }
  async function fetchMe(token) {
    const res = await fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` } });
    return res;
  }
  function applyNavbar(userOrNull) {
    if (typeof window.updateNavbarUser === "function") window.updateNavbarUser(userOrNull || null);
    if (typeof window.updateNavbarCounts === "function") window.updateNavbarCounts();
  }
  async function backendLogout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
  }
  async function firebaseSignOutIfAny() {
    try {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        await firebase.auth().signOut();
      }
    } catch {}
  }
  function clearSession() {
    setToken(null);
    setUserCached(null);
  }

  // ---------------------- Public API ----------------------
  async function initSession() {
    const token = getToken();
    if (!token) { applyNavbar(null); return; }

    try {
      const res = await fetchMe(token);
      if (res.status === 401) {
        clearSession();
        applyNavbar(null);
        return;
      }
      if (!res.ok) {
        // Any non-OK that isn't 401 → treat as guest
        clearSession();
        applyNavbar(null);
        return;
      }
      const me = await res.json();
      setUserCached(me);
      applyNavbar(me);
    } catch {
      // Network or parsing failure → degrade to guest
      clearSession();
      applyNavbar(null);
    }
  }

  async function getCurrentUser() {
    const token = getToken();
    if (!token) return null;

    // Prefer cache
    const cached = getUserCached();
    if (cached) return cached;

    // No cache: try to refresh
    try {
      const res = await fetchMe(token);
      if (res.status === 401) {
        clearSession();
        applyNavbar(null);
        return null;
      }
      if (!res.ok) return null;
      const me = await res.json();
      setUserCached(me);
      applyNavbar(me);
      return me;
    } catch {
      return null;
    }
  }

  async function logout() {
    await firebaseSignOutIfAny();
    await backendLogout();
    clearSession();
    applyNavbar(null);
    // Do NOT touch guest_id here. Another module may manage it.
  }

  // ---------------------- Expose ----------------------
  window.auth = {
    initSession,
    getCurrentUser,
    logout,
  };

  // Auto-bootstrap session on load (idempotent)
  document.addEventListener("DOMContentLoaded", initSession);
})();
