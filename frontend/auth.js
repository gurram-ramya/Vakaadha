
// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
  authDomain: "vakaadha.firebaseapp.com",
  projectId: "vakaadha",
  storageBucket: "vakaadha.appspot.com",
  messagingSenderId: "395786980107",
  appId: "1:395786980107:web:6678e452707296df56b00e"
};

// ✅ Initialize Firebase only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// ✅ DOM Ready logic
window.onload = () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (user && user.name) {
    showUser(user.name);
  }
};

// ✅ Google Sign-In
const googleLoginBtn = document.getElementById("google-login");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then((result) => {
        const user = result.user;
        user.getIdToken().then((idToken) => {
          const userInfo = {
            name: user.displayName,
            email: user.email,
            idToken: idToken
          };
          localStorage.setItem("loggedInUser", JSON.stringify(userInfo));
          showUser(user.displayName);
          sendTokenToBackend(idToken);
          updateWishlistCount();
        });
      })
      .catch((error) => {
        console.error("Google sign-in error:", error.message);
        alert("Google sign-in failed: " + error.message);
      });
  });
}

// ✅ Custom Login (for testing - not secure)
const form = document.getElementById("custom-login-form");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("username").value;
    const email = document.getElementById("email").value;

    const dummyToken = "dummy-id-token-for-dev";
    localStorage.setItem("loggedInUser", JSON.stringify({
      name, email, idToken: dummyToken
    }));

    showUser(name);
    sendTokenToBackend(dummyToken);
    updateWishlistCount();
  });
}

// ✅ Backend login API token POST
function sendTokenToBackend(idToken) {
  fetch('/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + idToken
    }
  })
  .then(res => res.json())
  .then(data => {
    console.log("✅ Backend login success:", data);
  })
  .catch(err => {
    console.error("❌ Backend login failed:", err);
  });
}

// ✅ Show welcome UI
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
