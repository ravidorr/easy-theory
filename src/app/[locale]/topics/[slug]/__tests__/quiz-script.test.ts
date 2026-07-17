import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const quizScript = readFileSync(
  resolve(__dirname, "../../../../../../public/js/quiz.js"),
  "utf-8"
);
const TOUCH_DOUBLE_TAP_SUPPRESSION_MS = 300;
const AUTO_ADVANCE_DELAY_MS = 900;
const AUTO_RETRY_DELAY_MS = 1200;
const FINAL_EXIT_MS = 240;
const COUNT_UP_MS = 700;

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

function setupDOM(opts: {
  userId?: string;
  quizMode?: string;
  answeredIds?: string[];
  answeredCount?: number;
  bareFinalScreen?: boolean;
} = {}) {
  const userAttr = opts.userId ? ` data-user-id="${opts.userId}"` : "";
  const modeAttr = opts.quizMode ? ` data-quiz-mode="${opts.quizMode}"` : "";
  const answeredAttr = opts.answeredIds
    ? ` data-answered-ids='${JSON.stringify(opts.answeredIds)}'`
    : "";
  const answeredCountAttr =
    opts.answeredCount != null
      ? ` data-answered-count="${opts.answeredCount}"`
      : opts.answeredIds
        ? ` data-answered-count="${opts.answeredIds.length}"`
        : "";
  document.body.innerHTML = `
    <main id="quiz-container" data-topic-id="t1" data-total="2"${userAttr}${modeAttr}${answeredAttr}${answeredCountAttr}>
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
        <button id="quiz-next" disabled>לשאלה הבאה</button>
        <p id="quiz-auto-advance-hint" style="display: none;">רמז</p>
      </div>
      <div id="quiz-final" tabindex="-1">
        <span id="final-score"></span>
        ${
          opts.bareFinalScreen
            ? ""
            : `
        <span aria-hidden="true">${'<i class="confetti-piece"></i>'.repeat(12)}</span>
        <span class="reward-pill"><span id="final-xp">0</span></span>
        <a id="quiz-next-topic" href="/topics/next">השיעור הבא</a>`
        }
      </div>
    </main>
  `;
  eval(quizScript);
}

function scoreText() {
  return document.getElementById("reward-score")!.textContent;
}

function countText() {
  return document.getElementById("quiz-count")!.textContent;
}

function finalScoreText() {
  return document.getElementById("final-score")!.textContent;
}

function messageText() {
  return document.getElementById("reward-message")!.textContent;
}

function floatEl() {
  return document.getElementById("reward-float")!;
}

function hintEl() {
  return document.getElementById("quiz-auto-advance-hint")!;
}

function slideDisplay(index: number) {
  return (document.querySelectorAll(".quiz-slide")[index] as HTMLElement).style
    .display;
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

function errorResponse(
  status: number,
  error: string,
  extra: Record<string, unknown> = {}
) {
  return {
    ok: false,
    status,
    json: async () => ({ error, ...extra }),
  };
}

function rewardMessageEl() {
  return document.getElementById("reward-message") as HTMLElement;
}

function fetchCalls(url: string) {
  return (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    (call) => call[0] === url
  );
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// Fake timers keep the 900ms auto-advance countdown deterministic and stop
// timers armed in one test from firing during a later one.
function resetTestState() {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "quiz-auto-advance=; path=/; max-age=0";
  vi.useFakeTimers();
}

function restoreTestState() {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.cookie = "quiz-auto-advance=; path=/; max-age=0";
}

describe("quiz.js – rejected answer persistence", () => {
  beforeEach(() => {
    resetTestState();
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
    restoreTestState();
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
      await flushAsyncWork();

      expect(messageText()).toBe("שגיאה זמנית מקומית");
      expect(actionButton().textContent).toBe("לנסות שוב");

      clickAction();
      await flushAsyncWork();

      expect(fetchCalls("/api/quiz")).toHaveLength(2);
      expect(actionButton().textContent).toBe("לשאלה הבאה");
    }
  );

  it("marks the failure message as an error and clears it after a successful retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          errorResponse(500, "שמירת התשובה נכשלה", {
            code: "SUBMISSION_FAILED",
            ref: "ab12cd34",
          })
        )
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    );
    setupDOM();

    clickOption(0, "a");
    await flushAsyncWork();

    expect(rewardMessageEl().dataset.state).toBe("error");

    clickAction();
    await flushAsyncWork();

    expect(rewardMessageEl().dataset.state).toBeUndefined();
    expect(actionButton().textContent).toBe("לשאלה הבאה");
  });

  it("marks a permanent failure message as an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(errorResponse(400, "פרמטרים שגויים"))
    );
    setupDOM({ userId: "u1" });

    clickOption(0, "a");
    await flushAsyncWork();

    expect(rewardMessageEl().dataset.state).toBe("error");
    expect(actionButton().textContent).toBe("התחלה מחדש");
  });

  it("silently retries once when the submission is still in flight server-side", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          errorResponse(503, "התשובה עדיין נשמרת", {
            code: "SUBMISSION_IN_FLIGHT",
            ref: "ab12cd34",
          })
        )
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    );
    setupDOM();

    // A wrong answer keeps the auto-advance countdown out of the picture.
    clickOption(0, "b");
    await flushAsyncWork();

    // No failure UI while the silent retry is pending.
    expect(fetchCalls("/api/quiz")).toHaveLength(1);
    expect(rewardMessageEl().dataset.state).toBeUndefined();
    expect(actionButton().textContent).toBe("שומרים...");
    expect(actionButton().disabled).toBe(true);

    vi.advanceTimersByTime(AUTO_RETRY_DELAY_MS);
    await flushAsyncWork();

    expect(fetchCalls("/api/quiz")).toHaveLength(2);
    expect(fetchCalls("/api/quiz")[1][1].body).toBe(
      fetchCalls("/api/quiz")[0][1].body
    );
    expect(rewardMessageEl().dataset.state).toBeUndefined();
    expect(actionButton().textContent).toBe("לשאלה הבאה");
    expect(actionButton().disabled).toBe(false);
  });

  it("surfaces the failure UI when the in-flight retry fails again", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        errorResponse(503, "התשובה עדיין נשמרת", {
          code: "SUBMISSION_IN_FLIGHT",
        })
      )
    );
    setupDOM();

    clickOption(0, "b");
    await flushAsyncWork();
    vi.advanceTimersByTime(AUTO_RETRY_DELAY_MS);
    await flushAsyncWork();

    expect(fetchCalls("/api/quiz")).toHaveLength(2);
    expect(messageText()).toBe("התשובה עדיין נשמרת");
    expect(rewardMessageEl().dataset.state).toBe("error");
    expect(actionButton().textContent).toBe("לנסות שוב");

    // The retry budget is spent: no further silent attempts.
    vi.advanceTimersByTime(AUTO_RETRY_DELAY_MS * 2);
    await flushAsyncWork();
    expect(fetchCalls("/api/quiz")).toHaveLength(2);
  });

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
    await flushAsyncWork();
    // The lost response triggers the single silent auto-retry.
    vi.advanceTimersByTime(AUTO_RETRY_DELAY_MS);
    await flushAsyncWork();

    expect(messageText()).toBe("כל הכבוד! סיימת את כל הנושא!");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(scoreText()).toBe("10");
    expect(fetchCalls("/api/quiz")[1][1].body).toBe(
      fetchCalls("/api/quiz")[0][1].body
    );
  });

  it("stores latest streak and star totals for dashboard pill sync", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          streak_days: 1,
          new_total_stars: 10,
        }),
      })
    );
    setupDOM();

    clickOption(0, "a");
    await flushAsyncWork();

    expect(JSON.parse(sessionStorage.getItem("clearroad:stats")!)).toEqual({
      streak_days: 1,
      star_points: 10,
      savedAt: expect.any(Number),
    });
  });

  it("shows a retry action after a network failure once the silent retry fails too", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    setupDOM();

    clickOption(0, "a");
    await flushAsyncWork();

    // The first failure retries silently; the failure UI only appears
    // after the auto-retry also fails.
    expect(actionButton().textContent).not.toBe("לנסות שוב");
    vi.advanceTimersByTime(AUTO_RETRY_DELAY_MS);
    await flushAsyncWork();

    expect(fetchCalls("/api/quiz")).toHaveLength(2);
    expect(messageText()).toBe("לא הצלחנו לשמור את התשובה. אפשר לנסות שוב.");
    expect(rewardMessageEl().dataset.state).toBe("error");
    expect(actionButton().textContent).toBe("לנסות שוב");
    expect(actionButton().disabled).toBe(false);
    expect(slideDisplay(0)).toBe("flex");
  });

  it("holds a skip request until the pending submission persists", async () => {
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

    // Correct answer: the button is an enabled skip hatch while saving.
    expect(actionButton().disabled).toBe(false);
    expect(actionButton().textContent).toBe("לשאלה הבאה");

    clickAction();
    expect(actionButton().disabled).toBe(true);
    expect(actionButton().textContent).toBe("שומרים...");
    expect(fetchCalls("/api/quiz")).toHaveLength(1);
    expect(slideDisplay(0)).toBe("flex");

    resolveRequest({ ok: true, json: async () => ({}) });
    await flushAsyncWork();

    expect(slideDisplay(1)).toBe("flex");
  });

  it("does not allow advancing a wrong answer while persistence is pending", async () => {
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

    clickOption(0, "b");

    expect(actionButton().disabled).toBe(true);
    expect(actionButton().textContent).toBe("שומרים...");
    dispatchActionClick(1);
    expect(fetchCalls("/api/quiz")).toHaveLength(1);
    expect(slideDisplay(0)).toBe("flex");

    resolveRequest({ ok: true, json: async () => ({}) });
    await flushAsyncWork();

    expect(actionButton().disabled).toBe(false);
    expect(actionButton().textContent).toBe("לשאלה הבאה");
    expect(slideDisplay(0)).toBe("flex");
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
    await flushAsyncWork();
    clickAction();
    clickOption(1, "b");
    await flushAsyncWork();
    clickAction();
    await flushAsyncWork();

    expect(fetchCalls("/api/progress")).toHaveLength(0);
    expect(document.getElementById("quiz-final")!.style.display).not.toBe(
      "flex"
    );
    expect(slideDisplay(1)).toBe("flex");
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
    await flushAsyncWork();

    expect(slideDisplay(0)).toBe("flex");
    expect(slideDisplay(1)).toBe("none");

    clickAction();
    await flushAsyncWork();
    clickAction();

    expect(slideDisplay(1)).toBe("flex");
  });
});

describe("quiz.js – auto-advance", () => {
  beforeEach(() => {
    resetTestState();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  afterEach(() => {
    restoreTestState();
  });

  it("auto-advances to the next question after the countdown on a correct answer", async () => {
    setupDOM();
    clickOption(0, "a");
    await flushAsyncWork();

    expect(slideDisplay(0)).toBe("flex");
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);
    expect(slideDisplay(1)).toBe("flex");
  });

  it("waits for a slow submission and advances as soon as it persists", async () => {
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
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);
    expect(slideDisplay(0)).toBe("flex");

    resolveRequest({ ok: true, json: async () => ({}) });
    await flushAsyncWork();

    expect(slideDisplay(1)).toBe("flex");
  });

  it("never auto-advances after a wrong answer", async () => {
    setupDOM();
    clickOption(0, "b");
    await flushAsyncWork();

    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 5);
    expect(slideDisplay(0)).toBe("flex");
    expect(actionButton().textContent).toBe("לשאלה הבאה");

    clickAction();
    expect(slideDisplay(1)).toBe("flex");
  });

  it("advances immediately on a skip tap and does not double-advance when the timer fires", async () => {
    setupDOM();
    clickOption(0, "a");
    await flushAsyncWork();

    expect(actionButton().disabled).toBe(false);
    expect(actionButton().textContent).toBe("לשאלה הבאה");
    clickAction();
    expect(slideDisplay(1)).toBe("flex");

    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);
    expect(slideDisplay(1)).toBe("flex");
    expect(document.getElementById("quiz-final")!.style.display).not.toBe(
      "flex"
    );
  });

  it("does not auto-advance past an earned medal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ medals_earned: ["streak-3"] }),
      })
    );
    setupDOM();

    clickOption(0, "a");
    await flushAsyncWork();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    expect(slideDisplay(0)).toBe("flex");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("does not auto-advance past the topic-completed message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ topic_completed: true }),
      })
    );
    setupDOM();

    clickOption(0, "a");
    await flushAsyncWork();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    expect(slideDisplay(0)).toBe("flex");
    expect(messageText()).toBe("כל הכבוד! סיימת את כל הנושא!");
  });

  it("shows the final screen and posts progress when the last question auto-advances", async () => {
    setupDOM();

    clickOption(0, "a");
    await flushAsyncWork();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    clickOption(1, "b");
    await flushAsyncWork();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);
    vi.advanceTimersByTime(FINAL_EXIT_MS);

    expect(document.getElementById("quiz-final")!.style.display).toBe("flex");
    const progressBody = JSON.parse(fetchCalls("/api/progress")[0][1].body);
    expect(progressBody).toMatchObject({ score: 100, status: "completed" });
  });

  it("cancels the countdown when the submission fails and stays manual after a retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(errorResponse(500, "שמירת התשובה נכשלה"))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    );
    setupDOM();

    clickOption(0, "a");
    await flushAsyncWork();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);
    expect(slideDisplay(0)).toBe("flex");

    clickAction();
    await flushAsyncWork();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);
    expect(slideDisplay(0)).toBe("flex");
    expect(actionButton().textContent).toBe("לשאלה הבאה");

    clickAction();
    expect(slideDisplay(1)).toBe("flex");
  });

  it("keeps the manual flow when the auto-advance cookie is off", async () => {
    document.cookie = "quiz-auto-advance=off";
    setupDOM();

    clickOption(0, "a");
    expect(actionButton().disabled).toBe(true);
    expect(actionButton().textContent).toBe("שומרים...");
    await flushAsyncWork();

    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 5);
    expect(slideDisplay(0)).toBe("flex");
    expect(actionButton().textContent).toBe("לשאלה הבאה");

    clickAction();
    expect(slideDisplay(1)).toBe("flex");
  });

  it("keeps the manual flow when reduced motion is preferred", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true })
    );
    setupDOM();

    clickOption(0, "a");
    await flushAsyncWork();

    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 5);
    expect(slideDisplay(0)).toBe("flex");

    clickAction();
    expect(slideDisplay(1)).toBe("flex");
  });

  it("lets an explicit cookie override the reduced-motion default", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true })
    );
    document.cookie = "quiz-auto-advance=on";
    setupDOM();

    clickOption(0, "a");
    await flushAsyncWork();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    expect(slideDisplay(1)).toBe("flex");
  });

  it("does not arm auto-advance when restoring an acknowledged submission", async () => {
    setupDOM({ userId: "u1" });
    clickOption(0, "a");
    await flushAsyncWork();

    // Reload before the countdown finishes: the restored state is manual.
    // Drop the first instance's timer so only the new instance is observed.
    vi.clearAllTimers();
    setupDOM({ userId: "u1" });
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 5);

    expect(slideDisplay(0)).toBe("flex");
    expect(actionButton().textContent).toBe("לשאלה הבאה");
    expect(actionButton().disabled).toBe(false);
  });

  it("ignores a second tap on the options after the answer locked", async () => {
    setupDOM();
    clickOption(0, "a");
    clickOption(0, "c");
    await flushAsyncWork();

    expect(fetchCalls("/api/quiz")).toHaveLength(1);
    const requestBody = JSON.parse(fetchCalls("/api/quiz")[0][1].body);
    expect(requestBody.selected_option).toBe("a");
  });
});

describe("quiz.js – auto-advance hint", () => {
  beforeEach(() => {
    resetTestState();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  afterEach(() => {
    restoreTestState();
  });

  it("shows the hint once per browser session", () => {
    setupDOM();
    expect(hintEl().style.display).toBe("block");

    setupDOM();
    expect(hintEl().style.display).toBe("none");
  });

  it("hides the hint when advancing to the next question", async () => {
    setupDOM();
    expect(hintEl().style.display).toBe("block");

    clickOption(0, "a");
    await flushAsyncWork();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    expect(slideDisplay(1)).toBe("flex");
    expect(hintEl().style.display).toBe("none");
  });

  it("does not show the hint when auto-advance is off", () => {
    document.cookie = "quiz-auto-advance=off";
    setupDOM();
    expect(hintEl().style.display).toBe("none");
  });
});

describe("quiz.js – reward score and feedback", () => {
  beforeEach(() => {
    resetTestState();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    setupDOM();
  });

  afterEach(() => {
    restoreTestState();
  });

  it("starts with score 0 and an empty feedback message", () => {
    expect(scoreText()).toBe("0");
    expect(messageText()).toBe("");
  });

  it("adds 10 points, shows the correct message, and animates the float on a correct answer", () => {
    clickOption(0, "a");
    expect(scoreText()).toBe("10");
    expect(messageText()).toBe("יפה מאוד!");
    expect(floatEl().hasAttribute("data-animate")).toBe(true);
  });

  it("removes the float animation attribute when the animation ends", () => {
    clickOption(0, "a");
    floatEl().dispatchEvent(new Event("animationend"));
    expect(floatEl().hasAttribute("data-animate")).toBe(false);
  });

  it("keeps the score and shows the wrong-answer message on a wrong answer", () => {
    clickOption(0, "b");
    expect(scoreText()).toBe("0");
    expect(messageText()).toContain("בחרת ב־");
    expect(floatEl().hasAttribute("data-animate")).toBe(false);
  });

  it("clears the message but keeps the score when advancing to the next question", async () => {
    clickOption(0, "a");
    await flushAsyncWork();
    clickAction(); // advance
    expect(messageText()).toBe("");
    expect(scoreText()).toBe("10");
  });

  it("keeps feedback visible for one mouse multi-click and advances on a later click", async () => {
    clickOption(0, "a");
    await flushAsyncWork();

    dispatchActionClick(2);

    expect(messageText()).toBe("יפה מאוד!");
    expect(slideDisplay(0)).toBe("flex");

    dispatchActionClick(1);

    expect(slideDisplay(1)).toBe("flex");
  });

  it("keeps feedback visible through repeated Enter and advances on a later press", async () => {
    clickOption(0, "a");
    await flushAsyncWork();

    pressActionKey("Enter", true);

    expect(messageText()).toBe("יפה מאוד!");
    expect(slideDisplay(0)).toBe("flex");

    pressActionKey("Enter", false);

    expect(slideDisplay(1)).toBe("flex");
  });

  it("keeps recovered feedback visible after a touch retry double-tap", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(errorResponse(500, "שמירת התשובה נכשלה"))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    );
    setupDOM();
    clickOption(0, "a");
    await flushAsyncWork();

    dispatchPointerAction("touch", 1);
    await flushAsyncWork();
    dispatchPointerAction("touch", 1);

    expect(messageText()).toBe("יפה מאוד!");
    expect(actionButton().disabled).toBe(true);
    expect(slideDisplay(0)).toBe("flex");

    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS);
    expect(actionButton().disabled).toBe(false);

    dispatchPointerAction("touch", 1);
    expect(slideDisplay(1)).toBe("flex");
  });

  it("keeps a failed touch retry disabled until its suppression window expires", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(errorResponse(500, "שמירת התשובה נכשלה"))
        .mockResolvedValueOnce(errorResponse(500, "שמירת התשובה נכשלה שוב"))
    );
    setupDOM();
    clickOption(0, "a");
    await flushAsyncWork();

    dispatchPointerAction("touch", 1);
    await flushAsyncWork();

    expect(messageText()).toBe("שמירת התשובה נכשלה שוב");
    expect(actionButton().disabled).toBe(true);

    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS);

    expect(actionButton().disabled).toBe(false);
    expect(actionButton().textContent).toBe("לנסות שוב");
  });

  it("uses the touchstart fallback to suppress Safari-style double taps on retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(errorResponse(500, "שמירת התשובה נכשלה"))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    );
    setupDOM();
    clickOption(0, "a");
    await flushAsyncWork();

    dispatchTouchFallbackAction(1);
    await flushAsyncWork();

    expect(actionButton().disabled).toBe(true);
    dispatchTouchFallbackAction(1);
    expect(slideDisplay(0)).toBe("flex");

    vi.advanceTimersByTime(TOUCH_DOUBLE_TAP_SUPPRESSION_MS);
    dispatchTouchFallbackAction(1);

    expect(slideDisplay(1)).toBe("flex");
  });

  it("keeps programmatic activations immediate", async () => {
    clickOption(0, "a");
    await flushAsyncWork();

    expect(actionButton().disabled).toBe(false);
    dispatchActionClick(0);

    expect(slideDisplay(1)).toBe("flex");
  });

  it("accumulates points across correct answers", async () => {
    clickOption(0, "a");
    await flushAsyncWork();
    clickAction(); // advance to slide 2
    clickOption(1, "b");
    expect(scoreText()).toBe("20");
  });
});

describe("quiz.js – assistive tech state", () => {
  function option(slideIndex: number, opt: string) {
    const slide = document.querySelectorAll(".quiz-slide")[slideIndex]!;
    return slide.querySelector(`[data-option="${opt}"]`) as HTMLButtonElement;
  }

  beforeEach(() => {
    resetTestState();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    setupDOM();
  });

  afterEach(() => {
    restoreTestState();
  });

  it("keeps the chosen option aria-pressed and locked after the one-tap answer", () => {
    clickOption(0, "b");
    expect(option(0, "b").getAttribute("aria-pressed")).toBe("true");
    expect(option(0, "b").disabled).toBe(true);
    ["a", "c", "d"].forEach((opt) => {
      expect(option(0, opt).getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("adds screen-reader result text to the correct and wrong options on answer", () => {
    clickOption(0, "b"); // correct is "a"
    expect(option(0, "a").querySelector(".quiz-option-sr")!.textContent).toBe("תשובה נכונה");
    expect(option(0, "b").querySelector(".quiz-option-sr")!.textContent).toBe("תשובה שגויה");
    expect(option(0, "c").querySelector(".quiz-option-sr")).toBeNull();
  });

  it("marks only the correct option when the answer is right", () => {
    clickOption(0, "a");
    expect(option(0, "a").querySelector(".quiz-option-sr")!.textContent).toBe("תשובה נכונה");
    ["b", "c", "d"].forEach((opt) => {
      expect(option(0, opt).querySelector(".quiz-option-sr")).toBeNull();
    });
  });

  it("does not duplicate screen-reader result spans", async () => {
    clickOption(0, "a");
    await flushAsyncWork();
    clickAction(); // advance
    clickOption(1, "b");
    document.querySelectorAll(".quiz-option").forEach((o) => {
      expect(o.querySelectorAll(".quiz-option-sr").length).toBeLessThanOrEqual(1);
    });
  });
});

describe("quiz.js – completion celebration", () => {
  beforeEach(() => {
    resetTestState();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  afterEach(() => {
    restoreTestState();
  });

  async function completeQuiz() {
    clickOption(0, "a");
    await flushAsyncWork();
    clickAction();
    clickOption(1, "b");
    await flushAsyncWork();
    clickAction();
  }

  function finalScreen() {
    return document.getElementById("quiz-final")!;
  }

  function finalXpText() {
    return document.getElementById("final-xp")!.textContent;
  }

  it("slides the last card away before revealing the final screen", async () => {
    setupDOM();
    await completeQuiz();

    const lastSlide = document.querySelectorAll(".quiz-slide")[1]!;
    expect(lastSlide.hasAttribute("data-exit")).toBe(true);
    expect(
      document.getElementById("quiz-progress-fill")!.hasAttribute("data-complete")
    ).toBe(true);
    expect(finalScreen().style.display).not.toBe("flex");

    vi.advanceTimersByTime(FINAL_EXIT_MS);

    expect(finalScreen().style.display).toBe("flex");
    expect(finalScreen().hasAttribute("data-celebrate")).toBe(true);
    expect(document.getElementById("quiz-footer")!.style.display).toBe("none");
    expect(document.activeElement).toBe(finalScreen());
  });

  it("counts the score and XP up to their final values", async () => {
    setupDOM();
    await completeQuiz();
    vi.advanceTimersByTime(FINAL_EXIT_MS);
    vi.advanceTimersByTime(COUNT_UP_MS + 100);

    expect(finalScoreText()).toBe("2 מתוך 2 נכון");
    expect(finalXpText()).toBe("20");
  });

  it("shows the starting values immediately even if rAF frames never run (hidden tab)", async () => {
    setupDOM();
    await completeQuiz();
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    vi.advanceTimersByTime(FINAL_EXIT_MS);

    expect(finalScoreText()).toBe("0 מתוך 2 נכון");
    expect(finalXpText()).toBe("0");
  });

  it("renders the localized template on intermediate count-up frames", async () => {
    setupDOM();
    await completeQuiz();
    vi.advanceTimersByTime(FINAL_EXIT_MS);
    vi.advanceTimersByTime(48);

    expect(finalScoreText()).toMatch(/^\d+ מתוך 2 נכון$/);
  });

  it("skips the celebration and sets final values under reduced motion", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    setupDOM();
    await completeQuiz();
    vi.advanceTimersByTime(0);

    expect(finalScreen().style.display).toBe("flex");
    expect(finalScreen().hasAttribute("data-celebrate")).toBe(false);
    expect(finalScoreText()).toBe("2 מתוך 2 נכון");
    expect(finalXpText()).toBe("20");
  });

  it("shows the quiet final screen when the topic was already complete on load", () => {
    setupDOM({ userId: "u1", answeredIds: ["q1", "q2"] });

    expect(finalScreen().style.display).toBe("flex");
    expect(finalScreen().hasAttribute("data-celebrate")).toBe(false);
    const pill = document.getElementById("final-xp")!.parentElement!;
    expect(pill.style.display).toBe("none");
  });

  it("runs the completion sequence only once for a double activation", async () => {
    setupDOM();
    await completeQuiz();
    clickAction();
    vi.advanceTimersByTime(FINAL_EXIT_MS);

    expect(fetchCalls("/api/progress")).toHaveLength(1);
    expect(finalScreen().style.display).toBe("flex");
  });

  it("completes without the celebration extras in the retry layout", async () => {
    setupDOM({ quizMode: "retry", bareFinalScreen: true });
    await completeQuiz();
    vi.advanceTimersByTime(FINAL_EXIT_MS + COUNT_UP_MS + 100);

    expect(finalScreen().style.display).toBe("flex");
    expect(finalScoreText()).toBe("2 מתוך 2 נכון");
    expect(fetchCalls("/api/progress")).toHaveLength(0);
  });
});

describe("quiz.js – resume", () => {
  const KEY = "quiz-resume:v1:u1:t1";

  beforeEach(() => {
    resetTestState();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  afterEach(() => {
    restoreTestState();
  });

  it("saves position, score, and points on advance", async () => {
    setupDOM({ userId: "u1" });
    clickOption(0, "a");
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
    clickOption(1, "b"); // one-tap answer → POST /api/quiz
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
    await flushAsyncWork();
    clickAction();

    expect(fetchCalls("/api/quiz")).toHaveLength(2);
    const progressBody = JSON.parse(fetchCalls("/api/progress")[0][1].body);
    expect(progressBody).toMatchObject({ score: 100, status: "completed" });
  });

  it("restores an acknowledged wrong answer without reposting or changing score", async () => {
    setupDOM({ userId: "u1" });
    clickOption(0, "b");
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
    await flushAsyncWork();
    clickAction();
    clickOption(1, "b");
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
    await flushAsyncWork();

    expect(localStorage.getItem(KEY)).toBe(seeded);
    setupDOM({ userId: "u1", quizMode: "retry" });
    expect(scoreText()).toBe("0");
    expect(actionButton().disabled).toBe(true);
    expect(actionButton().textContent).toBe("לשאלה הבאה");
  });
});

describe("quiz.js – skip answered", () => {
  const KEY = "quiz-resume:v1:u1:t1";

  beforeEach(() => {
    resetTestState();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  afterEach(() => {
    restoreTestState();
  });

  it("starts at the first unanswered question on a fresh session", () => {
    setupDOM({ userId: "u1", answeredIds: ["q1"] });
    expect(slideDisplay(0)).toBe("none");
    expect(slideDisplay(1)).toBe("flex");
    expect(countText()).toBe("2 מתוך 2");
  });

  it("keeps a pending localStorage resume on an already-answered question", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        i: 0,
        score: 0,
        points: 0,
        sessionId: "s-1",
        total: 2,
        pendingSubmission: {
          questionId: "q1",
          selectedOption: "a",
          idempotencyKey: "key-1",
        },
      })
    );
    setupDOM({ userId: "u1", answeredIds: ["q1"] });
    expect(slideDisplay(0)).toBe("flex");
    expect(slideDisplay(1)).toBe("none");
    expect(actionButton().textContent).toBe("לנסות שוב");
  });

  it("bumps a stale resume forward when the saved slide was already answered", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ i: 0, score: 0, points: 0, sessionId: "s-1", total: 2 })
    );
    setupDOM({ userId: "u1", answeredIds: ["q1"] });
    expect(slideDisplay(0)).toBe("none");
    expect(slideDisplay(1)).toBe("flex");
  });

  it("shows the final screen when every question was already answered", () => {
    setupDOM({ userId: "u1", answeredIds: ["q1", "q2"], answeredCount: 2 });
    expect(slideDisplay(0)).toBe("none");
    expect(document.getElementById("quiz-footer")!.style.display).toBe("none");
    expect(document.getElementById("quiz-final")!.style.display).toBe("flex");
    expect(finalScoreText()).toBe("2 מתוך 2 שאלות נענו");
  });

  it("does not skip answered questions in retry mode", () => {
    setupDOM({ userId: "u1", quizMode: "retry", answeredIds: ["q1"] });
    expect(slideDisplay(0)).toBe("flex");
    expect(slideDisplay(1)).toBe("none");
  });
});
