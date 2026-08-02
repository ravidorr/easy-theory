import { Rubik } from "next/font/google";
import { cookies, headers } from "next/headers";
import { detectLocale } from "@/i18n/detect-locale";
import { routing } from "@/i18n/routing";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew", "arabic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const forwardedLocale = headerStore.get("x-next-intl-locale");
  const locale = (routing.locales as readonly string[]).includes(forwardedLocale ?? "")
    ? forwardedLocale!
    : detectLocale(
        cookieStore.get("NEXT_LOCALE")?.value,
        headerStore.get("accept-language")
      );

  return (
    <html
      lang={locale}
      dir="rtl"
      data-theme={cookieStore.get("theme")?.value ?? "dark"}
      className={rubik.variable}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
