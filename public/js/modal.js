/** Reusable modal dialogs: Promise-returning confirm/alert styled by global .modal-* classes. */
(function () {
  const t = window.__t || {};

  const FOCUSABLE =
    "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

  let titleIdCounter = 0;
  // Close callbacks of currently open dialogs, for dismissAll().
  const openDismissers = [];

  function confirmLabel(options) {
    return options.confirmText || t.modalConfirmBtn || "אישור";
  }

  /**
   * Opens a modal and resolves with the value of the button pressed.
   * Escape and backdrop clicks resolve with dismissValue.
   * options: { message, title?, buttons: [{ label, className, value, autofocus? }], dismissValue }
   */
  function openModal(options) {
    return new Promise(function (resolve) {
      const previouslyFocused = document.activeElement;

      const scrim = document.createElement("div");
      scrim.className = "modal-scrim";

      const card = document.createElement("div");
      card.className = "modal-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");

      const text = document.createElement("div");
      text.className = "modal-text";

      if (options.title) {
        const title = document.createElement("h2");
        title.className = "modal-title";
        title.id = "modal-title-" + ++titleIdCounter;
        title.textContent = options.title;
        text.appendChild(title);
        card.setAttribute("aria-labelledby", title.id);
      } else {
        card.setAttribute("aria-label", options.message);
      }

      const message = document.createElement("p");
      message.className = "modal-message";
      message.textContent = options.message;
      text.appendChild(message);
      card.appendChild(text);

      const actions = document.createElement("div");
      actions.className = "modal-actions";

      function dismiss() {
        close(options.dismissValue);
      }

      function close(value) {
        const i = openDismissers.indexOf(dismiss);
        if (i !== -1) openDismissers.splice(i, 1);
        document.removeEventListener("keydown", onKeydown, true);
        scrim.remove();
        if (previouslyFocused && typeof previouslyFocused.focus === "function") {
          previouslyFocused.focus();
        }
        resolve(value);
      }

      function onKeydown(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          dismiss();
          return;
        }
        if (e.key !== "Tab") return;
        // Keep Tab / Shift+Tab cycling inside the dialog, even when focus
        // fell back to <body> (e.g. after clicking non-focusable modal text).
        const focusable = card.querySelectorAll(FOCUSABLE);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const outside = !card.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === first || outside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || outside)) {
          e.preventDefault();
          first.focus();
        }
      }

      let autofocusBtn = null;
      options.buttons.forEach(function (spec) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = spec.className;
        btn.textContent = spec.label;
        btn.addEventListener("click", function () {
          close(spec.value);
        });
        if (spec.autofocus) autofocusBtn = btn;
        actions.appendChild(btn);
      });
      card.appendChild(actions);

      // Only a press that both started and ended on the backdrop dismisses:
      // a drag that starts inside the card (text selection) and releases over
      // the scrim dispatches click on the scrim too, and must not close.
      let pressStartedOnScrim = true;
      scrim.addEventListener("mousedown", function (e) {
        pressStartedOnScrim = e.target === scrim;
      });
      scrim.addEventListener("click", function (e) {
        const shouldClose = e.target === scrim && pressStartedOnScrim;
        pressStartedOnScrim = true;
        if (shouldClose) dismiss();
      });
      document.addEventListener("keydown", onKeydown, true);

      openDismissers.push(dismiss);
      scrim.appendChild(card);
      document.body.appendChild(scrim);
      if (autofocusBtn) autofocusBtn.focus();
    });
  }

  window.modal = {
    /** Resolves true on confirm, false on cancel / Escape / backdrop. */
    confirm: function (options) {
      return openModal({
        message: options.message,
        title: options.title,
        dismissValue: false,
        buttons: [
          {
            label: confirmLabel(options),
            className: "btn-primary",
            value: true,
          },
          {
            label: options.cancelText || t.modalCancelBtn || "ביטול",
            className: "btn-secondary",
            value: false,
            // Safe default for irreversible actions: Enter cancels, not confirms.
            autofocus: true,
          },
        ],
      });
    },

    /** Resolves when the single OK button is pressed or the dialog is dismissed. */
    alert: function (options) {
      return openModal({
        message: options.message,
        title: options.title,
        dismissValue: undefined,
        buttons: [
          {
            label: confirmLabel(options),
            className: "btn-primary",
            value: undefined,
            autofocus: true,
          },
        ],
      });
    },

    /** Closes every open dialog with its dismiss value (e.g. when the screen behind it changes). */
    dismissAll: function () {
      openDismissers.slice().forEach(function (dismiss) {
        dismiss();
      });
    },
  };
})();
