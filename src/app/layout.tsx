import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClearRoad — דרך ברורה",
  description: "לימוד תיאוריה, בלי הצפה",
};

export async function generateViewport(): Promise<Viewport> {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";
  return { themeColor: theme === "light" ? "#f5f7fc" : "#131829" };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <html lang="he" dir="rtl" data-theme={theme} className={rubik.variable}>
      <head>
        {vapidPublicKey && (
          <meta name="vapid-public-key" content={vapidPublicKey} />
        )}
      </head>
      <body>
        {children}
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
