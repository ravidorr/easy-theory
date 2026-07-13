import type { MetadataRoute } from "next";
import he from "../../messages/he.json";

// The manifest is a single-locale document; it uses the default locale (he).
// start_url "/" lets the next-intl middleware redirect each user to their own
// locale (NEXT_LOCALE cookie), so Arabic users land on /ar/.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: he.Metadata.rootTitle,
    short_name: he.Metadata.shortName,
    description: he.Metadata.rootDescription,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "he",
    theme_color: "#131829",
    background_color: "#131829",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
