import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyStateCard } from "../EmptyStateCard";

describe("EmptyStateCard", () => {
  it("renders its content, actions, and semantic tone", () => {
    const { container } = render(
      <EmptyStateCard
        icon="bookmark"
        tone="primary"
        title="Saved questions"
        description="Save questions while practicing."
        actions={<button type="button">Start practicing</button>}
      />
    );

    expect(screen.getByRole("heading", { name: "Saved questions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start practicing" })).toBeInTheDocument();
    expect(container.querySelector("[data-empty-state]")).toHaveAttribute("data-tone", "primary");
  });
});
