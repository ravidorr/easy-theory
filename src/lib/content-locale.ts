/** Arabic locale must use Arabic DB fields only; no Hebrew fallback. */

export function localizedContent(
  locale: string,
  heValue: string | null | undefined,
  arValue: string | null | undefined
): string {
  if (locale === "ar") return arValue ?? "";
  return heValue ?? "";
}

export function localizedRecordField(
  locale: string,
  record: Record<string, unknown>,
  heKey: string,
  arKey: string
): string {
  return localizedContent(
    locale,
    record[heKey] as string | null | undefined,
    record[arKey] as string | null | undefined
  );
}

export function localizeQuestion(locale: string, q: Record<string, unknown>) {
  return {
    question_display: localizedContent(
      locale,
      q.question_he as string,
      q.question_ar as string
    ),
    explanation_display: localizedContent(
      locale,
      q.explanation_he as string,
      q.explanation_ar as string
    ),
    option_a_display: localizedContent(locale, q.option_a as string, q.option_a_ar as string),
    option_b_display: localizedContent(locale, q.option_b as string, q.option_b_ar as string),
    option_c_display: localizedContent(locale, q.option_c as string, q.option_c_ar as string),
    option_d_display: localizedContent(locale, q.option_d as string, q.option_d_ar as string),
  };
}
