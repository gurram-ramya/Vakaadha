// frontend/profile.js
import { apiRequest, getAuth, setAuth, clearAuth } from "./api/client.js";

/* ---------------- Firebase init (moved from HTML) ---------------- */
// NOTE: keeping config client-side is standard for Firebase. We’re just
// moving it out of the HTML so it’s not inline-visible in the DOM.
const firebaseConfig = {
  apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
  authDomain: "vakaadha.firebaseapp.com",
  projectId: "vakaadha",
  storageBucket: "vakaadha.appspot.com",
  messagingSenderId: "395786980107",
  appId: "1:395786980107:web:6678e452707296df56b00e",
};
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = () => firebase.auth();
// Persist login across reloads/tabs
auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((e)=>{
  console.warn("Could not set LOCAL persistence:", e);
});


/* ---------------- DOM refs & small helpers ---------------- */
const $ = (s) => document.querySelector(s);

const els = {
  authSection: $("#auth-section"),
  profileSection: $("#profile-section"),

  // login
  loginForm: $("#login-form"),
  loginEmail: $("#login-email"),
  loginPassword: $("#login-password"),
  loginSubmit: $("#login-submit"),

  // google
  googleBtn: $("#google-btn"),

  // signup
  openSignup: $("#open-signup"),
  signupForm: $("#signup-form"),
  signupName: $("#signup-name"),
  signupEmail: $("#signup-email"),
  signupPassword: $("#signup-password"),
  signupPasswordConfirm: $("#signup-password-confirm"),
  signupSubmit: $("#signup-submit"),
  cancelSignup: $("#cancel-signup"),

  // profile
  verifyBanner: $("#verify-banner"),
  resendVerification: $("#resend-verification"),
  refreshVerification: $("#refresh-verification"),

  profileForm: $("#profile-form"),
  profileName: $("#profile-name"),
  profileEmail: $("#profile-email"),
  profileDob: $("#profile-dob"),
  profileGender: $("#profile-gender"),
  profileAvatar: $("#profile-avatar"),
  profileSave: $("#profile-save"),

  logout: $("#logout"),
  toast: $("#toast"),
};

function toast(msg, bad = false, ms = 2200) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.style.background = bad ? "#b00020" : "#333";
  els.toast.style.opacity = "1";
  els.toast.style.visibility = "visible";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    els.toast.style.opacity = "0";
    els.toast.style.visibility = "hidden";
  }, ms);
}

function show(section) {
  if (els.authSection) els.authSection.classList.toggle("hidden", section !== "auth");
  if (els.profileSection) els.profileSection.classList.toggle("hidden", section !== "profile");
}

function redirectPostLogin() {
  try {
    const url = sessionStorage.getItem("postLoginRedirect") || "index.html";
    sessionStorage.removeItem("postLoginRedirect");
    window.location.href = url;
  } catch {
    window.location.href = "index.html";
  }
}

/* --------------- Bind exactly once (prevents double Google prompt) --------------- */
if (!window.__profile_js_bound__) {
  window.__profile_js_bound__ = true;
  document.addEventListener("DOMContentLoaded", () => {
    wireHandlers();
    initAuthState();
  });
}

/* ---------------- Event handlers ---------------- */
function wireHandlers() {
  // Show/hide signup card (fix for “btn only works via console”)
  els.openSignup?.addEventListener("click", () => {
    if (els.signupForm) {
      els.signupForm.classList.remove("hidden");
      els.signupName?.focus();
    }
  });
  els.cancelSignup?.addEventListener("click", () => {
    els.signupForm?.classList.add("hidden");
  });

  // Email login
  els.loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (els.loginSubmit) els.loginSubmit.disabled = true;
    try {
      const cred = await auth().signInWithEmailAndPassword(
        els.loginEmail?.value.trim() || "",
        els.loginPassword?.value || ""
      );
      await afterFirebaseAuth(cred.user);
      toast("Logged in");
      redirectPostLogin();
    } catch (err) {
      console.error(err);
      toast("Login failed. Check your credentials.", true);
    } finally {
      if (els.loginSubmit) els.loginSubmit.disabled = false;
    }
  });

  // Google sign-in — POPUP only (no redirect), and only one handler
  els.googleBtn?.addEventListener("click", async () => {
    els.googleBtn.disabled = true;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await auth().signInWithPopup(provider);
      await afterFirebaseAuth(result.user);
      toast("Signed in with Google");
      redirectPostLogin();
    } catch (err) {
      console.error(err);
      toast("Google sign-in failed.", true);
    } finally {
      els.googleBtn.disabled = false;
    }
  });

  // Signup (handles email-already-in-use → try login, guide user)
  els.signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (els.signupSubmit) els.signupSubmit.disabled = true;

    const name = els.signupName?.value.trim();
    const email = els.signupEmail?.value.trim();
    const pw = els.signupPassword?.value || "";
    const pw2 = els.signupPasswordConfirm?.value || "";

    if (!name) { toast("Enter your name.", true); if (els.signupSubmit) els.signupSubmit.disabled = false; return; }
    if (pw.length < 6) { toast("Password must be at least 6 chars.", true); if (els.signupSubmit) els.signupSubmit.disabled = false; return; }
    if (pw !== pw2) { toast("Passwords do not match.", true); if (els.signupSubmit) els.signupSubmit.disabled = false; return; }

    try {
      const cred = await auth().createUserWithEmailAndPassword(email, pw);
      await cred.user.updateProfile({ displayName: name }).catch(()=>{});
      // Optional verification email:
      // await cred.user.sendEmailVerification().catch(()=>{});
      await afterFirebaseAuth(cred.user);
      els.signupForm?.classList.add("hidden");
      toast("Account created");
      redirectPostLogin();
    } catch (err) {
      console.error(err);
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        // Try logging in instead (user already exists with this email)
        try {
          const loginCred = await auth().signInWithEmailAndPassword(email, pw);
          await loginCred.user.updateProfile({ displayName: name }).catch(()=>{});
          await afterFirebaseAuth(loginCred.user);
          els.signupForm?.classList.add("hidden");
          toast("Welcome back! Logged in.");
          redirectPostLogin();
        } catch (signErr) {
          const scode = signErr?.code || "";
          if (scode === "auth/wrong-password") {
            toast("Email already registered. Please log in or reset your password.", true);
          } else if (scode === "auth/user-not-found") {
            toast("Account exists under a different method. Try Google sign-in.", true);
          } else {
            toast("Email in use. Try logging in or Google sign-in.", true);
          }
        }
      } else if (code === "auth/weak-password") {
        toast("Password must be at least 6 characters.", true);
      } else {
        toast("Signup failed. " + (err?.message || ""), true);
      }
    } finally {
      if (els.signupSubmit) els.signupSubmit.disabled = false;
    }
  });

  // Save profile (only if profile section present)
  els.profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (els.profileSave) els.profileSave.disabled = true;
    try {
      const body = {
        name: els.profileName?.value.trim() || null,
        dob: els.profileDob?.value || null,
        gender: els.profileGender?.value || null,
        avatar_url: els.profileAvatar?.value.trim() || null,
      };
      const updated = await apiRequest("/users/me/profile", { method: "PUT", body });
      populateProfile(updated);
      toast("Profile saved");
    } catch (err) {
      console.error(err);
      toast("Failed to save profile.", true);
    } finally {
      if (els.profileSave) els.profileSave.disabled = false;
    }
  });

  // Email verification helpers (Firebase link)
  els.resendVerification?.addEventListener("click", async ()=>{
    const btn = els.resendVerification;
    btn.disabled = true;
    try {
      const user = auth().currentUser;
      if (!user) { toast("Not signed in.", true); return; }
      await user.sendEmailVerification();
      toast("Verification email sent");
    } catch (e) {
      console.error("sendEmailVerification failed:", e);
      toast("Could not send verification email.", true);
    } finally {
      btn.disabled = false;
    }
  });

  
  els.refreshVerification?.addEventListener("click", async ()=>{
    const btn = els.refreshVerification;
    btn.disabled = true;
    try {
      await refreshEmailVerified();
      const user = auth().currentUser;
      toast(user && user.emailVerified ? "Email verified ✔" : "Still unverified", !(user && user.emailVerified));
    } catch (e) {
      console.error("refreshEmailVerified failed:", e);
      toast("Could not refresh status.", true);
    } finally {
      btn.disabled = false;
    }
  });



  // Logout
  els.logout?.addEventListener("click", async () => {
    try { await auth().signOut(); } catch {}
    clearAuth();
    location.href = "index.html";
  });
}

/* ---------------- Auth state, profile hydration ---------------- */
function initAuthState() {
  auth().onAuthStateChanged(async (user) => {
    if (!user) { clearAuth(); show("auth"); return; }

    // Fast path: if token exists, try hydrating
    const existing = getAuth();
    if (existing?.idToken) {
      try {
        const me = await apiRequest("/users/me");
        populateProfile(me);
        updateVerifyBanner(me);
        show("profile");
        return;
      } catch (e) {
        console.warn("Stored token rejected, refreshing…");
      }
    }

    try {
      await afterFirebaseAuth(user, /*silent*/ true);
      show("profile");
    } catch (e) {
      console.error(e);
      show("auth");
    }
  });
}

async function afterFirebaseAuth(user, silent = false) {
  // Always refresh token after sign-in to avoid stale claims
  const idToken = await user.getIdToken(true);
  setAuth({
    idToken,
    uid: user.uid,
    email: user.email,
    name: user.displayName || user.email,
    photoURL: user.photoURL || null,
  });

  // Idempotent: ensure local user exists
  try { await apiRequest("/signup", { method: "POST" }); } catch {}

  // Hydrate profile if markup exists
  try {
    const me = await apiRequest("/users/me");
    populateProfile(me);
    updateVerifyBanner(me);
  } catch (e) {
    // If /users/me is not accessible yet, continue without blocking login
    console.warn(e);
  }

  if (!silent) toast("Signed in");
}

function populateProfile(me) {
  if (!els.profileSection) return;
  if (els.profileName)   els.profileName.value   = me.profile_name || me.name || "";
  if (els.profileEmail)  els.profileEmail.value  = me.email || "";
  if (els.profileDob)    els.profileDob.value    = me.profile_dob || "";
  if (els.profileGender) els.profileGender.value = me.profile_gender || "";
  if (els.profileAvatar) els.profileAvatar.value = me.profile_avatar_url || "";
}

async function refreshEmailVerified() {
  try {
    const user = auth().currentUser;
    if (!user) return;
    await user.reload();
    const token = await user.getIdToken(true);
    setAuth({ ...getAuth(), idToken: token });
    const me = await apiRequest("/users/me");
    updateVerifyBanner(me);
  } catch (e) {
    console.error(e);
  }
}

function updateVerifyBanner(me) {
  if (!els.verifyBanner) return;
  const user = auth().currentUser;
  const verified = (user && user.emailVerified) || !!me?.email_verified;
  els.verifyBanner.classList.toggle("hidden", !!verified);
  document.body.classList.toggle("unverified", !verified);
}
