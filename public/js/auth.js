/** Login page: send magic-link OTP and show sent banner. */
(function () {
  const form = document.getElementById("login-form");
  const btn = document.getElementById("send-btn");
  const banner = document.getElementById("sent-banner");
  const errorEl = document.getElementById("login-error");
  const resendBtn = document.getElementById("resend-btn");
  const resendMsg = document.getElementById("resend-msg");

  if (!form) return;

  let lastEmail = "";

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.style.display = "none";
    errorEl.textContent = "";
  }

  function showResendMsg(msg, isError) {
    if (!resendMsg) return;
    resendMsg.textContent = msg;
    resendMsg.style.color = isError ? "var(--danger-text)" : "var(--success-text)";
    resendMsg.style.display = "inline";
  }

  function hideResendMsg() {
    if (!resendMsg) return;
    resendMsg.style.display = "none";
    resendMsg.textContent = "";
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearError();

    const email = document.getElementById("email-input").value.trim();
    if (!email) {
      showError("יש להזין כתובת מייל.");
      return;
    }

    const nextPath = document.getElementById("next-path")?.value || "/";

    btn.disabled = true;
    btn.textContent = "נשלח...";

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextPath }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        showError(error || "שגיאה בשליחת הקישור, נסי שוב.");
        btn.disabled = false;
        btn.textContent = "שלחי לי קישור";
        return;
      }

      lastEmail = email;

      // Show sent state
      form.style.display = "none";
      if (banner) banner.style.display = "flex";
    } catch {
      showError("שגיאת רשת, נסי שוב.");
      btn.disabled = false;
      btn.textContent = "שלחי לי קישור";
    }
  });

  if (resendBtn) {
    resendBtn.addEventListener("click", async function () {
      if (!lastEmail) return;

      resendBtn.disabled = true;
      resendBtn.textContent = "שולח...";
      hideResendMsg();

      try {
        const nextPath = document.getElementById("next-path")?.value || "/";
        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: lastEmail, next: nextPath }),
        });

        if (res.status === 429) {
          const { error } = await res.json();
          showResendMsg(error || "יותר מדי ניסיונות, נסי שוב בעוד 15 דקות", true);
          resendBtn.textContent = "נשלח שוב";
          resendBtn.disabled = false;
          return;
        }

        if (!res.ok) {
          const { error } = await res.json();
          showResendMsg(error || "שגיאה בשליחת הקישור, נסי שוב.", true);
          resendBtn.textContent = "נשלח שוב";
          resendBtn.disabled = false;
          return;
        }

        resendBtn.textContent = "נשלח שוב";
        showResendMsg("✓ נשלח שוב!", false);
        setTimeout(function () {
          hideResendMsg();
          resendBtn.disabled = false;
        }, 60000);
      } catch {
        showResendMsg("שגיאת רשת, נסי שוב.", true);
        resendBtn.textContent = "נשלח שוב";
        resendBtn.disabled = false;
      }
    });
  }
})();
