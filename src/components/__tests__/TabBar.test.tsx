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

  it("applies bold font weight only to the active tab label", () => {
    render(<TabBar active="topics" />);
    expect(screen.getByText("נושאים")).toHaveStyle({ fontWeight: 700 });
    expect(screen.getByText("הבית")).toHaveStyle({ fontWeight: 600 });
    expect(screen.getByText("כרטיסיות")).toHaveStyle({ fontWeight: 600 });
    expect(screen.getByText("עוד")).toHaveStyle({ fontWeight: 600 });
  });
});
