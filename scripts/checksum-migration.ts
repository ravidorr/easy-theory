import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { checksumMigrationSource } from "./audit-database-metadata";

const filename = process.argv[2];
if (!filename) {
  console.error("Usage: pnpm db:migration:checksum <migration.sql>");
  process.exitCode = 2;
} else {
  console.log(`${basename(filename)} ${checksumMigrationSource(readFileSync(filename, "utf8"))}`);
}
