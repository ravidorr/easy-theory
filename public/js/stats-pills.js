/** Apply quiz-earned stats to home/more counters after client navigation. */
(function () {
  var raw;
  try {
    raw = sessionStorage.getItem("clearroad:stats");
    if (!raw) return;
    var stats = JSON.parse(raw);
    if (typeof stats.streak_days === "number") {
      document.querySelectorAll('[data-stat="streak"]').forEach(function (el) {
        el.textContent = String(stats.streak_days);
      });
    }
    if (typeof stats.star_points === "number") {
      document.querySelectorAll('[data-stat="points"]').forEach(function (el) {
        el.textContent = String(stats.star_points);
      });
    }
    sessionStorage.removeItem("clearroad:stats");
  } catch {}
})();
