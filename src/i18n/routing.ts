import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["he", "ar"] as const,
  defaultLocale: "he",
  localeCookie: true,
});

export type Locale = (typeof routing.locales)[number];
