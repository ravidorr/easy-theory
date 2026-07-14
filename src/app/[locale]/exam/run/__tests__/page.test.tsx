import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ExamRunPage from "../page";
import { createClient } from "@/lib/supabase";
import { getRandomExamQuestions } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getRandomExamQuestions: vi.fn() }));
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
const mockGetQuestions = vi.mocked(getRandomExamQuestions);

function makeQuestion(n: number) {
  return {
    id: `q${n}`,
    topic_id: "t1",
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
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetQuestions.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => makeQuestion(i + 1)) as never
    );
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

  it("renders footer controls and hidden result screen", async () => {
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(container.querySelector("#exam-prev")).toBeTruthy();
    expect(container.querySelector("#exam-next")).toBeTruthy();
    expect(container.querySelector("#exam-submit")).toBeTruthy();
    expect(container.querySelector("#exam-result")).toBeTruthy();
    expect(container.querySelector('a[href="/exam"]')).toBeTruthy();
  });

  it("resolves question and option images like the practice quiz", async () => {
    mockGetQuestions.mockResolvedValue([
      // Missing question photo → placeholder, rendered as a wide <img>.
      { ...makeQuestion(1), image_url: "/questions/does-not-exist.jpg" },
      // Existing question photo → wide <img> with the real path.
      { ...makeQuestion(2), image_url: "/questions/3012.jpg" },
      // Sign question (sign image + numeric option) → no question image, option rendered as sign.
      { ...makeQuestion(3), image_url: "/signs/sign-101.png", option_a: "101" },
    ] as never);
    const jsx = await ExamRunPage();
    const { container } = render(jsx);
    expect(container.querySelector('img[src="/placeholder.svg"]')).toBeTruthy();
    expect(container.querySelector('img[src="/questions/3012.jpg"]')).toBeTruthy();
    expect(container.querySelector('img[src="/signs/sign-101.png"]')).toBeTruthy();
  });

  it("gives question and option images alt text without revealing the answer", async () => {
    mockGetQuestions.mockResolvedValue([
      // Wide question photo → generic question-image alt.
      { ...makeQuestion(1), image_url: "/questions/3012.jpg" },
      // Sign question → option sign image labelled by sign number only.
      { ...makeQuestion(2), image_url: "/signs/sign-101.png", option_a: "101" },
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
    render(jsx);
    expect(screen.getByText("emptyQuestions")).toBeInTheDocument();
  });
});
