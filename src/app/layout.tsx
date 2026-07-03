import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { cookies } from "next/headers";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";

  return (
    <html lang="he" dir="rtl" data-theme={theme} className={rubik.variable}>
      <body>{children}</body>
    </html>
  );
}
