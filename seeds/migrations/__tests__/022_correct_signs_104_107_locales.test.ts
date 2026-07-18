import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "../022_correct_signs_104_107_locales.sql"
);
const migrationSql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf-8")
  : "";

const expectedSigns = [
  {
    number: "104",
    nameHe: "עקומה ימינה ולאחר מכן שמאלה.",
    nameAr: "منعطف إلى اليمين ثم إلى اليسار.",
    meaningHe: "בדרך שלפניך יש עקומה ימינה ולאחר מכן שמאלה.",
    meaningAr: "أمامك منعطف إلى اليمين ثم إلى اليسار.",
  },
  {
    number: "105",
    nameHe: "עקומה שמאלה ולאחר מכן ימינה.",
    nameAr: "منعطف إلى اليسار ثم إلى اليمين.",
    meaningHe: "בדרך שלפניך יש עקומה שמאלה ולאחר מכן ימינה.",
    meaningAr: "أمامك منعطف إلى اليسار ثم إلى اليمين.",
  },
  {
    number: "106",
    nameHe: "דרך מפותלת.",
    nameAr: "طريق متعرج.",
    meaningHe: "בדרך שלפניך יש דרך מפותלת.",
    meaningAr: "أمامك طريق متعرج.",
  },
  {
    number: "107",
    nameHe:
      "אזהרה והדרכה בעקומה חדה (שמאלה): המשך הדרך בכיוון המסומן בחצים שעל התמרור; עבור לפני התמרור.",
    nameAr:
      "تحذير وإرشاد عند منعطف حاد إلى اليسار: يتجه الطريق في الاتجاه المشار إليه بالأسهم على الإشارة. مرّ أمام الإشارة.",
    meaningHe:
      "אזהרה והדרכה בעקומה חדה (שמאלה): המשך הדרך בכיוון המסומן בחצים שעל התמרור; עבור לפני התמרור.",
    meaningAr:
      "تحذير وإرشاد عند منعطف حاد إلى اليسار: يتجه الطريق في الاتجاه المشار إليه بالأسهم على الإشارة. مرّ أمام الإشارة.",
  },
];

describe("022_correct_signs_104_107_locales migration", () => {
  it("corrects the Hebrew and Arabic names and meanings for signs 104–107", () => {
    for (const sign of expectedSigns) {
      expect(migrationSql).toMatch(
        new RegExp(`WHERE sign_number = '${sign.number}'`)
      );
      expect(migrationSql).toContain(`name_he = '${sign.nameHe}'`);
      expect(migrationSql).toContain(`name_ar = '${sign.nameAr}'`);
      expect(migrationSql).toContain(`meaning_he = '${sign.meaningHe}'`);
      expect(migrationSql).toContain(`meaning_ar = '${sign.meaningAr}'`);
    }
  });
});
