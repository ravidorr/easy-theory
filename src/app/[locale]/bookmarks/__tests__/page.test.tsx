import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import BookmarksPage from "../page";
import { createClient } from "@/lib/supabase";
import { getBookmarkedQuestions } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";

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
vi.mock("@/lib/db", () => ({
  getBookmarkedQuestions: vi.fn(),
}));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src, alt = "" }: { src: string; alt?: string }) =>
    React.createElement("img", { src, alt, "data-testid": "sign-img" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));
vi.mock("next/script", () => ({
  default: ({ src }: { src: string }) =>
    React.createElement("script", { "data-src": src }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetBookmarks = vi.mocked(getBookmarkedQuestions);

const BOOKMARK_A = {
  id: "q1",
  question_he: "מה המשמעות של תמרור זה?",
  option_a: "עצור",
  option_b: "פנה ימינה",
  option_c: "פנה שמאלה",
  option_d: "המשך",
  correct_option: "a",
  explanation_he: "תמרור זה משמעותו עצור",
  image_url: null,
  bookmarked_at: "2026-01-02",
};

const BOOKMARK_B = {
  id: "q2",
  question_he: "מה הגיל המינימלי?",
  option_a: "16",
  option_b: "17",
  option_c: "18",
  option_d: "21",
  correct_option: "c",
  explanation_he: null,
  image_url: null,
  bookmarked_at: "2026-01-01",
};

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("BookmarksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetBookmarks.mockResolvedValue([]);
    vi.mocked(getTranslations).mockResolvedValue((key: string) => key);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(BookmarksPage()).rejects.toThrow("redirect");
  });

  it("shows emptyHint and a home link when there are no bookmarks", async () => {
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    expect(screen.getByText("emptyHint")).toBeInTheDocument();
    expect(container.querySelector('a[href="/"]')).toBeTruthy();
  });

  it("shows countOne for a single bookmark", async () => {
    mockGetBookmarks.mockResolvedValue([BOOKMARK_A] as never);
    const jsx = await BookmarksPage();
    render(jsx);
    expect(screen.getByText("countOne")).toBeInTheDocument();
  });

  it("shows countMany for multiple bookmarks", async () => {
    mockGetBookmarks.mockResolvedValue([BOOKMARK_A, BOOKMARK_B] as never);
    const jsx = await BookmarksPage();
    render(jsx);
    expect(screen.getByText("countMany")).toBeInTheDocument();
  });

  it("renders question text for each bookmark", async () => {
    mockGetBookmarks.mockResolvedValue([BOOKMARK_A, BOOKMARK_B] as never);
    const jsx = await BookmarksPage();
    render(jsx);
    expect(screen.getByText("מה המשמעות של תמרור זה?")).toBeInTheDocument();
    expect(screen.getByText("מה הגיל המינימלי?")).toBeInTheDocument();
  });

  it("marks only the correct option and shows its explanation", async () => {
    mockGetBookmarks.mockResolvedValue([BOOKMARK_A] as never);
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    const correctEl = container.querySelector('[data-state="correct"]');
    expect(correctEl?.textContent).toContain("עצור");
    expect(container.querySelector('[data-state="wrong"]')).toBeNull();
    expect(screen.getByText("תמרור זה משמעותו עצור")).toBeInTheDocument();
    expect(correctEl?.querySelector(".sr-only")?.textContent).toBe("optionCorrectSr");
  });

  it("renders a pressed bookmark toggle with the question id on each card", async () => {
    mockGetBookmarks.mockResolvedValue([BOOKMARK_A] as never);
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    const toggle = container.querySelector(".bookmark-toggle");
    expect(toggle?.getAttribute("aria-pressed")).toBe("true");
    expect(toggle?.getAttribute("data-question-id")).toBe("q1");
    expect(toggle?.getAttribute("type")).toBe("button");
  });

  it("uses Arabic question text for ar locale when populated", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const bookmark = { ...BOOKMARK_A, question_ar: "ما معنى هذه الإشارة؟" };
    mockGetBookmarks.mockResolvedValue([bookmark] as never);
    const jsx = await BookmarksPage();
    render(jsx);
    expect(screen.getByText("ما معنى هذه الإشارة؟")).toBeInTheDocument();
    expect(screen.queryByText("מה המשמעות של תמרור זה?")).not.toBeInTheDocument();
  });

  it("links back to the more page from the top bar", async () => {
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/more"][aria-label="closeLabel"]')).toBeTruthy();
  });

  it("loads the bookmark script", async () => {
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    expect(container.querySelector('script[data-src="/js/bookmark.js"]')).toBeTruthy();
  });
});
