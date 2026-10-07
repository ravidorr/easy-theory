(function () {
  const root = document.getElementById("diagnostic");
  const form = document.getElementById("diagnostic-form");
  const result = document.getElementById("diagnostic-result");
  if (!root || !form || !result) return;
  const t = window.__t || {};
  const storageKey = "easyInTheory:diagnostic:v1";
  const legacyStorageKey = "clearroad:diagnostic:v1";

  function readPendingDiagnostic() {
    const current = localStorage.getItem(storageKey);
    if (current !== null) return current;

    const legacy = localStorage.getItem(legacyStorageKey);
    if (legacy === null) return null;

    localStorage.setItem(storageKey, legacy);
    localStorage.removeItem(legacyStorageKey);
    return legacy;
  }
  async function submit(payload) {
    const response = await fetch("/api/diagnostic", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("diagnostic save failed");
    return response.json();
  }
  function trackEvent(name, properties) {
    try {
      if (window.pendo && typeof window.pendo.track === "function") window.pendo.track(name, properties);
    } catch {}
  }
  function scoreSummary(topicScores) {
    const scores = topicScores && typeof topicScores === "object" ? topicScores : {};
    let correct = 0;
    let total = 0;
    let weakestTopicId;
    let weakestRatio = Infinity;
    Object.keys(scores).forEach(function (topicId) {
      const topicCorrect = Number(scores[topicId] && scores[topicId].correct) || 0;
      const topicTotal = Number(scores[topicId] && scores[topicId].total) || 0;
      correct += topicCorrect;
      total += topicTotal;
      if (topicTotal > 0 && topicCorrect / topicTotal < weakestRatio) {
        weakestRatio = topicCorrect / topicTotal;
        weakestTopicId = topicId;
      }
    });
    return {
      correct_count: correct,
      score_pct: total > 0 ? Math.round((correct / total) * 100) : undefined,
      weakest_topic_id: weakestTopicId,
    };
  }
  function daysUntil(date) {
    const target = date ? new Date(date + "T00:00:00") : null;
    if (!target || isNaN(target.getTime())) return undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const answers = Array.from(form.querySelectorAll("fieldset")).map(function (fieldset) {
      const checked = fieldset.querySelector("input:checked");
      return { question_id: fieldset.dataset.questionId, selected_option: checked && checked.value };
    });
    const payload = { answers: answers, target_exam_date: document.getElementById("diagnostic-target-date").value || null };
    submit(payload).then(function (data) {
      if (!data.saved) localStorage.setItem(storageKey, JSON.stringify(payload));
      result.hidden = false;
      result.textContent = data.saved
        ? (t.saved || "התוכנית האישית נשמרה. עכשיו בחרו את התרגול הבא.")
        : (t.guestReady || "האבחון מוכן. כניסה לחשבון תשמור את התוכנית האישית.");
      trackEvent("diagnostic_completed", Object.assign({
        saved_to_account: data.saved === true,
        is_authenticated: root.dataset.authenticated === "true",
        answered_count: payload.answers.length,
        has_target_exam_date: Boolean(payload.target_exam_date),
        days_until_target_exam: daysUntil(payload.target_exam_date),
      }, scoreSummary(data.topic_scores)));
    }).catch(function () {
      result.hidden = false; result.textContent = t.saveError || "לא ניתן לשמור את האבחון. אפשר לנסות שוב.";
    });
  });
  if (root.dataset.authenticated === "true") {
    try {
      const payload = JSON.parse(readPendingDiagnostic() || "null");
      if (payload && Array.isArray(payload.answers) && payload.answers.length === 12) {
        submit(payload).then(function (data) {
          localStorage.removeItem(storageKey);
          if (!data || !data.saved) return;
          trackEvent("guest_diagnostic_saved_to_account", {
            answered_count: payload.answers.length,
            correct_count: scoreSummary(data.topic_scores).correct_count,
            has_target_exam_date: Boolean(payload.target_exam_date),
            days_until_target_exam: daysUntil(payload.target_exam_date),
          });
        });
      }
    } catch {}
  }
})();
