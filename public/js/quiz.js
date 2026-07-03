/** Quiz interactivity: option selection, API submission, progress, final screen. */
(function () {
  const container = document.getElementById("quiz-container");
  if (!container) return;

  const total = parseInt(container.dataset.total, 10) || 0;
  if (total === 0) return;

  const slides = Array.from(document.querySelectorAll(".quiz-slide"));
  const nextBtn = document.getElementById("quiz-next");
  const progressFill = document.getElementById("quiz-progress-fill");
  const countEl = document.getElementById("quiz-count");
  const rewardBanner = document.getElementById("reward-banner");
  const rewardAmount = document.getElementById("reward-amount");
  const rewardMessage = document.getElementById("reward-message");
  const finalScreen = document.getElementById("quiz-final");
  const finalScore = document.getElementById("final-score");
  const footer = document.getElementById("quiz-footer");

  let currentIndex = 0;
  let answered = false;
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
    answered = false;
    if (nextBtn) nextBtn.disabled = true;
    if (rewardBanner) rewardBanner.hidden = true;
  }

  function lockOptions(slide) {
    slide.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.disabled = true;
    });
  }

  async function handleOptionClick(e) {
    const btn = e.currentTarget;
    const slide = btn.closest(".quiz-slide");
    if (!slide || answered) return;
    answered = true;

    const selected = btn.dataset.option;
    const questionId = slide.dataset.questionId;
    const topicId = container.dataset.topicId || slide.dataset.topicId;

    // Visual: mark selected
    btn.dataset.state = "selected";
    lockOptions(slide);

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, selected_option: selected, topic_id: topicId }),
      });
      const data = await res.json();

      // Apply correct/wrong states
      slide.querySelectorAll(".quiz-option").forEach(function (o) {
        if (o.dataset.option === data.correct_option) {
          o.dataset.state = "correct";
        } else if (o.dataset.option === selected && !data.is_correct) {
          o.dataset.state = "wrong";
        } else {
          o.dataset.state = "";
        }
      });

      if (data.is_correct) {
        score++;
        if (rewardBanner && rewardAmount) {
          rewardBanner.hidden = false;
          rewardBanner.style.display = "flex";
          rewardAmount.textContent = "+" + (data.stars_earned || 10);
          if (rewardMessage) rewardMessage.textContent = "יפה מאוד!";
        }
      } else {
        if (rewardMessage && rewardBanner) {
          rewardBanner.hidden = false;
          rewardBanner.style.display = "flex";
          rewardAmount.textContent = "";
          rewardMessage.textContent = "לא נורא, תנסי שוב בפעם הבאה.";
        }
      }
    } catch (_) {
      // Offline fallback: still advance
    }

    if (nextBtn) nextBtn.disabled = false;
  }

  // Attach option click handlers
  slides.forEach(function (slide) {
    slide.querySelectorAll(".quiz-option").forEach(function (btn) {
      btn.addEventListener("click", handleOptionClick);
    });
  });

  // Next button
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      currentIndex++;
      if (currentIndex >= total) {
        // Show final screen
        slides.forEach(function (s) { s.style.display = "none"; });
        if (footer) footer.style.display = "none";
        if (finalScreen) {
          finalScreen.style.display = "flex";
        }
        if (finalScore) {
          finalScore.textContent = score + " מתוך " + total + " נכון";
        }
        // Update progress to full
        if (progressFill) progressFill.style.width = "100%";
        if (countEl) countEl.textContent = total + " מתוך " + total;

        // POST final progress
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
    });
  }

  // Initialize
  showSlide(0);
})();
