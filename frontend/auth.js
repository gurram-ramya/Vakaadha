// // ✅ Firebase config
// const firebaseConfig = {
//   apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
//   authDomain: "vakaadha.firebaseapp.com",
//   projectId: "vakaadha",
//   storageBucket: "vakaadha.appspot.com",
//   messagingSenderId: "395786980107",
//   appId: "1:395786980107:web:6678e452707296df56b00e"
// };

// if (!firebase.apps.length) {
//   firebase.initializeApp(firebaseConfig);
// }
// const auth = firebase.auth();

// // ✅ DOM Ready
// window.onload = () => {
//   const user = JSON.parse(localStorage.getItem("loggedInUser"));
//   if (user && user.name) showUser(user.name);
// };

// // ✅ Google Sign-In
// const googleLoginBtn = document.getElementById("google-login");
// if (googleLoginBtn) {
//   googleLoginBtn.addEventListener("click", () => {
//     const provider = new firebase.auth.GoogleAuthProvider();
//     auth.signInWithPopup(provider)
//       .then(result => {
//         const user = result.user;
//         return user.getIdToken().then(idToken => {
//           const userInfo = {
//             uid: user.uid,
//             name: user.displayName || "User",
//             email: user.email,
//             idToken: idToken
//           };
//           localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
//           showUser(user.displayName);
//           sendTokenToBackend(idToken, user.displayName);
//           if (typeof updateWishlistCount === "function") updateWishlistCount();
//         });
//       })
//       .catch(error => {
//         console.error("Google sign-in error:", error.message);
//         alert("Google sign-in failed: " + error.message);
//       });
//   });
// }

// // ✅ Email/Password Login
// const loginForm = document.getElementById("email-login-form");
// if (loginForm) {
//   loginForm.addEventListener("submit", e => {
//     e.preventDefault();
//     const email = document.getElementById("login-email").value;
//     const password = document.getElementById("login-password").value;

//     auth.signInWithEmailAndPassword(email, password)
//       .then(result => {
//         const user = result.user;
//         return user.getIdToken().then(idToken => {
//           const userInfo = {
//             uid: user.uid,
//             name: user.displayName || "User",
//             email: user.email,
//             idToken: idToken
//           };
//           localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
//           showUser(userInfo.name);
//           sendTokenToBackend(idToken, userInfo.name);
//           if (typeof updateWishlistCount === "function") updateWishlistCount();
//         });
//       })
//       .catch(error => {
//         console.error("Email login failed:", error.message);
//         alert("Login failed: " + error.message);
//       });
//   });
// }

// // ✅ Email/Password Registration
// const registerForm = document.getElementById("email-register-form");
// if (registerForm) {
//   registerForm.addEventListener("submit", e => {
//     e.preventDefault();
//     const email = document.getElementById("register-email").value;
//     const password = document.getElementById("register-password").value;
//     const name = document.getElementById("register-name").value;

//     auth.createUserWithEmailAndPassword(email, password)
//       .then(result => {
//         const user = result.user;
//         return user.updateProfile({ displayName: name }).then(() => {
//           return user.getIdToken().then(idToken => {
//             const userInfo = {
//               uid: user.uid,
//               name: name,
//               email: email,
//               idToken: idToken
//             };
//             localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
//             showUser(name);
//             sendTokenToBackend(idToken, name);
//             if (typeof updateWishlistCount === "function") updateWishlistCount();
//           });
//         });
//       })
//       .catch(error => {
//         console.error("Registration failed:", error.message);
//         alert("Registration failed: " + error.message);
//       });
//   });
// }

// // ✅ Send token to backend (optional)
// function sendTokenToBackend(idToken, name) {
//   fetch('/login', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': 'Bearer ' + idToken
//     },
//     body: JSON.stringify({ name: name })
//   })
//     .then(res => res.json())
//     .then(data => console.log("✅ Backend login success:", data))
//     stored.user_id = data.user.user_id;  // 🔁 Save internal ID
//     localStorage.setItem("loggedInUser", JSON.stringify(stored))
//     .catch(err => console.error("❌ Backend login failed:", err));
// }

// // ✅ Show User
// function showUser(name) {
//   const loginSection = document.getElementById("login-section");
//   const userInfo = document.getElementById("user-info");
//   const displayName = document.getElementById("display-name");

//   if (loginSection) loginSection.style.display = "none";
//   if (userInfo) userInfo.style.display = "block";
//   if (displayName) displayName.textContent = name;
// }

// // ✅ Logout
// function logout() {
//   auth.signOut().then(() => {
//     localStorage.removeItem("loggedInUser");
//     location.reload();
//   });
// }

// // ✅ Handle auto-login
// firebase.auth().onAuthStateChanged(user => {
//   if (user) {
//     document.getElementById("user-info").style.display = "block";
//     document.getElementById("login-section").style.display = "none";
//     document.getElementById("display-name").textContent = user.displayName || "User";
//   } else {
//     document.getElementById("user-info").style.display = "none";
//     document.getElementById("login-section").style.display = "block";
//   }
// });




// updated code for the user service. Adding the code below for the place holder. Checking the handle login flows: Firebase for identity → backend for session/user DB → token stored client-side.

// ==============================
// frontend/auth.js
// Authentication flow (Google + Email/Password) using Firebase + backend
// ==============================

// 🔐 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
  authDomain: "vakaadha.firebaseapp.com",
  projectId: "vakaadha",
  storageBucket: "vakaadha.appspot.com",
  messagingSenderId: "395786980107",
  appId: "1:395786980107:web:6678e452707296df56b00e"
};

// ✅ Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
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
  if (stored && stored.idToken) {
    try {
      const res = await fetch(API_BASE + "me", {
        headers: { "Authorization": "Bearer " + stored.idToken }
      });
      if (res.ok) {
        const user = await res.json();
        showUser(user.name || user.email);
      } else {
        logout(); // token invalid or expired
      }
    } catch (err) {
      console.error("Auto-login failed:", err);
      logout();
    }
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
