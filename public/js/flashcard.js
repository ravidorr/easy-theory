/** Flashcard: flip animation, know/don't-know navigation.
 * The server renders only the first card plus a JSON payload (#fc-data);
 * this script swaps the single card's content as the user advances. */
(function () {
  const t = window.__t || {};
  const tf = window.__tf || function(s, v) { return s.replace(/\{(\w+)\}/g, function(_, k) { return v[k] ?? _; }); };

  const container = document.getElementById("flashcards-container");
  if (!container) return;

  const dataEl = document.getElementById("fc-data");
  let parsed = [];
  try {
    parsed = JSON.parse(dataEl ? dataEl.textContent : "[]") || [];
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) parsed = [];
  // Validate the payload: only same-origin image paths may reach img.src
  // (anything else falls back to the placeholder), and only a well-formed
  // UUID id may be posted back to /api/srs.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const signs = parsed.map(function (entry) {
    const s = entry || {};
    return {
      id: typeof s.id === "string" && UUID_RE.test(s.id) ? s.id : "",
      img: typeof s.img === "string" && /^\/[\w\-./]+$/.test(s.img) ? s.img : "/placeholder.svg",
      alt: typeof s.alt === "string" ? s.alt : "",
      name: typeof s.name === "string" ? s.name : "",
      badge: typeof s.badge === "string" ? s.badge : "",
    };
  });
  const total = signs.length;
  if (total === 0) return;

  const card = container.querySelector(".flashcard-wrap");
  if (!card) return;
  const frontImg = container.querySelector(".fc-front-img");
  const backImg = container.querySelector(".fc-back-img");
  const nameEl = document.getElementById("fc-name");
  const badgeEl = document.getElementById("fc-badge");
  const yesBtn = document.getElementById("fc-yes");
  const noBtn = document.getElementById("fc-no");
  const countEl = document.getElementById("fc-count");
  const progressFill = document.getElementById("fc-progress");

  let current = 0;
  let flipped = false;
  const dontKnow = [];
  let replayMode = false;
  const graded = new Set();

  // Persist the SM-2 grade; fire-and-forget so a failed save never blocks
  // the deck. First answer wins: in-session replays of "don't know" cards
  // are not re-graded.
  function gradeCard(index, knew) {
    const id = signs[index].id;
    if (!id || graded.has(id)) return;
    graded.add(id);
    fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sign_id: id, knew: knew }),
    }).catch(function () {});
  }

  function setImg(img, src, alt) {
    if (!img) return;
    // next/image emits a srcset; the browser ignores a swapped src while it's present.
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.src = src;
    img.alt = alt;
  }

  function attachErrorFallback(img) {
    if (!img) return;
    img.addEventListener("error", function () {
      if (img.src.indexOf("placeholder.svg") !== -1) return;
      img.removeAttribute("srcset");
      img.src = "/placeholder.svg";
    });
  }

  function preload(index) {
    if (index >= 0 && index < total) {
      const img = new Image();
      img.src = signs[index].img;
    }
  }

  function updateUI(index) {
    const display = index + 1;
    if (countEl) countEl.textContent = tf(t.cardCount || 'כרטיס {current} מתוך {total}', { current: display, total: total });
    if (progressFill) progressFill.style.width = (display / total * 100) + "%";
  }

  function renderCard(index) {
    const sign = signs[index];
    setImg(frontImg, sign.img, sign.alt);
    setImg(backImg, sign.img, sign.alt);
    if (nameEl) nameEl.textContent = sign.name;
    if (badgeEl) badgeEl.textContent = sign.badge;
    card.classList.remove("flipped");
    flipped = false;
    updateUI(index);
    preload(index + 1);
    if (dontKnow.length > 0) preload(dontKnow[0]);
  }

  card.addEventListener("click", function () {
    flipped = !flipped;
    card.classList.toggle("flipped", flipped);
  });

  function showDone() {
    if (countEl) countEl.textContent = tf(t.done || 'הושלם! {total} כרטיסים', { total: total });
    if (progressFill) progressFill.style.width = "100%";
    card.style.display = "none";
    if (yesBtn) yesBtn.disabled = true;
    if (noBtn) noBtn.disabled = true;
    const done = document.createElement("div");
    done.style.cssText = "flex:1;display:flex;align-items:center;justify-content:center;font-size:var(--type-h2-size);color:var(--text-muted);";
    done.textContent = t.allDone || "כל הכרטיסים עברו!";
    container.appendChild(done);
  }

  function advance(knew) {
    gradeCard(current, knew);
    if (!knew) dontKnow.push(current);

    if (!replayMode) {
      current++;
      if (current < total) {
        renderCard(current);
      } else if (dontKnow.length > 0) {
        replayMode = true;
        current = dontKnow.shift();
        renderCard(current);
      } else {
        showDone();
      }
    } else {
      if (dontKnow.length > 0) {
        current = dontKnow.shift();
        renderCard(current);
      } else {
        showDone();
      }
    }
  }

  if (yesBtn) yesBtn.addEventListener("click", function () { advance(true); });
  if (noBtn)  noBtn.addEventListener("click",  function () { advance(false); });

  attachErrorFallback(frontImg);
  attachErrorFallback(backImg);

  // Card 0 is server-rendered (optimized); don't re-render it on init.
  updateUI(0);
  preload(1);
})();
