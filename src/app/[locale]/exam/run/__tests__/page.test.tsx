import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ExamRunPage from "../page";
import { createClient } from "@/lib/supabase";
import { getOrCreateExamSession, getQuestionsByIds, getRandomExamQuestions, getTopics } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import { localizeQuestion } from "@/lib/content-locale";

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
vi.mock("@/lib/db", () => ({ getOrCreateExamSession: vi.fn(), getQuestionsByIds: vi.fn(), getRandomExamQuestions: vi.fn(), getTopics: vi.fn() }));
vi.mock("@/lib/content-locale", () => ({
  localizeQuestion: vi.fn((locale: string, question: Record<string, string>) => ({
    question_display: locale === "ar" ? question.question_ar ?? "" : question.question_he ?? "",
    option_a_display: locale === "ar" ? question.option_a_ar ?? "" : question.option_a ?? "",
    option_b_display: locale === "ar" ? question.option_b_ar ?? "" : question.option_b ?? "",
    option_c_display: locale === "ar" ? question.option_c_ar ?? "" : question.option_c ?? "",
    option_d_display: locale === "ar" ? question.option_d_ar ?? "" : question.option_d ?? "",
  })),
}));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src, alt = "" }: { src: string; alt?: string }) =>
    React.createElement("img", { src, alt }),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) =>
    React.createElement("div", {
      "data-testid": "tabbar",
      "data-active": active,
      "data-current": current ?? "none",
    }),
}));
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: unknown }) =>
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
const mockGetQuestions = vi.mocked(getQuestionsByIds);
const mockGetRandomQuestions = vi.mocked(getRandomExamQuestions);
const mockGetSession = vi.mocked(getOrCreateExamSession);
const mockGetTopics = vi.mocked(getTopics);
const mockLocalizeQuestion = vi.mocked(localizeQuestion);
const originalSessionFlag = process.env.FEATURE_EXAM_SESSIONS_PERCENT;

function makeQuestion(n: number) {
  return {
    id: `q${n}`,
    topic_id: "t-traffic-laws",
    question_number: n,
    question_he: `שאלה ${n}`,
    question_ar: `سؤال ${n}`,
    option_a: "עצור",
    option_a_ar: "قف",
    option_b: "פנה ימינה",
    option_c: "פנה שמאלה",
    option_d: "המשך",
    correct_option: "a" as const,
    image_url: null,
    explanation_he: "כי ככה",
  };
}

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("ExamRunPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (originalSessionFlag === undefined) delete process.env.FEATURE_EXAM_SESSIONS_PERCENT;
    else process.env.FEATURE_EXAM_SESSIONS_PERCENT = originalSessionFlag;
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetSession.mockResolvedValue({ id: "s1", question_ids: Array.from({ length: 30 }, (_, i) => `q${i + 1}`), answers: {}, marked_question_ids: [], current_index: 0, started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 2400000).toISOString(), submitted_at: null, attempt_id: null, result: null } as never);
    mockGetQuestions.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => makeQuestion(i + 1)) as never
    );
    mockGetRandomQuestions.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeQuestion(i + 1)) as never);
    mockGetTopics.mockResolvedValue([
      { id: "t-signs", slug: "signs", name_he: "תמרורים" },
      { id: "t-traffic-laws", slug: "traffic-laws", name_he: "חוקי התנועה" },
    ] as never);
    vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
    vi.mocked(getLocale).mockResolvedValue("he" as never);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(ExamRunPage()).rejects.toThrow("redirect");
  });

  it("renders 30 slides with exam data attributes on the container", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    const main = container.querySelector("#exam-container");
    expect(main?.getAttribute("data-total")).toBe("30");
    expect(main?.getAttribute("data-duration-seconds")).toBe("2400");
    expect(main?.getAttribute("data-pass-mark")).toBe("26");
    expect(main?.getAttribute("data-session-id")).toBe("s1");
    expect(main?.getAttribute("data-current-index")).toBe("0");
    expect(container.querySelectorAll(".quiz-slide")).toHaveLength(30);
    expect(container.querySelectorAll(".quiz-option")).toHaveLength(120);
  });

  it("never ships the correct answer or explanations to the client", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(container.querySelectorAll("[data-correct]")).toHaveLength(0);
    expect(container.querySelectorAll(".quiz-option-explanation")).toHaveLength(0);
    expect(container.textContent).not.toContain("כי ככה");
  });

  it("renders the initial timer from the exam duration", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(container.querySelector("#exam-timer")?.textContent).toBe("40:00");
  });

  it("shows only the first slide initially", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    const slides = container.querySelectorAll<HTMLElement>(".quiz-slide");
    expect(slides[0].style.display).toBe("flex");
    expect(slides[1].style.display).toBe("none");
  });

  it("uses Arabic question and option fields for the ar locale", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const jsx = await ExamRunPage();
    render(jsx);
    expect(screen.getByText("سؤال 1")).toBeInTheDocument();
    expect(screen.getAllByText("قف")).toHaveLength(30);
  });

  it("uses randomized questions and empty session data when exam sessions are disabled", async () => {
    process.env.FEATURE_EXAM_SESSIONS_PERCENT = "0";
    mockGetRandomQuestions.mockResolvedValue([makeQuestion(1)] as never);
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    const main = container.querySelector("#exam-container");

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockGetRandomQuestions).toHaveBeenCalledWith(expect.anything(), 30);
    expect(main).toHaveAttribute("data-session-id", "");
    expect(main).toHaveAttribute("data-started-at", "");
    expect(main).toHaveAttribute("data-expires-at", "");
    expect(main).toHaveAttribute("data-current-index", "0");
    expect(main).toHaveAttribute("data-revision", "0");
    expect(main).toHaveAttribute("data-answers", "{}");
    expect(main).toHaveAttribute("data-marked-question-ids", "[]");
  });

  it("falls back to source fields when a localized display field is absent", async () => {
    mockGetQuestions.mockResolvedValue([makeQuestion(1)] as never);
    mockLocalizeQuestion.mockReturnValue({} as never);
    const jsx = await ExamRunPage();
    render(jsx);

    expect(screen.getByText("שאלה 1")).toBeInTheDocument();
    expect(screen.getByText("עצור")).toBeInTheDocument();
    expect(screen.getByText("פנה ימינה")).toBeInTheDocument();
    expect(screen.getByText("פנה שמאלה")).toBeInTheDocument();
    expect(screen.getByText("המשך")).toBeInTheDocument();
  });

  it("renders footer controls and hidden result screen", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(container.querySelector("#exam-prev")).toBeTruthy();
    expect(container.querySelector("#exam-next")).toBeTruthy();
    expect(container.querySelector("#exam-submit")).toBeTruthy();
    expect(container.querySelector("#exam-result")).toBeTruthy();
    expect(container.querySelector('a[href="/exam"]')).toBeTruthy();
  });

  it("renders shared Home navigation without the redundant close control", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "home");
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-current", "none");
    expect(container.querySelector(".icon-btn")).toBeNull();
  });

  it("server-renders the hidden review bar", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    const reviewBar = container.querySelector("#exam-review-bar");
    expect(reviewBar).toHaveAttribute("hidden");
    expect(container.querySelector("#exam-back-to-results")).toBeTruthy();
  });

  it("resolves question and option images like the practice quiz", async () => {
    mockGetQuestions.mockResolvedValue([
      // Missing question photo → placeholder, rendered as a wide <img>.
      { ...makeQuestion(1), image_url: "/questions/does-not-exist.jpg" },
      // Existing question photo → wide <img> with the real path.
      { ...makeQuestion(2), image_url: "/questions/3012.jpg" },
      // Sign question (sign image + numeric option) → no question image, option rendered as sign.
      { ...makeQuestion(3), topic_id: "t-signs", image_url: "/signs/sign-101.png", option_a: "101" },
      // Prompt sign does not match the numeric answer option → question image remains visible.
      { ...makeQuestion(4), image_url: "/signs/sign-126.png", option_a: "123" },
    ] as never);
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(container.querySelector('img[src="/placeholder.svg"]')).toBeTruthy();
    expect(container.querySelector('img[src="/questions/3012.jpg"]')).toBeTruthy();
    expect(container.querySelector('img[src="/signs/sign-101.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/signs/sign-126.png"]')).toBeTruthy();
  });

  it("renders question 1687 speed options as text", async () => {
    mockGetQuestions.mockResolvedValue([
      {
        ...makeQuestion(1687),
        question_number: 1687,
        option_a: "80",
        option_b: "110",
        option_c: "90",
        option_d: "100",
        correct_option: "b",
        image_url: null,
      },
    ] as never);

    const jsx = await ExamRunPage();
    const { container } = render(jsx);

    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("110")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(container.querySelector('img[src^="/signs/sign-"]')).toBeNull();
  });

  it("gives question and option images alt text without revealing the answer", async () => {
    mockGetQuestions.mockResolvedValue([
      // Wide question photo → generic question-image alt.
      { ...makeQuestion(1), image_url: "/questions/3012.jpg" },
      // Sign question → option sign image labelled by sign number only.
      { ...makeQuestion(2), topic_id: "t-signs", image_url: "/signs/sign-101.png", option_a: "101" },
      // Square sign as the question image (non-numeric options).
      { ...makeQuestion(3), image_url: "/signs/sign-100.png" },
    ] as never);
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(container.querySelector('img[src="/questions/3012.jpg"]')?.getAttribute("alt")).toBe("questionImageAlt");
    expect(container.querySelector('img[src="/signs/sign-101.png"]')?.getAttribute("alt")).toBe("signAlt");
    expect(container.querySelector('img[src="/signs/sign-100.png"]')?.getAttribute("alt")).toBe("signAlt");
  });

  it("renders every option button with aria-pressed false", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    const options = container.querySelectorAll(".quiz-option");
    expect(options.length).toBeGreaterThan(0);
    options.forEach((o) => {
      expect(o.getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("renders the back-to-exam CTA as a link styled as a button, without a nested button", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/exam"].btn-primary')).toBeTruthy();
    expect(container.querySelector("a button")).toBeNull();
  });

  it("shows the empty state when no questions exist", async () => {
    mockGetQuestions.mockResolvedValue([] as never);
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(screen.getByText("emptyQuestions")).toBeInTheDocument();
    expect(screen.getByText("emptyQuestionsTitle")).toBeInTheDocument();
    expect(container.querySelector('[data-empty-state]')).toHaveAttribute("data-tone", "warning");
    expect(screen.getByRole("link", { name: "emptyQuestionsCta" })).toHaveAttribute("href", "/practice");
    expect(container.querySelector("#exam-footer")).toBeNull();
  });
});
