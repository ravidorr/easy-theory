import {
  MigrationApplicationError,
  databaseUrlForTarget,
  parseMigrationArguments,
  pendingMigrations,
} from "../apply-pending-migrations";

const expected = [
  { version: 1, filename: "001_first.sql", checksum: "first" },
  { version: 2, filename: "002_second.sql", checksum: "second" },
];

describe("pending migration runner", () => {
  it("requires an explicit target and defaults to dry-run", () => {
    expect(() => parseMigrationArguments([])).toThrow(/--target/);
    expect(parseMigrationArguments(["--target", "qa"])).toEqual({ target: "qa", apply: false });
    expect(parseMigrationArguments(["--target", "production", "--apply"])).toEqual({
      target: "production",
      apply: true,
    });
    expect(() => parseMigrationArguments(["--target", "staging"])).toThrow(/qa or production/);
  });

  it("accepts only an exact committed ledger prefix", () => {
    expect(pendingMigrations(expected, [])).toEqual(expected);
    expect(
      pendingMigrations(expected, [
        { ...expected[0], appliedAt: "now" },
      ])
    ).toEqual([expected[1]]);
    expect(() =>
      pendingMigrations(expected, [
        { ...expected[1], appliedAt: "now" },
      ])
    ).toThrow(MigrationApplicationError);
  });

  it("requires a PostgreSQL URL for the selected target only", () => {
    expect(() => databaseUrlForTarget("qa", {})).toThrow(/QA_DATABASE_URL/);
    expect(() => databaseUrlForTarget("production", { PROD_DATABASE_URL: "https://example.test" })).toThrow(
      /PostgreSQL/
    );
    expect(
      databaseUrlForTarget("production", { PROD_DATABASE_URL: "postgresql://example.test/postgres" })
    ).toBe("postgresql://example.test/postgres");
  });
});
