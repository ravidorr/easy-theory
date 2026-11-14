import { readFileSync } from "node:fs";
import {
  checksumMigrationSource,
  compareLedger,
  discoverMigrations,
  loadAuditConfig,
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
