/** Web Push subscription helpers — called from schedule.js */
(function (global) {
  function getVapidKey() {
    const meta = document.querySelector('meta[name="vapid-public-key"]');
    return meta ? meta.content : null;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from(raw, function (c) { return c.charCodeAt(0); });
  }

  function trackEvent(name, properties) {
    try {
      if (global.pendo && typeof global.pendo.track === "function") global.pendo.track(name, properties);
    } catch {}
  }

  async function requestSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";

    const vapidKey = getVapidKey();
    if (!vapidKey) return "missing_vapid_key";

    const permission = await Notification.requestPermission();
    if (permission === "denied") return "permission_denied";
    if (permission !== "granted") return "permission_dismissed";

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const subJson = subscription.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subJson),
    });

    return res.ok ? "subscribed" : "save_failed";
  }

  async function subscribeToPush() {
    let outcome;
    try {
      outcome = await requestSubscription();
    } catch {
      outcome = "error";
    }
    trackEvent("push_opt_in_completed", {
      outcome: outcome,
      permission: typeof Notification !== "undefined" ? Notification.permission : undefined,
      source: "schedule_save",
    });
    return outcome === "subscribed";
  }

  async function unsubscribeFromPush() {
    if (!("serviceWorker" in navigator)) return;

    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }

    await fetch("/api/push/subscribe", { method: "DELETE" });
  }

  global.pushHelpers = { subscribeToPush, unsubscribeFromPush };
})(window);
