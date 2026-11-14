import { readFileSync } from "node:fs";
import {
  checksumMigrationSource,
  compareLedger,
  discoverMigrations,
  ledgerHasDrift,
  loadAuditConfig,
  renderLedgerReport,
} from "../audit-database-metadata";

describe("database migration ledger audit", () => {
  it("requires a PostgreSQL production connection string", () => {
    expect(() => loadAuditConfig({})).toThrow(/PROD_DATABASE_URL/);
    expect(() =>
      loadAuditConfig({ PROD_DATABASE_URL: "https://not-a-database.example.test" })
    ).toThrow(/PostgreSQL/);
    expect(loadAuditConfig({ PROD_DATABASE_URL: "postgresql://prod.example.test/postgres" })).toEqual({
      label: "production",
      databaseUrl: "postgresql://prod.example.test/postgres",
    });
  });

  it("normalizes only the self-referential ledger checksum", () => {
    const body = "CREATE TABLE example (id integer);\n";
    const first = `${body}-- migration-ledger: checksum normalized\nINSERT INTO public.schema_migrations (version, filename, checksum) VALUES (24, '024_example.sql', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');\n`;
    const second = `${body}-- migration-ledger: checksum normalized\nINSERT INTO public.schema_migrations (version, filename, checksum) VALUES (24, '024_example.sql', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');\n`;

    expect(checksumMigrationSource(first)).toBe(checksumMigrationSource(second));
  });

  it("pins bootstrap migrations in the ledger and later migrations in themselves", () => {
    const migrations = discoverMigrations();
    const ledgerSql = readFileSync("seeds/migrations/023_migration_ledger.sql", "utf8");

    expect(migrations.map(({ version }) => version)).toEqual(
      Array.from({ length: migrations.length }, (_, index) => index + 1)
    );
    for (const migration of migrations.filter(({ version }) => version <= 23)) {
      expect(ledgerSql).toContain(`'${migration.filename}', '${migration.checksum}'`);
    }
    for (const migration of migrations.filter(({ version }) => version > 23)) {
      const source = readFileSync(`seeds/migrations/${migration.filename}`, "utf8");
      expect(source).toContain(`'${migration.filename}', '${migration.checksum}'`);
    }
  });

  it("reports missing, unexpected, and checksum-changed ledger rows", () => {
    const expected = [
      { version: 1, filename: "001_first.sql", checksum: "first" },
      { version: 2, filename: "002_second.sql", checksum: "second" },
    ];
    const actual = [
      { version: 1, filename: "001_first.sql", checksum: "changed", appliedAt: "now" },
      { version: 3, filename: "003_third.sql", checksum: "third", appliedAt: "now" },
    ];

    expect(compareLedger(expected, actual)).toEqual({
      missingOrChanged: ["001 001_first.sql", "002 002_second.sql"],
      unexpected: ["001 001_first.sql", "003 003_third.sql"],
    });
  });
});

describe("ledger drift reporting", () => {
  const file = (version: number) => ({ version, filename: `${String(version).padStart(3, "0")}_x.sql`, checksum: "c" });
  const row = (version: number, checksum = "c") => ({ ...file(version), checksum, appliedAt: "now" });

  it("returns empty differences for an identical ledger", () => {
    const difference = compareLedger([file(1), file(2)], [row(1), row(2)]);
    expect(difference).toEqual({ missingOrChanged: [], unexpected: [] });
    expect(ledgerHasDrift(difference)).toBe(false);
    expect(renderLedgerReport(difference)).toContain("ALIGNED");
    expect(renderLedgerReport(difference)).not.toContain("examples");
  });

  it("treats a filename-only mismatch as drift and pads versions", () => {
    const difference = compareLedger([file(100)], [{ ...row(100), filename: "100_other.sql" }]);
    expect(difference.missingOrChanged).toEqual(["100 100_x.sql"]);
    expect(difference.unexpected).toEqual(["100 100_other.sql"]);
  });

  it("flags drift in either list on its own", () => {
    expect(ledgerHasDrift({ missingOrChanged: ["001 a"], unexpected: [] })).toBe(true);
    expect(ledgerHasDrift({ missingOrChanged: [], unexpected: ["001 a"] })).toBe(true);
  });

  it("labels each example and caps them at ten", () => {
    const missingOrChanged = Array.from({ length: 12 }, (_, index) => `${index} m`);
    const report = renderLedgerReport({ missingOrChanged, unexpected: ["99 u"] });
    expect(report).toContain("DRIFT FOUND");
    expect(report).toContain("missing-or-changed=12, unexpected=1");
    expect(report).toContain("0 m [missing or changed]");
    expect(report).toContain("9 m [missing or changed]");
    expect(report).not.toContain("10 m");
    expect(report).not.toContain("99 u");
    expect(renderLedgerReport({ missingOrChanged: [], unexpected: ["99 u"] })).toContain("99 u [unexpected]");
  });
});
