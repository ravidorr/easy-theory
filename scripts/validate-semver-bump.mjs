import { readFileSync } from "node:fs";

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function readStablePackageVersion(packageJson) {
  try {
    const { version } = JSON.parse(packageJson);
    return typeof version === "string" && VERSION.test(version) ? version : null;
  } catch {
    return null;
  }
}

function parseVersion(version) {
  const match = VERSION.exec(version);
  return match ? match.slice(1).map(Number) : null;
}

export function isSingleSemverIncrement(current, next) {
  const currentParts = parseVersion(current);
  const nextParts = parseVersion(next);

  if (!currentParts || !nextParts) return false;

  const [currentMajor, currentMinor, currentPatch] = currentParts;
  const [nextMajor, nextMinor, nextPatch] = nextParts;

  return (
    (nextMajor === currentMajor && nextMinor === currentMinor && nextPatch === currentPatch + 1) ||
    (nextMajor === currentMajor && nextMinor === currentMinor + 1 && nextPatch === 0) ||
    (nextMajor === currentMajor + 1 && nextMinor === 0 && nextPatch === 0)
  );
}

if (process.argv[2] === "--read-package-version") {
  const version = readStablePackageVersion(readFileSync(0, "utf8"));

  if (!version) process.exit(1);
  process.stdout.write(version);
} else if (process.argv.length === 4) {
  const [, , current, next] = process.argv;

  if (!isSingleSemverIncrement(current, next)) {
    console.error(`Expected exactly one SemVer increment from ${current} to ${next}.`);
    process.exit(1);
  }
}
