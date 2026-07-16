import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const statsPillsScript = readFileSync(
  resolve(__dirname, "../../../../public/js/stats-pills.js"),
  "utf-8"
);

describe("stats-pills.js", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span data-stat="streak">0</span>
      <span data-stat="points">0</span>
    `;
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("applies stored stats to dashboard counters and clears the cache", () => {
    sessionStorage.setItem(
      "clearroad:stats",
      JSON.stringify({ streak_days: 1, star_points: 10 })
    );

    eval(statsPillsScript);

    expect(document.querySelector('[data-stat="streak"]')!.textContent).toBe("1");
    expect(document.querySelector('[data-stat="points"]')!.textContent).toBe("10");
    expect(sessionStorage.getItem("clearroad:stats")).toBeNull();
  });

  it("leaves counters unchanged when no cached stats exist", () => {
    eval(statsPillsScript);

    expect(document.querySelector('[data-stat="streak"]')!.textContent).toBe("0");
    expect(document.querySelector('[data-stat="points"]')!.textContent).toBe("0");
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

    expect(document.querySelector('[data-stat="streak"]')!.textContent).toBe("0");
    expect(document.querySelector('[data-stat="points"]')!.textContent).toBe("0");
    expect(sessionStorage.getItem("clearroad:stats")).toBeNull();
  });
});
