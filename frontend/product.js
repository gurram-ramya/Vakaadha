// profile.js
import { apiFetch } from "./api/client.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Ensure Firebase is initialized globally
const auth = getAuth();

// Save Firebase token to localStorage
async function saveToken(user) {
  const idToken = await user.getIdToken();
  localStorage.setItem("idToken", idToken);
}

// Ensure user exists in backend (called after login/signup)
async function ensureBackendUser() {
  await apiFetch("/auth/register", { method: "POST", body: "{}" });
}

// Hydrate profile form
async function loadProfile() {
  try {
    const me = await apiFetch("/users/me");
    document.querySelector("#profile-name").value = me.name || "";
    document.querySelector("#profile-dob").value = me.profile?.dob || "";
    document.querySelector("#profile-gender").value = me.profile?.gender || "";
    document.querySelector("#profile-avatar").value =
      me.profile?.avatar_url || "";
  } catch (e) {
    console.warn("Not logged in:", e.message);
  }
}

// Save profile form
async function saveProfile(e) {
  e.preventDefault();
  const body = {
    name: document.querySelector("#profile-name").value,
    dob: document.querySelector("#profile-dob").value,
    gender: document.querySelector("#profile-gender").value,
    avatar_url: document.querySelector("#profile-avatar").value,
  };
  await apiFetch("/users/me/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  alert("Profile updated");
}

// Email/password login
document.querySelector("#login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = e.target.querySelector("#login-email").value;
  const password = e.target.querySelector("#login-password").value;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await saveToken(cred.user);
  await ensureBackendUser();
  await loadProfile();
});

// Signup
document.querySelector("#signup-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = e.target.querySelector("#signup-email").value;
  const password = e.target.querySelector("#signup-password").value;
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await saveToken(cred.user);
  await ensureBackendUser();
  await loadProfile();
});

// Google Sign-In
document.querySelector("#google-login")?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  await saveToken(cred.user);
  await ensureBackendUser();
  await loadProfile();
});

// Save profile form
document.querySelector("#profile-form")?.addEventListener("submit", saveProfile);

// Logout
document.querySelector("#logout-btn")?.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.removeItem("idToken");
  await apiFetch("/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
  window.location.href = "index.html";
});

// Auto-hydrate on auth state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await saveToken(user);
    await ensureBackendUser();
    await loadProfile();
  } else {
    localStorage.removeItem("idToken");
  }
});
