/** Login page: send magic-link OTP and show sent banner. */
(function () {
  const form = document.getElementById("login-form");
  const btn = document.getElementById("send-btn");
  const banner = document.getElementById("sent-banner");

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("email-input").value.trim();
    if (!email) return;

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
        alert(error || "שגיאה בשליחת הקישור, נסי שוב.");
        btn.disabled = false;
        btn.textContent = "שלחי לי קישור";
        return;
      }

      // Show sent state
      form.style.display = "none";
      banner.style.display = "flex";
    } catch {
      alert("שגיאת רשת, נסי שוב.");
      btn.disabled = false;
      btn.textContent = "שלחי לי קישור";
    }
  });
})();
