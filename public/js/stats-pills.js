/** Apply quiz-earned stats to home/more counters after client navigation. */
(function () {
  var COUNT_UP_MS = 700;
  var reduceMotion = null;

  // Memoized so the media query only runs when a sync actually happens; most
  // page loads have no cached stats and return before any animation.
  function prefersReducedMotion() {
    if (reduceMotion === null) {
      reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return reduceMotion;
  }

  // Adapted from quiz.js countUp (the public/js scripts share no modules),
  // easing from the rendered value instead of 0 because these counters
  // already show the pre-quiz numbers when the sync runs. Hidden tabs get
  // the final value synchronously: rAF frames are suspended there, and the
  // cache is cleared on this pass, so a deferred write would be lost.
  function countUp(from, to, render) {
    if (
      prefersReducedMotion() ||
      document.visibilityState === "hidden" ||
      typeof window.requestAnimationFrame !== "function" ||
      from === to
    ) {
      render(to);
      return;
    }
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var progress = Math.min((now - start) / COUNT_UP_MS, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      render(Math.round(from + (to - from) * eased));
      if (progress < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function animateValue(el, to) {
    var from = parseInt(el.textContent, 10);
    countUp(Number.isFinite(from) ? from : to, to, function (value) {
      el.textContent = String(value);
    });
  }

  function animateStat(name, to) {
    document.querySelectorAll('[data-stat="' + name + '"]').forEach(function (el) {
      animateValue(el, to);
    });
    // The server renders a "start your first..." caption beside a zero stat;
    // drop it when a cached-navigation sync moves the stat above zero.
    if (to > 0) {
      document.querySelectorAll('[data-zero-note="' + name + '"]').forEach(function (el) {
        el.remove();
      });
    }
  }

  // Mirrors levelForPoints in src/lib/gamification.ts, where
  // pointsToReachLevel(l) = unit * (l - 1) * l; the parity test in
  // stats-pills-script.test.ts pins this copy to the TS original. The curve
  // unit comes from the tile's data-level-unit attribute.
  function levelForPoints(points, unit) {
    var safePoints = Math.max(0, Math.floor(points));
    var level = 1;
    while (unit * level * (level + 1) <= safePoints) level += 1;
    var levelBase = unit * (level - 1) * level;
    var pointsForNextLevel = unit * level * (level + 1) - levelBase;
    var pointsIntoLevel = safePoints - levelBase;
    return {
      level: level,
      pointsToNext: pointsForNextLevel - pointsIntoLevel,
      progressPct: Math.round((pointsIntoLevel / pointsForNextLevel) * 100),
    };
  }

  // Re-derives every level tile (number, progress bar, points-to-next
  // caption) from the new points total so a level-crossing quiz never shows
  // new points beside a stale level. The bar animates via its CSS width
  // transition. The caption's localized message rides in a data-template
  // attribute (rendered from the same Home.levelToNext string the server
  // uses, so translators keep a single copy) and is formatted with the
  // shared window.__tf interpolator from the locale layout.
  function updateLevelTiles(points) {
    document.querySelectorAll("[data-level-unit]").forEach(function (tile) {
      var unit = parseInt(tile.getAttribute("data-level-unit"), 10);
      if (!Number.isFinite(unit) || unit <= 0) return;
      var info = levelForPoints(points, unit);
      var value = tile.querySelector('[data-stat="level"]');
      if (value) animateValue(value, info.level);
      var fill = tile.querySelector('[data-stat="level-fill"]');
      if (fill) fill.style.width = info.progressPct + "%";
      var caption = tile.querySelector('[data-stat="level-caption"]');
      var template = caption && caption.getAttribute("data-template");
      if (template) {
        caption.textContent = window.__tf
          ? window.__tf(template, { points: info.pointsToNext })
          : template.replace("{points}", String(info.pointsToNext));
      }
    });
  }

  try {
    var raw = sessionStorage.getItem("clearroad:stats");
    if (!raw) return;
    var stats = JSON.parse(raw);
    if (typeof stats.streak_days === "number") {
      animateStat("streak", stats.streak_days);
    }
    if (typeof stats.star_points === "number") {
      animateStat("points", stats.star_points);
      updateLevelTiles(stats.star_points);
    }
    sessionStorage.removeItem("clearroad:stats");
  } catch {}
})();
