import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import TopicQuizPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getQuestionsForTopic, getBookmarkedQuestionIds, getAnsweredQuestionIdsForTopic } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import { SIGNS_QUESTION_15_AR } from "@/lib/content/signs-question-15-ar";

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
  getQuestionsForTopic: vi.fn(),
  getBookmarkedQuestionIds: vi.fn(),
  getAnsweredQuestionIdsForTopic: vi.fn(),
}));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src, alt = "" }: { src: string; alt?: string }) =>
    React.createElement("img", { src, alt }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));
vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetTopicBySlug = vi.mocked(getTopicBySlug);
const mockGetQuestions = vi.mocked(getQuestionsForTopic);
const mockGetBookmarkedIds = vi.mocked(getBookmarkedQuestionIds);
const mockGetAnsweredIds = vi.mocked(getAnsweredQuestionIdsForTopic);

const TOPIC = { id: "t1", slug: "signs", name_he: "תמרורים" };
const QUESTION = {
  id: "q1",
  question_he: "מה המשמעות של תמרור זה?",
  option_a: "עצור",
  option_b: "פנה ימינה",
  option_c: "פנה שמאלה",
  option_d: "המשך",
  correct_option: "a",
  image_url: null,
  explanation_he: null,
};

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("TopicQuizPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetTopicBySlug.mockResolvedValue(TOPIC as never);
    mockGetQuestions.mockResolvedValue([]);
    mockGetBookmarkedIds.mockResolvedValue(new Set());
    mockGetAnsweredIds.mockResolvedValue(new Set());
    vi.mocked(getTranslations).mockResolvedValue((key: string) => key);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(
      TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) })
    ).rejects.toThrow("redirect");
  });

  it("calls notFound when topic slug does not exist", async () => {
    mockGetTopicBySlug.mockResolvedValue(null as never);
    await expect(
      TopicQuizPage({ params: Promise.resolve({ slug: "unknown", locale: "he" }) })
    ).rejects.toThrow("notFound");
  });

  it("shows emptyQuestions translation key when topic has no questions", async () => {
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    render(jsx);
    expect(screen.getByText("emptyQuestions")).toBeInTheDocument();
  });

  it("renders question text for first question", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    render(jsx);
    expect(screen.getByText("מה המשמעות של תמרור זה?")).toBeInTheDocument();
  });

  it("embeds server-side answered question ids on the quiz container", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    mockGetAnsweredIds.mockResolvedValue(new Set(["q-prev"]) as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const quiz = container.querySelector("#quiz-container");
    expect(quiz?.getAttribute("data-answered-ids")).toBe(JSON.stringify(["q-prev"]));
    expect(quiz?.getAttribute("data-answered-count")).toBe("1");
  });

  it("renders quiz count translation key", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    render(jsx);
    // t("count", { current: 1, total }) returns "count"
    expect(screen.getByText("count")).toBeInTheDocument();
  });

  it("sets data-correct attribute on quiz slide", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const slide = container.querySelector(".quiz-slide");
    expect(slide).toHaveAttribute("data-correct", "a");
  });

  it("sets data-question-id on quiz slide", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const slide = container.querySelector(".quiz-slide");
    expect(slide).toHaveAttribute("data-question-id", "q1");
  });

  it("renders 4 option buttons", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const options = container.querySelectorAll(".quiz-option");
    expect(options).toHaveLength(4);
  });

  it("shows link to review mistakes page", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/topics/signs/review"]')).toBeTruthy();
  });

  it("renders explanation text when explanation_he is present", async () => {
    const q = { ...QUESTION, explanation_he: "תמרור זה משמעותו עצור" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    render(jsx);
    expect(screen.getAllByText("תמרור זה משמעותו עצור").length).toBeGreaterThan(0);
  });

  it("renders markdown bold in explanation as <strong> without literal asterisks", async () => {
    const q = { ...QUESTION, explanation_he: "**חגורות הבטיחות** מחזיקות את הנוסע" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const explanation = container.querySelector(".quiz-option-explanation");
    expect(explanation?.querySelector("strong")?.textContent).toBe("חגורות הבטיחות");
    expect(explanation?.textContent).toContain("מחזיקות את הנוסע");
    expect(explanation?.textContent).not.toContain("**");
  });

  it("renders image when /questions/ file exists on disk", async () => {
    const q = { ...QUESTION, image_url: "/questions/TEST_IMAGE_DO_NOT_DELETE.png" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/questions/TEST_IMAGE_DO_NOT_DELETE.png']")).toBeTruthy();
  });

  it("renders placeholder image when /questions/ file does not exist", async () => {
    const q = { ...QUESTION, image_url: "/questions/TEST_IMAGE_DOES_NOT_EXIST.png" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/placeholder.svg']")).toBeTruthy();
  });

  it("renders wide image for non-questions non-sign URL", async () => {
    const q = { ...QUESTION, image_url: "/images/wide.jpg" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/images/wide.jpg']")).toBeTruthy();
  });

  it("renders sign image (non-wide) for sign- image URL", async () => {
    const q = { ...QUESTION, image_url: "/signs/sign-100.png" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/signs/sign-100.png']")).toBeTruthy();
  });

  it("renders text for digit option when sign file does not exist", async () => {
    const q = { ...QUESTION, option_a: "9999" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const optionA = container.querySelector('[data-option="a"]');
    expect(optionA).toBeTruthy();
    expect(optionA?.querySelector("img")).toBeNull();
  });

  it("skips question image when all options are sign numbers", async () => {
    const q = {
      ...QUESTION,
      option_a: "101",
      option_b: "102",
      option_c: "103",
      option_d: "104",
    };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/signs/sign-101.png']")).toBeTruthy();
  });

  it("skips question image when image_url is a sign path and all options are sign numbers", async () => {
    const q = {
      ...QUESTION,
      image_url: "/signs/sign-999.png",
      option_a: "101",
      option_b: "102",
      option_c: "103",
      option_d: "104",
    };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/signs/sign-999.png']")).toBeNull();
  });

  it("skips question image when image_url is a sign path and one option is non-numeric text", async () => {
    const q = {
      ...QUESTION,
      image_url: "/signs/sign-999.png",
      option_a: "101",
      option_b: "102",
      option_c: "103",
      option_d: "כל ארבעת התמרורים.",
    };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/signs/sign-999.png']")).toBeNull();
  });

  it("renders sign image for digit option when sign file exists", async () => {
    const q = { ...QUESTION, option_a: "100" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/signs/sign-100.png']")).toBeTruthy();
  });

  it("uses Hebrew option text (not option_a_ar) for he locale when option_a_ar is populated", async () => {
    const q = { ...QUESTION, option_a_ar: "قف" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const optionA = container.querySelector('[data-option="a"]');
    expect(optionA?.textContent).toContain("עצור");
    expect(optionA?.textContent).not.toContain("قف");
  });

  it("uses option_a_ar text for ar locale when option_a_ar is populated", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const q = { ...QUESTION, option_a_ar: "قف" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "ar" }) });
    const { container } = render(jsx);
    const optionA = container.querySelector('[data-option="a"]');
    expect(optionA?.textContent).toContain("قف");
    expect(optionA?.textContent).not.toContain("עצור");
  });

  it("renders Arabic question text for signs question 15 in ar locale", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const q = {
      ...QUESTION,
      question_number: SIGNS_QUESTION_15_AR.question_number,
      question_he: SIGNS_QUESTION_15_AR.question_he,
      question_ar: SIGNS_QUESTION_15_AR.question_ar,
      option_a_ar: SIGNS_QUESTION_15_AR.option_a_ar,
      option_b_ar: SIGNS_QUESTION_15_AR.option_b_ar,
      option_c_ar: SIGNS_QUESTION_15_AR.option_c_ar,
      option_d_ar: SIGNS_QUESTION_15_AR.option_d_ar,
    };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "ar" }) });
    render(jsx);
    expect(screen.getByText(SIGNS_QUESTION_15_AR.question_ar)).toBeInTheDocument();
    expect(screen.queryByText(SIGNS_QUESTION_15_AR.question_he)).not.toBeInTheDocument();
    expect(screen.getByText(SIGNS_QUESTION_15_AR.option_a_ar)).toBeInTheDocument();
  });

  it("does not fall back to option_a for ar locale when option_a_ar is missing", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const q = { ...QUESTION, option_b_ar: "انعطف يمينًا" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "ar" }) });
    const { container } = render(jsx);
    expect(container.querySelector('[data-option="a"]')?.textContent).not.toContain("עצור");
    expect(container.querySelector('[data-option="b"]')?.textContent).toContain("انعطف يمينًا");
  });

  it("hides all slides after the first one", async () => {
    const q2 = { ...QUESTION, id: "q2", question_he: "שאלה שנייה" };
    mockGetQuestions.mockResolvedValue([QUESTION, q2] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const slides = container.querySelectorAll<HTMLElement>(".quiz-slide");
    expect(slides).toHaveLength(2);
    expect(slides[0].style.display).toBe("flex");
    expect(slides[1].style.display).toBe("none");
  });

  it("renders the reward banner visible with an initial score of 0", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const banner = container.querySelector("#reward-banner");
    expect(banner).toBeTruthy();
    expect(banner).not.toHaveAttribute("hidden");
    expect(container.querySelector("#reward-score")?.textContent).toBe("0");
  });

  it("renders the reward message empty until an answer is confirmed", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("#reward-message")?.textContent).toBe("");
  });

  it("renders the +10 float element inside the labelled score pill", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const float = container.querySelector("#reward-float");
    expect(float?.textContent).toBe("+10");
    expect(float?.closest("[aria-label='scoreLabel']")).toBeTruthy();
  });

  it("renders an empty question title when question_he is null", async () => {
    const q = { ...QUESTION, question_he: null };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector(".quiz-slide h2")?.textContent).toBe("");
  });

  it("labels the close link for screen readers", async () => {
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector("a[aria-label='closeLabel']")).toBeTruthy();
  });

  it("renders every option button with aria-pressed false", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const options = container.querySelectorAll(".quiz-option");
    expect(options.length).toBeGreaterThan(0);
    options.forEach((o) => {
      expect(o.getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("gives the question sign image a sign-number alt", async () => {
    const q = { ...QUESTION, image_url: "/signs/sign-100.png" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const img = container.querySelector("img[src='/signs/sign-100.png']");
    expect(img?.getAttribute("alt")).toBe("signAlt");
  });

  it("gives wide question images a descriptive alt", async () => {
    const q = { ...QUESTION, image_url: "/images/wide.jpg" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const img = container.querySelector("img[src='/images/wide.jpg']");
    expect(img?.getAttribute("alt")).toBe("questionImageAlt");
  });

  it("gives option sign images a sign-number alt", async () => {
    const q = { ...QUESTION, option_a: "100" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const img = container.querySelector("img[src='/signs/sign-100.png']");
    expect(img?.getAttribute("alt")).toBe("signAlt");
  });

  it("renders final navigation as links styled as buttons, without nested buttons", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    const final = container.querySelector("#quiz-final");
    expect(final?.querySelector("a.btn-primary")).toBeTruthy();
    expect(final?.querySelector("a button")).toBeNull();
  });

  describe("bookmark toggle", () => {
    it("renders an unpressed toggle with the question id when not bookmarked", async () => {
      mockGetQuestions.mockResolvedValue([QUESTION] as never);
      const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
      const { container } = render(jsx);
      const toggle = container.querySelector(".bookmark-toggle");
      expect(toggle?.getAttribute("aria-pressed")).toBe("false");
      expect(toggle?.getAttribute("data-question-id")).toBe("q1");
      expect(toggle?.getAttribute("aria-label")).toBe("bookmarkLabel");
      expect(toggle?.getAttribute("type")).toBe("button");
    });

    it("renders a pressed toggle when the question is bookmarked", async () => {
      mockGetQuestions.mockResolvedValue([QUESTION] as never);
      mockGetBookmarkedIds.mockResolvedValue(new Set(["q1"]));
      const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
      const { container } = render(jsx);
      expect(
        container.querySelector('.bookmark-toggle[aria-pressed="true"]')
      ).toBeTruthy();
    });
  });
});
