import type { Metadata } from "next";
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
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const messages = await getMessages();

  // Flatten JS translations for vanilla JS files
  const jsT = {
    ...((messages as Record<string, unknown>).JS as Record<string, Record<string, string>>)
      .Auth,
    ...((messages as Record<string, unknown>).JS as Record<string, Record<string, string>>)
      .Quiz,
    ...((messages as Record<string, unknown>).JS as Record<string, Record<string, string>>)
      .Schedule,
    ...((messages as Record<string, unknown>).JS as Record<string, Record<string, string>>)
      .Flashcard,
    ...((messages as Record<string, unknown>).JS as Record<string, Record<string, string>>)
      .Exam,
  };

  return (
    <html lang={locale} dir="rtl" data-theme={theme} className={rubik.variable}>
      <head>
        {vapidPublicKey && (
          <meta name="vapid-public-key" content={vapidPublicKey} />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__locale=${JSON.stringify(locale)};window.__t=${JSON.stringify(jsT)};window.__tf=function(s,v){return s.replace(/\\{(\\w+)\\}/g,function(_,k){return v[k]??_;});};`,
          }}
        />
      </head>
      <body>
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
