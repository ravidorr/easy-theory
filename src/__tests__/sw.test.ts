import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const swScript = readFileSync(resolve(__dirname, "../../public/sw.js"), "utf-8");

const ORIGIN = "http://localhost";
const STATIC_CACHE = "clearroad-static-v1";
const PAGES_CACHE = "clearroad-pages-v1";
const IMAGES_CACHE = "clearroad-images-v1";

interface FakeResponse {
  ok: boolean;
  redirected: boolean;
  type: string;
  clone: () => FakeResponse;
}

function makeResponse(overrides: Partial<Omit<FakeResponse, "clone">> = {}): FakeResponse {
  const response: FakeResponse = {
    ok: true,
    redirected: false,
    type: "basic",
    ...overrides,
    clone: () => response,
  };
  return response;
}

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  headers: Headers;
}

function makeRequest(
  path: string,
  init: { method?: string; mode?: string; headers?: Record<string, string>; origin?: string } = {}
): FakeRequest {
  return {
    url: `${init.origin ?? ORIGIN}${path}`,
    method: init.method ?? "GET",
    mode: init.mode ?? "no-cors",
    headers: new Headers(init.headers ?? {}),
  };
}

function requestKey(request: unknown): string {
  return typeof request === "string" ? request : (request as FakeRequest).url;
}

function createCachesMock() {
  const stores = new Map<string, Map<string, FakeResponse>>();
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  return {
    stores,
    seed(name: string, request: FakeRequest, response: FakeResponse) {
      store(name).set(request.url, response);
    },
    async open(name: string) {
      const entries = store(name);
      return {
        async addAll(urls: string[]) {
          urls.forEach((url) => entries.set(url, makeResponse()));
        },
        async match(request: unknown) {
          return entries.get(requestKey(request));
        },
        async put(request: unknown, response: FakeResponse) {
          entries.set(requestKey(request), response);
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
}

type SWHandler = (event: unknown) => void;

let handlers: Record<string, SWHandler>;
let cachesMock: ReturnType<typeof createCachesMock>;
let fetchMock: ReturnType<typeof vi.fn>;
let selfMock: {
  addEventListener: (type: string, fn: SWHandler) => void;
  skipWaiting: ReturnType<typeof vi.fn>;
  clients: {
    claim: ReturnType<typeof vi.fn>;
    matchAll: ReturnType<typeof vi.fn>;
    openWindow: ReturnType<typeof vi.fn>;
  };
  registration: { showNotification: ReturnType<typeof vi.fn> };
  location: { origin: string };
};

function loadServiceWorker() {
  handlers = {};
  selfMock = {
    addEventListener(type: string, fn: SWHandler) {
      handlers[type] = fn;
    },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn(),
    },
    registration: { showNotification: vi.fn() },
    location: { origin: ORIGIN },
  };
  cachesMock = createCachesMock();
  fetchMock = vi.fn();
  vi.stubGlobal("self", selfMock);
  vi.stubGlobal("clients", selfMock.clients);
  vi.stubGlobal("caches", cachesMock);
  vi.stubGlobal("fetch", fetchMock);
  eval(swScript);
}

async function dispatchLifecycle(type: "install" | "activate") {
  const waits: Promise<unknown>[] = [];
  handlers[type]({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
  await Promise.all(waits);
}

async function dispatchFetch(request: FakeRequest) {
  let responded: Promise<FakeResponse> | undefined;
  const respondWith = vi.fn((p: Promise<FakeResponse>) => {
    responded = p;
  });
  handlers["fetch"]({ request, respondWith });
  return { respondWith, response: responded ? await responded : undefined };
}

describe("sw.js", () => {
  beforeEach(() => {
    loadServiceWorker();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("install", () => {
    it("precaches the static app shell and skips waiting", async () => {
      await dispatchLifecycle("install");
      const staticStore = cachesMock.stores.get(STATIC_CACHE)!;
      for (const url of [
        "/manifest.webmanifest",
        "/icons/icon-192.png",
        "/favicon-512.png",
        "/placeholder.svg",
        "/js/auth.js",
        "/js/exam.js",
        "/js/flashcard.js",
        "/js/more.js",
        "/js/push.js",
        "/js/quiz.js",
        "/js/schedule.js",
      ]) {
        expect(staticStore.has(url), url).toBe(true);
      }
      expect(selfMock.skipWaiting).toHaveBeenCalled();
    });
  });

  describe("activate", () => {
    it("deletes stale clearroad caches, keeps current and foreign ones, claims clients", async () => {
      cachesMock.stores.set("clearroad-static-v0", new Map());
      cachesMock.stores.set(STATIC_CACHE, new Map());
      cachesMock.stores.set("some-other-app", new Map());
      await dispatchLifecycle("activate");
      expect(cachesMock.stores.has("clearroad-static-v0")).toBe(false);
      expect(cachesMock.stores.has(STATIC_CACHE)).toBe(true);
      expect(cachesMock.stores.has("some-other-app")).toBe(true);
      expect(selfMock.clients.claim).toHaveBeenCalled();
    });
  });

  describe("fetch - navigations (network-first)", () => {
    const navigate = (path: string) => makeRequest(path, { mode: "navigate" });

    it("serves and caches a successful navigation", async () => {
      const networkResponse = makeResponse();
      fetchMock.mockResolvedValue(networkResponse);
      const { response } = await dispatchFetch(navigate("/he/flashcards"));
      expect(response).toBe(networkResponse);
      expect(cachesMock.stores.get(PAGES_CACHE)!.get(`${ORIGIN}/he/flashcards`)).toBe(
        networkResponse
      );
    });

    it("serves but does not cache a redirected navigation (auth guard)", async () => {
      const redirected = makeResponse({ redirected: true });
      fetchMock.mockResolvedValue(redirected);
      const { response } = await dispatchFetch(navigate("/he/flashcards"));
      expect(response).toBe(redirected);
      expect(cachesMock.stores.get(PAGES_CACHE)!.size).toBe(0);
    });

    it("does not cache an error response", async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: false }));
      await dispatchFetch(navigate("/he/flashcards"));
      expect(cachesMock.stores.get(PAGES_CACHE)!.size).toBe(0);
    });

    it("falls back to the cached page when offline", async () => {
      const cached = makeResponse();
      cachesMock.seed(PAGES_CACHE, navigate("/he/flashcards"), cached);
      fetchMock.mockRejectedValue(new Error("offline"));
      const { response } = await dispatchFetch(navigate("/he/flashcards"));
      expect(response).toBe(cached);
    });

    it("rejects when offline with no cached page", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      let responded: Promise<unknown> | undefined;
      handlers["fetch"]({
        request: navigate("/he/schedule"),
        respondWith: (p: Promise<unknown>) => {
          responded = p;
        },
      });
      await expect(responded).rejects.toThrow("offline");
    });
  });

  describe("fetch - images and static assets (cache-first)", () => {
    it("caches sign images on first fetch and serves from cache after", async () => {
      const networkResponse = makeResponse();
      fetchMock.mockResolvedValue(networkResponse);
      const first = await dispatchFetch(makeRequest("/signs/sign-301.png"));
      expect(first.response).toBe(networkResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const second = await dispatchFetch(makeRequest("/signs/sign-301.png"));
      expect(second.response).toBe(networkResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cachesMock.stores.get(IMAGES_CACHE)!.size).toBe(1);
    });

    it("serves question images from the images cache when offline", async () => {
      const cached = makeResponse();
      cachesMock.seed(IMAGES_CACHE, makeRequest("/questions/3012.jpg"), cached);
      fetchMock.mockRejectedValue(new Error("offline"));
      const { response } = await dispatchFetch(makeRequest("/questions/3012.jpg"));
      expect(response).toBe(cached);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("caches optimized /_next/image responses in the images cache", async () => {
      const networkResponse = makeResponse();
      fetchMock.mockResolvedValue(networkResponse);
      const imageUrl = "/_next/image?url=%2Fsigns%2Fsign-301.png&w=96&q=75";
      const first = await dispatchFetch(makeRequest(imageUrl));
      expect(first.response).toBe(networkResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const second = await dispatchFetch(makeRequest(imageUrl));
      expect(second.response).toBe(networkResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cachesMock.stores.get(IMAGES_CACHE)!.size).toBe(1);
    });

    it("serves hashed _next/static assets cache-first", async () => {
      const cached = makeResponse();
      cachesMock.seed(STATIC_CACHE, makeRequest("/_next/static/chunks/main.js"), cached);
      const { response } = await dispatchFetch(makeRequest("/_next/static/chunks/main.js"));
      expect(response).toBe(cached);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("serves /js/ scripts stale-while-revalidate (cached now, refreshed in background)", async () => {
      const cached = makeResponse();
      const fresh = makeResponse();
      cachesMock.seed(STATIC_CACHE, makeRequest("/js/flashcard.js"), cached);
      fetchMock.mockResolvedValue(fresh);
      const { response } = await dispatchFetch(makeRequest("/js/flashcard.js"));
      expect(response).toBe(cached);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => {
        expect(cachesMock.stores.get(STATIC_CACHE)!.get(`${ORIGIN}/js/flashcard.js`)).toBe(fresh);
      });
    });
  });

  describe("fetch - requests that must never be intercepted", () => {
    it.each([
      ["POST request", makeRequest("/he/flashcards", { method: "POST" })],
      ["API route", makeRequest("/api/quiz")],
      ["cross-origin request", makeRequest("/auth/v1/token", { origin: "https://supabase.example.com" })],
      ["RSC payload (query param)", makeRequest("/he/flashcards?_rsc=abc123")],
      ["RSC payload (header)", makeRequest("/he/flashcards", { headers: { RSC: "1" } })],
      ["the service worker itself", makeRequest("/sw.js")],
    ])("passes %s through to the network", async (_name, request) => {
      const { respondWith } = await dispatchFetch(request);
      expect(respondWith).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("push notifications (regression)", () => {
    it("shows a notification with the pushed payload", async () => {
      const waits: Promise<unknown>[] = [];
      handlers["push"]({
        data: { json: () => ({ title: "כותרת", body: "גוף", url: "/he/" }) },
        waitUntil: (p: Promise<unknown>) => waits.push(p),
      });
      await Promise.all(waits);
      expect(selfMock.registration.showNotification).toHaveBeenCalledWith("כותרת", {
        body: "גוף",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: "/he/" },
      });
    });

    it("falls back to defaults when the push has no data", async () => {
      const waits: Promise<unknown>[] = [];
      handlers["push"]({
        data: null,
        waitUntil: (p: Promise<unknown>) => waits.push(p),
      });
      await Promise.all(waits);
      expect(selfMock.registration.showNotification).toHaveBeenCalledWith("ClearRoad", {
        body: "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: "/" },
      });
    });

    it("opens a window on notification click when none is focused", async () => {
      const waits: Promise<unknown>[] = [];
      const close = vi.fn();
      handlers["notificationclick"]({
        notification: { close, data: { url: "/he/schedule" } },
        waitUntil: (p: Promise<unknown>) => waits.push(p),
      });
      await Promise.all(waits);
      expect(close).toHaveBeenCalled();
      expect(selfMock.clients.openWindow).toHaveBeenCalledWith("/he/schedule");
    });
  });
});
