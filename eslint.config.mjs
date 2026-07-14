import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noEmoji from "eslint-plugin-no-emoji";
import noEmDash from "eslint-plugin-no-em-dash";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noEmoji.configs["flat/recommended"],
  noEmDash.configs["flat/recommended"],
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vitest coverage output
    "coverage/**",
    // Imported Designer output (tokens consumed by app; not app source)
    "design-system/**",
    // Conductor workspace scratch dir (attachments, agent collaboration files)
    ".context/**",
  ]),
]);

export default eslintConfig;
