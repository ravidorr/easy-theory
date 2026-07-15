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
        <button class="quiz-option" data-option="${opt}" aria-pressed="false">
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

function actionButton() {
  return document.getElementById("quiz-next") as HTMLButtonElement;
}

function errorResponse(status: number, error: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error }),
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("quiz.js – rejected answer persistence", () => {
  function fetchCalls(url: string) {
    return (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === url
    );
  }

  beforeEach(() => {
    localStorage.clear();
    (
      window as unknown as {
        __t: Record<string, string>;
      }
    ).__t = {
      savingAnswer: "שומרים...",
      saveAnswerError: "לא הצלחנו לשמור את התשובה. אפשר לנסות שוב.",
      retryAnswerBtn: "לנסות שוב",
      restartQuizBtn: "התחלה מחדש",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses secure random bytes when randomUUID is unavailable", async () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: bytes.length }, (_, index) => index));
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    setupDOM();

    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    const requestBody = JSON.parse(fetchCalls("/api/quiz")[0][1].body);
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(requestBody.session_id).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(requestBody.idempotency_key).toBe(
      "00010203-0405-4607-8809-0a0b0c0d0e0f:q1"
    );
    expect(Math.random).not.toHaveBeenCalled();
  });

  it("keeps the question open after a non-ok response and retries the same answer once", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(errorResponse(500, "שמירת התשובה נכשלה"))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    );
    setupDOM();

    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    expect(messageText()).toBe("שמירת התשובה נכשלה");
    expect(actionButton().textContent).toBe("לנסות שוב");
    expect(actionButton().disabled).toBe(false);

    clickAction();
    await flushAsyncWork();

    expect(fetchCalls("/api/quiz")).toHaveLength(2);
    expect(fetchCalls("/api/quiz")[1][1].body).toBe(
      fetchCalls("/api/quiz")[0][1].body
    );
    const requestBody = JSON.parse(fetchCalls("/api/quiz")[0][1].body);
    expect(requestBody.idempotency_key).toEqual(expect.any(String));
    expect(requestBody.idempotency_key.length).toBeGreaterThan(0);
    expect(scoreText()).toBe("10");
    expect(actionButton().textContent).toBe("לשאלה הבאה");
  });

  it.each([400, 404, 409])(
    "stops retrying permanent %i responses and clears invalid resume state",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(errorResponse(status, "שגיאת API מקומית"))
      );
      setupDOM({ userId: "u1" });

      clickOption(0, "a");
      clickAction();
      await flushAsyncWork();

      expect(messageText()).toBe("שגיאת API מקומית");
      expect(actionButton().textContent).toBe("התחלה מחדש");
      expect(actionButton().disabled).toBe(false);
      expect(localStorage.getItem("quiz-resume:v1:u1:t1")).toBeNull();
      expect(fetchCalls("/api/quiz")).toHaveLength(1);
    }
  );

  it("shows a localized authentication error without resubmitting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(errorResponse(401, "לא מחוברת"))
    );
    setupDOM({ userId: "u1" });

    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    expect(messageText()).toBe("לא מחוברת");
    expect(actionButton().textContent).toBe("התחלה מחדש");
    expect(localStorage.getItem("quiz-resume:v1:u1:t1")).toBeNull();
    expect(fetchCalls("/api/quiz")).toHaveLength(1);
  });

  it.each([429, 500])(
    "keeps localized %i failures retryable",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(errorResponse(status, "שגיאה זמנית מקומית"))
          .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      );
      setupDOM();

      clickOption(0, "a");
      clickAction();
      await flushAsyncWork();

      expect(messageText()).toBe("שגיאה זמנית מקומית");
      expect(actionButton().textContent).toBe("לנסות שוב");

      clickAction();
      await flushAsyncWork();

      expect(fetchCalls("/api/quiz")).toHaveLength(2);
      expect(actionButton().textContent).toBe("לשאלה הבאה");
    }
  );

  it.each([
    [400, "התחלה מחדש"],
    [500, "לנסות שוב"],
  ])(
    "falls back safely when a %i error body is malformed",
    async (status, expectedAction) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => {
            throw new SyntaxError("invalid json");
          },
        })
      );
      setupDOM({ userId: "u1" });

      clickOption(0, "a");
      clickAction();
      await flushAsyncWork();

      expect(messageText()).toBe("לא הצלחנו לשמור את התשובה. אפשר לנסות שוב.");
      expect(actionButton().textContent).toBe(expectedAction);
      if (status === 400) {
        expect(localStorage.getItem("quiz-resume:v1:u1:t1")).toBeNull();
      } else {
        expect(localStorage.getItem("quiz-resume:v1:u1:t1")).toEqual(
          expect.any(String)
        );
      }
    }
  );

  it("preserves topic completion and medal feedback when a retry recovers a committed answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("response lost"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            topic_completed: true,
            medals_earned: ["streak-3"],
          }),
        })
    );
    setupDOM();

    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();
    clickAction();
    await flushAsyncWork();

    expect(messageText()).toBe("כל הכבוד! סיימת את כל הנושא!");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(scoreText()).toBe("10");
    expect(fetchCalls("/api/quiz")[1][1].body).toBe(
      fetchCalls("/api/quiz")[0][1].body
    );
  });

  it("shows a retry action after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    setupDOM();

    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    expect(messageText()).toBe("לא הצלחנו לשמור את התשובה. אפשר לנסות שוב.");
    expect(actionButton().textContent).toBe("לנסות שוב");
    expect(actionButton().disabled).toBe(false);
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("does not allow advancing while answer persistence is pending", async () => {
    let resolveRequest!: (response: {
      ok: boolean;
      json: () => Promise<object>;
    }) => void;
    const pendingRequest = new Promise<{
      ok: boolean;
      json: () => Promise<object>;
    }>((resolve) => {
      resolveRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendingRequest));
    setupDOM();

    clickOption(0, "a");
    clickAction();

    expect(actionButton().disabled).toBe(true);
    clickAction();
    expect(fetchCalls("/api/quiz")).toHaveLength(1);
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");

    resolveRequest({ ok: true, json: async () => ({}) });
    await flushAsyncWork();

    expect(actionButton().disabled).toBe(false);
    expect(actionButton().textContent).toBe("לשאלה הבאה");
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("does not post completion after the final answer is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValue(errorResponse(500, "שמירת התשובה נכשלה"))
    );
    setupDOM();

    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();
    clickAction();
    clickOption(1, "b");
    clickAction();
    await flushAsyncWork();
    clickAction();
    await flushAsyncWork();

    expect(fetchCalls("/api/progress")).toHaveLength(0);
    expect(document.getElementById("quiz-final")!.style.display).not.toBe(
      "flex"
    );
    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("does not advance past a question until its submission succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(errorResponse(429, "יותר מדי בקשות"))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    );
    setupDOM();

    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");
    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("none");

    clickAction();
    await flushAsyncWork();
    clickAction();

    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
  });
});

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

  it("clears the message but keeps the score when advancing to the next question", async () => {
    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();
    clickAction(); // advance
    expect(messageText()).toBe("");
    expect(scoreText()).toBe("10");
  });

  it("keeps feedback visible for one mouse multi-click and advances on a later click", async () => {
    clickOption(0, "a");

    dispatchActionClick(1);
    await flushAsyncWork();
    dispatchActionClick(2);

    expect(messageText()).toBe("יפה מאוד!");
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");

    dispatchActionClick(1);

    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("keeps feedback visible through repeated Enter and advances on a later press", async () => {
    clickOption(0, "a");

    pressActionKey("Enter", false);
    await flushAsyncWork();
    pressActionKey("Enter", true);

    expect(messageText()).toBe("יפה מאוד!");
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");

    pressActionKey("Enter", false);

    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("keeps a successful touch confirmation disabled for the suppression window", async () => {
    vi.useFakeTimers();
    clickOption(0, "a");

    dispatchPointerAction("touch", 1);
    await flushAsyncWork();

    expect(actionButton().disabled).toBe(true);
    dispatchPointerAction("touch", 1);
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");

    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS);
    expect(actionButton().disabled).toBe(false);

    dispatchPointerAction("touch", 1);
    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("keeps recovered feedback visible after a touch retry double-tap", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(errorResponse(500, "שמירת התשובה נכשלה"))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    );
    setupDOM();
    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    dispatchPointerAction("touch", 1);
    await flushAsyncWork();
    dispatchPointerAction("touch", 1);

    expect(messageText()).toBe("יפה מאוד!");
    expect(actionButton().disabled).toBe(true);
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");

    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS);
    expect(actionButton().disabled).toBe(false);

    dispatchPointerAction("touch", 1);
    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("keeps a failed touch retry disabled until its suppression window expires", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(errorResponse(500, "שמירת התשובה נכשלה"))
        .mockResolvedValueOnce(errorResponse(500, "שמירת התשובה נכשלה שוב"))
    );
    setupDOM();
    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    dispatchPointerAction("touch", 1);
    await flushAsyncWork();

    expect(messageText()).toBe("שמירת התשובה נכשלה שוב");
    expect(actionButton().disabled).toBe(true);

    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS);

    expect(actionButton().disabled).toBe(false);
    expect(actionButton().textContent).toBe("לנסות שוב");
  });

  it("does not let the touch timeout override pending persistence", async () => {
    vi.useFakeTimers();
    let resolveRequest!: (response: {
      ok: boolean;
      json: () => Promise<object>;
    }) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
      )
    );
    setupDOM();
    clickOption(0, "a");

    dispatchPointerAction("touch", 1);
    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS);

    expect(actionButton().disabled).toBe(true);
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");

    resolveRequest({ ok: true, json: async () => ({}) });
    await flushAsyncWork();

    expect(actionButton().disabled).toBe(false);
    expect(actionButton().textContent).toBe("לשאלה הבאה");
  });

  it("uses the touchstart fallback to suppress Safari-style double taps", async () => {
    vi.useFakeTimers();
    clickOption(0, "a");

    dispatchTouchFallbackAction(1);
    await flushAsyncWork();

    expect(actionButton().disabled).toBe(true);
    dispatchTouchFallbackAction(1);
    expect(
      (document.querySelectorAll(".quiz-slide")[0] as HTMLElement).style.display
    ).toBe("flex");

    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS);
    dispatchTouchFallbackAction(1);

    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("keeps programmatic activations immediate", async () => {
    clickOption(0, "a");

    dispatchActionClick(0);
    await flushAsyncWork();

    expect(actionButton().disabled).toBe(false);
    dispatchActionClick(0);

    expect(
      (document.querySelectorAll(".quiz-slide")[1] as HTMLElement).style.display
    ).toBe("flex");
  });

  it("accumulates points across correct answers", async () => {
    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();
    clickAction(); // advance to slide 2
    clickOption(1, "b");
    clickAction();
    expect(scoreText()).toBe("20");
  });
});

describe("quiz.js – assistive tech state", () => {
  function option(slideIndex: number, opt: string) {
    const slide = document.querySelectorAll(".quiz-slide")[slideIndex]!;
    return slide.querySelector(`[data-option="${opt}"]`) as HTMLButtonElement;
  }

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    setupDOM();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets aria-pressed on the clicked option and clears it on its siblings", () => {
    clickOption(0, "b");
    expect(option(0, "b").getAttribute("aria-pressed")).toBe("true");
    ["a", "c", "d"].forEach((opt) => {
      expect(option(0, opt).getAttribute("aria-pressed")).toBe("false");
    });

    clickOption(0, "c");
    expect(option(0, "c").getAttribute("aria-pressed")).toBe("true");
    expect(option(0, "b").getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps the chosen option aria-pressed after confirmation", () => {
    clickOption(0, "b");
    clickAction();
    expect(option(0, "b").getAttribute("aria-pressed")).toBe("true");
    expect(option(0, "b").disabled).toBe(true);
  });

  it("adds screen-reader result text to the correct and wrong options on confirm", () => {
    clickOption(0, "b"); // correct is "a"
    clickAction();
    expect(option(0, "a").querySelector(".quiz-option-sr")!.textContent).toBe("תשובה נכונה");
    expect(option(0, "b").querySelector(".quiz-option-sr")!.textContent).toBe("תשובה שגויה");
    expect(option(0, "c").querySelector(".quiz-option-sr")).toBeNull();
  });

  it("marks only the correct option when the answer is right", () => {
    clickOption(0, "a");
    clickAction();
    expect(option(0, "a").querySelector(".quiz-option-sr")!.textContent).toBe("תשובה נכונה");
    ["b", "c", "d"].forEach((opt) => {
      expect(option(0, opt).querySelector(".quiz-option-sr")).toBeNull();
    });
  });

  it("does not duplicate screen-reader result spans", () => {
    clickOption(0, "a");
    clickAction();
    clickAction(); // advance
    clickOption(1, "b");
    clickAction();
    document.querySelectorAll(".quiz-option").forEach((o) => {
      expect(o.querySelectorAll(".quiz-option-sr").length).toBeLessThanOrEqual(1);
    });
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

  it("saves position, score, and points on advance", async () => {
    setupDOM({ userId: "u1" });
    clickOption(0, "a");
    clickAction(); // confirm
    await flushAsyncWork();
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

  it("restores a response-lost submission and reuses its answer and idempotency key", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    setupDOM({ userId: "u1" });

    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    const firstBody = JSON.parse(fetchCalls("/api/quiz")[0][1].body);
    const pendingState = JSON.parse(localStorage.getItem(KEY)!);
    expect(pendingState).toMatchObject({
      i: 0,
      score: 1,
      points: 10,
      pendingSubmission: {
        questionId: "q1",
        selectedOption: "a",
        idempotencyKey: firstBody.idempotency_key,
      },
    });

    setupDOM({ userId: "u1" });

    expect(scoreText()).toBe("10");
    expect(actionButton().textContent).toBe("לנסות שוב");
    expect(actionButton().disabled).toBe(false);
    clickAction();
    await flushAsyncWork();

    const secondBody = JSON.parse(fetchCalls("/api/quiz")[1][1].body);
    expect(secondBody.selected_option).toBe(firstBody.selected_option);
    expect(secondBody.idempotency_key).toBe(firstBody.idempotency_key);
    expect(scoreText()).toBe("10");
    expect(actionButton().textContent).toBe("לשאלה הבאה");
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({
      pendingSubmission: null,
    });
  });

  it("restores an acknowledged correct answer without rescoring or reposting it", async () => {
    setupDOM({ userId: "u1" });
    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    expect(fetchCalls("/api/quiz")).toHaveLength(1);
    setupDOM({ userId: "u1" });

    expect(scoreText()).toBe("10");
    expect(messageText()).toBe("יפה מאוד!");
    expect(actionButton().textContent).toBe("לשאלה הבאה");
    expect(actionButton().disabled).toBe(false);
    expect(fetchCalls("/api/quiz")).toHaveLength(1);

    clickAction();
    expect(slideDisplay(1)).toBe("flex");
    expect(fetchCalls("/api/quiz")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({
      i: 1,
      score: 1,
      points: 10,
    });

    clickOption(1, "b");
    clickAction();
    await flushAsyncWork();
    clickAction();

    expect(fetchCalls("/api/quiz")).toHaveLength(2);
    const progressBody = JSON.parse(fetchCalls("/api/progress")[0][1].body);
    expect(progressBody).toMatchObject({ score: 100, status: "completed" });
  });

  it("restores an acknowledged wrong answer without reposting or changing score", async () => {
    setupDOM({ userId: "u1" });
    clickOption(0, "b");
    clickAction();
    await flushAsyncWork();

    expect(fetchCalls("/api/quiz")).toHaveLength(1);
    setupDOM({ userId: "u1" });

    expect(scoreText()).toBe("0");
    expect(messageText()).toContain("בחרת ב־");
    expect(actionButton().textContent).toBe("לשאלה הבאה");
    expect(actionButton().disabled).toBe(false);
    expect(fetchCalls("/api/quiz")).toHaveLength(1);

    clickAction();
    expect(slideDisplay(1)).toBe("flex");
    expect(fetchCalls("/api/quiz")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({
      i: 1,
      score: 0,
      points: 0,
    });
  });

  it("clears the key on completion and still posts progress", async () => {
    setupDOM({ userId: "u1" });
    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();
    clickAction();
    clickOption(1, "b");
    clickAction();
    await flushAsyncWork();
    clickAction(); // advance past the last slide → completion
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(fetchCalls("/api/progress")).toHaveLength(1);
  });

  it("never reads or writes resume state in retry mode", async () => {
    const seeded = JSON.stringify({ i: 1, score: 1, points: 10, sessionId: "s-1", total: 2 });
    localStorage.setItem(KEY, seeded);
    setupDOM({ userId: "u1", quizMode: "retry" });
    expect(slideDisplay(0)).toBe("flex");
    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();
    clickAction(); // advance — must not touch storage
    expect(localStorage.getItem(KEY)).toBe(seeded);
  });

  it("intentionally starts retry mode fresh after a response-lost reload", async () => {
    const seeded = JSON.stringify({
      i: 1,
      score: 1,
      points: 10,
      sessionId: "s-1",
      total: 2,
    });
    localStorage.setItem(KEY, seeded);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("response lost")));
    setupDOM({ userId: "u1", quizMode: "retry" });

    clickOption(0, "a");
    clickAction();
    await flushAsyncWork();

    expect(localStorage.getItem(KEY)).toBe(seeded);
    setupDOM({ userId: "u1", quizMode: "retry" });
    expect(scoreText()).toBe("0");
    expect(actionButton().disabled).toBe(true);
    expect(actionButton().textContent).toBe("צדקתי?");
  });
});
