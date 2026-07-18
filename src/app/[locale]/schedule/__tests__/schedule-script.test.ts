import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const scheduleScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/schedule.js"),
  "utf-8"
);

function setupDOM() {
  (window as unknown as { __locale?: string }).__locale = "he";
  document.body.innerHTML = `
    <button id="save-schedule-btn">שמרי</button>
    <div id="day-picker">
      <button class="day-btn" data-day="0" data-selected="true" aria-pressed="true">א</button>
      <button class="day-btn" data-day="1" data-selected="false" aria-pressed="false">ב</button>
    </div>
    <div id="duration-picker">
      <button class="duration-btn" data-duration="45" data-selected="true" aria-pressed="true">45</button>
      <button class="duration-btn" data-duration="60" data-selected="false" aria-pressed="false">60</button>
    </div>
    <input id="time-input" value="17:00" />
    <button id="notify-toggle" data-on="true" aria-checked="true"><span></span></button>
    <span id="days-label"></span>
    <span id="summary-text"></span>
  `;
  eval(scheduleScript);
}

function clickSave() {
  (document.getElementById("save-schedule-btn") as HTMLButtonElement).click();
}

function dayBtn(day: number) {
  return document.querySelector(
    `.day-btn[data-day="${day}"]`
  ) as HTMLButtonElement;
}

function durationBtn(duration: number) {
  return document.querySelector(
    `.duration-btn[data-duration="${duration}"]`
  ) as HTMLButtonElement;
}

type PushHelpersStub = {
  subscribeToPush: ReturnType<typeof vi.fn>;
  unsubscribeFromPush: ReturnType<typeof vi.fn>;
};

function stubPushHelpers(): PushHelpersStub {
  const helpers = {
    subscribeToPush: vi.fn().mockResolvedValue(true),
    unsubscribeFromPush: vi.fn().mockResolvedValue(undefined),
  };
  (window as unknown as { pushHelpers?: PushHelpersStub }).pushHelpers = helpers;
  return helpers;
}

function stubModal() {
  const modal = {
    confirm: vi.fn().mockResolvedValue(true),
    alert: vi.fn().mockResolvedValue(undefined),
    toast: vi.fn().mockResolvedValue(undefined),
    dismissAll: vi.fn(),
  };
  vi.stubGlobal("modal", modal);
  return modal;
}

describe("schedule.js – save failure handling", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setupDOM();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as { pushHelpers?: PushHelpersStub }).pushHelpers;
  });

  it("disables the button and shows saving text on click", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    clickSave();

    const btn = document.getElementById("save-schedule-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("שומרים...");
  });

  it("restores button text, re-enables, and shows a modal alert after a non-OK response", async () => {
    const modal = stubModal();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false })
    );

    clickSave();
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById("save-schedule-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("שמרי");
    // Refocused before the alert so the modal restores focus to it on dismiss.
    expect(document.activeElement).toBe(btn);
    expect(modal.alert).toHaveBeenCalledWith({ message: "שגיאה בשמירה, שננסה שוב?" });
  });

  it("restores button text and re-enables after a network failure", async () => {
    const modal = stubModal();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    clickSave();
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById("save-schedule-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("שמרי");
    expect(modal.alert).toHaveBeenCalledWith({ message: "שגיאה בשמירה, שננסה שוב?" });
  });

  it("falls back to window.alert on save failure when modal.js is not loaded", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    clickSave();
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById("save-schedule-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("שמרי");
    expect(alertSpy).toHaveBeenCalledWith("שגיאה בשמירה, שננסה שוב?");
    alertSpy.mockRestore();
  });
});

describe("schedule.js – pickers and notify toggle", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setupDOM();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as { pushHelpers?: PushHelpersStub }).pushHelpers;
  });

  it("deselects a selected day and updates the summary", () => {
    dayBtn(0).click();

    expect(dayBtn(0).dataset.selected).toBe("false");
    expect(dayBtn(0).getAttribute("aria-pressed")).toBe("false");
    expect(document.getElementById("days-label")!.textContent).toBe(
      "טרם נבחרו ימים"
    );
    expect(document.getElementById("summary-text")!.textContent).toBe(
      "נבחר ימים כדי להתחיל"
    );
  });

  it("selects an unselected day and updates the summary", () => {
    dayBtn(1).click();

    expect(dayBtn(1).dataset.selected).toBe("true");
    expect(dayBtn(1).getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById("days-label")!.textContent).toBe(
      "נבחרו 2 ימים"
    );
    expect(document.getElementById("summary-text")!.textContent).toBe(
      "2 מפגשים בשבוע, 45 דק׳ כל אחד"
    );
  });

  it("moves the duration selection and reflects it in the summary", () => {
    durationBtn(60).click();

    expect(durationBtn(60).dataset.selected).toBe("true");
    expect(durationBtn(60).getAttribute("aria-pressed")).toBe("true");
    expect(durationBtn(45).dataset.selected).toBe("false");
    expect(durationBtn(45).getAttribute("aria-pressed")).toBe("false");
    expect(document.getElementById("summary-text")!.textContent).toBe(
      "1 מפגשים בשבוע, 60 דק׳ כל אחד"
    );
  });

  it("flips the notify toggle state on click", () => {
    const toggle = document.getElementById("notify-toggle") as HTMLButtonElement;
    toggle.click();

    expect(toggle.dataset.on).toBe("false");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(
      (toggle.querySelector("span") as HTMLSpanElement).style.insetInlineStart
    ).toBe("3px");
  });

  it("unsubscribes from push when notifications are turned off", () => {
    const helpers = stubPushHelpers();

    (document.getElementById("notify-toggle") as HTMLButtonElement).click();
    expect(helpers.unsubscribeFromPush).toHaveBeenCalledTimes(1);

    (document.getElementById("notify-toggle") as HTMLButtonElement).click();
    expect(helpers.unsubscribeFromPush).toHaveBeenCalledTimes(1);
  });
});

describe("schedule.js – successful save", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setupDOM();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (window as unknown as { pushHelpers?: PushHelpersStub }).pushHelpers;
  });

  it("shows a modal alert and skips the request when no days are selected", () => {
    const modal = stubModal();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    dayBtn(0).click();
    clickSave();

    expect(modal.alert).toHaveBeenCalledWith({ message: "נבחר לפחות יום אחד ללימוד." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to window.alert when no days are selected and modal.js is not loaded", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    dayBtn(0).click();
    clickSave();

    expect(alertSpy).toHaveBeenCalledWith("נבחר לפחות יום אחד ללימוד.");
    expect(fetchMock).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("PUTs the schedule, shows saved text, and redirects back to More without modal.js", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const loc = { href: "" };
    Object.defineProperty(window, "location", {
      value: loc,
      writable: true,
      configurable: true,
    });

    dayBtn(1).click();
    durationBtn(60).click();
    clickSave();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith("/api/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        days: [0, 1],
        start_time: "17:00",
        duration_minutes: 60,
        notify: true,
      }),
    });
    const btn = document.getElementById("save-schedule-btn") as HTMLButtonElement;
    expect(btn.textContent).toBe("נשמר!");
    expect(btn.disabled).toBe(true);
    expect(loc.href).toBe("");

    await vi.advanceTimersByTimeAsync(800);
    expect(loc.href).toBe("/he/more");
  });

  it("shows a success toast and still redirects on time even if it never settles", async () => {
    vi.useFakeTimers();
    const modal = stubModal();
    // Navigation must not depend on the toast promise (it can resolve early
    // when replaced, or never settle).
    modal.toast.mockReturnValue(new Promise<void>(() => {}));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const loc = { href: "" };
    Object.defineProperty(window, "location", {
      value: loc,
      writable: true,
      configurable: true,
    });

    clickSave();
    await vi.advanceTimersByTimeAsync(0);

    expect(modal.toast).toHaveBeenCalledWith({ message: "התוכנית נשמרה!" });
    expect(loc.href).toBe("");

    await vi.advanceTimersByTimeAsync(800);
    expect(loc.href).toBe("/he/more");
  });

  it("saves schedule before subscribing to push when notifications are on", async () => {
    const helpers = stubPushHelpers();
    let resolvePush: (value: boolean) => void = () => {};
    helpers.subscribeToPush.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolvePush = resolve;
      })
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    clickSave();
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(helpers.subscribeToPush).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(
      helpers.subscribeToPush.mock.invocationCallOrder[0]
    );

    resolvePush(false);
    await new Promise((r) => setTimeout(r, 0));
  });

  it("still saves when push permission never resolves", async () => {
    vi.useFakeTimers();
    const helpers = stubPushHelpers();
    helpers.subscribeToPush.mockReturnValue(new Promise(() => {}));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const loc = { href: "" };
    Object.defineProperty(window, "location", {
      value: loc,
      writable: true,
      configurable: true,
    });

    clickSave();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith("/api/schedule", expect.any(Object));
    const btn = document.getElementById("save-schedule-btn") as HTMLButtonElement;
    expect(btn.textContent).toBe("נשמר!");
    await vi.advanceTimersByTimeAsync(800);
    expect(loc.href).toBe("/he/more");
    vi.useRealTimers();
  });

  it("skips the push subscription when notifications are off", async () => {
    const helpers = stubPushHelpers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    (document.getElementById("notify-toggle") as HTMLButtonElement).click();
    clickSave();
    await new Promise((r) => setTimeout(r, 0));

    expect(helpers.subscribeToPush).not.toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.notify).toBe(false);
  });

  it("redirects to the active locale More page after save", async () => {
    vi.useFakeTimers();
    (window as unknown as { __locale?: string }).__locale = "ar";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const loc = { href: "" };
    Object.defineProperty(window, "location", {
      value: loc,
      writable: true,
      configurable: true,
    });

    clickSave();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(800);
    expect(loc.href).toBe("/ar/more");
    vi.useRealTimers();
  });
});
