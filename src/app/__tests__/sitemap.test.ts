import { afterEach, describe, expect, it, vi } from "vitest";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  vi.resetModules();
});

async function loadSitemap() {
  return (await import("../sitemap")).default;
}

describe("sitemap", () => {
  it("uses the default production URL and gives the home page priority", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const entries = (await loadSitemap())();

    expect(entries).toHaveLength(6);
    expect(entries[0]).toMatchObject({
      url: "https://easy-theory-omega.vercel.app/he",
      changeFrequency: "monthly",
      priority: 1,
    });
    expect(entries[0]?.lastModified).toBeInstanceOf(Date);
  });

  it("uses the configured URL for every non-home sitemap entry", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://clearroad.example";
    const entries = (await loadSitemap())();

    expect(entries.slice(1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://clearroad.example/he/faq", priority: 0.7 }),
      expect.objectContaining({ url: "https://clearroad.example/he/guides/signs", priority: 0.7 }),
      expect.objectContaining({ url: "https://clearroad.example/he/guides/vehicle", priority: 0.7 }),
    ]));
  });
});
