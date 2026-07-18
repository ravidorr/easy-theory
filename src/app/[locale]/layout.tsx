import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { LocaleRuntimeData } from "@/components/LocaleRuntimeData";
import "@/app/globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew", "arabic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateViewport(): Promise<Viewport> {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";
  return { themeColor: theme === "light" ? "#f5f7fc" : "#131829" };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("rootTitle"),
    description: t("rootDescription"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: currentLocale } = await params;
  if (!hasLocale(routing.locales, currentLocale)) {
    notFound();
  }

  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const messages = await getMessages();

  // Flatten JS translations for vanilla JS files
  const js = (messages as Record<string, unknown>).JS as Record<
    string,
    Record<string, string>
  >;
  const jsT = {
    ...js.Auth,
    ...js.Quiz,
    ...js.Schedule,
    ...js.Flashcard,
    ...js.Exam,
    ...js.Bookmark,
    ...js.Modal,
  };

  return (
    <html
      lang={currentLocale}
      dir="rtl"
      data-theme={theme}
      className={rubik.variable}
    >
      <head>
        {vapidPublicKey && (
          <meta name="vapid-public-key" content={vapidPublicKey} />
        )}
      </head>
      <body>
        <LocaleRuntimeData locale={currentLocale} translations={jsT} theme={theme} />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
        <Script id="register-sw" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
          }
        `}</Script>
      </body>
    </html>
  );
}
