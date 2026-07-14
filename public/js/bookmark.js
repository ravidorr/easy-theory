/** Bookmark toggle: persists question bookmarks from quiz, retry, review and bookmarks pages. */
(function () {
  if (window.__bookmarkInit) return;
  window.__bookmarkInit = true;

  const t = window.__t || {};

  let liveRegion = null;

  function ensureLiveRegion() {
    if (!liveRegion || !liveRegion.isConnected) {
      liveRegion = document.createElement("div");
      liveRegion.className = "sr-only";
      liveRegion.setAttribute("aria-live", "polite");
      document.body.appendChild(liveRegion);
    }
    return liveRegion;
  }

  // Screen readers only announce changes to live regions that were already in
  // the DOM before the update, so the region must exist before the first error.
  ensureLiveRegion();

  function announce(message) {
    const region = ensureLiveRegion();
    region.textContent = "";
    region.textContent = message;
  }

  function setPressed(btn, pressed) {
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
  }

  async function toggle(btn) {
    if (btn.dataset.busy) return;
    const next = btn.getAttribute("aria-pressed") !== "true";
    btn.dataset.busy = "1";
    setPressed(btn, next);

    try {
      const res = await fetch("/api/bookmarks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: btn.dataset.questionId,
          bookmarked: next,
        }),
      });
      if (!res.ok) throw new Error("bookmark save failed: " + res.status);
    } catch {
      setPressed(btn, !next);
      announce(t.bookmarkSaveError || "שגיאה בשמירה, שננסה שוב?");
    } finally {
      delete btn.dataset.busy;
    }
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".bookmark-toggle");
    if (btn) toggle(btn);
  });
})();
