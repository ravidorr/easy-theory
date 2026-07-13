import { describe, it, expect } from "vitest";
import manifest from "../manifest";
import he from "../../../messages/he.json";

describe("manifest", () => {
  const result = manifest();

  it("uses the default-locale strings from messages/he.json", () => {
    expect(result.name).toBe(he.Metadata.rootTitle);
    expect(result.short_name).toBe(he.Metadata.shortName);
    expect(result.description).toBe(he.Metadata.rootDescription);
  });

  it("is installable as a standalone RTL Hebrew app", () => {
    expect(result.id).toBe("/");
    expect(result.start_url).toBe("/");
    expect(result.scope).toBe("/");
    expect(result.display).toBe("standalone");
    expect(result.dir).toBe("rtl");
    expect(result.lang).toBe("he");
  });

  it("matches the dark theme first paint", () => {
    expect(result.theme_color).toBe("#131829");
    expect(result.background_color).toBe("#131829");
  });

  it("declares the 192 and 512 png icons", () => {
    expect(result.icons).toEqual([
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ]);
  });
});
