/** Study-reminder clicks: the cron tags reminder links, since the service worker that opens them cannot reach Pendo. */
(function () {
  const url = new URL(window.location.href);
  if (url.searchParams.get("source") !== "study_reminder") return;

  const channel = url.searchParams.get("channel") === "email" ? "email" : "push";
  const reminderDate = url.searchParams.get("reminder_date");
  ["source", "channel", "reminder_date"].forEach(function (key) {
    url.searchParams.delete(key);
  });
  const landingPath = url.pathname + url.search;

  try {
    if (window.pendo && typeof window.pendo.track === "function") {
      window.pendo.track("push_reminder_clicked", {
        channel: channel,
        notification_url: landingPath,
        opened_new_window: true,
        reminder_local_date: reminderDate || undefined,
      });
    }
  } catch {}

  // Dropping the tag keeps a reload from counting the same click twice.
  try {
    window.history.replaceState(window.history.state, "", landingPath + url.hash);
  } catch {}
})();
