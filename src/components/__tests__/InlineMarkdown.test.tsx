import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { InlineMarkdown } from "../InlineMarkdown";

describe("InlineMarkdown", () => {
  it("renders plain text as-is", () => {
    const { container } = render(<InlineMarkdown>טקסט רגיל ללא עיצוב</InlineMarkdown>);
    expect(container).toHaveTextContent("טקסט רגיל ללא עיצוב");
    expect(container.querySelector("strong")).toBeNull();
  });

  it("renders **bold** as <strong> without literal asterisks", () => {
    const { container } = render(
      <InlineMarkdown>{"**חגורות הבטיחות** מחזיקות את הנוסע"}</InlineMarkdown>
    );
    const strong = container.querySelector("strong");
    expect(strong).toHaveTextContent("חגורות הבטיחות");
    expect(container.textContent).not.toContain("**");
    expect(container).toHaveTextContent("מחזיקות את הנוסע");
  });

  it("renders *italic* as <em>", () => {
    const { container } = render(<InlineMarkdown>{"טקסט *מודגש קלות* כאן"}</InlineMarkdown>);
    expect(container.querySelector("em")).toHaveTextContent("מודגש קלות");
  });

  it("does not wrap output in a <p>", () => {
    const { container } = render(<InlineMarkdown>{"פסקה ראשונה\n\nפסקה שנייה"}</InlineMarkdown>);
    expect(container.querySelector("p")).toBeNull();
    expect(container).toHaveTextContent("פסקה ראשונה");
    expect(container).toHaveTextContent("פסקה שנייה");
  });

  it("degrades disallowed elements to their text content", () => {
    const { container } = render(
      <InlineMarkdown>{"ראו [קישור](https://example.com) ו-`קוד`"}</InlineMarkdown>
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("code")).toBeNull();
    expect(container).toHaveTextContent("קישור");
    expect(container).toHaveTextContent("קוד");
  });

  it("does not render raw HTML", () => {
    const { container } = render(
      <InlineMarkdown>{'טקסט <script>alert("x")</script> בטוח'}</InlineMarkdown>
    );
    expect(container.querySelector("script")).toBeNull();
  });
});
