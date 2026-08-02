"use client";

import { useLayoutEffect } from "react";

type LocaleRuntimeDataProps = {
  locale: string;
  translations: Record<string, string>;
  theme: string;
  vapidPublicKey?: string;
};

declare global {
  interface Window {
    __locale?: string;
    __t?: Record<string, string>;
    __tf?: (source: string, values: Record<string, unknown>) => string;
  }
}

export function LocaleRuntimeData({
  locale,
  translations,
  theme,
  vapidPublicKey,
}: LocaleRuntimeDataProps) {
  useLayoutEffect(() => {
    window.__locale = locale;
    window.__t = translations;
    window.__tf = (source, values) =>
      source.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? _));

    document.documentElement.lang = locale;
    document.documentElement.dir = "rtl";
    document.documentElement.dataset.theme = theme;

    const themeColor = theme === "light" ? "#f5f7fc" : "#131829";
    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = themeColor;

    if (vapidPublicKey) {
      let vapidPublicKeyMeta = document.querySelector<HTMLMetaElement>('meta[name="vapid-public-key"]');
      if (!vapidPublicKeyMeta) {
        vapidPublicKeyMeta = document.createElement("meta");
        vapidPublicKeyMeta.name = "vapid-public-key";
        document.head.appendChild(vapidPublicKeyMeta);
      }
      vapidPublicKeyMeta.content = vapidPublicKey;
    }
  }, [locale, theme, translations, vapidPublicKey]);

  return null;
}
