import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const quizScript = readFileSync(
  resolve(__dirname, "../../../../../../public/js/quiz.js"),
  "utf-8"
);
const TOUCH_DOUBLE_TAP_SUPPRESSION_MS = 300;

function slideHTML(index: number, correct: string) {
  return `
    <div class="quiz-slide" data-index="${index}" data-question-id="q${index + 1}" data-topic-id="t1" data-correct="${correct}">
      ${["a", "b", "c", "d"]
        .map(
          (opt, i) => `
        <button class="quiz-option" data-option="${opt}">
          <span class="quiz-option-badge">${["א", "ב", "ג", "ד"][i]}</span>
          <span>אפשרות ${opt}</span>
        </button>`
        )
        .join("")}
    </div>
  `;
}

function setupDOM(opts: { userId?: string; quizMode?: string } = {}) {
  const userAttr = opts.userId ? ` data-user-id="${opts.userId}"` : "";
  const modeAttr = opts.quizMode ? ` data-quiz-mode="${opts.quizMode}"` : "";
  document.body.innerHTML = `
    <main id="quiz-container" data-topic-id="t1" data-total="2"${userAttr}${modeAttr}>
      <div id="quiz-progress-fill"></div>
      <span id="quiz-count"></span>
      ${slideHTML(0, "a")}
      ${slideHTML(1, "b")}
      <div id="quiz-footer">
        <div id="reward-banner">
          <span id="reward-score">0</span>
          <span id="reward-float">+10</span>
          <span id="reward-message"></span>
        </div>
        <button id="quiz-next" disabled>צדקתי?</button>
      </div>
      <div id="quiz-final">
        <span id="final-score"></span>
      </div>
    </main>
  `;
  eval(quizScript);
}

function scoreText() {
  return document.getElementById("reward-score")!.textContent;
}

function messageText() {
  return document.getElementById("reward-message")!.textContent;
}

function floatEl() {
  return document.getElementById("reward-float")!;
}

function clickOption(slideIndex: number, option: string) {
  const slide = document.querySelectorAll(".quiz-slide")[slideIndex]!;
  (slide.querySelector(`[data-option="${option}"]`) as HTMLButtonElement).click();
}

function clickAction() {
  (document.getElementById("quiz-next") as HTMLButtonElement).click();
}

function dispatchActionClick(detail: number) {
  document
    .getElementById("quiz-next")!
    .dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
}

function dispatchPointerAction(pointerType: string, detail: number) {
  const pointerdown = new Event("pointerdown", { bubbles: true });
  Object.defineProperty(pointerdown, "pointerType", { value: pointerType });
  document.getElementById("quiz-next")!.dispatchEvent(pointerdown);
  dispatchActionClick(detail);
}

function dispatchTouchFallbackAction(detail: number) {
  document
    .getElementById("quiz-next")!
    .dispatchEvent(new Event("touchstart", { bubbles: true }));
  dispatchActionClick(detail);
}

function pressActionKey(key: string, repeat: boolean) {
  const action = document.getElementById("quiz-next")!;
  const keydown = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key,
    repeat,
  });

  if (action.dispatchEvent(keydown)) {
    dispatchActionClick(0);
  }
}

describe("quiz.js – reward score and feedback", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    setupDOM();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts with score 0 and an empty feedback message", () => {
    expect(scoreText()).toBe("0");
    expect(messageText()).toBe("");
  });

  it("adds 10 points, shows the correct message, and animates the float on a correct answer", () => {
    clickOption(0, "a");
    clickAction();
    expect(scoreText()).toBe("10");
    expect(messageText()).toBe("יפה מאוד!");
    expect(floatEl().hasAttribute("data-animate")).toBe(true);
  });

  it("removes the float animation attribute when the animation ends", () => {
    clickOption(0, "a");
    clickAction();
    floatEl().dispatchEvent(new Event("animationend"));
    expect(floatEl().hasAttribute("data-animate")).toBe(false);
  });

  it("keeps the score and shows the wrong-answer message on a wrong answer", () => {
    clickOption(0, "b");
    clickAction();
    expect(scoreText()).toBe("0");
    expect(messageText()).toContain("בחרת ב־");
    expect(floatEl().hasAttribute("data-animate")).toBe(false);
  });

  it("clears the message but keeps the score when advancing to the next question", () => {
    clickOption(0, "a");
    clickAction();
    clickAction(); // advance
    expect(messageText()).toBe("");
    expect(scoreText()).toBe("10");
  });

  it("keeps feedback visible when the confirmation click becomes a double-click", () => {
    clickOption(0, "a");

    dispatchActionClick(1);
    dispatchActionClick(2);

    expect(messageText()).toBe("יפה מאוד!");
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("advances on a later distinct mouse activation", () => {
    clickOption(0, "a");
    dispatchPointerAction("mouse", 1);

    expect(
      (document.getElementById("quiz-next") as HTMLButtonElement).disabled
    ).toBe(false);

    dispatchActionClick(2);

    expect(messageText()).toBe("יפה מאוד!");

    dispatchActionClick(1);

    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
    expect(messageText()).toBe("");
  });

  it("advances when confirmation is followed by a keyboard-style activation", () => {
    clickOption(0, "a");
    pressActionKey("Enter", false);

    expect(
      (document.getElementById("quiz-next") as HTMLButtonElement).disabled
    ).toBe(false);

    pressActionKey("Enter", false);

    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
    expect(messageText()).toBe("");
  });

  it("suppresses a rapid second touch tap and advances after the window", () => {
    vi.useFakeTimers();
    clickOption(0, "a");

    dispatchPointerAction("touch", 1);

    const action = document.getElementById("quiz-next") as HTMLButtonElement;
    expect(action.disabled).toBe(true);

    dispatchPointerAction("touch", 1);

    expect(messageText()).toBe("יפה מאוד!");
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");

    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS - 1);
    expect(action.disabled).toBe(true);

    vi.advanceTimersByTime(1);
    expect(action.disabled).toBe(false);

    dispatchPointerAction("touch", 1);

    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("detects touch confirmation through the Safari touch-event fallback", () => {
    vi.useFakeTimers();
    clickOption(0, "a");

    dispatchTouchFallbackAction(1);

    const action = document.getElementById("quiz-next") as HTMLButtonElement;
    expect(action.disabled).toBe(true);

    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS);
    expect(action.disabled).toBe(false);
  });

  it("keeps feedback visible through repeated Enter and advances on a later press", () => {
    clickOption(0, "a");

    pressActionKey("Enter", false);
    pressActionKey("Enter", true);

    expect(messageText()).toBe("יפה מאוד!");
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");

    pressActionKey("Enter", false);

    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
    expect(messageText()).toBe("");
  });

  it("accumulates points across correct answers", () => {
    clickOption(0, "a");
    clickAction();
    clickAction(); // advance to slide 2
    clickOption(1, "b");
    clickAction();
    expect(scoreText()).toBe("20");
  });
});

describe("quiz.js – resume", () => {
  const KEY = "quiz-resume:v1:u1:t1";

  function slideDisplay(index: number) {
    return (document.querySelectorAll(".quiz-slide")[index] as HTMLElement).style.display;
  }

  function fetchCalls(url: string) {
    return (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === url
    );
  }

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves position, score, and points on advance", () => {
    setupDOM({ userId: "u1" });
    clickOption(0, "a");
    clickAction(); // confirm
    clickAction(); // advance
    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved).toMatchObject({ i: 1, score: 1, points: 10, total: 2 });
  });

  it("restores position, score, and points on re-init", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ i: 1, score: 1, points: 10, sessionId: "s-1", total: 2 })
    );
    setupDOM({ userId: "u1" });
    expect(slideDisplay(0)).toBe("none");
    expect(slideDisplay(1)).toBe("flex");
    expect(scoreText()).toBe("10");
  });

  it("reuses the stored session id after a resume", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ i: 1, score: 1, points: 10, sessionId: "s-1", total: 2 })
    );
    setupDOM({ userId: "u1" });
    clickOption(1, "b");
    clickAction(); // confirm → POST /api/quiz
    const body = JSON.parse(fetchCalls("/api/quiz")[0][1].body);
    expect(body.session_id).toBe("s-1");
  });

  it("rejects an out-of-bounds saved index and clears the key", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ i: 5, score: 1, points: 10, sessionId: "s-1", total: 2 })
    );
    setupDOM({ userId: "u1" });
    expect(slideDisplay(0)).toBe("flex");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("rejects saved state when the question set size changed", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ i: 1, score: 1, points: 10, sessionId: "s-1", total: 99 })
    );
    setupDOM({ userId: "u1" });
    expect(slideDisplay(0)).toBe("flex");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("starts fresh without throwing on corrupt saved state", () => {
    localStorage.setItem(KEY, "{not json");
    expect(() => setupDOM({ userId: "u1" })).not.toThrow();
    expect(slideDisplay(0)).toBe("flex");
    expect(scoreText()).toBe("0");
  });

  it("clears the key on completion and still posts progress", () => {
    setupDOM({ userId: "u1" });
    clickOption(0, "a");
    clickAction();
    clickAction();
    clickOption(1, "b");
    clickAction();
    clickAction(); // advance past the last slide → completion
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(fetchCalls("/api/progress")).toHaveLength(1);
  });

  it("never reads or writes resume state in retry mode", () => {
    const seeded = JSON.stringify({ i: 1, score: 1, points: 10, sessionId: "s-1", total: 2 });
    localStorage.setItem(KEY, seeded);
    setupDOM({ userId: "u1", quizMode: "retry" });
    expect(slideDisplay(0)).toBe("flex");
    clickOption(0, "a");
    clickAction();
    clickAction(); // advance — must not touch storage
    expect(localStorage.getItem(KEY)).toBe(seeded);
  });
});
