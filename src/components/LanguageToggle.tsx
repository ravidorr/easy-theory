"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/lib/navigation";
import styles from "./LanguageToggle.module.css";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isSwitching, setIsSwitching] = useState(false);

  const toggle = () => {
    if (isSwitching) return;
    setIsSwitching(true);
    const newLocale = locale === "he" ? "ar" : "he";
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <button
      onClick={toggle}
      className={`btn-secondary ${styles.toggle}`}
      aria-label={locale === "he" ? "Switch to Arabic" : "Switch to Hebrew"}
      aria-busy={isSwitching}
      disabled={isSwitching}
    >
      {locale === "he" ? "العربية" : "עברית"}
    </button>
  );
}
