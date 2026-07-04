/** Login page: send magic-link OTP and show sent banner. */
(function () {
  const form = document.getElementById("login-form");
  const btn = document.getElementById("send-btn");
  const banner = document.getElementById("sent-banner");
  const errorEl = document.getElementById("login-error");

  if (!form) return;

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

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearError();

    const email = document.getElementById("email-input").value.trim();
    if (!email) {
      showError("יש להזין כתובת מייל.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "שולחת...";

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        showError(error || "שגיאה בשליחת הקישור, נסי שוב.");
        btn.disabled = false;
        btn.textContent = "שלחי לי קישור";
        return;
      }

      // Show sent state
      form.style.display = "none";
      if (banner) banner.style.display = "flex";
    } catch {
      showError("שגיאת רשת, נסי שוב.");
      btn.disabled = false;
      btn.textContent = "שלחי לי קישור";
    }
  });
})();
