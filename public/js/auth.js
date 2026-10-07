/** Login page: send magic-link OTP and swap the form for the success card. */
(function () {
  const t = window.__t || {};

  const form = document.getElementById("login-form");
  const header = document.getElementById("login-header");
  const btn = document.getElementById("send-btn");
  const banner = document.getElementById("sent-banner");
  const errorEl = document.getElementById("login-error");
  const resendBtn = document.getElementById("resend-btn");
  const resendMsg = document.getElementById("resend-msg");

  if (!form) return;

  const originalBtnText = btn ? btn.textContent : "";
  const originalResendText = resendBtn ? resendBtn.textContent : "";

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

  function resolveError(data) {
    if (data && data.code && t[data.code]) return t[data.code];
    return (data && data.error) || t.linkError || "שגיאה בשליחת הקישור, אפשר לנסות שוב.";
  }

  function trackEvent(name, properties) {
    try {
      if (window.pendo && typeof window.pendo.track === "function") window.pendo.track(name, properties);
    } catch {}
  }

  // The email address is never tracked: the audience includes minors.
  function trackLinkRequested(isResend, nextPath) {
    trackEvent("magic_link_requested", {
      is_resend: isResend,
      next_path: nextPath,
      locale: window.__locale,
      after_expired_link: new URLSearchParams(window.location.search).get("error") === "1",
    });
  }

  function requestFailureType(status) {
    if (status === 429) return "rate_limited";
    return status >= 500 ? "server_error" : "validation";
  }

  function trackLinkRequestFailed(isResend, failureType, statusCode) {
    trackEvent("magic_link_request_failed", {
      status_code: statusCode,
      failure_type: failureType,
      is_resend: isResend,
      locale: window.__locale,
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearError();

    const email = document.getElementById("email-input").value.trim();
    if (!email) {
      showError(t.emailRequired || "יש להזין כתובת מייל.");
      return;
    }

    const nextPath = document.getElementById("next-path")?.value || "/";

    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span>' + (t.sending || "שליחת הקישור מתבצעת...");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextPath }),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(resolveError(data));
        trackLinkRequestFailed(false, requestFailureType(res.status), res.status);
        btn.disabled = false;
        btn.textContent = originalBtnText;
        return;
      }

      lastEmail = email;
      form.style.display = "none";
      if (header) header.style.display = "none";
      if (banner) banner.style.display = "flex";
      trackLinkRequested(false, nextPath);
    } catch {
      showError(t.networkError || "שגיאת רשת, אפשר לנסות שוב.");
      trackLinkRequestFailed(false, "network_error");
      btn.disabled = false;
      btn.textContent = originalBtnText;
    }
  });

  if (resendBtn) {
    resendBtn.addEventListener("click", async function () {
      if (!lastEmail) return;

      resendBtn.disabled = true;
      resendBtn.textContent = t.sending || "שליחת הקישור מתבצעת...";
      hideResendMsg();

      try {
        const nextPath = document.getElementById("next-path")?.value || "/";
        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: lastEmail, next: nextPath }),
        });

        if (res.status === 429) {
          const data = await res.json();
          showResendMsg(resolveError(data), true);
          trackLinkRequestFailed(true, requestFailureType(res.status), res.status);
          resendBtn.textContent = originalResendText;
          resendBtn.disabled = false;
          return;
        }

        if (!res.ok) {
          const data = await res.json();
          showResendMsg(resolveError(data), true);
          trackLinkRequestFailed(true, requestFailureType(res.status), res.status);
          resendBtn.textContent = originalResendText;
          resendBtn.disabled = false;
          return;
        }

        resendBtn.textContent = originalResendText;
        showResendMsg(t.resendSuccess || "נשלח שוב!", false);
        trackLinkRequested(true, nextPath);
        setTimeout(function () {
          hideResendMsg();
          resendBtn.disabled = false;
        }, 60000);
      } catch {
        showResendMsg(t.networkError || "שגיאת רשת, אפשר לנסות שוב.", true);
        trackLinkRequestFailed(true, "network_error");
        resendBtn.textContent = originalResendText;
        resendBtn.disabled = false;
      }
    });
  }
})();
