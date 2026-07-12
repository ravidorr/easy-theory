import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import RetryMistakesPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getMistakesForTopic } from "@/lib/db";

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
}));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src }: { src: string }) =>
    React.createElement("img", { src, alt: "", "data-testid": "sign-img" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) =>
    React.createElement("a", { href }, children as React.ReactNode),
}));
vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetTopicBySlug = vi.mocked(getTopicBySlug);
const mockGetMistakes = vi.mocked(getMistakesForTopic);

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

describe("RetryMistakesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetTopicBySlug.mockResolvedValue(TOPIC as never);
    mockGetMistakes.mockResolvedValue([MISTAKE_A]);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(
      RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) })
    ).rejects.toThrow("redirect");
  });

  it("calls notFound when topic slug does not exist", async () => {
    mockGetTopicBySlug.mockResolvedValue(null as never);
    await expect(
      RetryMistakesPage({ params: Promise.resolve({ slug: "unknown" }) })
    ).rejects.toThrow("notFound");
  });

  it("redirects to review page when there are no mistakes", async () => {
    mockGetMistakes.mockResolvedValue([]);
    await expect(
      RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) })
    ).rejects.toThrow("redirect");
  });

  it("renders question text for first mistake", async () => {
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("מה המשמעות של תמרור זה?")).toBeInTheDocument();
  });

  it("renders all mistakes as slides", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A, MISTAKE_B] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelectorAll(".quiz-slide")).toHaveLength(2);
  });

  it("renders '1 מתוך N' quiz count", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A, MISTAKE_B] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("1 מתוך 2")).toBeInTheDocument();
  });

  it("sets data-quiz-mode=retry on the container", async () => {
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelector("#quiz-container")).toHaveAttribute("data-quiz-mode", "retry");
  });

  it("sets data-correct on each quiz slide", async () => {
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelector(".quiz-slide")).toHaveAttribute("data-correct", "a");
  });

  it("close button links back to review page", async () => {
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/topics/signs/review"]')).toBeTruthy();
  });

  it("renders 4 option buttons per slide", async () => {
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelectorAll(".quiz-option")).toHaveLength(4);
  });

  it("renders placeholder image when /questions/ file does not exist", async () => {
    const m = { ...MISTAKE_A, image_url: "/questions/TEST_IMAGE_DOES_NOT_EXIST.png" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/placeholder.svg']")).toBeTruthy();
  });
});
