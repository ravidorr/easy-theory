/** Quiz interactivity: option selection, confirmation, instant feedback, progress, final screen. */
(function () {
  const t = window.__t || {};
  const tf = window.__tf || function(s, v) { return s.replace(/\{(\w+)\}/g, function(_, k) { return v[k] ?? _; }); };

  const container = document.getElementById("quiz-container");
  if (!container) return;

  const total = parseInt(container.dataset.total, 10) || 0;
  if (total === 0) return;

  const slides = Array.from(document.querySelectorAll(".quiz-slide"));
  const actionBtn = document.getElementById("quiz-next");
  const progressFill = document.getElementById("quiz-progress-fill");
  const countEl = document.getElementById("quiz-count");
  const rewardScore = document.getElementById("reward-score");
  const rewardFloat = document.getElementById("reward-float");
  const rewardMessage = document.getElementById("reward-message");
  const finalScreen = document.getElementById("quiz-final");
  const finalScore = document.getElementById("final-score");
  const footer = document.getElementById("quiz-footer");

  let currentIndex = 0;
  let selectedOption = null;
  let confirmed = false;
  let score = 0;
  let points = 0;

  if (rewardFloat) {
    rewardFloat.addEventListener("animationend", function () {
      rewardFloat.removeAttribute("data-animate");
    });
  }

  // ── Medal celebration ──────────────────────────────────────────
  const MEDAL_META = {
    'streak-3':  { label: t.medal3Label || '3 ימים ברצף',   description: t.medal3Desc || 'שלושה ימים של למידה ברצף, כל הכבוד!' },
    'streak-7':  { label: t.medal7Label || 'שבוע ברצף',     description: t.medal7Desc || 'שבוע שלם של למידה ברצף, מדהים!' },
    'streak-14': { label: t.medal14Label || 'שבועיים ברצף',  description: t.medal14Desc || 'ארבעה עשר ימים ברצף, ממש יפה!' },
    'streak-30': { label: t.medal30Label || 'חודש ברצף',     description: t.medal30Desc || 'חודש שלם ברצף, הישג מדהים!' },
  };

  const medalQueue = [];

  function buildMedalModal(meta) {
    const scrim = document.createElement('div');
    Object.assign(scrim.style, {
      position: 'fixed', inset: '0', zIndex: '100',
      background: 'rgba(24,32,60,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    });

    const card = document.createElement('div');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', t.medalModalLabel || 'מדליה חדשה');
    Object.assign(card.style, {
      background: 'var(--surface)', borderRadius: 'var(--radius-2xl)',
      boxShadow: 'var(--shadow-pop)', padding: '32px 28px 24px',
      width: '100%', maxWidth: '320px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
      textAlign: 'center', fontFamily: 'var(--font-ui)',
      animation: 'medal-pop var(--dur-med) var(--ease-spring)',
    });

    card.innerHTML =
      '<div style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;">' +
        '<div style="width:76px;height:76px;border-radius:50%;background:var(--gold-soft);color:var(--gold-text);border:3px solid var(--gold);display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-card);">' +
          '<svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5c.4 2.2 3.1 3.4 3.9 5.8.9 2.7-.8 6-3.9 6s-4.8-3.3-3.9-6c.4-1.3 1.4-2.2 2.2-3.2.8-1 1.5-1.7 1.7-2.6z"/><circle cx="8" cy="10.6" r="2.1" fill="var(--gold-soft)" opacity="0.85"/></svg>' +
        '</div>' +
        '<span style="font-size:var(--type-caption-size);font-weight:600;color:var(--gold-text);">' + meta.label + '</span>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;">' +
        '<h2 style="margin:0;font-size:var(--type-h2-size);font-weight:var(--type-h2-weight);color:var(--text);">' + (t.medalModalTitle || 'מדליה חדשה! 🎉') + '</h2>' +
        '<span style="font-size:var(--type-small-size);color:var(--text-muted);line-height:var(--line-body);">' + meta.description + '</span>' +
      '</div>' +
      '<button style="font-family:var(--font-ui);font-weight:700;font-size:15.5px;min-height:var(--hit-min);padding:10px 22px;width:100%;border-radius:var(--radius-lg);border:1px solid transparent;cursor:pointer;background:var(--primary);color:var(--text-on-primary);box-shadow:var(--shadow-press);">' + (t.medalModalBtn || 'מעולה, ממשיכות!') + '</button>';

    function dismiss() {
      document.body.removeChild(scrim);
      showNextMedal();
    }

    scrim.addEventListener('click', dismiss);
    card.addEventListener('click', function (e) { e.stopPropagation(); });
    card.querySelector('button').addEventListener('click', dismiss);

    scrim.appendChild(card);
    return scrim;
  }

  function showNextMedal() {
    if (medalQueue.length === 0) return;
    const slug = medalQueue.shift();
    const meta = MEDAL_META[slug];
    if (!meta) { showNextMedal(); return; }
    document.body.appendChild(buildMedalModal(meta));
  }

  function updateProgress(index) {
    const pct = ((index + 1) / total) * 100;
    if (progressFill) progressFill.style.width = pct + "%";
    if (countEl) countEl.textContent = tf(t.count || '{current} מתוך {total}', { current: index + 1, total: total });
  }

  function showSlide(index) {
    slides.forEach(function (s, i) {
      s.style.display = i === index ? "flex" : "none";
    });
    updateProgress(index);
    selectedOption = null;
    confirmed = false;
    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.textContent = t.answerBtn || "צדקתי?";
    }
    if (rewardMessage) rewardMessage.textContent = "";
  }

  function lockOptions(slide) {
    slide.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.disabled = true;
    });
  }

  function handleOptionClick(e) {
    if (confirmed) return;
    const btn = e.currentTarget;
    const slide = btn.closest(".quiz-slide");
    if (!slide) return;

    slide.querySelectorAll(".quiz-option").forEach(function (o) {
      o.dataset.state = "";
    });

    btn.dataset.state = "selected";
    selectedOption = btn.dataset.option;

    if (actionBtn) actionBtn.disabled = false;
  }

  function handleConfirm(slide) {
    confirmed = true;
    lockOptions(slide);

    const correctOption = slide.dataset.correct;
    const isCorrect = selectedOption === correctOption;

    slide.querySelectorAll(".quiz-option").forEach(function (o) {
      if (o.dataset.option === correctOption) {
        o.dataset.state = "correct";
      } else if (o.dataset.option === selectedOption && !isCorrect) {
        o.dataset.state = "wrong";
      } else {
        o.dataset.state = "";
      }
    });

    if (isCorrect) {
      score++;
      points += 10;
      if (rewardScore) rewardScore.textContent = String(points);
      if (rewardMessage) rewardMessage.textContent = t.rewardCorrect || "יפה מאוד!";
      if (rewardFloat) {
        rewardFloat.removeAttribute("data-animate");
        void rewardFloat.offsetWidth;
        rewardFloat.setAttribute("data-animate", "");
      }
    } else {
      if (rewardMessage) {
        const wrongBtn = slide.querySelector('[data-option="' + selectedOption + '"]');
        const badge = wrongBtn?.querySelector(".quiz-option-badge")?.textContent?.trim() || "";
        const signNum = wrongBtn?.querySelector("span:not(.quiz-option-badge):not(.quiz-option-explanation) span")?.textContent?.trim() || "";
        const suffix = signNum ? tf(t.rewardSignSuffix || ' (תמרור {number})', { number: signNum }) : "";
        rewardMessage.textContent = (t.rewardWrongPrefix || "בחרת ב") + badge + suffix + (t.rewardWrongSuffix || " — לא נורא, תנסי שוב בפעם הבאה.");
      }
    }

    // Track answer server-side
    const questionId = slide.dataset.questionId;
    const topicId = container.dataset.topicId || slide.dataset.topicId;
    fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId, selected_option: selectedOption, topic_id: topicId }),
    }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      if (!data) return;
      if (data.topic_completed && rewardMessage) {
        rewardMessage.textContent = t.rewardTopicDone || "כל הכבוד! סיימת את כל הנושא!";
      }
      if (data.medals_earned && data.medals_earned.length) {
        medalQueue.push.apply(medalQueue, data.medals_earned);
        showNextMedal();
      }
    }).catch(function () {});

    if (actionBtn) {
      actionBtn.textContent = t.nextBtn || "לשאלה הבאה";
      actionBtn.disabled = false;
    }
  }

  function handleAdvance() {
    currentIndex++;
    if (currentIndex >= total) {
      slides.forEach(function (s) { s.style.display = "none"; });
      if (footer) footer.style.display = "none";
      if (finalScreen) finalScreen.style.display = "flex";
      if (finalScore) finalScore.textContent = tf(t.finalScore || '{score} מתוך {total} נכון', { score: score, total: total });
      if (progressFill) progressFill.style.width = "100%";
      if (countEl) countEl.textContent = tf(t.count || '{current} מתוך {total}', { current: total, total: total });

      if (container.dataset.quizMode !== "retry") {
        const topicId = container.dataset.topicId;
        if (topicId) {
          const pct = Math.round((score / total) * 100);
          const status = pct >= 80 ? "completed" : "in_progress";
          fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic_id: topicId, score: pct, status }),
          }).catch(function () {});
        }
      }
    } else {
      showSlide(currentIndex);
    }
  }

  slides.forEach(function (slide) {
    slide.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.addEventListener("click", handleOptionClick);
    });
  });

  if (actionBtn) {
    actionBtn.addEventListener("click", function () {
      const slide = slides[currentIndex];
      if (!slide) return;
      if (!confirmed && selectedOption) {
        handleConfirm(slide);
      } else if (confirmed) {
        handleAdvance();
      }
    });
  }

  showSlide(0);
})();
