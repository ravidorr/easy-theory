/** Shared medal celebration for quiz and exam responses. */
(function () {
  const t = window.__t || {};
  const MEDAL_META = {
    "streak-3": { label: t.medal3Label || "3 ימים ברצף", description: t.medal3Desc || "שלושה ימים של למידה ברצף, כל הכבוד!" },
    "streak-7": { label: t.medal7Label || "שבוע ברצף", description: t.medal7Desc || "שבוע שלם של למידה ברצף, מדהים!" },
    "streak-14": { label: t.medal14Label || "שבועיים ברצף", description: t.medal14Desc || "ארבעה עשר ימים ברצף, ממש יפה!" },
    "streak-30": { label: t.medal30Label || "חודש ברצף", description: t.medal30Desc || "חודש שלם ברצף, הישג מדהים!" },
    "first-topic": { label: t.achievementFirstTopicLabel || "נושא ראשון הושלם", description: t.achievementFirstTopicDesc || "סיימנו נושא שלם. ממשיכים כך!" },
    "questions-100": { label: t.achievementQuestions100Label || "100 שאלות נענו", description: t.achievementQuestions100Desc || "ענינו על 100 שאלות. הדרך למבחן ברורה יותר." },
    "all-topics": { label: t.achievementAllTopicsLabel || "כל הנושאים הושלמו", description: t.achievementAllTopicsDesc || "סיימנו את כל נושאי הלימוד. מוכנים לחזרה ולמבחן." },
    "exam-pass": { label: t.achievementExamPassLabel || "עברנו סימולציה", description: t.achievementExamPassDesc || "עברנו את הסימולציה. עבודה מצוינת!" },
  };
  const medalQueue = [];
  const FOCUSABLE =
    "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

  function canRestoreFocus(element) {
    return Boolean(
      element &&
        element.isConnected &&
        element.matches(FOCUSABLE) &&
        !element.disabled &&
        getComputedStyle(element).display !== "none" &&
        getComputedStyle(element).visibility !== "hidden"
    );
  }

  function buildMedalModal(meta, fallbackFocus) {
    const previouslyFocused = document.activeElement;
    const scrim = document.createElement("div");
    scrim.className = "modal-scrim";
    const card = document.createElement("div");
    card.className = "modal-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", t.medalModalLabel || "מדליה חדשה");
    card.innerHTML = '<div class="medal-modal-figure"><div class="medal-modal-badge"><svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5c.4 2.2 3.1 3.4 3.9 5.8.9 2.7-.8 6-3.9 6s-4.8-3.3-3.9-6c.4-1.3 1.4-2.2 2.2-3.2.8-1 1.5-1.7 1.7-2.6z"/><circle cx="8" cy="10.6" r="2.1" fill="var(--gold-soft)" opacity="0.85"/></svg></div><span class="medal-modal-label">' + meta.label + '</span></div><div class="modal-text"><h2 class="modal-title">' + (t.medalModalTitle || "מדליה חדשה!") + '</h2><span class="modal-message">' + meta.description + '</span></div><button type="button" class="btn-primary">' + (t.medalModalBtn || "מעולה, נמשיך!") + "</button>";
    function restoreFocus() {
      const target = canRestoreFocus(previouslyFocused)
        ? previouslyFocused
        : fallbackFocus;
      if (canRestoreFocus(target) && typeof target.focus === "function") target.focus();
    }

    function dismiss() {
      document.removeEventListener("keydown", onKeydown, true);
      scrim.remove();
      if (medalQueue.length > 0) {
        showNextMedal(fallbackFocus);
      } else {
        restoreFocus();
      }
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = card.querySelectorAll(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const outside = !card.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }
    let pressStartedOnScrim = true;
    scrim.addEventListener("mousedown", function (event) {
      pressStartedOnScrim = event.target === scrim;
    });
    scrim.addEventListener("click", function (event) {
      const shouldDismiss = event.target === scrim && pressStartedOnScrim;
      pressStartedOnScrim = true;
      if (shouldDismiss) dismiss();
    });
    document.addEventListener("keydown", onKeydown, true);
    card.querySelector("button").addEventListener("click", dismiss);
    scrim.appendChild(card);
    document.body.appendChild(scrim);
    card.querySelector("button").focus();
  }

  function showNextMedal(fallbackFocus) {
    if (medalQueue.length === 0) return;
    const meta = MEDAL_META[medalQueue.shift()];
    if (!meta) return showNextMedal(fallbackFocus);
    buildMedalModal(meta, fallbackFocus);
  }

  window.medalCelebration = {
    show: function (slugs, options) {
      if (!Array.isArray(slugs)) return;
      medalQueue.push.apply(medalQueue, slugs);
      showNextMedal(options && options.fallbackFocus);
    },
  };
})();
