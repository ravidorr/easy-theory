import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import FaqPage from "../page";
import { createClient } from "@/lib/supabase";
import { getLatestSourceRelease } from "@/lib/db";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getLatestSourceRelease: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) =>
    React.createElement("a", { href, ...props }, children),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetLatestSourceRelease = vi.mocked(getLatestSourceRelease);

describe("FaqPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({} as never);
  });

  it("renders every FAQ item, the official source, and its JSON-LD", async () => {
    mockGetLatestSourceRelease.mockResolvedValue(null);
    const { container } = render(await FaqPage());

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
    expect(screen.getByRole("link", { name: "לאבחון קצר" })).toHaveAttribute("href", "/diagnostic");
    expect(screen.getByRole("link", { name: "מאגר השאלות הרשמי של משרד התחבורה" })).toHaveAttribute(
      "href",
      expect.stringContaining("gov.il")
    );
    expect(container.querySelector('script[type="application/ld+json"]')?.textContent).toContain("FAQPage");
    expect(screen.queryByText("עדכון המאגר מתועד בכל גרסת ייבוא.")).toBeNull();
  });

  it("shows the source-release note when import metadata exists", async () => {
    mockGetLatestSourceRelease.mockResolvedValue({ id: "release-1" } as never);
    render(await FaqPage());

    expect(screen.getByText("עדכון המאגר מתועד בכל גרסת ייבוא.")).toBeInTheDocument();
  });
});
