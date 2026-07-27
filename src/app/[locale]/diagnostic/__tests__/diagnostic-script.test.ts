import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const diagnosticScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/diagnostic.js"),
  "utf-8"
);

function setupDOM(authenticated = false) {
  document.body.innerHTML = `
    <main id="diagnostic" data-authenticated="${authenticated}">
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
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

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

  it("moves a pending legacy diagnostic to the new storage key before submitting it", async () => {
    setupDOM(true);
    const payload = {
      answers: Array.from({ length: 12 }, (_, index) => ({
        question_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        selected_option: "a",
      })),
      target_exam_date: null,
    };
    localStorage.setItem("clearroad:diagnostic:v1", JSON.stringify(payload));
    let resolveFetch: (value: { ok: boolean; json: () => Promise<{ saved: boolean }> }) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<{ ok: boolean; json: () => Promise<{ saved: boolean }> }>(
            (resolve) => {
              resolveFetch = resolve;
            }
          )
      )
    );

    eval(diagnosticScript);

    expect(localStorage.getItem("clearroad:diagnostic:v1")).toBeNull();
    expect(localStorage.getItem("easyInTheory:diagnostic:v1")).toBe(JSON.stringify(payload));

    resolveFetch!({ ok: true, json: async () => ({ saved: true }) });
    await flushPromises();
    expect(localStorage.getItem("easyInTheory:diagnostic:v1")).toBeNull();
  });
});
