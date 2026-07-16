import { describe, it, expect, afterEach, vi, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const pushScript = readFileSync(
  resolve(__dirname, "../../../../../public/js/push.js"),
  "utf-8"
);

type PushHelpers = {
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<void>;
};

function loadScript(): PushHelpers {
  eval(pushScript);
  return (window as unknown as { pushHelpers: PushHelpers }).pushHelpers;
}

function addVapidMeta(key = "AQID") {
  const meta = document.createElement("meta");
  meta.name = "vapid-public-key";
  meta.content = key;
  document.head.appendChild(meta);
}

function makeSubscription() {
  return {
    toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

function makeRegistration(subscription: ReturnType<typeof makeSubscription> | null = null) {
  return {
    pushManager: {
      subscribe: vi.fn().mockResolvedValue(makeSubscription()),
      getSubscription: vi.fn().mockResolvedValue(subscription),
    },
  };
}

function stubPushEnvironment({
  registration = makeRegistration(),
  permission = "granted",
  fetchOk = true,
}: {
  registration?: ReturnType<typeof makeRegistration>;
  permission?: string;
  fetchOk?: boolean;
} = {}) {
  vi.stubGlobal("navigator", {
    serviceWorker: {
      ready: Promise.resolve(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
    },
  });
  (window as unknown as { PushManager?: unknown }).PushManager = function () {};
  vi.stubGlobal("Notification", {
    requestPermission: vi.fn().mockResolvedValue(permission),
  });
  const fetchMock = vi.fn().mockResolvedValue({ ok: fetchOk });
  vi.stubGlobal("fetch", fetchMock);
  return { registration, fetchMock };
}

describe("push.js", () => {
  afterEach(() => {
    document.head.querySelector('meta[name="vapid-public-key"]')?.remove();
    delete (window as unknown as { PushManager?: unknown }).PushManager;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("subscribeToPush", () => {
    it("returns false when service workers are unsupported", async () => {
      const { fetchMock } = stubPushEnvironment();
      vi.stubGlobal("navigator", {});
      addVapidMeta();

      const helpers = loadScript();
      await expect(helpers.subscribeToPush()).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns false when PushManager is unsupported", async () => {
      const { fetchMock } = stubPushEnvironment();
      delete (window as unknown as { PushManager?: unknown }).PushManager;
      addVapidMeta();

      const helpers = loadScript();
      await expect(helpers.subscribeToPush()).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns false when the VAPID meta tag is missing", async () => {
      const { fetchMock } = stubPushEnvironment();

      const helpers = loadScript();
      await expect(helpers.subscribeToPush()).resolves.toBe(false);
      expect(
        (Notification.requestPermission as unknown as Mock)
      ).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns false when notification permission is denied", async () => {
      const { registration, fetchMock } = stubPushEnvironment({ permission: "denied" });
      addVapidMeta();

      const helpers = loadScript();
      await expect(helpers.subscribeToPush()).resolves.toBe(false);
      expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("subscribes with the decoded VAPID key and posts the subscription", async () => {
      const { registration, fetchMock } = stubPushEnvironment();
      addVapidMeta("AQID");

      const helpers = loadScript();
      await expect(helpers.subscribeToPush()).resolves.toBe(true);

      expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
      const options = registration.pushManager.subscribe.mock.calls[0][0];
      expect(options.userVisibleOnly).toBe(true);
      expect(options.applicationServerKey).toBeInstanceOf(Uint8Array);
      expect(Array.from(options.applicationServerKey)).toEqual([1, 2, 3]);

      expect(fetchMock).toHaveBeenCalledWith("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://push.example/abc",
          keys: { p256dh: "k", auth: "a" },
        }),
      });
    });

    it("decodes URL-safe base64 characters and padding in the VAPID key", async () => {
      const { registration } = stubPushEnvironment();
      addVapidMeta("_-8"); // base64url of bytes [255, 239], needs padding

      const helpers = loadScript();
      await helpers.subscribeToPush();

      const options = registration.pushManager.subscribe.mock.calls[0][0];
      expect(Array.from(options.applicationServerKey)).toEqual([255, 239]);
    });

    it("returns false when the subscribe API responds non-OK", async () => {
      stubPushEnvironment({ fetchOk: false });
      addVapidMeta();

      const helpers = loadScript();
      await expect(helpers.subscribeToPush()).resolves.toBe(false);
    });

    it("returns false when push subscription throws", async () => {
      const registration = makeRegistration();
      registration.pushManager.subscribe.mockRejectedValue(new Error("push failed"));
      stubPushEnvironment({ registration });
      addVapidMeta();

      const helpers = loadScript();
      await expect(helpers.subscribeToPush()).resolves.toBe(false);
    });
  });

  describe("unsubscribeFromPush", () => {
    it("returns early without a DELETE when service workers are unsupported", async () => {
      const { fetchMock } = stubPushEnvironment();
      vi.stubGlobal("navigator", {});

      const helpers = loadScript();
      await helpers.unsubscribeFromPush();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("unsubscribes the existing subscription and deletes it server-side", async () => {
      const subscription = makeSubscription();
      const registration = makeRegistration(subscription);
      const { fetchMock } = stubPushEnvironment({ registration });

      const helpers = loadScript();
      await helpers.unsubscribeFromPush();

      expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("/api/push/subscribe", {
        method: "DELETE",
      });
    });

    it("still sends the DELETE when no registration exists", async () => {
      stubPushEnvironment();
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);
      vi.stubGlobal("navigator", {
        serviceWorker: {
          getRegistration: vi.fn().mockResolvedValue(undefined),
        },
      });

      const helpers = loadScript();
      await helpers.unsubscribeFromPush();

      expect(fetchMock).toHaveBeenCalledWith("/api/push/subscribe", {
        method: "DELETE",
      });
    });

    it("skips unsubscribing when the registration has no subscription", async () => {
      const registration = makeRegistration(null);
      const { fetchMock } = stubPushEnvironment({ registration });

      const helpers = loadScript();
      await helpers.unsubscribeFromPush();

      expect(registration.pushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("/api/push/subscribe", {
        method: "DELETE",
      });
    });
  });
});
