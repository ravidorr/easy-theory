import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Icon, type IconName } from "@/components/Icon";

describe("Icon", () => {
  it("renders a decorative svg with the icon's viewBox", () => {
    const { container } = render(<Icon name="flame" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("uses a 24x24 viewBox for stroke icons", () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("defaults to size 24", () => {
    const { container } = render(<Icon name="calendar" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });

  it("applies an explicit size to width and height", () => {
    const { container } = render(<Icon name="star" size={18} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("height", "18");
  });

  it("passes className through", () => {
    const { container } = render(<Icon name="chevron-left" className="nav-chevron" />);
    expect(container.querySelector("svg")).toHaveClass("nav-chevron");
  });

  it("renders the milestone medal icons gem and trophy as 16x16 fill icons", () => {
    for (const name of ["gem", "trophy"] as const) {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
      expect(svg!.querySelector("path")).toHaveAttribute("fill", "currentColor");
    }
  });

  it("renders the close, warning, and target icons as 24x24 stroke icons", () => {
    for (const name of ["close", "warning", "target"] as const) {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      expect(svg!.querySelector("[stroke='currentColor']")).not.toBeNull();
    }
  });

  it("renders nothing for an unknown name", () => {
    const { container } = render(<Icon name={"nope" as IconName} />);
    expect(container.firstChild).toBeNull();
  });
});
