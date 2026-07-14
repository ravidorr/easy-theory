// The root not-found.tsx boundary requires a root layout to exist. Real pages
// get their <html> from the [locale] layout; not-found.tsx supplies its own,
// so this layout only passes children through.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
