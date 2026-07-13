import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import RetryMistakesPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getMistakesForTopic } from "@/lib/db";
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
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
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
    vi.mocked(getTranslations).mockResolvedValue((key: string) => key);
    vi.mocked(getLocale).mockResolvedValue("he");
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

  it("renders markdown bold in explanation as <strong> without literal asterisks", async () => {
    const m = { ...MISTAKE_A, explanation_he: "**חגורות הבטיחות** מחזיקות את הנוסע" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const explanation = container.querySelector(".quiz-option-explanation");
    expect(explanation?.querySelector("strong")?.textContent).toBe("חגורות הבטיחות");
    expect(explanation?.textContent).toContain("מחזיקות את הנוסע");
    expect(explanation?.textContent).not.toContain("**");
  });

  it("renders all mistakes as slides", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A, MISTAKE_B] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelectorAll(".quiz-slide")).toHaveLength(2);
  });

  it("renders quiz count translation key", async () => {
    mockGetMistakes.mockResolvedValue([MISTAKE_A, MISTAKE_B] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    render(jsx);
    // t("count", { current: 1, total }) returns "count"
    expect(screen.getByText("count")).toBeInTheDocument();
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

  it("uses Hebrew option text (not option_a_ar) for he locale when option_a_ar is populated", async () => {
    const m = { ...MISTAKE_A, option_a_ar: "قف" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const optionA = container.querySelector('[data-option="a"]');
    expect(optionA?.textContent).toContain("עצור");
    expect(optionA?.textContent).not.toContain("قف");
  });

  it("hides the question image but shows sign options for sign questions", async () => {
    // Sign question: /signs/ image + numeric options → question image suppressed,
    // numeric options render as sign images (sign-100.png exists in public/signs)
    const m = { ...MISTAKE_A, image_url: "/signs/sign-100.png", option_a: "100" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const signImgs = container.querySelectorAll("img[src='/signs/sign-100.png']");
    expect(signImgs).toHaveLength(1);
    expect(signImgs[0].closest(".quiz-option")).toBeTruthy();
  });

  it("renders /signs/ image as square SignImage when options are not numeric", async () => {
    const m = { ...MISTAKE_A, image_url: "/signs/sign-100.png" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    // Square branch uses the (mocked) SignImage component, not a raw wide <img>
    const img = container.querySelector("img[src='/signs/sign-100.png']");
    expect(img).toHaveAttribute("data-testid", "sign-img");
  });

  it("renders existing /questions/ image as a wide image", async () => {
    const m = { ...MISTAKE_A, image_url: "/questions/3012.jpg" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const img = container.querySelector("img[src='/questions/3012.jpg']");
    expect(img).toBeTruthy();
    expect(img).not.toHaveAttribute("data-testid");
  });

  it("renders the reward banner visible with an initial score of 0 and empty message", async () => {
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const banner = container.querySelector("#reward-banner");
    expect(banner).toBeTruthy();
    expect(banner).not.toHaveAttribute("hidden");
    expect(container.querySelector("#reward-score")?.textContent).toBe("0");
    expect(container.querySelector("#reward-message")?.textContent).toBe("");
    expect(container.querySelector("#reward-float")?.textContent).toBe("+10");
  });

  it("renders an empty question title when question_he is null", async () => {
    const m = { ...MISTAKE_A, question_he: null };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelector(".quiz-slide h2")?.textContent).toBe("");
  });

  it("falls back to option_a for ar locale when option_a_ar is missing", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const m = { ...MISTAKE_A, option_b_ar: "انعطف يمينًا" };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    expect(container.querySelector('[data-option="a"]')?.textContent).toContain("עצור");
    expect(container.querySelector('[data-option="b"]')?.textContent).toContain("انعطف يمينًا");
  });

  it("uses option_a_ar text for ar locale when option_a_ar is populated", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const m = { ...MISTAKE_A, option_a_ar: "قف", explanation_he: null };
    mockGetMistakes.mockResolvedValue([m] as never);
    const jsx = await RetryMistakesPage({ params: Promise.resolve({ slug: "signs" }) });
    const { container } = render(jsx);
    const optionA = container.querySelector('[data-option="a"]');
    expect(optionA?.textContent).toContain("قف");
    expect(optionA?.textContent).not.toContain("עצור");
  });
});
