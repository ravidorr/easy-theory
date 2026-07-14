import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const authScript = readFileSync(
  resolve(__dirname, "../../../../../../public/js/auth.js"),
  "utf-8"
);

function setupDOM() {
  document.body.innerHTML = `
    <div id="login-header"></div>
    <form id="login-form">
      <input id="email-input" type="email" value="test@example.com" />
      <button id="send-btn" type="submit">לשלוח לי קישור</button>
      <div id="login-error" style="display:none"></div>
    </form>
    <div id="sent-banner" style="display:none">
      <button id="resend-btn">שליחה מחדש</button>
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

  it("shows שולחים... (not נשלח...) while loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    submitForm();

    const btn = document.getElementById("send-btn") as HTMLButtonElement;
    expect(btn.textContent).toContain("שולחים...");
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
    expect(btn.textContent).toBe("לשלוח לי קישור");
    expect(btn.querySelector(".btn-spinner")).toBeNull();
  });

  it("resets button text and removes spinner on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    submitForm();
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById("send-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("לשלוח לי קישור");
    expect(btn.querySelector(".btn-spinner")).toBeNull();
  });

  it("swaps the form and card header for the success card on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    submitForm();
    await new Promise((r) => setTimeout(r, 0));

    expect((document.getElementById("login-form") as HTMLElement).style.display).toBe("none");
    expect((document.getElementById("login-header") as HTMLElement).style.display).toBe("none");
    expect((document.getElementById("sent-banner") as HTMLElement).style.display).toBe("flex");
  });
});
