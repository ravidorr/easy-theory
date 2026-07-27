import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import PracticePage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopics } from "@/lib/db";

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getTopics: vi.fn() }));
vi.mock("@/components/TabBar", () => ({ TabBar: () => React.createElement("div", { "data-testid": "tabbar" }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: React.ComponentProps<"a">) => React.createElement("a", { href }, children) }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetTopics = vi.mocked(getTopics);
function client(user: { id: string } | null = { id: "u1" }) { return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } }; }

describe("PracticePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(client() as never);
    mockGetTopics.mockResolvedValue([
      { id: "signs", slug: "signs", name_he: "תמרורים", name_ar: "إشارات المرور" },
    ] as never);
  });

  it("redirects unauthenticated learners", async () => {
    mockCreateClient.mockResolvedValue(client(null) as never);
    await expect(PracticePage()).rejects.toThrow("redirect");
  });

  it("renders each practice topic and its tab bar", async () => {
    const { container } = render(await PracticePage());
    expect(screen.getByRole("link", { name: "reviewMistakes" })).toHaveAttribute("href", "/mistakes");
    expect(screen.getByRole("link", { name: "תמרורים" })).toHaveAttribute("href", "/topics/signs");
    expect(container.querySelector('[data-testid="tabbar"]')).toBeTruthy();
  });

  it("renders Arabic topic names without Hebrew fallback", async () => {
    const { getLocale } = await import("next-intl/server");
    vi.mocked(getLocale).mockResolvedValue("ar");

    render(await PracticePage());

    expect(screen.getByRole("link", { name: "إشارات المرور" })).toHaveAttribute("href", "/topics/signs");
    expect(screen.queryByText("תמרורים")).not.toBeInTheDocument();
  });
});
