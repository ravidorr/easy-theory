import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const quizScript = readFileSync(
  resolve(__dirname, "../../../../../../public/js/quiz.js"),
  "utf-8"
);

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

function setupDOM() {
  document.body.innerHTML = `
    <main id="quiz-container" data-topic-id="t1" data-total="2">
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

describe("quiz.js – reward score and feedback", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    setupDOM();
  });

  afterEach(() => {
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
    expect(messageText()).toContain("בחרת ב");
    expect(floatEl().hasAttribute("data-animate")).toBe(false);
  });

  it("clears the message but keeps the score when advancing to the next question", () => {
    clickOption(0, "a");
    clickAction();
    clickAction(); // advance
    expect(messageText()).toBe("");
    expect(scoreText()).toBe("10");
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
