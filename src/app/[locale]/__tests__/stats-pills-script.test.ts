import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { LEVEL_CURVE_UNIT, levelForPoints } from "@/lib/gamification";

const statsPillsScript = readFileSync(
  resolve(__dirname, "../../../../public/js/stats-pills.js"),
  "utf-8"
);

const COUNT_UP_MS = 700;

function levelTileHTML(opts: {
  unit?: string;
  level: number;
  width: string;
  caption: string;
} ) {
  return `
    <div data-level-unit="${opts.unit ?? "60"}">
      <span data-stat="level">${opts.level}</span>
      <div data-stat="level-fill" style="width: ${opts.width}"></div>
      <span data-stat="level-caption" data-template="עוד {points} נקודות לרמה הבאה">${opts.caption}</span>
    </div>
  `;
}

function statText(name: string) {
  return document.querySelector(`[data-stat="${name}"]`)!.textContent;
}

function settle() {
  vi.advanceTimersByTime(COUNT_UP_MS + 100);
}

// Fake timers drive requestAnimationFrame so the count-up frames run
// deterministically and never leak into a later test.
describe("stats-pills.js", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <span data-stat="streak">3</span>
      <span data-stat="points">40</span>
    `;
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("counts the pills up to the stored stats and clears the cache", () => {
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 4, star_points: 70 })
    );

    eval(statsPillsScript);
    settle();

    expect(statText("streak")).toBe("4");
    expect(statText("points")).toBe("70");
    expect(sessionStorage.getItem("clearroad:stats")).toBeNull();
  });

  it("eases from the rendered value, not from zero", () => {
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 3, star_points: 1040 })
    );

    eval(statsPillsScript);
    vi.advanceTimersByTime(48);

    const midway = parseInt(statText("points")!, 10);
    expect(midway).toBeGreaterThanOrEqual(40);
    expect(midway).toBeLessThan(1040);
  });

  it("leaves counters unchanged when no cached stats exist", () => {
    eval(statsPillsScript);
    settle();

    expect(statText("streak")).toBe("3");
    expect(statText("points")).toBe("40");
  });

  it("updates every element carrying the same data-stat attribute", () => {
    document.body.innerHTML = `
      <span data-stat="streak">0</span>
      <span data-stat="streak">0</span>
      <span data-stat="points">0</span>
      <span data-stat="points">0</span>
    `;
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 4, star_points: 70 })
    );

    eval(statsPillsScript);
    settle();

    const streaks = [...document.querySelectorAll('[data-stat="streak"]')];
    const points = [...document.querySelectorAll('[data-stat="points"]')];
    expect(streaks.map((el) => el.textContent)).toEqual(["4", "4"]);
    expect(points.map((el) => el.textContent)).toEqual(["70", "70"]);
  });

  it("skips stats that are missing or not numbers", () => {
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: "bad" })
    );

    eval(statsPillsScript);
    settle();

    expect(statText("streak")).toBe("3");
    expect(statText("points")).toBe("40");
    expect(sessionStorage.getItem("clearroad:stats")).toBeNull();
  });

  it("sets final values immediately under reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 4, star_points: 70 })
    );

    eval(statsPillsScript);

    expect(statText("streak")).toBe("4");
    expect(statText("points")).toBe("70");
  });

  it("sets final values immediately when requestAnimationFrame is unavailable", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 4, star_points: 70 })
    );

    eval(statsPillsScript);

    expect(statText("streak")).toBe("4");
    expect(statText("points")).toBe("70");
  });

  it("writes final values synchronously in a hidden tab, where rAF never fires", () => {
    // The cache is cleared on this pass, so a write deferred to a suspended
    // rAF frame would lose the stats entirely.
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    try {
      sessionStorage.setItem(
        "clearroad:stats",
        JSON.stringify({ streak_days: 4, star_points: 70 })
      );

      eval(statsPillsScript);

      expect(statText("streak")).toBe("4");
      expect(statText("points")).toBe("70");
      expect(sessionStorage.getItem("clearroad:stats")).toBeNull();
    } finally {
      delete (document as { visibilityState?: string }).visibilityState;
    }
  });

  it("re-derives the level tile when the new points cross a level", () => {
    // Unit 60: level 2 starts at 120 and spans 240 points, so 130 points is
    // level 2, 4% into the bar, with 230 points to the next level.
    document.body.innerHTML += levelTileHTML({
      level: 1,
      width: "92%",
      caption: "עוד 10 נקודות לרמה הבאה",
    });
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 3, star_points: 130 })
    );

    eval(statsPillsScript);
    settle();

    expect(statText("level")).toBe("2");
    expect(
      (document.querySelector('[data-stat="level-fill"]') as HTMLElement).style.width
    ).toBe("4%");
    expect(statText("level-caption")).toBe("עוד 230 נקודות לרמה הבאה");
  });

  it("refreshes the bar and caption when the points stay within the level", () => {
    document.body.innerHTML += levelTileHTML({
      level: 1,
      width: "33%",
      caption: "עוד 80 נקודות לרמה הבאה",
    });
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 3, star_points: 90 })
    );

    eval(statsPillsScript);
    settle();

    expect(statText("level")).toBe("1");
    expect(
      (document.querySelector('[data-stat="level-fill"]') as HTMLElement).style.width
    ).toBe("75%");
    expect(statText("level-caption")).toBe("עוד 30 נקודות לרמה הבאה");
  });

  it("handles a level cell without a bar or caption (More page)", () => {
    document.body.innerHTML += `
      <div data-level-unit="60"><span data-stat="level">1</span></div>
    `;
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 3, star_points: 130 })
    );

    eval(statsPillsScript);
    settle();

    expect(statText("level")).toBe("2");
  });

  it("formats the caption through the shared window.__tf interpolator when present", () => {
    // Same implementation the locale layout injects.
    vi.stubGlobal("__tf", (s: string, v: Record<string, unknown>) =>
      s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? _))
    );
    document.body.innerHTML += levelTileHTML({
      level: 1,
      width: "92%",
      caption: "עוד 10 נקודות לרמה הבאה",
    });
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 3, star_points: 130 })
    );

    eval(statsPillsScript);
    settle();

    expect(statText("level-caption")).toBe("עוד 230 נקודות לרמה הבאה");
  });

  it("matches src/lib/gamification.ts levelForPoints for the real curve unit", () => {
    // The script mirrors the TS level math because public/js cannot import
    // modules; this parity check fails if either copy's curve changes alone.
    for (const points of [0, 59, 60, 119, 120, 130, 360, 3080, 3400, 9999]) {
      const expected = levelForPoints(points);
      document.body.innerHTML = levelTileHTML({
        unit: String(LEVEL_CURVE_UNIT),
        level: 1,
        width: "0%",
        caption: "עוד 0 נקודות לרמה הבאה",
      });
      sessionStorage.setItem(
        "clearroad:stats",
        JSON.stringify({ streak_days: 1, star_points: points })
      );

      eval(statsPillsScript);
      settle();

      expect(statText("level")).toBe(String(expected.level));
      expect(
        (document.querySelector('[data-stat="level-fill"]') as HTMLElement).style
          .width
      ).toBe(`${Math.round(expected.progress * 100)}%`);
      expect(statText("level-caption")).toBe(
        `עוד ${expected.pointsForNextLevel - expected.pointsIntoLevel} נקודות לרמה הבאה`
      );
    }
  });

  it("ignores level tiles with a missing or invalid curve unit", () => {
    document.body.innerHTML += levelTileHTML({
      unit: "0",
      level: 1,
      width: "92%",
      caption: "עוד 10 נקודות לרמה הבאה",
    });
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 3, star_points: 130 })
    );

    eval(statsPillsScript);
    settle();

    expect(statText("level")).toBe("1");
    expect(statText("level-caption")).toBe("עוד 10 נקודות לרמה הבאה");
  });
});
