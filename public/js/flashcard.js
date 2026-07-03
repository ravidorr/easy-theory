/** Flashcard: flip animation, know/don't-know navigation. */
(function () {
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
  const dontKnow = []; // indices to repeat

  function updateUI(index) {
    const display = index + 1;
    if (countEl) countEl.textContent = "כרטיס " + display + " מתוך " + total;
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

  // Flip on card click
  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      flipped = !flipped;
      card.classList.toggle("flipped", flipped);
    });
  });

  function advance(knew) {
    if (!knew) dontKnow.push(current);

    current++;
    if (current < total) {
      showCard(current);
    } else if (dontKnow.length > 0) {
      // Replay cards the user didn't know
      const next = dontKnow.shift();
      current = next;
      showCard(next);
    } else {
      // All done
      if (countEl) countEl.textContent = "הושלם! " + total + " כרטיסים";
      if (progressFill) progressFill.style.width = "100%";
      cards.forEach(function (c) { c.style.display = "none"; });
      if (yesBtn) yesBtn.disabled = true;
      if (noBtn) noBtn.disabled = true;

      const done = document.createElement("div");
      done.style.cssText = "flex:1;display:flex;align-items:center;justify-content:center;font-size:var(--type-h2-size);color:var(--text-muted);";
      done.textContent = "כל הכרטיסים עברו!";
      container.appendChild(done);
    }
  }

  if (yesBtn) yesBtn.addEventListener("click", function () { advance(true); });
  if (noBtn)  noBtn.addEventListener("click",  function () { advance(false); });

  // Init
  showCard(0);
})();
