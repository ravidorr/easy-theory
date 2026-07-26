import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DiagnosticPage from "../page";
import { createClient } from "@/lib/supabase";
import { getQuestionsForTopic, getTopics } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getQuestionsForTopic: vi.fn(), getTopics: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ featureEnabled: vi.fn().mockReturnValue(true) }));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(),
  getTranslations: vi.fn(),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetTopics = vi.mocked(getTopics);
const mockGetQuestions = vi.mocked(getQuestionsForTopic);

const topics = ["signs", "traffic-laws", "road-safety", "vehicle"].map((slug, index) => ({ id: `t${index}`, slug }));
const question = (id: string) => ({
  id,
  question_he: "שאלה בעברית",
  question_ar: "سؤال بالعربية",
  option_a: "תשובה א",
  option_a_ar: "الإجابة أ",
  option_b: "תשובה ב",
  option_b_ar: "الإجابة ب",
  option_c: "תשובה ג",
  option_c_ar: "الإجابة ج",
  option_d: "תשובה ד",
  option_d_ar: "الإجابة د",
});

describe("DiagnosticPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);
    mockGetTopics.mockResolvedValue(topics as never);
    mockGetQuestions.mockImplementation(async (_client, topicId) => [question(`${topicId}-1`), question(`${topicId}-2`), question(`${topicId}-3`)] as never);
    vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
  });

  it("renders Arabic question and option fields for the Arabic locale", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    render(await DiagnosticPage());

    expect(screen.getAllByText(/سؤال بالعربية/)).toHaveLength(12);
    expect(screen.getAllByText("الإجابة أ")).toHaveLength(12);
    expect(screen.queryByText("שאלה בעברית")).toBeNull();
  });
});
