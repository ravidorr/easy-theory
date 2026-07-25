import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const reportScript = readFileSync(
  resolve(__dirname, "../../../../../../public/js/question-report.js"),
  "utf-8"
);

function setupDOM() {
  document.body.innerHTML = `
    <button class="report-question" data-question-id="q1" data-topic-id="t1" aria-haspopup="dialog">Report</button>
    <button id="other">Other</button>
  `;
  (window as unknown as { __locale: string }).__locale = "ar";
  (window as unknown as { __t: Record<string, string> }).__t = {
    reportTitle: "Report question",
    reportDescription: "Question details are included automatically.",
    reportCommentLabel: "Comment",
    reportCommentPlaceholder: "Tell us more",
    reportCancel: "Cancel",
    reportSend: "Send",
    reportSending: "Sending",
    reportSent: "Sent",
    reportClose: "Done",
    reportError: "Could not send",
  };
  delete (window as unknown as { __questionReportInit?: boolean }).__questionReportInit;
  eval(reportScript);
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("question-report.js", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    setupDOM();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("opens a labelled dialog and restores focus when cancelled with Escape", () => {
    const trigger = document.querySelector(".report-question") as HTMLButtonElement;
    trigger.focus();
    trigger.click();

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog.querySelector("textarea"));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("sends the active question context once and shows the localized success acknowledgement", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response);
    (document.querySelector(".report-question") as HTMLButtonElement).click();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "  Wrong sign  ";
    const send = [...document.querySelectorAll("button")].find((button) => button.textContent === "Send")!;
    send.click();
    send.click();
    await flushAsyncWork();

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "/api/question-reports",
      expect.objectContaining({
        body: JSON.stringify({ question_id: "q1", topic_id: "t1", locale: "ar", comment: "Wrong sign" }),
      })
    );
    expect(document.querySelector(".question-report-success")?.textContent).toBe("Sent");
    expect(document.activeElement?.textContent).toBe("Done");
  });

  it("keeps the typed comment and returns focus to it after a failed request", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: "Network failed" }) } as Response);
    (document.querySelector(".report-question") as HTMLButtonElement).click();
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Need correction";
    [...document.querySelectorAll("button")].find((button) => button.textContent === "Send")!.click();
    await flushAsyncWork();

    expect(textarea.value).toBe("Need correction");
    expect(document.querySelector(".question-report-error")?.textContent).toBe("Network failed");
    expect(document.activeElement).toBe(textarea);
    expect([...document.querySelectorAll("button")].find((button) => button.textContent === "Send")?.disabled).toBe(false);
  });
});
