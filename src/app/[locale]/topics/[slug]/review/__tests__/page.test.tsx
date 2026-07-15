import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ReviewPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getMistakesForTopic, getBookmarkedQuestionIds } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt?: string; className?: string }) =>
    React.createElement("img", { src, alt, className }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
  notFound: vi.fn().mockImplementation(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getTopicBySlug: vi.fn(),
  getMistakesForTopic: vi.fn(),
  getBookmarkedQuestionIds: vi.fn(),
}));
vi.mock("next/script", () => ({
  default: ({ src }: { src: string }) =>
    React.createElement("script", { "data-src": src }),
}));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src, alt = "" }: { src: string; alt?: string }) =>
    React.createElement("img", { src, alt, "data-testid": "sign-img" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetTopicBySlug = vi.mocked(getTopicBySlug);
const mockGetMistakes = vi.mocked(getMistakesForTopic);
const mockGetBookmarkedIds = vi.mocked(getBookmarkedQuestionIds);

const TOPIC = { id: "t1", slug: "signs", name_he: "תמרורים" };

const MISTAKE_A = {
  id: "q1",
  question_he: "מה המשמעות של תמרור זה?",
  option_a: "עצור",
  option_b: "פנה ימינה",
  option_c: "פנה שמאלה",
  option_d: "המשך",
  correct_option: "a",
  selected_option: "b",
  explanation_he: "תמרור זה משמעותו עצור",
  image_url: null,
};

const MISTAKE_B = {
  id: "q2",
  question_he: "מה הגיל המינימלי?",
  option_a: "16",
  option_b: "17",
  option_c: "18",
  option_d: "21",
  correct_option: "c",
  selected_option: "a",
  explanation_he: null,
  image_url: null,
};

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

const callPage = (scope?: string, slug = "signs") =>
  ReviewPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(scope ? { scope } : {}),
  });

describe("ReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetTopicBySlug.mockResolvedValue(TOPIC as never);
    mockGetMistakes.mockResolvedValue([]);
    mockGetBookmarkedIds.mockResolvedValue(new Set());
    vi.mocked(getTranslations).mockResolvedValue((key: string) => key);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(
      callPage()
    ).rejects.toThrow("redirect");
  });

  it("calls notFound when topic slug does not exist", async () => {
    mockGetTopicBySlug.mockResolvedValue(null as never);
    await expect(
      callPage(undefined, "unknown")
    ).rejects.toThrow("notFound");
  });

  it("shows emptyHint key when there are no mistakes", async () => {
    mockGetMistakes.mockResolvedValue([]);
    const jsx = await callPage();
    render(jsx);
    expect(screen.getByText("emptyHint")).toBeInTheDocument();
  });

  it("shows mistakeCountOne for one mistake", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await callPage();
    render(jsx);
    expect(screen.getByText("mistakeCountOne")).toBeInTheDocument();
  });

  it("shows retry link when there are mistakes", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/topics/signs/retry"]')).toBeTruthy();
  });

  it("does not show retry link when there are no mistakes", async () => {
    mockGetMistakes.mockResolvedValue([]);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/topics/signs/retry"]')).toBeNull();
  });

  it("shows mistakeCountMany with count for multiple mistakes", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A, MISTAKE_B] as never);
    const jsx = await callPage();
    render(jsx);
    expect(screen.getByText("mistakeCountMany")).toBeInTheDocument();
  });

  it("marks correct option with data-state=correct", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    const correctEl = container.querySelector('[data-state="correct"]');
    expect(correctEl).toBeTruthy();
    expect(correctEl?.textContent).toContain("עצור");
  });

  it("marks selected wrong option with data-state=wrong", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    const wrongEl = container.querySelector('[data-state="wrong"]');
    expect(wrongEl).toBeTruthy();
    expect(wrongEl?.textContent).toContain("פנה ימינה");
  });

  it("options with neither correct nor wrong state have no data-state", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    const allOptions = container.querySelectorAll(".quiz-option");
    expect(allOptions).toHaveLength(4);
    const withoutState = Array.from(allOptions).filter(
      (el) => !el.getAttribute("data-state")
    );
    expect(withoutState).toHaveLength(2);
  });

  it("exposes correct/wrong state to screen readers, not only via data-state", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    const correctSr = container.querySelector('[data-state="correct"] .sr-only');
    const wrongSr = container.querySelector('[data-state="wrong"] .sr-only');
    expect(correctSr?.textContent).toBe("optionCorrectSr");
    expect(wrongSr?.textContent).toBe("optionWrongSr");
    const unstated = Array.from(container.querySelectorAll(".quiz-option")).filter(
      (el) => !el.getAttribute("data-state")
    );
    unstated.forEach((el) => {
      expect(el.querySelector(".sr-only")).toBeNull();
    });
  });

  it("shows explanation text on the correct option", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await callPage();
    render(jsx);
    expect(screen.getByText("תמרור זה משמעותו עצור")).toBeInTheDocument();
  });

  it("renders markdown bold in explanation as <strong> without literal asterisks", async () => {
    const m = { ...MISTAKE_A, explanation_he: "**חגורות הבטיחות** מחזיקות את הנוסע" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    const explanation = container.querySelector(".quiz-option-explanation");
    expect(explanation?.querySelector("strong")?.textContent).toBe("חגורות הבטיחות");
    expect(explanation?.textContent).toContain("מחזיקות את הנוסע");
    expect(explanation?.textContent).not.toContain("**");
  });

  it("renders question text", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await callPage();
    render(jsx);
    expect(screen.getByText("מה המשמעות של תמרור זה?")).toBeInTheDocument();
  });

  it("renders image when /questions/ file exists on disk", async () => {
    const m = { ...MISTAKE_A, image_url: "/questions/TEST_IMAGE_DO_NOT_DELETE.png" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/questions/TEST_IMAGE_DO_NOT_DELETE.png']")).toBeTruthy();
  });

  it("renders placeholder image when /questions/ file does not exist", async () => {
    const m = { ...MISTAKE_A, image_url: "/questions/TEST_IMAGE_DOES_NOT_EXIST.png" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/placeholder.svg']")).toBeTruthy();
  });

  it("renders wide image for non-questions non-sign URL", async () => {
    const m = { ...MISTAKE_A, image_url: "/images/wide.jpg" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/images/wide.jpg']")).toBeTruthy();
  });

  it("renders sign image for sign- image URL", async () => {
    const m = { ...MISTAKE_A, image_url: "/signs/sign-100.png" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector("[data-testid='sign-img']")).toBeTruthy();
  });

  it("skips sign image at top when image_url is sign path and all options are sign numbers", async () => {
    const m = {
      ...MISTAKE_A,
      image_url: "/signs/sign-999.png",
      option_a: "101",
      option_b: "102",
      option_c: "103",
      option_d: "104",
    };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(
      container.querySelector("[data-testid='sign-img'][src='/signs/sign-999.png']")
    ).toBeNull();
  });

  it("skips sign image at top when one option is non-numeric text", async () => {
    const m = {
      ...MISTAKE_A,
      image_url: "/signs/sign-999.png",
      option_a: "101",
      option_b: "102",
      option_c: "103",
      option_d: "כל ארבעת התמרורים.",
    };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(
      container.querySelector("[data-testid='sign-img'][src='/signs/sign-999.png']")
    ).toBeNull();
  });

  it("renders text for digit option when sign file does not exist", async () => {
    const m = { ...MISTAKE_A, option_a: "9999" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    const correctOption = container.querySelector('[data-state="correct"]');
    expect(correctOption?.querySelector("img")).toBeNull();
  });

  it("renders sign image for digit option when sign file exists", async () => {
    const m = { ...MISTAKE_A, option_a: "100" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/signs/sign-100.png']")).toBeTruthy();
  });

  it("uses Hebrew option text (not option_a_ar) for he locale when option_a_ar is populated", async () => {
    const m = { ...MISTAKE_A, option_a_ar: "قف" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    render(jsx);
    expect(screen.getByText("עצור")).toBeInTheDocument();
    expect(screen.queryByText("قف")).not.toBeInTheDocument();
  });

  it("uses option_a_ar text for ar locale when option_a_ar is populated", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const m = { ...MISTAKE_A, option_a_ar: "قف" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    render(jsx);
    expect(screen.getByText("قف")).toBeInTheDocument();
    expect(screen.queryByText("עצור")).not.toBeInTheDocument();
  });

  it("does not fall back to option_a for ar locale when option_a_ar is missing", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const m = { ...MISTAKE_A, option_b_ar: "انعطف يمينًا" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    render(jsx);
    expect(screen.queryByText("עצור")).not.toBeInTheDocument();
    expect(screen.getByText("انعطف يمينًا")).toBeInTheDocument();
  });

  it("renders an empty question title when question_he is null", async () => {
    const m = { ...MISTAKE_A, question_he: null };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector("h3")?.textContent).toBe("");
  });

  it("labels the close link for screen readers", async () => {
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector("a[aria-label='closeLabel']")).toBeTruthy();
  });

  it("gives the question sign image a sign-number alt", async () => {
    const m = { ...MISTAKE_A, image_url: "/signs/sign-100.png" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    const img = container.querySelector("img[src='/signs/sign-100.png']");
    expect(img?.getAttribute("alt")).toBe("signAlt");
  });

  it("renders navigation CTAs as links styled as buttons, without nested buttons", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await callPage();
    const { container } = render(jsx);
    expect(container.querySelector("a.btn-primary")).toBeTruthy();
    expect(container.querySelector("a button")).toBeNull();
  });

  describe("bookmark toggle", () => {
    it("renders an unpressed toggle with the question id when not bookmarked", async () => {
      mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
      const jsx = await callPage();
      const { container } = render(jsx);
      const toggle = container.querySelector(".bookmark-toggle");
      expect(toggle?.getAttribute("aria-pressed")).toBe("false");
      expect(toggle?.getAttribute("data-question-id")).toBe("q1");
      expect(toggle?.getAttribute("aria-label")).toBe("bookmarkLabel");
    });

    it("renders a pressed toggle when the question is bookmarked", async () => {
      mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
      mockGetBookmarkedIds.mockResolvedValue(new Set(["q1"]));
      const jsx = await callPage();
      const { container } = render(jsx);
      expect(
        container.querySelector('.bookmark-toggle[aria-pressed="true"]')
      ).toBeTruthy();
    });

    it("loads the bookmark script", async () => {
      const jsx = await callPage();
      const { container } = render(jsx);
      expect(container.querySelector('script[data-src="/js/bookmark.js"]')).toBeTruthy();
    });
  });

  describe("scope toggle", () => {
    // Helper: return different mistake lists per scope argument.
    const mockByScope = (byScope: Record<string, unknown[]>) => {
      mockGetMistakes.mockImplementation(
        (async (_c: unknown, _u: unknown, _t: unknown, scope: string = "all") =>
          byScope[scope] ?? []) as never
      );
    };

    it("defaults to the lastSession scope", async () => {
      await callPage();
      expect(mockGetMistakes).toHaveBeenCalledWith(expect.anything(), "u1", "t1", "lastSession");
    });

    it("uses the all scope when ?scope=all", async () => {
      mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
      await callPage("all");
      expect(mockGetMistakes).toHaveBeenCalledWith(expect.anything(), "u1", "t1", "all");
    });

    it("treats an unknown scope value as lastSession", async () => {
      await callPage("garbage");
      expect(mockGetMistakes).toHaveBeenCalledWith(expect.anything(), "u1", "t1", "lastSession");
    });

    it("renders both toggle links and marks the active one", async () => {
      const jsx = await callPage();
      const { container } = render(jsx);
      const lastSessionLink = container.querySelector('a[href="/topics/signs/review"]');
      const allTimeLink = container.querySelector('a[href="/topics/signs/review?scope=all"]');
      expect(lastSessionLink).toBeTruthy();
      expect(allTimeLink).toBeTruthy();
      expect(lastSessionLink?.getAttribute("aria-current")).toBe("page");
      expect(allTimeLink?.getAttribute("aria-current")).toBeNull();
    });

    it("marks the all-time toggle option active when ?scope=all", async () => {
      const jsx = await callPage("all");
      const { container } = render(jsx);
      const allTimeLink = container.querySelector('a[href="/topics/signs/review?scope=all"]');
      expect(allTimeLink?.getAttribute("aria-current")).toBe("page");
    });

    it("shows emptyHintLastSession and a view-all link when only older mistakes exist", async () => {
      mockByScope({ lastSession: [], all: [MISTAKE_A] });
      const jsx = await callPage();
      const { container } = render(jsx);
      expect(screen.getByText("emptyHintLastSession")).toBeInTheDocument();
      expect(screen.getByText("viewAllMistakes")).toBeInTheDocument();
      expect(
        container.querySelectorAll('a[href="/topics/signs/review?scope=all"]').length
      ).toBeGreaterThan(1);
    });

    it("shows plain emptyHint without a view-all link when there are no mistakes at all", async () => {
      mockByScope({ lastSession: [], all: [] });
      const jsx = await callPage();
      render(jsx);
      expect(screen.getByText("emptyHint")).toBeInTheDocument();
      expect(screen.queryByText("viewAllMistakes")).not.toBeInTheDocument();
    });

    it("hides the retry link on the all-time view when the last session is clean", async () => {
      mockByScope({ lastSession: [], all: [MISTAKE_A] });
      const jsx = await callPage("all");
      const { container } = render(jsx);
      expect(container.querySelector('a[href="/topics/signs/retry"]')).toBeNull();
    });

    it("shows the retry link on the all-time view when the last session has mistakes", async () => {
      mockByScope({ lastSession: [MISTAKE_A], all: [MISTAKE_A, MISTAKE_B] });
      const jsx = await callPage("all");
      const { container } = render(jsx);
      expect(container.querySelector('a[href="/topics/signs/retry"]')).toBeTruthy();
    });
  });

  describe("SRS due indicators", () => {
    const PAST = "2020-01-01T00:00:00.000Z";
    const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    it("badges only due mistakes and shows the due count", async () => {
      mockGetMistakes.mockResolvedValue([
        { ...MISTAKE_A, due_at: PAST },
        { ...MISTAKE_B, due_at: FUTURE },
      ] as never);
      const jsx = await callPage();
      render(jsx);
      expect(screen.getAllByText("dueBadge")).toHaveLength(1);
      expect(screen.getByText("dueCount")).toBeInTheDocument();
    });

    it("treats an unscheduled mistake (null due_at) as due", async () => {
      mockGetMistakes.mockResolvedValue([{ ...MISTAKE_A, due_at: null }] as never);
      const jsx = await callPage();
      render(jsx);
      expect(screen.getByText("dueBadge")).toBeInTheDocument();
    });

    it("hides the badge and due count when nothing is due", async () => {
      mockGetMistakes.mockResolvedValue([
        { ...MISTAKE_A, due_at: FUTURE },
        { ...MISTAKE_B, due_at: FUTURE },
      ] as never);
      const jsx = await callPage();
      render(jsx);
      expect(screen.queryByText("dueBadge")).not.toBeInTheDocument();
      expect(screen.queryByText("dueCount")).not.toBeInTheDocument();
    });
  });
});
