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

  function updateSummary() {
    if (daysLabel) {
      daysLabel.textContent = selectedDays.size > 0
        ? tf(t.daysSelected || 'נבחרו {count} ימים', { count: selectedDays.size })
        : (t.daysNone || "טרם נבחרו ימים");
    }
    if (summaryText) {
      summaryText.textContent = selectedDays.size > 0
        ? tf(t.summarySessions || '{count} מפגשים בשבוע, {duration} דק׳ כל אחד', { count: selectedDays.size, duration: selectedDuration })
        : (t.summaryChoose || "בחרי ימים כדי להתחיל");
    }
  }

  if (dayPicker) {
    dayPicker.addEventListener("click", function (e) {
      const btn = e.target.closest(".day-btn");
      if (!btn) return;
      const day = parseInt(btn.dataset.day, 10);
      if (selectedDays.has(day)) {
        selectedDays.delete(day);
        btn.dataset.selected = "false";
        btn.setAttribute("aria-pressed", "false");
        btn.style.background = "var(--surface)";
        btn.style.color = "var(--text-muted)";
        btn.style.border = "1px solid var(--border-strong)";
        btn.style.fontWeight = "600";
        btn.style.boxShadow = "none";
      } else {
        selectedDays.add(day);
        btn.dataset.selected = "true";
        btn.setAttribute("aria-pressed", "true");
        btn.style.background = "var(--primary)";
        btn.style.color = "#fff";
        btn.style.border = "1px solid transparent";
        btn.style.fontWeight = "700";
        btn.style.boxShadow = "var(--shadow-card)";
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
        b.style.background = active ? "var(--primary)" : "var(--surface)";
        b.style.color = active ? "#fff" : "var(--text-muted)";
        b.style.border = active ? "1px solid transparent" : "1px solid var(--border-strong)";
        b.style.fontWeight = active ? "700" : "600";
        b.style.boxShadow = active ? "var(--shadow-card)" : "none";
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
      alert(t.needDay || "בחרי לפחות יום אחד ללמוד.");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = t.saving || "שומרת...";

    try {
      if (notifyOn && window.pushHelpers) {
        await window.pushHelpers.subscribeToPush();
      }

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

      saveBtn.textContent = t.saved || "נשמר!";
      setTimeout(function () {
        window.location.href = "/";
      }, 800);
    } catch {
      alert(t.saveError || "שגיאה בשמירה, נסי שוב.");
      saveBtn.disabled = false;
      saveBtn.textContent = originalSaveBtnText;
    }
  });
})();
