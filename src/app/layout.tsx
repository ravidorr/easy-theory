import { Rubik } from "next/font/google";
import { cookies, headers } from "next/headers";
import { detectLocale } from "@/i18n/detect-locale";
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

  return (
    <html
      lang={detectLocale(
        cookieStore.get("NEXT_LOCALE")?.value,
        headerStore.get("x-next-intl-locale") ?? headerStore.get("accept-language")
      )}
      dir="rtl"
      data-theme={cookieStore.get("theme")?.value ?? "dark"}
      className={rubik.variable}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
