import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import RootLayout from "../layout";
import { cookies } from "next/headers";

vi.mock("next/font/google", () => ({
  Rubik: vi.fn().mockReturnValue({ variable: "--font-rubik", className: "rubik" }),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));
vi.mock("next/script", () => ({
  default: ({ id, children }: { id?: string; children?: string }) =>
    React.createElement("script", { id }, children),
}));

const mockCookies = vi.mocked(cookies);

describe("RootLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);
  });

  it("renders children inside the layout", async () => {
    const jsx = await RootLayout({
      children: React.createElement("p", { id: "test-child" }, "hello"),
    });
    const { container } = render(jsx);
    expect(container.querySelector("#test-child")).toBeTruthy();
    expect(container.querySelector("#test-child")?.textContent).toBe("hello");
  });

  it("defaults to dark theme when no theme cookie", async () => {
    const jsx = await RootLayout({ children: React.createElement("div", null) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('data-theme="dark"');
  });

  it("uses light theme when theme cookie value is light", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "light" }),
    } as never);
    const jsx = await RootLayout({ children: React.createElement("div", null) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('data-theme="light"');
  });

  it("renders vapid-public-key meta tag when env var is set", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-vapid-key-abc";
    const jsx = await RootLayout({ children: React.createElement("div", null) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('name="vapid-public-key"');
    expect(html).toContain('content="test-vapid-key-abc"');
  });

  it("omits vapid-public-key meta when env var is not set", async () => {
    const jsx = await RootLayout({ children: React.createElement("div", null) });
    const html = renderToStaticMarkup(jsx);
    expect(html).not.toContain("vapid-public-key");
  });

  it("sets lang=he and dir=rtl on the html element", async () => {
    const jsx = await RootLayout({ children: React.createElement("div", null) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('lang="he"');
    expect(html).toContain('dir="rtl"');
  });
});
