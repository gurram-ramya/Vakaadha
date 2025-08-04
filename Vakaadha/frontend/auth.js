// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
  authDomain: "vakaadha.firebaseapp.com",
  projectId: "vakaadha",
  storageBucket: "vakaadha.appspot.com",
  messagingSenderId: "395786980107",
  appId: "1:395786980107:web:6678e452707296df56b00e"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// ✅ DOM Ready
window.onload = () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (user && user.name) showUser(user.name);
};

// ✅ Google Sign-In
const googleLoginBtn = document.getElementById("google-login");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then(result => {
        const user = result.user;
        return user.getIdToken().then(idToken => {
          const userInfo = {
            uid: user.uid,
            name: user.displayName || "User",
            email: user.email,
            idToken: idToken
          };
          localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
          showUser(user.displayName);
          sendTokenToBackend(idToken, user.displayName);
          if (typeof updateWishlistCount === "function") updateWishlistCount();
        });
      })
      .catch(error => {
        console.error("Google sign-in error:", error.message);
        alert("Google sign-in failed: " + error.message);
      });
  });
}

// ✅ Email/Password Login
const loginForm = document.getElementById("email-login-form");
if (loginForm) {
  loginForm.addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    auth.signInWithEmailAndPassword(email, password)
      .then(result => {
        const user = result.user;
        return user.getIdToken().then(idToken => {
          const userInfo = {
            uid: user.uid,
            name: user.displayName || "User",
            email: user.email,
            idToken: idToken
          };
          localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
          showUser(userInfo.name);
          sendTokenToBackend(idToken, userInfo.name);
          if (typeof updateWishlistCount === "function") updateWishlistCount();
        });
      })
      .catch(error => {
        console.error("Email login failed:", error.message);
        alert("Login failed: " + error.message);
      });
  });
}

// ✅ Email/Password Registration
const registerForm = document.getElementById("email-register-form");
if (registerForm) {
  registerForm.addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const name = document.getElementById("register-name").value;

    auth.createUserWithEmailAndPassword(email, password)
      .then(result => {
        const user = result.user;
        return user.updateProfile({ displayName: name }).then(() => {
          return user.getIdToken().then(idToken => {
            const userInfo = {
              uid: user.uid,
              name: name,
              email: email,
              idToken: idToken
            };
            localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
            showUser(name);
            sendTokenToBackend(idToken, name);
            if (typeof updateWishlistCount === "function") updateWishlistCount();
          });
        });
      })
      .catch(error => {
        console.error("Registration failed:", error.message);
        alert("Registration failed: " + error.message);
      });
  });
}

// ✅ Send token to backend (optional)
function sendTokenToBackend(idToken, name) {
  fetch('/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + idToken
    },
    body: JSON.stringify({ name: name })
  })
    .then(res => res.json())
    .then(data => console.log("✅ Backend login success:", data))
    stored.user_id = data.user.user_id;  // 🔁 Save internal ID
    localStorage.setItem("loggedInUser", JSON.stringify(stored))
    .catch(err => console.error("❌ Backend login failed:", err));
}

// ✅ Show User
function showUser(name) {
  const loginSection = document.getElementById("login-section");
  const userInfo = document.getElementById("user-info");
  const displayName = document.getElementById("display-name");

  if (loginSection) loginSection.style.display = "none";
  if (userInfo) userInfo.style.display = "block";
  if (displayName) displayName.textContent = name;
}

// ✅ Logout
function logout() {
  auth.signOut().then(() => {
    localStorage.removeItem("loggedInUser");
    location.reload();
  });
}

// ✅ Handle auto-login
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    document.getElementById("user-info").style.display = "block";
    document.getElementById("login-section").style.display = "none";
    document.getElementById("display-name").textContent = user.displayName || "User";
  } else {
    document.getElementById("user-info").style.display = "none";
    document.getElementById("login-section").style.display = "block";
  }
});
