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
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src }: { src: string }) => React.createElement("img", { src }),
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

  it("renders a back link to /more", async () => {
    const jsx = await CreditsPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/more"]')).toBeTruthy();
  });

  it("gives the icon-only back link an accessible name", async () => {
    const jsx = await CreditsPage();
    const { container } = render(jsx);
    expect(container.querySelector("a[aria-label='backLabel']")).toBeTruthy();
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
});
