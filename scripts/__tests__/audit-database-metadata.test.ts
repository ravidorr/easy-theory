import { readFileSync } from "node:fs";
import {
  checksumMigrationSource,
  compareCatalogs,
  compareLedger,
  discoverMigrations,
  loadAuditConfigs,
  type CatalogSnapshot,
} from "../audit-database-metadata";

function emptyCatalog(): CatalogSnapshot {
  return {
    tables: [],
    columns: [],
    constraints: [],
    indexes: [],
    policies: [],
    triggers: [],
    functions: [],
    tableGrants: [],
    functionGrants: [],
  };
}

describe("database catalog audit", () => {
  it("requires distinct PostgreSQL connection strings", () => {
    expect(() => loadAuditConfigs({})).toThrow(/PROD_DATABASE_URL/);
    expect(() =>
      loadAuditConfigs({
        PROD_DATABASE_URL: "https://not-a-database.example.test",
        QA_DATABASE_URL: "postgresql://qa.example.test/postgres",
      })
    ).toThrow(/PostgreSQL/);
    expect(() =>
      loadAuditConfigs({
        PROD_DATABASE_URL: "postgresql://same.example.test/postgres",
        QA_DATABASE_URL: "postgresql://same.example.test/postgres",
      })
    ).toThrow(/identical/);
  });

  it("detects direct-only catalog drift", () => {
    const production = emptyCatalog();
    production.policies.push({
      table: "user_medals",
      name: "own insert",
      permissive: "PERMISSIVE",
      roles: ["authenticated"],
      command: "INSERT",
      using: null,
      withCheck: "(user_id = auth.uid())",
    });
    production.triggers.push({
      table: "user_quiz_responses",
      name: "user_quiz_responses_record_answer_event",
      enabled: "O",
      definition: "CREATE TRIGGER ...",
    });

    const result = compareCatalogs(production, emptyCatalog());

    expect(result.hasDrift).toBe(true);
    expect(result.differences.policies.productionOnly).toEqual(["user_medals.own insert"]);
    expect(result.differences.triggers.productionOnly).toEqual([
      "user_quiz_responses.user_quiz_responses_record_answer_event",
    ]);
  });

  it("normalizes only the self-referential ledger checksum", () => {
    const body = "CREATE TABLE example (id integer);\n";
    const first = `${body}-- migration-ledger: checksum normalized\nINSERT INTO public.schema_migrations (version, filename, checksum) VALUES (24, '024_example.sql', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');\n`;
    const second = `${body}-- migration-ledger: checksum normalized\nINSERT INTO public.schema_migrations (version, filename, checksum) VALUES (24, '024_example.sql', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');\n`;

    expect(checksumMigrationSource(first)).toBe(checksumMigrationSource(second));
  });

  it("pins every checked-in migration into the bootstrap ledger", () => {
    const migrations = discoverMigrations();
    const ledgerSql = readFileSync("seeds/migrations/023_migration_ledger.sql", "utf8");

    expect(migrations.map(({ version }) => version)).toEqual(
      Array.from({ length: 23 }, (_, index) => index + 1)
    );
    for (const migration of migrations) {
      expect(ledgerSql).toContain(`'${migration.filename}', '${migration.checksum}'`);
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
      productionOnly: ["001 001_first.sql", "002 002_second.sql"],
      qaOnly: ["001 001_first.sql", "003 003_third.sql"],
    });
  });
});
