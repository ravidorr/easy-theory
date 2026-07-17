/** Quiz interactivity: one-tap answers, instant feedback, auto-advance, progress, final screen. */
(function () {
  const t = window.__t || {};
  const tf = window.__tf || function(s, v) { return s.replace(/\{(\w+)\}/g, function(_, k) { return v[k] ?? _; }); };

  const container = document.getElementById("quiz-container");
  if (!container) return;

  const total = parseInt(container.dataset.total, 10) || 0;
  if (total === 0) return;
  // Matches the common upper bound for mobile double-tap recognition.
  const TOUCH_DOUBLE_TAP_SUPPRESSION_MS = 300;
  // Matches the 900ms reward-float animation so the slide changes right as
  // the +10 float finishes.
  const AUTO_ADVANCE_DELAY_MS = 900;
  const AUTO_ADVANCE_HINT_KEY = "quiz-auto-advance-hint-seen";
  // Matches the quiz-slide-exit animation (240ms in page.module.css) so the
  // final screen appears right as the last card finishes sliding away.
  const FINAL_EXIT_MS = 240;
  // One silent retry for transient failures (network blip, submission still
  // in flight server-side) before surfacing the failure UI.
  const AUTO_RETRY_DELAY_MS = 1200;
  const COUNT_UP_MS = 700;

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Auto-advance to the next question after a correct answer: an explicit
  // cookie choice (More page toggle) wins; otherwise reduced-motion users
  // keep the manual flow.
  const autoAdvanceEnabled = (function () {
    const match = document.cookie.match(/(?:^|;\s*)quiz-auto-advance=([^;]*)/);
    if (match) return match[1] !== "off";
    return !prefersReducedMotion;
  })();

  // Resume state is persisted per user + topic so a reload continues the same
  // run, including an unacknowledged submission. Retry sessions are throwaway
  // and intentionally never persist.
  const storageKey =
    container.dataset.quizMode === "retry"
      ? null
      : "quiz-resume:v1:" + (container.dataset.userId || "anon") + ":" + (container.dataset.topicId || "topic");

  function readResume() {
    if (!storageKey) return null;
    try {
      return JSON.parse(window.localStorage.getItem(storageKey));
    } catch {
      return null;
    }
  }

  function saveResume(state) {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }

  function clearResume() {
    if (!storageKey) return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
  }

  const resumed = (function () {
    const s = readResume();
    const pending = s && s.pendingSubmission;
    const acknowledged = s && s.acknowledgedSubmission;
    const hasValidPending =
      pending &&
      typeof pending.questionId === "string" &&
      ["a", "b", "c", "d"].includes(pending.selectedOption) &&
      typeof pending.idempotencyKey === "string" &&
      pending.idempotencyKey.length > 0;
    const hasValidAcknowledged =
      acknowledged &&
      typeof acknowledged.questionId === "string" &&
      ["a", "b", "c", "d"].includes(acknowledged.selectedOption) &&
      typeof acknowledged.idempotencyKey === "string" &&
      acknowledged.idempotencyKey.length > 0;
    // A stored total that no longer matches means the question set changed.
    // Index zero is resumable only while a submission state is recorded.
    if (
      s &&
      Number.isInteger(s.i) &&
      s.i >= 0 &&
      s.i < total &&
      s.total === total &&
      (s.i > 0 || hasValidPending || hasValidAcknowledged)
    ) {
      return s;
    }
    if (s) clearResume();
    return null;
  })();

  function createSessionId() {
    const cryptoApi = window.crypto;
    if (!cryptoApi) return null;
    if (typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }
    if (typeof cryptoApi.getRandomValues !== "function") return null;

    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
    return (
      hex.slice(0, 8) +
      "-" +
      hex.slice(8, 12) +
      "-" +
      hex.slice(12, 16) +
      "-" +
      hex.slice(16, 20) +
      "-" +
      hex.slice(20)
    );
  }

  // One session id per quiz run — lets the review page scope mistakes to the
  // latest run. A resumed run keeps its original id.
  const sessionId = (resumed && resumed.sessionId) || createSessionId();
  const submissionSessionKey = sessionId;

  const slides = Array.from(document.querySelectorAll(".quiz-slide"));
  const actionBtn = document.getElementById("quiz-next");
  const progressFill = document.getElementById("quiz-progress-fill");
  const countEl = document.getElementById("quiz-count");
  const rewardScore = document.getElementById("reward-score");
  const rewardFloat = document.getElementById("reward-float");
  const rewardMessage = document.getElementById("reward-message");
  const finalScreen = document.getElementById("quiz-final");
  const finalScore = document.getElementById("final-score");
  const finalXp = document.getElementById("final-xp");
  const footer = document.getElementById("quiz-footer");
  const autoAdvanceHint = document.getElementById("quiz-auto-advance-hint");

  function parseAnsweredIds() {
    try {
      const raw = container.dataset.answeredIds;
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(
        Array.isArray(arr) ? arr.filter(function (id) { return typeof id === "string"; }) : []
      );
    } catch {
      return new Set();
    }
  }

  function firstUnansweredIndex(answered) {
    for (let i = 0; i < slides.length; i++) {
      const qid = slides[i].dataset.questionId;
      if (!qid || !answered.has(qid)) return i;
    }
    return slides.length;
  }

  const answeredIds = storageKey ? parseAnsweredIds() : new Set();
  const firstUnanswered = storageKey ? firstUnansweredIndex(answeredIds) : 0;

  let pendingSubmission = resumed ? resumed.pendingSubmission || null : null;
  let acknowledgedSubmission = resumed
    ? resumed.acknowledgedSubmission || null
    : null;

  function slideHasActiveSubmission(index) {
    const slide = slides[index];
    if (!slide) return false;
    const qid = slide.dataset.questionId;
    if (pendingSubmission && pendingSubmission.questionId === qid) return true;
    if (acknowledgedSubmission && acknowledgedSubmission.questionId === qid) return true;
    return false;
  }

  let currentIndex;
  if (resumed) {
    currentIndex = resumed.i;
  } else if (storageKey) {
    currentIndex = firstUnanswered;
  } else {
    currentIndex = 0;
  }

  if (storageKey && resumed) {
    const slide = slides[currentIndex];
    const qid = slide && slide.dataset.questionId;
    if (qid && answeredIds.has(qid) && !slideHasActiveSubmission(currentIndex)) {
      currentIndex = firstUnanswered;
    }
  }

  let selectedOption = null;
  let confirmed = false;
  let answerPersistence = "idle";
  let answerFeedback = "";
  let score = resumed ? resumed.score | 0 : 0;
  let points = resumed ? resumed.points | 0 : 0;
  let actionActivationIsTouch = false;
  let touchAdvanceSuppressed = false;
  let submissionGeneration = 0;
  let autoRetryUsed = false;
  let autoAdvanceTimer = null;
  let autoAdvanceArmed = false;
  let autoAdvanceElapsed = false;
  let advanceRequested = false;

  function setActionAvailable(available) {
    if (actionBtn) {
      actionBtn.disabled = !available || touchAdvanceSuppressed;
    }
  }

  function actionIsAvailableForPersistenceState() {
    return (
      answerPersistence === "failed" ||
      answerPersistence === "succeeded" ||
      answerPersistence === "blocked"
    );
  }

  function suppressTouchActivation() {
    touchAdvanceSuppressed = true;
    setActionAvailable(false);
    window.setTimeout(function () {
      touchAdvanceSuppressed = false;
      setActionAvailable(actionIsAvailableForPersistenceState());
    }, TOUCH_DOUBLE_TAP_SUPPRESSION_MS);
  }

  function disarmAutoAdvance() {
    if (autoAdvanceTimer !== null) {
      window.clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    autoAdvanceArmed = false;
    autoAdvanceElapsed = false;
    advanceRequested = false;
  }

  // Advances only when the countdown elapsed (or the user asked to skip) AND
  // the submission is persisted, so auto-advance never bypasses the
  // no-advance-on-unsaved-answers guarantee.
  function maybeAutoAdvance() {
    if (!autoAdvanceArmed) return;
    if (answerPersistence !== "succeeded") return;
    if (!autoAdvanceElapsed && !advanceRequested) return;
    handleAdvance();
  }

  function armAutoAdvance() {
    autoAdvanceArmed = true;
    autoAdvanceTimer = window.setTimeout(function () {
      autoAdvanceTimer = null;
      autoAdvanceElapsed = true;
      maybeAutoAdvance();
    }, AUTO_ADVANCE_DELAY_MS);
  }

  // The hint that auto-advance can be turned off shows once per browser
  // session, on the first question only.
  function maybeShowAutoAdvanceHint() {
    if (!autoAdvanceHint || !autoAdvanceEnabled) return;
    try {
      if (sessionStorage.getItem(AUTO_ADVANCE_HINT_KEY)) return;
      sessionStorage.setItem(AUTO_ADVANCE_HINT_KEY, "1");
    } catch {
      return;
    }
    autoAdvanceHint.style.display = "block";
  }

  function hideAutoAdvanceHint() {
    if (autoAdvanceHint) autoAdvanceHint.style.display = "none";
  }

  function persistResume() {
    saveResume({
      i: currentIndex,
      score: score,
      points: points,
      sessionId: sessionId,
      total: total,
      pendingSubmission: pendingSubmission,
      acknowledgedSubmission: acknowledgedSubmission,
      savedAt: Date.now(),
    });
  }

  function persistLatestStats(data) {
    if (
      !data ||
      typeof data.streak_days !== "number" ||
      typeof data.new_total_stars !== "number"
    ) {
      return;
    }
    try {
      sessionStorage.setItem(
        "clearroad:stats",
        JSON.stringify({
          streak_days: data.streak_days,
          star_points: data.new_total_stars,
          savedAt: Date.now(),
        })
      );
    } catch {}
  }

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
    scrim.className = 'modal-scrim';

    const card = document.createElement('div');
    card.className = 'modal-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', t.medalModalLabel || 'מדליה חדשה');

    card.innerHTML =
      '<div class="medal-modal-figure">' +
        '<div class="medal-modal-badge">' +
          '<svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5c.4 2.2 3.1 3.4 3.9 5.8.9 2.7-.8 6-3.9 6s-4.8-3.3-3.9-6c.4-1.3 1.4-2.2 2.2-3.2.8-1 1.5-1.7 1.7-2.6z"/><circle cx="8" cy="10.6" r="2.1" fill="var(--gold-soft)" opacity="0.85"/></svg>' +
        '</div>' +
        '<span class="medal-modal-label">' + meta.label + '</span>' +
      '</div>' +
      '<div class="modal-text">' +
        '<h2 class="modal-title">' + (t.medalModalTitle || 'מדליה חדשה!') + '</h2>' +
        '<span class="modal-message">' + meta.description + '</span>' +
      '</div>' +
      '<button type="button" class="btn-primary">' + (t.medalModalBtn || 'מעולה, נמשיך!') + '</button>';

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

  function revealFinalScreen() {
    slides.forEach(function (s) { s.style.display = "none"; });
    if (footer) footer.style.display = "none";
    if (finalScreen) finalScreen.style.display = "flex";
    updateProgress(total - 1);
  }

  // Eases a counter from 0 to its final value. Kept in this IIFE because the
  // public/js scripts share no modules; stats-pills.js carries a from-to
  // adaptation of it for the dashboard counters.
  // The initial render is synchronous so the value is never blank when rAF
  // frames are suspended (hidden tab).
  function countUp(to, durationMs, render) {
    if (
      prefersReducedMotion ||
      typeof window.requestAnimationFrame !== "function" ||
      to === 0
    ) {
      render(to);
      return;
    }
    render(0);
    let start = null;
    function frame(now) {
      if (start === null) start = now;
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      render(Math.round(to * eased));
      if (progress < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  // Quiet variant: the topic was already finished when the page loaded, so
  // the final screen appears fully formed with no celebration. There is no
  // session XP to show on a revisit (points is always 0 here), so the XP
  // pill is hidden rather than shown as a misleading 0.
  function showAllComplete() {
    revealFinalScreen();
    const answeredCount = parseInt(container.dataset.answeredCount, 10);
    const coverageCount = Number.isFinite(answeredCount) ? answeredCount : total;
    if (finalScore) {
      finalScore.textContent = tf(
        t.finalAllAnswered || "{answered} מתוך {total} שאלות נענו",
        { answered: coverageCount, total: total }
      );
    }
    if (finalXp && finalXp.parentElement) {
      finalXp.parentElement.style.display = "none";
    }
  }

  // Celebration variant: CSS keys the staged pop/confetti/next-lesson
  // animations off data-celebrate while the counters count up here.
  function finishCelebration() {
    revealFinalScreen();
    if (finalScreen) {
      if (!prefersReducedMotion) finalScreen.setAttribute("data-celebrate", "");
      // The activation button was just hidden with the footer; move focus to
      // the final screen so keyboard and screen-reader users are not dropped
      // to the body.
      finalScreen.focus();
    }
    if (finalScore) {
      countUp(score, COUNT_UP_MS, function (value) {
        finalScore.textContent = tf(t.finalScore || '{score} מתוך {total} נכון', { score: value, total: total });
      });
    }
    if (finalXp) {
      countUp(points, COUNT_UP_MS, function (value) {
        finalXp.textContent = String(value);
      });
    }
  }

  function showSlide(index) {
    slides.forEach(function (s, i) {
      s.style.display = i === index ? "flex" : "none";
    });
    updateProgress(index);
    selectedOption = null;
    confirmed = false;
    answerPersistence = "idle";
    answerFeedback = "";
    disarmAutoAdvance();
    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.textContent = t.nextBtn || "לשאלה הבאה";
    }
    if (rewardMessage) rewardMessage.textContent = "";
  }

  function lockOptions(slide) {
    slide.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.disabled = true;
    });
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

  // One-tap flow: tapping an option is the answer. Feedback and submission
  // start immediately; there is no separate confirm step.
  function handleOptionClick(e) {
    if (confirmed) return;
    const btn = e.currentTarget;
    const slide = btn.closest(".quiz-slide");
    if (!slide) return;

    slide.querySelectorAll(".quiz-option").forEach(function (o) {
      o.dataset.state = "";
      o.setAttribute("aria-pressed", "false");
    });

    btn.dataset.state = "selected";
    btn.setAttribute("aria-pressed", "true");
    selectedOption = btn.dataset.option;

    handleConfirm(slide);
  }

  function showAnswerFeedback(slide, awardReward) {
    const correctOption = slide.dataset.correct;
    const isCorrect = selectedOption === correctOption;

    slide.querySelectorAll(".quiz-option").forEach(function (o) {
      if (o.dataset.option === correctOption) {
        o.dataset.state = "correct";
        appendResultSr(o, t.optionCorrectSr || "תשובה נכונה");
      } else if (o.dataset.option === selectedOption && !isCorrect) {
        o.dataset.state = "wrong";
        appendResultSr(o, t.optionWrongSr || "תשובה שגויה");
      } else {
        o.dataset.state = "";
      }
    });

    if (isCorrect) {
      if (awardReward) {
        score++;
        points += 10;
      }
      if (rewardScore) rewardScore.textContent = String(points);
      if (rewardMessage) rewardMessage.textContent = t.rewardCorrect || "יפה מאוד!";
      if (awardReward && rewardFloat) {
        rewardFloat.removeAttribute("data-animate");
        void rewardFloat.offsetWidth;
        rewardFloat.setAttribute("data-animate", "");
      }
    } else if (rewardMessage) {
      const wrongBtn = slide.querySelector('[data-option="' + selectedOption + '"]');
      const badge = wrongBtn?.querySelector(".quiz-option-badge")?.textContent?.trim() || "";
      const signNum = wrongBtn?.querySelector("span:not(.quiz-option-badge):not(.quiz-option-explanation) span")?.textContent?.trim() || "";
      const suffix = signNum ? tf(t.rewardSignSuffix || ' (תמרור {number})', { number: signNum }) : "";
      rewardMessage.textContent = (t.rewardWrongPrefix || "בחרנו ב־") + badge + suffix + (t.rewardWrongSuffix || " - לא נורא, ננסה שוב בפעם הבאה.");
    }

    return isCorrect;
  }

  function submissionErrorMessage(data) {
    return data &&
      typeof data.error === "string" &&
      data.error.trim().length > 0
      ? data.error
      : t.saveAnswerError || "לא הצלחנו לשמור את התשובה. ננסה שוב.";
  }

  function setSubmissionErrorState() {
    if (rewardMessage) rewardMessage.dataset.state = "error";
  }

  function clearSubmissionErrorState() {
    if (rewardMessage) delete rewardMessage.dataset.state;
  }

  function showRetryableSubmissionFailure(message) {
    answerPersistence = "failed";
    disarmAutoAdvance();
    setSubmissionErrorState();
    if (rewardMessage) rewardMessage.textContent = message;
    if (actionBtn) {
      actionBtn.textContent = t.retryAnswerBtn || "לנסות שוב";
      setActionAvailable(true);
    }
  }

  function showPermanentSubmissionFailure(message) {
    answerPersistence = "blocked";
    disarmAutoAdvance();
    pendingSubmission = null;
    acknowledgedSubmission = null;
    clearResume();
    setSubmissionErrorState();
    if (rewardMessage) rewardMessage.textContent = message;
    if (actionBtn) {
      actionBtn.textContent = t.restartQuizBtn || "נתחיל מחדש";
      setActionAvailable(true);
    }
  }

  // One transparent retry per user-initiated attempt, keeping the "saving"
  // button state. Returns false when the retry budget is spent so the caller
  // falls through to the visible failure UI.
  function scheduleAutoRetry(slide) {
    if (autoRetryUsed) return false;
    autoRetryUsed = true;
    const generation = submissionGeneration;
    window.setTimeout(function () {
      if (generation !== submissionGeneration) return;
      submitAnswer(slide, true);
    }, AUTO_RETRY_DELAY_MS);
    return true;
  }

  function submitAnswer(slide, isAutoRetry) {
    if (!isAutoRetry && answerPersistence === "pending") return;
    if (!isAutoRetry) autoRetryUsed = false;
    clearSubmissionErrorState();
    answerPersistence = "pending";
    if (actionBtn) {
      if (autoAdvanceArmed) {
        // During the auto-advance countdown the button is a skip hatch.
        actionBtn.textContent = t.nextBtn || "לשאלה הבאה";
        setActionAvailable(true);
      } else {
        actionBtn.textContent = t.savingAnswer || "שומרים...";
        actionBtn.disabled = true;
      }
    }

    const questionId = slide.dataset.questionId;
    const topicId = container.dataset.topicId || slide.dataset.topicId;
    if (
      !pendingSubmission ||
      pendingSubmission.questionId !== questionId ||
      pendingSubmission.selectedOption !== selectedOption
    ) {
      if (!submissionSessionKey) {
        showPermanentSubmissionFailure(
          t.saveAnswerError || "לא הצלחנו לשמור את התשובה. ננסה שוב."
        );
        return;
      }
      pendingSubmission = {
        questionId: questionId,
        selectedOption: selectedOption,
        idempotencyKey: submissionSessionKey + ":" + questionId,
      };
    }
    acknowledgedSubmission = null;
    persistResume();
    const idempotencyKey = pendingSubmission.idempotencyKey;
    const generation = ++submissionGeneration;
    let request;
    try {
      request = fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, selected_option: selectedOption, topic_id: topicId, session_id: sessionId, idempotency_key: idempotencyKey }),
      });
    } catch {
      if (!scheduleAutoRetry(slide)) {
        showRetryableSubmissionFailure(
          t.saveAnswerError || "לא הצלחנו לשמור את התשובה. ננסה שוב."
        );
      }
      return;
    }

    request.then(function (res) {
      if (generation !== submissionGeneration) return null;
      if (res.ok) {
        return res.json().catch(function () { return {}; });
      }
      const errorBody =
        typeof res.json === "function"
          ? res.json().catch(function () { return {}; })
          : Promise.resolve({});
      return errorBody.then(function (data) {
        const message = submissionErrorMessage(data);
        const code = data && typeof data.code === "string" ? data.code : "";
        // The server saw a concurrent identical submission still in flight;
        // a moment later the stored result replays, so retry silently once.
        if (code === "SUBMISSION_IN_FLIGHT") {
          if (scheduleAutoRetry(slide)) return null;
          showRetryableSubmissionFailure(message);
          return null;
        }
        if (res.status === 429 || res.status >= 500) {
          showRetryableSubmissionFailure(message);
        } else {
          showPermanentSubmissionFailure(message);
        }
        return null;
      });
    }).then(function (data) {
      if (generation !== submissionGeneration) return;
      if (data === null) return;
      answerPersistence = "succeeded";
      clearSubmissionErrorState();
      const acknowledged = pendingSubmission;
      if (rewardMessage) rewardMessage.textContent = answerFeedback;
      if (data.topic_completed && rewardMessage) {
        rewardMessage.textContent = t.rewardTopicDone || "כל הכבוד! סיימנו את כל הנושא!";
      }
      pendingSubmission = null;
      acknowledgedSubmission = {
        questionId: acknowledged.questionId,
        selectedOption: acknowledged.selectedOption,
        idempotencyKey: acknowledged.idempotencyKey,
        feedbackMessage: rewardMessage ? rewardMessage.textContent : answerFeedback,
      };
      persistResume();
      persistLatestStats(data);
      if (data.medals_earned && data.medals_earned.length) {
        medalQueue.push.apply(medalQueue, data.medals_earned);
        showNextMedal();
      }
      // A medal modal or topic-completed message needs the user's attention;
      // never auto-advance past it.
      if ((data.medals_earned && data.medals_earned.length) || data.topic_completed) {
        disarmAutoAdvance();
      }
      if (actionBtn) {
        actionBtn.textContent = t.nextBtn || "לשאלה הבאה";
        setActionAvailable(true);
      }
      maybeAutoAdvance();
    }).catch(function () {
      if (generation !== submissionGeneration) return;
      if (scheduleAutoRetry(slide)) return;
      showRetryableSubmissionFailure(
        t.saveAnswerError || "לא הצלחנו לשמור את התשובה. ננסה שוב."
      );
    });
  }

  function handleConfirm(slide) {
    confirmed = true;
    lockOptions(slide);
    const isCorrect = showAnswerFeedback(slide, true);
    answerFeedback = rewardMessage ? rewardMessage.textContent : "";
    // Wrong answers never auto-advance: the explanation stays until a tap.
    if (isCorrect && autoAdvanceEnabled) armAutoAdvance();
    submitAnswer(slide);
  }

  function restoreSubmissionState() {
    const slide = slides[currentIndex];
    const restoredSubmission = pendingSubmission || acknowledgedSubmission;
    if (!restoredSubmission) return;
    if (!slide || slide.dataset.questionId !== restoredSubmission.questionId) {
      pendingSubmission = null;
      acknowledgedSubmission = null;
      persistResume();
      return;
    }

    selectedOption = restoredSubmission.selectedOption;
    confirmed = true;
    lockOptions(slide);
    showAnswerFeedback(slide, false);
    answerFeedback = rewardMessage ? rewardMessage.textContent : "";

    if (pendingSubmission) {
      answerPersistence = "failed";
      setSubmissionErrorState();
      if (rewardMessage) {
        rewardMessage.textContent = t.saveAnswerError || "לא הצלחנו לשמור את התשובה. ננסה שוב.";
      }
      if (actionBtn) {
        actionBtn.textContent = t.retryAnswerBtn || "ננסה שוב";
        setActionAvailable(true);
      }
    } else {
      answerPersistence = "succeeded";
      if (
        rewardMessage &&
        typeof acknowledgedSubmission.feedbackMessage === "string"
      ) {
        rewardMessage.textContent = acknowledgedSubmission.feedbackMessage;
      }
      if (actionBtn) {
        actionBtn.textContent = t.nextBtn || "לשאלה הבאה";
        setActionAvailable(true);
      }
    }
  }

  function handleAdvance() {
    if (answerPersistence !== "succeeded") return;
    if (currentIndex >= total) return;
    disarmAutoAdvance();
    clearSubmissionErrorState();
    hideAutoAdvanceHint();
    acknowledgedSubmission = null;
    currentIndex++;
    if (currentIndex >= total) {
      clearResume();

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

      // The answered card slides away first; the final screen takes over
      // once its exit animation ends.
      const exitingSlide = slides[currentIndex - 1];
      if (exitingSlide) exitingSlide.setAttribute("data-exit", "");
      if (progressFill) progressFill.setAttribute("data-complete", "");
      if (prefersReducedMotion) {
        finishCelebration();
      } else {
        window.setTimeout(finishCelebration, FINAL_EXIT_MS);
      }
    } else {
      persistResume();
      showSlide(currentIndex);
    }
  }

  slides.forEach(function (slide) {
    slide.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.addEventListener("click", handleOptionClick);
    });
  });

  if (actionBtn) {
    actionBtn.addEventListener("pointerdown", function (event) {
      actionActivationIsTouch = event.pointerType === "touch";
    });

    actionBtn.addEventListener("touchstart", function () {
      actionActivationIsTouch = true;
    }, { passive: true });

    actionBtn.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && event.repeat) {
        event.preventDefault();
      }
    });

    actionBtn.addEventListener("click", function (event) {
      const isTouchActivation = actionActivationIsTouch;
      actionActivationIsTouch = false;
      if (isTouchActivation && touchAdvanceSuppressed) return;

      const slide = slides[currentIndex];
      if (!slide) return;
      if (answerPersistence === "failed") {
        if (isTouchActivation) {
          suppressTouchActivation();
        }
        submitAnswer(slide);
      } else if (answerPersistence === "pending" && autoAdvanceArmed) {
        // Skip requested while the submission is still in flight: advance as
        // soon as it persists.
        advanceRequested = true;
        actionBtn.textContent = t.savingAnswer || "שומרים...";
        actionBtn.disabled = true;
      } else if (answerPersistence === "succeeded" && event.detail <= 1) {
        handleAdvance();
      } else if (answerPersistence === "blocked") {
        clearResume();
        window.location.reload();
      }
    });
  }

  if (points > 0 && rewardScore) rewardScore.textContent = String(points);
  if (!resumed && storageKey && firstUnanswered >= total) {
    showAllComplete();
  } else {
    showSlide(currentIndex);
    restoreSubmissionState();
    maybeShowAutoAdvanceHint();
  }
})();
