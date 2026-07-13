/** Flashcard: flip animation, know/don't-know navigation. */
(function () {
  const t = window.__t || {};
  const tf = window.__tf || function(s, v) { return s.replace(/\{(\w+)\}/g, function(_, k) { return v[k] ?? _; }); };

  const container = document.getElementById("flashcards-container");
  if (!container) return;

  const total = parseInt(container.dataset.total, 10) || 0;
  if (total === 0) return;

  const cards = Array.from(container.querySelectorAll(".flashcard-wrap"));
  const yesBtn = document.getElementById("fc-yes");
  const noBtn = document.getElementById("fc-no");
  const countEl = document.getElementById("fc-count");
  const progressFill = document.getElementById("fc-progress");

  let current = 0;
  let flipped = false;
  const dontKnow = [];
  let replayMode = false;

  function updateUI(index) {
    const display = index + 1;
    if (countEl) countEl.textContent = tf(t.cardCount || 'כרטיס {current} מתוך {total}', { current: display, total: total });
    if (progressFill) progressFill.style.width = (display / total * 100) + "%";
  }

  function showCard(index) {
    cards.forEach(function (c, i) {
      c.style.display = i === index ? "flex" : "none";
      c.classList.remove("flipped");
    });
    flipped = false;
    updateUI(index);
  }

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      flipped = !flipped;
      card.classList.toggle("flipped", flipped);
    });
  });

  function showDone() {
    if (countEl) countEl.textContent = tf(t.done || 'הושלם! {total} כרטיסים', { total: total });
    if (progressFill) progressFill.style.width = "100%";
    cards.forEach(function (c) { c.style.display = "none"; });
    if (yesBtn) yesBtn.disabled = true;
    if (noBtn) noBtn.disabled = true;
    const done = document.createElement("div");
    done.style.cssText = "flex:1;display:flex;align-items:center;justify-content:center;font-size:var(--type-h2-size);color:var(--text-muted);";
    done.textContent = t.allDone || "כל הכרטיסים עברו!";
    container.appendChild(done);
  }

  function advance(knew) {
    if (!knew) dontKnow.push(current);

    if (!replayMode) {
      current++;
      if (current < total) {
        showCard(current);
      } else if (dontKnow.length > 0) {
        replayMode = true;
        current = dontKnow.shift();
        showCard(current);
      } else {
        showDone();
      }
    } else {
      if (dontKnow.length > 0) {
        current = dontKnow.shift();
        showCard(current);
      } else {
        showDone();
      }
    }
  }

  if (yesBtn) yesBtn.addEventListener("click", function () { advance(true); });
  if (noBtn)  noBtn.addEventListener("click",  function () { advance(false); });

  showCard(0);
})();
