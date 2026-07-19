import { describe, it, expect, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuestionImage } from "@/components/QuestionImage";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    sizes,
    className,
    onError,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    sizes: string;
    className?: string;
    onError?: React.ReactEventHandler<HTMLImageElement>;
  }) => React.createElement("img", { src, alt, width, height, sizes, className, onError }),
}));

describe("QuestionImage", () => {
  it("renders the optimized question image with its layout props", () => {
    render(<QuestionImage src="/questions/3590.jpg" alt="attached image" className="question-image" />);

    const image = screen.getByRole("img", { name: "attached image" });
    expect(image).toHaveAttribute("src", "/questions/3590.jpg");
    expect(image).toHaveAttribute("width", "480");
    expect(image).toHaveAttribute("height", "270");
    expect(image).toHaveAttribute("sizes", "(max-width: 480px) 100vw, 440px");
    expect(image).toHaveClass("question-image");
  });

  it("falls back to the placeholder after an image load error", () => {
    render(<QuestionImage src="/questions/3590.jpg" alt="attached image" />);

    const image = screen.getByRole("img", { name: "attached image" }) as HTMLImageElement;
    image.srcset = "/_next/image?url=%2Fquestions%2F3590.jpg&w=640&q=75 1x";
    fireEvent.error(image);

    expect(image).toHaveAttribute("src", "/placeholder.svg");
    expect(image.srcset).toBe("");
  });
});
