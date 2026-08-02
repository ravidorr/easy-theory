import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "../layout";

vi.mock("next/font/google", () => ({
  Rubik: vi.fn().mockReturnValue({ variable: "--font-rubik" }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => null }),
}));

vi.mock("@/app/globals.css", () => ({}));

describe("RootLayout", () => {
  it("owns the document shell", async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <div>content</div> }));
    expect(html).toContain('<html lang="he" dir="rtl" data-theme="dark"');
    expect(html).toContain("<body><div>content</div></body>");
  });
});
