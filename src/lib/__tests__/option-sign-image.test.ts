import { describe, expect, it } from "vitest";
import { resolveOptionSignImage } from "@/lib/option-sign-image";

describe("resolveOptionSignImage", () => {
  it("renders existing numeric sign options in the signs topic", () => {
    expect(resolveOptionSignImage("110", true)).toBe("/signs/sign-110.png");
  });

  it("keeps numeric answers as text outside the signs topic", () => {
    expect(resolveOptionSignImage("110", false)).toBeNull();
  });
});
