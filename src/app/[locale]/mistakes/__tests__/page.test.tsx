import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import MistakesPage from "../page";
import { createClient } from "@/lib/supabase";
import { getMistakesForTopic, getTopics } from "@/lib/db";
import { getLocale } from "next-intl/server";

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("next/image", () => ({
  default: ({ src, alt, className, width, height }: { src: string; alt?: string; className?: string; width?: number; height?: number }) =>
    React.createElement("img", { src, alt, className, width, height }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getMistakesForTopic: vi.fn(), getTopics: vi.fn() }));
vi.mock("@/components/TabBar", () => ({ TabBar: ({ active, current }: { active: string; current: string | null }) => React.createElement("div", { "data-testid": "tabbar", "data-active": active, "data-current": current ?? "" }) }));
vi.mock("@/lib/navigation", () => ({ Link: ({ href, children }: React.ComponentProps<"a">) => React.createElement("a", { href }, children) }));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("he"),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetTopics = vi.mocked(getTopics);
const mockGetMistakesForTopic = vi.mocked(getMistakesForTopic);
const mockGetLocale = vi.mocked(getLocale);
const topics = [
  { id: "signs", slug: "signs", name_he: "תמרורים", name_ar: "إشارات المرور", icon: "/signs/sign-302.png" },
  { id: "laws", slug: "traffic-laws", name_he: "חוקי תנועה", name_ar: "قوانين المرور" },
];

function client(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("MistakesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(client() as never);
    mockGetTopics.mockResolvedValue(topics as never);
    mockGetMistakesForTopic.mockResolvedValue([] as never);
    mockGetLocale.mockResolvedValue("he" as never);
  });

  it("redirects unauthenticated learners", async () => {
    mockCreateClient.mockResolvedValue(client(null) as never);
    await expect(MistakesPage()).rejects.toThrow("redirect");
  });

  it("renders only topics with mistakes and retains the tab bar", async () => {
    mockGetMistakesForTopic.mockImplementation(async (_db, _user, topicId) => topicId === "signs" ? [{ id: "q1" }] as never : [] as never);
    const { container } = render(await MistakesPage());

    expect(screen.getByRole("link", { name: /תמרורים/ })).toHaveAttribute("href", "/topics/signs/review?scope=all");
    expect(container.querySelector('img[src="/signs/sign-302.png"]')).toHaveAttribute("width", "32");
    expect(screen.queryByText("empty")).toBeNull();
    expect(container.querySelector('[data-testid="tabbar"]')).toHaveAttribute("data-active", "practice");
    expect(container.querySelector('[data-testid="tabbar"]')).toHaveAttribute("data-current", "");
  });

  it("uses a 20px warning icon when a topic has no sign artwork", async () => {
    mockGetTopics.mockResolvedValue([{ id: "laws", slug: "laws", name_he: "חוקים", name_ar: "قوانين", icon: null }] as never);
    mockGetMistakesForTopic.mockResolvedValue([{ id: "q1" }] as never);

    const { container } = render(await MistakesPage());

    expect(container.querySelector('[data-icon="warning"]')).toHaveAttribute("width", "20");
  });

  it("shows the empty state when every topic has no mistakes", async () => {
    const { container } = render(await MistakesPage());
    expect(screen.getByText("empty")).toBeInTheDocument();
    expect(screen.getByText("emptyTitle")).toBeInTheDocument();
    expect(container.querySelector('[data-empty-state]')).toHaveAttribute("data-tone", "success");
    expect(screen.getByRole("link", { name: "emptyCta" })).toHaveAttribute("href", "/practice");
  });

  it("uses Arabic topic names without rendering the Hebrew source field", async () => {
    mockGetLocale.mockResolvedValue("ar" as never);
    mockGetMistakesForTopic.mockImplementation(async (_db, _user, topicId) =>
      topicId === "signs" ? [{ id: "q1" }] as never : [] as never
    );

    render(await MistakesPage());

    expect(screen.getByRole("link", { name: /إشارات المرور/ })).toBeInTheDocument();
    expect(screen.queryByText("תמרורים")).not.toBeInTheDocument();
  });
});
