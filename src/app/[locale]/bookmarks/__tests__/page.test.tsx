import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import BookmarksPage from "../page";
import { createClient } from "@/lib/supabase";
import { getBookmarkedQuestions, getTopics } from "@/lib/db";
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
  getTopics: vi.fn(),
}));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src, alt = "" }: { src: string; alt?: string }) =>
    React.createElement("img", { src, alt, "data-testid": "sign-img" }),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) =>
    React.createElement("div", { "data-testid": "tabbar", "data-active": active, "data-current": current ?? "none" }),
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
const mockGetTopics = vi.mocked(getTopics);

const BOOKMARK_A = {
  id: "q1",
  topic_id: "t-signs",
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
  topic_id: "t-traffic-laws",
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
    mockGetTopics.mockResolvedValue([
      { id: "t-signs", slug: "signs", name_he: "תמרורים" },
      { id: "t-traffic-laws", slug: "traffic-laws", name_he: "חוקי התנועה" },
    ] as never);
    vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(BookmarksPage()).rejects.toThrow("redirect");
  });

  it("shows emptyHint without a return-home CTA when there are no bookmarks", async () => {
    const jsx = await BookmarksPage();
    render(jsx);
    expect(screen.getByText("emptyHint")).toBeInTheDocument();
    expect(screen.queryByText("backHome")).not.toBeInTheDocument();
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

  it("falls back to the placeholder when the question image is missing", async () => {
    mockGetBookmarks.mockResolvedValue([
      { ...BOOKMARK_A, image_url: "/questions/does-not-exist.jpg" },
    ] as never);
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    expect(container.querySelector('img[src="/placeholder.svg"]')).toBeTruthy();
  });

  it("renders an existing question image as a wide image", async () => {
    mockGetBookmarks.mockResolvedValue([
      { ...BOOKMARK_A, image_url: "/questions/3012.jpg" },
    ] as never);
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    const img = container.querySelector('img[src="/questions/3012.jpg"]');
    expect(img?.getAttribute("alt")).toBe("questionImageAlt");
    expect(container.querySelector('[data-testid="sign-img"]')).toBeNull();
  });

  it("hides the question image and renders the option as a sign for sign questions", async () => {
    mockGetBookmarks.mockResolvedValue([
      { ...BOOKMARK_A, image_url: "/signs/sign-101.png", option_a: "101" },
    ] as never);
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    const signImgs = container.querySelectorAll('[data-testid="sign-img"]');
    expect(signImgs).toHaveLength(1);
    expect(signImgs[0].getAttribute("src")).toBe("/signs/sign-101.png");
    expect(screen.getByText("101")).toBeInTheDocument();
  });

  it("renders a square sign as the question image when options are not sign numbers", async () => {
    mockGetBookmarks.mockResolvedValue([
      { ...BOOKMARK_A, image_url: "/signs/sign-100.png" },
    ] as never);
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    const sign = container.querySelector('[data-testid="sign-img"]');
    expect(sign?.getAttribute("src")).toBe("/signs/sign-100.png");
    expect(sign?.getAttribute("alt")).toBe("signAlt");
  });

  it("does not fall back to Hebrew question text for ar locale when question_ar is absent", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    mockGetBookmarks.mockResolvedValue([BOOKMARK_A] as never);
    const jsx = await BookmarksPage();
    render(jsx);
    expect(screen.queryByText("מה המשמעות של תמרור זה?")).not.toBeInTheDocument();
  });

  it("renders the More TabBar as active without redundant exit controls", async () => {
    mockGetBookmarks.mockResolvedValue([BOOKMARK_A] as never);
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "more");
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-current", "none");
    expect(container.querySelector("a[aria-label='closeLabel']")).toBeNull();
    expect(screen.queryByText("backHome")).not.toBeInTheDocument();
  });

  it("loads the bookmark script", async () => {
    const jsx = await BookmarksPage();
    const { container } = render(jsx);
    expect(container.querySelector('script[data-src="/js/bookmark.js"]')).toBeTruthy();
  });
});
