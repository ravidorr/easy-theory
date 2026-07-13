"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/lib/navigation";
import styles from "./LanguageToggle.module.css";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    const newLocale = locale === "he" ? "ar" : "he";
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <button
      onClick={toggle}
      className={styles.toggle}
      aria-label={locale === "he" ? "Switch to Arabic" : "Switch to Hebrew"}
    >
      {locale === "he" ? "العربية" : "עברית"}
    </button>
  );
}
