(function () {
  const THEME_COLORS = { light: "#f5f7fc", dark: "#131829" };
  const DEFAULT_AUTO_ADVANCE_DELAY_MS = 1125;
  const MIN_AUTO_ADVANCE_DELAY_MS = 750;
  const MAX_AUTO_ADVANCE_DELAY_MS = 3000;
  const AUTO_ADVANCE_DELAY_STEP_MS = 125;

  function validAutoAdvanceDelay(value) {
    const delay = Number(value);
    return Number.isInteger(delay) &&
      delay >= MIN_AUTO_ADVANCE_DELAY_MS &&
      delay <= MAX_AUTO_ADVANCE_DELAY_MS &&
      (delay - MIN_AUTO_ADVANCE_DELAY_MS) % AUTO_ADVANCE_DELAY_STEP_MS === 0
      ? delay
      : DEFAULT_AUTO_ADVANCE_DELAY_MS;
  }

  function writeCookie(name, value) {
    document.cookie = name + "=" + value + "; path=/; max-age=31536000; SameSite=Lax; Secure";
  }

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
  const themeModeLabel = document.getElementById("theme-mode-label");
  const darkThemeIcon = document.getElementById("theme-dark-icon");
  const lightThemeIcon = document.getElementById("theme-light-icon");

  function updateSwitch(isDark) {
    if (!toggle || !knob) return;
    toggle.setAttribute("aria-checked", isDark ? "true" : "false");
    toggle.style.background = isDark ? "var(--primary)" : "var(--surface-3)";
    knob.style.insetInlineStart = isDark ? "21px" : "3px";
    if (themeModeLabel) {
      themeModeLabel.textContent = isDark
        ? themeModeLabel.dataset.darkLabel
        : themeModeLabel.dataset.lightLabel;
    }
    if (darkThemeIcon) darkThemeIcon.hidden = !isDark;
    if (lightThemeIcon) lightThemeIcon.hidden = isDark;
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
      writeCookie("theme", theme);
      updateSwitch(isDark);
      syncThemeColorMeta(theme);
    });
  }

  const autoAdvanceToggle = document.getElementById("auto-advance-toggle");
  const autoAdvanceKnob = autoAdvanceToggle && autoAdvanceToggle.querySelector("span");
  const autoAdvanceDelayInput = document.getElementById("auto-advance-delay");
  const autoAdvanceDelayValue = document.getElementById("auto-advance-delay-value");

  function setAutoAdvanceDelayValue(value) {
    if (!autoAdvanceDelayValue) return;
    const seconds = String(value / 1000);
    const template = autoAdvanceDelayValue.dataset.template || "{seconds}";
    autoAdvanceDelayValue.textContent = template.replace("{seconds}", seconds);
  }

  function updateAutoAdvanceSwitch(isOn) {
    if (!autoAdvanceToggle || !autoAdvanceKnob) return;
    autoAdvanceToggle.setAttribute("aria-checked", isOn ? "true" : "false");
    autoAdvanceToggle.style.background = isOn ? "var(--primary)" : "var(--surface-3)";
    autoAdvanceKnob.style.insetInlineStart = isOn ? "21px" : "3px";
    if (autoAdvanceDelayInput) autoAdvanceDelayInput.disabled = !isOn;
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
      writeCookie("quiz-auto-advance", isOn ? "on" : "off");
      updateAutoAdvanceSwitch(isOn);
    });
  }

  if (autoAdvanceDelayInput) {
    const delay = validAutoAdvanceDelay(autoAdvanceDelayInput.value);
    autoAdvanceDelayInput.value = String(delay);
    setAutoAdvanceDelayValue(delay);
    autoAdvanceDelayInput.addEventListener("input", function () {
      const value = validAutoAdvanceDelay(autoAdvanceDelayInput.value);
      autoAdvanceDelayInput.value = String(value);
      setAutoAdvanceDelayValue(value);
      writeCookie("quiz-auto-advance-delay", value);
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
