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
        ? (t.saved || "התוכנית האישית נשמרה. עכשיו נבחר את התרגול הבא.")
        : (t.guestReady || "האבחון מוכן. כניסה לחשבון תשמור את התוכנית האישית.");
    }).catch(function () {
      result.hidden = false; result.textContent = t.saveError || "לא הצלחנו לשמור את האבחון. אפשר לנסות שוב.";
    });
  });
  if (root.dataset.authenticated === "true") {
    try {
      const payload = JSON.parse(readPendingDiagnostic() || "null");
      if (payload && Array.isArray(payload.answers) && payload.answers.length === 12) {
        submit(payload).then(function () { localStorage.removeItem(storageKey); });
      }
    } catch {}
  }
})();
