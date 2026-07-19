import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import CreditsPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTranslations } from "next-intl/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src }: { src: string }) => React.createElement("img", { src }),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) =>
    React.createElement("div", { "data-testid": "tabbar", "data-active": active, "data-current": current ?? "none" }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("CreditsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(CreditsPage()).rejects.toThrow("redirect");
  });

  it("renders the More TabBar as active", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "more");
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-current", "none");
  });

  it("does not render a top-level back link", async () => {
    const jsx = await CreditsPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/more"]')).toBeNull();
  });

  it("renders the data sources section heading", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("dataSourcesTitle")).toBeInTheDocument();
  });

  it("renders the built-with section heading", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("builtWithTitle")).toBeInTheDocument();
  });

  it("credits the theory exam question bank (credit1Title)", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("credit1Title")).toBeInTheDocument();
  });

  it("credits Wikimedia Commons (credit3Title)", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("credit3Title")).toBeInTheDocument();
  });

  it("links Wikimedia Commons to the live Israel road-sign category", async () => {
    const jsx = await CreditsPage();
    const { container } = render(jsx);
    expect(
      container.querySelector('a[href="https://commons.wikimedia.org/wiki/Category:Road_signs_in_Israel"]'),
    ).toBeTruthy();
  });

  it("credits Next.js (hardcoded name)", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("Next.js")).toBeInTheDocument();
  });

  it("renders the page title heading (pageTitle key)", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByRole("heading", { level: 1, name: "pageTitle" })).toBeInTheDocument();
  });

  it("does not render the legacy copyright footer", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.queryByText("footer")).not.toBeInTheDocument();
  });
});
