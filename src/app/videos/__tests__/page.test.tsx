import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import VideosPage from "../page";
import { createClient } from "@/lib/supabase";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, style }: { href: string; children: unknown; style?: unknown }) =>
    React.createElement("a", { href, style }, children as React.ReactNode),
}));

const mockCreateClient = vi.mocked(createClient);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("VideosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
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
    // 2 marathon videos + 3 topic lessons = 5 total
    expect(youtubeLinks).toHaveLength(5);
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

  it("renders topic lesson video titles", async () => {
    const jsx = await VideosPage();
    render(jsx);
    expect(screen.getByText("מבוא לתמרורים")).toBeInTheDocument();
    expect(screen.getByText("זכות קדימה בצמתים")).toBeInTheDocument();
    expect(screen.getByText("התנהגות בצמתים מורכבים")).toBeInTheDocument();
  });

  it("renders the featured video title", async () => {
    const jsx = await VideosPage();
    render(jsx);
    expect(screen.getByText("מרתון הכנה למבחן התיאוריה")).toBeInTheDocument();
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

  it("renders back link to /more", async () => {
    const jsx = await VideosPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/more"]')).toBeTruthy();
  });
});
