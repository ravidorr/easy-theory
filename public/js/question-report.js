/** Question reporting dialog for topic practice and retry-practice slides. */
(function () {
  if (window.__questionReportInit) return;
  window.__questionReportInit = true;

  const t = window.__t || {};
  const FOCUSABLE =
    "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
  let dialogId = 0;

  function label(key, fallback) {
    return t[key] || fallback;
  }

  function openDialog(trigger) {
    const previouslyFocused = document.activeElement;
    const questionId = trigger.dataset.questionId;
    const topicId = trigger.dataset.topicId;
    const locale = window.__locale === "ar" ? "ar" : "he";
    let pending = false;

    const scrim = document.createElement("div");
    scrim.className = "modal-scrim";
    const card = document.createElement("div");
    card.className = "modal-card question-report-dialog";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");

    const title = document.createElement("h2");
    title.className = "modal-title";
    title.id = "question-report-title-" + ++dialogId;
    title.textContent = label("reportTitle", "דיווח על השאלה");
    card.setAttribute("aria-labelledby", title.id);

    const description = document.createElement("p");
    description.className = "modal-message";
    description.textContent = label("reportDescription", "נשלח את פרטי השאלה אוטומטית.");

    const field = document.createElement("label");
    field.className = "question-report-field";
    field.textContent = label("reportCommentLabel", "הערה (לא חובה)");
    const textarea = document.createElement("textarea");
    textarea.maxLength = 1000;
    textarea.rows = 3;
    textarea.placeholder = label("reportCommentPlaceholder", "מה לא תקין בשאלה?");
    textarea.setAttribute("aria-describedby", "question-report-error-" + dialogId);
    field.appendChild(textarea);

    const categoryField = document.createElement("label");
    categoryField.className = "question-report-field";
    categoryField.textContent = label("reportCategoryLabel", "סוג הבעיה");
    const category = document.createElement("select");
    [
      ["unclear", label("reportCategoryUnclear", "השאלה לא ברורה")],
      ["wrong_answer", label("reportCategoryWrong", "תשובה שגויה")],
      ["outdated", label("reportCategoryOutdated", "מידע לא מעודכן")],
      ["image", label("reportCategoryImage", "תמונה לא תקינה")],
      ["wording", label("reportCategoryWording", "ניסוח בעייתי")],
    ].forEach(function (entry) {
      const option = document.createElement("option"); option.value = entry[0]; option.textContent = entry[1]; category.appendChild(option);
    });
    categoryField.appendChild(category);

    const error = document.createElement("p");
    error.className = "question-report-error";
    error.id = "question-report-error-" + dialogId;
    error.setAttribute("role", "alert");
    error.hidden = true;

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn-secondary";
    cancel.textContent = label("reportCancel", "ביטול");
    const send = document.createElement("button");
    send.type = "button";
    send.className = "btn-primary";
    send.textContent = label("reportSend", "שליחה");
    actions.append(cancel, send);

    card.append(title, description, categoryField, field, error, actions);
    scrim.appendChild(card);
    document.body.appendChild(scrim);

    function close() {
      document.removeEventListener("keydown", onKeydown, true);
      scrim.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
    }

    function onKeydown(event) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        close();
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

    function showError(message) {
      error.textContent = message || label("reportError", "לא הצלחנו לשמור את הדיווח. אפשר לנסות שוב.");
      error.hidden = false;
    }

    function setPending(next) {
      pending = next;
      textarea.disabled = next;
      category.disabled = next;
      cancel.disabled = next;
      send.disabled = next;
      send.textContent = next ? label("reportSending", "שולחים...") : label("reportSend", "שליחה");
    }

    function showSuccess() {
      card.replaceChildren(title);
      const success = document.createElement("p");
      success.className = "question-report-success";
      success.setAttribute("role", "status");
      success.textContent = label("reportSent", "הדיווח נשלח. תודה!");
      const done = document.createElement("button");
      done.type = "button";
      done.className = "btn-primary";
      done.textContent = label("reportClose", "סגירה");
      done.addEventListener("click", close);
      card.append(success, done);
      done.focus();
    }

    cancel.addEventListener("click", close);
    send.addEventListener("click", async function () {
      if (pending) return;
      error.hidden = true;
      setPending(true);
      const comment = textarea.value.trim();
      try {
        const response = await fetch("/api/question-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_id: questionId,
            topic_id: topicId,
            locale,
            category: category.value,
            ...(comment ? { comment } : {}),
          }),
        });
        const data = await response.json().catch(function () {
          return {};
        });
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "");
        showSuccess();
      } catch (requestError) {
        setPending(false);
        showError(requestError && requestError.message);
        textarea.focus();
      }
    });

    let pressStartedOnScrim = true;
    scrim.addEventListener("mousedown", function (event) {
      pressStartedOnScrim = event.target === scrim;
    });
    scrim.addEventListener("click", function (event) {
      if (!pending && event.target === scrim && pressStartedOnScrim) close();
      pressStartedOnScrim = true;
    });
    document.addEventListener("keydown", onKeydown, true);
    textarea.focus();
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest(".report-question");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    openDialog(trigger);
  });
})();
