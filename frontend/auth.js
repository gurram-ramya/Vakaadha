// // // ✅ Your Firebase configuration
// // const firebaseConfig = {
// //   apiKey: "AIzaSyBTQbRKcX-7GQ80w26BcNNCaoYy-5lzZSQ",
// //   authDomain: "vakaadha-auth.firebaseapp.com",
// //   projectId: "vakaadha-auth",
// //   storageBucket: "vakaadha-auth.appspot.com",
// //   messagingSenderId: "395786980107",
// //   appId: "1:395786980107:web:6678e452707296df56b00e"
// // };

// // // ✅ Initialize Firebase
// // firebase.initializeApp(firebaseConfig);
// // console.log("Firebase initialized successfully");
// // const auth = firebase.auth();

// // // ✅ Google Sign-In
// // document.getElementById("google-login").addEventListener("click", () => {
// //   const provider = new firebase.auth.GoogleAuthProvider();
// //   auth.signInWithPopup(provider)
// //     .then((result) => {
// //       const user = result.user;
// //       showUser(user.displayName);
// //       localStorage.setItem("user", JSON.stringify({
// //         name: user.displayName,
// //         email: user.email
// //       }));
// //     })
// //     .catch((error) => {
// //       console.error("Google sign-in error:", error.message);
// //       alert("Google sign-in failed: " + error.message);
// //     });
// // });

// // // ✅ Custom Form Login (local only)
// // document.getElementById("custom-login-form").addEventListener("submit", (e) => {
// //   e.preventDefault();
// //   const name = document.getElementById("username").value;
// //   const email = document.getElementById("email").value;

// //   localStorage.setItem("user", JSON.stringify({ name, email }));
// //   showUser(name);
// // });

// // // ✅ Display Welcome Message
// // function showUser(name) {
// //   document.getElementById("login-section").style.display = "none";
// //   document.getElementById("user-info").style.display = "block";
// //   document.getElementById("display-name").textContent = name;
// // }

// // // ✅ Logout
// // function logout() {
// //   auth.signOut().then(() => {
// //     localStorage.removeItem("user");
// //     location.reload();
// //   });
// // }

// // // ✅ Keep User Logged In (LocalStorage-based)
// // window.onload = () => {
// //   const user = JSON.parse(localStorage.getItem("user"));
// //   if (user) {
// //     showUser(user.name);
// //   }
// // };


// // Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyAuhjUmQlVyJKMuk2i141mKcXiKcnHMWsA",
  
//   authDomain: "vakaadha.firebaseapp.com",
//   projectId: "vakaadha",
//   storageBucket: "vakaadha.appspot.com",
//   messagingSenderId: "395786980107",
//   appId: "1:395786980107:web:6678e452707296df56b00e"
// };


// // ✅ Initialize Firebase
// if (!firebase.apps.length) {
//   firebase.initializeApp(firebaseConfig);
// }
// const auth = firebase.auth();

// // ✅ Google Sign-In
// document.getElementById("google-login").addEventListener("click", () => {
//   const provider = new firebase.auth.GoogleAuthProvider();
//   auth.signInWithPopup(provider)
//     .then((result) => {
//       const user = result.user;
//       showUser(user.displayName);
//       localStorage.setItem("user", JSON.stringify({
//         name: user.displayName,
//         email: user.email
//       }));

//       // 🔐 Send ID token to backend
//       user.getIdToken().then(idToken => {
//         sendTokenToBackend(idToken);
//       });
//     })
//     .catch((error) => {
//       console.error("Google sign-in error:", error.message);
//       alert("Google sign-in failed: " + error.message);
//     });
// });

// // ✅ Custom Form Login (local only)
// document.getElementById("custom-login-form").addEventListener("submit", (e) => {
//   e.preventDefault();
//   const name = document.getElementById("username").value;
//   const email = document.getElementById("email").value;

//   localStorage.setItem("user", JSON.stringify({ name, email }));
//   showUser(name);
// });

// // ✅ Send ID token to backend
// function sendTokenToBackend(idToken) {
//   fetch('http://127.0.0.1:5000/login', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': 'Bearer ' + idToken
//     }
//   })
//   .then(res => res.json())
//   .then(data => {
//     console.log("✅ Backend Response:", data);
//     localStorage.setItem("vakaadhaUser", JSON.stringify(data.user));
//   })
//   .catch(err => {
//     console.error("❌ Login failed:", err);
//   });
// }

// // ✅ Display Welcome Message
// function showUser(name) {
//   document.getElementById("login-section").style.display = "none";
//   document.getElementById("user-info").style.display = "block";
//   document.getElementById("display-name").textContent = name;
// }

// // ✅ Logout
// function logout() {
//   auth.signOut().then(() => {
//     localStorage.removeItem("user");
//     localStorage.removeItem("vakaadhaUser");
//     location.reload();
//   });
// }

// // ✅ Keep User Logged In
// window.onload = () => {
//   const user = JSON.parse(localStorage.getItem("user"));
//   if (user) {
//     showUser(user.name);
//   }
// };

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
