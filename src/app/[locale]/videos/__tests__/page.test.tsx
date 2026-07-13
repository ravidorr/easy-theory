import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import VideosPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTranslations } from "next-intl/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
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

describe("VideosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    vi.mocked(getTranslations).mockResolvedValue((key: string) => key);
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

  it("renders the featured marathon video link", async () => {
    const jsx = await VideosPage();
    const { container } = render(jsx);
    const featured = container.querySelector(
      'a[href="https://www.youtube.com/watch?v=gd6ES_aAdI0"]'
    );
    expect(featured).toBeTruthy();
    expect(featured).toHaveAttribute("target", "_blank");
  });

  it("renders the second marathon video", async () => {
    const jsx = await VideosPage();
    const { container } = render(jsx);
    const second = container.querySelector(
      'a[href="https://www.youtube.com/watch?v=WsVi4kEiaPE"]'
    );
    expect(second).toBeTruthy();
  });

  it("renders lesson video titles as translation keys", async () => {
    const jsx = await VideosPage();
    render(jsx);
    expect(screen.getByText("lesson1Title")).toBeInTheDocument();
    expect(screen.getByText("lesson2Title")).toBeInTheDocument();
    expect(screen.getByText("lesson3Title")).toBeInTheDocument();
    expect(screen.getByText("lesson4Title")).toBeInTheDocument();
  });

  it("renders the featured video title as translation key", async () => {
    const jsx = await VideosPage();
    render(jsx);
    expect(screen.getByText("featuredTitle")).toBeInTheDocument();
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

  it("renders the TabBar", async () => {
    const jsx = await VideosPage();
    const { container } = render(jsx);
    expect(container.querySelector('[data-testid="tabbar"]')).toBeTruthy();
  });
});
