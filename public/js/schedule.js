/** Schedule setup: day toggle, duration chip radio, notify toggle, save. */
(function () {
  const t = window.__t || {};
  const tf = window.__tf || function(s, v) { return s.replace(/\{(\w+)\}/g, function(_, k) { return v[k] ?? _; }); };

  const saveBtn = document.getElementById("save-schedule-btn");
  if (!saveBtn) return;

  const originalSaveBtnText = saveBtn.textContent;

  const dayPicker = document.getElementById("day-picker");
  const durationPicker = document.getElementById("duration-picker");
  const timeInput = document.getElementById("time-input");
  const notifyToggle = document.getElementById("notify-toggle");
  const daysLabel = document.getElementById("days-label");
  const summaryText = document.getElementById("summary-text");

  const selectedDays = new Set(
    Array.from(document.querySelectorAll(".day-btn[data-selected='true']"))
      .map(function (b) { return parseInt(b.dataset.day, 10); })
  );

  let selectedDuration = parseInt(
    (document.querySelector(".duration-btn[data-selected='true']") || {}).dataset?.duration || "45",
    10
  );

  let notifyOn = notifyToggle ? notifyToggle.dataset.on === "true" : true;

  // Saving returns to More: that is where the user came from, and where
  // the page's own back button points.
  function morePath() {
    var locale = window.__locale || "he";
    return "/" + locale + "/more";
  }

  function showAlert(message) {
    if (window.modal) return window.modal.alert({ message: message });
    alert(message);
    return Promise.resolve();
  }

  function updateSummary() {
    if (daysLabel) {
      daysLabel.textContent = selectedDays.size > 0
        ? tf(t.daysSelected || 'נבחרו {count} ימים', { count: selectedDays.size })
        : (t.daysNone || "טרם נבחרו ימים");
    }
    if (summaryText) {
      summaryText.textContent = selectedDays.size > 0
        ? tf(t.summarySessions || '{count} מפגשים בשבוע, {duration} דק׳ כל אחד', { count: selectedDays.size, duration: selectedDuration })
        : (t.summaryChoose || "נבחר ימים כדי להתחיל");
    }
  }

  if (dayPicker) {
    dayPicker.addEventListener("click", function (e) {
      const btn = e.target.closest(".day-btn");
      if (!btn) return;
      const day = parseInt(btn.dataset.day, 10);
      // Selected styling lives in CSS keyed on [data-selected="true"].
      if (selectedDays.has(day)) {
        selectedDays.delete(day);
        btn.dataset.selected = "false";
        btn.setAttribute("aria-pressed", "false");
      } else {
        selectedDays.add(day);
        btn.dataset.selected = "true";
        btn.setAttribute("aria-pressed", "true");
      }
      updateSummary();
    });
  }

  if (durationPicker) {
    durationPicker.addEventListener("click", function (e) {
      const btn = e.target.closest(".duration-btn");
      if (!btn) return;
      selectedDuration = parseInt(btn.dataset.duration, 10);
      document.querySelectorAll(".duration-btn").forEach(function (b) {
        const active = b === btn;
        b.dataset.selected = active ? "true" : "false";
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
      updateSummary();
    });
  }

  if (notifyToggle) {
    notifyToggle.addEventListener("click", function () {
      notifyOn = !notifyOn;
      notifyToggle.dataset.on = notifyOn ? "true" : "false";
      notifyToggle.setAttribute("aria-checked", notifyOn ? "true" : "false");
      notifyToggle.style.background = notifyOn ? "var(--primary)" : "var(--surface-3)";
      const knob = notifyToggle.querySelector("span");
      if (knob) knob.style.insetInlineStart = notifyOn ? "21px" : "3px";

      if (!notifyOn && window.pushHelpers) {
        window.pushHelpers.unsubscribeFromPush();
      }
    });
  }

  saveBtn.addEventListener("click", async function () {
    if (selectedDays.size === 0) {
      await showAlert(t.needDay || "נבחר לפחות יום אחד ללימוד.");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = t.saving || "שומרים...";

    try {
      const res = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: Array.from(selectedDays),
          start_time: timeInput ? timeInput.value : "17:00",
          duration_minutes: selectedDuration,
          notify: notifyOn,
        }),
      });

      if (!res.ok) throw new Error("save failed");

      if (notifyOn && window.pushHelpers) {
        void window.pushHelpers.subscribeToPush();
      }

      saveBtn.textContent = t.saved || "נשמר!";
      // Fire-and-forget: the toast stays visible while the More page loads.
      // Navigation is deliberately not chained on the toast promise, which
      // can resolve early if another toast replaces it.
      if (window.modal && window.modal.toast) {
        void window.modal.toast({ message: t.savedToast || "התוכנית נשמרה!" });
      }
      setTimeout(function () {
        window.location.href = morePath();
      }, 800);
    } catch {
      // Re-enable and refocus before the alert (disabling blurred the button),
      // so dismissing the modal returns focus to the save button for a retry.
      saveBtn.disabled = false;
      saveBtn.textContent = originalSaveBtnText;
      saveBtn.focus();
      await showAlert(t.saveError || "שגיאה בשמירה, שננסה שוב?");
    }
  });
})();
