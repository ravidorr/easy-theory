import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import NotFound from "../not-found";

vi.mock("next/error", () => ({
  default: ({ statusCode }: { statusCode: number }) =>
    React.createElement("div", { id: "error" }, String(statusCode)),
}));

describe("NotFound", () => {
  it("renders its own html element since it mounts outside the [locale] layout", () => {
    const html = renderToStaticMarkup(React.createElement(NotFound));
    expect(html).toContain("<html");
    expect(html).toContain('lang="he"');
    expect(html).toContain('dir="rtl"');
  });

  it("renders the 404 error page", () => {
    const html = renderToStaticMarkup(React.createElement(NotFound));
    expect(html).toContain("404");
  });
});
