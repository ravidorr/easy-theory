import { missingExpectedSignNumbers, parseWikipediaSignWikitext, permanentWikipediaUrl } from "../import-wikipedia-signs";

describe("Wikipedia sign importer", () => {
  it("extracts a categorized sign from a gallery row", () => {
    const result = parseWikipediaSignWikitext(`=== תמרורי רמזורים ובקרת נתיבים 701–729 ===
<gallery>
קובץ:Israel road sign 705.svg|תמרור 705 - אור צהוב: עצור.
</gallery>`);

    expect(result.signs).toEqual([
      {
        imageFile: "Israel road sign 705.svg",
        signNumber: "705",
        nameHe: "אור צהוב: עצור.",
        category: "traffic_light",
      },
    ]);
    expect(result.duplicateSignNumbers).toEqual([]);
    expect(result.unclassifiedSignNumbers).toEqual([]);
  });

  it("reports duplicate sign numbers instead of selecting one", () => {
    const result = parseWikipediaSignWikitext(`=== תמרורי אזהרה והתראה 101–153 ===
קובץ:one.svg|תמרור 112 - מעבר צר.
קובץ:two.svg|תמרור 112 - מכשול.`);

    expect(result.duplicateSignNumbers).toEqual(["112"]);
  });

  it("preserves markup as inert source text instead of regex-sanitizing HTML", () => {
    const result = parseWikipediaSignWikitext(`=== תמרורי רמזורים ובקרת נתיבים 701–729 ===
קובץ:one.svg|תמרור 701 - <script>alert(1)</script>`);
    expect(result.signs[0].nameHe).toBe("<script>alert(1)</script>");
  });

  it("uses an immutable oldid URL", () => {
    expect(permanentWikipediaUrl(43643480)).toContain("oldid=43643480");
  });

  it("reports expected sign numbers absent from the revision", () => {
    const result = parseWikipediaSignWikitext(`=== תמרורי רמזורים ובקרת נתיבים 701–729 ===
קובץ:one.svg|תמרור 701 - אור אדום.`);
    expect(missingExpectedSignNumbers(result.signs, ["701", "705"])).toEqual(["705"]);
  });
});
