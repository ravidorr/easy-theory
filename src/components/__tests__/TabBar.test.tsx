import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabBar } from "../TabBar";

describe("TabBar", () => {
  const tabs = [
    { label: "הבית", href: "/" },
    { label: "נושאים", href: "/topics" },
    { label: "כרטיסיות", href: "/flashcards" },
    { label: "עוד", href: "/more" },
  ];

  it("renders all four tab labels", () => {
    render(<TabBar active="home" />);
    for (const { label } of tabs) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders correct hrefs for all tabs", () => {
    render(<TabBar active="home" />);
    for (const { label, href } of tabs) {
      expect(screen.getByText(label).closest("a")).toHaveAttribute("href", href);
    }
  });

  it("marks only the active tab with aria-current", () => {
    render(<TabBar active="topics" />);
    expect(screen.getByText("נושאים").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("הבית").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("כרטיסיות").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("עוד").closest("a")).not.toHaveAttribute("aria-current");
  });
});
