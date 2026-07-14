import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const bookmarkScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/bookmark.js"),
  "utf-8"
);

function setupDOM(pressed: "true" | "false" = "false") {
  document.body.innerHTML = `
    <div class="quiz-slide">
      <button type="button" class="bookmark-toggle" data-question-id="q1" aria-pressed="${pressed}">
        bookmark
      </button>
      <button id="other-btn">other</button>
    </div>
  `;
  eval(bookmarkScript);
}

function toggleBtn() {
  return document.querySelector(".bookmark-toggle") as HTMLButtonElement;
}

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe("bookmark.js", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pre-creates the polite live region on load so the first error is announced", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    setupDOM("false");

    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.classList.contains("sr-only")).toBe(true);
    expect(liveRegion?.textContent).toBe("");
  });

  it("optimistically presses the toggle and PUTs bookmarked=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    setupDOM("false");

    toggleBtn().click();

    expect(toggleBtn().getAttribute("aria-pressed")).toBe("true");
    expect(fetchMock).toHaveBeenCalledWith("/api/bookmarks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: "q1", bookmarked: true }),
    });
    await flush();
    expect(toggleBtn().getAttribute("aria-pressed")).toBe("true");
  });

  it("PUTs bookmarked=false when un-bookmarking a pressed toggle", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    setupDOM("true");

    toggleBtn().click();

    expect(toggleBtn().getAttribute("aria-pressed")).toBe("false");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bookmarks",
      expect.objectContaining({
        body: JSON.stringify({ question_id: "q1", bookmarked: false }),
      })
    );
  });

  it("reverts the toggle and announces an error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    setupDOM("false");

    toggleBtn().click();
    await flush();

    expect(toggleBtn().getAttribute("aria-pressed")).toBe("false");
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion?.classList.contains("sr-only")).toBe(true);
    expect(liveRegion?.textContent).not.toBe("");
  });

  it("reverts the toggle on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    setupDOM("true");

    toggleBtn().click();
    await flush();

    expect(toggleBtn().getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[aria-live="polite"]')?.textContent).not.toBe("");
  });

  it("ignores clicks while a request is in flight", async () => {
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    setupDOM("false");

    toggleBtn().click();
    toggleBtn().click();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toggleBtn().getAttribute("aria-pressed")).toBe("true");
  });

  it("allows toggling again after the previous request settles", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    setupDOM("false");

    toggleBtn().click();
    await flush();
    toggleBtn().click();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(toggleBtn().getAttribute("aria-pressed")).toBe("false");
  });

  it("does nothing for clicks outside a bookmark toggle", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    setupDOM("false");

    (document.getElementById("other-btn") as HTMLButtonElement).click();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
