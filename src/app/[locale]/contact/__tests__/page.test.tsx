import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ContactPage from "../page";
import { createClient } from "@/lib/supabase";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) =>
    React.createElement("a", { href, ...props }, children),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) =>
    React.createElement("div", { "data-testid": "tabbar", "data-active": active, "data-current": current ?? "none" }),
}));
vi.mock("../ContactForm", () => ({
  ContactForm: () => React.createElement("div", { "data-testid": "contact-form" }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

const mockCreateClient = vi.mocked(createClient);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("ContactPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
  });

  it("redirects to login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(ContactPage()).rejects.toThrow("redirect");
  });

  it("renders the canonical close control back to More", async () => {
    const jsx = await ContactPage();
    render(jsx);
    expect(screen.getByRole("link", { name: "closeLabel" })).toHaveAttribute("href", "/more");
  });

  it("keeps the More tab bar visible but inactive", async () => {
    const jsx = await ContactPage();
    render(jsx);
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "more");
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-current", "none");
  });

  it("renders the contact heading and form", async () => {
    const jsx = await ContactPage();
    render(jsx);
    expect(screen.getByRole("heading", { level: 1, name: "pageTitle" })).toBeInTheDocument();
    expect(screen.getByTestId("contact-form")).toBeInTheDocument();
  });
});
