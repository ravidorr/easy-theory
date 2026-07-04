(function () {
  const toggle = document.getElementById("dark-mode-toggle");
  const knob = toggle && toggle.querySelector("span");

  function updateSwitch(isDark) {
    if (!toggle || !knob) return;
    toggle.setAttribute("aria-checked", isDark ? "true" : "false");
    toggle.style.background = isDark ? "var(--primary)" : "var(--surface-3)";
    knob.style.insetInlineStart = isDark ? "21px" : "3px";
  }

  if (toggle) {
    const currentTheme = document.documentElement.dataset.theme ?? "dark";
    updateSwitch(currentTheme === "dark");

    toggle.addEventListener("click", function () {
      const wasDark = toggle.getAttribute("aria-checked") === "true";
      const isDark = !wasDark;
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      document.cookie =
        "theme=" + (isDark ? "dark" : "light") + "; path=/; max-age=31536000; SameSite=Lax; Secure";
      updateSwitch(isDark);
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/auth/login";
    });
  }
})();
