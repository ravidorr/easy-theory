import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const examScript = readFileSync(
  resolve(__dirname, "../../../../../../public/js/exam.js"),
  "utf-8"
);

function slideHTML(index: number) {
  return `
    <div class="quiz-slide" data-index="${index}" data-question-id="q${index + 1}">
      ${["a", "b", "c", "d"]
        .map(
          (opt, i) => `
        <button class="quiz-option" data-option="${opt}" aria-pressed="false">
          <span class="quiz-option-badge">${["א", "ב", "ג", "ד"][i]}</span>
          <span>אפשרות ${opt}</span>
        </button>`
        )
        .join("")}
    </div>
  `;
}

function setupDOM({ total = 3, durationSeconds = 2400 } = {}) {
  document.body.innerHTML = `
    <main id="exam-container" data-total="${total}" data-duration-seconds="${durationSeconds}" data-pass-mark="26">
      <div id="exam-progress-fill"></div>
      <span id="exam-timer"></span>
      <span id="exam-count"></span>
      ${Array.from({ length: total }, (_, i) => slideHTML(i)).join("")}
      <div id="exam-footer">
        <div id="exam-error" hidden></div>
        <span id="exam-answered"></span>
        <button id="exam-prev" disabled>הקודמת</button>
        <button id="exam-next">הבאה</button>
        <button id="exam-submit">הגשת המבחן</button>
      </div>
      <div id="exam-result" style="display: none">
        <h2 id="exam-result-title"></h2>
        <span id="exam-result-score"></span>
        <button id="exam-review-btn">סקירת התשובות</button>
      </div>
    </main>
  `;
  eval(examScript);
}

function slide(index: number) {
  return document.querySelectorAll<HTMLElement>(".quiz-slide")[index]!;
}

function clickOption(slideIndex: number, option: string) {
  (slide(slideIndex).querySelector(`[data-option="${option}"]`) as HTMLButtonElement).click();
}

function prevBtn() {
  return document.getElementById("exam-prev") as HTMLButtonElement;
}

function nextBtn() {
  return document.getElementById("exam-next") as HTMLButtonElement;
}

function submitBtn() {
  return document.getElementById("exam-submit") as HTMLButtonElement;
}

function resultScreen() {
  return document.getElementById("exam-result") as HTMLElement;
}

function passResponse(overrides = {}) {
  return {
    score: 3,
    total: 3,
    passed: true,
    pass_mark: 26,
    results: [
      { question_id: "q1", selected_option: "a", correct_option: "a", is_correct: true },
      { question_id: "q2", selected_option: "b", correct_option: "b", is_correct: true },
      { question_id: "q3", selected_option: "c", correct_option: "c", is_correct: true },
    ],
    ...overrides,
  };
}

function mockFetch(response: object = passResponse(), ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => response });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function stubModal(confirmResult = false) {
  const modal = {
    confirm: vi.fn().mockResolvedValue(confirmResult),
    alert: vi.fn().mockResolvedValue(undefined),
    dismissAll: vi.fn(),
  };
  vi.stubGlobal("modal", modal);
  return modal;
}

describe("exam.js – answering and navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch();
    setupDOM();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("marks the clicked option as selected and updates the answered counter", () => {
    clickOption(0, "b");
    const options = slide(0).querySelectorAll<HTMLElement>(".quiz-option");
    expect(options[1].dataset.state).toBe("selected");
    expect(document.getElementById("exam-answered")!.textContent).toContain("1");
  });

  it("lets the user change an answer before submitting", () => {
    clickOption(0, "a");
    clickOption(0, "c");
    const options = slide(0).querySelectorAll<HTMLElement>(".quiz-option");
    expect(options[0].dataset.state).toBe("");
    expect(options[2].dataset.state).toBe("selected");
    expect(document.getElementById("exam-answered")!.textContent).toContain("1");
  });

  it("keeps aria-pressed in sync with the selected option", () => {
    clickOption(0, "a");
    clickOption(0, "c");
    const options = slide(0).querySelectorAll<HTMLElement>(".quiz-option");
    expect(options[2].getAttribute("aria-pressed")).toBe("true");
    expect(options[0].getAttribute("aria-pressed")).toBe("false");
    expect(options[1].getAttribute("aria-pressed")).toBe("false");
    expect(options[3].getAttribute("aria-pressed")).toBe("false");
  });

  it("navigates forward and back between slides", () => {
    expect(slide(0).style.display).toBe("flex");
    expect(prevBtn().disabled).toBe(true);

    nextBtn().click();
    expect(slide(0).style.display).toBe("none");
    expect(slide(1).style.display).toBe("flex");
    expect(prevBtn().disabled).toBe(false);

    prevBtn().click();
    expect(slide(0).style.display).toBe("flex");
  });

  it("hides next and shows submit on the last slide", () => {
    nextBtn().click();
    nextBtn().click();
    expect(nextBtn().style.display).toBe("none");
    expect(submitBtn().style.display).toBe("inline-flex");
  });

  it("shows submit from anywhere once all questions are answered", () => {
    expect(submitBtn().style.display).toBe("none");
    clickOption(0, "a");
    nextBtn().click();
    clickOption(1, "b");
    prevBtn().click();
    // Answer the last slide's question directly in the DOM (slides are all rendered).
    clickOption(2, "c");
    expect(submitBtn().style.display).toBe("inline-flex");
  });
});

describe("exam.js – submit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("submits all answers in a single POST to /api/exam", async () => {
    const fetchMock = mockFetch();
    setupDOM();
    clickOption(0, "a");
    clickOption(1, "b");
    clickOption(2, "c");
    submitBtn().click();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/exam");
    const body = JSON.parse(options.body);
    expect(body.answers).toEqual([
      { question_id: "q1", selected_option: "a" },
      { question_id: "q2", selected_option: "b" },
      { question_id: "q3", selected_option: "c" },
    ]);
    expect(typeof body.duration_seconds).toBe("number");
  });

  it("asks for confirmation via the modal when submitting with unanswered questions", async () => {
    const fetchMock = mockFetch();
    const modal = stubModal(false);
    setupDOM();
    clickOption(0, "a");
    nextBtn().click();
    nextBtn().click();
    submitBtn().click();
    await flushPromises();

    expect(modal.confirm).toHaveBeenCalledTimes(1);
    expect(modal.confirm).toHaveBeenCalledWith({ message: expect.stringContaining("2") });
    expect(fetchMock).not.toHaveBeenCalled();

    modal.confirm.mockResolvedValue(true);
    submitBtn().click();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to window.confirm when modal.js is not loaded", async () => {
    const fetchMock = mockFetch();
    const confirmMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirmMock);
    setupDOM();
    clickOption(0, "a");
    nextBtn().click();
    nextBtn().click();
    submitBtn().click();
    await flushPromises();

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    confirmMock.mockReturnValue(true);
    submitBtn().click();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not double-submit when confirming after the timer already submitted", async () => {
    const fetchMock = mockFetch();
    let resolveConfirm: (value: boolean) => void = () => {};
    const modal = {
      confirm: vi.fn().mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveConfirm = resolve;
        })
      ),
      alert: vi.fn().mockResolvedValue(undefined),
      dismissAll: vi.fn(),
    };
    vi.stubGlobal("modal", modal);
    setupDOM({ durationSeconds: 3 });
    clickOption(0, "a");
    submitBtn().click();

    // Time runs out while the confirm dialog is still open.
    vi.advanceTimersByTime(3000);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The stale confirm dialog is closed when the results render.
    expect(modal.dismissAll).toHaveBeenCalled();

    resolveConfirm(true);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the pass result screen and decorates slides", async () => {
    mockFetch(
      passResponse({
        score: 2,
        passed: false,
        results: [
          { question_id: "q1", selected_option: "a", correct_option: "a", is_correct: true },
          { question_id: "q2", selected_option: "b", correct_option: "d", is_correct: false },
        ],
      })
    );
    setupDOM();
    clickOption(0, "a");
    clickOption(1, "b");
    clickOption(2, "c");
    submitBtn().click();
    await flushPromises();

    expect(resultScreen().style.display).toBe("flex");
    expect(document.getElementById("exam-footer")!.style.display).toBe("none");
    expect(document.getElementById("exam-container")!.getAttribute("data-passed")).toBe("false");
    expect(document.getElementById("exam-result-title")!.textContent).not.toBe("");
    expect(document.getElementById("exam-result-score")!.textContent).toContain("2");

    // Slide decoration: q2 selected b (wrong), correct d.
    const q2Options = slide(1).querySelectorAll<HTMLButtonElement>(".quiz-option");
    expect(q2Options[1].dataset.state).toBe("wrong");
    expect(q2Options[3].dataset.state).toBe("correct");
    expect([...q2Options].every((o) => o.disabled)).toBe(true);

    // Screen-reader result text mirrors the color-only data-state.
    expect(q2Options[1].querySelector(".quiz-option-sr")!.textContent).toBe("תשובה שגויה");
    expect(q2Options[3].querySelector(".quiz-option-sr")!.textContent).toBe("תשובה נכונה");
    expect(q2Options[0].querySelector(".quiz-option-sr")).toBeNull();
    // The chosen option stays aria-pressed after decoration.
    expect(q2Options[1].getAttribute("aria-pressed")).toBe("true");
  });

  it("shows an error and allows retry when the POST fails", async () => {
    const fetchMock = mockFetch({}, false);
    setupDOM();
    clickOption(0, "a");
    clickOption(1, "b");
    clickOption(2, "c");
    submitBtn().click();
    await flushPromises();

    const errorEl = document.getElementById("exam-error")!;
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).not.toBe("");
    expect(submitBtn().disabled).toBe(false);
    expect(resultScreen().style.display).toBe("none");

    // Retry succeeds.
    fetchMock.mockResolvedValue({ ok: true, json: async () => passResponse() });
    submitBtn().click();
    await flushPromises();
    expect(resultScreen().style.display).toBe("flex");
  });

  it("re-shows slides read-only in review mode", async () => {
    mockFetch();
    setupDOM();
    clickOption(0, "a");
    clickOption(1, "b");
    clickOption(2, "c");
    submitBtn().click();
    await flushPromises();

    (document.getElementById("exam-review-btn") as HTMLButtonElement).click();
    expect(resultScreen().style.display).toBe("none");
    expect(slide(0).style.display).toBe("flex");
    expect(submitBtn().style.display).toBe("none");

    // Options stay locked: clicking doesn't change state or counter.
    clickOption(0, "d");
    const options = slide(0).querySelectorAll<HTMLElement>(".quiz-option");
    expect(options[3].dataset.state).not.toBe("selected");
  });
});

describe("exam.js – timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("counts down every second", () => {
    mockFetch();
    setupDOM({ durationSeconds: 2400 });
    vi.advanceTimersByTime(1000);
    expect(document.getElementById("exam-timer")!.textContent).toBe("39:59");
    vi.advanceTimersByTime(59_000);
    expect(document.getElementById("exam-timer")!.textContent).toBe("39:00");
  });

  it("marks the timer with a warning under five minutes", () => {
    mockFetch();
    setupDOM({ durationSeconds: 301 });
    const timer = document.getElementById("exam-timer")!;
    expect(timer.hasAttribute("data-warning")).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(timer.hasAttribute("data-warning")).toBe(true);
  });

  it("auto-submits when time runs out, without a confirm dialog", async () => {
    const fetchMock = mockFetch(passResponse({ score: 1, passed: false }));
    const confirmMock = vi.fn();
    vi.stubGlobal("confirm", confirmMock);
    const modal = stubModal();
    setupDOM({ durationSeconds: 3 });
    clickOption(0, "a");

    vi.advanceTimersByTime(3000);
    await flushPromises();

    expect(confirmMock).not.toHaveBeenCalled();
    expect(modal.confirm).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.answers).toEqual([{ question_id: "q1", selected_option: "a" }]);
    expect(resultScreen().style.display).toBe("flex");
    // The time-up note is appended to the score line.
    expect(document.getElementById("exam-result-score")!.textContent).toContain("·");
  });

  it("does not submit twice when time expires after a manual submit", async () => {
    const fetchMock = mockFetch();
    setupDOM({ durationSeconds: 5 });
    clickOption(0, "a");
    clickOption(1, "b");
    clickOption(2, "c");
    submitBtn().click();
    await flushPromises();

    vi.advanceTimersByTime(10_000);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
