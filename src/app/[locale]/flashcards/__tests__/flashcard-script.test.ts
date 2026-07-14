import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const flashcardScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/flashcard.js"),
  "utf-8"
);

function cardMarkup(index: number) {
  return `
    <div class="flashcard-wrap" data-index="${index}" style="display:${index === 0 ? "flex" : "none"}">
      <div class="flashcard-inner">
        <div class="flashcard-face">front ${index}</div>
        <div class="flashcard-face">back ${index}</div>
      </div>
    </div>`;
}

function setupDOM(total = 3) {
  document.body.innerHTML = `
    <div id="flashcards-container" data-total="${total}">
      ${Array.from({ length: total }, (_, i) => cardMarkup(i)).join("")}
    </div>
    <span id="fc-count"></span>
    <div id="fc-progress"></div>
    <button id="fc-yes"></button>
    <button id="fc-no"></button>
  `;
  eval(flashcardScript);
}

function cards() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".flashcard-wrap")
  );
}

function visibleIndexes() {
  return cards()
    .map((c, i) => (c.style.display !== "none" ? i : -1))
    .filter((i) => i >= 0);
}

function clickYes() {
  (document.getElementById("fc-yes") as HTMLButtonElement).click();
}

function clickNo() {
  (document.getElementById("fc-no") as HTMLButtonElement).click();
}

function countText() {
  return document.getElementById("fc-count")!.textContent;
}

function progressWidth() {
  return (document.getElementById("fc-progress") as HTMLElement).style.width;
}

describe("flashcard.js", () => {
  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    delete (window as unknown as { __t?: Record<string, string> }).__t;
  });

  it("shows only the first card with count and progress on load", () => {
    expect(visibleIndexes()).toEqual([0]);
    expect(cards()[0].style.display).toBe("flex");
    expect(countText()).toBe("כרטיס 1 מתוך 3");
    expect(progressWidth()).toBe((1 / 3) * 100 + "%");
  });

  it("toggles the flipped class when a card is clicked", () => {
    const card = cards()[0];
    card.click();
    expect(card.classList.contains("flipped")).toBe(true);
    card.click();
    expect(card.classList.contains("flipped")).toBe(false);
  });

  it("advances to the next card on 'yes' and resets flip state", () => {
    cards()[0].click();
    expect(cards()[0].classList.contains("flipped")).toBe(true);

    clickYes();

    expect(visibleIndexes()).toEqual([1]);
    expect(cards()[0].classList.contains("flipped")).toBe(false);
    expect(countText()).toBe("כרטיס 2 מתוך 3");
    expect(progressWidth()).toBe((2 / 3) * 100 + "%");
  });

  it("shows the done state after answering 'yes' to every card", () => {
    clickYes();
    clickYes();
    clickYes();

    expect(visibleIndexes()).toEqual([]);
    expect(countText()).toBe("הושלם! 3 כרטיסים");
    expect(progressWidth()).toBe("100%");
    expect(
      (document.getElementById("fc-yes") as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (document.getElementById("fc-no") as HTMLButtonElement).disabled
    ).toBe(true);
    const container = document.getElementById("flashcards-container")!;
    expect(container.lastElementChild!.textContent).toBe("כל הכרטיסים עברו!");
  });

  it("replays 'don't know' cards in order after the last card", () => {
    clickNo(); // card 0 → don't know
    clickYes(); // card 1
    clickNo(); // card 2 → don't know, queue = [0, 2]

    expect(visibleIndexes()).toEqual([0]);
    clickYes();
    expect(visibleIndexes()).toEqual([2]);
    clickYes();

    expect(visibleIndexes()).toEqual([]);
    expect(countText()).toBe("הושלם! 3 כרטיסים");
  });

  it("re-queues a card answered 'no' during replay until it is known", () => {
    clickNo(); // card 0
    clickYes(); // card 1
    clickNo(); // card 2 → replay starts at card 0

    clickNo(); // still don't know card 0 → back of queue
    expect(visibleIndexes()).toEqual([2]);
    clickYes();
    expect(visibleIndexes()).toEqual([0]);
    clickYes();

    expect(visibleIndexes()).toEqual([]);
    expect(countText()).toBe("הושלם! 3 כרטיסים");
  });

  it("uses window.__t translations when provided", () => {
    (window as unknown as { __t: Record<string, string> }).__t = {
      cardCount: "card {current} of {total}",
      done: "done: {total} cards",
      allDone: "all done!",
    };
    setupDOM(1);

    expect(countText()).toBe("card 1 of 1");
    clickYes();
    expect(countText()).toBe("done: 1 cards");
    const container = document.getElementById("flashcards-container")!;
    expect(container.lastElementChild!.textContent).toBe("all done!");
  });

  it("does nothing when the container reports zero cards", () => {
    document.body.innerHTML = `
      <div id="flashcards-container" data-total="0"></div>
      <span id="fc-count">untouched</span>
      <button id="fc-yes"></button>
      <button id="fc-no"></button>
    `;
    expect(() => eval(flashcardScript)).not.toThrow();
    expect(countText()).toBe("untouched");
  });

  it("does nothing when the container is missing", () => {
    document.body.innerHTML = `<span id="fc-count">untouched</span>`;
    expect(() => eval(flashcardScript)).not.toThrow();
    expect(countText()).toBe("untouched");
  });
});
