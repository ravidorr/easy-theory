import { describe, it, expect } from "vitest";
import {
  getApiTranslator,
  getNotifyTranslator,
  getRequestLocale,
  parseJsonBody,
} from "../api";
import heMessages from "../../../messages/he.json";
import arMessages from "../../../messages/ar.json";

function makeRequest(body: string) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function requestWithCookie(cookie?: string) {
  return new Request("http://localhost/api/test", {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("parseJsonBody", () => {
  it("returns the parsed object for a valid JSON object body", async () => {
    const result = await parseJsonBody(makeRequest('{"a": 1, "b": "x"}'));
    expect(result).toEqual({ a: 1, b: "x" });
  });

  it("returns null for malformed JSON", async () => {
    expect(await parseJsonBody(makeRequest("{not json"))).toBeNull();
  });

  it("returns null for an empty body", async () => {
    expect(await parseJsonBody(makeRequest(""))).toBeNull();
  });

  it("returns null for non-object JSON values", async () => {
    expect(await parseJsonBody(makeRequest("5"))).toBeNull();
    expect(await parseJsonBody(makeRequest('"text"'))).toBeNull();
    expect(await parseJsonBody(makeRequest("null"))).toBeNull();
    expect(await parseJsonBody(makeRequest("[1, 2]"))).toBeNull();
  });
});

describe("getRequestLocale", () => {
  it("falls back to the default locale when there is no cookie header", () => {
    expect(getRequestLocale(requestWithCookie())).toBe("he");
  });

  it("reads the NEXT_LOCALE cookie", () => {
    expect(getRequestLocale(requestWithCookie("NEXT_LOCALE=ar"))).toBe("ar");
    expect(getRequestLocale(requestWithCookie("NEXT_LOCALE=he"))).toBe("he");
  });

  it("finds NEXT_LOCALE among other cookies", () => {
    expect(
      getRequestLocale(requestWithCookie("foo=bar; NEXT_LOCALE=ar; x=y"))
    ).toBe("ar");
  });

  it("falls back to the default locale for unsupported values", () => {
    expect(getRequestLocale(requestWithCookie("NEXT_LOCALE=fr"))).toBe("he");
    expect(getRequestLocale(requestWithCookie("NEXT_LOCALE="))).toBe("he");
  });

  it("does not match cookies whose name merely ends with NEXT_LOCALE", () => {
    expect(getRequestLocale(requestWithCookie("X_NEXT_LOCALE=ar"))).toBe("he");
  });
});

describe("getApiTranslator", () => {
  it("translates in Hebrew by default", () => {
    const t = getApiTranslator(requestWithCookie());
    expect(t("notAuthenticated")).toBe(heMessages.Api.notAuthenticated);
  });

  it("translates in Arabic for an ar cookie", () => {
    const t = getApiTranslator(requestWithCookie("NEXT_LOCALE=ar"));
    expect(t("notAuthenticated")).toBe(arMessages.Api.notAuthenticated);
  });
});

describe("getNotifyTranslator", () => {
  it("interpolates Notify messages per locale", () => {
    const he = getNotifyTranslator("he");
    expect(he("pushTitle")).toBe(heMessages.Notify.pushTitle);
    expect(he("pushBody", { time: "08:00", duration: 45 })).toContain("08:00");

    const ar = getNotifyTranslator("ar");
    expect(ar("pushTitle")).toBe(arMessages.Notify.pushTitle);
    expect(ar("emailCta", { url: "https://example.com" })).toContain(
      "https://example.com"
    );
  });
});
