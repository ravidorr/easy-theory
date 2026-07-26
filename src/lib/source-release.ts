export const OFFICIAL_QUESTION_BANK_URL =
  "https://data.gov.il/he/datasets/ministry_of_transport/tqhe";

export type SourceRelease = {
  source_name: string;
  resource_url: string;
  source_checksum: string;
  importer_version: string;
  imported_at: string;
};

export function formatSourceRelease(release: SourceRelease, locale: "he" | "ar"): string {
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-IL" : "he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(release.imported_at));
  return locale === "ar" ? `تم استيراد المصدر في ${date}` : `המאגר יובא ב־${date}`;
}
