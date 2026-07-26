import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const diagnosticScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/diagnostic.js"),
  "utf-8"
);

function setupDOM() {
  document.body.innerHTML = `
    <main id="diagnostic" data-authenticated="false">
      <input id="diagnostic-target-date" />
      <form id="diagnostic-form">
        ${Array.from({ length: 12 }, (_, index) => `<fieldset data-question-id="00000000-0000-4000-8000-${String(index).padStart(12, "0")}"><input type="radio" value="a" checked /></fieldset>`).join("")}
      </form>
      <div id="diagnostic-result" hidden></div>
    </main>
  `;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("diagnostic script", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses localized success and failure feedback", async () => {
    setupDOM();
    vi.stubGlobal("__t", {
      saved: "تم حفظ الخطة.",
      guestReady: "التشخيص جاهز.",
      saveError: "تعذر الحفظ.",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: false }) }));
    eval(diagnosticScript);
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(document.getElementById("diagnostic-result")?.textContent).toBe("التشخيص جاهز.");

    setupDOM();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    eval(diagnosticScript);
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(document.getElementById("diagnostic-result")?.textContent).toBe("تعذر الحفظ.");
  });
});
