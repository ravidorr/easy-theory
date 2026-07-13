"use client";

import Error from "next/error";

// Root 404 boundary for requests with no locale context (unmatched by the
// proxy) and for notFound() thrown by the [locale] layout on invalid locales.
// Rendered outside the [locale] layout, so it must supply its own <html>.
export default function NotFound() {
  return (
    <html lang="he" dir="rtl">
      <body>
        <Error statusCode={404} />
      </body>
    </html>
  );
}
