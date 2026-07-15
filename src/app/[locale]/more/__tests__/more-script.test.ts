// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://localhost:3000"}
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const moreScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/more.js"),
  "utf-8"
);

function setupDOM(theme?: string) {
  if (theme === undefined) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  document.head.innerHTML = '<meta name="theme-color" content="#131829">';
  document.body.innerHTML = `
    <button id="dark-mode-toggle" role="switch"><span></span></button>
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("syncs the switch to dark theme on load", () => {
    setupDOM("dark");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect(toggle().style.background).toBe("var(--primary)");
    expect(knob().style.insetInlineStart).toBe("21px");
  });

  it("syncs the switch to light theme on load", () => {
    setupDOM("light");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(toggle().style.background).toBe("var(--surface-3)");
    expect(knob().style.insetInlineStart).toBe("3px");
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
  });

  it("does not throw when the dark mode toggle is missing", () => {
    document.body.innerHTML = `<button id="logout-btn"></button>`;
    expect(() => eval(moreScript)).not.toThrow();
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
