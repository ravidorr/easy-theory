import { describe, it, expect } from "vitest";
import React from "react";
import RootLayout from "../layout";

// Tests the root src/app/layout.tsx — a pass-through so the root not-found
// boundary has a layout above it. The <html>/<body> tree, theme, viewport and
// per-locale behaviour are tested in src/app/[locale]/__tests__/layout.test.tsx.
describe("RootLayout", () => {
  it("passes children through without wrapping them", () => {
    const child = React.createElement("p", { id: "test-child" }, "hello");
    expect(RootLayout({ children: child })).toBe(child);
  });
});
