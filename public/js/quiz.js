/** Quiz interactivity: option selection, confirmation, instant feedback, progress, final screen. */
(function () {
  const t = window.__t || {};
  const tf = window.__tf || function(s, v) { return s.replace(/\{(\w+)\}/g, function(_, k) { return v[k] ?? _; }); };

  const container = document.getElementById("quiz-container");
  if (!container) return;

  const total = parseInt(container.dataset.total, 10) || 0;
  if (total === 0) return;

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
  const footer = document.getElementById("quiz-footer");

  let currentIndex = resumed ? resumed.i : 0;
  let selectedOption = null;
  let confirmed = false;
  let answerPersistence = "idle";
  let answerFeedback = "";
  let pendingSubmission = resumed ? resumed.pendingSubmission || null : null;
  let acknowledgedSubmission = resumed
    ? resumed.acknowledgedSubmission || null
    : null;
  let score = resumed ? resumed.score | 0 : 0;
  let points = resumed ? resumed.points | 0 : 0;

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
    answerPersistence = "idle";
    answerFeedback = "";
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

  function showAnswerFeedback(slide, awardReward) {
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
      rewardMessage.textContent = (t.rewardWrongPrefix || "בחרת ב־") + badge + suffix + (t.rewardWrongSuffix || " — לא נורא, תנסי שוב בפעם הבאה.");
    }
  }

  function submissionErrorMessage(data) {
    return data &&
      typeof data.error === "string" &&
      data.error.trim().length > 0
      ? data.error
      : t.saveAnswerError || "לא הצלחנו לשמור את התשובה. נסי שוב.";
  }

  function showRetryableSubmissionFailure(message) {
    answerPersistence = "failed";
    if (rewardMessage) rewardMessage.textContent = message;
    if (actionBtn) {
      actionBtn.textContent = t.retryAnswerBtn || "נסי שוב";
      actionBtn.disabled = false;
    }
  }

  function showPermanentSubmissionFailure(message) {
    answerPersistence = "blocked";
    pendingSubmission = null;
    acknowledgedSubmission = null;
    clearResume();
    if (rewardMessage) rewardMessage.textContent = message;
    if (actionBtn) {
      actionBtn.textContent = t.restartQuizBtn || "התחלה מחדש";
      actionBtn.disabled = false;
    }
  }

  function submitAnswer(slide) {
    if (answerPersistence === "pending") return;
    answerPersistence = "pending";
    if (actionBtn) {
      actionBtn.textContent = t.savingAnswer || "שומרת...";
      actionBtn.disabled = true;
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
          t.saveAnswerError || "לא הצלחנו לשמור את התשובה. נסי שוב."
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
    let request;
    try {
      request = fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, selected_option: selectedOption, topic_id: topicId, session_id: sessionId, idempotency_key: idempotencyKey }),
      });
    } catch {
      showRetryableSubmissionFailure(
        t.saveAnswerError || "לא הצלחנו לשמור את התשובה. נסי שוב."
      );
      return;
    }

    request.then(function (res) {
      if (res.ok) {
        return res.json().catch(function () { return {}; });
      }
      const errorBody =
        typeof res.json === "function"
          ? res.json().catch(function () { return {}; })
          : Promise.resolve({});
      return errorBody.then(function (data) {
        const message = submissionErrorMessage(data);
        if (res.status === 429 || res.status >= 500) {
          showRetryableSubmissionFailure(message);
        } else {
          showPermanentSubmissionFailure(message);
        }
        return null;
      });
    }).then(function (data) {
      if (data === null) return;
      answerPersistence = "succeeded";
      const acknowledged = pendingSubmission;
      if (rewardMessage) rewardMessage.textContent = answerFeedback;
      if (data.topic_completed && rewardMessage) {
        rewardMessage.textContent = t.rewardTopicDone || "כל הכבוד! סיימת את כל הנושא!";
      }
      pendingSubmission = null;
      acknowledgedSubmission = {
        questionId: acknowledged.questionId,
        selectedOption: acknowledged.selectedOption,
        idempotencyKey: acknowledged.idempotencyKey,
        feedbackMessage: rewardMessage ? rewardMessage.textContent : answerFeedback,
      };
      persistResume();
      if (data.medals_earned && data.medals_earned.length) {
        medalQueue.push.apply(medalQueue, data.medals_earned);
        showNextMedal();
      }
      if (actionBtn) {
        actionBtn.textContent = t.nextBtn || "לשאלה הבאה";
        actionBtn.disabled = false;
      }
    }).catch(function () {
      showRetryableSubmissionFailure(
        t.saveAnswerError || "לא הצלחנו לשמור את התשובה. נסי שוב."
      );
    });
  }

  function handleConfirm(slide) {
    confirmed = true;
    lockOptions(slide);
    showAnswerFeedback(slide, true);
    answerFeedback = rewardMessage ? rewardMessage.textContent : "";
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
      if (rewardMessage) {
        rewardMessage.textContent = t.saveAnswerError || "לא הצלחנו לשמור את התשובה. נסי שוב.";
      }
      if (actionBtn) {
        actionBtn.textContent = t.retryAnswerBtn || "נסי שוב";
        actionBtn.disabled = false;
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
        actionBtn.disabled = false;
      }
    }
  }

  function handleAdvance() {
    acknowledgedSubmission = null;
    currentIndex++;
    if (currentIndex >= total) {
      clearResume();
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
    actionBtn.addEventListener("click", function () {
      const slide = slides[currentIndex];
      if (!slide) return;
      if (!confirmed && selectedOption) {
        handleConfirm(slide);
      } else if (answerPersistence === "failed") {
        submitAnswer(slide);
      } else if (answerPersistence === "succeeded") {
        handleAdvance();
      } else if (answerPersistence === "blocked") {
        clearResume();
        window.location.reload();
      }
    });
  }

  if (points > 0 && rewardScore) rewardScore.textContent = String(points);
  showSlide(currentIndex);
  restoreSubmissionState();
})();
