/* =========================
   AUTH – LOGIN SCREEN
========================= */

let selectedCountry = {
  name: "India",
  code: "+91",
  flag: "🇮🇳"
};

// 🌍 FULL COUNTRY DATA (extend freely)
const countries = [
  { name: "Afghanistan", code: "+93", flag: "🇦🇫" },
  { name: "Albania", code: "+355", flag: "🇦🇱" },
  { name: "Algeria", code: "+213", flag: "🇩🇿" },
  { name: "Andorra", code: "+376", flag: "🇦🇩" },
  { name: "Angola", code: "+244", flag: "🇦🇴" },
  { name: "Antigua and Barbuda", code: "+1", flag: "🇦🇬" },
  { name: "Argentina", code: "+54", flag: "🇦🇷" },
  { name: "Armenia", code: "+374", flag: "🇦🇲" },
  { name: "Australia", code: "+61", flag: "🇦🇺" },
  { name: "Austria", code: "+43", flag: "🇦🇹" },
  { name: "Azerbaijan", code: "+994", flag: "🇦🇿" },

  { name: "Bahamas", code: "+1", flag: "🇧🇸" },
  { name: "Bahrain", code: "+973", flag: "🇧🇭" },
  { name: "Bangladesh", code: "+880", flag: "🇧🇩" },
  { name: "Barbados", code: "+1", flag: "🇧🇧" },
  { name: "Belarus", code: "+375", flag: "🇧🇾" },
  { name: "Belgium", code: "+32", flag: "🇧🇪" },
  { name: "Belize", code: "+501", flag: "🇧🇿" },
  { name: "Benin", code: "+229", flag: "🇧🇯" },
  { name: "Bhutan", code: "+975", flag: "🇧🇹" },
  { name: "Bolivia", code: "+591", flag: "🇧🇴" },
  { name: "Bosnia and Herzegovina", code: "+387", flag: "🇧🇦" },
  { name: "Botswana", code: "+267", flag: "🇧🇼" },
  { name: "Brazil", code: "+55", flag: "🇧🇷" },
  { name: "Brunei", code: "+673", flag: "🇧🇳" },
  { name: "Bulgaria", code: "+359", flag: "🇧🇬" },
  { name: "Burkina Faso", code: "+226", flag: "🇧🇫" },
  { name: "Burundi", code: "+257", flag: "🇧🇮" },

  { name: "Cambodia", code: "+855", flag: "🇰🇭" },
  { name: "Cameroon", code: "+237", flag: "🇨🇲" },
  { name: "Canada", code: "+1", flag: "🇨🇦" },
  { name: "Cape Verde", code: "+238", flag: "🇨🇻" },
  { name: "Central African Republic", code: "+236", flag: "🇨🇫" },
  { name: "Chad", code: "+235", flag: "🇹🇩" },
  { name: "Chile", code: "+56", flag: "🇨🇱" },
  { name: "China", code: "+86", flag: "🇨🇳" },
  { name: "Colombia", code: "+57", flag: "🇨🇴" },
  { name: "Comoros", code: "+269", flag: "🇰🇲" },
  { name: "Congo", code: "+242", flag: "🇨🇬" },
  { name: "Costa Rica", code: "+506", flag: "🇨🇷" },
  { name: "Croatia", code: "+385", flag: "🇭🇷" },
  { name: "Cuba", code: "+53", flag: "🇨🇺" },
  { name: "Cyprus", code: "+357", flag: "🇨🇾" },
  { name: "Czech Republic", code: "+420", flag: "🇨🇿" },

  { name: "Denmark", code: "+45", flag: "🇩🇰" },
  { name: "Djibouti", code: "+253", flag: "🇩🇯" },
  { name: "Dominica", code: "+1", flag: "🇩🇲" },
  { name: "Dominican Republic", code: "+1", flag: "🇩🇴" },

  { name: "Ecuador", code: "+593", flag: "🇪🇨" },
  { name: "Egypt", code: "+20", flag: "🇪🇬" },
  { name: "El Salvador", code: "+503", flag: "🇸🇻" },
  { name: "Equatorial Guinea", code: "+240", flag: "🇬🇶" },
  { name: "Eritrea", code: "+291", flag: "🇪🇷" },
  { name: "Estonia", code: "+372", flag: "🇪🇪" },
  { name: "Eswatini", code: "+268", flag: "🇸🇿" },
  { name: "Ethiopia", code: "+251", flag: "🇪🇹" },

  { name: "Fiji", code: "+679", flag: "🇫🇯" },
  { name: "Finland", code: "+358", flag: "🇫🇮" },
  { name: "France", code: "+33", flag: "🇫🇷" },

  { name: "Gabon", code: "+241", flag: "🇬🇦" },
  { name: "Gambia", code: "+220", flag: "🇬🇲" },
  { name: "Georgia", code: "+995", flag: "🇬🇪" },
  { name: "Germany", code: "+49", flag: "🇩🇪" },
  { name: "Ghana", code: "+233", flag: "🇬🇭" },
  { name: "Greece", code: "+30", flag: "🇬🇷" },
  { name: "Grenada", code: "+1", flag: "🇬🇩" },
  { name: "Guatemala", code: "+502", flag: "🇬🇹" },
  { name: "Guinea", code: "+224", flag: "🇬🇳" },
  { name: "Guyana", code: "+592", flag: "🇬🇾" },

  { name: "Haiti", code: "+509", flag: "🇭🇹" },
  { name: "Honduras", code: "+504", flag: "🇭🇳" },
  { name: "Hungary", code: "+36", flag: "🇭🇺" },

  { name: "Iceland", code: "+354", flag: "🇮🇸" },
  { name: "India", code: "+91", flag: "🇮🇳" },
  { name: "Indonesia", code: "+62", flag: "🇮🇩" },
  { name: "Iran", code: "+98", flag: "🇮🇷" },
  { name: "Iraq", code: "+964", flag: "🇮🇶" },
  { name: "Ireland", code: "+353", flag: "🇮🇪" },
  { name: "Israel", code: "+972", flag: "🇮🇱" },
  { name: "Italy", code: "+39", flag: "🇮🇹" },

  { name: "Jamaica", code: "+1", flag: "🇯🇲" },
  { name: "Japan", code: "+81", flag: "🇯🇵" },
  { name: "Jordan", code: "+962", flag: "🇯🇴" },

  { name: "Kazakhstan", code: "+7", flag: "🇰🇿" },
  { name: "Kenya", code: "+254", flag: "🇰🇪" },
  { name: "Kuwait", code: "+965", flag: "🇰🇼" },
  { name: "Kyrgyzstan", code: "+996", flag: "🇰🇬" },

  { name: "Laos", code: "+856", flag: "🇱🇦" },
  { name: "Latvia", code: "+371", flag: "🇱🇻" },
  { name: "Lebanon", code: "+961", flag: "🇱🇧" },
  { name: "Lesotho", code: "+266", flag: "🇱🇸" },
  { name: "Liberia", code: "+231", flag: "🇱🇷" },
  { name: "Libya", code: "+218", flag: "🇱🇾" },
  { name: "Lithuania", code: "+370", flag: "🇱🇹" },
  { name: "Luxembourg", code: "+352", flag: "🇱🇺" },

  { name: "Malaysia", code: "+60", flag: "🇲🇾" },
  { name: "Maldives", code: "+960", flag: "🇲🇻" },
  { name: "Mexico", code: "+52", flag: "🇲🇽" },
  { name: "Mongolia", code: "+976", flag: "🇲🇳" },
  { name: "Morocco", code: "+212", flag: "🇲🇦" },

  { name: "Nepal", code: "+977", flag: "🇳🇵" },
  { name: "Netherlands", code: "+31", flag: "🇳🇱" },
  { name: "New Zealand", code: "+64", flag: "🇳🇿" },
  { name: "Nigeria", code: "+234", flag: "🇳🇬" },
  { name: "Norway", code: "+47", flag: "🇳🇴" },

  { name: "Oman", code: "+968", flag: "🇴🇲" },

  { name: "Pakistan", code: "+92", flag: "🇵🇰" },
  { name: "Philippines", code: "+63", flag: "🇵🇭" },
  { name: "Poland", code: "+48", flag: "🇵🇱" },
  { name: "Portugal", code: "+351", flag: "🇵🇹" },

  { name: "Qatar", code: "+974", flag: "🇶🇦" },

  { name: "Romania", code: "+40", flag: "🇷🇴" },
  { name: "Russia", code: "+7", flag: "🇷🇺" },

  { name: "Saudi Arabia", code: "+966", flag: "🇸🇦" },
  { name: "Singapore", code: "+65", flag: "🇸🇬" },
  { name: "South Africa", code: "+27", flag: "🇿🇦" },
  { name: "South Korea", code: "+82", flag: "🇰🇷" },
  { name: "Spain", code: "+34", flag: "🇪🇸" },
  { name: "Sri Lanka", code: "+94", flag: "🇱🇰" },
  { name: "Sweden", code: "+46", flag: "🇸🇪" },
  { name: "Switzerland", code: "+41", flag: "🇨🇭" },

  { name: "Thailand", code: "+66", flag: "🇹🇭" },
  { name: "Turkey", code: "+90", flag: "🇹🇷" },

  { name: "UAE", code: "+971", flag: "🇦🇪" },
  { name: "Ukraine", code: "+380", flag: "🇺🇦" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "United States", code: "+1", flag: "🇺🇸" },

  { name: "Vietnam", code: "+84", flag: "🇻🇳" },

  { name: "Yemen", code: "+967", flag: "🇾🇪" },

  { name: "Zambia", code: "+260", flag: "🇿🇲" },
  { name: "Zimbabwe", code: "+263", flag: "🇿🇼" }
];


/* =========================
   COUNTRY LIST RENDER
========================= */

const countryContainer = document.getElementById("countries");

function renderCountries(list) {
  countryContainer.innerHTML = "";
  list.forEach(c => {
    const div = document.createElement("div");
    div.className = "country-item";
    div.innerHTML = `<span>${c.flag} ${c.name}</span><span>${c.code}</span>`;
    div.onclick = () => selectCountry(c);
    countryContainer.appendChild(div);
  });
}

renderCountries(countries);

function toggleCountryList() {
  const input = identifier.value;

  // ❌ block dropdown in email mode
  if (/[a-zA-Z]/.test(input)) return;

  const list = document.getElementById("countryList");
  list.style.display = list.style.display === "block" ? "none" : "block";
}

function selectCountry(c) {
  selectedCountry = c;
  document.getElementById("flag").innerText = c.flag;
  document.getElementById("code").innerText = c.code;
  document.getElementById("countryList").style.display = "none";
}


function filterCountries(val) {
  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(val.toLowerCase())
  );
  renderCountries(filtered);
}

/* =========================
   AUTO COUNTRY DETECTION
========================= */
function detectCountry(value) {
  value = value.trim();

  const countryUI = document.getElementById("countryUI");
  const countryList = document.getElementById("countryList");

  // 📧 EMAIL MODE
  if (/[a-zA-Z]/.test(value)) {
    countryUI.style.display = "none";
    countryList.style.display = "none";
    return;
  }

  // ❌ EMPTY
  if (value === "") {
    countryUI.style.display = "none";
    countryList.style.display = "none";
    return;
  }

  // 📱 PHONE MODE → SHOW COUNTRY UI (DO NOT CHANGE IT)
  if (/^[\d\s+]+$/.test(value)) {
    countryUI.style.display = "flex";
    // ✅ country remains whatever user selected (default India)
  }
}



/* =========================
   LOGIN FLOW
========================= */

function startAuth() {
  const v = identifier.value.trim().replace(/\s/g, "");

  // EMAIL (letters detected)
  if (/[a-zA-Z]/.test(v)) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      alert("Enter a valid email address");
      return;
    }
    localStorage.setItem("email", v);
    location.href = "email.html";
    return;
  }

  // PHONE
  if (/^\+?\d{6,15}$/.test(v)) {
    const finalNumber = v.startsWith("+")
      ? v
      : selectedCountry.code + v;

    localStorage.setItem("mobile", finalNumber);
    location.href = "otp.html";
    return;
  }

  alert("Enter a valid email or mobile number");
}



/* =========================
   OTP SCREEN
========================= */

if (location.pathname.includes("otp.html")) {
  document.getElementById("otpText").innerText =
    "We’ve sent a one-time password to " + localStorage.getItem("mobile");

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

/* =========================
   EMAIL SCREEN
========================= */

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

/* =========================
   PROFILE
========================= */

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

/* =========================
   GOOGLE LOGIN
========================= */

function googleLogin() {
  // Firebase Google OAuth hook
  location.href = "home.html";
}
