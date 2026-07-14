import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import VideosPage from "../page";
import { createClient } from "@/lib/supabase";
import { getVideos, type Video } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt?: string; className?: string }) =>
    React.createElement("img", { src, alt, className }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getVideos: vi.fn() }));
vi.mock("@/components/TabBar", () => ({
  TabBar: () => React.createElement("div", { "data-testid": "tabbar" }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetVideos = vi.mocked(getVideos);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

function makeVideo(overrides: Partial<Video>): Video {
  return {
    id: "v0",
    youtube_id: "yt0",
    section: "lesson",
    is_featured: false,
    order_index: 1,
    title_he: "title he",
    title_ar: "title ar",
    description_he: null,
    description_ar: null,
    tag_he: null,
    tag_ar: null,
    duration_label_he: null,
    duration_label_ar: null,
    ...overrides,
  };
}

const fixtures: Video[] = [
  makeVideo({
    id: "v1",
    youtube_id: "gd6ES_aAdI0",
    section: "marathon",
    is_featured: true,
    order_index: 1,
    title_he: "marathon featured he",
    title_ar: "marathon featured ar",
    description_he: "featured desc he",
    description_ar: "featured desc ar",
    duration_label_he: "40 min he",
    duration_label_ar: "40 min ar",
  }),
  makeVideo({
    id: "v2",
    youtube_id: "WsVi4kEiaPE",
    section: "marathon",
    order_index: 2,
    title_he: "marathon row he",
    title_ar: "marathon row ar",
    description_he: "row desc he",
    description_ar: "row desc ar",
  }),
  makeVideo({
    id: "v3",
    youtube_id: "vk37Vd80S2E",
    order_index: 1,
    title_he: "lesson 1 he",
    title_ar: "lesson 1 ar",
    tag_he: "tag 1 he",
    tag_ar: "tag 1 ar",
  }),
  makeVideo({
    id: "v4",
    youtube_id: "Rp4wFyF-dok",
    order_index: 2,
    title_he: "lesson 2 he",
    title_ar: null,
    tag_he: "tag 2 he",
    tag_ar: null,
  }),
  makeVideo({
    id: "v5",
    youtube_id: "nwbIrAdn8Qc",
    order_index: 3,
    title_he: "lesson 3 he",
    tag_he: "tag 3 he",
  }),
  makeVideo({
    id: "v6",
    youtube_id: "kJ5y5JlkMjc",
    order_index: 4,
    title_he: "lesson 4 he",
    tag_he: "tag 4 he",
  }),
];

describe("VideosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetVideos.mockResolvedValue(fixtures);
    vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(VideosPage()).rejects.toThrow("redirect");
  });

  it("renders all YouTube video links with target=_blank", async () => {
    const jsx = await VideosPage();
    const { container } = render(jsx);
    const youtubeLinks = container.querySelectorAll(
      'a[href*="youtube.com"][target="_blank"]'
    );
    // 2 marathon videos + 4 topic lessons = 6 total
    expect(youtubeLinks).toHaveLength(6);
  });

  it("renders the featured marathon video link with its duration badge", async () => {
    const jsx = await VideosPage();
    const { container } = render(jsx);
    const featured = container.querySelector(
      'a[href="https://www.youtube.com/watch?v=gd6ES_aAdI0"]'
    );
    expect(featured).toBeTruthy();
    expect(featured).toHaveAttribute("target", "_blank");
    expect(screen.getByText("40 min he")).toBeInTheDocument();
  });

  it("renders the second marathon video", async () => {
    const jsx = await VideosPage();
    const { container } = render(jsx);
    const second = container.querySelector(
      'a[href="https://www.youtube.com/watch?v=WsVi4kEiaPE"]'
    );
    expect(second).toBeTruthy();
  });

  it("renders lesson video titles from the DB rows", async () => {
    const jsx = await VideosPage();
    render(jsx);
    expect(screen.getByText("lesson 1 he")).toBeInTheDocument();
    expect(screen.getByText("lesson 2 he")).toBeInTheDocument();
    expect(screen.getByText("lesson 3 he")).toBeInTheDocument();
    expect(screen.getByText("lesson 4 he")).toBeInTheDocument();
  });

  it("renders the featured video title from the DB row", async () => {
    const jsx = await VideosPage();
    render(jsx);
    expect(screen.getByText("marathon featured he")).toBeInTheDocument();
  });

  it("renders Arabic fields for the ar locale, falling back to Hebrew", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar");
    const jsx = await VideosPage();
    render(jsx);
    expect(screen.getByText("marathon featured ar")).toBeInTheDocument();
    expect(screen.getByText("lesson 1 ar")).toBeInTheDocument();
    // lesson 2 has no Arabic translation, so the Hebrew text is shown
    expect(screen.getByText("lesson 2 he")).toBeInTheDocument();
  });

  it("renders all YouTube links with rel=noopener noreferrer", async () => {
    const jsx = await VideosPage();
    const { container } = render(jsx);
    const youtubeLinks = Array.from(
      container.querySelectorAll('a[href*="youtube.com"]')
    );
    youtubeLinks.forEach((link) => {
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("renders no video links when the table is empty", async () => {
    mockGetVideos.mockResolvedValue([]);
    const jsx = await VideosPage();
    const { container } = render(jsx);
    expect(container.querySelectorAll('a[href*="youtube.com"]')).toHaveLength(0);
  });

  it("renders the TabBar", async () => {
    const jsx = await VideosPage();
    const { container } = render(jsx);
    expect(container.querySelector('[data-testid="tabbar"]')).toBeTruthy();
  });
});
