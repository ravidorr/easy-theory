import { describe, it, expect } from "vitest";
import {
  localizedContent,
  localizedRecordField,
  localizeQuestion,
} from "../content-locale";

describe("localizedContent", () => {
  it("returns the Hebrew value for the he locale", () => {
    expect(localizedContent("he", "שם", "اسم")).toBe("שם");
  });

  it("returns the Arabic value for the ar locale", () => {
    expect(localizedContent("ar", "שם", "اسم")).toBe("اسم");
  });

  it("does not fall back to Hebrew when Arabic is missing", () => {
    expect(localizedContent("ar", "עקומה חדה שמאלה", null)).toBe("");
    expect(localizedContent("ar", "עקומה חדה שמאלה", undefined)).toBe("");
  });

  it("returns an empty string when Hebrew is missing in the he locale", () => {
    expect(localizedContent("he", null, "اسم")).toBe("");
  });
});

describe("localizedRecordField", () => {
  it("reads the configured keys from a record", () => {
    const record = { name_he: "תמרור", name_ar: "علامة" };
    expect(localizedRecordField("ar", record, "name_he", "name_ar")).toBe("علامة");
    expect(localizedRecordField("he", record, "name_he", "name_ar")).toBe("תמרור");
  });
});

describe("localizeQuestion", () => {
  const question = {
    question_he: "שאלה",
    question_ar: "سؤال",
    explanation_he: "הסבר",
    explanation_ar: "شرح",
    option_a: "עצור",
    option_a_ar: "قف",
    option_b: "ימינה",
    option_b_ar: null,
    option_c: "שמאלה",
    option_c_ar: "يسار",
    option_d: "המשך",
    option_d_ar: "استمر",
  };

  it("maps all question fields for Hebrew", () => {
    expect(localizeQuestion("he", question)).toEqual({
      question_display: "שאלה",
      explanation_display: "הסבר",
      option_a_display: "עצור",
      option_b_display: "ימינה",
      option_c_display: "שמאלה",
      option_d_display: "המשך",
    });
  });

  it("maps all question fields for Arabic without Hebrew fallback", () => {
    expect(localizeQuestion("ar", question)).toEqual({
      question_display: "سؤال",
      explanation_display: "شرح",
      option_a_display: "قف",
      option_b_display: "",
      option_c_display: "يسار",
      option_d_display: "استمر",
    });
  });
});
