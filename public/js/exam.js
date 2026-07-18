/** Mock exam interactivity: slide navigation, countdown timer, single submit, results review. */
(function () {
  const t = window.__t || {};
  const tf = window.__tf || function (s, v) { return s.replace(/\{(\w+)\}/g, function (_, k) { return v[k] ?? _; }); };

  const container = document.getElementById("exam-container");
  if (!container) return;

  const total = parseInt(container.dataset.total, 10) || 0;
  if (total === 0) return;

  const durationSeconds = parseInt(container.dataset.durationSeconds, 10) || 2400;
  const WARNING_SECONDS = 300;

  const sessionId =
    window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : null;

  const slides = Array.from(document.querySelectorAll(".quiz-slide"));
  const prevBtn = document.getElementById("exam-prev");
  const nextBtn = document.getElementById("exam-next");
  const submitBtn = document.getElementById("exam-submit");
  const timerEl = document.getElementById("exam-timer");
  const progressFill = document.getElementById("exam-progress-fill");
  const countEl = document.getElementById("exam-count");
  const answeredEl = document.getElementById("exam-answered");
  const footer = document.getElementById("exam-footer");
  const resultScreen = document.getElementById("exam-result");
  const resultTitle = document.getElementById("exam-result-title");
  const resultScore = document.getElementById("exam-result-score");
  const reviewBtn = document.getElementById("exam-review-btn");
  const errorEl = document.getElementById("exam-error");

  let currentIndex = 0;
  const answers = {};
  const startedAt = Date.now();
  let remaining = durationSeconds;
  let submitting = false;
  let submitted = false;
  let timerId = null;

  function answeredCount() {
    return Object.keys(answers).length;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function stopTimer() {
    if (timerId != null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function tick() {
    remaining--;
    if (timerEl) {
      timerEl.textContent = formatTime(Math.max(remaining, 0));
      if (remaining <= WARNING_SECONDS) timerEl.setAttribute("data-warning", "");
    }
    if (remaining <= 0) {
      stopTimer();
      void submit(true);
    }
  }

  function updateAnswered() {
    if (answeredEl) {
      answeredEl.textContent = tf(t.examAnswered || "נענו {answered} מתוך {total}", {
        answered: answeredCount(),
        total: total,
      });
    }
  }

  function updateNav() {
    const isLast = currentIndex === total - 1;
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.style.display = isLast ? "none" : "inline-flex";
    if (submitBtn) {
      const showSubmit = !submitted && (isLast || answeredCount() === total);
      submitBtn.style.display = showSubmit ? "inline-flex" : "none";
    }
  }

  function showSlide(index) {
    currentIndex = index;
    slides.forEach(function (s, i) {
      s.style.display = i === index ? "flex" : "none";
    });
    if (progressFill) progressFill.style.width = ((index + 1) / total) * 100 + "%";
    if (countEl) {
      countEl.textContent = tf(t.examCount || "{current} מתוך {total}", {
        current: index + 1,
        total: total,
      });
    }
    updateNav();
  }

  function handleOptionClick(e) {
    if (submitted || submitting) return;
    const btn = e.currentTarget;
    const slide = btn.closest(".quiz-slide");
    if (!slide) return;

    slide.querySelectorAll(".quiz-option").forEach(function (o) {
      o.dataset.state = "";
      o.setAttribute("aria-pressed", "false");
    });
    btn.dataset.state = "selected";
    btn.setAttribute("aria-pressed", "true");
    answers[slide.dataset.questionId] = btn.dataset.option;

    updateAnswered();
    updateNav();
  }

  // Exposes the correct/wrong result to screen readers; visually it is
  // conveyed by color alone via [data-state].
  function appendResultSr(option, text) {
    if (option.querySelector(".quiz-option-sr")) return;
    const sr = document.createElement("span");
    sr.className = "sr-only quiz-option-sr";
    sr.textContent = text;
    option.appendChild(sr);
  }

  function decorateSlides(results) {
    const bySlide = {};
    results.forEach(function (r) {
      bySlide[r.question_id] = r;
    });
    slides.forEach(function (slide) {
      const result = bySlide[slide.dataset.questionId];
      slide.querySelectorAll(".quiz-option").forEach(function (o) {
        o.disabled = true;
        if (!result) return;
        if (o.dataset.option === result.correct_option) {
          o.dataset.state = "correct";
          appendResultSr(o, t.optionCorrectSr || "תשובה נכונה");
        } else if (o.dataset.option === result.selected_option && !result.is_correct) {
          o.dataset.state = "wrong";
          appendResultSr(o, t.optionWrongSr || "תשובה שגויה");
        } else {
          o.dataset.state = "";
        }
      });
    });
  }

  function showResults(data, auto) {
    // A confirm dialog may still be open if the timer auto-submitted while
    // the user was deliberating; it is moot once results are on screen.
    if (window.modal && window.modal.dismissAll) window.modal.dismissAll();
    decorateSlides(data.results || []);
    slides.forEach(function (s) { s.style.display = "none"; });
    if (footer) footer.style.display = "none";
    if (resultScreen) resultScreen.style.display = "flex";
    container.setAttribute("data-passed", data.passed ? "true" : "false");
    if (resultTitle) {
      resultTitle.textContent = data.passed
        ? (t.examPassTitle || "עברנו!")
        : (t.examFailTitle || "לא נורא, כמעט שם.");
    }
    if (resultScore) {
      let text = tf(t.examResultScore || "{score} מתוך {total} נכון (ציון עובר: {passMark})", {
        score: data.score,
        total: data.total,
        passMark: data.pass_mark,
      });
      if (auto) text += " · " + (t.examTimeUp || "הזמן נגמר, המבחן הוגש.");
      resultScore.textContent = text;
    }
  }

  async function submit(auto) {
    if (submitting || submitted) return;
    if (!auto && answeredCount() < total) {
      const unanswered = total - answeredCount();
      const message = tf(t.examConfirmUnanswered || "יש {count} שאלות שלא נענו. להגיש בכל זאת?", {
        count: unanswered,
      });
      const confirmed = window.modal
        ? await window.modal.confirm({ message: message })
        : window.confirm(message);
      // Re-check: a second submit (or the timer) may have fired while the dialog was open.
      if (!confirmed || submitting || submitted) return;
    }

    submitting = true;
    if (errorEl) errorEl.hidden = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = t.examSubmitting || "שולחים...";
    }

    const payload = {
      session_id: sessionId,
      duration_seconds: Math.round((Date.now() - startedAt) / 1000),
      answers: Object.keys(answers).map(function (questionId) {
        return { question_id: questionId, selected_option: answers[questionId] };
      }),
    };

    fetch("/api/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) throw new Error("submit failed");
      return res.json();
    }).then(function (data) {
      submitted = true;
      submitting = false;
      stopTimer();
      showResults(data, auto);
    }).catch(function () {
      submitting = false;
      if (errorEl) {
        errorEl.textContent = t.examSubmitError || "שגיאה בשליחה, שננסה שוב?";
        errorEl.hidden = false;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = t.examSubmit || "הגשת המבחן";
        // Time may have run out — leave the submit button visible so the retry stays possible.
        submitBtn.style.display = "inline-flex";
      }
    });
  }

  slides.forEach(function (slide) {
    slide.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.addEventListener("click", handleOptionClick);
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      if (currentIndex > 0) showSlide(currentIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (currentIndex < total - 1) showSlide(currentIndex + 1);
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      void submit(false);
    });
  }

  if (reviewBtn) {
    reviewBtn.addEventListener("click", function () {
      if (resultScreen) resultScreen.style.display = "none";
      if (footer) footer.style.display = "flex";
      showSlide(0);
    });
  }

  showSlide(0);
  updateAnswered();
  timerId = setInterval(tick, 1000);
})();
