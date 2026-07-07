import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import TopicQuizPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getQuestionsForTopic } from "@/lib/db";

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
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn().mockReturnValue(false) };
});

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
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(
      TopicQuizPage({ params: Promise.resolve({ slug: "signs" }) })
    ).rejects.toThrow("redirect");
  });

  it("calls notFound when topic slug does not exist", async () => {
    mockGetTopicBySlug.mockResolvedValue(null as never);
    await expect(
      TopicQuizPage({ params: Promise.resolve({ slug: "unknown" }) })
    ).rejects.toThrow("notFound");
  });

  it("shows empty state when topic has no questions", async () => {
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("אין שאלות זמינות לנושא זה עדיין.")).toBeInTheDocument();
  });

  it("renders question text for first question", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("מה המשמעות של תמרור זה?")).toBeInTheDocument();
  });

  it("renders '1 מתוך N' quiz count", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("1 מתוך 1")).toBeInTheDocument();
  });

  it("sets data-correct attribute on quiz slide", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const slide = container.querySelector(".quiz-slide");
    expect(slide).toHaveAttribute("data-correct", "a");
  });

  it("sets data-question-id on quiz slide", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const slide = container.querySelector(".quiz-slide");
    expect(slide).toHaveAttribute("data-question-id", "q1");
  });

  it("renders 4 option buttons", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const options = container.querySelectorAll(".quiz-option");
    expect(options).toHaveLength(4);
  });

  it("shows link to review mistakes page", async () => {
    mockGetQuestions.mockResolvedValue([QUESTION] as never);
    const jsx = await TopicQuizPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/topics/signs/review"]')).toBeTruthy();
  });
});
