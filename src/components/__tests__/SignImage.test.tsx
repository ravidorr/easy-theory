import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SignImage } from "@/components/SignImage";

// next/image renders as <img> in the test environment via this shim
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
    style,
    onError,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    style?: React.CSSProperties;
    onError?: React.ReactEventHandler<HTMLImageElement>;
  }) =>
    React.createElement("img", { src, alt, width, height, className, style, onError }),
}));

describe("SignImage", () => {
  it("renders the sign with correct src, alt, and class", () => {
    render(<SignImage src="/signs/sign-146.png" alt="תמרור 146" size="sm" />);
    const img = screen.getByRole("img", { name: "תמרור 146" });
    expect(img).toHaveAttribute("src", "/signs/sign-146.png");
    expect(img).toHaveClass("sign-image");
  });

  it("passes correct width and height attributes for each size", () => {
    const { rerender } = render(<SignImage src="/signs/sign-1.png" alt="" size="xs" />);
    expect(screen.getByRole("presentation")).toHaveAttribute("width", "32");
    expect(screen.getByRole("presentation")).toHaveAttribute("height", "32");

    rerender(<SignImage src="/signs/sign-1.png" alt="" size="sm" />);
    expect(screen.getByRole("presentation")).toHaveAttribute("width", "52");
    expect(screen.getByRole("presentation")).toHaveAttribute("height", "52");

    rerender(<SignImage src="/signs/sign-1.png" alt="" size="md" />);
    expect(screen.getByRole("presentation")).toHaveAttribute("width", "96");
    expect(screen.getByRole("presentation")).toHaveAttribute("height", "96");
  });

  it("passes custom style overrides through", () => {
    render(
      <SignImage
        src="/signs/sign-101.png"
        alt=""
        size="md"
        style={{ width: "65%", maxHeight: "60%" }}
      />,
    );
    const img = screen.getByRole("presentation");
    expect(img).toHaveStyle({ width: "65%", maxHeight: "60%" });
  });

  it("falls back to /placeholder.svg on image load error", () => {
    render(<SignImage src="/signs/sign-146.png" alt="test" />);
    const img = screen.getByRole("img", { name: "test" }) as HTMLImageElement;
    img.srcset = "/_next/image?url=%2Fsigns%2Fsign-146.png&w=96&q=75 1x";
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", "/placeholder.svg");
    expect(img.srcset).toBe("");
  });

  it("does not apply mixBlendMode multiply", () => {
    render(<SignImage src="/signs/sign-146.png" alt="תמרור 146" size="sm" />);
    const img = screen.getByRole("img", { name: "תמרור 146" });
    expect(img).not.toHaveStyle({ mixBlendMode: "multiply" });
  });
});
