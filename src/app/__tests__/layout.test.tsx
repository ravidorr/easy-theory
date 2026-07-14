import { describe, it, expect } from "vitest";
import RootLayout from "../layout";

describe("RootLayout", () => {
  it("passes children through without wrapping them", () => {
    const children = <div>content</div>;
    expect(RootLayout({ children })).toBe(children);
  });
});
