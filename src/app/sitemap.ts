import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://easy-theory-omega.vercel.app";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/faq", "/guides/signs", "/guides/traffic-laws", "/guides/safety", "/guides/vehicle"].map((path) => ({
    url: `${baseUrl}/he${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
