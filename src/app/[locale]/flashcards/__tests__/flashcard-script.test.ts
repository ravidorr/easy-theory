import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const flashcardScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/flashcard.js"),
  "utf-8"
);

type CardData = { id?: string; img: string; alt: string; name: string; badge: string };

const ID_1 = "11111111-1111-4111-8111-111111111111";
const ID_2 = "22222222-2222-4222-8222-222222222222";
const ID_3 = "33333333-3333-4333-8333-333333333333";

const SIGNS: CardData[] = [
  { id: ID_1, img: "/signs/sign-301.png", alt: "חנייה אסורה", name: "חנייה אסורה", badge: "תמרור 301" },
  { id: ID_2, img: "/signs/sign-205.png", alt: "עצור", name: "עצור", badge: "תמרור 205" },
  { id: ID_3, img: "/signs/sign-101.svg", alt: "כביש משובש", name: "כביש משובש", badge: "תמרור 101" },
];

const STALE_SRCSET = "/_next/image?url=%2Fsigns%2Fsign-301.png&w=96&q=75 1x";

function setupDOM(signs: CardData[] | string = SIGNS, { withDataEl = true } = {}) {
  const json = typeof signs === "string" ? signs : JSON.stringify(signs);
  const first = typeof signs === "string" ? SIGNS[0] : (signs[0] ?? SIGNS[0]);
  document.body.innerHTML = `
    <main>
      <span id="fc-count"></span>
      <div id="fc-progress"></div>
      <div id="flashcards-container" data-total="${typeof signs === "string" ? 0 : signs.length}">
        <button type="button" class="flashcard-wrap" data-index="0" aria-label="הקשי לראות את השם" aria-expanded="false" style="display:flex">
          <div class="flashcard-inner">
            <div class="flashcard-face">
              <img class="fc-front-img" src="${first.img}" alt="${first.alt}" srcset="${STALE_SRCSET}" sizes="96px" />
            </div>
            <div class="flashcard-face flashcard-back-face" aria-hidden="true">
              <img class="fc-back-img" src="${first.img}" alt="${first.alt}" srcset="${STALE_SRCSET}" sizes="96px" />
              <h2 id="fc-name">${first.name}</h2>
              <span id="fc-badge">${first.badge}</span>
            </div>
          </div>
        </button>
      </div>
      ${withDataEl ? `<script type="application/json" id="fc-data">${json}</script>` : ""}
      <button id="fc-no"></button>
      <button id="fc-yes"></button>
    </main>
  `;
  eval(flashcardScript);
}

function card() {
  return document.querySelector(".flashcard-wrap") as HTMLElement;
}

function frontImg() {
  return document.querySelector(".fc-front-img") as HTMLImageElement;
}

function backImg() {
  return document.querySelector(".fc-back-img") as HTMLImageElement;
}

function countText() {
  return document.getElementById("fc-count")!.textContent;
}

function progressWidth() {
  return (document.getElementById("fc-progress") as HTMLElement).style.width;
}

function clickYes() {
  (document.getElementById("fc-yes") as HTMLButtonElement).click();
}

function clickNo() {
  (document.getElementById("fc-no") as HTMLButtonElement).click();
}

describe("flashcard.js", () => {
  let preloadedSrcs: string[];
  let fetchMock: ReturnType<typeof vi.fn>;

  function srsPosts() {
    return fetchMock.mock.calls
      .filter(([url]) => url === "/api/srs")
      .map(([, init]) => JSON.parse((init as RequestInit).body as string));
  }

  beforeEach(() => {
    preloadedSrcs = [];
    vi.stubGlobal(
      "Image",
      class {
        set src(value: string) {
          preloadedSrcs.push(value);
        }
      }
    );
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as { __t?: Record<string, string> }).__t;
    document.body.innerHTML = "";
  });

  it("initializes count and progress without re-rendering the SSR'd first card", () => {
    setupDOM();
    expect(countText()).toBe("כרטיס 1 מתוך 3");
    expect(progressWidth()).toBe(`${(1 / 3) * 100}%`);
    // Card 0 keeps its server-rendered (optimized) srcset.
    expect(frontImg().getAttribute("srcset")).toBe(STALE_SRCSET);
    expect(preloadedSrcs).toEqual([SIGNS[1].img]);
  });

  it("flips the card on click and toggles back", () => {
    setupDOM();
    card().click();
    expect(card().classList.contains("flipped")).toBe(true);
    expect(card().getAttribute("aria-expanded")).toBe("true");
    card().click();
    expect(card().classList.contains("flipped")).toBe(false);
    expect(card().getAttribute("aria-expanded")).toBe("false");
  });

  it("flips the card on Enter and Space", () => {
    setupDOM();
    card().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(card().classList.contains("flipped")).toBe(true);
    card().dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(card().classList.contains("flipped")).toBe(false);
  });

  it("advances on yes: swaps content, clears srcset, resets flip", () => {
    setupDOM();
    card().click();
    clickYes();
    expect(frontImg().getAttribute("src")).toBe(SIGNS[1].img);
    expect(backImg().getAttribute("src")).toBe(SIGNS[1].img);
    expect(frontImg().hasAttribute("srcset")).toBe(false);
    expect(frontImg().hasAttribute("sizes")).toBe(false);
    expect(frontImg().alt).toBe(SIGNS[1].alt);
    expect(document.getElementById("fc-name")!.textContent).toBe(SIGNS[1].name);
    expect(document.getElementById("fc-badge")!.textContent).toBe(SIGNS[1].badge);
    expect(card().classList.contains("flipped")).toBe(false);
    expect(countText()).toBe("כרטיס 2 מתוך 3");
    expect(progressWidth()).toBe(`${(2 / 3) * 100}%`);
  });

  it("preloads the upcoming card on advance", () => {
    setupDOM();
    clickYes();
    expect(preloadedSrcs).toContain(SIGNS[2].img);
  });

  it("replays 'don't know' cards in order after the last card", () => {
    setupDOM();
    clickNo(); // card 0 → don't know
    clickYes(); // card 1
    clickNo(); // card 2 → don't know, queue = [0, 2]

    expect(frontImg().getAttribute("src")).toBe(SIGNS[0].img);
    clickYes();
    expect(frontImg().getAttribute("src")).toBe(SIGNS[2].img);
    clickYes();
    expect(countText()).toBe("הושלם! 3 כרטיסים");
  });

  it("re-queues a card answered 'no' during replay until it is known", () => {
    setupDOM();
    clickNo(); // card 0
    clickYes(); // card 1
    clickNo(); // card 2 → replay starts at card 0

    clickNo(); // still don't know card 0 → back of queue
    expect(frontImg().getAttribute("src")).toBe(SIGNS[2].img);
    clickYes();
    expect(frontImg().getAttribute("src")).toBe(SIGNS[0].img);
    clickYes();
    expect(countText()).toBe("הושלם! 3 כרטיסים");
  });

  it("shows the done state after answering 'yes' to every card", () => {
    setupDOM();
    clickYes();
    clickYes();
    clickYes();
    expect(countText()).toBe("הושלם! 3 כרטיסים");
    expect(progressWidth()).toBe("100%");
    expect(card().style.display).toBe("none");
    expect((document.getElementById("fc-yes") as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById("fc-no") as HTMLButtonElement).disabled).toBe(true);
    const container = document.getElementById("flashcards-container")!;
    expect(container.lastElementChild!.textContent).toBe("כל הכרטיסים עברו!");
  });

  it("uses window.__t translations when provided", () => {
    (window as unknown as { __t: Record<string, string> }).__t = {
      cardCount: "card {current} of {total}",
      done: "done: {total} cards",
      allDone: "all done!",
    };
    setupDOM([SIGNS[0]]);

    expect(countText()).toBe("card 1 of 1");
    clickYes();
    expect(countText()).toBe("done: 1 cards");
    const container = document.getElementById("flashcards-container")!;
    expect(container.lastElementChild!.textContent).toBe("all done!");
  });

  it("falls back to the placeholder on image error, without looping", () => {
    setupDOM();
    clickYes();
    frontImg().dispatchEvent(new Event("error"));
    expect(frontImg().src).toContain("/placeholder.svg");
    frontImg().dispatchEvent(new Event("error"));
    expect(frontImg().src).toContain("/placeholder.svg");
  });

  it("does nothing when the payload is empty", () => {
    setupDOM([]);
    expect(countText()).toBe("");
    clickYes();
    expect(frontImg().getAttribute("src")).toBe(SIGNS[0].img);
  });

  it("replaces non-path image values with the placeholder", () => {
    const tampered = [
      SIGNS[0],
      { ...SIGNS[1], img: "javascript:alert(1)" },
      { ...SIGNS[2], img: "https://evil.example.com/x.png" },
    ];
    setupDOM(tampered);
    clickYes();
    expect(frontImg().getAttribute("src")).toBe("/placeholder.svg");
    clickYes();
    expect(frontImg().getAttribute("src")).toBe("/placeholder.svg");
  });

  it("does nothing when the payload is malformed or missing", () => {
    expect(() => setupDOM("not-json")).not.toThrow();
    expect(countText()).toBe("");
    expect(() => setupDOM(SIGNS, { withDataEl: false })).not.toThrow();
    expect(countText()).toBe("");
  });

  it("does nothing when the payload is valid JSON but not an array", () => {
    expect(() => setupDOM('{"img":"/signs/sign-301.png"}')).not.toThrow();
    expect(countText()).toBe("");
  });

  it("normalizes null entries and non-string fields without throwing", () => {
    const tampered = JSON.stringify([SIGNS[0], null, { img: 7, alt: 1, name: null, badge: {} }]);
    expect(() => setupDOM(tampered)).not.toThrow();
    clickYes(); // null entry
    expect(frontImg().getAttribute("src")).toBe("/placeholder.svg");
    expect(document.getElementById("fc-name")!.textContent).toBe("");
    clickYes(); // non-string fields
    expect(frontImg().getAttribute("src")).toBe("/placeholder.svg");
    expect(frontImg().alt).toBe("");
    expect(document.getElementById("fc-badge")!.textContent).toBe("");
  });

  it("does nothing when the container is missing", () => {
    document.body.innerHTML = `<span id="fc-count">untouched</span>`;
    expect(() => eval(flashcardScript)).not.toThrow();
    expect(countText()).toBe("untouched");
  });

  describe("SRS grading", () => {
    it("posts the grade for each answered card", () => {
      setupDOM();
      clickYes();
      clickNo();
      expect(srsPosts()).toEqual([
        { sign_id: ID_1, knew: true },
        { sign_id: ID_2, knew: false },
      ]);
    });

    it("does not re-post when a 'don't know' card is replayed", () => {
      setupDOM();
      clickNo(); // card 0 → don't know
      clickYes(); // card 1
      clickNo(); // card 2 → don't know, replay starts at card 0
      clickYes(); // replayed card 0 — already graded
      clickNo(); // replayed card 2 — already graded, re-queued
      clickYes(); // replayed card 2 again
      expect(srsPosts()).toEqual([
        { sign_id: ID_1, knew: false },
        { sign_id: ID_2, knew: true },
        { sign_id: ID_3, knew: false },
      ]);
    });

    it("skips cards without a valid UUID id", () => {
      const tampered = [
        { ...SIGNS[0], id: undefined },
        { ...SIGNS[1], id: "not-a-uuid" },
        SIGNS[2],
      ];
      setupDOM(tampered);
      clickYes();
      clickYes();
      clickYes();
      expect(srsPosts()).toEqual([{ sign_id: ID_3, knew: true }]);
    });

    it("keeps advancing when the POST rejects", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      setupDOM([SIGNS[0]]);
      clickYes();
      await Promise.resolve();
      expect(countText()).toBe("הושלם! 1 כרטיסים");
    });
  });
});
