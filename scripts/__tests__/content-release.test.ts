import { validateContentRelease, validatePublishableRelease, type ContentReleaseManifest } from "../content-release";

const QUESTION_SOURCE = "a".repeat(64);
const SIGN_SOURCE = "b".repeat(64);

function approvedManifest(): ContentReleaseManifest {
  return {
    version: 1,
    status: "approved",
    sources: [
      { kind: "question_bank", sourceChecksum: QUESTION_SOURCE, sourceUrl: "https://example.test/questions" },
      { kind: "sign_catalog", sourceChecksum: SIGN_SOURCE, sourceUrl: "https://example.test/signs", revisionId: 43643480, sourceSha1: "c".repeat(40) },
    ],
    questions: [
      { number: "405", locale: "he", sourceChecksum: QUESTION_SOURCE, reviewer: "reviewer", approvedAt: "2026-07-31" },
      { number: "405", locale: "ar", sourceChecksum: QUESTION_SOURCE, reviewer: "reviewer", approvedAt: "2026-07-31" },
    ],
    signs: [
      { number: "705", locale: "he", sourceChecksum: SIGN_SOURCE, reviewer: "reviewer", approvedAt: "2026-07-31", assetPath: "/signs/sign-705.png" },
      { number: "705", locale: "ar", sourceChecksum: SIGN_SOURCE, reviewer: "reviewer", approvedAt: "2026-07-31", assetPath: "/signs/sign-705.png" },
    ],
    explanations: [
      { number: "405", questionNumber: "405", locale: "he", sourceChecksum: QUESTION_SOURCE, reviewer: "reviewer", approvedAt: "2026-07-31", sourceUrl: "https://example.test/questions#405" },
    ],
  };
}

describe("content release gate", () => {
  it("rejects duplicate reviews", () => {
    const manifest = approvedManifest();
    manifest.questions.push({ ...manifest.questions[0] });
    expect(validateContentRelease(manifest)).toContainEqual(
      expect.objectContaining({ message: "duplicate review record 405:he" })
    );
  });

  it("requires Hebrew and Arabic approvals for every published record", () => {
    const manifest = approvedManifest();
    manifest.signs = manifest.signs.filter((record) => record.locale === "he");
    expect(validatePublishableRelease(manifest, ["405"], ["705"], () => true)).toContainEqual(
      expect.objectContaining({ message: "missing ar approval for 705" })
    );
  });

  it("requires a source URL for explanations", () => {
    const manifest = approvedManifest();
    manifest.explanations[0].sourceUrl = "";
    expect(validateContentRelease(manifest)).toContainEqual(
      expect.objectContaining({ path: "explanations[0]", message: "sourceUrl must be HTTPS" })
    );
  });

  it("rejects Arabic approvals linked to a different source checksum", () => {
    const manifest = approvedManifest();
    manifest.questions[1].sourceChecksum = SIGN_SOURCE;
    expect(validateContentRelease(manifest)).toContainEqual(
      expect.objectContaining({ message: "Hebrew and Arabic approvals use different sources for 405" })
    );
  });

  it("requires pinned MediaWiki revision metadata for the sign source", () => {
    const manifest = approvedManifest();
    delete manifest.sources[1].revisionId;
    expect(validateContentRelease(manifest)).toContainEqual(
      expect.objectContaining({ message: "sign catalog revisionId is required" })
    );
  });

  it("rejects missing question-image assets before publishing", () => {
    expect(validatePublishableRelease(
      approvedManifest(),
      ["405"],
      ["705"],
      (path) => path !== "/questions/missing.jpg",
      ["/questions/missing.jpg"]
    )).toContainEqual(expect.objectContaining({ message: "asset is missing: /questions/missing.jpg" }));
  });
});
