/** Apply quiz-earned stats to home/more counters after client navigation. */
(function () {
  var raw;
  try {
    raw = sessionStorage.getItem("clearroad:stats");
    if (!raw) return;
    var stats = JSON.parse(raw);
    var streakEl = document.querySelector('[data-stat="streak"]');
    var pointsEl = document.querySelector('[data-stat="points"]');
    if (streakEl && typeof stats.streak_days === "number") {
      streakEl.textContent = String(stats.streak_days);
    }
    if (pointsEl && typeof stats.star_points === "number") {
      pointsEl.textContent = String(stats.star_points);
    }
    sessionStorage.removeItem("clearroad:stats");
  } catch {}
})();
