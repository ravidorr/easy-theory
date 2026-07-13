import "./globals.css";

// The [locale] layout owns <html>/<head>/<body> (locale-aware lang, fonts,
// providers). This root layout only passes children through so the root
// not-found boundary has a layout above it.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
