import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const scheduleScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/schedule.js"),
  "utf-8"
);

function setupDOM() {
  document.body.innerHTML = `
    <button id="save-schedule-btn">שמרי</button>
    <div id="day-picker">
      <button class="day-btn" data-day="0" data-selected="true" aria-pressed="true">א</button>
    </div>
    <div id="duration-picker">
      <button class="duration-btn" data-duration="45" data-selected="true" aria-pressed="true">45</button>
    </div>
    <input id="time-input" value="17:00" />
    <button id="notify-toggle" data-on="true" aria-checked="true"></button>
    <span id="days-label"></span>
    <span id="summary-text"></span>
  `;
  eval(scheduleScript);
}

function clickSave() {
  (document.getElementById("save-schedule-btn") as HTMLButtonElement).click();
}

describe("schedule.js – save failure handling", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setupDOM();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("disables the button and shows saving text on click", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    clickSave();

    const btn = document.getElementById("save-schedule-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("שומרת...");
  });

  it("restores button text and re-enables after a non-OK response", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false })
    );

    clickSave();
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById("save-schedule-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("שמרי");
    expect(alertSpy).toHaveBeenCalledWith("שגיאה בשמירה, נסי שוב.");
    alertSpy.mockRestore();
  });

  it("restores button text and re-enables after a network failure", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    clickSave();
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById("save-schedule-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("שמרי");
    expect(alertSpy).toHaveBeenCalledWith("שגיאה בשמירה, נסי שוב.");
    alertSpy.mockRestore();
  });
});
