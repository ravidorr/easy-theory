import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import CreditsPage from "../page";
import { createClient } from "@/lib/supabase";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) =>
    React.createElement("a", { href }, children as React.ReactNode),
}));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src }: { src: string }) => React.createElement("img", { src }),
}));

const mockCreateClient = vi.mocked(createClient);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("CreditsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
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

  it("renders the data sources section", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("מקורות נתונים")).toBeInTheDocument();
  });

  it("renders the built-with section", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("נבנה עם")).toBeInTheDocument();
  });

  it("credits the theory exam question bank", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("מאגר שאלות התיאוריה")).toBeInTheDocument();
  });

  it("credits Wikimedia Commons", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("Wikimedia Commons")).toBeInTheDocument();
  });

  it("credits Next.js", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByText("Next.js")).toBeInTheDocument();
  });

  it("renders the page title", async () => {
    const jsx = await CreditsPage();
    render(jsx);
    expect(screen.getByRole("heading", { level: 1, name: "קרדיטים" })).toBeInTheDocument();
  });
});
