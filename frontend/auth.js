
// ✅ Use Firebase app initialized in profile.html
const auth = firebase.auth();

// ==============================
// Helpers
// ==============================

// API base (adjust if backend is on another port)
const API_BASE = "/";

// Save user+token to localStorage
function saveUser(user, idToken) {
  const userInfo = {
    uid: user.uid,
    name: user.displayName || user.email,
    email: user.email,
    idToken: idToken
  };
  localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
  return userInfo;
}

// Read current logged user from storage
function getStoredUser() {
  return JSON.parse(localStorage.getItem("loggedInUser"));
}

// Send token to backend to sync/create user
async function syncWithBackend(idToken) {
  const res = await fetch(API_BASE + "signup", {
    method: "POST",
    headers: { "Authorization": "Bearer " + idToken }
  });
  return await res.json();
}

// Display user in navbar/header (stub: implement in your layout)
function showUser(nameOrEmail) {
  const userDisplay = document.getElementById("user-display");
  if (userDisplay) {
    userDisplay.textContent = "Hello, " + nameOrEmail;
  }
}

// ==============================
// Auto login on page reload
// ==============================
window.onload = async () => {
  const stored = getStoredUser();
  const userDisplay = document.getElementById("user-display");
  const authLink = document.getElementById("auth-link");
  const loggedInLinks = document.getElementById("logged-in-links");

  if (stored && stored.idToken) {
    try {
      const res = await fetch(API_BASE + "me", {
        headers: { "Authorization": "Bearer " + stored.idToken }
      });
      if (res.ok) {
        const user = await res.json();
        userDisplay.textContent = "Hello, " + (user.name || user.email);
        if (authLink) authLink.classList.add("hidden");
        if (loggedInLinks) loggedInLinks.classList.remove("hidden");
      } else {
        logout();
      }
    } catch {
      logout();
    }
  } else {
    // Not logged in
    if (userDisplay) userDisplay.textContent = "Login / Signup";
    if (authLink) authLink.classList.remove("hidden");
    if (loggedInLinks) loggedInLinks.classList.add("hidden");
  }
};


// ==============================
// Google Login
// ==============================
const googleLoginBtn = document.getElementById("google-login");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then(async result => {
        const user = result.user;
        const idToken = await user.getIdToken();
        saveUser(user, idToken);
        await syncWithBackend(idToken);
        showUser(user.displayName || user.email);
        window.location.href = "/";
      })
      .catch(err => alert("Google login failed: " + err.message));
  });
}

// ==============================
// Email/Password Login
// ==============================
const loginForm = document.getElementById("email-login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      const result = await auth.signInWithEmailAndPassword(email, password);
      const user = result.user;
      const idToken = await user.getIdToken();
      saveUser(user, idToken);
      await syncWithBackend(idToken);
      showUser(user.email);
      window.location.href = "/";
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });
}

// ==============================
// Email/Password Signup
// ==============================
const signupForm = document.getElementById("email-signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    try {
      const result = await auth.createUserWithEmailAndPassword(email, password);
      const user = result.user;
      const idToken = await user.getIdToken();
      saveUser(user, idToken);
      await syncWithBackend(idToken);
      showUser(user.email);
      window.location.href = "/";
    } catch (err) {
      alert("Signup failed: " + err.message);
    }
  });
}

// ==============================
// Logout
// ==============================
const logoutBtn = document.getElementById("logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => logout());
}

function logout() {
  auth.signOut().finally(() => {
    localStorage.removeItem("loggedInUser");
    window.location.href = "/"; // back to homepage
  });
}
