import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ResourcesPage from "../page";
import { createClient } from "@/lib/supabase";
import { getResources, getVideos, type Resource, type Video } from "@/lib/db";
import { getLocale } from "next-intl/server";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt?: string; className?: string }) =>
    React.createElement("img", { src, alt, className }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getResources: vi.fn(), getVideos: vi.fn() }));
vi.mock("@/components/SignImage", () => ({ SignImage: ({ src }: { src: string }) => React.createElement("img", { src, alt: "" }) }));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current: string | null }) =>
    React.createElement("div", { "data-testid": "tabbar", "data-active": active, "data-current": current ?? "" }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetResources = vi.mocked(getResources);
const mockGetVideos = vi.mocked(getVideos);

function client(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

function resource(overrides: Partial<Resource>): Resource {
  return { id: "r", href: "https://example.com", section: "official", order_index: 1, title_he: "resource he", title_ar: "resource ar", description_he: "description he", description_ar: "description ar", icon_type: "char", icon_value: "?", icon_variant: "primary", ...overrides };
}

function video(overrides: Partial<Video>): Video {
  return { id: "v", youtube_id: "video-id", section: "lesson", is_featured: false, order_index: 1, title_he: "video he", title_ar: "video ar", description_he: "description he", description_ar: "description ar", tag_he: "tag he", tag_ar: "tag ar", duration_label_he: null, duration_label_ar: null, ...overrides };
}

describe("ResourcesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(client() as never);
    mockGetResources.mockResolvedValue([
      resource({ id: "official", href: "https://gov.example", icon_type: "sign", icon_value: "/signs/sign-301.png" }),
      resource({ id: "practice", href: "https://practice.example", section: "practice" }),
    ]);
    mockGetVideos.mockResolvedValue([
      video({ id: "featured", youtube_id: "featured", section: "marathon", is_featured: true, duration_label_he: "40 דקות", duration_label_ar: "40 دقيقة" }),
      video({ id: "marathon", youtube_id: "marathon", section: "marathon" }),
      video({ id: "lesson", youtube_id: "lesson" }),
    ]);
  });

  it("redirects unauthenticated learners", async () => {
    mockCreateClient.mockResolvedValue(client(null) as never);
    await expect(ResourcesPage()).rejects.toThrow("redirect");
  });

  it("renders the video lessons before the external resources", async () => {
    const { container } = render(await ResourcesPage());
    const links = Array.from(container.querySelectorAll("a[target='_blank']"));

    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://www.youtube.com/watch?v=featured",
      "https://www.youtube.com/watch?v=marathon",
      "https://www.youtube.com/watch?v=lesson",
      "https://gov.example",
      "https://practice.example",
    ]);
    links.forEach((link) => expect(link).toHaveAttribute("rel", "noopener noreferrer"));
    expect(screen.getByText("40 דקות")).toBeInTheDocument();
  });

  it("uses Arabic content without Hebrew fallback", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar");
    render(await ResourcesPage());

    expect(screen.getAllByText("video ar")).toHaveLength(3);
    expect(screen.getAllByText("resource ar")).toHaveLength(2);
    expect(screen.queryByText("video he")).not.toBeInTheDocument();
    expect(screen.queryByText("resource he")).not.toBeInTheDocument();
  });

  it("renders safely when both content collections are empty", async () => {
    mockGetResources.mockResolvedValue([]);
    mockGetVideos.mockResolvedValue([]);
    const { container } = render(await ResourcesPage());
    expect(container.querySelectorAll("a[target='_blank']")).toHaveLength(0);
  });

  it("groups the page under More without marking More as the current route", async () => {
    render(await ResourcesPage());
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "more");
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-current", "");
  });
});
