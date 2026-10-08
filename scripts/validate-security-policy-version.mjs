import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { readStablePackageVersion } from "./validate-semver-bump.mjs";

const SUPPORTED_STATUS = String.fromCodePoint(0x2713);
const SUPPORTED_VERSIONS_SECTION = /^##[ \t]+Supported Versions[ \t]*\r?\n(?<content>[\s\S]*?)(?=^##[ \t]|(?![\s\S]))/m;
const SUPPORTED_VERSIONS_TABLE = /^\|[ \t]*Version[ \t]*\|[ \t]*Supported[ \t]*\|[ \t]*\r?\n^\|[ \t]*:?-{3,}:?[ \t]*\|[ \t]*:?-{3,}:?[ \t]*\|[ \t]*\r?\n(?<rows>(?:^\|[^\r\n]*\|[ \t]*(?:\r?\n|$))*)/m;
const VERSION_ROW = /^\|\s*([0-9]+\.[0-9]+\.[0-9]+)\s*\|\s*([^|]+?)\s*\|\s*$/gm;
const FENCE_OPENING = /^(?: {0,3})(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSING = /^(?: {0,3})(`+|~+)[ \t]*$/;

function readOpeningFenceMarker(line) {
  const match = FENCE_OPENING.exec(line);

  if (!match) return undefined;

  const [, marker, info] = match;

  if (marker[0] === "`" && info.includes("`")) return undefined;

  return marker;
}

function isClosingFence(line, openingMarker) {
  const closingMarker = FENCE_CLOSING.exec(line)?.[1];

  return Boolean(
    closingMarker
    && closingMarker[0] === openingMarker[0]
    && closingMarker.length >= openingMarker.length,
  );
}

function maskFencedCodeBlocks(markdown) {
  let fenceMarker;

  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (fenceMarker) {
        if (isClosingFence(line, fenceMarker)) {
          fenceMarker = undefined;
        }

        return "";
      }

      const openingMarker = readOpeningFenceMarker(line);

      if (openingMarker) {
        fenceMarker = openingMarker;
        return "";
      }

      return line;
    })
    .join("\n");
}

export function validateSecurityPolicyVersion(packageJson, securityPolicy) {
  const version = readStablePackageVersion(packageJson);

  if (!version) {
    return {
      valid: false,
      error: "package.json must contain an exact stable SemVer version.",
    };
  }

  const section = SUPPORTED_VERSIONS_SECTION.exec(
    maskFencedCodeBlocks(securityPolicy),
  );
  const table = section && SUPPORTED_VERSIONS_TABLE.exec(section.groups.content);

  if (!table) {
    return {
      valid: false,
      error: "SECURITY.md is missing a supported-versions table.",
    };
  }

  const rows = [...table.groups.rows.matchAll(VERSION_ROW)];
  const matchingRow = rows.find(([, rowVersion]) => rowVersion === version);

  if (matchingRow?.[2].trim() === SUPPORTED_STATUS) {
    return { valid: true, version };
  }

  if (matchingRow) {
    return {
      valid: false,
      error: `SECURITY.md declares ${version} as unsupported. Mark the package version as supported.`,
    };
  }

  const supportedVersion = rows.find(([, , status]) => (
    status.trim() === SUPPORTED_STATUS
  ))?.[1];

  if (supportedVersion) {
    return {
      valid: false,
      error: `SECURITY.md supports ${supportedVersion}, but package.json declares ${version}. Update SECURITY.md.`,
    };
  }

  return {
    valid: false,
    error: "SECURITY.md has no enabled supported-version row.",
  };
}

export function validateSecurityPolicyFiles(
  packageJsonPath = "package.json",
  securityPolicyPath = "SECURITY.md",
) {
  try {
    return validateSecurityPolicyVersion(
      readFileSync(packageJsonPath, "utf8"),
      readFileSync(securityPolicyPath, "utf8"),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      valid: false,
      error: `Unable to read security policy files: ${message}`,
    };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateSecurityPolicyFiles(...process.argv.slice(2));

  if (!result.valid) {
    console.error(result.error);
    process.exit(1);
  }

  process.stdout.write(`SECURITY.md supports package version ${result.version}.\n`);
}
