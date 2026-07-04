/** Quiz interactivity: option selection, confirmation, instant feedback, progress, final screen. */
(function () {
  const container = document.getElementById("quiz-container");
  if (!container) return;

  const total = parseInt(container.dataset.total, 10) || 0;
  if (total === 0) return;

  const slides = Array.from(document.querySelectorAll(".quiz-slide"));
  const actionBtn = document.getElementById("quiz-next");
  const progressFill = document.getElementById("quiz-progress-fill");
  const countEl = document.getElementById("quiz-count");
  const rewardBanner = document.getElementById("reward-banner");
  const rewardAmount = document.getElementById("reward-amount");
  const rewardMessage = document.getElementById("reward-message");
  const finalScreen = document.getElementById("quiz-final");
  const finalScore = document.getElementById("final-score");
  const footer = document.getElementById("quiz-footer");

  let currentIndex = 0;
  let selectedOption = null;
  let confirmed = false;
  let score = 0;

  function updateProgress(index) {
    const pct = ((index + 1) / total) * 100;
    if (progressFill) progressFill.style.width = pct + "%";
    if (countEl) countEl.textContent = (index + 1) + " מתוך " + total;
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
      actionBtn.textContent = "בדקי תשובה";
    }
    if (rewardBanner) rewardBanner.hidden = true;
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

    // Clear previous selection
    slide.querySelectorAll(".quiz-option").forEach(function (o) {
      o.dataset.state = "";
    });

    // Select this option
    btn.dataset.state = "selected";
    selectedOption = btn.dataset.option;

    if (actionBtn) actionBtn.disabled = false;
  }

  function handleConfirm(slide) {
    confirmed = true;
    lockOptions(slide);

    const correctOption = slide.dataset.correct;
    const isCorrect = selectedOption === correctOption;

    // Instant visual feedback — no API wait
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
      if (rewardBanner && rewardAmount) {
        rewardBanner.hidden = false;
        rewardBanner.style.display = "flex";
        rewardAmount.textContent = "+10";
        if (rewardMessage) rewardMessage.textContent = "יפה מאוד!";
      }
    } else {
      if (rewardBanner && rewardMessage) {
        rewardBanner.hidden = false;
        rewardBanner.style.display = "flex";
        if (rewardAmount) rewardAmount.textContent = "";
        const wrongBtn = slide.querySelector('[data-option="' + selectedOption + '"]');
        const badge = wrongBtn?.querySelector(".quiz-option-badge")?.textContent?.trim() || "";
        const signNum = wrongBtn?.querySelector("span:not(.quiz-option-badge):not(.quiz-option-explanation) span")?.textContent?.trim() || "";
        const suffix = signNum ? " (תמרור " + signNum + ")" : "";
        rewardMessage.textContent = "בחרת ב" + badge + suffix + " — לא נורא, תנסי שוב בפעם הבאה.";
      }
    }

    // Track answer server-side; update message if this answer completes the topic
    const questionId = slide.dataset.questionId;
    const topicId = container.dataset.topicId || slide.dataset.topicId;
    fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId, selected_option: selectedOption, topic_id: topicId }),
    }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      if (data && data.topic_completed && rewardMessage) {
        rewardMessage.textContent = "כל הכבוד! סיימת את כל הנושא!";
      }
    }).catch(function () {});

    if (actionBtn) {
      actionBtn.textContent = "לשאלה הבאה";
      actionBtn.disabled = false;
    }
  }

  function handleAdvance() {
    currentIndex++;
    if (currentIndex >= total) {
      slides.forEach(function (s) { s.style.display = "none"; });
      if (footer) footer.style.display = "none";
      if (finalScreen) finalScreen.style.display = "flex";
      if (finalScore) finalScore.textContent = score + " מתוך " + total + " נכון";
      if (progressFill) progressFill.style.width = "100%";
      if (countEl) countEl.textContent = total + " מתוך " + total;

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
    } else {
      showSlide(currentIndex);
    }
  }

  // Attach option click handlers
  slides.forEach(function (slide) {
    slide.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.addEventListener("click", handleOptionClick);
    });
  });

  // Action button: dispatches on confirmed state
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

  // Initialize
  showSlide(0);
})();
