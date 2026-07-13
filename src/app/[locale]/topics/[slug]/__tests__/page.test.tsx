import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import TopicQuizPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getQuestionsForTopic } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";

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
}));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src }: { src: string }) =>
    React.createElement("img", { src, alt: "" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) =>
    React.createElement("a", { href }, children as React.ReactNode),
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

  it("falls back to option_a for ar locale when option_a_ar is missing", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const q = { ...QUESTION, option_b_ar: "انعطف يمينًا" };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "ar" }) });
    const { container } = render(jsx);
    expect(container.querySelector('[data-option="a"]')?.textContent).toContain("עצור");
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

  it("renders an empty question title when question_he is null", async () => {
    const q = { ...QUESTION, question_he: null };
    mockGetQuestions.mockResolvedValue([q] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs", locale: "he" }) });
    const { container } = render(jsx);
    expect(container.querySelector(".quiz-slide h2")?.textContent).toBe("");
  });
});
