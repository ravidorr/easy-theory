import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const authScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/auth.js"),
  "utf-8"
);

function setupDOM() {
  document.body.innerHTML = `
    <form id="login-form">
      <input id="email-input" type="email" value="test@example.com" />
      <button id="send-btn" type="submit">שלחי לי קישור</button>
      <div id="login-error" style="display:none"></div>
    </form>
    <div id="sent-banner" style="display:none">
      <button id="resend-btn">נשלח שוב</button>
      <span id="resend-msg" style="display:none"></span>
    </div>
  `;
  eval(authScript);
}

function submitForm() {
  document.getElementById("login-form")!.dispatchEvent(
    new Event("submit", { cancelable: true, bubbles: true })
  );
}

describe("auth.js – send button loading state", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setupDOM();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("disables the button and injects spinner on submit", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    submitForm();

    const btn = document.getElementById("send-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.querySelector(".btn-spinner")).not.toBeNull();
  });

  it("shows שולח... (not נשלח...) while loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    submitForm();

    const btn = document.getElementById("send-btn") as HTMLButtonElement;
    expect(btn.textContent).toContain("שולח...");
    expect(btn.innerHTML).not.toContain("נשלח");
  });

  it("resets button text and removes spinner after a fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "שגיאה" }) })
    );

    submitForm();
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById("send-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("שלחי לי קישור");
    expect(btn.querySelector(".btn-spinner")).toBeNull();
  });

  it("resets button text and removes spinner on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    submitForm();
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById("send-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("שלחי לי קישור");
    expect(btn.querySelector(".btn-spinner")).toBeNull();
  });
});
