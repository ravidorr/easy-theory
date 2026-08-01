import {
  LedgerVerificationError,
  assertMigrationLedger,
  shouldVerifyMigrationLedger,
} from "../verify-migration-ledger";

describe("production migration ledger gate", () => {
  it("runs only for Vercel production or an explicit requirement", () => {
    expect(shouldVerifyMigrationLedger([], {})).toBe(false);
    expect(shouldVerifyMigrationLedger([], { VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldVerifyMigrationLedger([], { VERCEL_ENV: "production" })).toBe(true);
    expect(shouldVerifyMigrationLedger([], { MIGRATION_LEDGER_GATE: "1" })).toBe(true);
    expect(shouldVerifyMigrationLedger(["--require"], {})).toBe(true);
  });

  it("rejects missing and altered migration ledger rows", () => {
    expect(() => assertMigrationLedger([])).toThrow(LedgerVerificationError);
    expect(() =>
      assertMigrationLedger([
        {
          version: 1,
          filename: "001_quiz_responses_unique.sql",
          checksum: "altered",
          appliedAt: "now",
        },
      ])
    ).toThrow(/missing-or-changed/);
  });
});
