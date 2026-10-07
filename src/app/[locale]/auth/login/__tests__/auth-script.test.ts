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
      <input id="next-path" type="hidden" value="/" />
      <button id="send-btn" type="submit">שלח לי קישור</button>
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

  it("shows the neutral sending status while loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    submitForm();

    const btn = document.getElementById("send-btn") as HTMLButtonElement;
    expect(btn.textContent).toContain("שליחת הקישור מתבצעת...");
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
    expect(btn.textContent).toBe("שלח לי קישור");
    expect(btn.querySelector(".btn-spinner")).toBeNull();
  });

  it("resets button text and removes spinner on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    submitForm();
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById("send-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("שלח לי קישור");
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

describe("auth.js – Pendo tracking", () => {
  let track: ReturnType<typeof vi.fn>;

  function flush() {
    return new Promise((r) => setTimeout(r, 0));
  }

  beforeEach(() => {
    vi.unstubAllGlobals();
    track = vi.fn();
    vi.stubGlobal("pendo", { track });
    setupDOM();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tracks only the path of the post-login target while still sending the full target", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const target = "/topics?email=a%40b.test&token=secret#frag";
    (document.getElementById("next-path") as HTMLInputElement).value = target;

    submitForm();
    await flush();
    (document.getElementById("resend-btn") as HTMLButtonElement).click();
    await flush();

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "test@example.com",
      next: target,
    });
    const tracked = track.mock.calls.filter(([name]) => name === "magic_link_requested");
    expect(tracked).toHaveLength(2);
    for (const [, properties] of tracked) {
      expect(properties.next_path).toBe("/topics");
    }
    expect(JSON.stringify(track.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(track.mock.calls)).not.toContain("a%40b.test");
  });

  it("falls back to the root path when the post-login target cannot be parsed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    (document.getElementById("next-path") as HTMLInputElement).value = "http://[bad";

    submitForm();
    await flush();

    expect(track).toHaveBeenCalledWith(
      "magic_link_requested",
      expect.objectContaining({ next_path: "/" })
    );
  });

  it("tracks a sent magic link without the email address", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    submitForm();
    await flush();

    expect(track).toHaveBeenCalledWith("magic_link_requested", {
      is_resend: false,
      next_path: "/",
      locale: undefined,
      after_expired_link: false,
    });
    expect(JSON.stringify(track.mock.calls)).not.toContain("test@example.com");
  });

  it.each([
    [400, "validation"],
    [429, "rate_limited"],
    [500, "server_error"],
  ])("tracks a %i link request as a %s failure", async (status, failureType) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ error: "שגיאה" }) })
    );

    submitForm();
    await flush();

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("magic_link_request_failed", {
      status_code: status,
      failure_type: failureType,
      is_resend: false,
      locale: undefined,
    });
  });

  it("tracks a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    submitForm();
    await flush();

    expect(track).toHaveBeenCalledWith("magic_link_request_failed", {
      failure_type: "network_error",
      is_resend: false,
      locale: undefined,
    });
  });

  it("tracks resend outcomes as resends", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: "שגיאה" }) })
    );
    submitForm();
    await flush();
    const resend = document.getElementById("resend-btn") as HTMLButtonElement;

    resend.click();
    await flush();
    expect(track).toHaveBeenLastCalledWith("magic_link_requested", {
      is_resend: true,
      next_path: "/",
      locale: undefined,
      after_expired_link: false,
    });

    resend.disabled = false;
    resend.click();
    await flush();
    expect(track).toHaveBeenLastCalledWith("magic_link_request_failed", {
      status_code: 429,
      failure_type: "rate_limited",
      is_resend: true,
      locale: undefined,
    });
  });
});
