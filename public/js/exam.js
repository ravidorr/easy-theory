/** Mock exam interactivity: slide navigation, countdown timer, single submit, results review. */
(function () {
  const t = window.__t || {};
  const tf = window.__tf || function (s, v) { return s.replace(/\{(\w+)\}/g, function (_, k) { return v[k] ?? _; }); };

  const container = document.getElementById("exam-container");
  if (!container) return;

  const total = parseInt(container.dataset.total, 10) || 0;
  if (total === 0) return;

  const durationSeconds = parseInt(container.dataset.durationSeconds, 10) || 2400;
  const sessionId = container.dataset.sessionId || null;
  const expiresAt = Date.parse(container.dataset.expiresAt || "");
  const WARNING_SECONDS = 300;
  const DEFAULT_AUTO_ADVANCE_DELAY_MS = 1125;
  const MIN_AUTO_ADVANCE_DELAY_MS = 750;
  const MAX_AUTO_ADVANCE_DELAY_MS = 3000;
  const AUTO_ADVANCE_DELAY_STEP_MS = 125;
  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const autoAdvanceEnabled = (function () {
    const match = document.cookie.match(/(?:^|;\s*)quiz-auto-advance=([^;]*)/);
    if (match) return decodeURIComponent(match[1]) !== "off";
    return !prefersReducedMotion;
  })();
  const AUTO_ADVANCE_DELAY_MS = (function () {
    const match = document.cookie.match(/(?:^|;\s*)quiz-auto-advance-delay=([^;]*)/);
    const value = match ? Number(match[1]) : NaN;
    return Number.isInteger(value) &&
      value >= MIN_AUTO_ADVANCE_DELAY_MS &&
      value <= MAX_AUTO_ADVANCE_DELAY_MS &&
      (value - MIN_AUTO_ADVANCE_DELAY_MS) % AUTO_ADVANCE_DELAY_STEP_MS === 0
      ? value
      : DEFAULT_AUTO_ADVANCE_DELAY_MS;
  })();

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
  const reviewBar = document.getElementById("exam-review-bar");
  const backToResultsBtn = document.getElementById("exam-back-to-results");
  const errorEl = document.getElementById("exam-error");
  const markReviewBtn = document.getElementById("exam-mark-review");
  const resultSummary = document.getElementById("exam-result-summary");

  let currentIndex = Math.max(0, Math.min(total - 1, parseInt(container.dataset.currentIndex, 10) || 0));
  let answers = {};
  try { answers = JSON.parse(container.dataset.answers || "{}"); } catch {}
  let markedQuestionIds = [];
  try { markedQuestionIds = JSON.parse(container.dataset.markedQuestionIds || "[]"); } catch {}
  let revision = parseInt(container.dataset.revision, 10) || 0;
  const startedAt = Date.parse(container.dataset.startedAt || "") || Date.now();
  let remaining = Number.isFinite(expiresAt)
    ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
    : durationSeconds;
  let submitting = false;
  let submitted = false;
  let timerId = null;
  let autoAdvanceTimer = null;
  let saveInFlight = false;
  let saveQueued = false;

  function persist() {
    if (!sessionId || submitted) return;
    saveQueued = true;
    flushSave();
  }

  function flushSave() {
    if (!saveQueued || saveInFlight || !sessionId || submitted) return;
    saveQueued = false;
    saveInFlight = true;
    const snapshot = {
      session_id: sessionId,
      revision: revision,
      answers: Object.assign({}, answers),
      current_index: currentIndex,
      marked_question_ids: markedQuestionIds.slice(),
    };
    void fetch("/api/exam/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    }).then(function (response) {
      if (response.status === 409) return { conflict: true };
      if (!response.ok) throw new Error("exam session save failed");
      return response.json();
    }).then(function (data) {
      if (data && data.conflict) {
        if (errorEl) {
          errorEl.textContent = t.examSaveConflict || "הסימולציה נפתחה במקום אחר. יש לרענן את הדף.";
          errorEl.hidden = false;
        }
        return;
      }
      if (typeof data.revision === "number") revision = data.revision;
    }).catch(function () {
      if (errorEl) {
        errorEl.textContent = t.examSaveError || "לא ניתן לשמור את מצב הסימולציה.";
        errorEl.hidden = false;
      }
    }).finally(function () {
      saveInFlight = false;
      flushSave();
    });
  }

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

  function cancelAutoAdvance() {
    if (autoAdvanceTimer !== null) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
  }

  function scheduleAutoAdvance(questionIndex) {
    cancelAutoAdvance();
    if (!autoAdvanceEnabled || questionIndex >= total - 1) return;
    autoAdvanceTimer = setTimeout(function () {
      autoAdvanceTimer = null;
      if (!submitted && !submitting && currentIndex === questionIndex) {
        showSlide(questionIndex + 1);
      }
    }, AUTO_ADVANCE_DELAY_MS);
  }

  function tick() {
    remaining = Number.isFinite(expiresAt)
      ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      : Math.max(0, remaining - 1);
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

  function restoreAnswerSelection() {
    slides.forEach(function (slide) {
      const selected = answers[slide.dataset.questionId];
      if (!selected) return;
      slide.querySelectorAll(".quiz-option").forEach(function (option) {
        const isSelected = option.dataset.option === selected;
        option.dataset.state = isSelected ? "selected" : "";
        option.setAttribute("aria-pressed", isSelected ? "true" : "false");
      });
    });
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
    if (markReviewBtn) {
      const questionId = slides[index] && slides[index].dataset.questionId;
      const marked = questionId && markedQuestionIds.includes(questionId);
      markReviewBtn.setAttribute("aria-pressed", marked ? "true" : "false");
    }
    persist();
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
    scheduleAutoAdvance(currentIndex);
    persist();
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

  function showResults(data) {
    // A confirm dialog may still be open if the timer auto-submitted while
    // the user was deliberating; it is moot once results are on screen.
    if (window.modal && window.modal.dismissAll) window.modal.dismissAll();
    decorateSlides(data.results || []);
    slides.forEach(function (s) { s.style.display = "none"; });
    if (footer) footer.style.display = "none";
    if (resultScreen) resultScreen.style.display = "flex";
    container.setAttribute("data-passed", data.passed ? "true" : "false");
    if (resultTitle) {
      if (data.passed) {
        resultTitle.textContent = t.examPassTitle || "עברתם!";
      } else {
        const scoreGap = data.pass_mark - data.score;
        resultTitle.textContent = scoreGap <= 2
          ? (t.examFailNearTitle || t.examFailTitle || "לא נורא, כמעט שם.")
          : scoreGap <= 5
            ? (t.examFailMidTitle || "יש לכם בסיס טוב, התאמנו עוד קצת.")
            : (t.examFailFarTitle || "התחילו לתרגל, ותשתפרו עם הזמן.");
      }
    }
    if (resultScore) {
      const text = tf(t.examResultScore || "{score} מתוך {total} נכון (ציון עובר: {passMark})", {
        score: data.score,
        total: data.total,
        passMark: data.pass_mark,
      });
      resultScore.textContent = text;
    }
    if (resultSummary) {
      const unanswered = data.unanswered_count || 0;
      const used = data.duration_seconds || 0;
      resultSummary.textContent = tf(t.examResultSummary || "נענו {answered} מתוך {total}; זמן: {minutes} דקות; נותרו {unanswered} ללא מענה.", {
        answered: data.total - unanswered,
        total: data.total,
        minutes: Math.max(0, Math.round(used / 60)),
        unanswered: unanswered,
      });
    }
  }

  async function submit(auto) {
    if (submitting || submitted) return;
    if (sessionId && (saveInFlight || saveQueued)) {
      saveQueued = true;
      window.setTimeout(function () { void submit(auto); }, 50);
      return;
    }
    cancelAutoAdvance();
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
      submitBtn.textContent = t.examSubmitting || "המבחן נשלח...";
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
      showResults(data);
      if (data.medals_earned && window.medalCelebration) {
        window.medalCelebration.show(data.medals_earned, {
          fallbackFocus: resultScreen && resultScreen.querySelector("button, a"),
        });
      }
    }).catch(function () {
      submitting = false;
      if (errorEl) {
        errorEl.textContent = t.examSubmitError || "שגיאה בשליחה, נסו שוב?";
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
      if (currentIndex > 0) {
        cancelAutoAdvance();
        showSlide(currentIndex - 1);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (currentIndex < total - 1) {
        cancelAutoAdvance();
        showSlide(currentIndex + 1);
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      void submit(false);
    });
  }

  if (markReviewBtn) {
    markReviewBtn.addEventListener("click", function () {
      const questionId = slides[currentIndex] && slides[currentIndex].dataset.questionId;
      if (!questionId) return;
      if (markedQuestionIds.includes(questionId)) {
        markedQuestionIds = markedQuestionIds.filter(function (id) { return id !== questionId; });
      } else {
        markedQuestionIds.push(questionId);
      }
      markReviewBtn.setAttribute("aria-pressed", markedQuestionIds.includes(questionId) ? "true" : "false");
      persist();
    });
  }

  if (reviewBtn) {
    reviewBtn.addEventListener("click", function () {
      cancelAutoAdvance();
      if (resultScreen) resultScreen.style.display = "none";
      if (timerEl) timerEl.hidden = true;
      if (answeredEl) answeredEl.hidden = true;
      if (reviewBar) reviewBar.hidden = false;
      if (footer) footer.style.display = "flex";
      showSlide(0);
    });
  }

  if (backToResultsBtn) {
    backToResultsBtn.addEventListener("click", function () {
      cancelAutoAdvance();
      slides.forEach(function (slide) { slide.style.display = "none"; });
      if (reviewBar) reviewBar.hidden = true;
      if (footer) footer.style.display = "none";
      if (timerEl) timerEl.hidden = false;
      if (resultScreen) resultScreen.style.display = "flex";
      if (reviewBtn) reviewBtn.focus();
    });
  }

  restoreAnswerSelection();
  showSlide(currentIndex);
  updateAnswered();
  timerId = setInterval(tick, 1000);
})();
