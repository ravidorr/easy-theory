// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://localhost:3000"}
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const moreScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/more.js"),
  "utf-8"
);

function setupDOM(theme?: string, autoAdvanceChecked = "true", autoAdvanceDelay = "1125") {
  if (theme === undefined) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  document.head.innerHTML = '<meta name="theme-color" content="#131829">';
  document.body.innerHTML = `
    <span id="theme-dark-icon"></span>
    <span id="theme-light-icon"></span>
    <span id="theme-mode-label" data-dark-label="Dark mode" data-light-label="Light mode"></span>
    <button id="dark-mode-toggle" role="switch"><span></span></button>
    <button id="auto-advance-toggle" role="switch" aria-checked="${autoAdvanceChecked}"><span></span></button>
    <input id="auto-advance-delay" type="range" min="750" max="3000" step="125" value="${autoAdvanceDelay}">
    <output id="auto-advance-delay-value" data-template="{seconds} seconds"></output>
    <button id="logout-btn"></button>
  `;
  eval(moreScript);
}

function toggle() {
  return document.getElementById("dark-mode-toggle") as HTMLButtonElement;
}

function knob() {
  return toggle().querySelector("span") as HTMLSpanElement;
}

function themeModeLabel() {
  return document.getElementById("theme-mode-label") as HTMLSpanElement;
}

function darkThemeIcon() {
  return document.getElementById("theme-dark-icon") as HTMLSpanElement;
}

function lightThemeIcon() {
  return document.getElementById("theme-light-icon") as HTMLSpanElement;
}

function autoAdvanceToggle() {
  return document.getElementById("auto-advance-toggle") as HTMLButtonElement;
}

function autoAdvanceKnob() {
  return autoAdvanceToggle().querySelector("span") as HTMLSpanElement;
}

function autoAdvanceDelayInput() {
  return document.getElementById("auto-advance-delay") as HTMLInputElement;
}

function autoAdvanceDelayValue() {
  return document.getElementById("auto-advance-delay-value") as HTMLOutputElement;
}

function stubLocation() {
  const loc = { href: "" };
  Object.defineProperty(window, "location", {
    value: loc,
    writable: true,
    configurable: true,
  });
  return loc;
}

describe("more.js", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    document.cookie = "theme=; path=/; max-age=0";
    document.cookie = "quiz-auto-advance=; path=/; max-age=0";
    document.cookie = "quiz-auto-advance-delay=; path=/; max-age=0";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("syncs the switch to dark theme on load", () => {
    setupDOM("dark");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect(toggle().style.background).toBe("var(--primary)");
    expect(knob().style.insetInlineStart).toBe("21px");
    expect(themeModeLabel()).toHaveTextContent("Dark mode");
    expect(darkThemeIcon().hidden).toBe(false);
    expect(lightThemeIcon().hidden).toBe(true);
  });

  it("syncs the switch to light theme on load", () => {
    setupDOM("light");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(toggle().style.background).toBe("var(--surface-3)");
    expect(knob().style.insetInlineStart).toBe("3px");
    expect(themeModeLabel()).toHaveTextContent("Light mode");
    expect(darkThemeIcon().hidden).toBe(true);
    expect(lightThemeIcon().hidden).toBe(false);
  });

  it("defaults to dark when no theme is set", () => {
    setupDOM();
    expect(toggle().getAttribute("aria-checked")).toBe("true");
  });

  it("switches to light mode on click and persists the cookie", () => {
    setupDOM("dark");
    toggle().click();

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.cookie).toContain("theme=light");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(knob().style.insetInlineStart).toBe("3px");
    expect(themeModeLabel()).toHaveTextContent("Light mode");
    expect(darkThemeIcon().hidden).toBe(true);
    expect(lightThemeIcon().hidden).toBe(false);
    expect(
      document.querySelector('meta[name="theme-color"]')!.getAttribute("content")
    ).toBe("#f5f7fc");
  });

  it("syncs theme-color meta to the current theme on load", () => {
    setupDOM("light");
    expect(
      document.querySelector('meta[name="theme-color"]')!.getAttribute("content")
    ).toBe("#f5f7fc");
  });

  it("switches back to dark mode on a second click", () => {
    setupDOM("dark");
    toggle().click();
    toggle().click();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain("theme=dark");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect(knob().style.insetInlineStart).toBe("21px");
    expect(themeModeLabel()).toHaveTextContent("Dark mode");
    expect(darkThemeIcon().hidden).toBe(false);
    expect(lightThemeIcon().hidden).toBe(true);
  });

  it("does not throw when the dark mode toggle is missing", () => {
    document.body.innerHTML = `<button id="logout-btn"></button>`;
    expect(() => eval(moreScript)).not.toThrow();
  });

  it("turns auto-advance off on click and persists the cookie", () => {
    setupDOM("dark");
    autoAdvanceToggle().click();

    expect(document.cookie).toContain("quiz-auto-advance=off");
    expect(autoAdvanceToggle().getAttribute("aria-checked")).toBe("false");
    expect(autoAdvanceToggle().style.background).toBe("var(--surface-3)");
    expect(autoAdvanceKnob().style.insetInlineStart).toBe("3px");
  });

  it("turns auto-advance back on with a second click", () => {
    setupDOM("dark");
    autoAdvanceToggle().click();
    autoAdvanceToggle().click();

    expect(document.cookie).toContain("quiz-auto-advance=on");
    expect(autoAdvanceToggle().getAttribute("aria-checked")).toBe("true");
    expect(autoAdvanceKnob().style.insetInlineStart).toBe("21px");
  });

  it("corrects the cookieless default to off for reduced-motion users", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    setupDOM("dark");

    expect(autoAdvanceToggle().getAttribute("aria-checked")).toBe("false");
    expect(document.cookie).not.toContain("quiz-auto-advance");
  });

  it("keeps an explicit cookie choice for reduced-motion users", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    document.cookie = "quiz-auto-advance=on; path=/";
    setupDOM("dark");

    expect(autoAdvanceToggle().getAttribute("aria-checked")).toBe("true");
  });

  it("updates and persists the auto-advance delay", () => {
    setupDOM("dark");
    autoAdvanceDelayInput().value = "2000";
    autoAdvanceDelayInput().dispatchEvent(new Event("input", { bubbles: true }));

    expect(document.cookie).toContain("quiz-auto-advance-delay=2000");
    expect(autoAdvanceDelayValue().textContent).toBe("2 seconds");
  });

  it("initializes the default auto-advance delay value", () => {
    setupDOM("dark");
    expect(autoAdvanceDelayInput().value).toBe("1125");
    expect(autoAdvanceDelayValue().textContent).toBe("1.125 seconds");
  });

  it("disables the delay slider when auto-advance is turned off", () => {
    setupDOM("dark");
    autoAdvanceToggle().click();
    expect(autoAdvanceDelayInput().disabled).toBe(true);
    autoAdvanceToggle().click();
    expect(autoAdvanceDelayInput().disabled).toBe(false);
  });

  it("logs out via the API and redirects to the login page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const loc = stubLocation();
    setupDOM("dark");

    (document.getElementById("logout-btn") as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
    expect(loc.href).toBe("/auth/login");
  });
});
