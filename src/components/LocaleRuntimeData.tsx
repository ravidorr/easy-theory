"use client";

import { useLayoutEffect } from "react";

type LocaleRuntimeDataProps = {
  locale: string;
  translations: Record<string, string>;
  theme: string;
};

declare global {
  interface Window {
    __locale?: string;
    __t?: Record<string, string>;
    __tf?: (source: string, values: Record<string, unknown>) => string;
  }
}

export function LocaleRuntimeData({ locale, translations, theme }: LocaleRuntimeDataProps) {
  useLayoutEffect(() => {
    window.__locale = locale;
    window.__t = translations;
    window.__tf = (source, values) =>
      source.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? _));

    const themeColor = theme === "light" ? "#f5f7fc" : "#131829";
    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = themeColor;
  }, [locale, theme, translations]);

  return null;
}
