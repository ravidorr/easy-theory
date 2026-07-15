(function () {
  const THEME_COLORS = { light: "#f5f7fc", dark: "#131829" };

  function syncThemeColorMeta(theme) {
    const color = THEME_COLORS[theme === "light" ? "light" : "dark"];
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
  }

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
    syncThemeColorMeta(currentTheme);

    toggle.addEventListener("click", function () {
      const wasDark = toggle.getAttribute("aria-checked") === "true";
      const isDark = !wasDark;
      const theme = isDark ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      document.cookie =
        "theme=" + theme + "; path=/; max-age=31536000; SameSite=Lax; Secure";
      updateSwitch(isDark);
      syncThemeColorMeta(theme);
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
