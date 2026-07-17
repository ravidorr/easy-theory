import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Skeleton,
  SkeletonCard,
  SkeletonCol,
  SkeletonIconCard,
  SkeletonRow,
  SkeletonScreen,
} from "../Skeleton";

describe("Skeleton", () => {
  it("defaults to the line variant", () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector("[data-skeleton]");
    expect(el).toHaveAttribute("data-skeleton", "line");
  });

  it.each(["line", "lineLg", "pill", "block", "circle", "bar", "image"] as const)(
    "renders the %s variant hidden from assistive tech",
    (variant) => {
      const { container } = render(<Skeleton variant={variant} />);
      const el = container.querySelector(`[data-skeleton="${variant}"]`);
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute("aria-hidden", "true");
    }
  );

  it("accepts a size without changing the variant marker", () => {
    const { container } = render(<Skeleton variant="circle" size="s72" />);
    expect(container.querySelector('[data-skeleton="circle"]')).toBeInTheDocument();
  });
});

describe("SkeletonCard", () => {
  it("renders children inside an aria-hidden card", () => {
    const { container } = render(
      <SkeletonCard>
        <Skeleton variant="line" />
      </SkeletonCard>
    );
    const card = container.querySelector('[data-skeleton="card"]');
    expect(card).toHaveAttribute("aria-hidden", "true");
    expect(card?.querySelector('[data-skeleton="line"]')).toBeInTheDocument();
  });

});

describe("SkeletonIconCard", () => {
  it("renders an icon block beside two text lines inside a card", () => {
    const { container } = render(<SkeletonIconCard />);
    const card = container.querySelector('[data-skeleton="card"]');
    expect(card?.querySelector('[data-skeleton="block"]')).toBeInTheDocument();
    expect(card?.querySelectorAll('[data-skeleton="line"]')).toHaveLength(2);
  });
});

describe("SkeletonRow and SkeletonCol", () => {
  it("group children inside aria-hidden layout wrappers", () => {
    const { container } = render(
      <SkeletonRow>
        <Skeleton variant="circle" />
        <SkeletonCol>
          <Skeleton variant="line" />
        </SkeletonCol>
      </SkeletonRow>
    );
    const row = container.querySelector('[data-skeleton="row"]');
    const col = container.querySelector('[data-skeleton="col"]');
    expect(row).toHaveAttribute("aria-hidden", "true");
    expect(col).toHaveAttribute("aria-hidden", "true");
    expect(col?.querySelector('[data-skeleton="line"]')).toBeInTheDocument();
  });
});

describe("SkeletonScreen", () => {
  it("marks the main landmark busy and announces only the label", () => {
    const { container } = render(
      <SkeletonScreen label="loading" className="page">
        <Skeleton variant="block" />
      </SkeletonScreen>
    );
    const main = container.querySelector("main");
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(main).toHaveClass("page");
    expect(screen.getByRole("status")).toHaveTextContent("loading");
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    expect(container.querySelector('[data-skeleton="block"]')).toBeInTheDocument();
  });
});
