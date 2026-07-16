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

  const autoAdvanceToggle = document.getElementById("auto-advance-toggle");
  const autoAdvanceKnob = autoAdvanceToggle && autoAdvanceToggle.querySelector("span");

  function updateAutoAdvanceSwitch(isOn) {
    if (!autoAdvanceToggle || !autoAdvanceKnob) return;
    autoAdvanceToggle.setAttribute("aria-checked", isOn ? "true" : "false");
    autoAdvanceToggle.style.background = isOn ? "var(--primary)" : "var(--surface-3)";
    autoAdvanceKnob.style.insetInlineStart = isOn ? "21px" : "3px";
  }

  if (autoAdvanceToggle) {
    // The server defaults the switch to on when no cookie is set; correct
    // that for reduced-motion users, whose quiz default is manual advance.
    const cookieMatch = document.cookie.match(/(?:^|;\s*)quiz-auto-advance=([^;]*)/);
    if (
      !cookieMatch &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      updateAutoAdvanceSwitch(false);
    }

    autoAdvanceToggle.addEventListener("click", function () {
      const wasOn = autoAdvanceToggle.getAttribute("aria-checked") === "true";
      const isOn = !wasOn;
      document.cookie =
        "quiz-auto-advance=" + (isOn ? "on" : "off") +
        "; path=/; max-age=31536000; SameSite=Lax; Secure";
      updateAutoAdvanceSwitch(isOn);
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
