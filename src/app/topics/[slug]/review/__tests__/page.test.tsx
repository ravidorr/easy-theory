import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ReviewPage from "../page";
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
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn().mockReturnValue(false) };
});

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

describe("ReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetTopicBySlug.mockResolvedValue(TOPIC as never);
    mockGetMistakes.mockResolvedValue([]);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(
      ReviewPage({ params: Promise.resolve({ slug: "signs" }) })
    ).rejects.toThrow("redirect");
  });

  it("calls notFound when topic slug does not exist", async () => {
    mockGetTopicBySlug.mockResolvedValue(null as never);
    await expect(
      ReviewPage({ params: Promise.resolve({ slug: "unknown" }) })
    ).rejects.toThrow("notFound");
  });

  it("shows empty state when there are no mistakes", async () => {
    mockGetMistakes.mockResolvedValue([]);
    const jsx = await ReviewPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("אין טעויות! עשית הכל נכון")).toBeInTheDocument();
  });

  it("shows singular text for one mistake", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await ReviewPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("שאלה אחת שגית")).toBeInTheDocument();
  });

  it("shows plural text with count for multiple mistakes", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A, MISTAKE_B] as never);
    const jsx = await ReviewPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("2 שאלות שגית")).toBeInTheDocument();
  });

  it("marks correct option with data-state=correct", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await ReviewPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const correctEl = container.querySelector('[data-state="correct"]');
    expect(correctEl).toBeTruthy();
    // The correct option contains the correct answer text
    expect(correctEl?.textContent).toContain("עצור");
  });

  it("marks selected wrong option with data-state=wrong", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await ReviewPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const wrongEl = container.querySelector('[data-state="wrong"]');
    expect(wrongEl).toBeTruthy();
    expect(wrongEl?.textContent).toContain("פנה ימינה");
  });

  it("options with neither correct nor wrong state have no data-state", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await ReviewPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const allOptions = container.querySelectorAll(".quiz-option");
    expect(allOptions).toHaveLength(4);
    const withoutState = Array.from(allOptions).filter(
      (el) => !el.getAttribute("data-state")
    );
    expect(withoutState).toHaveLength(2); // options c and d have no state
  });

  it("shows explanation text on the correct option", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await ReviewPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("תמרור זה משמעותו עצור")).toBeInTheDocument();
  });

  it("renders question text", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A] as never);
    const jsx = await ReviewPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    expect(screen.getByText("מה המשמעות של תמרור זה?")).toBeInTheDocument();
  });
});
