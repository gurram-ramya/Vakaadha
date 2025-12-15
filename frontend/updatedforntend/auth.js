function startAuth() {
  const v = document.getElementById("identifier").value.trim();

  if (/^\d{6,15}$/.test(v)) {
    localStorage.setItem("mobile", v);
    location.href = "otp.html";
  }
  else if (v.includes("@")) {
    localStorage.setItem("email", v);
    location.href = "email.html";
  }
  else {
    alert("Enter valid email or mobile number");
  }
}

// OTP SCREEN
if (location.pathname.includes("otp.html")) {
  document.getElementById("otpText").innerText =
    "We’ve sent a one-time password to +" + localStorage.getItem("mobile");

  let t = 60;
  const i = setInterval(() => {
    t--;
    timer.innerText = t;
    if (t === 0) {
      resendBtn.disabled = false;
      clearInterval(i);
    }
  }, 1000);
}

function verifyOtp() {
  // Firebase OTP verify hook
  location.href = "profile.html";
}

function resendOtp() {
  location.reload();
}

// EMAIL SCREEN
if (location.pathname.includes("email.html")) {
  emailText.innerText =
    "We’ve sent a sign-in link to " + localStorage.getItem("email");
}

function openEmail() {
  alert("Open your email app to continue");
}

function resendEmail() {
  alert("Email link resent");
}

// PROFILE
function saveProfile() {
  const user = {
    name: name.value,
    email: email.value || localStorage.getItem("email"),
    mobile: mobile.value || localStorage.getItem("mobile")
  };
  localStorage.setItem("user", JSON.stringify(user));
  location.href = "home.html";
}

function skipProfile() {
  location.href = "home.html";
}

function googleLogin() {
  // Firebase Google OAuth hook
  location.href = "home.html";
}
