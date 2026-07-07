import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignImage } from "@/components/SignImage";

describe("SignImage", () => {
  it("renders the sign without multiply blend mode", () => {
    render(<SignImage src="/signs/sign-146.png" alt="תמרור 146" size="sm" />);

    const img = screen.getByRole("img", { name: "תמרור 146" });
    expect(img).toHaveAttribute("src", "/signs/sign-146.png");
    expect(img).toHaveClass("sign-image");
    expect(img).toHaveStyle({ width: "52px", height: "52px" });
    expect(img).not.toHaveStyle({ mixBlendMode: "multiply" });
  });

  it("supports custom dimensions via style overrides", () => {
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
});
