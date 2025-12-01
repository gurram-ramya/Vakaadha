// login.js — Zomato-style multi-panel login for Vakaadha (frontend only)

/* ---------------------------
   Country data (Option A)
   India first, others sorted
--------------------------- */

const RAW_COUNTRIES = [
  { iso: "AF", name: "Afghanistan", dial: "+93" },
  { iso: "AL", name: "Albania", dial: "+355" },
  { iso: "DZ", name: "Algeria", dial: "+213" },
  { iso: "AS", name: "American Samoa", dial: "+1684" },
  { iso: "AD", name: "Andorra", dial: "+376" },
  { iso: "AO", name: "Angola", dial: "+244" },
  { iso: "AR", name: "Argentina", dial: "+54" },
  { iso: "AM", name: "Armenia", dial: "+374" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "AT", name: "Austria", dial: "+43" },
  { iso: "BD", name: "Bangladesh", dial: "+880" },
  { iso: "BE", name: "Belgium", dial: "+32" },
  { iso: "BR", name: "Brazil", dial: "+55" },
  { iso: "CA", name: "Canada", dial: "+1" },
  { iso: "CN", name: "China", dial: "+86" },
  { iso: "DK", name: "Denmark", dial: "+45" },
  { iso: "EG", name: "Egypt", dial: "+20" },
  { iso: "FI", name: "Finland", dial: "+358" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "HK", name: "Hong Kong", dial: "+852" },
  { iso: "ID", name: "Indonesia", dial: "+62" },
  { iso: "IT", name: "Italy", dial: "+39" },
  { iso: "JP", name: "Japan", dial: "+81" },
  { iso: "MY", name: "Malaysia", dial: "+60" },
  { iso: "NP", name: "Nepal", dial: "+977" },
  { iso: "NZ", name: "New Zealand", dial: "+64" },
  { iso: "PK", name: "Pakistan", dial: "+92" },
  { iso: "QA", name: "Qatar", dial: "+974" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966" },
  { iso: "SG", name: "Singapore", dial: "+65" },
  { iso: "ZA", name: "South Africa", dial: "+27" },
  { iso: "LK", name: "Sri Lanka", dial: "+94" },
  { iso: "TH", name: "Thailand", dial: "+66" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "US", name: "United States", dial: "+1" }
];

// India first, others alphabetical
const COUNTRY_LIST = [
  { iso: "IN", name: "India", dial: "+91" },
  ...RAW_COUNTRIES.sort((a, b) => a.name.localeCompare(b.name))
];

const FLAG_BASE = "https://cdn.jsdelivr.net/npm/country-flag-icons/3x2/";

document.addEventListener("DOMContentLoaded", () => {
  // Panels
  const panelPhone = document.getElementById("panel-phone");
  const panelEmailLogin = document.getElementById("panel-email-login");
  const panelSignup = document.getElementById("panel-signup");
  const panelOtp = document.getElementById("panel-otp");

  const heading = document.getElementById("login-heading");

  // Phone panel elements
  const ccDropdown = document.getElementById("cc-dropdown");
  const ccSelected = document.getElementById("cc-selected");
  const ccMenu = document.getElementById("cc-menu");
  const ccFlag = document.getElementById("cc-flag");
  const ccDial = document.getElementById("cc-dial");
  const phoneInput = document.getElementById("phone-input");
  const phoneError = document.getElementById("phone-error");
  const phoneSendOtp = document.getElementById("phone-send-otp");

  const gotoEmailLogin = document.getElementById("goto-email-login");
  const gotoSignup = document.getElementById("goto-signup");

  // Email login panel
  const emailLoginInput = document.getElementById("email-login-input");
  const emailLoginError = document.getElementById("email-login-error");
  const emailLoginSendOtp = document.getElementById("email-login-send-otp");
  const backToPhoneFromEmail = document.getElementById("back-to-phone-from-email");

  // Signup panel
  const signupName = document.getElementById("signup-name");
  const signupEmail = document.getElementById("signup-email");
  const signupTos = document.getElementById("signup-tos");
  const signupCreate = document.getElementById("signup-create");
  const signupGoogle = document.getElementById("signup-google");
  const backToPhoneFromSignup = document.getElementById("back-to-phone-from-signup");

  // OTP panel
  const otpSubtext = document.getElementById("otp-subtext");
  const otpBoxes = Array.from(document.querySelectorAll(".otp-box"));
  const otpError = document.getElementById("otp-error");
  const otpTimerEl = document.getElementById("otp-timer");
  const otpResendBtn = document.getElementById("otp-resend");
  const otpVerifyBtn = document.getElementById("otp-verify-btn");

  // Google button (phone panel)
  const googleLoginBtn = document.getElementById("google-login");

  const toastEl = document.getElementById("toast");

  let otpContext = { type: null, target: null }; // { type: "phone"|"email-login"|"signup-email", target: value }
  let otpTimerId = null;
  let otpSeconds = 30;

  /* ================== Toast ================== */
  function toast(msg, bad = false, ms = 2000) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.backgroundColor = bad ? "#b00020" : "#333";
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toastEl.classList.remove("show");
    }, ms);
  }

  /* ================== Panel switching ================== */
  function showPanel(name) {
    panelPhone.classList.add("hidden");
    panelEmailLogin.classList.add("hidden");
    panelSignup.classList.add("hidden");
    panelOtp.classList.add("hidden");

    switch (name) {
      case "phone":
        panelPhone.classList.remove("hidden");
        heading.textContent = "Login";
        break;
      case "email-login":
        panelEmailLogin.classList.remove("hidden");
        heading.textContent = "Login";
        break;
      case "signup":
        panelSignup.classList.remove("hidden");
        heading.textContent = "Signup";
        break;
      case "otp":
        panelOtp.classList.remove("hidden");
        heading.textContent = "OTP Verification";
        break;
    }
  }

  // Initial panel
  showPanel("phone");

  /* ================== Country dropdown ================== */
  function populateCountries() {
    ccMenu.innerHTML = "";
    COUNTRY_LIST.forEach((c) => {
      const item = document.createElement("div");
      item.className = "cc-item";
      item.dataset.iso = c.iso;
      item.dataset.dial = c.dial;

      const flag = document.createElement("img");
      flag.src = `${FLAG_BASE}${c.iso}.svg`;
      flag.alt = c.iso;

      const nameSpan = document.createElement("span");
      nameSpan.textContent = c.name;

      const dialSpan = document.createElement("span");
      dialSpan.textContent = c.dial;

      item.appendChild(flag);
      item.appendChild(nameSpan);
      item.appendChild(dialSpan);
      ccMenu.appendChild(item);
    });

    const inEntry = COUNTRY_LIST[0]; // India first
    setCountry(inEntry.iso, inEntry.dial);
  }

  function setCountry(iso, dial) {
    ccFlag.src = `${FLAG_BASE}${iso}.svg`;
    ccFlag.alt = iso;
    ccDial.textContent = dial;
  }

  ccSelected.addEventListener("click", () => {
    ccMenu.classList.toggle("hidden");
  });

  ccMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".cc-item");
    if (!item) return;
    const iso = item.dataset.iso;
    const dial = item.dataset.dial;
    setCountry(iso, dial);
    ccMenu.classList.add("hidden");
  });

  // Click-outside to close
  document.addEventListener("click", (e) => {
    if (!ccDropdown.contains(e.target)) {
      ccMenu.classList.add("hidden");
    }
  });

  populateCountries();

  /* ================== Helpers ================== */
  function isValidEmail(value) {
    return /\S+@\S+\.\S+/.test(value);
  }

  function normalizePhone(value) {
    return value.replace(/[^\d]/g, "");
  }

  function startOtpTimer() {
    if (otpTimerId) clearInterval(otpTimerId);
    otpSeconds = 30;
    otpTimerEl.textContent = "00:30";
    otpResendBtn.disabled = true;

    otpTimerId = setInterval(() => {
      otpSeconds -= 1;
      if (otpSeconds <= 0) {
        clearInterval(otpTimerId);
        otpTimerId = null;
        otpTimerEl.textContent = "00:00";
        otpResendBtn.disabled = false;
        return;
      }
      const s = otpSeconds.toString().padStart(2, "0");
      otpTimerEl.textContent = `00:${s}`;
    }, 1000);
  }

  function collectOtp() {
    return otpBoxes.map((b) => b.value.trim()).join("");
  }

  function resetOtpBoxes() {
    otpBoxes.forEach((b) => (b.value = ""));
    otpBoxes[0].focus();
  }

  // auto-advance OTP boxes
  otpBoxes.forEach((box, idx) => {
    box.addEventListener("input", () => {
      if (box.value.length === 1 && idx < otpBoxes.length - 1) {
        otpBoxes[idx + 1].focus();
      }
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && idx > 0) {
        otpBoxes[idx - 1].focus();
      }
    });
  });

  /* ================== Phone OTP ================== */
  phoneSendOtp.addEventListener("click", () => {
    phoneError.classList.add("hidden");

    const num = normalizePhone(phoneInput.value);
    if (!num || num.length < 6) {
      phoneError.textContent = "Enter a valid phone number";
      phoneError.classList.remove("hidden");
      return;
    }

    const full = `${ccDial.textContent}${num}`;

    // TODO: integrate backend / Firebase phone OTP sending here
    console.log("[Phone] Send OTP to:", full);

    otpContext = { type: "phone", target: full };
    otpSubtext.textContent = `Verification code has been sent to ${full}. Enter it below to continue.`;
    resetOtpBoxes();
    showPanel("otp");
    startOtpTimer();
  });

  /* ================== Email login OTP ================== */
  emailLoginSendOtp.addEventListener("click", () => {
    emailLoginError.classList.add("hidden");
    const email = emailLoginInput.value.trim();
    if (!isValidEmail(email)) {
      emailLoginError.textContent = "Enter a valid email";
      emailLoginError.classList.remove("hidden");
      return;
    }

    // TODO: backend: send OTP for login to this email
    console.log("[Email-login] Send OTP to:", email);

    otpContext = { type: "email-login", target: email };
    otpSubtext.textContent = `Verification code has been sent to ${email}. Enter it below to login.`;
    resetOtpBoxes();
    showPanel("otp");
    startOtpTimer();
  });

  /* ================== Signup create (email OTP) ================== */
  signupTos.addEventListener("change", () => {
    const ok =
      signupName.value.trim() &&
      isValidEmail(signupEmail.value.trim()) &&
      signupTos.checked;
    signupCreate.disabled = !ok;
    signupCreate.classList.toggle("disabled", !ok);
  });

  signupName.addEventListener("input", () =>
    signupTos.dispatchEvent(new Event("change"))
  );
  signupEmail.addEventListener("input", () =>
    signupTos.dispatchEvent(new Event("change"))
  );

  signupCreate.addEventListener("click", () => {
    if (signupCreate.disabled) return;

    const name = signupName.value.trim();
    const email = signupEmail.value.trim();

    // TODO: backend: create account draft and send signup OTP to email
    console.log("[Signup] Send OTP to:", email, "name:", name);

    otpContext = { type: "signup-email", target: email, name };
    otpSubtext.textContent = `Verification code has been sent to ${email}. Enter it below to complete signup.`;
    resetOtpBoxes();
    showPanel("otp");
    startOtpTimer();
  });

  /* ================== OTP verification ================== */
  otpVerifyBtn.addEventListener("click", () => {
    otpError.classList.add("hidden");
    const code = collectOtp();
    if (code.length !== 6) {
      otpError.textContent = "Enter the 6-digit code";
      otpError.classList.remove("hidden");
      return;
    }

    // TODO: backend: verify OTP according to otpContext
    console.log("[OTP] Verify", code, "for", otpContext);

    toast("OTP verified. Logging you in...");

    // After real verification, redirect to homepage
    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);
  });

  otpResendBtn.addEventListener("click", () => {
    if (otpResendBtn.disabled) return;

    if (!otpContext || !otpContext.type) {
      toast("No OTP request in progress", true);
      return;
    }

    // TODO: backend: resend OTP based on otpContext
    console.log("[OTP] Resend for", otpContext);

    toast("OTP resent");
    startOtpTimer();
  });

  /* ================== Navigation between panels ================== */
  gotoEmailLogin.addEventListener("click", () => {
    showPanel("email-login");
  });

  gotoSignup.addEventListener("click", () => {
    showPanel("signup");
  });

  backToPhoneFromEmail.addEventListener("click", () => {
    showPanel("phone");
  });

  backToPhoneFromSignup.addEventListener("click", () => {
    showPanel("phone");
  });

  /* ================== Google login (stub) ================== */
  googleLoginBtn.addEventListener("click", () => {
    // TODO: integrate Firebase Google sign-in
    console.log("[Google] Sign in clicked");
    toast("Google sign-in not wired yet (frontend only)", true);
  });

  signupGoogle.addEventListener("click", () => {
    // TODO: integrate Firebase Google sign-in
    console.log("[Google] Signup via Google clicked");
    toast("Google sign-in not wired yet (frontend only)", true);
  });
});
