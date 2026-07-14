import { describe, it, expect, vi } from "vitest";
import CatchAllPage from "../[...rest]/page";
import { notFound } from "next/navigation";

vi.mock("next/navigation", () => ({
  notFound: vi.fn().mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("CatchAllPage", () => {
  it("triggers the localized not-found boundary for unmatched paths", () => {
    expect(() => CatchAllPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
