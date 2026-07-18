import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const expectedPromptImages = new Map([
  [360, 118],
  [362, 144],
  [369, 303],
  [370, 126],
  [373, 618],
  [375, 135],
  [377, 302],
  [383, 216],
  [390, 308],
  [391, 305],
  [405, 705],
  [406, 701],
  [462, 139],
  [470, 135],
  [522, 424],
  [1570, 135],
]);

const questionsSql = readFileSync(resolve(__dirname, "../../../seeds/questions.sql"), "utf-8");
const migrationSql = readFileSync(
  resolve(__dirname, "../../../seeds/migrations/016_fix_prompt_sign_images.sql"),
  "utf-8",
);

describe("prompt sign image data", () => {
  it("points every audited seed question at the sign named in its prompt", () => {
    for (const [questionNumber, signNumber] of expectedPromptImages) {
      expect(questionsSql).toMatch(
        new RegExp(
          `\\('signs', ${questionNumber}, [^\\n]+, '/signs/sign-${signNumber}\\.png', ARRAY`,
        ),
      );
    }
  });

  it("migrates every audited existing question to the same prompt image", () => {
    for (const [questionNumber, signNumber] of expectedPromptImages) {
      expect(migrationSql).toContain(
        `WHEN ${questionNumber} THEN '/signs/sign-${signNumber}.png'`,
      );
    }
    expect(migrationSql).toMatch(/WHERE question_number IN[\s\S]+slug = 'signs'/);
  });

  it("has a PNG asset for every corrected prompt sign", () => {
    for (const signNumber of new Set(expectedPromptImages.values())) {
      expect(
        existsSync(resolve(__dirname, `../../../public/signs/sign-${signNumber}.png`)),
      ).toBe(true);
    }
  });
});
