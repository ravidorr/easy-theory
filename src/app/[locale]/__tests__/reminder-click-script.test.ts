import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const reminderClickScript = readFileSync(
  resolve(__dirname, "../../../../public/js/reminder-click.js"),
  "utf-8"
);

function land(url: string) {
  window.history.replaceState(null, "", url);
  eval(reminderClickScript);
}

function currentUrl() {
  return window.location.pathname + window.location.search + window.location.hash;
}

describe("reminder-click.js", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
  });

  it("tracks a push reminder click and removes the tag from the URL", () => {
    const track = vi.fn();
    vi.stubGlobal("pendo", { track });

    land("/he?source=study_reminder&channel=push&reminder_date=2026-07-30#top");

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("push_reminder_clicked", {
      channel: "push",
      notification_path: "/he",
      reminder_local_date: "2026-07-30",
    });
    expect(currentUrl()).toBe("/he#top");
  });

  it("reports email reminder clicks and keeps unrelated query parameters", () => {
    const track = vi.fn();
    vi.stubGlobal("pendo", { track });

    land("/ar?tab=1&source=study_reminder&channel=email&reminder_date=2026-07-30");

    expect(track).toHaveBeenCalledWith(
      "push_reminder_clicked",
      expect.objectContaining({ channel: "email", notification_path: "/ar" })
    );
    expect(currentUrl()).toBe("/ar?tab=1");
    expect(JSON.stringify(track.mock.calls)).not.toContain("tab=1");
    expect(JSON.stringify(track.mock.calls)).not.toContain("opened_new_window");
  });

  it("ignores visits that did not come from a reminder", () => {
    const track = vi.fn();
    vi.stubGlobal("pendo", { track });

    land("/he?source=newsletter");

    expect(track).not.toHaveBeenCalled();
    expect(currentUrl()).toBe("/he?source=newsletter");
  });

  it("still removes the tag when the Pendo agent is unavailable", () => {
    land("/he?source=study_reminder&channel=push&reminder_date=2026-07-30");

    expect(currentUrl()).toBe("/he");
  });
});
