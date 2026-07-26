import { describe, expect, it } from "vitest";
import { formatSourceRelease, OFFICIAL_QUESTION_BANK_URL } from "../source-release";

const release = {
  source_name: "official",
  resource_url: OFFICIAL_QUESTION_BANK_URL,
  source_checksum: "abc",
  importer_version: "1",
  imported_at: "2026-07-26T00:00:00.000Z",
};

describe("source release formatting", () => {
  it("keeps the official source URL stable", () => {
    expect(OFFICIAL_QUESTION_BANK_URL).toContain("data.gov.il");
  });

  it("formats Hebrew and Arabic provenance", () => {
    expect(formatSourceRelease(release, "he")).toContain("המאגר יובא");
    expect(formatSourceRelease(release, "ar")).toContain("تم استيراد المصدر");
  });
});
