import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ResourcesPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTranslations } from "next-intl/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src }: { src: string }) =>
    React.createElement("img", { src, alt: "" }),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: () => React.createElement("div", { "data-testid": "tabbar" }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("ResourcesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    vi.mocked(getTranslations).mockResolvedValue((key: string) => key);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(ResourcesPage()).rejects.toThrow("redirect");
  });

  it("renders all four external links with target=_blank", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const externalLinks = container.querySelectorAll("a[target='_blank']");
    expect(externalLinks).toHaveLength(4);
  });

  it("renders link to the official government signs chart", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const link = container.querySelector(
      'a[href="https://www.gov.il/he/pages/tamrurim_7924_01_18"]'
    );
    expect(link).toBeTruthy();
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders link to the official question bank", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const link = container.querySelector(
      'a[href="https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data"]'
    );
    expect(link).toBeTruthy();
  });

  it("renders link to noeg.co.il practice simulator", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const link = container.querySelector('a[href="https://m.noeg.co.il/"]');
    expect(link).toBeTruthy();
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders link to Hebrew Wikipedia signs article", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const link = container.querySelector('a[href*="wikipedia.org"]');
    expect(link).toBeTruthy();
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders the TabBar", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    expect(container.querySelector('[data-testid="tabbar"]')).toBeTruthy();
  });

  it("renders page heading (pageTitle key)", async () => {
    const jsx = await ResourcesPage();
    render(jsx);
    expect(screen.getByText("pageTitle")).toBeInTheDocument();
  });
});
